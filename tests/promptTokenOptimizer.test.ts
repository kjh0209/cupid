import { describe, it, expect } from "vitest";
import { promptTokenOptimizer } from "../src/optimizer/promptTokenOptimizer.js";
import type { TaskClassification } from "../src/types.js";

function makeClassification(overrides: Partial<TaskClassification>): TaskClassification {
  return {
    taskType: "api_implementation",
    difficulty: 3,
    riskLevel: 2,
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

describe("PromptTokenOptimizer", () => {
  describe("filler removal", () => {
    it("removes filler phrases", () => {
      const result = promptTokenOptimizer.optimize({
        rawMessage: "Hey can you maybe add rate limiting to this route please?",
        taskClassification: makeClassification({ taskType: "api_implementation" }),
        selectedModel: "anthropic/claude-sonnet-4-5",
        userMode: "balanced",
      });

      expect(result.optimizedMessage.toLowerCase()).not.toContain("can you maybe");
      expect(result.optimizedMessage.toLowerCase()).toContain("rate limiting");
      expect(result.estimatedTokenSavings).toBeGreaterThan(0);
    });

    it("removes 'please' from simple messages", () => {
      const result = promptTokenOptimizer.optimize({
        rawMessage: "Please add a loading spinner to the button",
        taskClassification: makeClassification({ taskType: "ui_change", riskLevel: 1 }),
        selectedModel: "anthropic/claude-haiku-4-5",
        userMode: "cost_saving",
      });

      expect(result.optimizedMessage).not.toContain("Please");
      expect(result.optimizedMessage.toLowerCase()).toContain("loading spinner");
    });

    it("removes 'I was thinking' filler", () => {
      const result = promptTokenOptimizer.optimize({
        rawMessage: "I was thinking maybe we could add pagination to the list",
        taskClassification: makeClassification({ taskType: "api_implementation" }),
        selectedModel: "anthropic/claude-sonnet-4-5",
        userMode: "balanced",
      });

      expect(result.optimizedMessage.toLowerCase()).not.toContain("i was thinking");
      expect(result.optimizedMessage.toLowerCase()).toContain("pagination");
    });
  });

  describe("explicit constraints preservation", () => {
    it("preserves explicit constraints in high-risk tasks", () => {
      const result = promptTokenOptimizer.optimize({
        rawMessage: "Refactor auth logic but don't break the JWT refresh flow and keep the admin guard behavior the same",
        taskClassification: makeClassification({
          taskType: "security_sensitive_change",
          riskLevel: 5,
          compressionSensitivity: "high",
        }),
        selectedModel: "anthropic/claude-opus-4-5",
        userMode: "max_quality",
      });

      expect(result.optimizedMessage.toLowerCase()).toContain("jwt");
      expect(result.optimizedMessage.toLowerCase()).toContain("admin");
      expect(result.semanticRisk).not.toBe("high");
    });

    it("preserves acceptance criteria", () => {
      const result = promptTokenOptimizer.optimize({
        rawMessage: "Add file upload: PNG and JPEG only, max 5MB, store to S3",
        taskClassification: makeClassification({ taskType: "api_implementation", riskLevel: 3 }),
        selectedModel: "anthropic/claude-sonnet-4-5",
        userMode: "balanced",
      });

      expect(result.optimizedMessage.toLowerCase()).toContain("5mb");
      expect(result.optimizedMessage.toLowerCase()).toContain("s3");
    });
  });

  describe("identifier preservation", () => {
    it("preserves filename references", () => {
      const result = promptTokenOptimizer.optimize({
        rawMessage: "Fix the bug in userService.ts where getUserById returns undefined",
        taskClassification: makeClassification({ taskType: "local_bug_fix", riskLevel: 2 }),
        selectedModel: "anthropic/claude-sonnet-4-5",
        userMode: "balanced",
      });

      expect(result.optimizedMessage).toContain("userService.ts");
      expect(result.preservedRequirements).toContain("userService.ts");
    });

    it("preserves function names", () => {
      const result = promptTokenOptimizer.optimize({
        rawMessage: "Can you please fix the calculateShipping function so it handles null weight",
        taskClassification: makeClassification({ taskType: "local_bug_fix", riskLevel: 2 }),
        selectedModel: "anthropic/claude-sonnet-4-5",
        userMode: "balanced",
      });

      expect(result.optimizedMessage).toContain("calculateShipping");
    });

    it("preserves library names (Zod, Prisma)", () => {
      const result = promptTokenOptimizer.optimize({
        rawMessage: "Add Zod validation and Prisma query to the new endpoint",
        taskClassification: makeClassification({ taskType: "api_implementation" }),
        selectedModel: "anthropic/claude-sonnet-4-5",
        userMode: "balanced",
      });

      expect(result.optimizedMessage.toLowerCase()).toContain("zod");
      expect(result.optimizedMessage.toLowerCase()).toContain("prisma");
    });
  });

  describe("high-risk compression guardrail", () => {
    it("does not aggressively compress security prompts", () => {
      const longSecurityPrompt = `Refactor our authentication system. The JWT secret rotation must work
correctly. Admin roles must be preserved. Session invalidation on password change is required.
Make sure the bcrypt work factor stays at 12. The CSRF token validation for state-changing routes must remain.
Do not remove the rate limiting on login. The 2FA flow must still work.`;

      const result = promptTokenOptimizer.optimize({
        rawMessage: longSecurityPrompt,
        taskClassification: makeClassification({
          taskType: "security_sensitive_change",
          riskLevel: 5,
          compressionSensitivity: "high",
        }),
        selectedModel: "anthropic/claude-opus-4-5",
        userMode: "max_quality",
      });

      // Should not remove critical requirements
      expect(result.optimizedMessage.toLowerCase()).toContain("jwt");
      expect(result.optimizedMessage.toLowerCase()).toContain("admin");
      expect(result.optimizedMessage.toLowerCase()).toContain("bcrypt");

      // Should not over-compress
      const compressionPercent = result.estimatedSavingsPercent;
      expect(compressionPercent).toBeLessThan(40);
    });
  });

  describe("minimal diff instruction", () => {
    it("adds minimal diff instruction for editing tasks", () => {
      const result = promptTokenOptimizer.optimize({
        rawMessage: "Add error handling to the submitOrder function",
        taskClassification: makeClassification({ taskType: "local_bug_fix", riskLevel: 2 }),
        selectedModel: "anthropic/claude-sonnet-4-5",
        userMode: "balanced",
      });

      expect(result.appliedRules).toContain("patch-diff-instruction");
    });

    it("does not add diff instruction for explanation tasks", () => {
      const result = promptTokenOptimizer.optimize({
        rawMessage: "Explain how this function works",
        taskClassification: makeClassification({ taskType: "explanation", riskLevel: 1 }),
        selectedModel: "anthropic/claude-haiku-4-5",
        userMode: "balanced",
      });

      expect(result.appliedRules).not.toContain("patch-diff-instruction");
    });
  });

  describe("token savings estimation", () => {
    it("estimates positive token savings for verbose prompts", () => {
      const result = promptTokenOptimizer.optimize({
        rawMessage: "Hey can you maybe please look at this file and perhaps consider adding some sort of loading state if possible? I think it would be nice to have.",
        taskClassification: makeClassification({ taskType: "ui_change", riskLevel: 1 }),
        selectedModel: "anthropic/claude-haiku-4-5",
        userMode: "cost_saving",
      });

      // Compression savings > 0 (filler was removed)
      expect(result.estimatedTokenSavings).toBeGreaterThan(0);
      expect(result.estimatedSavingsPercent).toBeGreaterThan(0);
      // Note: optimizedTokenEstimate may be >= original because the optimizer
      // also adds useful output-saving instructions (diff hints, scope guards).
      // The savings metric counts filler removed, not net message length change.
      expect(result.originalTokenEstimate).toBeGreaterThan(0);
    });

    it("returns valid token estimates", () => {
      const result = promptTokenOptimizer.optimize({
        rawMessage: "Add a tooltip to the delete button",
        taskClassification: makeClassification({ taskType: "simple_edit", riskLevel: 1 }),
        selectedModel: "anthropic/claude-haiku-4-5",
        userMode: "balanced",
      });

      expect(result.originalTokenEstimate).toBeGreaterThan(0);
      expect(result.optimizedTokenEstimate).toBeGreaterThan(0);
      expect(result.estimatedTokenSavings).toBeGreaterThanOrEqual(0);
    });
  });

  describe("semantic risk assessment", () => {
    it("assigns low risk to simple tasks", () => {
      const result = promptTokenOptimizer.optimize({
        rawMessage: "Add a comment to this function",
        taskClassification: makeClassification({ taskType: "simple_edit", riskLevel: 1 }),
        selectedModel: "anthropic/claude-haiku-4-5",
        userMode: "balanced",
      });

      expect(result.semanticRisk).toBe("low");
    });
  });
});
