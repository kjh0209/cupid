import { describe, it, expect } from "vitest";
import { planContext } from "../src/context/contextPlanner.js";
import { planCachePolicy } from "../src/optimizer/cachePolicyPlanner.js";
import type { TaskClassification } from "../src/types.js";

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

describe("ContextPlanner", () => {
  describe("explanation tasks", () => {
    it("includes selected code for explanation tasks", () => {
      const plan = planContext({
        taskClassification: makeClassification({ taskType: "explanation", riskLevel: 1 }),
        rawMessage: "Explain this function",
        optimizedMessage: "Explain this function",
        selectedCode: "function foo() { return 42; }",
        modelContextWindow: 128000,
      });

      expect(plan.include).toContain("selected_code");
    });

    it("excludes full repo map for explanation", () => {
      const plan = planContext({
        taskClassification: makeClassification({ taskType: "explanation", riskLevel: 1 }),
        rawMessage: "Explain this function",
        optimizedMessage: "Explain this function",
        modelContextWindow: 128000,
      });

      expect(plan.exclude.some((e) => e.includes("repo"))).toBe(true);
    });
  });

  describe("security sensitive tasks", () => {
    it("includes auth middleware context for security tasks", () => {
      const plan = planContext({
        taskClassification: makeClassification({
          taskType: "security_sensitive_change",
          riskLevel: 5,
        }),
        rawMessage: "Refactor auth",
        optimizedMessage: "Refactor auth",
        activeFile: "src/middleware/auth.ts",
        modelContextWindow: 200000,
      });

      expect(plan.include.some((i) => i.includes("auth"))).toBe(true);
      expect(plan.compressionPlan.some((c) => c.toLowerCase().includes("security") || c.toLowerCase().includes("compress"))).toBe(true);
    });

    it("does not exclude auth context for security tasks", () => {
      const plan = planContext({
        taskClassification: makeClassification({
          taskType: "security_sensitive_change",
          riskLevel: 5,
        }),
        rawMessage: "Refactor JWT auth",
        optimizedMessage: "Refactor JWT auth",
        modelContextWindow: 200000,
      });

      // Should not exclude auth/security content
      expect(plan.exclude.some((e) => e.toLowerCase().includes("auth"))).toBe(false);
    });
  });

  describe("multi-file refactor tasks", () => {
    it("includes repo map for multi-file refactors", () => {
      const plan = planContext({
        taskClassification: makeClassification({
          taskType: "multi_file_refactor",
          riskLevel: 3,
        }),
        rawMessage: "Refactor all service files",
        optimizedMessage: "Refactor all service files",
        modelContextWindow: 200000,
      });

      expect(plan.include).toContain("repo_map");
    });
  });

  describe("context risk assessment", () => {
    it("marks high risk when context approaches model limit", () => {
      const plan = planContext({
        taskClassification: makeClassification({
          taskType: "multi_file_refactor",
          riskLevel: 3,
          contextNeed: "large",
        }),
        rawMessage: "Refactor entire codebase",
        optimizedMessage: "Refactor entire codebase",
        // Very small context window to trigger high risk
        modelContextWindow: 4096,
      });

      // With many includes and a tiny context window, risk should be elevated
      expect(["medium", "high"]).toContain(plan.contextRisk);
    });

    it("assigns low risk for small context tasks", () => {
      const plan = planContext({
        taskClassification: makeClassification({
          taskType: "explanation",
          riskLevel: 1,
          contextNeed: "small",
        }),
        rawMessage: "Explain this line",
        optimizedMessage: "Explain this line",
        selectedCode: "const x = 42;",
        modelContextWindow: 128000,
      });

      expect(plan.contextRisk).toBe("low");
    });
  });
});

describe("CachePolicyPlanner", () => {
  describe("Anthropic provider", () => {
    it("marks system prompt and repo summary as cacheable", () => {
      const plan = planCachePolicy({
        systemPrompt: "You are an expert coding assistant. ".repeat(100),
        repoSummary: "This is a TypeScript monorepo. ".repeat(50),
        currentUserMessage: "Add endpoint",
        selectedModelId: "anthropic/claude-sonnet-4-5",
      });

      expect(plan.cacheableBlocks).toContain("system_prompt");
      expect(plan.cacheableBlocks).toContain("repo_summary");
      expect(plan.cacheStrategy).toBe("provider_supported");
    });

    it("marks current user message as dynamic", () => {
      const plan = planCachePolicy({
        systemPrompt: "You are an expert.",
        currentUserMessage: "Add endpoint now",
        selectedModelId: "anthropic/claude-sonnet-4-5",
      });

      expect(plan.dynamicBlocks).toContain("current_user_message");
    });

    it("marks tool definitions as cacheable", () => {
      const plan = planCachePolicy({
        systemPrompt: "Expert assistant.",
        toolDefinitions: JSON.stringify({ tools: [] }),
        currentUserMessage: "Help me",
        selectedModelId: "anthropic/claude-sonnet-4-5",
      });

      expect(plan.cacheableBlocks).toContain("tool_definitions");
    });
  });

  describe("unsupported providers", () => {
    it("uses manual_reuse strategy for unknown providers", () => {
      const plan = planCachePolicy({
        systemPrompt: "Expert assistant.",
        currentUserMessage: "Help",
        selectedModelId: "unknown/some-model",
      });

      expect(plan.cacheStrategy).toBe("manual_reuse");
    });
  });

  describe("OpenAI provider", () => {
    it("supports provider caching for OpenAI", () => {
      const plan = planCachePolicy({
        systemPrompt: "You are an expert.",
        currentUserMessage: "Add endpoint",
        selectedModelId: "openai/gpt-4o",
      });

      expect(plan.cacheStrategy).toBe("provider_supported");
    });
  });
});
