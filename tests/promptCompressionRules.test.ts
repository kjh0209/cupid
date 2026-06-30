import { describe, it, expect } from "vitest";
import {
  applyFillerRemoval,
  addMinimalDiffInstruction,
  addDoNotTouchInstruction,
  extractPreservedRequirements,
  applyConservativeCompression,
} from "../src/optimizer/promptCompressionRules.js";

describe("PromptCompressionRules", () => {
  describe("applyFillerRemoval", () => {
    it("removes 'can you please'", () => {
      const result = applyFillerRemoval("Can you please fix this bug?");
      expect(result.text).not.toMatch(/can you please/i);
      expect(result.text).toContain("fix this bug");
    });

    it("removes 'if possible'", () => {
      const result = applyFillerRemoval("Add tests if possible");
      expect(result.text).not.toMatch(/if possible/i);
    });

    it("removes 'i was thinking'", () => {
      const result = applyFillerRemoval("I was thinking we should add validation");
      expect(result.text).not.toMatch(/i was thinking/i);
      expect(result.text).toContain("add validation");
    });

    it("removes 'thank you'", () => {
      const result = applyFillerRemoval("Fix the login. Thank you.");
      expect(result.text).not.toMatch(/thank you/i);
    });

    it("removes 'please'", () => {
      const result = applyFillerRemoval("Please add error handling");
      expect(result.text).not.toMatch(/\bplease\b/i);
      expect(result.text).toContain("add error handling");
    });

    it("removes 'basically'", () => {
      const result = applyFillerRemoval("Basically the function should return early");
      expect(result.text).not.toMatch(/basically/i);
    });

    it("removes greeting 'hey'", () => {
      const result = applyFillerRemoval("Hey, fix the API route");
      expect(result.text).not.toMatch(/^hey/i);
      expect(result.text).toContain("fix the API route");
    });

    it("collapses double spaces", () => {
      const result = applyFillerRemoval("Fix   this   bug");
      expect(result.text).not.toContain("  ");
    });

    it("tracks applied rules", () => {
      const result = applyFillerRemoval("Can you please fix this?");
      expect(result.appliedRules.length).toBeGreaterThan(0);
    });

    it("tracks removed items", () => {
      const result = applyFillerRemoval("Hey, can you please fix this?");
      expect(result.removedItems.length).toBeGreaterThan(0);
    });

    it("applies consolidation: make sure → empty", () => {
      const result = applyFillerRemoval("Make sure to add validation");
      expect(result.text).not.toMatch(/make sure to/i);
    });

    it("returns unchanged text when no filler is present", () => {
      const result = applyFillerRemoval("Add rate limiting to the auth endpoint");
      expect(result.text).toBe("Add rate limiting to the auth endpoint");
      expect(result.removedItems).toHaveLength(0);
    });
  });

  describe("addMinimalDiffInstruction", () => {
    it("appends minimal diff instruction for editing tasks", () => {
      const result = addMinimalDiffInstruction("Fix the bug", "simple_edit");
      expect(result.applied).toBe(true);
      expect(result.text).toContain("Keep the diff minimal");
    });

    it("works for local_bug_fix", () => {
      const result = addMinimalDiffInstruction("Fix the bug", "local_bug_fix");
      expect(result.applied).toBe(true);
    });

    it("works for api_implementation", () => {
      const result = addMinimalDiffInstruction("Add endpoint", "api_implementation");
      expect(result.applied).toBe(true);
    });

    it("does not apply for non-editing tasks", () => {
      const result = addMinimalDiffInstruction("Explain this", "explanation");
      expect(result.applied).toBe(false);
      expect(result.text).toBe("Explain this");
    });

    it("does not apply if text already mentions diff", () => {
      const result = addMinimalDiffInstruction("Fix the bug, keep the diff small", "simple_edit");
      expect(result.applied).toBe(false);
    });

    it("does not apply if text already mentions minimal", () => {
      const result = addMinimalDiffInstruction("Make minimal changes to fix", "simple_edit");
      expect(result.applied).toBe(false);
    });
  });

  describe("addDoNotTouchInstruction", () => {
    it("appends do-not-touch for simple_edit", () => {
      const result = addDoNotTouchInstruction("Fix the button", "simple_edit");
      expect(result.applied).toBe(true);
      expect(result.text).toContain("Do not modify unrelated files");
    });

    it("does not apply for multi_file_refactor", () => {
      const result = addDoNotTouchInstruction("Refactor the module", "multi_file_refactor");
      expect(result.applied).toBe(false);
    });

    it("does not apply if already mentions unrelated", () => {
      const result = addDoNotTouchInstruction("Fix but do not touch unrelated code", "simple_edit");
      expect(result.applied).toBe(false);
    });
  });

  describe("extractPreservedRequirements", () => {
    it("extracts file references", () => {
      const result = extractPreservedRequirements(
        "Fix the bug in authMiddleware.ts and update schema.json",
        ""
      );
      expect(result).toContain("authMiddleware.ts");
      expect(result).toContain("schema.json");
    });

    it("extracts function names with known suffixes", () => {
      const result = extractPreservedRequirements(
        "Update the getUserHandler and authService",
        ""
      );
      expect(result).toContain("getUserHandler");
      expect(result).toContain("authService");
    });

    it("extracts library names", () => {
      const result = extractPreservedRequirements(
        "Use zod for validation and drizzle for DB",
        ""
      );
      expect(result).toContain("zod");
      expect(result).toContain("drizzle");
    });

    it("extracts quoted strings", () => {
      const result = extractPreservedRequirements(
        'Return error "User not found" when missing',
        ""
      );
      expect(result).toContain('"User not found"');
    });

    it("deduplicates results", () => {
      const result = extractPreservedRequirements(
        "Fix authService and update authService",
        ""
      );
      const count = result.filter((r) => r === "authService").length;
      expect(count).toBe(1);
    });
  });

  describe("applyConservativeCompression", () => {
    it("high sensitivity only removes basic filler", () => {
      const result = applyConservativeCompression(
        "Hey, please fix the JWT token validation in auth.ts",
        "high"
      );
      expect(result.text).toContain("JWT token validation");
      expect(result.text).toContain("auth.ts");
      expect(result.appliedRules).toContain("no-overcompress-security");
    });

    it("medium sensitivity applies full filler removal", () => {
      const result = applyConservativeCompression(
        "Can you please fix this bug?",
        "medium"
      );
      expect(result.text).not.toMatch(/can you please/i);
    });

    it("low sensitivity applies full compression", () => {
      const result = applyConservativeCompression(
        "Can you please fix this bug?",
        "low"
      );
      expect(result.text).not.toMatch(/can you please/i);
    });
  });
});
