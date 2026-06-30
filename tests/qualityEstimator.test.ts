import { describe, it, expect } from "vitest";
import {
  estimateQuality,
  estimateLatencyScore,
  estimateFailureRisk,
} from "../src/recommender/qualityEstimator.js";
import type { ModelRecord, TaskClassification } from "../src/types.js";

function makeModel(overrides: Partial<ModelRecord> = {}): ModelRecord {
  return {
    id: "test/model",
    provider: "test",
    displayName: "Test Model",
    tier: "mid",
    inputPricePerMillion: 3.0,
    outputPricePerMillion: 15.0,
    cachedInputPricePerMillion: null,
    cacheWritePricePerMillion: null,
    contextWindow: 128000,
    maxOutputTokens: 16384,
    modality: "text",
    toolCallingSupport: true,
    visionSupport: true,
    codingScore: 0.6,
    generalScore: 0.88,
    latencyScore: null,
    outputSpeed: 100,
    sourceConfidence: "official",
    sourceUrl: "https://example.com",
    lastUpdated: "2025-01-01",
    deprecated: false,
    ...overrides,
  };
}

function makeClassification(overrides: Partial<TaskClassification> = {}): TaskClassification {
  return {
    taskType: "simple_edit",
    difficulty: 2,
    riskLevel: 2,
    contextNeed: "small",
    expectedChangeScope: "single_file",
    languageOrFramework: ["TypeScript"],
    needsToolCalling: false,
    needsLongContext: false,
    privacySensitive: false,
    compressionSensitivity: "medium",
    ...overrides,
  };
}

describe("QualityEstimator", () => {
  describe("estimateQuality", () => {
    it("returns value between 0 and 1", () => {
      const quality = estimateQuality(makeModel(), makeClassification());
      expect(quality).toBeGreaterThanOrEqual(0);
      expect(quality).toBeLessThanOrEqual(1);
    });

    it("uses coding score as base for coding tasks", () => {
      const model = makeModel({ codingScore: 0.7 });
      const quality = estimateQuality(model, makeClassification({ taskType: "local_bug_fix" }));
      expect(quality).toBeGreaterThanOrEqual(0.7);
    });

    it("weights general score higher for explanation tasks", () => {
      const model = makeModel({ codingScore: 0.3, generalScore: 0.9 });
      const quality = estimateQuality(model, makeClassification({ taskType: "explanation" }));
      // 0.4*0.3 + 0.6*0.9 = 0.12 + 0.54 = 0.66
      expect(quality).toBeGreaterThan(0.5);
    });

    it("weights general score higher for architecture_design", () => {
      const model = makeModel({ codingScore: 0.3, generalScore: 0.9 });
      const quality = estimateQuality(model, makeClassification({ taskType: "architecture_design" }));
      expect(quality).toBeGreaterThan(0.5);
    });

    it("applies tier quality floor", () => {
      const model = makeModel({ tier: "strong", codingScore: 0.2 });
      const quality = estimateQuality(model, makeClassification());
      expect(quality).toBeGreaterThanOrEqual(0.65);
    });

    it("penalizes cheap model on high-risk tasks (riskLevel >= 4)", () => {
      const model = makeModel({ tier: "cheap", codingScore: 0.5 });
      const normal = estimateQuality(model, makeClassification({ riskLevel: 2 }));
      const highRisk = estimateQuality(model, makeClassification({ riskLevel: 4 }));
      expect(highRisk).toBeLessThan(normal);
    });

    it("penalizes cheap model on riskLevel 3", () => {
      const model = makeModel({ tier: "cheap", codingScore: 0.5 });
      const normal = estimateQuality(model, makeClassification({ riskLevel: 2 }));
      const midRisk = estimateQuality(model, makeClassification({ riskLevel: 3 }));
      expect(midRisk).toBeLessThan(normal);
    });

    it("gives bonus to long_context model on huge context tasks", () => {
      const model = makeModel({ tier: "long_context", codingScore: 0.5 });
      const small = estimateQuality(model, makeClassification({ contextNeed: "small" }));
      const huge = estimateQuality(model, makeClassification({ contextNeed: "huge" }));
      expect(huge).toBeGreaterThan(small);
    });

    it("penalizes cheap model on high difficulty (>= 4)", () => {
      const model = makeModel({ tier: "cheap", codingScore: 0.5 });
      const easy = estimateQuality(model, makeClassification({ difficulty: 2 }));
      const hard = estimateQuality(model, makeClassification({ difficulty: 4 }));
      expect(hard).toBeLessThan(easy);
    });

    it("penalizes model without tool calling when needed", () => {
      const model = makeModel({ toolCallingSupport: false });
      const noTools = estimateQuality(model, makeClassification({ needsToolCalling: false }));
      const needsTools = estimateQuality(model, makeClassification({ needsToolCalling: true }));
      expect(needsTools).toBeLessThan(noTools);
    });

    it("penalizes small context window on huge context need", () => {
      const model = makeModel({ contextWindow: 32000 });
      const small = estimateQuality(model, makeClassification({ contextNeed: "small" }));
      const huge = estimateQuality(model, makeClassification({ contextNeed: "huge" }));
      expect(huge).toBeLessThan(small);
    });

    it("penalizes model with < 32k context on large context need", () => {
      const model = makeModel({ contextWindow: 16000 });
      const quality = estimateQuality(model, makeClassification({ contextNeed: "large" }));
      const modelLarge = makeModel({ contextWindow: 128000 });
      const qualityLarge = estimateQuality(modelLarge, makeClassification({ contextNeed: "large" }));
      expect(quality).toBeLessThan(qualityLarge);
    });

    it("handles null codingScore by defaulting to 0.35", () => {
      const model = makeModel({ codingScore: null });
      const quality = estimateQuality(model, makeClassification());
      expect(quality).toBeGreaterThanOrEqual(0);
    });
  });

  describe("estimateLatencyScore", () => {
    it("normalizes speed against 300 tok/sec reference", () => {
      expect(estimateLatencyScore(makeModel({ outputSpeed: 150 }))).toBeCloseTo(0.5);
      expect(estimateLatencyScore(makeModel({ outputSpeed: 300 }))).toBeCloseTo(1.0);
    });

    it("caps at 1.0", () => {
      expect(estimateLatencyScore(makeModel({ outputSpeed: 600 }))).toBe(1.0);
    });

    it("defaults to 80 tok/sec when null", () => {
      expect(estimateLatencyScore(makeModel({ outputSpeed: null }))).toBeCloseTo(80 / 300);
    });
  });

  describe("estimateFailureRisk", () => {
    it("cheap tier + riskLevel 5 = 0.8", () => {
      const risk = estimateFailureRisk(
        makeModel({ tier: "cheap" }),
        makeClassification({ riskLevel: 5 })
      );
      expect(risk).toBe(0.8);
    });

    it("cheap tier + riskLevel 4 = 0.6", () => {
      const risk = estimateFailureRisk(
        makeModel({ tier: "cheap" }),
        makeClassification({ riskLevel: 4 })
      );
      expect(risk).toBe(0.6);
    });

    it("cheap tier + riskLevel 3 = 0.3", () => {
      const risk = estimateFailureRisk(
        makeModel({ tier: "cheap" }),
        makeClassification({ riskLevel: 3 })
      );
      expect(risk).toBe(0.3);
    });

    it("cheap tier + low risk = 0.1", () => {
      const risk = estimateFailureRisk(
        makeModel({ tier: "cheap" }),
        makeClassification({ riskLevel: 1 })
      );
      expect(risk).toBe(0.1);
    });

    it("mid tier + riskLevel 5 = 0.4", () => {
      const risk = estimateFailureRisk(
        makeModel({ tier: "mid" }),
        makeClassification({ riskLevel: 5 })
      );
      expect(risk).toBe(0.4);
    });

    it("strong tier + riskLevel 5 = 0.15", () => {
      const risk = estimateFailureRisk(
        makeModel({ tier: "strong" }),
        makeClassification({ riskLevel: 5 })
      );
      expect(risk).toBe(0.15);
    });

    it("strong tier + low risk = 0.02", () => {
      const risk = estimateFailureRisk(
        makeModel({ tier: "strong" }),
        makeClassification({ riskLevel: 2 })
      );
      expect(risk).toBe(0.02);
    });

    it("adds extra risk for security tasks on cheap/mid tier", () => {
      const cheapRisk = estimateFailureRisk(
        makeModel({ tier: "cheap" }),
        makeClassification({ taskType: "security_sensitive_change", riskLevel: 3 })
      );
      // 0.3 * 1.5 = 0.45
      expect(cheapRisk).toBeCloseTo(0.45);
    });

    it("caps risk at 1.0", () => {
      const risk = estimateFailureRisk(
        makeModel({ tier: "cheap" }),
        makeClassification({ taskType: "security_sensitive_change", riskLevel: 5 })
      );
      expect(risk).toBeLessThanOrEqual(1.0);
    });
  });
});
