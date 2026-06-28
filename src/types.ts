// ============================================================
// Central type definitions for Cupid Engineered LLM Router
// ============================================================

// ── Model Tier ───────────────────────────────────────────────
export type ModelTier =
  | "cheap"
  | "mid"
  | "strong"
  | "long_context"
  | "local_private"
  | "unknown";

// ── Task Types ───────────────────────────────────────────────
export type TaskType =
  | "explanation"
  | "simple_edit"
  | "test_generation"
  | "local_bug_fix"
  | "ui_change"
  | "api_implementation"
  | "multi_file_refactor"
  | "database_schema_change"
  | "security_sensitive_change"
  | "architecture_design"
  | "prompt_rewrite_only"
  | "performance_optimization"
  | "devops_config"
  | "documentation_write"
  | "dependency_update"
  | "code_review"
  | "creative_generation"
  | "unknown";

// ── Context Need ─────────────────────────────────────────────
export type ContextNeed = "small" | "medium" | "large" | "huge";

// ── Change Scope ─────────────────────────────────────────────
export type ChangeScope =
  | "none"
  | "single_file"
  | "multi_file"
  | "repo_wide";

// ── User Mode ────────────────────────────────────────────────
// cost_aggressive: only route cheap on clearly safe tasks, ignores DRS
// cost_saving (default): retention-leaning; DRS ≥ 3 forces strong tier
// balanced: DRS ≥ 2 forces strong tier
// max_quality: always routes to strong tier
export type UserMode = "cost_aggressive" | "cost_saving" | "balanced" | "max_quality";

// ── Source Confidence ────────────────────────────────────────
export type SourceConfidence =
  | "official"
  | "benchmark"
  | "community"
  | "internal";

// ── Metric Type ──────────────────────────────────────────────
export type MetricType =
  | "coding_quality"
  | "general_intelligence"
  | "latency"
  | "output_speed"
  | "price"
  | "context_window"
  | "tool_use";

// ── Rule Type ────────────────────────────────────────────────
export type RuleType =
  | "compression"
  | "caching"
  | "context_selection"
  | "output_limiting"
  | "tool_loading"
  | "model_specific"
  | "safety";

// ── Compression Sensitivity ──────────────────────────────────
export type CompressionSensitivity = "low" | "medium" | "high";

// ── Semantic Risk ────────────────────────────────────────────
export type SemanticRisk = "low" | "medium" | "high";

// ── Context Risk ─────────────────────────────────────────────
export type ContextRisk = "low" | "medium" | "high";

// ── Cache Strategy ───────────────────────────────────────────
export type CacheStrategy =
  | "provider_supported"
  | "manual_reuse"
  | "not_supported";

// ── Model Record ─────────────────────────────────────────────
export interface ModelRecord {
  id: string;
  provider: string;
  displayName: string;
  tier: ModelTier;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  cachedInputPricePerMillion: number | null;
  cacheWritePricePerMillion: number | null;
  contextWindow: number;
  maxOutputTokens: number;
  modality: string;
  toolCallingSupport: boolean | null;
  visionSupport: boolean | null;
  codingScore: number | null;
  generalScore: number | null;
  latencyScore: number | null;
  outputSpeed: number | null;
  sourceConfidence: SourceConfidence;
  sourceUrl: string;
  lastUpdated: string;
  deprecated: boolean;
}

// ── Benchmark Record ─────────────────────────────────────────
export interface BenchmarkRecord {
  id?: number;
  modelId: string;
  benchmarkName: string;
  score: number;
  metricType: MetricType;
  sourceUrl: string;
  dateCollected: string;
  notes: string | null;
}

// ── Document Record ──────────────────────────────────────────
export interface DocumentRecord {
  id?: number;
  title: string;
  sourceName: string;
  sourceUrl: string;
  content: string;
  metadataJson: string;
  embedding: string | null;
  createdAt: string;
  lastUpdated: string;
  sourceConfidence: SourceConfidence;
}

// ── Prompt Optimization Rule ─────────────────────────────────
export interface PromptOptimizationRule {
  id: string;
  title: string;
  description: string;
  ruleType: RuleType;
  appliesToModelsJson: string;
  appliesToTaskTypesJson: string;
  expectedBenefit: string;
  riskLevel: SemanticRisk;
  sourceUrl: string;
  sourceConfidence: SourceConfidence;
  lastUpdated: string;
}

// ── Task Classification Input ────────────────────────────────
export interface TaskClassificationInput {
  message: string;
  activeFilePath?: string;
  selectedCode?: string;
  repoSummary?: string;
  changedFiles?: string[];
  userMode: UserMode;
}

// ── Task Classification Output ───────────────────────────────
export interface TaskClassification {
  taskType: TaskType;
  difficulty: number;
  riskLevel: number;
  contextNeed: ContextNeed;
  expectedChangeScope: ChangeScope;
  languageOrFramework: string[];
  needsToolCalling: boolean;
  needsLongContext: boolean;
  privacySensitive: boolean;
  compressionSensitivity: CompressionSensitivity;
}

// ── Cost Estimate ────────────────────────────────────────────
export interface CostEstimate {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  estimatedUsd: number;
}

// ── Model Candidate ──────────────────────────────────────────
export interface ModelCandidate {
  model: ModelRecord;
  score: number;
  costEstimate: CostEstimate;
  qualityScore: number;
  latencyScore: number;
  reasons: string[];
}

// ── Savings Estimate ─────────────────────────────────────────
export interface SavingsEstimate {
  baselineModel: string;
  baselineEstimatedUsd: number;
  savingsPercent: number;
}

// ── Recommendation ───────────────────────────────────────────
export interface ModelRecommendation {
  modelId: string;
  tier: ModelTier;
  reason: string[];
  estimatedCost: CostEstimate;
  estimatedSavingsVsStrong: SavingsEstimate;
}

// ── Prompt Optimization Result ───────────────────────────────
export interface PromptOptimizationResult {
  optimizedMessage: string;
  originalTokenEstimate: number;
  optimizedTokenEstimate: number;
  estimatedTokenSavings: number;
  estimatedSavingsPercent: number;
  appliedRules: string[];
  semanticRisk: SemanticRisk;
  removedContentSummary: string[];
  preservedRequirements: string[];
  modelSpecificNotes: string[];
}

// ── Context Plan ─────────────────────────────────────────────
export interface ContextPlan {
  include: string[];
  exclude: string[];
  compressionPlan: string[];
  estimatedContextTokens: number;
  contextRisk: ContextRisk;
}

// ── Cache Plan ───────────────────────────────────────────────
export interface CachePlan {
  cacheableBlocks: string[];
  dynamicBlocks: string[];
  cacheStrategy: CacheStrategy;
  notes: string[];
}

// ── Fallback Policy ──────────────────────────────────────────
export interface FallbackPolicy {
  onTypecheckFail: string;
  onTestFail: string;
  onSecurityDetected: string;
  fallbackModel: string;
}

// ── Verification Plan ────────────────────────────────────────
export interface VerificationPlan {
  steps: string[];
  required: string[];
  optional: string[];
  riskLevel: number;
}

// ── Engineer Chat Input ──────────────────────────────────────
export interface EngineerChatInput {
  message: string;
  activeFilePath?: string;
  selectedCode?: string;
  repoSummary?: string;
  recentDecisions?: string[];
  changedFiles?: string[];
  userMode: UserMode;
  baselineModel?: string;
}

// ── Engineer Chat Output ─────────────────────────────────────
export interface EngineerChatOutput {
  taskClassification: TaskClassification;
  recommendedModel: ModelRecommendation;
  promptOptimization: PromptOptimizationResult;
  contextPolicy: ContextPlan;
  cachePlan: CachePlan;
  fallbackPolicy: FallbackPolicy;
  verificationPlan: VerificationPlan;
  topCandidates: Array<{
    modelId: string;
    tier: ModelTier;
    score: number;
    estimatedUsd: number;
    reasons: string[];
  }>;
}

// ── Optimize Prompt Input ────────────────────────────────────
export interface OptimizePromptInput {
  message: string;
  selectedModel?: string;
  userMode: UserMode;
  activeFilePath?: string;
  selectedCode?: string;
  repoSummary?: string;
  recentDecisions?: string[];
}

// ── Recommend Model Input ────────────────────────────────────
export interface RecommendModelInput {
  message: string;
  activeFilePath?: string;
  selectedCode?: string;
  repoSummary?: string;
  recentDecisions?: string[];
  changedFiles?: string[];
  userMode: UserMode;
  baselineModel?: string;
  optimizePrompt?: boolean;
}

// ── Task Log ─────────────────────────────────────────────────
export interface TaskLog {
  taskId: string;
  userId?: string;
  repoId?: string;
  rawMessage: string;
  optimizedMessage: string;
  selectedModel: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  actualCost?: number;
  latencyMs?: number;
  testPassed?: boolean;
  lintPassed?: boolean;
  typecheckPassed?: boolean;
  userAccepted?: boolean;
  escalated: boolean;
  finalModel?: string;
  changedFilesCount?: number;
  changedLoc?: number;
  createdAt: string;
}

// ── Eval Task ────────────────────────────────────────────────
export interface EvalTask {
  id: string;
  rawMessage: string;
  expectedTier: ModelTier;
  acceptableTiers: ModelTier[];
  unacceptableTiers: ModelTier[];
  rationale: string;
  safetyNotes: string;
  expectedTaskType?: TaskType;
}

// ── Prompt Optimization Eval Item ────────────────────────────
export interface PromptOptimizationEvalItem {
  id: string;
  rawMessage: string;
  expectedPreservedRequirements: string[];
  shouldRemove: string[];
  shouldNotRemove: string[];
  taskType: TaskType;
  riskLevel: number;
}

// ── Recommendation Log ───────────────────────────────────────
export interface RecommendationLog {
  requestId: string;
  rawMessage: string;
  optimizedMessage: string;
  taskJson: string;
  candidateModelsJson: string;
  selectedModel: string;
  recommendationJson: string;
  promptOptimizationJson: string;
  estimatedRawTokens: number;
  estimatedOptimizedTokens: number;
  estimatedTokenSavings: number;
  createdAt: string;
}

// ── Model Specific Profile ────────────────────────────────────
export interface ModelSpecificProfile {
  modelFamily: string;
  prefersStructuredPrompt: boolean;
  handlesLongContextWell: boolean;
  benefitsFromExplicitSteps: boolean;
  outputBudgetStrategy: string;
  cacheStrategy: string;
  toolStrategy: string;
  compressionAggressiveness: "low" | "medium" | "high";
  recommendedPromptShape: string;
  notes: string[];
}

// ── Scoring Weights ───────────────────────────────────────────
export interface ScoringWeights {
  alpha: number;  // predicted success rate
  beta: number;   // normalized cost
  gamma: number;  // normalized latency
  delta: number;  // failure risk penalty
  epsilon: number; // repo history bonus
  zeta: number;   // user history bonus
  eta: number;    // context fit bonus
  theta: number;  // prompt cache fit bonus
  iota: number;   // output control fit bonus
}

// ── RAG Result ───────────────────────────────────────────────
export interface RagResult {
  documentId: number;
  title: string;
  content: string;
  score: number;
  sourceName: string;
  sourceUrl: string;
}
