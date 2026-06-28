// ============================================================
// CUPID Engine — Type definitions for the rule-based pipeline
// (Separate from src/types.ts to keep existing routes untouched)
// ============================================================

export interface IDEContext {
  fileName: string;
  activeLanguage: string;
  fileLineCount: number;
  hasTerminalError: boolean;
  hasHighlightedText: boolean;
  rawCodePayload: string;
  gitDiffText: string | null;
  /** Optional repo/session key — used for shared Context Storage cache */
  sessionKey?: string;
}

export interface ModelStats {
  id: string;
  costPer1kTokens: number;
  costScore: number;
  latencyScore: number;
  riskScore: number;
  baseQuality: number;
}

export type CupidIntent =
  | "Generate"
  | "Debug"
  | "Refactor"
  | "Explain"
  | "GitOps"
  | "ComplexArchitecture";

export interface IntentEvaluation {
  intent: CupidIntent;
  confidence: number;
  intentScores: Record<string, number>;
  matchedTokens: Array<{ token: string; intent: string; weight: number }>;
  rulesTriggered: string[];
}

export interface AuctionScore {
  modelId: string;
  baseQuality: number;
  weightedQuality: number;
  weightedCost: number;
  weightedLatency: number;
  weightedRisk: number;
  total: number;
}

export interface AuctionEvaluation {
  intent: CupidIntent;
  dials: { alpha: number; beta: number; gamma: number; delta: number };
  scores: AuctionScore[];
  winner: ModelStats;
  override?: string;
}

export interface CompressionResult {
  originalChars: number;
  compressedChars: number;
  originalTokens: number;
  compressedTokens: number;
  rulesApplied: string[];
  diffSnippets: Array<{ type: "removed" | "kept"; line: string }>;
  compressedPayload: string;
}

export interface ContextStorageState {
  sessionKey: string;
  fragmentCount: number;
  cacheHit: boolean;
  bytesStored: number;
  freshlyAddedKeys: string[];
}

export interface TraceStep {
  step:
    | "prompt_intake"
    | "intent_detection"
    | "auction"
    | "cpl_compression"
    | "context_storage"
    | "model_execution";
  label: string;
  startedAtMs: number;
  endedAtMs: number;
  durationMs: number;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  notes?: string[];
}

export interface PipelineTraceResult {
  prompt: string;
  intent: CupidIntent;
  routedModel: string;
  compressed: CompressionResult;
  auction: AuctionEvaluation;
  storage: ContextStorageState;
  steps: TraceStep[];
  totals: {
    baselineTokens: number;
    finalTokens: number;
    tokensSaved: number;
    estimatedCostSavingsUsd: number;
    totalLatencyMs: number;
  };
}
