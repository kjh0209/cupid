/**
 * Advanced riskPolicy tests — Round 3 improvements.
 * Tests the strengthened tier enforcement and enforceMinDifficulty.
 */
import { describe, it, expect } from "vitest";
import {
  getTierPolicy,
  isTierAllowed,
  enforceMinDifficulty,
} from "../src/recommender/riskPolicy.js";
import type { TaskClassification } from "../src/types.js";

function makeClassification(overrides: Partial<TaskClassification>): TaskClassification {
  return {
    taskType: "unknown",
    difficulty: 2,
    riskLevel: 2,
    contextNeed: "medium",
    expectedChangeScope: "single_file",
    languageOrFramework: [],
    needsToolCalling: false,
    needsLongContext: false,
    privacySensitive: false,
    compressionSensitivity: "low",
    ...overrides,
  };
}

// ── Security: strong tier required (Round 3 tightening) ───────────────────
describe("Security: STRONG tier required (Round 3)", () => {
  it("security_sensitive_change blocks cheap AND mid", () => {
    const classification = makeClassification({
      taskType: "security_sensitive_change",
      riskLevel: 5,
    });
    const policy = getTierPolicy(classification, "balanced");
    expect(isTierAllowed("cheap", policy)).toBe(false);
    expect(isTierAllowed("mid", policy)).toBe(false);
    expect(isTierAllowed("strong", policy)).toBe(true);
  });

  it("security_sensitive_change in cost_saving mode still requires strong", () => {
    const classification = makeClassification({
      taskType: "security_sensitive_change",
      riskLevel: 4,
    });
    const policy = getTierPolicy(classification, "cost_saving");
    expect(isTierAllowed("cheap", policy)).toBe(false);
    expect(isTierAllowed("mid", policy)).toBe(false);
    expect(isTierAllowed("strong", policy)).toBe(true);
  });

  it("riskLevel 5 blocks cheap and mid", () => {
    const classification = makeClassification({ riskLevel: 5, taskType: "unknown" });
    const policy = getTierPolicy(classification, "cost_saving");
    expect(isTierAllowed("cheap", policy)).toBe(false);
    expect(isTierAllowed("mid", policy)).toBe(false);
  });
});

// ── Database: strong tier required (Round 3 tightening) ──────────────────
describe("Database: STRONG tier required (Round 3)", () => {
  it("database_schema_change blocks cheap AND mid", () => {
    const classification = makeClassification({
      taskType: "database_schema_change",
      riskLevel: 4,
    });
    const policy = getTierPolicy(classification, "cost_saving");
    expect(isTierAllowed("cheap", policy)).toBe(false);
    expect(isTierAllowed("mid", policy)).toBe(false);
    expect(isTierAllowed("strong", policy)).toBe(true);
  });

  it("database_schema_change in balanced mode requires strong", () => {
    const classification = makeClassification({
      taskType: "database_schema_change",
      riskLevel: 4,
    });
    const policy = getTierPolicy(classification, "balanced");
    expect(isTierAllowed("mid", policy)).toBe(false);
    expect(isTierAllowed("strong", policy)).toBe(true);
  });
});

// ── RiskLevel 4: strong tier required ────────────────────────────────────
describe("RiskLevel 4: strong tier required", () => {
  it("riskLevel 4 blocks cheap and mid in cost_saving mode", () => {
    const classification = makeClassification({ riskLevel: 4, taskType: "local_bug_fix" });
    const policy = getTierPolicy(classification, "cost_saving");
    expect(isTierAllowed("cheap", policy)).toBe(false);
    expect(isTierAllowed("mid", policy)).toBe(false);
    expect(isTierAllowed("strong", policy)).toBe(true);
  });

  it("riskLevel 4 blocks cheap and mid in balanced mode", () => {
    const classification = makeClassification({ riskLevel: 4, taskType: "performance_optimization" });
    const policy = getTierPolicy(classification, "balanced");
    expect(isTierAllowed("cheap", policy)).toBe(false);
    expect(isTierAllowed("mid", policy)).toBe(false);
    expect(isTierAllowed("strong", policy)).toBe(true);
  });
});

// ── Architecture: strong preferred in balanced/max_quality ────────────────
describe("Architecture design: strong preferred", () => {
  it("architecture_design in balanced → strong required", () => {
    const classification = makeClassification({
      taskType: "architecture_design",
      riskLevel: 3,
      difficulty: 4,
    });
    const policy = getTierPolicy(classification, "balanced");
    expect(isTierAllowed("strong", policy)).toBe(true);
    expect(isTierAllowed("cheap", policy)).toBe(false);
  });

  it("architecture_design in cost_saving → mid or strong", () => {
    const classification = makeClassification({
      taskType: "architecture_design",
      riskLevel: 3,
      difficulty: 4,
    });
    const policy = getTierPolicy(classification, "cost_saving");
    expect(isTierAllowed("mid", policy)).toBe(true);
    expect(isTierAllowed("strong", policy)).toBe(true);
    expect(isTierAllowed("cheap", policy)).toBe(false);
  });
});

// ── Creative generation: mid minimum ─────────────────────────────────────
describe("Creative generation: mid minimum tier", () => {
  it("creative_generation blocks cheap in cost_saving mode", () => {
    const classification = makeClassification({
      taskType: "creative_generation",
      riskLevel: 1,
      difficulty: 4,
    });
    const policy = getTierPolicy(classification, "cost_saving");
    expect(isTierAllowed("cheap", policy)).toBe(false);
    expect(isTierAllowed("mid", policy)).toBe(true);
  });

  it("creative_generation requires strong in balanced mode", () => {
    const classification = makeClassification({
      taskType: "creative_generation",
      riskLevel: 1,
      difficulty: 4,
    });
    const policy = getTierPolicy(classification, "balanced");
    expect(isTierAllowed("cheap", policy)).toBe(false);
    expect(isTierAllowed("strong", policy)).toBe(true);
  });
});

// ── Low-risk tasks: cheap OK ──────────────────────────────────────────────
describe("Low-risk tasks: cheap tier allowed", () => {
  const cheapOkCases: Array<{ taskType: Parameters<typeof makeClassification>[0]["taskType"]; mode: string }> = [
    { taskType: "explanation", mode: "cost_saving" },
    { taskType: "simple_edit", mode: "cost_saving" },
    { taskType: "documentation_write", mode: "cost_saving" },
    { taskType: "prompt_rewrite_only", mode: "cost_saving" },
    { taskType: "test_generation", mode: "cost_saving" },
    { taskType: "code_review", mode: "cost_saving" },
    { taskType: "ui_change", mode: "cost_saving" },
  ];

  for (const { taskType, mode } of cheapOkCases) {
    it(`cheap is allowed for ${taskType} in ${mode} mode`, () => {
      const classification = makeClassification({ taskType, riskLevel: 1 });
      const policy = getTierPolicy(
        classification,
        mode as Parameters<typeof getTierPolicy>[1]
      );
      expect(isTierAllowed("cheap", policy)).toBe(true);
    });
  }
});

// ── Privacy: local_private or strong ─────────────────────────────────────
describe("Privacy-sensitive: local_private or strong", () => {
  it("privacy sensitive blocks cheap and mid", () => {
    const classification = makeClassification({
      privacySensitive: true,
      riskLevel: 2,
      taskType: "local_bug_fix",
    });
    const policy = getTierPolicy(classification, "balanced");
    expect(isTierAllowed("cheap", policy)).toBe(false);
    expect(isTierAllowed("mid", policy)).toBe(false);
    expect(
      isTierAllowed("local_private", policy) || isTierAllowed("strong", policy)
    ).toBe(true);
  });
});

// ── Huge context: long_context or strong ─────────────────────────────────
describe("Huge context: long_context or strong tier", () => {
  it("huge context need routes to long_context or strong", () => {
    const classification = makeClassification({
      contextNeed: "huge",
      riskLevel: 2,
      taskType: "multi_file_refactor",
    });
    const policy = getTierPolicy(classification, "balanced");
    expect(
      isTierAllowed("long_context", policy) || isTierAllowed("strong", policy)
    ).toBe(true);
    expect(isTierAllowed("cheap", policy)).toBe(false);
  });
});

// ── enforceMinDifficulty ──────────────────────────────────────────────────
describe("enforceMinDifficulty", () => {
  it("creative_generation enforces min difficulty 4", () => {
    expect(enforceMinDifficulty("creative_generation", 1)).toBe(4);
    expect(enforceMinDifficulty("creative_generation", 2)).toBe(4);
    expect(enforceMinDifficulty("creative_generation", 3)).toBe(4);
    expect(enforceMinDifficulty("creative_generation", 5)).toBe(5);
  });

  it("architecture_design enforces min difficulty 4", () => {
    expect(enforceMinDifficulty("architecture_design", 2)).toBe(4);
    expect(enforceMinDifficulty("architecture_design", 5)).toBe(5);
  });

  it("security_sensitive_change enforces min difficulty 4", () => {
    expect(enforceMinDifficulty("security_sensitive_change", 1)).toBe(4);
  });

  it("database_schema_change enforces min difficulty 4", () => {
    expect(enforceMinDifficulty("database_schema_change", 2)).toBe(4);
  });

  it("multi_file_refactor without code context enforces min 4", () => {
    expect(enforceMinDifficulty("multi_file_refactor", 2, false)).toBe(4);
  });

  it("multi_file_refactor WITH code context: no override", () => {
    expect(enforceMinDifficulty("multi_file_refactor", 2, true)).toBe(2);
  });

  it("explanation stays at 1 (no floor)", () => {
    expect(enforceMinDifficulty("explanation", 1)).toBe(1);
  });

  it("does not lower difficulty below its current value", () => {
    // If current difficulty already exceeds floor, keep it
    expect(enforceMinDifficulty("creative_generation", 5)).toBe(5);
  });
});

// ── Tier compliance matrix for full corpus categories ─────────────────────
describe("Tier compliance matrix (corpus categories)", () => {
  // All tasks that must NEVER get cheap tier:
  const neverCheapTasks = [
    "security_sensitive_change",
    "database_schema_change",
    "architecture_design",
  ] as const;

  for (const taskType of neverCheapTasks) {
    const modes = ["cost_saving", "balanced", "max_quality"] as const;
    for (const mode of modes) {
      it(`${taskType} → never cheap in ${mode} mode`, () => {
        const classification = makeClassification({ taskType, riskLevel: 4 });
        const policy = getTierPolicy(classification, mode);
        expect(isTierAllowed("cheap", policy)).toBe(false);
      });
    }
  }

  // Tasks that CAN use cheap in cost_saving:
  const cheapOkTasks = [
    "explanation",
    "simple_edit",
    "documentation_write",
  ] as const;

  for (const taskType of cheapOkTasks) {
    it(`${taskType} → cheap OK in cost_saving`, () => {
      const classification = makeClassification({ taskType, riskLevel: 1 });
      const policy = getTierPolicy(classification, "cost_saving");
      expect(isTierAllowed("cheap", policy)).toBe(true);
    });
  }
});
