import { describe, it, expect } from "vitest";
import {
  computeDisappointmentRisk,
  drsForbidsCheap,
  type DrsInput,
} from "../src/recommender/disappointmentRisk.js";

function makeDrsInput(overrides: Partial<DrsInput>): DrsInput {
  return {
    prompt: "explain this function",
    taskType: "explanation",
    hasCodeContext: false,
    ...overrides,
  };
}

describe("DisappointmentRiskScore", () => {
  // ── Signal 1: Open-ended creation verb ──────────────────────
  describe("Signal 1: creation verb (+2)", () => {
    it("gives +2 for 'make a X'", () => {
      const { score, signals } = computeDisappointmentRisk(makeDrsInput({
        prompt: "make a breakout game",
        taskType: "creative_generation",
        hasCodeContext: false,
      }));
      expect(score).toBeGreaterThanOrEqual(2);
      expect(signals.some(s => s.includes("creation verb"))).toBe(true);
    });

    it("gives +2 for 'build an app'", () => {
      const { score } = computeDisappointmentRisk(makeDrsInput({
        prompt: "build an app",
        taskType: "creative_generation",
        hasCodeContext: false,
      }));
      expect(score).toBeGreaterThanOrEqual(2);
    });

    it("gives +2 for 'create a landing page'", () => {
      const { score } = computeDisappointmentRisk(makeDrsInput({
        prompt: "create a landing page for my startup",
        taskType: "creative_generation",
        hasCodeContext: false,
      }));
      expect(score).toBeGreaterThanOrEqual(2);
    });

    it("gives +2 for 'build me a calculator'", () => {
      const { score } = computeDisappointmentRisk(makeDrsInput({
        prompt: "build me a calculator",
        taskType: "creative_generation",
        hasCodeContext: false,
      }));
      expect(score).toBeGreaterThanOrEqual(2);
    });

    it("does NOT give creation verb bonus for explanation", () => {
      const { score } = computeDisappointmentRisk(makeDrsInput({
        prompt: "what is a promise in javascript",
        taskType: "explanation",
        hasCodeContext: false,
      }));
      // No creation verb, no visual task
      expect(score).toBe(0);
    });
  });

  // ── Signal 2: Quality adjectives ────────────────────────────
  describe("Signal 2: quality adjective + no code context (+1)", () => {
    it("gives +1 for 'polished' without code context", () => {
      const { score, signals } = computeDisappointmentRisk(makeDrsInput({
        prompt: "make a polished todo app",
        taskType: "creative_generation",
        hasCodeContext: false,
      }));
      expect(signals.some(s => s.includes("quality adjective"))).toBe(true);
      // creation verb +2, quality adj +1 = at least 3
      expect(score).toBeGreaterThanOrEqual(3);
    });

    it("gives +1 for 'cool' without code context", () => {
      const { score } = computeDisappointmentRisk(makeDrsInput({
        prompt: "make something cool",
        taskType: "creative_generation",
        hasCodeContext: false,
      }));
      expect(score).toBeGreaterThanOrEqual(1);
    });

    it("does NOT give quality adj bonus when code context exists", () => {
      const { signals } = computeDisappointmentRisk(makeDrsInput({
        prompt: "make this polished",
        taskType: "ui_change",
        hasCodeContext: true, // has code
      }));
      expect(signals.some(s => s.includes("quality adjective"))).toBe(false);
    });
  });

  // ── Signal 3: Short prompt + creation verb ───────────────────
  describe("Signal 3: short prompt (<30 chars) + creation verb (+1)", () => {
    it("gives +1 for very short creation prompt", () => {
      const shortPrompt = "make a clock"; // 12 chars
      expect(shortPrompt.length).toBeLessThan(30);
      const { signals } = computeDisappointmentRisk(makeDrsInput({
        prompt: shortPrompt,
        taskType: "creative_generation",
        hasCodeContext: false,
      }));
      expect(signals.some(s => s.includes("short prompt"))).toBe(true);
    });

    it("does NOT give short prompt bonus for longer prompts", () => {
      const longPrompt = "build a snake game with collision detection and score tracking"; // > 30 chars
      expect(longPrompt.length).toBeGreaterThanOrEqual(30);
      const { signals } = computeDisappointmentRisk(makeDrsInput({
        prompt: longPrompt,
        taskType: "creative_generation",
        hasCodeContext: false,
      }));
      expect(signals.some(s => s.includes("short prompt"))).toBe(false);
    });
  });

  // ── Signal 4: LLM fell back to rules ────────────────────────
  describe("Signal 4: LLM fell back to rules (+1)", () => {
    it("gives +1 when fellBackToRules is true", () => {
      const { score, signals } = computeDisappointmentRisk(makeDrsInput({
        prompt: "do the thing",
        taskType: "unknown",
        hasCodeContext: false,
        fellBackToRules: true,
      }));
      expect(signals.some(s => s.includes("fell back to rules"))).toBe(true);
      expect(score).toBeGreaterThanOrEqual(1);
    });

    it("does NOT give bonus when fellBackToRules is false", () => {
      const { signals } = computeDisappointmentRisk(makeDrsInput({
        prompt: "explain closures",
        taskType: "explanation",
        hasCodeContext: false,
        fellBackToRules: false,
      }));
      expect(signals.some(s => s.includes("fell back"))).toBe(false);
    });
  });

  // ── Signal 5: Ambiguous rationale ────────────────────────────
  describe("Signal 5: ambiguous LLM rationale (+1)", () => {
    it("gives +1 for 'might be' in rationale", () => {
      const { signals } = computeDisappointmentRisk(makeDrsInput({
        prompt: "fix the thing",
        taskType: "unknown",
        hasCodeContext: false,
        llmRationale: "This might be a bug fix or could be a refactor",
      }));
      expect(signals.some(s => s.includes("ambiguous"))).toBe(true);
    });

    it("gives +1 for 'ambiguous' in rationale", () => {
      const { signals } = computeDisappointmentRisk(makeDrsInput({
        prompt: "help with code",
        taskType: "unknown",
        hasCodeContext: false,
        llmRationale: "The request is ambiguous — unclear whether this is a bug fix or explanation",
      }));
      expect(signals.some(s => s.includes("ambiguous"))).toBe(true);
    });

    it("does NOT give bonus for clear rationale", () => {
      const { signals } = computeDisappointmentRisk(makeDrsInput({
        prompt: "add JWT validation",
        taskType: "security_sensitive_change",
        hasCodeContext: false,
        llmRationale: "User wants to add JWT token validation to secure the API endpoint",
      }));
      expect(signals.some(s => s.includes("ambiguous"))).toBe(false);
    });
  });

  // ── Signal 6: No code context + visual task ──────────────────
  describe("Signal 6: visual task + no code context (+1)", () => {
    it("gives +1 for creative_generation without code context", () => {
      const { signals } = computeDisappointmentRisk(makeDrsInput({
        prompt: "make a game",
        taskType: "creative_generation",
        hasCodeContext: false,
      }));
      expect(signals.some(s => s.includes("visual task"))).toBe(true);
    });

    it("gives +1 for ui_change without code context", () => {
      const { signals } = computeDisappointmentRisk(makeDrsInput({
        prompt: "make it look good",
        taskType: "ui_change",
        hasCodeContext: false,
      }));
      expect(signals.some(s => s.includes("visual task"))).toBe(true);
    });

    it("does NOT give bonus for visual task WITH code context", () => {
      const { signals } = computeDisappointmentRisk(makeDrsInput({
        prompt: "make this button bigger",
        taskType: "ui_change",
        hasCodeContext: true,
      }));
      expect(signals.some(s => s.includes("visual task"))).toBe(false);
    });

    it("does NOT give bonus for non-visual task without code context", () => {
      const { signals } = computeDisappointmentRisk(makeDrsInput({
        prompt: "explain async/await",
        taskType: "explanation",
        hasCodeContext: false,
      }));
      expect(signals.some(s => s.includes("visual task"))).toBe(false);
    });
  });

  // ── Signal 7: Blank slate ────────────────────────────────────
  describe("Signal 7: blank slate + creation verb (+1)", () => {
    it("gives +1 for blank slate + creation prompt", () => {
      const { signals } = computeDisappointmentRisk(makeDrsInput({
        prompt: "build a game for me",
        taskType: "creative_generation",
        hasCodeContext: false,
        isBlankSlate: true,
      }));
      expect(signals.some(s => s.includes("blank slate"))).toBe(true);
    });

    it("does NOT give bonus for blank slate without creation verb", () => {
      const { signals } = computeDisappointmentRisk(makeDrsInput({
        prompt: "explain closures",
        taskType: "explanation",
        hasCodeContext: false,
        isBlankSlate: true,
      }));
      expect(signals.some(s => s.includes("blank slate"))).toBe(false);
    });
  });

  // ── Signal 8: Low LLM confidence ────────────────────────────
  describe("Signal 8: low LLM confidence (<0.6) (+1)", () => {
    it("gives +1 when confidence is 0.4", () => {
      const { signals } = computeDisappointmentRisk(makeDrsInput({
        prompt: "fix the thing",
        taskType: "unknown",
        hasCodeContext: false,
        llmConfidence: 0.4,
      }));
      expect(signals.some(s => s.includes("confidence"))).toBe(true);
    });

    it("does NOT give bonus when confidence is 0.8", () => {
      const { signals } = computeDisappointmentRisk(makeDrsInput({
        prompt: "implement JWT auth",
        taskType: "security_sensitive_change",
        hasCodeContext: false,
        llmConfidence: 0.8,
      }));
      expect(signals.some(s => s.includes("confidence"))).toBe(false);
    });

    it("does NOT give bonus when confidence is exactly 0.6", () => {
      const { signals } = computeDisappointmentRisk(makeDrsInput({
        prompt: "some task",
        taskType: "unknown",
        hasCodeContext: false,
        llmConfidence: 0.6,
      }));
      expect(signals.some(s => s.includes("confidence"))).toBe(false);
    });
  });

  // ── Combined scoring ─────────────────────────────────────────
  describe("Combined DRS scenarios", () => {
    it("'build me an app' without context scores 4+", () => {
      const { score } = computeDisappointmentRisk(makeDrsInput({
        prompt: "build me an app",
        taskType: "creative_generation",
        hasCodeContext: false,
        isBlankSlate: true,
      }));
      // creation (+2) + visual (+1) + blank slate (+1) = 4
      expect(score).toBeGreaterThanOrEqual(4);
    });

    it("max score is capped at 5", () => {
      const { score } = computeDisappointmentRisk(makeDrsInput({
        prompt: "make a cool app", // creation (+2), quality (+1), visual (+1)
        taskType: "creative_generation",
        hasCodeContext: false,
        isBlankSlate: true,    // +1
        fellBackToRules: true, // +1
        llmConfidence: 0.3,   // +1
        llmRationale: "ambiguous, might be a game or web app", // +1
      }));
      expect(score).toBeLessThanOrEqual(5);
    });

    it("explanation with code context has DRS 0", () => {
      const { score } = computeDisappointmentRisk(makeDrsInput({
        prompt: "explain what this function does",
        taskType: "explanation",
        hasCodeContext: true,
        fellBackToRules: false,
        llmConfidence: 0.9,
      }));
      expect(score).toBe(0);
    });

    it("security task without creation verb has DRS 0-1", () => {
      const { score } = computeDisappointmentRisk(makeDrsInput({
        prompt: "add JWT validation to the auth middleware",
        taskType: "security_sensitive_change",
        hasCodeContext: true,
        fellBackToRules: false,
        llmConfidence: 0.95,
      }));
      expect(score).toBeLessThanOrEqual(1);
    });
  });
});

// ── drsForbidsCheap policy tests ─────────────────────────────
describe("drsForbidsCheap", () => {
  it("cost_aggressive: never forbids cheap regardless of DRS", () => {
    expect(drsForbidsCheap(5, "cost_aggressive")).toBe(false);
    expect(drsForbidsCheap(4, "cost_aggressive")).toBe(false);
    expect(drsForbidsCheap(3, "cost_aggressive")).toBe(false);
  });

  it("cost_saving: forbids cheap at DRS >= 3", () => {
    expect(drsForbidsCheap(3, "cost_saving")).toBe(true);
    expect(drsForbidsCheap(4, "cost_saving")).toBe(true);
    expect(drsForbidsCheap(5, "cost_saving")).toBe(true);
    expect(drsForbidsCheap(2, "cost_saving")).toBe(false);
    expect(drsForbidsCheap(1, "cost_saving")).toBe(false);
    expect(drsForbidsCheap(0, "cost_saving")).toBe(false);
  });

  it("balanced: forbids cheap at DRS >= 2", () => {
    expect(drsForbidsCheap(2, "balanced")).toBe(true);
    expect(drsForbidsCheap(3, "balanced")).toBe(true);
    expect(drsForbidsCheap(1, "balanced")).toBe(false);
    expect(drsForbidsCheap(0, "balanced")).toBe(false);
  });

  it("max_quality: always forbids cheap", () => {
    expect(drsForbidsCheap(0, "max_quality")).toBe(true);
    expect(drsForbidsCheap(1, "max_quality")).toBe(true);
    expect(drsForbidsCheap(5, "max_quality")).toBe(true);
  });
});
