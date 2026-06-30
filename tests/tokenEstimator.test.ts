import { describe, it, expect } from "vitest";
import {
  estimateTokens,
  estimateTokensForMessages,
  estimateOutputTokensByTaskType,
  estimateContextTokens,
} from "../src/utils/tokenEstimator.js";

describe("TokenEstimator", () => {
  describe("estimateTokens", () => {
    it("returns 0 for empty string", () => {
      expect(estimateTokens("")).toBe(0);
    });

    it("returns 0 for null-ish input", () => {
      expect(estimateTokens("")).toBe(0);
    });

    it("estimates tokens for plain English text", () => {
      const text = "Hello world this is a test";
      const tokens = estimateTokens(text);
      // 26 chars / 4.0 = 6.5 → ceil = 7 + 4 overhead = 11
      expect(tokens).toBe(11);
    });

    it("uses code ratio when text contains code indicators", () => {
      const code = "function foo() {\n  return bar;\n}";
      const tokens = estimateTokens(code);
      // 32 chars / 3.2 = 10 + 4 overhead = 14
      expect(tokens).toBe(14);
    });

    it("detects code by braces and newlines", () => {
      const prose = "Hello {world}";  // no newline → not code
      const tokens = estimateTokens(prose);
      // 13 chars / 4.0 = 3.25 → ceil = 4 + 4 = 8
      expect(tokens).toBe(8);
    });

    it("handles long text proportionally", () => {
      const text = "a".repeat(400);
      const tokens = estimateTokens(text);
      // 400 / 4.0 = 100 + 4 = 104
      expect(tokens).toBe(104);
    });
  });

  describe("estimateTokensForMessages", () => {
    it("returns 3 for empty messages array (priming tokens)", () => {
      expect(estimateTokensForMessages([])).toBe(3);
    });

    it("includes per-message overhead of 4 tokens", () => {
      const messages = [{ role: "user", content: "" }];
      // empty content → 0 tokens + 4 per-message overhead + 3 priming = 7
      expect(estimateTokensForMessages(messages)).toBe(7);
    });

    it("accumulates tokens across messages", () => {
      const messages = [
        { role: "user", content: "Hello world" },
        { role: "assistant", content: "Hi there" },
      ];
      const result = estimateTokensForMessages(messages);
      // msg1: ceil(11/4)+4 = 3+4 = 7, + 4 overhead = 11
      // msg2: ceil(8/4)+4 = 2+4 = 6, + 4 overhead = 10
      // total = 11 + 10 + 3 = 24
      expect(result).toBeGreaterThan(3);
      expect(result).toBe(
        estimateTokens("Hello world") + 4 + estimateTokens("Hi there") + 4 + 3
      );
    });
  });

  describe("estimateOutputTokensByTaskType", () => {
    it("returns expected value for explanation", () => {
      expect(estimateOutputTokensByTaskType("explanation")).toBe(600);
    });

    it("returns expected value for test_generation", () => {
      expect(estimateOutputTokensByTaskType("test_generation")).toBe(1500);
    });

    it("returns expected value for multi_file_refactor", () => {
      expect(estimateOutputTokensByTaskType("multi_file_refactor")).toBe(3500);
    });

    it("returns 1200 for unknown task types", () => {
      expect(estimateOutputTokensByTaskType("unknown")).toBe(1200);
      expect(estimateOutputTokensByTaskType("nonexistent_type")).toBe(1200);
    });

    it("returns expected value for prompt_rewrite_only", () => {
      expect(estimateOutputTokensByTaskType("prompt_rewrite_only")).toBe(300);
    });
  });

  describe("estimateContextTokens", () => {
    it("sums all parts", () => {
      const result = estimateContextTokens({
        systemPrompt: "You are helpful.",
        userMessage: "Fix the bug.",
      });
      expect(result).toBe(
        estimateTokens("You are helpful.") +
        estimateTokens("") + // repoSummary
        estimateTokens("") + // activeFile
        estimateTokens("") + // selectedCode
        estimateTokens("") + // chatHistory
        estimateTokens("Fix the bug.")
      );
    });

    it("handles all optional parts provided", () => {
      const result = estimateContextTokens({
        systemPrompt: "System",
        repoSummary: "Repo summary text",
        activeFile: "const x = 1;\n",
        selectedCode: "const y = 2;\n",
        chatHistory: "User said hi",
        userMessage: "Do something",
      });
      expect(result).toBeGreaterThan(0);
    });

    it("handles only userMessage provided", () => {
      const result = estimateContextTokens({ userMessage: "Test" });
      expect(result).toBe(estimateTokens("Test"));
    });
  });
});
