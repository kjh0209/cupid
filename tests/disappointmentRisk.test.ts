import { describe, it, expect } from "vitest";
import { computeDisappointmentRisk, drsForbidsCheap } from "../src/recommender/disappointmentRisk.js";
import { isBlankSlateSession } from "../src/recommender/contextSignals.js";

describe("computeDisappointmentRisk", () => {
  describe("open-ended creation verb", () => {
    it("scores +2 for 'make me a game'", () => {
      const result = computeDisappointmentRisk({
        prompt: "make me a game",
        taskType: "creative_generation",
        difficulty: 4,
        hasCodeContext: false,
      });
      expect(result.score).toBeGreaterThanOrEqual(2);
    });

    it("scores +2 for 'build a landing page'", () => {
      const result = computeDisappointmentRisk({
        prompt: "build a landing page",
        taskType: "creative_generation",
        difficulty: 4,
        hasCodeContext: false,
      });
      expect(result.score).toBeGreaterThanOrEqual(2);
    });

    it("no creation verb bonus for specific bug fix", () => {
      const result = computeDisappointmentRisk({
        prompt: "fix the off-by-one error in the sort function",
        taskType: "local_bug_fix",
        difficulty: 2,
        hasCodeContext: true,
      });
      // Should be low DRS — specific bug fix with code context
      expect(result.score).toBeLessThanOrEqual(1);
    });
  });

  describe("quality adjectives", () => {
    it("scores +1 for 'real' without code context", () => {
      const result = computeDisappointmentRisk({
        prompt: "build a real trading dashboard",
        taskType: "creative_generation",
        difficulty: 4,
        hasCodeContext: false,
      });
      expect(result.score).toBeGreaterThanOrEqual(3); // creation verb + quality adj + visual
    });

    it("no quality adj bonus when code context is present", () => {
      const withCode = computeDisappointmentRisk({
        prompt: "make this component look polished",
        taskType: "ui_change",
        difficulty: 2,
        hasCodeContext: true,
      });
      const withoutCode = computeDisappointmentRisk({
        prompt: "make this component look polished",
        taskType: "ui_change",
        difficulty: 2,
        hasCodeContext: false,
      });
      expect(withCode.score).toBeLessThan(withoutCode.score);
    });
  });

  describe("LLM classifier signals", () => {
    it("scores +1 when LLM fell back to rules", () => {
      const noFallback = computeDisappointmentRisk({
        prompt: "explain closures in JavaScript",
        taskType: "explanation",
        difficulty: 2,
        hasCodeContext: false,
        fellBackToRules: false,
      });
      const withFallback = computeDisappointmentRisk({
        prompt: "explain closures in JavaScript",
        taskType: "explanation",
        difficulty: 2,
        hasCodeContext: false,
        fellBackToRules: true,
      });
      expect(withFallback.score).toBe(noFallback.score + 1);
    });

    it("scores +1 for ambiguous rationale", () => {
      const result = computeDisappointmentRisk({
        prompt: "optimize this",
        taskType: "performance_optimization",
        difficulty: 3,
        hasCodeContext: false,
        llmRationale: "This seems like a performance task but could be a refactor",
      });
      expect(result.score).toBeGreaterThanOrEqual(1);
      expect(result.signals.some(s => s.includes("uncertainty"))).toBe(true);
    });

    it("scores +1 for low confidence", () => {
      const lowConf = computeDisappointmentRisk({
        prompt: "make it better",
        taskType: "unknown",
        difficulty: 2,
        hasCodeContext: false,
        llmConfidence: 0.45,
      });
      expect(lowConf.signals.some(s => s.includes("confidence"))).toBe(true);
    });
  });

  describe("short prompts", () => {
    it("short creation prompt scores +3 or more", () => {
      const result = computeDisappointmentRisk({
        prompt: "make a clock",
        taskType: "creative_generation",
        difficulty: 4,
        hasCodeContext: false,
      });
      // creation verb (+2) + short (<30 chars) + creation verb (+1) + visual (+1)
      expect(result.score).toBeGreaterThanOrEqual(3);
    });
  });

  describe("score capped at 5", () => {
    it("max score is 5 even with all signals", () => {
      const result = computeDisappointmentRisk({
        prompt: "make me a cool app",
        taskType: "creative_generation",
        difficulty: 4,
        hasCodeContext: false,
        fellBackToRules: true,
        llmRationale: "unclear — could be ui_change or creative_generation",
        llmConfidence: 0.4,
      });
      expect(result.score).toBeLessThanOrEqual(5);
    });
  });
});

describe("drsForbidsCheap", () => {
  it("never forbids cheap in cost_aggressive mode", () => {
    expect(drsForbidsCheap(5, "cost_aggressive")).toBe(false);
  });

  it("always forbids cheap in max_quality mode", () => {
    expect(drsForbidsCheap(0, "max_quality")).toBe(true);
  });

  it("forbids cheap in cost_saving when DRS >= 3", () => {
    expect(drsForbidsCheap(3, "cost_saving")).toBe(true);
    expect(drsForbidsCheap(2, "cost_saving")).toBe(false);
  });

  it("forbids cheap in balanced when DRS >= 2", () => {
    expect(drsForbidsCheap(2, "balanced")).toBe(true);
    expect(drsForbidsCheap(1, "balanced")).toBe(false);
  });
});

describe("isBlankSlateSession", () => {
  it("returns true when workspace has ≤1 file and no context", () => {
    expect(isBlankSlateSession({
      workspaceFileCount: 1,
      hasSelectedCode: false,
      hasActiveFile: false,
      hasRepoSummary: false,
    })).toBe(true);
  });

  it("returns false when selected code is present", () => {
    expect(isBlankSlateSession({
      workspaceFileCount: 1,
      hasSelectedCode: true,
      hasActiveFile: false,
      hasRepoSummary: false,
    })).toBe(false);
  });

  it("returns false when workspace has many files", () => {
    expect(isBlankSlateSession({
      workspaceFileCount: 50,
      hasSelectedCode: false,
      hasActiveFile: false,
      hasRepoSummary: false,
    })).toBe(false);
  });

  it("returns true when session has 0 tasks and no context", () => {
    expect(isBlankSlateSession({
      sessionTaskCount: 0,
      hasSelectedCode: false,
      hasActiveFile: false,
      hasRepoSummary: false,
    })).toBe(true);
  });

  it("returns true when no workspace info at all (conservative)", () => {
    expect(isBlankSlateSession({
      hasSelectedCode: false,
      hasActiveFile: false,
      hasRepoSummary: false,
    })).toBe(true);
  });
});
