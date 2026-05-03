import type { DiffSummary } from "./diffService.js";
import type { VerificationResult } from "./verificationRunner.js";

export interface CandidateMetrics {
  label: string;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  latencyMs: number;
  diffSummary: DiffSummary;
  verification: VerificationResult;
  parseStatus: string;
}

export interface ComparisonResult {
  routerCostUsd: number;
  strongBaselineCostUsd: number;
  savingsUsd: number;
  savingsPercent: number;
  routerInputTokens: number;
  baselineInputTokens: number;
  routerOutputTokens: number;
  baselineOutputTokens: number;
  promptTokenReductionPercent: number;
  routerSuccess: boolean | null;
  baselineSuccess: boolean | null;
  qualityRetention: number | null;
  successPerDollar: number | null;
  routerFilesChanged: number;
  baselineFilesChanged: number;
  routerLoc: number;
  baselineLoc: number;
  unrelatedFilesModified: boolean;
}

export function computeComparison(
  router: CandidateMetrics | null,
  strongBaseline: CandidateMetrics | null,
  rawPromptTokens: number,
  optimizedPromptTokens: number
): ComparisonResult {
  const routerCost = router?.costUsd ?? 0;
  const baselineCost = strongBaseline?.costUsd ?? 0;
  const savingsUsd = baselineCost - routerCost;
  const savingsPercent = baselineCost > 0 ? (savingsUsd / baselineCost) * 100 : 0;

  const routerSuccess = router
    ? (router.verification.overallSuccess && router.parseStatus !== "failed")
    : null;
  const baselineSuccess = strongBaseline
    ? (strongBaseline.verification.overallSuccess && strongBaseline.parseStatus !== "failed")
    : null;

  // Quality retention: if baseline passes and router also passes → 100%
  // If baseline passes and router fails → 0%
  // If neither passes → null
  let qualityRetention: number | null = null;
  if (baselineSuccess === true) {
    qualityRetention = routerSuccess === true ? 100 : routerSuccess === false ? 0 : null;
  } else if (baselineSuccess === false && routerSuccess === true) {
    qualityRetention = 110; // Router did better
  }

  const promptReduction = rawPromptTokens > 0
    ? ((rawPromptTokens - optimizedPromptTokens) / rawPromptTokens) * 100
    : 0;

  // Success per dollar: how many successes per $1 spent
  let successPerDollar: number | null = null;
  if (routerCost > 0 && routerSuccess === true) {
    successPerDollar = 1 / routerCost;
  }

  return {
    routerCostUsd: routerCost,
    strongBaselineCostUsd: baselineCost,
    savingsUsd,
    savingsPercent,
    routerInputTokens: router?.inputTokens ?? 0,
    baselineInputTokens: strongBaseline?.inputTokens ?? 0,
    routerOutputTokens: router?.outputTokens ?? 0,
    baselineOutputTokens: strongBaseline?.outputTokens ?? 0,
    promptTokenReductionPercent: promptReduction,
    routerSuccess,
    baselineSuccess,
    qualityRetention,
    successPerDollar,
    routerFilesChanged: router?.diffSummary.totalFilesChanged ?? 0,
    baselineFilesChanged: strongBaseline?.diffSummary.totalFilesChanged ?? 0,
    routerLoc: router?.diffSummary.totalChangedLoc ?? 0,
    baselineLoc: strongBaseline?.diffSummary.totalChangedLoc ?? 0,
    unrelatedFilesModified: router?.diffSummary.unrelatedFilesModified ?? false,
  };
}
