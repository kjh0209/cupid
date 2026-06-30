import { describe, it, expect } from "vitest";
import {
  assessSemanticRisk,
  checkHighRiskCompression,
} from "../src/optimizer/semanticSafetyChecker.js";
import type { TaskClassification } from "../src/types.js";

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

describe("SemanticSafetyChecker", () => {
  describe("assessSemanticRisk", () => {
    it("returns low risk when no terms removed", () => {
      const result = assessSemanticRisk(
        "Add a hello world endpoint",
        "Add hello world endpoint",
        makeClassification()
      );
      expect(result.risk).toBe("low");
      expect(result.violations).toHaveLength(0);
    });

    it("flags when JWT/token term is removed", () => {
      const result = assessSemanticRisk(
        "Fix the JWT token validation",
        "Fix the validation",
        makeClassification()
      );
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations.some((v) => v.includes("Critical term"))).toBe(true);
    });

    it("flags when auth term is removed", () => {
      const result = assessSemanticRisk(
        "Update the authentication middleware",
        "Update the middleware",
        makeClassification()
      );
      expect(result.violations.some((v) => v.includes("Critical term"))).toBe(true);
    });

    it("flags when password/secret term is removed", () => {
      const result = assessSemanticRisk(
        "Hash the password before storing",
        "Hash before storing",
        makeClassification()
      );
      expect(result.violations.some((v) => v.includes("Critical term"))).toBe(true);
    });

    it("flags when file references are removed", () => {
      const result = assessSemanticRisk(
        "Fix the bug in auth.ts",
        "Fix the bug",
        makeClassification()
      );
      expect(result.violations.some((v) => v.includes("File reference"))).toBe(true);
    });

    it("notes when quoted strings are paraphrased", () => {
      const result = assessSemanticRisk(
        'Return error "User not found"',
        "Return error when user missing",
        makeClassification()
      );
      expect(result.reasons.some((r) => r.includes("Quoted requirement"))).toBe(true);
    });

    it("flags aggressive compression on high-risk tasks", () => {
      const original = "A".repeat(100);
      const optimized = "A".repeat(20); // 80% compression
      const result = assessSemanticRisk(
        original,
        optimized,
        makeClassification({ riskLevel: 4 })
      );
      expect(result.violations.some((v) => v.includes("Aggressive compression"))).toBe(true);
    });

    it("returns high risk for 2+ violations", () => {
      const result = assessSemanticRisk(
        "Fix the JWT validation in auth.ts and handle payment webhook",
        "Fix the issue",
        makeClassification({ taskType: "security_sensitive_change" })
      );
      expect(result.risk).toBe("high");
    });

    it("returns medium risk for 1 violation", () => {
      const result = assessSemanticRisk(
        "Fix the bug in routes.ts",
        "Fix the bug",
        makeClassification()
      );
      expect(result.risk).toBe("medium");
    });

    it("adds extra violation for security tasks with losses", () => {
      const result = assessSemanticRisk(
        "Fix the JWT token refresh",
        "Fix the refresh",
        makeClassification({ taskType: "security_sensitive_change" })
      );
      expect(result.violations.some((v) => v.includes("Security task"))).toBe(true);
    });
  });

  describe("checkHighRiskCompression", () => {
    it("returns true for non-high sensitivity", () => {
      expect(checkHighRiskCompression("original text", "short", "medium")).toBe(true);
      expect(checkHighRiskCompression("original text", "short", "low")).toBe(true);
    });

    it("returns true when fewer than 2 high-risk keywords", () => {
      expect(checkHighRiskCompression("fix the button", "fix", "high")).toBe(true);
    });

    it("returns true when compression <= 30% on high-risk text", () => {
      const original = "fix the jwt token and auth session handling properly";
      const optimized = "fix jwt token and auth session handling"; // ~20% compressed
      expect(checkHighRiskCompression(original, optimized, "high")).toBe(true);
    });

    it("returns false when compression > 30% on high-risk text", () => {
      const original = "fix the jwt token and auth session handling, make sure the password validation is correct";
      const optimized = "fix it"; // >30% compression
      expect(checkHighRiskCompression(original, optimized, "high")).toBe(false);
    });
  });
});
