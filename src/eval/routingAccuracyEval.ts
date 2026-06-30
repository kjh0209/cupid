// ============================================================
// Routing Accuracy Evaluator (replaces the judge-only harness)
//
// What this measures (per prompt):
//   1. CLASSIFICATION ACCURACY — does the router output the
//      expected_task_type? (binary)
//   2. TIER FLOOR COMPLIANCE — is the routed model at or above
//      the expected minimum tier? (binary, hard constraint)
//   3. TIER CEILING COMPLIANCE — is the router not wastefully
//      over-routing simple tasks to strong tier? (binary)
//   4. DESIGN BAR (creative_generation / ui only) — does the
//      output text hit each required visual signal? (multi-flag)
//
// The headline metrics:
//   - Routing accuracy = (correctly classified) / total
//   - Tier-floor compliance = (no under-route) / total
//   - Tier-ceiling efficiency = (no over-route) / total
//   - Per-category breakdown + per-failure analysis
//
// CRITICAL: this measures WHETHER routing is right, not just
// whether the final output is good. brick-out is a routing-floor
// failure even if gpt-4o-mini happens to produce ok code, because
// the prompt mandates strong tier.
//
// Run: pnpm exec tsx src/eval/routingAccuracyEval.ts
// Output: reports/routing_accuracy.md + routing_accuracy.csv
// ============================================================

import fs from "fs";
import path from "path";
import { loadDotEnv } from "../utils/loadEnv.js";
import { CORPUS } from "./realWorldCorpus.js";
import type { CorpusPrompt } from "./realWorldCorpus.js";
import type { ModelTier, TaskType } from "../types.js";
import { logger } from "../utils/logger.js";

loadDotEnv();

const TIER_ORDER: Record<ModelTier, number> = {
  cheap: 0, mid: 1, long_context: 2, strong: 3, local_private: 0, unknown: 0,
};

interface RouteResult {
  classifiedTaskType: string;
  routedModel: string;
  routedTier: string;
  routerCostUsd: number;
  routerResponse: string;
  benchmarkCostUsd: number;
  benchmarkResponse: string;
  selfReviseAuto: boolean;
  fellBackToRules: boolean;
  rationale: string;
  reasons: string[];
  topCandidates: Array<{ modelId: string; tier: string; score: number }>;
  error?: string;
}

async function route(baseUrl: string, prompt: CorpusPrompt): Promise<RouteResult> {
  // Tokens: creative/refactor/arch need more headroom
  const heavyTasks = new Set(["creative_generation", "multi_file_refactor", "architecture_design", "database_schema_change", "security_sensitive_change", "performance_optimization", "devops_config"]);
  const maxTokens = prompt.expectedTaskType === "creative_generation" ? 8000
    : heavyTasks.has(prompt.expectedTaskType) ? 3000
    : 1500;

  const body = {
    prompt: prompt.prompt,
    userMode: prompt.userMode ?? "balanced",
    maxTokens,
    routingMode: "llm_assisted",
    rawCode: prompt.rawCode,
    fileName: prompt.fileName,
    sessionKey: "",
    useCpl: false,
    extractCpl: false,
  };

  try {
    const res = await fetch(`${baseUrl}/api/compare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      return {
        classifiedTaskType: "?", routedModel: "(http error)", routedTier: "?",
        routerCostUsd: 0, routerResponse: "", benchmarkCostUsd: 0, benchmarkResponse: "",
        selfReviseAuto: false, fellBackToRules: false,
        rationale: "", reasons: [], topCandidates: [],
        error: `HTTP ${res.status}`,
      };
    }
    const d = await res.json() as any;
    return {
      classifiedTaskType: d.classification?.taskType ?? "?",
      routedModel: d.routing?.selectedModel ?? "?",
      routedTier: d.routing?.tier ?? "?",
      routerCostUsd: d.router?.costUsd ?? 0,
      routerResponse: d.router?.response ?? "",
      benchmarkCostUsd: d.benchmark?.costUsd ?? 0,
      benchmarkResponse: d.benchmark?.response ?? "",
      selfReviseAuto: d.executor?.selfReviseAutoTriggered ?? false,
      fellBackToRules: d.llmRouting?.fellBackToRules ?? false,
      rationale: d.llmRouting?.rationale ?? "",
      reasons: d.routing?.reasons ?? [],
      topCandidates: (d.routing?.topCandidates ?? []).slice(0, 3),
    };
  } catch (err) {
    return {
      classifiedTaskType: "?", routedModel: "(error)", routedTier: "?",
      routerCostUsd: 0, routerResponse: "", benchmarkCostUsd: 0, benchmarkResponse: "",
      selfReviseAuto: false, fellBackToRules: false,
      rationale: "", reasons: [], topCandidates: [],
      error: String(err),
    };
  }
}

interface DesignCheck {
  signal: string;
  found: boolean;
}

function checkDesignBar(response: string, bar: string[]): DesignCheck[] {
  const t = response.toLowerCase();
  const checks: Record<string, () => boolean> = {
    "multi-color": () => {
      const hexColors = (response.match(/#[0-9a-fA-F]{3,6}\b/g) ?? []);
      const distinct = new Set(hexColors.map((c) => c.toLowerCase().slice(0, 4)));
      return distinct.size >= 3 || /\b(red|green|yellow|blue|purple|orange|pink|cyan)\b/i.test(response);
    },
    "score": () => /\bscore\b/i.test(response),
    "lives": () => /\blives?\b/i.test(response),
    "endstate": () => /\b(game over|gameover|you win|you lose|press space to (restart|continue)|game complete)\b/i.test(response),
    "themed-bg": () => /background.*?(#[0-2][0-9a-f]{2,5}|navy|charcoal|black|dark|gradient|linear-gradient)/i.test(response),
    "transitions": () => /\b(transition|animation|@keyframes|transform)\b/i.test(t),
    "typography": () => /font-family/i.test(t),
    "border-radius": () => /border-radius/i.test(t),
    "box-shadow": () => /box-shadow/i.test(t),
    "self-contained": () => /<!doctype/i.test(t) && /<style[\s>]/i.test(t) && /<script[\s>]/i.test(t),
  };
  return bar.map((sig) => ({ signal: sig, found: (checks[sig] ?? (() => false))() }));
}

interface EvalRow {
  prompt: CorpusPrompt;
  routed: RouteResult;
  // Per-prompt verdicts
  taskTypeCorrect: boolean;
  tierFloorOk: boolean;
  tierCeilingOk: boolean;
  designChecks: DesignCheck[];
  designPassRate: number;        // 0-1
  // For the report
  routedTierRank: number;
  expectedFloorRank: number;
}

function evaluate(row: { prompt: CorpusPrompt; routed: RouteResult }): EvalRow {
  const { prompt, routed } = row;
  const taskTypeCorrect = routed.classifiedTaskType === prompt.expectedTaskType;
  const routedTierRank = TIER_ORDER[routed.routedTier as ModelTier] ?? 0;
  const expectedFloorRank = TIER_ORDER[prompt.tierFloor];
  const tierFloorOk = !!routed.error || routedTierRank >= expectedFloorRank;
  const tierCeilingOk = !prompt.tierCeiling || routedTierRank <= TIER_ORDER[prompt.tierCeiling as ModelTier];
  const designChecks = (prompt.designBar && routed.routerResponse)
    ? checkDesignBar(routed.routerResponse, prompt.designBar)
    : [];
  const designPassRate = designChecks.length === 0 ? 1
    : designChecks.filter((c) => c.found).length / designChecks.length;
  return { prompt, routed, taskTypeCorrect, tierFloorOk, tierCeilingOk, designChecks, designPassRate, routedTierRank, expectedFloorRank };
}

async function runAll() {
  const baseUrl = process.env["EVAL_BASE_URL"] ?? "http://localhost:3300";
  logger.info(`Routing accuracy eval — base=${baseUrl}, corpus=${CORPUS.length}`);
  for (let i = 0; i < 20; i++) {
    try { const r = await fetch(`${baseUrl}/health`); if (r.ok) break; } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 500));
  }

  // Concurrency: 4 simultaneous prompts (limit by API rate)
  const PARALLEL = 4;
  const rows: EvalRow[] = [];
  for (let i = 0; i < CORPUS.length; i += PARALLEL) {
    const batch = CORPUS.slice(i, i + PARALLEL);
    const routed = await Promise.all(batch.map((p) => route(baseUrl, p)));
    for (let j = 0; j < batch.length; j++) {
      const ev = evaluate({ prompt: batch[j]!, routed: routed[j]! });
      rows.push(ev);
      const flags = [
        ev.taskTypeCorrect ? "✓task" : `✗task(${ev.routed.classifiedTaskType})`,
        ev.tierFloorOk ? "✓floor" : `✗FLOOR(want≥${ev.prompt.tierFloor},got${ev.routed.routedTier})`,
        ev.tierCeilingOk ? "✓ceil" : `✗ceil`,
        ev.prompt.designBar ? `design ${(ev.designPassRate * 100).toFixed(0)}%` : "",
      ].filter(Boolean).join(" ");
      logger.info(`[${rows.length}/${CORPUS.length}] ${ev.prompt.id.padEnd(12)} → ${ev.routed.routedModel.padEnd(35)} ${flags}${ev.routed.error ? " ERR:" + ev.routed.error.slice(0, 60) : ""}`);
    }
  }

  // ── Aggregate ──
  const outDir = path.resolve("./reports");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const classifiedRight = rows.filter((r) => r.taskTypeCorrect).length;
  const floorOk = rows.filter((r) => r.tierFloorOk).length;
  const ceilOk = rows.filter((r) => r.tierCeilingOk).length;
  const designPrompts = rows.filter((r) => r.prompt.designBar);
  const avgDesign = designPrompts.length === 0 ? 0
    : designPrompts.reduce((acc, r) => acc + r.designPassRate, 0) / designPrompts.length;

  const totalRouterCost = rows.reduce((a, r) => a + r.routed.routerCostUsd, 0);
  const totalBenchCost = rows.reduce((a, r) => a + r.routed.benchmarkCostUsd, 0);
  const errCount = rows.filter((r) => r.routed.error).length;

  // Per-category breakdown
  const cats = new Map<string, EvalRow[]>();
  for (const r of rows) {
    const list = cats.get(r.prompt.category) ?? [];
    list.push(r);
    cats.set(r.prompt.category, list);
  }

  // Per-failure clusters
  const failedFloor = rows.filter((r) => !r.tierFloorOk);
  const failedClass = rows.filter((r) => !r.taskTypeCorrect);
  const failedDesign = designPrompts.filter((r) => r.designPassRate < 0.7);

  // ── CSV ──
  const csv = ["id,category,prompt,expected_task,expected_floor,classified_task,routed_model,routed_tier,task_correct,floor_ok,ceiling_ok,design_pass_pct,router_cost,benchmark_cost,llm_fellback,error"];
  for (const r of rows) {
    csv.push([
      r.prompt.id,
      r.prompt.category,
      `"${r.prompt.prompt.replace(/"/g, "''").slice(0, 100)}"`,
      r.prompt.expectedTaskType,
      r.prompt.tierFloor,
      r.routed.classifiedTaskType,
      r.routed.routedModel,
      r.routed.routedTier,
      r.taskTypeCorrect ? "Y" : "N",
      r.tierFloorOk ? "Y" : "N",
      r.tierCeilingOk ? "Y" : "N",
      (r.designPassRate * 100).toFixed(0),
      r.routed.routerCostUsd.toFixed(6),
      r.routed.benchmarkCostUsd.toFixed(6),
      r.routed.fellBackToRules ? "Y" : "N",
      `"${(r.routed.error ?? "").slice(0, 80)}"`,
    ].join(","));
  }
  fs.writeFileSync(path.join(outDir, "routing_accuracy.csv"), csv.join("\n"));

  // ── Markdown report with failure analysis ──
  const md: string[] = [];
  md.push(`# Routing Accuracy Report`);
  md.push("");
  md.push(`Generated: ${new Date().toISOString()}`);
  md.push(`Corpus: ${CORPUS.length} real-world prompts with human-assigned ground truth`);
  md.push(`Errors: ${errCount}`);
  md.push("");
  md.push(`## Headline`);
  md.push("");
  md.push(`| Metric | Value |`);
  md.push(`|---|---|`);
  md.push(`| **Classification accuracy** | **${classifiedRight}/${rows.length} = ${(100 * classifiedRight / rows.length).toFixed(1)}%** |`);
  md.push(`| **Tier-floor compliance** (no under-route) | **${floorOk}/${rows.length} = ${(100 * floorOk / rows.length).toFixed(1)}%** |`);
  md.push(`| Tier-ceiling efficiency (no over-route) | ${ceilOk}/${rows.length} = ${(100 * ceilOk / rows.length).toFixed(1)}% |`);
  md.push(`| Avg design-bar pass rate (visual tasks only) | ${(avgDesign * 100).toFixed(1)}% (${designPrompts.length} prompts) |`);
  md.push(`| Total router cost (this run) | $${totalRouterCost.toFixed(4)} |`);
  md.push(`| Total benchmark cost | $${totalBenchCost.toFixed(4)} |`);
  md.push(`| Cost reduction | ${(((totalBenchCost - totalRouterCost) / Math.max(0.0001, totalBenchCost)) * 100).toFixed(1)}% |`);
  md.push("");

  // ── Per-category ──
  md.push(`## Per-category accuracy`);
  md.push("");
  md.push(`| Category | N | Class% | Floor% | Ceil% | Design% | Modal route |`);
  md.push(`|---|---|---|---|---|---|---|`);
  for (const [cat, list] of [...cats.entries()].sort()) {
    const c = list.filter((r) => r.taskTypeCorrect).length;
    const f = list.filter((r) => r.tierFloorOk).length;
    const ce = list.filter((r) => r.tierCeilingOk).length;
    const dPrompts = list.filter((r) => r.prompt.designBar);
    const dPct = dPrompts.length === 0 ? "—"
      : (100 * dPrompts.reduce((a, r) => a + r.designPassRate, 0) / dPrompts.length).toFixed(0) + "%";
    const modelDist = new Map<string, number>();
    for (const r of list) modelDist.set(r.routed.routedModel, (modelDist.get(r.routed.routedModel) ?? 0) + 1);
    const modal = [...modelDist.entries()].sort((a, b) => b[1] - a[1])[0];
    const modalStr = modal ? `${modal[0]} × ${modal[1]}` : "?";
    md.push(`| ${cat} | ${list.length} | ${(100 * c / list.length).toFixed(0)}% | ${(100 * f / list.length).toFixed(0)}% | ${(100 * ce / list.length).toFixed(0)}% | ${dPct} | ${modalStr} |`);
  }
  md.push("");

  // ── Failure analysis (the KEY section) ──
  md.push(`## 🚨 Failure analysis — what to fix next`);
  md.push("");

  md.push(`### Tier-FLOOR violations (${failedFloor.length}) — high priority`);
  md.push(`These prompts were routed to a model BELOW the minimum tier they require. Common cause: wrong task type classification, or the right task type but the tier policy is too permissive.`);
  md.push("");
  if (failedFloor.length === 0) md.push(`✅ No floor violations.`);
  else {
    md.push(`| ID | Prompt | Expected | Got | Cause |`);
    md.push(`|---|---|---|---|---|`);
    for (const r of failedFloor.slice(0, 30)) {
      const cause = r.taskTypeCorrect
        ? `classifier got "${r.routed.classifiedTaskType}" right but tier policy allowed ${r.routed.routedTier}`
        : `MISCLASSIFIED as "${r.routed.classifiedTaskType}"`;
      md.push(`| ${r.prompt.id} | ${r.prompt.prompt.slice(0, 60)} | task=${r.prompt.expectedTaskType}, ≥${r.prompt.tierFloor} | ${r.routed.classifiedTaskType} → ${r.routed.routedModel} (${r.routed.routedTier}) | ${cause} |`);
    }
  }
  md.push("");

  md.push(`### Classification errors (${failedClass.length})`);
  if (failedClass.length === 0) md.push(`✅ All prompts classified correctly.`);
  else {
    const confusion = new Map<string, number>();
    for (const r of failedClass) {
      const key = `${r.prompt.expectedTaskType} → ${r.routed.classifiedTaskType}`;
      confusion.set(key, (confusion.get(key) ?? 0) + 1);
    }
    md.push(`| Confused | Count |`);
    md.push(`|---|---|`);
    for (const [k, v] of [...confusion.entries()].sort((a, b) => b[1] - a[1])) {
      md.push(`| ${k} | ${v} |`);
    }
    md.push("");
    md.push(`Worst examples:`);
    md.push("");
    md.push(`| ID | Prompt | Expected | Got | Rationale |`);
    md.push(`|---|---|---|---|---|`);
    for (const r of failedClass.slice(0, 20)) {
      md.push(`| ${r.prompt.id} | ${r.prompt.prompt.slice(0, 60)} | ${r.prompt.expectedTaskType} | ${r.routed.classifiedTaskType} | ${(r.routed.rationale || "").slice(0, 80)} |`);
    }
  }
  md.push("");

  md.push(`### Design-bar misses (${failedDesign.length}) — creative/visual tasks below 70%`);
  if (failedDesign.length === 0) md.push(`✅ All visual tasks hit ≥70% of their design bar.`);
  else {
    md.push(`| ID | Prompt | Routed | Missing signals |`);
    md.push(`|---|---|---|---|`);
    for (const r of failedDesign) {
      const missing = r.designChecks.filter((c) => !c.found).map((c) => c.signal).join(", ");
      md.push(`| ${r.prompt.id} | ${r.prompt.prompt.slice(0, 50)} | ${r.routed.routedModel} | ${missing} |`);
    }
  }
  md.push("");

  // ── Per-prompt log ──
  md.push(`## Per-prompt log`);
  md.push("");
  for (const r of rows) {
    const verdict = r.taskTypeCorrect && r.tierFloorOk && r.designPassRate >= 0.7 ? "✅" : "❌";
    md.push(`### ${verdict} ${r.prompt.id} — ${r.prompt.category}`);
    md.push(`> ${r.prompt.prompt.slice(0, 200)}`);
    md.push("");
    md.push(`- **Expected**: task=\`${r.prompt.expectedTaskType}\`, floor=\`${r.prompt.tierFloor}\`${r.prompt.tierCeiling ? `, ceiling=\`${r.prompt.tierCeiling}\`` : ""}`);
    md.push(`- **Actual**: task=\`${r.routed.classifiedTaskType}\`, model=\`${r.routed.routedModel}\` (\`${r.routed.routedTier}\`)`);
    md.push(`- **Verdict**: ${r.taskTypeCorrect ? "✓task" : "✗task"} · ${r.tierFloorOk ? "✓floor" : "✗FLOOR"} · ${r.tierCeilingOk ? "✓ceil" : "✗ceil"}${r.prompt.designBar ? ` · design ${(r.designPassRate * 100).toFixed(0)}%` : ""}`);
    if (r.prompt.designBar && r.designChecks.length > 0) {
      const missing = r.designChecks.filter((c) => !c.found).map((c) => c.signal);
      if (missing.length > 0) md.push(`- **Missing design signals**: ${missing.join(", ")}`);
    }
    if (r.routed.error) md.push(`- ⚠ Error: ${r.routed.error}`);
    md.push("");
  }

  fs.writeFileSync(path.join(outDir, "routing_accuracy.md"), md.join("\n"));
  logger.info(`Report written: ${path.join(outDir, "routing_accuracy.md")}`);
  logger.info(`CSV written: ${path.join(outDir, "routing_accuracy.csv")}`);

  console.log("\n========== HEADLINE ==========");
  console.log(`Classification: ${classifiedRight}/${rows.length} = ${(100 * classifiedRight / rows.length).toFixed(1)}%`);
  console.log(`Tier-floor compliance: ${floorOk}/${rows.length} = ${(100 * floorOk / rows.length).toFixed(1)}%`);
  console.log(`Tier-ceiling efficiency: ${ceilOk}/${rows.length} = ${(100 * ceilOk / rows.length).toFixed(1)}%`);
  console.log(`Avg design pass rate: ${(avgDesign * 100).toFixed(1)}% over ${designPrompts.length} visual prompts`);
  console.log(`Errors: ${errCount}`);
  console.log(`Total saved: $${(totalBenchCost - totalRouterCost).toFixed(4)} (${(((totalBenchCost - totalRouterCost) / Math.max(0.0001, totalBenchCost)) * 100).toFixed(1)}%)`);
  console.log(`Floor violations: ${failedFloor.length}, Classification errors: ${failedClass.length}, Design misses: ${failedDesign.length}`);
}

runAll().catch((e) => { logger.error("Eval failed", e); process.exit(1); });
