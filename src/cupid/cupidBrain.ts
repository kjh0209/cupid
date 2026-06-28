import type {
  IDEContext,
  IntentEvaluation,
  AuctionEvaluation,
  AuctionScore,
  CupidIntent,
  ModelStats,
} from "./types.js";
import { ACTION_WEIGHTS, MODEL_REGISTRY, SYSTEM_EXTENSIONS, BASELINE_MODEL_ID } from "./registry.js";

export function evaluateIntent(prompt: string, context: IDEContext): IntentEvaluation {
  const tokens = prompt.toLowerCase().split(/[\s,.\-]+/).filter(Boolean);
  const intentScores: Record<string, number> = {};
  const matchedTokens: IntentEvaluation["matchedTokens"] = [];
  const rulesTriggered: string[] = [];

  // 1. Lexical scoring
  for (const token of tokens) {
    const match = ACTION_WEIGHTS[token];
    if (match) {
      intentScores[match.intent] = (intentScores[match.intent] ?? 0) + match.weight;
      matchedTokens.push({ token, intent: match.intent, weight: match.weight });
    }
  }

  // 2. Contextual rule triggers
  if (context.hasTerminalError) {
    intentScores["Debug"] = (intentScores["Debug"] ?? 0) + 1.5;
    rulesTriggered.push("IDE Diagnostics Error");
  }
  if (context.fileLineCount > 500 && !context.hasHighlightedText) {
    intentScores["ComplexArchitecture"] = (intentScores["ComplexArchitecture"] ?? 0) + 0.5;
    rulesTriggered.push("Large File Scope");
  }
  if (context.gitDiffText && (prompt.includes("commit") || prompt.includes("review"))) {
    intentScores["GitOps"] = 2.0;
    rulesTriggered.push("Git Diff Pruning");
  }
  if (SYSTEM_EXTENSIONS.some((ext) => context.fileName.toLowerCase().endsWith(ext))) {
    intentScores["ComplexArchitecture"] = (intentScores["ComplexArchitecture"] ?? 0) + 1.0;
    rulesTriggered.push("System Language Lockout");
  }

  // 3. Winner
  let intent: CupidIntent = "Generate";
  let maxScore = 0;
  for (const [key, val] of Object.entries(intentScores)) {
    if (val > maxScore) {
      maxScore = val;
      intent = key as CupidIntent;
    }
  }
  const confidence = Math.min(maxScore / 2.0, 1.0);

  return { intent, confidence, intentScores, matchedTokens, rulesTriggered };
}

export function runAuction(
  intent: CupidIntent,
  context: IDEContext,
  confidence: number,
  estimatedTokens: number,
): AuctionEvaluation {
  let alpha = 1.0;
  let beta = 1.0;
  let gamma = 1.0;
  let delta = 1.0;

  switch (intent) {
    case "ComplexArchitecture": alpha = 2.5; delta = 2.0; beta = 0.2; break;
    case "Debug":               gamma = 2.0; alpha = 1.5; break;
    case "Explain":             beta = 3.0; delta = 0.1; break;
    case "GitOps":              beta = 2.0; alpha = 1.2; break;
  }
  if (context.hasHighlightedText) delta *= 0.5;

  const scores: AuctionScore[] = MODEL_REGISTRY
    .filter((m) => m.id !== BASELINE_MODEL_ID)
    .map((model): AuctionScore => {
      const weightedQuality = alpha * model.baseQuality;
      const weightedCost = beta * model.costScore;
      const weightedLatency = gamma * model.latencyScore;
      const weightedRisk = delta * model.riskScore;
      return {
        modelId: model.id,
        baseQuality: model.baseQuality,
        weightedQuality,
        weightedCost,
        weightedLatency,
        weightedRisk,
        total: weightedQuality - weightedCost - weightedLatency - weightedRisk,
      };
    })
    .sort((a, b) => b.total - a.total);

  let winnerId = scores[0]!.modelId;
  let override: string | undefined;

  // Context-size override
  if (estimatedTokens > 30000) {
    winnerId = "gemini-1.5-pro";
    override = "Massive Context Override";
  }
  // Low-confidence fallback
  if (confidence < 0.4) {
    winnerId = "gpt-4o-mini";
    override = override ? `${override}; Low Confidence Fallback` : "Low Confidence Fallback";
  }

  const winner: ModelStats = MODEL_REGISTRY.find((m) => m.id === winnerId)!;

  return {
    intent,
    dials: { alpha, beta, gamma, delta },
    scores,
    winner,
    override,
  };
}
