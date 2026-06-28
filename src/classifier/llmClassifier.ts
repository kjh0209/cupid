import { callLLM } from "../evaluation/llmExecutor.js";
import { taskClassifier } from "./taskClassifier.js";
import type {
  TaskClassification,
  TaskClassificationInput,
  TaskType,
  ContextNeed,
  ChangeScope,
  CompressionSensitivity,
} from "../types.js";
import { logger } from "../utils/logger.js";
import { getModelById } from "../recommender/modelTiering.js";

const TASK_TYPES: TaskType[] = [
  "explanation", "simple_edit", "test_generation", "local_bug_fix",
  "ui_change", "api_implementation", "multi_file_refactor",
  "database_schema_change", "security_sensitive_change",
  "architecture_design", "prompt_rewrite_only",
  "performance_optimization", "devops_config", "documentation_write",
  "dependency_update", "code_review", "creative_generation", "unknown",
];
const CONTEXT_NEEDS: ContextNeed[] = ["small", "medium", "large", "huge"];
const CHANGE_SCOPES: ChangeScope[] = ["none", "single_file", "multi_file", "repo_wide"];
const COMPRESSION_LEVELS: CompressionSensitivity[] = ["low", "medium", "high"];

const SYSTEM_PROMPT = `You are a task classifier for a code-assistant routing system. Your output decides which LLM (cheap vs strong, ~30x cost difference) handles the user's request. Wrong classification = wasted money OR wrong answer.

Read the user's prompt + file context, then output STRICT JSON (no markdown fences, no commentary):

{
  "task_type": "<one of: explanation|simple_edit|test_generation|local_bug_fix|ui_change|api_implementation|multi_file_refactor|database_schema_change|security_sensitive_change|architecture_design|prompt_rewrite_only|performance_optimization|devops_config|documentation_write|dependency_update|code_review|creative_generation|unknown>",
  "difficulty": <integer 1..5>,
  "risk_level": <integer 0..5>,
  "context_need": "<small|medium|large|huge>",
  "expected_change_scope": "<none|single_file|multi_file|repo_wide>",
  "language_or_framework": [<short strings, max 4>],
  "needs_tool_calling": <true|false>,
  "privacy_sensitive": <true|false>,
  "compression_sensitivity": "<low|medium|high>",
  "rationale": "<one short sentence: WHY this classification>"
}

CRITICAL classification rules (these override surface keywords):
1. ANY mention of auth, login, password, token, JWT, session, OAuth, crypto, encrypt, hash, payment, billing, permission, role → security_sensitive_change. risk_level >= 4.
2. Migrations, schema changes, ALTER TABLE, new columns, indexes, foreign keys → database_schema_change. risk_level >= 4.
3. "Refactor X into Y", "move from monolith to", "split into services", "design pattern" → architecture_design. difficulty >= 4.
4. Cross-file changes, "rename across the project", "update everywhere" → multi_file_refactor. difficulty >= 4.
5. New endpoint, route, controller, REST/GraphQL handler → api_implementation. risk_level = 3 unless auth involved (then 5).
6. "Explain", "what does", "summarize", "describe" with no code change ask → explanation. risk_level = 1.
7. Adding/fixing tests, "write tests for", spec file → test_generation. risk_level = 2.
8. CSS, Tailwind, component styling, layout, "make it look like" → ui_change. risk_level = 1.
9. Rename, fix typo, add comment, add log, format → simple_edit. risk_level = 1, difficulty = 1.
10. "There's a bug", "X doesn't work", "throws error", stack trace → local_bug_fix. Estimate difficulty from the bug description.
11. VAGUE bug-fix prompts ("why is my code slow?", "this doesn't feel right", "something's off") with no concrete error/symptom → local_bug_fix BUT difficulty >= 3 because root-cause diagnosis from vague signals is harder than fixing a concrete error. Don't route to cheap tier.
12. "Optimize performance", "profiling", "slow query", "N+1", "memoize", "lazy load", "bundle size", "LCP/CLS" → performance_optimization. risk_level = 3.
13. CI/CD pipelines, Dockerfile, GitHub Actions workflow, Kubernetes manifests, Terraform, nginx config → devops_config. risk_level = 4 (prod infra).
14. "Write docs", "add README", "generate JSDoc", "write ADR/RFC", "document this API" → documentation_write. risk_level = 1.
15. "Upgrade package", "bump version", "update dependency", "npm audit fix", "CVE", "breaking change" → dependency_update. risk_level = 3.
16. "Review this code", "give feedback", "what's wrong with", "is this good practice", "code review" → code_review. risk_level = 1.
    - **CRITICAL**: "Review this migration / this auth code / this PR" is code_review FIRST, not security/db. The user is asking for FEEDBACK, not for you to write a migration. Look for verbs like "review", "give feedback", "what would you change", "is this safe/good/idiomatic" — those are code_review even if the subject matter is a migration/auth/security file. risk_level matches the subject matter (review of migration → risk_level 4, review of styling → risk_level 1).
17. **CREATIVE WHOLE-APP / GAME / DEMO GENERATION**: "Make a breakout game", "build a snake game", "create a landing page", "make a calculator app", "build me a demo of X", "interactive playground for Y", "build a kanban board", "build a chat app", "code a tetris clone" → **creative_generation**. risk_level = 1, BUT difficulty = 4 (creative + design taste is decisive). DO NOT route these to cheap tier — small models produce wireframe-quality output with no color palette, no UX touches, no polish. Strong tier (Sonnet/Opus/Gemini Pro) is required to get a result that "feels like a small product, not a placeholder".
    - Hint signals: naming a specific game (breakout, snake, tetris, pong, 2048, wordle), "make/build/create a [game/app/website/tool/demo/landing page/dashboard]", "interactive", "playable", "showcase", "playground", "demo page", "drag-and-drop", "fun little".
    - Distinguish from ui_change: ui_change = modify existing component/style; creative_generation = invent a new app/game/demo from scratch.

Difficulty scale:
1 = trivial (rename, format, typo)
2 = small (single function tweak, add a log)
3 = medium (write a function from scratch, fix an obvious bug)
4 = hard (subtle bug, multi-component change, performance optimization)
5 = expert (concurrency, distributed system, novel algorithm, architecture)

Risk_level scale:
0 = no risk (pure explanation)
1 = trivial (UI, naming)
2 = low (tests, simple edits)
3 = medium (new API, bug fix)
4 = high (security-adjacent, schema change, production-touching code)
5 = critical (auth, payment, data integrity, irreversible op)

context_need:
small = single function, <500 LOC
medium = single file, 500-2000 LOC
large = multiple files, 2000-10000 LOC
huge = repo-wide, >10000 LOC, or explicit "entire codebase"

compression_sensitivity:
high = security/db/payment/contracts — DO NOT remove any specific identifier, value, or constraint
medium = api/refactor — preserve all interfaces and types
low = explanation/ui/simple edit — aggressive compression OK

REMEMBER: when in doubt, prefer HIGHER risk_level. False-positive on risk wastes a few cents; false-negative on risk causes a security incident.`;

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === "number" ? v : parseInt(String(v), 10);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

/** Map the LLM's 0-5 risk to the internal 0-5 system (no clamp at 3). */
function mapRiskLevel(v: unknown, fallback: number): number {
  return clampInt(v, 0, 5, fallback);
}

function pickEnum<T extends string>(v: unknown, opts: T[], fallback: T): T {
  const s = String(v ?? "").toLowerCase().trim();
  return (opts as string[]).includes(s) ? (s as T) : fallback;
}

function parseLooseJson(raw: string): Record<string, unknown> | null {
  // Strip markdown code fences if model ignored instructions
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced?.[1] ?? raw).trim();
  try { return JSON.parse(candidate); } catch { /* fallthrough */ }
  // Try to extract first {...} block
  const m = candidate.match(/\{[\s\S]*\}/);
  if (m) {
    try { return JSON.parse(m[0]); } catch { /* ignore */ }
  }
  return null;
}

export interface LlmClassificationResult {
  classification: TaskClassification;
  ruleBased: TaskClassification;
  llmRaw: Record<string, unknown> | null;
  rationale: string | null;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  fellBackToRules: boolean;
  errorMessage?: string;
}

export interface LlmClassifyOptions {
  modelId?: string;       // override classifier model (default from env)
  maxTokens?: number;     // default 400
  temperature?: number;   // default 0
}

export async function classifyWithLlm(
  input: TaskClassificationInput,
  opts: LlmClassifyOptions = {},
): Promise<LlmClassificationResult> {
  const modelId =
    opts.modelId ??
    process.env["CLASSIFICATION_LLM_MODEL"] ??
    "anthropic/claude-haiku-4-5";
  const maxTokens = opts.maxTokens ?? 400;
  const temperature = opts.temperature ?? 0;

  // Always compute the rule-based baseline first — it's free and acts as
  // the safety net if the LLM call fails or returns bad JSON.
  const ruleBased = taskClassifier.classify(input);

  const userPayload = JSON.stringify(
    {
      prompt: input.message,
      active_file_path: input.activeFilePath ?? null,
      selected_code_preview: input.selectedCode?.slice(0, 1500) ?? null,
      repo_summary: input.repoSummary?.slice(0, 600) ?? null,
      changed_files: input.changedFiles ?? [],
      user_mode: input.userMode,
    },
    null,
    2,
  );

  const start = Date.now();
  try {
    const res = await callLLM(
      modelId,
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPayload },
      ],
      temperature,
      maxTokens,
    );
    const parsed = parseLooseJson(res.content);
    if (!parsed) {
      logger.warn(`LLM classifier returned unparseable JSON, falling back to rules. Raw: ${res.content.slice(0, 200)}`);
      return {
        classification: ruleBased,
        ruleBased,
        llmRaw: null,
        rationale: null,
        modelId,
        inputTokens: res.usage.inputTokens,
        outputTokens: res.usage.outputTokens,
        costUsd: 0,
        latencyMs: res.latencyMs,
        fellBackToRules: true,
        errorMessage: "json parse failed",
      };
    }

    const llmClassification: Partial<TaskClassification> = {
      taskType: pickEnum(parsed["task_type"], TASK_TYPES, ruleBased.taskType),
      difficulty: clampInt(parsed["difficulty"], 1, 5, ruleBased.difficulty),
      riskLevel: mapRiskLevel(parsed["risk_level"], ruleBased.riskLevel),
      contextNeed: pickEnum(parsed["context_need"], CONTEXT_NEEDS, ruleBased.contextNeed),
      expectedChangeScope: pickEnum(parsed["expected_change_scope"], CHANGE_SCOPES, ruleBased.expectedChangeScope),
      languageOrFramework: Array.isArray(parsed["language_or_framework"])
        ? (parsed["language_or_framework"] as unknown[]).slice(0, 4).map((x) => String(x).slice(0, 32))
        : ruleBased.languageOrFramework,
      needsToolCalling: typeof parsed["needs_tool_calling"] === "boolean"
        ? Boolean(parsed["needs_tool_calling"])
        : ruleBased.needsToolCalling,
      privacySensitive: typeof parsed["privacy_sensitive"] === "boolean"
        ? Boolean(parsed["privacy_sensitive"])
        : ruleBased.privacySensitive,
      compressionSensitivity: pickEnum(parsed["compression_sensitivity"], COMPRESSION_LEVELS, ruleBased.compressionSensitivity),
    };

    // Merge: rules win on safety-critical fields (riskLevel max, compressionSensitivity max)
    const merged = taskClassifier.mergeWithLlm(ruleBased, llmClassification);
    // Re-evaluate needsLongContext after merged contextNeed is known
    merged.needsLongContext = merged.contextNeed === "huge" || merged.contextNeed === "large"
      || (input.selectedCode?.length ?? 0) > 8000;

    // Cost calculation — best-effort lookup from model catalogue
    let costUsd = 0;
    try {
      const m = await getModelById(modelId);
      if (m) {
        const inCost = (res.usage.inputTokens / 1_000_000) * m.inputPricePerMillion;
        const outCost = (res.usage.outputTokens / 1_000_000) * m.outputPricePerMillion;
        costUsd = Math.round((inCost + outCost) * 1_000_000) / 1_000_000;
      }
    } catch { /* costUsd stays 0 */ }

    return {
      classification: merged,
      ruleBased,
      llmRaw: parsed,
      rationale: parsed["rationale"] != null ? String(parsed["rationale"]).slice(0, 240) : null,
      modelId,
      inputTokens: res.usage.inputTokens,
      outputTokens: res.usage.outputTokens,
      costUsd,
      latencyMs: res.latencyMs,
      fellBackToRules: false,
    };
  } catch (err) {
    logger.warn(`LLM classifier call failed, falling back to rules`, err);
    return {
      classification: ruleBased,
      ruleBased,
      llmRaw: null,
      rationale: null,
      modelId,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      latencyMs: Date.now() - start,
      fellBackToRules: true,
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  }
}
