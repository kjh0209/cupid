export interface RecommendationMetrics {
  totalTasks: number;
  tierAccuracy: number;
  overuseStrongRate: number;
  unsafeCheapRate: number;
  riskPolicyViolations: number;
  estimatedCostVsAlwaysStrong: number;
  estimatedSavingsPercent: number;
}

export interface PromptOptimizationMetrics {
  totalPrompts: number;
  avgTokenReductionPercent: number;
  preservedRequirementRate: number;
  semanticHighRiskRate: number;
  overcompressionRate: number;
  highRiskCompressionViolationRate: number;
}

export interface EvalResult<T> {
  id: string;
  passed: boolean;
  details: T;
}

export interface RecommendationEvalDetail {
  rawMessage: string;
  expectedTier: string;
  actualTier: string;
  selectedModel: string;
  tierMatch: boolean;
  wasUnacceptable: boolean;
  riskViolation: boolean;
  estimatedUsd: number;
  notes: string;
}

export interface PromptOptimizationEvalDetail {
  rawMessage: string;
  optimizedMessage: string;
  taskType: string;
  riskLevel: number;
  originalTokens: number;
  optimizedTokens: number;
  tokenReductionPercent: number;
  preservedRequirementsCount: number;
  totalRequirements: number;
  semanticRisk: string;
  missingRequirements: string[];
  notes: string;
}

export function computeRecommendationMetrics(
  results: EvalResult<RecommendationEvalDetail>[]
): RecommendationMetrics {
  const n = results.length;
  if (n === 0) return {
    totalTasks: 0, tierAccuracy: 0, overuseStrongRate: 0,
    unsafeCheapRate: 0, riskPolicyViolations: 0,
    estimatedCostVsAlwaysStrong: 0, estimatedSavingsPercent: 0,
  };

  const correct = results.filter((r) => r.details.tierMatch).length;
  const overuseStrong = results.filter(
    (r) => r.details.actualTier === "strong" && r.details.expectedTier !== "strong"
  ).length;
  const unsafeCheap = results.filter((r) => r.details.wasUnacceptable).length;
  const violations = results.filter((r) => r.details.riskViolation).length;

  const totalCost = results.reduce((s, r) => s + r.details.estimatedUsd, 0);
  // Strong baseline: ~$0.15 per task on average
  const strongBaselineCost = n * 0.15;
  const savings = strongBaselineCost > 0
    ? ((strongBaselineCost - totalCost) / strongBaselineCost) * 100
    : 0;

  return {
    totalTasks: n,
    tierAccuracy: correct / n,
    overuseStrongRate: overuseStrong / n,
    unsafeCheapRate: unsafeCheap / n,
    riskPolicyViolations: violations,
    estimatedCostVsAlwaysStrong: totalCost,
    estimatedSavingsPercent: Math.round(savings * 10) / 10,
  };
}

export function computePromptOptimizationMetrics(
  results: EvalResult<PromptOptimizationEvalDetail>[]
): PromptOptimizationMetrics {
  const n = results.length;
  if (n === 0) return {
    totalPrompts: 0, avgTokenReductionPercent: 0,
    preservedRequirementRate: 0, semanticHighRiskRate: 0,
    overcompressionRate: 0, highRiskCompressionViolationRate: 0,
  };

  const avgReduction =
    results.reduce((s, r) => s + r.details.tokenReductionPercent, 0) / n;

  const totalRequirements = results.reduce(
    (s, r) => s + r.details.totalRequirements, 0
  );
  const preservedRequirements = results.reduce(
    (s, r) => s + r.details.preservedRequirementsCount, 0
  );
  const preservedRate =
    totalRequirements > 0 ? preservedRequirements / totalRequirements : 1;

  const highRisk = results.filter(
    (r) => r.details.semanticRisk === "high"
  ).length;

  // Overcompression: >50% reduction on medium+ risk tasks
  const overcompressed = results.filter(
    (r) => r.details.tokenReductionPercent > 50 && r.details.riskLevel >= 3
  ).length;

  // High-risk violation: >30% compression on risk >= 4
  const highRiskViolations = results.filter(
    (r) => r.details.tokenReductionPercent > 30 && r.details.riskLevel >= 4
  ).length;

  return {
    totalPrompts: n,
    avgTokenReductionPercent: Math.round(avgReduction * 10) / 10,
    preservedRequirementRate: Math.round(preservedRate * 1000) / 10,
    semanticHighRiskRate: Math.round((highRisk / n) * 1000) / 10,
    overcompressionRate: Math.round((overcompressed / n) * 1000) / 10,
    highRiskCompressionViolationRate: Math.round((highRiskViolations / n) * 1000) / 10,
  };
}
