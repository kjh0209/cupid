import { describe, it, expect } from "vitest";
import { getTierPolicy, isTierAllowed, getFallbackPolicy } from "../src/recommender/riskPolicy.js";
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

describe("RiskPolicy", () => {
  describe("security sensitive tasks", () => {
    it("requires strong tier for security_sensitive_change", () => {
      const classification = makeClassification({
        taskType: "security_sensitive_change",
        riskLevel: 5,
      });

      const policy = getTierPolicy(classification, "balanced");
      expect(isTierAllowed("cheap", policy)).toBe(false);
      expect(isTierAllowed("mid", policy)).toBe(false);
      expect(isTierAllowed("strong", policy)).toBe(true);
    });

    it("requires strong for riskLevel >= 5", () => {
      const classification = makeClassification({ riskLevel: 5 });
      const policy = getTierPolicy(classification, "cost_saving");
      expect(isTierAllowed("cheap", policy)).toBe(false);
      expect(isTierAllowed("mid", policy)).toBe(false);
      expect(isTierAllowed("strong", policy)).toBe(true);
    });

    it("blocks cheap and mid for riskLevel >= 4", () => {
      const classification = makeClassification({ riskLevel: 4 });
      const policy = getTierPolicy(classification, "cost_saving");
      expect(isTierAllowed("cheap", policy)).toBe(false);
      expect(isTierAllowed("mid", policy)).toBe(false);
      expect(isTierAllowed("strong", policy)).toBe(true);
    });
  });

  describe("database schema tasks", () => {
    it("requires strong tier for database_schema_change", () => {
      const classification = makeClassification({
        taskType: "database_schema_change",
        riskLevel: 4,
      });

      const policy = getTierPolicy(classification, "cost_saving");
      expect(isTierAllowed("cheap", policy)).toBe(false);
      expect(isTierAllowed("mid", policy)).toBe(false);
      expect(isTierAllowed("strong", policy)).toBe(true);
    });

    it("requires strong tier for db change even in cost_saving mode", () => {
      const classification = makeClassification({
        taskType: "database_schema_change",
        riskLevel: 3,
      });
      const policy = getTierPolicy(classification, "cost_saving");
      expect(isTierAllowed("mid", policy)).toBe(false);
      expect(isTierAllowed("strong", policy)).toBe(true);
    });
  });

  describe("low risk tasks", () => {
    it("allows cheap and mid for explanation tasks in balanced mode", () => {
      const classification = makeClassification({
        taskType: "explanation",
        riskLevel: 1,
      });

      const policy = getTierPolicy(classification, "balanced");
      expect(isTierAllowed("cheap", policy)).toBe(true);
      expect(isTierAllowed("mid", policy)).toBe(true);
      expect(isTierAllowed("strong", policy)).toBe(false);
    });

    it("allows strong for explanation tasks in max_quality mode", () => {
      const classification = makeClassification({
        taskType: "explanation",
        riskLevel: 1,
      });

      const policy = getTierPolicy(classification, "max_quality");
      expect(isTierAllowed("cheap", policy)).toBe(true);
      expect(isTierAllowed("mid", policy)).toBe(true);
      expect(isTierAllowed("strong", policy)).toBe(true);
    });

    it("allows cheap tier for simple_edit", () => {
      const classification = makeClassification({
        taskType: "simple_edit",
        riskLevel: 1,
      });

      const policy = getTierPolicy(classification, "cost_saving");
      expect(isTierAllowed("cheap", policy)).toBe(true);
    });

    it("allows cheap tier for ui_change", () => {
      const classification = makeClassification({
        taskType: "ui_change",
        riskLevel: 1,
      });

      const policy = getTierPolicy(classification, "cost_saving");
      expect(isTierAllowed("cheap", policy)).toBe(true);
    });
  });

  describe("huge context tasks", () => {
    it("routes huge context to long_context or strong tier", () => {
      const classification = makeClassification({
        contextNeed: "huge",
        riskLevel: 2,
      });

      const policy = getTierPolicy(classification, "balanced");
      expect(
        isTierAllowed("long_context", policy) || isTierAllowed("strong", policy)
      ).toBe(true);
    });
  });

  describe("privacy sensitive tasks", () => {
    it("privacy sensitive routes to local_private or strong", () => {
      const classification = makeClassification({
        privacySensitive: true,
        riskLevel: 2,
      });

      const policy = getTierPolicy(classification, "balanced");
      expect(isTierAllowed("cheap", policy)).toBe(false);
      expect(
        isTierAllowed("local_private", policy) || isTierAllowed("strong", policy)
      ).toBe(true);
    });
  });

  describe("fallback policy", () => {
    it("escalates to strong on security detected", () => {
      const policy = getFallbackPolicy("anthropic/claude-sonnet-4-5", 3);
      expect(policy.onSecurityDetected).toBe("escalate_to_strong");
    });

    it("high risk tasks escalate on test fail", () => {
      const policy = getFallbackPolicy("anthropic/claude-sonnet-4-5", 4);
      expect(policy.onTestFail).toContain("escalate");
    });

    it("returns a fallback model", () => {
      const policy = getFallbackPolicy("anthropic/claude-haiku-4-5", 2);
      expect(policy.fallbackModel).toBeTruthy();
      expect(policy.fallbackModel).toContain("anthropic");
    });
  });
});
