import type { ModelRecord } from "../types.js";

export function priceUsd(model: ModelRecord, inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1_000_000) * model.inputPricePerMillion;
  const outputCost = (outputTokens / 1_000_000) * model.outputPricePerMillion;
  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000;
}
