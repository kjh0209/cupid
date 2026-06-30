import { describe, it, expect } from "vitest";
import {
  summarizeChatHistory,
  createRepoPointer,
} from "../src/context/contextCompression.js";

describe("ContextCompression", () => {
  describe("summarizeChatHistory", () => {
    it("returns empty string for empty history", () => {
      expect(summarizeChatHistory([])).toBe("");
    });

    it("returns all messages when <= maxItems", () => {
      const history = [
        { role: "user", content: "Fix the bug" },
        { role: "assistant", content: "Done" },
      ];
      const result = summarizeChatHistory(history);
      expect(result).toContain("[user]: Fix the bug");
      expect(result).toContain("[assistant]: Done");
    });

    it("summarizes older messages and shows recent ones", () => {
      const history = [
        { role: "user", content: "First message about auth" },
        { role: "assistant", content: "I'll fix the JWT auth" },
        { role: "user", content: "Now fix the test" },
        { role: "assistant", content: "Tests are passing" },
        { role: "user", content: "Deploy it" },
      ];
      const result = summarizeChatHistory(history, 3);
      expect(result).toContain("Session summary: 2 earlier messages");
      expect(result).toContain("auth");
      expect(result).toContain("[user]: Deploy it");
    });

    it("truncates message content to 200 chars when within maxItems", () => {
      const longContent = "a".repeat(300);
      const history = [{ role: "user", content: longContent }];
      const result = summarizeChatHistory(history);
      expect(result.length).toBeLessThan(300);
    });

    it("extracts auth topic", () => {
      const history = [
        { role: "user", content: "Fix the JWT session handling" },
        { role: "assistant", content: "Updated auth" },
        { role: "user", content: "Add more tests" },
        { role: "assistant", content: "Done" },
        { role: "user", content: "Ship it" },
      ];
      const result = summarizeChatHistory(history, 3);
      expect(result).toContain("auth");
    });

    it("extracts testing topic", () => {
      const history = [
        { role: "user", content: "Run vitest and fix failures" },
        { role: "assistant", content: "Fixed" },
        { role: "user", content: "Add spec files" },
        { role: "assistant", content: "Done" },
        { role: "user", content: "Ship it" },
      ];
      const result = summarizeChatHistory(history, 3);
      expect(result).toContain("testing");
    });

    it("extracts API routes topic", () => {
      const history = [
        { role: "user", content: "Add a new API endpoint for users" },
        { role: "assistant", content: "Created /api/users route" },
        { role: "user", content: "Also add validation" },
        { role: "assistant", content: "Added" },
        { role: "user", content: "LGTM" },
      ];
      const result = summarizeChatHistory(history, 3);
      expect(result).toContain("API routes");
    });

    it("falls back to 'general coding' when no topics match", () => {
      const history = [
        { role: "user", content: "do something" },
        { role: "assistant", content: "done" },
        { role: "user", content: "more" },
        { role: "assistant", content: "ok" },
        { role: "user", content: "great" },
      ];
      const result = summarizeChatHistory(history, 3);
      expect(result).toContain("general coding");
    });
  });

  describe("createRepoPointer", () => {
    it("creates a summary from repo text", () => {
      const summary = "This is a Next.js project\nwith TypeScript\nand Tailwind";
      const result = createRepoPointer(summary);
      expect(result).toContain("Repo context");
      expect(result).toContain("3 lines summary");
      expect(result).toContain("This is a Next.js project");
    });

    it("limits to first 10 lines", () => {
      const lines = Array.from({ length: 20 }, (_, i) => `Line ${i + 1}`).join("\n");
      const result = createRepoPointer(lines);
      expect(result).toContain("10 lines summary");
    });

    it("handles empty summary", () => {
      const result = createRepoPointer("");
      expect(result).toContain("Repo context");
    });
  });
});
