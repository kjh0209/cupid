import type { ModelRecord, TaskClassification, UserMode, ScoringWeights, ModelCandidate, RagResult } from "../types.js";
import { estimateQuality, estimateLatencyScore, estimateFailureRisk } from "./qualityEstimator.js";
import { estimateCost, estimateTokens } from "./costEstimator.js";
import { getTaskAffinity, isForbidden } from "./taskModelAffinities.js";

const WEIGHTS: Record<UserMode, ScoringWeights> = {
  cost_saving: {
    alpha: 0.30,   // success rate
    beta: 0.35,    // cost (penalty)
    gamma: 0.10,   // latency (penalty)
    delta: 0.10,   // failure risk (penalty)
    epsilon: 0.05, // repo history bonus
    zeta: 0.05,    // user history bonus
    eta: 0.03,     // context fit bonus
    theta: 0.02,   // prompt cache fit bonus
    iota: 0.03,    // RAG hint bonus
  },
  balanced: {
    alpha: 0.42,
    beta: 0.25,
    gamma: 0.10,
    delta: 0.10,
    epsilon: 0.05,
    zeta: 0.05,
    eta: 0.02,
    theta: 0.01,
    iota: 0.05,
  },
  max_quality: {
    alpha: 0.58,
    beta: 0.10,
    gamma: 0.05,
    delta: 0.15,
    epsilon: 0.05,
    zeta: 0.05,
    eta: 0.01,
    theta: 0.01,
    iota: 0.07,
  },
};

function computeRagBonus(
  model: ModelRecord,
  ragHints: RagResult[]
): { bonus: number; reason: string | null } {
  if (ragHints.length === 0) return { bonus: 0, reason: null };

  let bonus = 0;
  let topReason: string | null = null;

  for (const doc of ragHints) {
    if (doc.score < 0.1) continue;
    const w = doc.score;
    const contentLower = doc.content.toLowerCase();
    const mentionsModel =
      contentLower.includes(model.id.toLowerCase()) ||
      contentLower.includes(model.displayName.toLowerCase().split(" ")[0] ?? "");

    // Benchmark or catalog doc that explicitly names this model → quality confirmation
    if (mentionsModel && (doc.sourceName === "benchmark_data" || doc.sourceName === "model_catalog")) {
      bonus += 0.4 * w;
      topReason ??= `RAG benchmark confirms ${model.displayName}`;
    }

    // Internal routing strategy doc → validate tier assignment
    if (doc.sourceName === "internal_docs" && w >= 0.15) {
      const highRisk = /high.risk|security|auth|schema migration/i.test(doc.content);
      const lowRisk = /low.risk|explanation|simple edit/i.test(doc.content);
      if (highRisk && (model.tier === "strong" || model.tier === "mid")) {
        bonus += 0.15 * w;
        topReason ??= "RAG routing strategy validates tier for this task risk level";
      }
      if (lowRisk && model.tier === "cheap") {
        bonus += 0.15 * w;
        topReason ??= "RAG routing strategy recommends cheap tier for this task";
      }
    }

    // Optimization rule docs → extract risk and caching signals
    if (doc.sourceName === "optimization_rules" && w >= 0.15) {
      const isHighRiskRule = /risk.level: high|security.sensitive|never.overcompress/i.test(doc.content);
      const isCachingRule = /caching|cache.*strategy|prompt.*cache/i.test(doc.content);

      if (isHighRiskRule && (model.tier === "strong" || model.tier === "mid")) {
        bonus += 0.12 * w;
        topReason ??= "RAG: high-risk optimization rule validates elevated tier";
      }
      if (isCachingRule && model.cachedInputPricePerMillion != null) {
        bonus += 0.10 * w;
        topReason ??= "RAG: caching rule supports prompt caching for this model";
      }
    }

    // SWE-bench doc retrieved → coding quality signal amplified
    if (doc.sourceName === "benchmark_docs" && w >= 0.1) {
      const codingBonus = (model.codingScore ?? 0) * 0.15 * w;
      bonus += codingBonus;
      if (codingBonus > 0.03) topReason ??= `RAG: SWE-bench score (${((model.codingScore ?? 0) * 100).toFixed(0)}%) validated`;
    }
  }

  return { bonus: Math.min(bonus, 1.0), reason: topReason };
}

export function scoreModel(
  model: ModelRecord,
  classification: TaskClassification,
  userMode: UserMode,
  allCosts: number[],
  optimizedMessage: string,
  selectedCode?: string,
  repoSummary?: string,
  ragHints?: RagResult[]
): { score: number; breakdown: Record<string, number>; reasons: string[] } {
  const w = WEIGHTS[userMode];
  const tokens = estimateTokens(classification, optimizedMessage, selectedCode, repoSummary);
  const costEstimate = estimateCost(model, tokens);

  const maxCost = Math.max(...allCosts, 0.001);
  const normalizedCost = Math.min(costEstimate.estimatedUsd / maxCost, 1.0);

  const qualityScore = estimateQuality(model, classification);
  const latencyScore = estimateLatencyScore(model);
  const failureRisk = estimateFailureRisk(model, classification);

  // Context fit bonus: long-context model on large context task
  const contextFit =
    (classification.contextNeed === "huge" || classification.contextNeed === "large") &&
    model.contextWindow >= 100000
      ? 1.0
      : 0.0;

  // Cache fit bonus: model supports cached input pricing
  const cacheFit = model.cachedInputPricePerMillion != null ? 1.0 : 0.0;

  // RAG hint bonus: retrieved knowledge validates or boosts this model
  const { bonus: ragBonus, reason: ragReason } = computeRagBonus(model, ragHints ?? []);

  // Task-specific affinity from benchmarks/playbooks
  const taskAffinity = getTaskAffinity(model.id, classification.taskType);
  const forbidden = isForbidden(model.id, classification.taskType);

  // Affinity-weighted quality: task affinity dominates when it's a clear signal.
  // Generic quality contributes 25%, task affinity contributes 75% — this aligns
  // routing with the specific task the user is doing rather than overall model
  // capability, which is critical for security/db where Sonnet > Gemini despite
  // similar SWE-bench scores.
  const qualityWithAffinity = 0.25 * qualityScore + 0.75 * taskAffinity;

  // For high-risk tasks, also apply a hard affinity floor: models with affinity
  // below 0.75 on security/db get penalized further, regardless of generic score
  const isHighRiskTask =
    classification.taskType === "security_sensitive_change" ||
    classification.taskType === "database_schema_change";
  const affinityFloorPenalty = (isHighRiskTask && taskAffinity < 0.75) ? (0.75 - taskAffinity) * 0.5 : 0;

  const score =
    (forbidden ? -10 : 0) +
    w.alpha * qualityWithAffinity -
    affinityFloorPenalty -
    w.beta * normalizedCost -
    w.gamma * (1 - latencyScore) -
    w.delta * failureRisk +
    w.eta * contextFit +
    w.theta * cacheFit +
    w.iota * ragBonus;

  const reasons: string[] = [];
  if (forbidden) reasons.push(`⛔ Model forbidden for ${classification.taskType} — affinity too low`);
  if (taskAffinity >= 0.9) reasons.push(`Strong task affinity (${(taskAffinity * 100).toFixed(0)}%) — benchmarks show top performance on this task type`);
  else if (taskAffinity >= 0.75) reasons.push(`Good task affinity (${(taskAffinity * 100).toFixed(0)}%)`);
  else if (taskAffinity < 0.5) reasons.push(`Weak task affinity (${(taskAffinity * 100).toFixed(0)}%) — consider a stronger model`);

  if (qualityScore >= 0.65) reasons.push(`High coding quality (${(qualityScore * 100).toFixed(0)}%)`);
  else if (qualityScore >= 0.45) reasons.push(`Moderate coding quality (${(qualityScore * 100).toFixed(0)}%)`);
  else reasons.push(`Limited coding quality (${(qualityScore * 100).toFixed(0)}%)`);

  if (normalizedCost < 0.2) reasons.push("Very low cost relative to alternatives");
  else if (normalizedCost < 0.5) reasons.push("Moderate cost");
  else reasons.push("Higher cost justified by quality");

  if (failureRisk > 0.4) reasons.push(`⚠️ Elevated failure risk (${(failureRisk * 100).toFixed(0)}%)`);
  if (ragReason) reasons.push(ragReason);
  if (contextFit > 0) reasons.push("Context window fits the task size");
  if (cacheFit > 0) reasons.push("Supports prompt caching for cost savings");

  return {
    score,
    breakdown: {
      qualityContrib: w.alpha * qualityScore,
      costPenalty: w.beta * normalizedCost,
      latencyPenalty: w.gamma * (1 - latencyScore),
      riskPenalty: w.delta * failureRisk,
      contextBonus: w.eta * contextFit,
      cacheBonus: w.theta * cacheFit,
      ragBonus: w.iota * ragBonus,
    },
    reasons,
  };
}

export function rankCandidates(
  candidates: ModelCandidate[]
): ModelCandidate[] {
  return [...candidates].sort((a, b) => b.score - a.score);
}
