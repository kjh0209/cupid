import type { ModelRecord, CostEstimate, TaskClassification } from "../types.js";
import { estimateOutputTokensByTaskType } from "../utils/tokenEstimator.js";

export interface TokenEstimate {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
}

export function estimateTokens(
  classification: TaskClassification,
  optimizedMessage: string,
  selectedCode?: string,
  repoSummary?: string,
  systemPromptTokens = 500
): TokenEstimate {
  const msgTokens = Math.ceil(optimizedMessage.length / 4);
  const codeTokens = selectedCode ? Math.ceil(selectedCode.length / 3.2) : 0;
  const repoTokens = repoSummary ? Math.ceil(repoSummary.length / 4) : 0;

  // Context multiplier by task type
  const contextMultiplier: Record<string, number> = {
    explanation: 1.0,
    simple_edit: 1.2,
    test_generation: 1.5,
    local_bug_fix: 1.5,
    ui_change: 1.2,
    api_implementation: 2.0,
    multi_file_refactor: 2.5,
    database_schema_change: 2.0,
    security_sensitive_change: 2.0,
    architecture_design: 2.5,
    prompt_rewrite_only: 0.8,
    unknown: 1.5,
  };

  const multiplier = contextMultiplier[classification.taskType] ?? 1.5;

  const baseInput =
    systemPromptTokens + msgTokens + codeTokens + repoTokens;
  const inputTokens = Math.ceil(baseInput * multiplier);

  const outputTokens = estimateOutputTokensByTaskType(classification.taskType);

  // Estimate cacheable portion (system prompt + repo summary if stable)
  const cachedInputTokens = Math.ceil((systemPromptTokens + repoTokens) * 0.8);

  return {
    inputTokens: Math.max(inputTokens, 500),
    outputTokens,
    cachedInputTokens: Math.min(cachedInputTokens, inputTokens),
  };
}

export function estimateCost(
  model: ModelRecord,
  tokens: TokenEstimate
): CostEstimate {
  const { inputTokens, outputTokens, cachedInputTokens } = tokens;

  // Non-cached input tokens
  const freshInputTokens = inputTokens - cachedInputTokens;

  let inputCost =
    (freshInputTokens * model.inputPricePerMillion) / 1_000_000;

  // Add cached input cost if available
  if (cachedInputTokens > 0 && model.cachedInputPricePerMillion != null) {
    inputCost +=
      (cachedInputTokens * model.cachedInputPricePerMillion) / 1_000_000;
  } else {
    // No cache support: charge full input price
    inputCost += (cachedInputTokens * model.inputPricePerMillion) / 1_000_000;
  }

  const outputCost =
    (outputTokens * model.outputPricePerMillion) / 1_000_000;

  return {
    inputTokens,
    outputTokens,
    cachedInputTokens,
    estimatedUsd: Math.round((inputCost + outputCost) * 100000) / 100000,
  };
}

export function estimateSavingsVsBaseline(
  selectedModelCost: number,
  baselineModel: ModelRecord,
  tokens: TokenEstimate
): { baselineEstimatedUsd: number; savingsPercent: number } {
  const baselineCost = estimateCost(baselineModel, tokens);
  const savings =
    baselineCost.estimatedUsd > 0
      ? ((baselineCost.estimatedUsd - selectedModelCost) /
          baselineCost.estimatedUsd) *
        100
      : 0;

  return {
    baselineEstimatedUsd: baselineCost.estimatedUsd,
    savingsPercent: Math.round(savings * 10) / 10,
  };
}
