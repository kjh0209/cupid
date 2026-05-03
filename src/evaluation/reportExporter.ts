import type { EvalRunsSelect, EvalCandidatesSelect, EvalMetricsSelect, HumanRatingsSelect } from "../db/schema.js";

export interface ReportData {
  run: EvalRunsSelect;
  candidates: EvalCandidatesSelect[];
  metrics: EvalMetricsSelect | null;
  rating: HumanRatingsSelect | null;
}

export function generateMarkdownReport(data: ReportData): string {
  const { run, candidates, metrics, rating } = data;
  const router = candidates.find((c) => c.label === "router");
  const baseline = candidates.find((c) => c.label === "strong_baseline");
  const tc = tryParseJson(run.taskClassificationJson) ?? {};
  const rec = tryParseJson(run.recommendationJson) ?? {};

  const lines: string[] = [
    `# Cupid Router Evaluation Report`,
    ``,
    `**Run ID:** ${run.id}  `,
    `**Date:** ${run.createdAt}  `,
    `**Status:** ${run.status}`,
    ``,
    `---`,
    ``,
    `## Task`,
    ``,
    run.taskMessage,
    ``,
    `**Repository:** ${run.repoName}  `,
    `**User Mode:** ${run.userMode}  `,
    `**Experiment Mode:** ${run.experimentMode}`,
    ``,
    `---`,
    ``,
    `## Task Classification`,
    ``,
    `| Field | Value |`,
    `|---|---|`,
    `| Task Type | ${(tc as any).taskType ?? "unknown"} |`,
    `| Risk Level | ${(tc as any).riskLevel ?? "?"}/5 |`,
    `| Difficulty | ${(tc as any).difficulty ?? "?"}/5 |`,
    `| Context Need | ${(tc as any).contextNeed ?? "?"} |`,
    `| Change Scope | ${(tc as any).expectedChangeScope ?? "?"} |`,
    ``,
    `---`,
    ``,
    `## Model Recommendation`,
    ``,
    `**Selected model (Cupid Router):** ${router?.modelId ?? "N/A"}  `,
    `**Strong baseline:** ${baseline?.modelId ?? "N/A"}`,
    ``,
  ];

  if (Array.isArray((rec as any).reason)) {
    lines.push(`**Reason for selection:**`);
    for (const r of (rec as any).reason as string[]) {
      lines.push(`- ${r}`);
    }
    lines.push(``);
  }

  lines.push(`---`, ``, `## Prompt Optimization`, ``);
  lines.push(`**Raw prompt:**`);
  lines.push("```");
  lines.push(run.taskMessage);
  lines.push("```");
  lines.push(``);
  if (run.optimizedMessage && run.optimizedMessage !== run.taskMessage) {
    lines.push(`**Optimized prompt:**`);
    lines.push("```");
    lines.push(run.optimizedMessage);
    lines.push("```");
    lines.push(``);
  }

  lines.push(`---`, ``, `## Results`, ``);

  // Results table
  lines.push(`| Candidate | Model | Input Tokens | Output Tokens | Cost (USD) | Tests | Typecheck | Files Changed | LOC |`);
  lines.push(`|---|---|---:|---:|---:|---|---|---:|---:|`);

  for (const c of candidates) {
    const ver = tryParseJson(c.verificationJson) ?? {};
    const filesChanged = (tryParseJson(c.filesChangedJson) ?? []) as unknown[];
    lines.push(
      `| ${c.label} | ${c.modelId} | ${c.inputTokens} | ${c.outputTokens} | $${c.estimatedCostUsd.toFixed(5)} | ${fmtBool((ver as any).testPassed)} | ${fmtBool((ver as any).typecheckPassed)} | ${filesChanged.length} | - |`
    );
  }

  lines.push(``);

  if (metrics) {
    lines.push(`---`, ``, `## Cost Analysis`, ``);
    lines.push(`| Metric | Value |`);
    lines.push(`|---|---|`);
    lines.push(`| Router cost | $${metrics.routerCostUsd.toFixed(5)} |`);
    lines.push(`| Strong baseline cost | $${metrics.strongBaselineCostUsd.toFixed(5)} |`);
    lines.push(`| Savings | $${metrics.savingsUsd.toFixed(5)} |`);
    lines.push(`| Savings % | ${metrics.savingsPercent.toFixed(1)}% |`);
    if (metrics.qualityRetention != null) {
      lines.push(`| Quality retention | ${metrics.qualityRetention.toFixed(0)}% |`);
    }
    lines.push(``);
  }

  // Diffs
  for (const c of candidates) {
    if (!c.diffText) continue;
    lines.push(`---`, ``, `## Diff: ${c.label} (${c.modelId})`, ``);
    lines.push("```diff");
    lines.push(c.diffText.slice(0, 5000));
    if (c.diffText.length > 5000) lines.push("... (truncated)");
    lines.push("```");
    lines.push(``);
  }

  if (rating) {
    lines.push(`---`, ``, `## Human Rating`, ``);
    lines.push(`| Field | Value |`);
    lines.push(`|---|---|`);
    if (rating.preferredCandidate) lines.push(`| Preferred | ${rating.preferredCandidate} |`);
    if (rating.routerAcceptance) lines.push(`| Router acceptance | ${rating.routerAcceptance} |`);
    if (rating.baselineAcceptance) lines.push(`| Baseline acceptance | ${rating.baselineAcceptance} |`);
    if (rating.ratingNotes) lines.push(`| Notes | ${rating.ratingNotes} |`);
    lines.push(``);
  }

  lines.push(`---`, ``, `## Conclusion`, ``);
  const conclusion = generateConclusion(metrics, rating, candidates);
  lines.push(conclusion);
  lines.push(``);
  lines.push(`> *Note: Quality metrics are based on ${getQualityBasis(candidates)}.*`);

  return lines.join("\n");
}

function fmtBool(v: unknown): string {
  if (v === true) return "✅";
  if (v === false) return "❌";
  return "—";
}

function tryParseJson(s: string): unknown {
  try { return JSON.parse(s); } catch { return null; }
}

function generateConclusion(
  metrics: EvalMetricsSelect | null,
  rating: HumanRatingsSelect | null,
  candidates: EvalCandidatesSelect[]
): string {
  if (!metrics) return "Evaluation did not complete. No conclusion available.";

  const savings = metrics.savingsPercent.toFixed(1);
  const routerModel = candidates.find((c) => c.label === "router")?.modelId ?? "Cupid-selected model";

  if (metrics.qualityRetention === 100) {
    return `Cupid Router selected **${routerModel}** and produced a comparable result to the strong baseline with **${savings}% lower cost**.`;
  } else if (metrics.qualityRetention === 0) {
    return `Cupid Router selected **${routerModel}** which achieved **${savings}% cost savings**, but the result did not pass verification. Consider escalating to a stronger model for this task type.`;
  } else if (rating?.preferredCandidate === "router") {
    return `Cupid Router selected **${routerModel}** which was **preferred by the human reviewer** with **${savings}% lower cost**.`;
  } else if (rating?.preferredCandidate === "strong_baseline") {
    return `The strong baseline was preferred by the human reviewer. Cupid Router saved **${savings}%** in cost but the quality was lower.`;
  }

  return `Cupid Router selected **${routerModel}** achieving **${savings}% cost savings** vs the strong baseline. Quality assessment is based on diff and human review only (no automated verification).`;
}

function getQualityBasis(candidates: EvalCandidatesSelect[]): string {
  const hasVerification = candidates.some((c) => {
    const v = tryParseJson(c.verificationJson) as Record<string, unknown> | null;
    return v && (v.testPassed !== null || v.typecheckPassed !== null);
  });
  return hasVerification ? "automated verification (tests/typecheck)" : "diff review and human rating (no automated tests run)";
}
