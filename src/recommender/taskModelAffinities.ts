// ============================================================
// Task-type → model affinity table
//
// Derived from public benchmarks (SWE-bench, Aider Polyglot,
// HumanEval, MMLU, GPQA, BFCL) and routing playbooks. Used by
// the scorer to boost models that are known to excel at a
// particular task type, beyond what their generic coding score
// would suggest.
//
// Affinity scale: 0 (don't route here) → 1 (perfect fit).
// ============================================================

import type { TaskType } from "../types.js";

interface AffinityRow {
  modelId: string;
  affinityByTask: Partial<Record<TaskType, number>>;
}

const AFFINITIES: AffinityRow[] = [
  // ── Claude Opus 4.5 — strongest on hard tasks ───────────────
  {
    modelId: "anthropic/claude-opus-4-5",
    affinityByTask: {
      explanation: 0.85,
      simple_edit: 0.70,
      test_generation: 0.92,
      local_bug_fix: 0.98,
      ui_change: 0.82,
      api_implementation: 0.95,
      multi_file_refactor: 0.97,
      database_schema_change: 0.96,
      security_sensitive_change: 0.99,
      architecture_design: 1.00,
      prompt_rewrite_only: 0.78,
      performance_optimization: 0.95,
      devops_config: 0.90,
      documentation_write: 0.82,
      dependency_update: 0.80,
      code_review: 0.97,
      unknown: 0.88,
    },
  },
  // ── Claude Sonnet 4.6 — newest, similar profile to 4.5 ──────
  {
    modelId: "anthropic/claude-sonnet-4.6",
    affinityByTask: {
      explanation: 0.88,
      simple_edit: 0.86,
      test_generation: 0.94,
      local_bug_fix: 0.92,
      ui_change: 0.89,
      api_implementation: 0.93,
      multi_file_refactor: 0.96,
      database_schema_change: 0.97,
      security_sensitive_change: 0.97,
      architecture_design: 0.95,
      prompt_rewrite_only: 0.86,
      performance_optimization: 0.92,
      devops_config: 0.88,
      documentation_write: 0.85,
      dependency_update: 0.82,
      code_review: 0.94,
      unknown: 0.87,
    },
  },
  // ── Claude Sonnet 4.5 — best value, especially for security/db ──
  // Boosted on security/db/refactor/architecture after eval showed
  // Gemini 2.5 Pro underperforms on these tasks (P=3-5 in judge scoring).
  {
    modelId: "anthropic/claude-sonnet-4-5",
    affinityByTask: {
      explanation: 0.86,
      simple_edit: 0.85,
      test_generation: 0.93,
      local_bug_fix: 0.90,
      ui_change: 0.88,
      api_implementation: 0.92,
      multi_file_refactor: 0.95,
      database_schema_change: 0.97,
      security_sensitive_change: 0.97,
      architecture_design: 0.94,
      prompt_rewrite_only: 0.84,
      performance_optimization: 0.91,
      devops_config: 0.87,
      documentation_write: 0.83,
      dependency_update: 0.81,
      code_review: 0.93,
      unknown: 0.85,
    },
  },
  // ── Claude Haiku 4.5 — strong cheap tier ────────────────────
  {
    modelId: "anthropic/claude-haiku-4-5",
    affinityByTask: {
      explanation: 0.90,
      simple_edit: 0.93,
      test_generation: 0.82,
      local_bug_fix: 0.72,
      ui_change: 0.88,
      api_implementation: 0.75,
      multi_file_refactor: 0.55,
      database_schema_change: 0.50,
      security_sensitive_change: 0.35,
      architecture_design: 0.55,
      prompt_rewrite_only: 0.92,
      performance_optimization: 0.65,
      devops_config: 0.55,
      documentation_write: 0.88,
      dependency_update: 0.75,
      code_review: 0.70,
      unknown: 0.75,
    },
  },
  // ── GPT-4o — strong on TS/Python/React ──────────────────────
  // Eval (2026-06): GPT-4o picked for sec-* tasks scored P=2-3, missed
  // common pitfalls (wrapping bcrypt in timingSafeEqual). De-prioritized
  // for security/db where Sonnet 4.5 consistently outperforms.
  {
    modelId: "openai/gpt-4o",
    affinityByTask: {
      explanation: 0.88,
      simple_edit: 0.85,
      test_generation: 0.85,
      local_bug_fix: 0.80,
      ui_change: 0.92,
      api_implementation: 0.93,
      multi_file_refactor: 0.75,
      database_schema_change: 0.65,
      security_sensitive_change: 0.65,
      architecture_design: 0.83,
      prompt_rewrite_only: 0.88,
      performance_optimization: 0.85,
      devops_config: 0.80,
      documentation_write: 0.82,
      dependency_update: 0.80,
      code_review: 0.87,
      unknown: 0.83,
    },
  },
  // ── GPT-4o mini — cheap workhorse ───────────────────────────
  {
    modelId: "openai/gpt-4o-mini",
    affinityByTask: {
      explanation: 0.88,
      simple_edit: 0.85,
      test_generation: 0.70,
      local_bug_fix: 0.55,
      ui_change: 0.78,
      api_implementation: 0.68,
      multi_file_refactor: 0.40,
      database_schema_change: 0.35,
      security_sensitive_change: 0.25,
      architecture_design: 0.40,
      prompt_rewrite_only: 0.90,
      performance_optimization: 0.55,
      devops_config: 0.50,
      documentation_write: 0.85,
      dependency_update: 0.72,
      code_review: 0.65,
      unknown: 0.65,
    },
  },
  // ── o3 — reasoning beast ────────────────────────────────────
  {
    modelId: "openai/o3",
    affinityByTask: {
      explanation: 0.85,
      simple_edit: 0.65,
      test_generation: 0.92,
      local_bug_fix: 0.96,
      ui_change: 0.70,
      api_implementation: 0.92,
      multi_file_refactor: 0.95,
      database_schema_change: 0.92,
      security_sensitive_change: 0.96,
      architecture_design: 0.98,
      prompt_rewrite_only: 0.75,
      performance_optimization: 0.96,
      devops_config: 0.85,
      documentation_write: 0.78,
      dependency_update: 0.78,
      code_review: 0.96,
      unknown: 0.88,
    },
  },
  // ── o3-mini ─────────────────────────────────────────────────
  {
    modelId: "openai/o3-mini",
    affinityByTask: {
      explanation: 0.80,
      simple_edit: 0.72,
      test_generation: 0.85,
      local_bug_fix: 0.83,
      ui_change: 0.70,
      api_implementation: 0.82,
      multi_file_refactor: 0.78,
      database_schema_change: 0.76,
      security_sensitive_change: 0.78,
      architecture_design: 0.85,
      prompt_rewrite_only: 0.75,
      performance_optimization: 0.85,
      devops_config: 0.76,
      documentation_write: 0.74,
      dependency_update: 0.74,
      code_review: 0.82,
      unknown: 0.78,
    },
  },
  // ── Gemini 2.5 Pro — long context champion ──────────────────
  // Eval (2026-06): underperformed on security/db tasks (Gemini missed
  // production-grade safeguards Sonnet catches). De-prioritized for sec/db.
  {
    modelId: "google/gemini-2.5-pro",
    affinityByTask: {
      explanation: 0.92,
      simple_edit: 0.80,
      test_generation: 0.90,
      local_bug_fix: 0.88,
      ui_change: 0.83,
      api_implementation: 0.85,
      multi_file_refactor: 0.86,
      database_schema_change: 0.70,
      security_sensitive_change: 0.70,
      architecture_design: 0.88,
      prompt_rewrite_only: 0.85,
      performance_optimization: 0.88,
      devops_config: 0.82,
      documentation_write: 0.83,
      dependency_update: 0.80,
      code_review: 0.85,
      unknown: 0.85,
    },
  },
  // ── Gemini 2.0 Flash — cheap + long context ─────────────────
  {
    modelId: "google/gemini-2.0-flash",
    affinityByTask: {
      explanation: 0.92,
      simple_edit: 0.78,
      test_generation: 0.72,
      local_bug_fix: 0.58,
      ui_change: 0.75,
      api_implementation: 0.65,
      multi_file_refactor: 0.55,
      database_schema_change: 0.40,
      security_sensitive_change: 0.30,
      architecture_design: 0.55,
      prompt_rewrite_only: 0.88,
      performance_optimization: 0.62,
      devops_config: 0.55,
      documentation_write: 0.85,
      dependency_update: 0.70,
      code_review: 0.65,
      unknown: 0.65,
    },
  },
  // ── DeepSeek R1 ─────────────────────────────────────────────
  {
    modelId: "deepseek/deepseek-r1",
    affinityByTask: {
      explanation: 0.78,
      simple_edit: 0.60,
      test_generation: 0.85,
      local_bug_fix: 0.90,
      ui_change: 0.65,
      api_implementation: 0.83,
      multi_file_refactor: 0.85,
      database_schema_change: 0.80,
      security_sensitive_change: 0.78,
      architecture_design: 0.92,
      prompt_rewrite_only: 0.65,
      performance_optimization: 0.90,
      devops_config: 0.72,
      documentation_write: 0.68,
      dependency_update: 0.72,
      code_review: 0.85,
      unknown: 0.78,
    },
  },
];

/** Returns affinity 0-1 of a model for a task type. Default 0.5 (neutral) if unknown. */
export function getTaskAffinity(modelId: string, taskType: TaskType): number {
  const row = AFFINITIES.find((r) => r.modelId === modelId);
  if (!row) return 0.5;
  return row.affinityByTask[taskType] ?? 0.5;
}

/** Hard-list of models that should NEVER be routed to for a given task. */
export function isForbidden(modelId: string, taskType: TaskType): boolean {
  const affinity = getTaskAffinity(modelId, taskType);
  // High-risk tasks: forbid models with affinity < 0.4
  if (
    (taskType === "security_sensitive_change" ||
     taskType === "database_schema_change") &&
    affinity < 0.40
  ) {
    return true;
  }
  return false;
}
