import { describe, it, expect } from "vitest";
import {
  classifyRepoMemory,
  buildRepoContextSummary,
} from "../src/context/repoMemoryPolicy.js";
import type { RepoMemoryItem } from "../src/context/repoMemoryPolicy.js";

describe("RepoMemoryPolicy", () => {
  describe("classifyRepoMemory", () => {
    it("separates stable and volatile items", () => {
      const items: RepoMemoryItem[] = [
        { key: "README", content: "Project readme", stable: true, lastModified: "2025-01-01" },
        { key: "tsconfig", content: "TS config", stable: true, lastModified: "2025-01-01" },
        { key: "open-pr", content: "PR #42 description", stable: false, lastModified: "2025-06-01" },
      ];
      const result = classifyRepoMemory(items);
      expect(result.stable).toHaveLength(2);
      expect(result.volatile).toHaveLength(1);
      expect(result.stable[0]!.key).toBe("README");
      expect(result.volatile[0]!.key).toBe("open-pr");
    });

    it("handles all stable items", () => {
      const items: RepoMemoryItem[] = [
        { key: "a", content: "A", stable: true, lastModified: "2025-01-01" },
        { key: "b", content: "B", stable: true, lastModified: "2025-01-01" },
      ];
      const result = classifyRepoMemory(items);
      expect(result.stable).toHaveLength(2);
      expect(result.volatile).toHaveLength(0);
    });

    it("handles all volatile items", () => {
      const items: RepoMemoryItem[] = [
        { key: "a", content: "A", stable: false, lastModified: "2025-01-01" },
      ];
      const result = classifyRepoMemory(items);
      expect(result.stable).toHaveLength(0);
      expect(result.volatile).toHaveLength(1);
    });

    it("handles empty array", () => {
      const result = classifyRepoMemory([]);
      expect(result.stable).toHaveLength(0);
      expect(result.volatile).toHaveLength(0);
    });
  });

  describe("buildRepoContextSummary", () => {
    it("builds markdown-style summary from stable items", () => {
      const items: RepoMemoryItem[] = [
        { key: "README", content: "This is the readme", stable: true, lastModified: "2025-01-01" },
        { key: "tsconfig", content: "TS settings", stable: true, lastModified: "2025-01-01" },
      ];
      const result = buildRepoContextSummary(items);
      expect(result).toContain("## README");
      expect(result).toContain("This is the readme");
      expect(result).toContain("## tsconfig");
      expect(result).toContain("TS settings");
    });

    it("respects maxTokens limit", () => {
      const longContent = "x".repeat(10000);
      const items: RepoMemoryItem[] = [
        { key: "big", content: longContent, stable: true, lastModified: "2025-01-01" },
        { key: "small", content: "short", stable: true, lastModified: "2025-01-01" },
      ];
      // maxTokens = 500 → maxChars = 2000
      const result = buildRepoContextSummary(items, 500);
      expect(result).not.toContain("## small");
    });

    it("includes items until token budget is hit", () => {
      const items: RepoMemoryItem[] = [
        { key: "first", content: "A".repeat(100), stable: true, lastModified: "2025-01-01" },
        { key: "second", content: "B".repeat(100), stable: true, lastModified: "2025-01-01" },
        { key: "third", content: "C".repeat(100), stable: true, lastModified: "2025-01-01" },
      ];
      const result = buildRepoContextSummary(items, 2000);
      expect(result).toContain("## first");
      expect(result).toContain("## second");
      expect(result).toContain("## third");
    });

    it("returns empty string for empty items", () => {
      const result = buildRepoContextSummary([]);
      expect(result).toBe("");
    });
  });
});
