import { describe, it, expect } from "vitest";
import { estimateCost, estimateTokens } from "../src/recommender/costEstimator.js";
import type { ModelRecord, TaskClassification } from "../src/types.js";

function makeModel(overrides: Partial<ModelRecord>): ModelRecord {
  return {
    id: "test/model",
    provider: "test",
    displayName: "Test Model",
    tier: "mid",
    inputPricePerMillion: 3.0,
    outputPricePerMillion: 15.0,
    cachedInputPricePerMillion: 0.3,
    cacheWritePricePerMillion: 3.75,
    contextWindow: 200000,
    maxOutputTokens: 8192,
    modality: "text",
    toolCallingSupport: true,
    visionSupport: false,
    codingScore: 0.5,
    generalScore: 0.8,
    latencyScore: null,
    outputSpeed: 100,
    sourceConfidence: "official",
    sourceUrl: "https://example.com",
    lastUpdated: "2026-01-01",
    deprecated: false,
    ...overrides,
  };
}

function makeClassification(overrides: Partial<TaskClassification>): TaskClassification {
  return {
    taskType: "api_implementation",
    difficulty: 3,
    riskLevel: 3,
    contextNeed: "medium",
    expectedChangeScope: "multi_file",
    languageOrFramework: ["TypeScript"],
    needsToolCalling: false,
    needsLongContext: false,
    privacySensitive: false,
    compressionSensitivity: "low",
    ...overrides,
  };
}

describe("CostEstimator", () => {
  describe("estimateCost", () => {
    it("calculates basic input + output cost", () => {
      const model = makeModel({
        inputPricePerMillion: 3.0,
        outputPricePerMillion: 15.0,
        cachedInputPricePerMillion: null,
      });

      const tokens = { inputTokens: 1000, outputTokens: 500, cachedInputTokens: 0 };
      const cost = estimateCost(model, tokens);

      // 1000 tokens * $3/M = $0.003 input
      // 500 tokens * $15/M = $0.0075 output
      expect(cost.estimatedUsd).toBeCloseTo(0.0105, 4);
    });

    it("applies cached input pricing when available", () => {
      const model = makeModel({
        inputPricePerMillion: 3.0,
        outputPricePerMillion: 15.0,
        cachedInputPricePerMillion: 0.3,
      });

      const tokens = { inputTokens: 2000, outputTokens: 500, cachedInputTokens: 1000 };
      const cost = estimateCost(model, tokens);

      // 1000 fresh tokens * $3/M = $0.003
      // 1000 cached tokens * $0.3/M = $0.0003
      // 500 output tokens * $15/M = $0.0075
      expect(cost.estimatedUsd).toBeCloseTo(0.0108, 4);
    });

    it("charges full input price when no cache support", () => {
      const modelNoCached = makeModel({
        inputPricePerMillion: 3.0,
        outputPricePerMillion: 15.0,
        cachedInputPricePerMillion: null,
      });

      const modelWithCached = makeModel({
        inputPricePerMillion: 3.0,
        outputPricePerMillion: 15.0,
        cachedInputPricePerMillion: 0.3,
      });

      const tokens = { inputTokens: 2000, outputTokens: 500, cachedInputTokens: 1000 };

      const costNoCached = estimateCost(modelNoCached, tokens);
      const costWithCached = estimateCost(modelWithCached, tokens);

      // Model without caching should cost more
      expect(costNoCached.estimatedUsd).toBeGreaterThan(costWithCached.estimatedUsd);
    });

    it("returns non-negative cost", () => {
      const model = makeModel({ inputPricePerMillion: 0, outputPricePerMillion: 0 });
      const tokens = { inputTokens: 1000, outputTokens: 500, cachedInputTokens: 0 };
      const cost = estimateCost(model, tokens);
      expect(cost.estimatedUsd).toBeGreaterThanOrEqual(0);
    });

    it("strong model costs more than cheap model for same tokens", () => {
      const cheapModel = makeModel({
        inputPricePerMillion: 0.8,
        outputPricePerMillion: 4.0,
        tier: "cheap",
      });

      const strongModel = makeModel({
        inputPricePerMillion: 15.0,
        outputPricePerMillion: 75.0,
        tier: "strong",
      });

      const tokens = { inputTokens: 5000, outputTokens: 1000, cachedInputTokens: 0 };

      const cheapCost = estimateCost(cheapModel, tokens);
      const strongCost = estimateCost(strongModel, tokens);

      expect(strongCost.estimatedUsd).toBeGreaterThan(cheapCost.estimatedUsd);
    });
  });

  describe("estimateTokens", () => {
    it("returns higher token counts for complex tasks", () => {
      const simpleClassification = makeClassification({ taskType: "explanation" });
      const complexClassification = makeClassification({ taskType: "multi_file_refactor" });

      const simpleTokens = estimateTokens(simpleClassification, "Explain this", undefined, undefined);
      const complexTokens = estimateTokens(complexClassification, "Refactor across files", undefined, undefined);

      expect(complexTokens.outputTokens).toBeGreaterThan(simpleTokens.outputTokens);
    });

    it("includes context in token estimate", () => {
      const classification = makeClassification({ taskType: "api_implementation" });
      const withoutContext = estimateTokens(classification, "Add endpoint", undefined, undefined);
      const withContext = estimateTokens(classification, "Add endpoint", "function code here", "repo summary");

      expect(withContext.inputTokens).toBeGreaterThan(withoutContext.inputTokens);
    });

    it("estimates cached tokens", () => {
      const classification = makeClassification({ taskType: "api_implementation" });
      const tokens = estimateTokens(classification, "Add endpoint", undefined, "Large repo summary for caching");

      expect(tokens.cachedInputTokens).toBeGreaterThanOrEqual(0);
      expect(tokens.cachedInputTokens).toBeLessThanOrEqual(tokens.inputTokens);
    });
  });
});
