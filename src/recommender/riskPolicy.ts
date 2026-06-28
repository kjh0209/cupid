import type { TaskClassification, ModelTier, UserMode, TaskType } from "../types.js";

export interface TierPolicy {
  allowedTiers: ModelTier[];
  requiredMinTier: ModelTier | null;
  reason: string;
}

const TIER_ORDER: Record<ModelTier, number> = {
  cheap: 0,
  mid: 1,
  long_context: 2,
  strong: 3,
  local_private: 0,
  unknown: 0,
};

export function isTierAllowed(tier: ModelTier, policy: TierPolicy): boolean {
  if (!policy.allowedTiers.includes(tier)) return false;
  if (policy.requiredMinTier) {
    return TIER_ORDER[tier] >= TIER_ORDER[policy.requiredMinTier];
  }
  return true;
}

export function getTierPolicy(
  classification: TaskClassification,
  userMode: UserMode
): TierPolicy {
  const { taskType, riskLevel, contextNeed, privacySensitive } = classification;

  // cost_aggressive: like cost_saving but no DRS enforcement (handled in scoring)
  // — tier policy is the same as cost_saving for hard constraints
  const effectiveMode = userMode === "cost_aggressive" ? "cost_saving" : userMode;

  // Privacy: prefer local/private if available
  if (privacySensitive) {
    return {
      allowedTiers: ["local_private", "strong"],
      requiredMinTier: null,
      reason: "Task marked privacy-sensitive: prefer local/private model",
    };
  }

  // Security-sensitive: never cheap
  if (taskType === "security_sensitive_change" || riskLevel >= 5) {
    return {
      allowedTiers: ["mid", "strong"],
      requiredMinTier: "mid",
      reason: "Security-sensitive task: minimum mid-tier required",
    };
  }

  // Risk >= 4: mid or strong
  if (riskLevel >= 4) {
    return {
      allowedTiers: ["mid", "strong", "long_context"],
      requiredMinTier: "mid",
      reason: `High risk (${riskLevel}/5): minimum mid-tier required`,
    };
  }

  // Database schema: mid or strong
  if (taskType === "database_schema_change") {
    return {
      allowedTiers: ["mid", "strong"],
      requiredMinTier: "mid",
      reason: "Database schema changes carry data loss risk: mid-tier minimum",
    };
  }

  // Architecture: strong preferred
  if (taskType === "architecture_design") {
    const allowed: ModelTier[] =
      effectiveMode === "max_quality" ? ["strong"] : ["mid", "strong", "long_context"];
    return {
      allowedTiers: allowed,
      requiredMinTier: "mid",
      reason: "Architecture design requires strong reasoning: mid-tier minimum",
    };
  }

  // Creative whole-app/game/demo generation — design taste decisive.
  // ALWAYS minimum mid tier; in balanced/max_quality lean strong.
  // Cheap tier is forbidden — it produces wireframe-quality output (see PR #4
  // bug where "make a breakout game" → gpt-4o-mini → monochrome wireframe vs
  // Opus → polished multi-color game with score/lives/dark theme).
  if (taskType === "creative_generation") {
    const allowed: ModelTier[] =
      effectiveMode === "cost_saving"
        ? ["mid", "strong"]
        : ["strong", "long_context"];
    return {
      allowedTiers: allowed,
      requiredMinTier: effectiveMode === "cost_saving" ? "mid" : "strong",
      reason:
        effectiveMode === "cost_saving"
          ? "Creative generation: mid-tier minimum (cheap tier produces wireframe-quality output)"
          : "Creative generation: strong tier required for design polish and product feel",
    };
  }

  // Huge context: long_context or strong
  if (contextNeed === "huge") {
    return {
      allowedTiers: ["long_context", "strong"],
      requiredMinTier: null,
      reason: "Huge context need: long-context model required",
    };
  }

  // Multi-file refactor: mid or strong
  if (taskType === "multi_file_refactor") {
    return {
      allowedTiers: ["mid", "strong", "long_context"],
      requiredMinTier: "mid",
      reason: "Multi-file refactor requires coordinated changes: mid-tier minimum",
    };
  }

  // API implementation: mid or better
  if (taskType === "api_implementation") {
    return {
      allowedTiers: ["mid", "strong"],
      requiredMinTier: "mid",
      reason: "API implementation affects runtime behavior: mid-tier recommended",
    };
  }

  // Local bug fix: mid by default, cheap only if risk is very low
  if (taskType === "local_bug_fix") {
    if (riskLevel <= 2) {
      const allowed: ModelTier[] =
        effectiveMode === "max_quality" ? ["cheap", "mid", "strong"] : ["cheap", "mid"];
      return {
        allowedTiers: allowed,
        requiredMinTier: null,
        reason: "Low-risk bug fix: cheap or mid tier recommended",
      };
    }
    return {
      allowedTiers: ["mid", "strong"],
      requiredMinTier: "mid",
      reason: "Bug fix with medium risk: mid-tier recommended",
    };
  }

  // Test generation: cheap or mid (strong only for max_quality)
  if (taskType === "test_generation") {
    const allowed: ModelTier[] =
      effectiveMode === "max_quality" ? ["cheap", "mid", "strong"] : ["cheap", "mid"];
    return {
      allowedTiers: allowed,
      requiredMinTier: null,
      reason: "Test generation: cheap or mid tier recommended",
    };
  }

  // Explanation / simple edit / UI / prompt rewrite / docs / code review: cheap or mid
  if (
    taskType === "explanation" ||
    taskType === "simple_edit" ||
    taskType === "ui_change" ||
    taskType === "prompt_rewrite_only" ||
    taskType === "documentation_write" ||
    taskType === "code_review"
  ) {
    const allowed: ModelTier[] =
      effectiveMode === "max_quality" ? ["cheap", "mid", "strong"] : ["cheap", "mid"];
    return {
      allowedTiers: allowed,
      requiredMinTier: null,
      reason: "Low-risk task: cheap or mid tier recommended",
    };
  }

  // Default: cap at mid for low-risk unknown tasks in non-max_quality modes
  if (riskLevel <= 2 && effectiveMode !== "max_quality") {
    return {
      allowedTiers: ["cheap", "mid"],
      requiredMinTier: null,
      reason: "Low-risk unknown task: cheap or mid tier recommended",
    };
  }

  return {
    allowedTiers: ["cheap", "mid", "strong", "long_context"],
    requiredMinTier: null,
    reason: "Unknown task type: all tiers allowed",
  };
}

/** Task-type minimum difficulty — overrides LLM if it goes too low */
const TASK_MIN_DIFFICULTY: Partial<Record<TaskType, number>> = {
  creative_generation: 4,
  architecture_design: 4,
  security_sensitive_change: 4,
};

/**
 * Returns the enforced minimum difficulty for a task, taking into account
 * the task type and whether code context is available.
 * Used to prevent the LLM from downgrading hard tasks to cheap tier.
 */
export function enforceMinDifficulty(
  classification: TaskClassification,
  hasCodeContext: boolean,
): number {
  let min = TASK_MIN_DIFFICULTY[classification.taskType] ?? 0;

  // multi_file_refactor without existing code context needs strong reasoning
  if (classification.taskType === "multi_file_refactor" && !hasCodeContext) {
    min = Math.max(min, 4);
  }

  return Math.max(classification.difficulty, min);
}

export function getFallbackModel(riskLevel: number): string {
  if (riskLevel >= 4) return "anthropic/claude-opus-4-5";
  return "anthropic/claude-opus-4-5";
}

export function getFallbackPolicy(
  selectedModelId: string,
  riskLevel: number
): {
  onTypecheckFail: string;
  onTestFail: string;
  onSecurityDetected: string;
  fallbackModel: string;
} {
  const fallback = getFallbackModel(riskLevel);
  return {
    onTypecheckFail: riskLevel >= 3 ? "escalate_to_strong" : "retry_with_mid",
    onTestFail: riskLevel >= 3 ? "escalate_to_strong" : "retry_with_mid",
    onSecurityDetected: "escalate_to_strong",
    fallbackModel: fallback,
  };
}
