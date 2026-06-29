/**
 * Scoring pipeline integration tests — tests the DRS + scoring interaction.
 * No server required; tests purely the module-level scoring logic.
 */
import { describe, it, expect } from "vitest";
import { scoreModel } from "../src/recommender/scoring.js";
import type { ModelRecord, TaskClassification } from "../src/types.js";

function makeModel(overrides: Partial<ModelRecord>): ModelRecord {
  return {
    id: "test/cheap-model",
    displayName: "Cheap Model",
    provider: "test",
    tier: "cheap",
    contextWindow: 16000,
    inputPricePerMillion: 0.1,
    outputPricePerMillion: 0.5,
    cachedInputPricePerMillion: null,
    cacheWritePricePerMillion: null,
    maxOutputTokens: 4096,
    modality: "text",
    toolCallingSupport: true,
    visionSupport: false,
    codingScore: 0.45,
    generalScore: 0.40,
    latencyScore: 0.7,
    outputSpeed: null,
    sourceConfidence: "benchmark",
    sourceUrl: "https://example.com",
    lastUpdated: "2026-01-01",
    deprecated: false,
    ...overrides,
  };
}

function makeClassification(overrides: Partial<TaskClassification>): TaskClassification {
  return {
    taskType: "explanation",
    difficulty: 2,
    riskLevel: 1,
    contextNeed: "small",
    expectedChangeScope: "none",
    languageOrFramework: [],
    needsToolCalling: false,
    needsLongContext: false,
    privacySensitive: false,
    compressionSensitivity: "low",
    ...overrides,
  };
}

const cheapModel = makeModel({ tier: "cheap", id: "openai/gpt-4o-mini", inputPricePerMillion: 0.15, outputPricePerMillion: 0.6 });
const midModel = makeModel({ tier: "mid", id: "openai/gpt-4o", codingScore: 0.60, inputPricePerMillion: 2.5, outputPricePerMillion: 10 });
const strongModel = makeModel({ tier: "strong", id: "anthropic/claude-sonnet-4-5", codingScore: 0.72, inputPricePerMillion: 3, outputPricePerMillion: 15 });

const ALL_COSTS = [0.001, 0.015, 0.05]; // cheap, mid, strong

// ── DRS veto tests ────────────────────────────────────────────────────────
describe("DRS veto in scoring pipeline", () => {
  it("DRS >= 3 + cost_saving: cheap model gets -10 penalty", () => {
    const classification = makeClassification({
      taskType: "creative_generation",
      riskLevel: 1,
      difficulty: 4,
    });
    const cheapScore = scoreModel(
      cheapModel, classification, "cost_saving",
      ALL_COSTS, "make a game", undefined, undefined, [],
      3 // DRS = 3
    );
    expect(cheapScore.score).toBeLessThan(-5); // -10 penalty applied
    expect(cheapScore.reasons.some(r => r.includes("DRS"))).toBe(true);
  });

  it("DRS = 2 + cost_saving: cheap model is NOT penalized (below threshold)", () => {
    const classification = makeClassification({
      taskType: "creative_generation",
      riskLevel: 1,
    });
    const cheapScore = scoreModel(
      cheapModel, classification, "cost_saving",
      ALL_COSTS, "make a simple app", undefined, undefined, [],
      2 // DRS = 2, threshold is 3 for cost_saving
    );
    expect(cheapScore.score).toBeGreaterThan(-1); // no DRS penalty
    expect(cheapScore.reasons.some(r => r.includes("DRS"))).toBe(false);
  });

  it("DRS >= 2 + balanced: cheap model gets -10 penalty", () => {
    const classification = makeClassification({
      taskType: "creative_generation",
      riskLevel: 1,
    });
    const cheapScore = scoreModel(
      cheapModel, classification, "balanced",
      ALL_COSTS, "make something cool", undefined, undefined, [],
      2 // DRS = 2, threshold is 2 for balanced
    );
    expect(cheapScore.score).toBeLessThan(-5);
    expect(cheapScore.reasons.some(r => r.includes("DRS"))).toBe(true);
  });

  it("cost_aggressive: DRS is never applied", () => {
    const classification = makeClassification({
      taskType: "creative_generation",
      riskLevel: 1,
    });
    const cheapScore = scoreModel(
      cheapModel, classification, "cost_aggressive",
      ALL_COSTS, "make an app", undefined, undefined, [],
      5 // DRS = 5 (max), but cost_aggressive ignores DRS
    );
    // Should NOT have -10 penalty (no DRS veto for cost_aggressive)
    // Score should be normal (positive range)
    expect(cheapScore.reasons.some(r => r.includes("DRS"))).toBe(false);
  });

  it("max_quality: DRS always vetoes cheap (even at DRS=0)", () => {
    const classification = makeClassification({
      taskType: "explanation",
      riskLevel: 1,
    });
    const cheapScore = scoreModel(
      cheapModel, classification, "max_quality",
      ALL_COSTS, "explain closures", undefined, undefined, [],
      0 // DRS = 0
    );
    expect(cheapScore.score).toBeLessThan(-5);
    expect(cheapScore.reasons.some(r => r.includes("DRS"))).toBe(true);
  });

  it("mid and strong models are NOT penalized by DRS", () => {
    const classification = makeClassification({
      taskType: "creative_generation",
      riskLevel: 1,
    });
    const midScore = scoreModel(
      midModel, classification, "cost_saving",
      ALL_COSTS, "make a game", undefined, undefined, [],
      5 // high DRS, but mid is not cheap
    );
    const strongScore = scoreModel(
      strongModel, classification, "cost_saving",
      ALL_COSTS, "make a game", undefined, undefined, [],
      5
    );
    expect(midScore.reasons.some(r => r.includes("DRS"))).toBe(false);
    expect(strongScore.reasons.some(r => r.includes("DRS"))).toBe(false);
  });
});

// ── Cost_aggressive mode: always prefers cheapest ─────────────────────────
describe("cost_aggressive mode weight profile", () => {
  it("cost_aggressive heavily favors cheap model for simple tasks", () => {
    const classification = makeClassification({
      taskType: "explanation",
      riskLevel: 1,
    });
    const cheapScore = scoreModel(
      cheapModel, classification, "cost_aggressive",
      ALL_COSTS, "explain closures"
    );
    const strongScore = scoreModel(
      strongModel, classification, "cost_aggressive",
      ALL_COSTS, "explain closures"
    );
    // Cheap should score higher due to cost weight dominance (beta=0.50)
    expect(cheapScore.score).toBeGreaterThan(strongScore.score);
  });
});

// ── Score breakdown completeness ──────────────────────────────────────────
describe("Score breakdown includes DRS field", () => {
  it("breakdown.drsPenalty is 0 when DRS doesn't veto", () => {
    const classification = makeClassification({ taskType: "explanation" });
    const result = scoreModel(
      cheapModel, classification, "cost_saving",
      ALL_COSTS, "explain closures", undefined, undefined, [],
      0
    );
    expect(result.breakdown.drsPenalty).toBe(0);
  });

  it("breakdown.drsPenalty is -10 when DRS vetoes", () => {
    const classification = makeClassification({ taskType: "creative_generation" });
    const result = scoreModel(
      cheapModel, classification, "cost_saving",
      ALL_COSTS, "make a game", undefined, undefined, [],
      4 // DRS >= 3 → veto in cost_saving
    );
    expect(result.breakdown.drsPenalty).toBe(-10);
  });
});

// ── Affinity floor penalty test ───────────────────────────────────────────
describe("Affinity floor penalty for high-risk tasks", () => {
  it("security task: cheap model with low affinity gets large penalty", () => {
    const classification = makeClassification({
      taskType: "security_sensitive_change",
      riskLevel: 5,
    });
    const cheapResult = scoreModel(
      cheapModel, classification, "balanced",
      ALL_COSTS, "implement JWT rotation"
    );
    const strongResult = scoreModel(
      strongModel, classification, "balanced",
      ALL_COSTS, "implement JWT rotation"
    );
    // Strong should score dramatically higher for security tasks
    expect(strongResult.score).toBeGreaterThan(cheapResult.score);
  });
});
