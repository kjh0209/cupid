import { describe, it, expect } from "vitest";
import { taskClassifier } from "../src/classifier/taskClassifier.js";

describe("TaskClassifier", () => {
  describe("task type detection", () => {
    it("classifies auth refactor as security_sensitive_change with high risk", () => {
      const result = taskClassifier.classify({
        message: "Refactor the JWT authentication middleware to support RS256 and HS256",
        userMode: "balanced",
      });
      expect(result.taskType).toBe("security_sensitive_change");
      expect(result.riskLevel).toBeGreaterThanOrEqual(4);
    });

    it("classifies explanation tasks as low risk", () => {
      const result = taskClassifier.classify({
        message: "Explain how this function works and what it returns",
        userMode: "balanced",
      });
      expect(result.taskType).toBe("explanation");
      expect(result.riskLevel).toBeLessThanOrEqual(2);
      expect(result.difficulty).toBeLessThanOrEqual(2);
    });

    it("classifies database migration as medium/high risk", () => {
      const result = taskClassifier.classify({
        message: "Add a migration to add the deleted_at column to users table with Prisma",
        userMode: "balanced",
      });
      expect(result.taskType).toBe("database_schema_change");
      expect(result.riskLevel).toBeGreaterThanOrEqual(3);
    });

    it("classifies simple rename as simple_edit with low risk", () => {
      const result = taskClassifier.classify({
        message: "Rename the variable userID to userId",
        userMode: "balanced",
      });
      expect(result.taskType).toBe("simple_edit");
      expect(result.riskLevel).toBeLessThanOrEqual(2);
    });

    it("classifies test writing as test_generation", () => {
      const result = taskClassifier.classify({
        message: "Write unit tests for the validateUser function with vitest",
        userMode: "balanced",
      });
      expect(result.taskType).toBe("test_generation");
    });

    it("classifies API route work as api_implementation", () => {
      const result = taskClassifier.classify({
        message: "Add rate limiting and Zod validation to this Next.js API route",
        userMode: "balanced",
      });
      expect(result.taskType).toBe("api_implementation");
    });

    it("classifies refactor across files as multi_file_refactor", () => {
      const result = taskClassifier.classify({
        message: "Refactor the user service across all files to extract email logic",
        userMode: "balanced",
      });
      expect(result.taskType).toBe("multi_file_refactor");
    });

    it("classifies prompt rewrite tasks", () => {
      const result = taskClassifier.classify({
        message: "Rewrite this prompt to reduce tokens",
        userMode: "balanced",
      });
      expect(result.taskType).toBe("prompt_rewrite_only");
    });

    it("classifies CSS change as ui_change", () => {
      const result = taskClassifier.classify({
        message: "Update the button CSS color to indigo and change the border radius",
        userMode: "balanced",
      });
      expect(result.taskType).toBe("ui_change");
    });
  });

  describe("risk level detection", () => {
    it("payment-related task gets high risk", () => {
      const result = taskClassifier.classify({
        message: "Add Stripe payment webhook handling with signature validation",
        userMode: "balanced",
      });
      expect(result.riskLevel).toBeGreaterThanOrEqual(4);
    });

    it("secret/API key task gets high risk", () => {
      const result = taskClassifier.classify({
        message: "Implement secret rotation for API keys in the database",
        userMode: "balanced",
      });
      expect(result.riskLevel).toBeGreaterThanOrEqual(4);
    });

    it("explanation task has risk level 1", () => {
      const result = taskClassifier.classify({
        message: "What does the map function do in JavaScript?",
        userMode: "balanced",
      });
      expect(result.riskLevel).toBeLessThanOrEqual(2);
    });
  });

  describe("framework detection", () => {
    it("detects TypeScript and Next.js", () => {
      const result = taskClassifier.classify({
        message: "Add a new Next.js API route with TypeScript and Zod validation",
        activeFilePath: "app/api/users/route.ts",
        userMode: "balanced",
      });
      expect(result.languageOrFramework).toContain("TypeScript");
      expect(result.languageOrFramework).toContain("Next.js");
    });

    it("detects React from file path", () => {
      const result = taskClassifier.classify({
        message: "Add a loading state to this component",
        activeFilePath: "components/UserCard.tsx",
        userMode: "balanced",
      });
      expect(result.languageOrFramework.some((f) => ["React", "TypeScript"].includes(f))).toBe(true);
    });
  });

  describe("context need", () => {
    it("architecture tasks need large context", () => {
      const result = taskClassifier.classify({
        message: "Design the entire codebase architecture for a microservices split",
        userMode: "balanced",
      });
      expect(["large", "huge"]).toContain(result.contextNeed);
    });

    it("explanation of selected code needs small context", () => {
      const result = taskClassifier.classify({
        message: "Explain what this function does",
        selectedCode: "function foo() { return 42; }",
        userMode: "balanced",
      });
      expect(["small", "medium"]).toContain(result.contextNeed);
    });
  });

  describe("code_review detection (review-verb overrides subject-matter)", () => {
    it("classifies 'review this migration for production safety' as code_review", () => {
      const result = taskClassifier.classify({
        message: "review this migration for production safety",
        userMode: "balanced",
      });
      expect(result.taskType).toBe("code_review");
    });

    it("classifies 'review this auth handler — focus on security' as code_review", () => {
      const result = taskClassifier.classify({
        message: "review this auth handler — focus on security",
        userMode: "balanced",
      });
      expect(result.taskType).toBe("code_review");
    });

    it("classifies 'give me feedback on this implementation' as code_review", () => {
      const result = taskClassifier.classify({
        message: "give me feedback on this implementation",
        userMode: "balanced",
      });
      expect(result.taskType).toBe("code_review");
    });

    it("does NOT classify 'design the migration plan' as code_review", () => {
      const result = taskClassifier.classify({
        message: "shard the orders table by tenant_id — design the migration plan",
        userMode: "balanced",
      });
      expect(result.taskType).not.toBe("code_review");
    });

    it("does NOT classify 'implement the migration' as code_review", () => {
      const result = taskClassifier.classify({
        message: "implement a migration to add deleted_at column",
        userMode: "balanced",
      });
      expect(result.taskType).not.toBe("code_review");
    });
  });

  describe("creation verb difficulty bumping", () => {
    it("bumps difficulty to 4+ for 'build me an app' without code context", () => {
      const result = taskClassifier.classify({
        message: "build me a todo app",
        userMode: "balanced",
      });
      expect(result.difficulty).toBeGreaterThanOrEqual(4);
    });

    it("bumps difficulty to 4+ for 'create a game from scratch'", () => {
      const result = taskClassifier.classify({
        message: "create a game from scratch",
        userMode: "balanced",
      });
      expect(result.difficulty).toBeGreaterThanOrEqual(4);
    });
  });

  describe("compression sensitivity", () => {
    it("security tasks have high compression sensitivity", () => {
      const result = taskClassifier.classify({
        message: "Refactor JWT auth middleware — preserve admin guard",
        userMode: "balanced",
      });
      expect(result.compressionSensitivity).toBe("high");
    });

    it("explanation tasks have low compression sensitivity", () => {
      const result = taskClassifier.classify({
        message: "Explain this function please",
        userMode: "balanced",
      });
      expect(result.compressionSensitivity).toBe("low");
    });
  });
});
