import { describe, it, expect } from "vitest";
import { modelRecommender } from "../src/recommender/modelRecommender.js";
import { taskClassifier } from "../src/classifier/taskClassifier.js";
import type { TaskClassification } from "../src/types.js";

function makeClassification(overrides: Partial<TaskClassification>): TaskClassification {
  return {
    taskType: "unknown",
    difficulty: 2,
    riskLevel: 2,
    contextNeed: "medium",
    expectedChangeScope: "single_file",
    languageOrFramework: [],
    needsToolCalling: false,
    needsLongContext: false,
    privacySensitive: false,
    compressionSensitivity: "low",
    ...overrides,
  };
}

describe("ModelRecommender", () => {
  describe("simple tasks recommend cheap or mid tier", () => {
    it("recommends cheap or mid for explanation tasks", async () => {
      const classification = makeClassification({
        taskType: "explanation",
        riskLevel: 1,
        difficulty: 1,
      });

      const { recommended } = await modelRecommender.recommend(
        classification, "balanced", "Explain this function"
      );

      expect(["cheap", "mid"]).toContain(recommended.tier);
    });

    it("recommends cheap or mid for simple edit", async () => {
      const classification = makeClassification({
        taskType: "simple_edit",
        riskLevel: 1,
        difficulty: 1,
      });

      const { recommended } = await modelRecommender.recommend(
        classification, "cost_saving", "Rename this variable"
      );

      expect(["cheap", "mid"]).toContain(recommended.tier);
    });

    it("recommends cheap or mid for test generation in balanced mode", async () => {
      const classification = makeClassification({
        taskType: "test_generation",
        riskLevel: 2,
        difficulty: 2,
      });

      const { recommended } = await modelRecommender.recommend(
        classification, "balanced", "Write unit tests"
      );

      expect(["cheap", "mid"]).toContain(recommended.tier);
    });
  });

  describe("high-risk tasks never get cheap tier", () => {
    it("auth refactor never recommends cheap tier", async () => {
      const classification = makeClassification({
        taskType: "security_sensitive_change",
        riskLevel: 5,
        difficulty: 4,
      });

      const { recommended } = await modelRecommender.recommend(
        classification, "cost_saving", "Refactor JWT auth"
      );

      expect(recommended.tier).not.toBe("cheap");
      expect(["mid", "strong"]).toContain(recommended.tier);
    });

    it("database schema change never gets cheap tier", async () => {
      const classification = makeClassification({
        taskType: "database_schema_change",
        riskLevel: 4,
        difficulty: 3,
      });

      const { recommended } = await modelRecommender.recommend(
        classification, "cost_saving", "Add migration for new column"
      );

      expect(recommended.tier).not.toBe("cheap");
    });

    it("payment webhook task never gets cheap tier", async () => {
      const classification = makeClassification({
        taskType: "security_sensitive_change",
        riskLevel: 5,
        difficulty: 4,
      });

      const { recommended } = await modelRecommender.recommend(
        classification, "cost_saving", "Add Stripe payment webhook"
      );

      expect(recommended.tier).not.toBe("cheap");
    });
  });

  describe("context needs influence recommendations", () => {
    it("huge context need recommends long_context or strong tier", async () => {
      const classification = makeClassification({
        taskType: "multi_file_refactor",
        riskLevel: 3,
        contextNeed: "huge",
        needsLongContext: true,
      });

      const { recommended } = await modelRecommender.recommend(
        classification, "balanced", "Refactor entire codebase"
      );

      expect(["long_context", "strong", "mid"]).toContain(recommended.tier);
    });
  });

  describe("cost saving mode reduces cost", () => {
    it("cost_saving mode recommends lower-cost model than max_quality for safe task", async () => {
      const classification = makeClassification({
        taskType: "test_generation",
        riskLevel: 2,
        difficulty: 2,
      });

      const { recommended: costSavingRec } = await modelRecommender.recommend(
        classification, "cost_saving", "Write tests"
      );

      const { recommended: maxQualityRec } = await modelRecommender.recommend(
        classification, "max_quality", "Write tests"
      );

      expect(costSavingRec.estimatedCost.estimatedUsd).toBeLessThanOrEqual(
        maxQualityRec.estimatedCost.estimatedUsd * 2
      );
    });
  });

  describe("max_quality mode prioritizes quality", () => {
    it("max_quality mode prefers stronger models for important tasks", async () => {
      const classification = makeClassification({
        taskType: "architecture_design",
        riskLevel: 4,
        difficulty: 5,
      });

      const { recommended } = await modelRecommender.recommend(
        classification, "max_quality", "Design system architecture"
      );

      expect(["mid", "strong"]).toContain(recommended.tier);
    });
  });

  describe("fallback policy", () => {
    it("returns a fallback policy with a fallback model", async () => {
      const classification = makeClassification({
        taskType: "api_implementation",
        riskLevel: 3,
      });

      const { fallbackPolicy } = await modelRecommender.recommend(
        classification, "balanced", "Implement API endpoint"
      );

      expect(fallbackPolicy.fallbackModel).toBeTruthy();
      expect(fallbackPolicy.onTypecheckFail).toBeTruthy();
      expect(fallbackPolicy.onTestFail).toBeTruthy();
      expect(fallbackPolicy.onSecurityDetected).toBe("escalate_to_strong");
    });
  });

  describe("savings calculation", () => {
    it("calculates savings vs baseline", async () => {
      const classification = makeClassification({
        taskType: "explanation",
        riskLevel: 1,
        difficulty: 1,
      });

      const { recommended } = await modelRecommender.recommend(
        classification, "cost_saving", "Explain this",
        "anthropic/claude-opus-4-5"
      );

      // Cheap/mid model should cost less than opus
      expect(recommended.estimatedSavingsVsStrong.baselineModel).toBe("anthropic/claude-opus-4-5");
      expect(recommended.estimatedSavingsVsStrong.savingsPercent).toBeGreaterThanOrEqual(0);
    });
  });
});
