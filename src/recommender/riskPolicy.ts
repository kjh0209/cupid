import type { TaskClassification, ModelTier, UserMode } from "../types.js";

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

  // Privacy: prefer local/private if available
  if (privacySensitive) {
    return {
      allowedTiers: ["local_private", "strong"],
      requiredMinTier: null,
      reason: "Task marked privacy-sensitive: prefer local/private model",
    };
  }

  // Security-sensitive: always strong — auth/crypto/payment mistakes cause incidents
  if (taskType === "security_sensitive_change" || riskLevel >= 5) {
    return {
      allowedTiers: ["strong"],
      requiredMinTier: "strong",
      reason: "Security-sensitive task: strong tier required (mid-tier misses timing-safe patterns, correct key derivation, and subtle auth flaws)",
    };
  }

  // Risk >= 4: strong tier preferred — high-risk changes are irreversible in prod.
  // long_context is also allowed (it's a capability tier, not a quality floor).
  // We exclude cheap and mid by listing only strong/long_context.
  if (riskLevel >= 4) {
    return {
      allowedTiers: ["strong", "long_context"],
      requiredMinTier: null,
      reason: `High risk (${riskLevel}/5): strong or long-context tier required for production-safe output`,
    };
  }

  // Database schema: always strong — migrations are irreversible, 50M-row tables
  // need zero-lock strategies that cheap/mid models routinely get wrong
  if (taskType === "database_schema_change") {
    return {
      allowedTiers: ["strong"],
      requiredMinTier: "strong",
      reason: "Database schema changes are irreversible in production: strong tier required for zero-downtime migration strategies",
    };
  }

  // Architecture: strong preferred
  if (taskType === "architecture_design") {
    const allowed: ModelTier[] =
      userMode === "max_quality" ? ["strong"] : ["mid", "strong", "long_context"];
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
      userMode === "cost_saving"
        ? ["mid", "strong"]
        : ["strong", "long_context"];
    return {
      allowedTiers: allowed,
      requiredMinTier: userMode === "cost_saving" ? "mid" : "strong",
      reason:
        userMode === "cost_saving"
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
        userMode === "max_quality" ? ["cheap", "mid", "strong"] : ["cheap", "mid"];
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
      userMode === "max_quality" ? ["cheap", "mid", "strong"] : ["cheap", "mid"];
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
      userMode === "max_quality" ? ["cheap", "mid", "strong"] : ["cheap", "mid"];
    return {
      allowedTiers: allowed,
      requiredMinTier: null,
      reason: "Low-risk task: cheap or mid tier recommended",
    };
  }

  // Default: cap at mid for low-risk unknown tasks in non-max_quality modes
  if (riskLevel <= 2 && userMode !== "max_quality") {
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
