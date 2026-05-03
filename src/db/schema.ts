import {
  sqliteTable,
  text,
  integer,
  real,
  index,
} from "drizzle-orm/sqlite-core";

// ── Models table ──────────────────────────────────────────────
export const models = sqliteTable(
  "models",
  {
    id: text("id").primaryKey(),
    provider: text("provider").notNull(),
    displayName: text("display_name").notNull(),
    tier: text("tier").notNull().default("unknown"),
    inputPricePerMillion: real("input_price_per_million").notNull().default(0),
    outputPricePerMillion: real("output_price_per_million").notNull().default(0),
    cachedInputPricePerMillion: real("cached_input_price_per_million"),
    cacheWritePricePerMillion: real("cache_write_price_per_million"),
    contextWindow: integer("context_window").notNull().default(4096),
    maxOutputTokens: integer("max_output_tokens").notNull().default(4096),
    modality: text("modality").notNull().default("text"),
    toolCallingSupport: integer("tool_calling_support", { mode: "boolean" }),
    visionSupport: integer("vision_support", { mode: "boolean" }),
    codingScore: real("coding_score"),
    generalScore: real("general_score"),
    latencyScore: real("latency_score"),
    outputSpeed: real("output_speed"),
    sourceConfidence: text("source_confidence").notNull().default("internal"),
    sourceUrl: text("source_url").notNull().default(""),
    lastUpdated: text("last_updated").notNull(),
    deprecated: integer("deprecated", { mode: "boolean" }).notNull().default(false),
  },
  (table) => ({
    providerIdx: index("idx_models_provider").on(table.provider),
    tierIdx: index("idx_models_tier").on(table.tier),
  })
);

// ── Benchmarks table ─────────────────────────────────────────
export const benchmarks = sqliteTable(
  "benchmarks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    modelId: text("model_id").notNull().references(() => models.id),
    benchmarkName: text("benchmark_name").notNull(),
    score: real("score").notNull(),
    metricType: text("metric_type").notNull(),
    sourceUrl: text("source_url").notNull().default(""),
    dateCollected: text("date_collected").notNull(),
    notes: text("notes"),
  },
  (table) => ({
    modelIdx: index("idx_benchmarks_model").on(table.modelId),
    benchmarkIdx: index("idx_benchmarks_name").on(table.benchmarkName),
  })
);

// ── Documents table ──────────────────────────────────────────
export const documents = sqliteTable(
  "documents",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    title: text("title").notNull(),
    sourceName: text("source_name").notNull(),
    sourceUrl: text("source_url").notNull().default(""),
    content: text("content").notNull(),
    metadataJson: text("metadata_json").notNull().default("{}"),
    embedding: text("embedding"),
    createdAt: text("created_at").notNull(),
    lastUpdated: text("last_updated").notNull(),
    sourceConfidence: text("source_confidence").notNull().default("internal"),
  },
  (table) => ({
    sourceIdx: index("idx_documents_source").on(table.sourceName),
    confidenceIdx: index("idx_documents_confidence").on(table.sourceConfidence),
  })
);

// ── Prompt optimization rules table ─────────────────────────
export const promptOptimizationRules = sqliteTable(
  "prompt_optimization_rules",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    ruleType: text("rule_type").notNull(),
    appliesToModelsJson: text("applies_to_models_json").notNull().default("[]"),
    appliesToTaskTypesJson: text("applies_to_task_types_json").notNull().default("[]"),
    expectedBenefit: text("expected_benefit").notNull(),
    riskLevel: text("risk_level").notNull().default("low"),
    sourceUrl: text("source_url").notNull().default(""),
    sourceConfidence: text("source_confidence").notNull().default("internal"),
    lastUpdated: text("last_updated").notNull(),
  },
  (table) => ({
    typeIdx: index("idx_por_rule_type").on(table.ruleType),
  })
);

// ── Task logs table ──────────────────────────────────────────
export const taskLogs = sqliteTable(
  "task_logs",
  {
    taskId: text("task_id").primaryKey(),
    userId: text("user_id"),
    repoId: text("repo_id"),
    rawMessage: text("raw_message").notNull(),
    optimizedMessage: text("optimized_message").notNull(),
    selectedModel: text("selected_model").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    estimatedCost: real("estimated_cost").notNull().default(0),
    actualCost: real("actual_cost"),
    latencyMs: integer("latency_ms"),
    testPassed: integer("test_passed", { mode: "boolean" }),
    lintPassed: integer("lint_passed", { mode: "boolean" }),
    typecheckPassed: integer("typecheck_passed", { mode: "boolean" }),
    userAccepted: integer("user_accepted", { mode: "boolean" }),
    escalated: integer("escalated", { mode: "boolean" }).notNull().default(false),
    finalModel: text("final_model"),
    changedFilesCount: integer("changed_files_count"),
    changedLoc: integer("changed_loc"),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    modelIdx: index("idx_task_logs_model").on(table.selectedModel),
    createdIdx: index("idx_task_logs_created").on(table.createdAt),
  })
);

// ── Recommendation logs table ────────────────────────────────
export const recommendationLogs = sqliteTable(
  "recommendation_logs",
  {
    requestId: text("request_id").primaryKey(),
    rawMessage: text("raw_message").notNull(),
    optimizedMessage: text("optimized_message").notNull(),
    taskJson: text("task_json").notNull(),
    candidateModelsJson: text("candidate_models_json").notNull(),
    selectedModel: text("selected_model").notNull(),
    recommendationJson: text("recommendation_json").notNull(),
    promptOptimizationJson: text("prompt_optimization_json").notNull(),
    estimatedRawTokens: integer("estimated_raw_tokens").notNull().default(0),
    estimatedOptimizedTokens: integer("estimated_optimized_tokens").notNull().default(0),
    estimatedTokenSavings: integer("estimated_token_savings").notNull().default(0),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    createdIdx: index("idx_rec_logs_created").on(table.createdAt),
    modelIdx: index("idx_rec_logs_model").on(table.selectedModel),
  })
);

export type ModelsSelect = typeof models.$inferSelect;
export type ModelsInsert = typeof models.$inferInsert;
export type BenchmarksSelect = typeof benchmarks.$inferSelect;
export type BenchmarksInsert = typeof benchmarks.$inferInsert;
export type DocumentsSelect = typeof documents.$inferSelect;
export type DocumentsInsert = typeof documents.$inferInsert;
export type PromptOptimizationRulesSelect = typeof promptOptimizationRules.$inferSelect;
export type PromptOptimizationRulesInsert = typeof promptOptimizationRules.$inferInsert;
export type TaskLogsInsert = typeof taskLogs.$inferInsert;
export type RecommendationLogsInsert = typeof recommendationLogs.$inferInsert;

// ── Eval runs table ──────────────────────────────────────────
export const evalRuns = sqliteTable(
  "eval_runs",
  {
    id: text("id").primaryKey(),
    repoId: text("repo_id").notNull(),
    repoName: text("repo_name").notNull().default(""),
    taskMessage: text("task_message").notNull(),
    optimizedMessage: text("optimized_message").notNull().default(""),
    userMode: text("user_mode").notNull().default("balanced"),
    experimentMode: text("experiment_mode").notNull().default("router_vs_strong"),
    taskClassificationJson: text("task_classification_json").notNull().default("{}"),
    recommendationJson: text("recommendation_json").notNull().default("{}"),
    contextPlanJson: text("context_plan_json").notNull().default("{}"),
    cachePlanJson: text("cache_plan_json").notNull().default("{}"),
    verificationPlanJson: text("verification_plan_json").notNull().default("{}"),
    status: text("status").notNull().default("pending"),
    errorMessage: text("error_message"),
    createdAt: text("created_at").notNull(),
    completedAt: text("completed_at"),
  },
  (table) => ({
    statusIdx: index("idx_eval_runs_status").on(table.status),
    createdIdx: index("idx_eval_runs_created").on(table.createdAt),
  })
);

// ── Eval candidates table ────────────────────────────────────
export const evalCandidates = sqliteTable(
  "eval_candidates",
  {
    id: text("id").primaryKey(),
    evalRunId: text("eval_run_id").notNull().references(() => evalRuns.id),
    label: text("label").notNull(), // router | strong_baseline | cheap_baseline | manual
    modelId: text("model_id").notNull(),
    tier: text("tier").notNull().default("unknown"),
    workspacePath: text("workspace_path").notNull().default(""),
    rawPrompt: text("raw_prompt").notNull().default(""),
    optimizedPrompt: text("optimized_prompt").notNull().default(""),
    llmOutputJson: text("llm_output_json").notNull().default("{}"),
    outputParseStatus: text("output_parse_status").notNull().default("pending"),
    diffText: text("diff_text").notNull().default(""),
    filesChangedJson: text("files_changed_json").notNull().default("[]"),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    totalTokens: integer("total_tokens").notNull().default(0),
    estimatedCostUsd: real("estimated_cost_usd").notNull().default(0),
    actualCostUsd: real("actual_cost_usd"),
    latencyMs: integer("latency_ms"),
    verificationJson: text("verification_json").notNull().default("{}"),
    success: integer("success", { mode: "boolean" }),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    runIdx: index("idx_eval_candidates_run").on(table.evalRunId),
    labelIdx: index("idx_eval_candidates_label").on(table.label),
  })
);

// ── Eval metrics table ───────────────────────────────────────
export const evalMetrics = sqliteTable(
  "eval_metrics",
  {
    id: text("id").primaryKey(),
    evalRunId: text("eval_run_id").notNull().references(() => evalRuns.id),
    routerCostUsd: real("router_cost_usd").notNull().default(0),
    strongBaselineCostUsd: real("strong_baseline_cost_usd").notNull().default(0),
    savingsUsd: real("savings_usd").notNull().default(0),
    savingsPercent: real("savings_percent").notNull().default(0),
    promptTokenReductionPercent: real("prompt_token_reduction_percent").notNull().default(0),
    routerSuccess: integer("router_success", { mode: "boolean" }),
    baselineSuccess: integer("baseline_success", { mode: "boolean" }),
    qualityRetention: real("quality_retention"),
    successPerDollar: real("success_per_dollar"),
    diffComparisonJson: text("diff_comparison_json").notNull().default("{}"),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    runIdx: index("idx_eval_metrics_run").on(table.evalRunId),
  })
);

// ── Human ratings table ──────────────────────────────────────
export const humanRatings = sqliteTable(
  "human_ratings",
  {
    id: text("id").primaryKey(),
    evalRunId: text("eval_run_id").notNull().references(() => evalRuns.id),
    preferredCandidate: text("preferred_candidate"), // router | strong_baseline | cheap_baseline | manual | tie
    routerAcceptance: text("router_acceptance"), // accept | reject | unsure
    baselineAcceptance: text("baseline_acceptance"),
    ratingNotes: text("rating_notes"),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    runIdx: index("idx_human_ratings_run").on(table.evalRunId),
  })
);

export type EvalRunsSelect = typeof evalRuns.$inferSelect;
export type EvalRunsInsert = typeof evalRuns.$inferInsert;
export type EvalCandidatesSelect = typeof evalCandidates.$inferSelect;
export type EvalCandidatesInsert = typeof evalCandidates.$inferInsert;
export type EvalMetricsSelect = typeof evalMetrics.$inferSelect;
export type EvalMetricsInsert = typeof evalMetrics.$inferInsert;
export type HumanRatingsSelect = typeof humanRatings.$inferSelect;
export type HumanRatingsInsert = typeof humanRatings.$inferInsert;
