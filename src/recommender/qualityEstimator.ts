import type { ModelRecord, TaskClassification } from "../types.js";

// Estimates the probability of a successful task completion for a given model.
// Returns a score from 0 to 1.

export function estimateQuality(
  model: ModelRecord,
  classification: TaskClassification
): number {
  const { taskType, riskLevel, difficulty } = classification;

  // Base quality from coding score (primary signal)
  let base = model.codingScore ?? 0.35;

  // For non-coding tasks, weight general score higher
  if (
    taskType === "explanation" ||
    taskType === "architecture_design" ||
    taskType === "prompt_rewrite_only"
  ) {
    const general = model.generalScore ?? 0.80;
    base = 0.4 * (model.codingScore ?? 0.35) + 0.6 * general;
  }

  // Tier quality floor
  const tierFloors: Record<string, number> = {
    cheap: 0.35,
    mid: 0.50,
    strong: 0.65,
    long_context: 0.55,
    local_private: 0.40,
    unknown: 0.35,
  };
  const floor = tierFloors[model.tier] ?? 0.35;
  base = Math.max(base, floor);

  // Penalty for using cheap model on high-risk/difficult tasks
  if (model.tier === "cheap" && riskLevel >= 4) {
    base *= 0.6;
  } else if (model.tier === "cheap" && riskLevel === 3) {
    base *= 0.8;
  }

  // Bonus for long-context model on huge context tasks
  if (
    model.tier === "long_context" &&
    (classification.contextNeed === "huge" || classification.contextNeed === "large")
  ) {
    base = Math.min(base * 1.15, 0.98);
  }

  // Penalty for using weak model on hard tasks
  if (model.tier === "cheap" && difficulty >= 4) {
    base *= 0.75;
  }

  // Penalty for model without tool calling on tasks that need it
  if (classification.needsToolCalling && model.toolCallingSupport === false) {
    base *= 0.7;
  }

  // Context window adequacy check
  if (classification.contextNeed === "huge" && model.contextWindow < 100000) {
    base *= 0.5;
  } else if (classification.contextNeed === "large" && model.contextWindow < 32000) {
    base *= 0.7;
  }

  return Math.min(Math.max(base, 0), 1);
}

export function estimateLatencyScore(model: ModelRecord): number {
  // Normalize output speed to a 0-1 score (0=slow, 1=fast)
  // Reference: 300 tok/sec = 1.0
  const speed = model.outputSpeed ?? 80;
  return Math.min(speed / 300, 1.0);
}

export function estimateFailureRisk(
  model: ModelRecord,
  classification: TaskClassification
): number {
  // Higher = more risky (0-1)
  const { riskLevel, taskType } = classification;

  let risk = 0;

  if (model.tier === "cheap") {
    if (riskLevel >= 5) risk = 0.8;
    else if (riskLevel >= 4) risk = 0.6;
    else if (riskLevel >= 3) risk = 0.3;
    else risk = 0.1;
  } else if (model.tier === "mid") {
    if (riskLevel >= 5) risk = 0.4;
    else if (riskLevel >= 4) risk = 0.25;
    else risk = 0.05;
  } else if (model.tier === "strong") {
    if (riskLevel >= 5) risk = 0.15;
    else risk = 0.02;
  } else {
    risk = 0.1;
  }

  // Security tasks add extra risk for cheap/mid
  if (
    taskType === "security_sensitive_change" &&
    (model.tier === "cheap" || model.tier === "mid")
  ) {
    risk = Math.min(risk * 1.5, 1.0);
  }

  return risk;
}
