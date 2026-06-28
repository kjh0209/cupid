// ============================================================
// Disappointment Risk Score (DRS) — 0-5 scale
//
// Estimates the probability that a user will be disappointed by
// cheap-model output. High DRS → route to strong tier to preserve
// retention. Called before scoring to optionally penalize cheap models.
// ============================================================

export interface DRSInput {
  prompt: string;
  /** Task type from classifier */
  taskType: string;
  /** LLM classifier's rationale string (may contain uncertainty signals) */
  llmRationale?: string | null;
  /** True if LLM classifier fell back to rule-based classification */
  fellBackToRules?: boolean;
  /** True if the active editor / selected code is non-empty */
  hasCodeContext: boolean;
  /** Confidence value 0-1 returned by LLM classifier, if available */
  confidence?: number | null;
  /** True if the workspace appears empty (≤1 file, no task history) */
  isBlankSlate?: boolean;
}

// Open-ended creation verb pattern: "make/build/create/design/implement/code a/an <thing>"
const CREATION_VERB_RE = /\b(make|build|create|design|implement|code)\s+(me\s+)?(?:a|an)\b/i;
const ANY_CREATION_VERB_RE = /\b(make|build|create|design|implement|code)\b/i;

// Quality-signaling adjectives that indicate the user wants a polished result
const QUALITY_ADJ_RE = /\b(complete|full|real|polished|fun|nice|cool)\b/i;

// Uncertainty phrases in LLM rationale
const UNCERTAINTY_RE = /\b(ambiguous|unclear|could be|might be|seems like)\b/i;

// Visual or interactive task types that really suffer on cheap models
const VISUAL_TASK_TYPES = new Set(["creative_generation", "ui_change"]);

/**
 * Returns a Disappointment Risk Score in [0, 5].
 * Higher = higher chance that routing to cheap tier disappoints the user.
 */
export function computeDisappointmentRisk(input: DRSInput): number {
  const {
    prompt,
    taskType,
    llmRationale,
    fellBackToRules,
    hasCodeContext,
    confidence,
    isBlankSlate,
  } = input;

  let score = 0;

  // +2: open-ended creation verb ("make/build/create a/an <thing>")
  if (CREATION_VERB_RE.test(prompt)) {
    score += 2;
  }

  // +1: quality adjectives with no code context
  if (!hasCodeContext && QUALITY_ADJ_RE.test(prompt)) {
    score += 1;
  }

  // +1: very short prompt (<30 chars) + creation verb → information deficit
  if (prompt.length < 30 && ANY_CREATION_VERB_RE.test(prompt)) {
    score += 1;
  }

  // +1: LLM classifier fell back to rule-based (ambiguous prompt)
  if (fellBackToRules) {
    score += 1;
  }

  // +1: LLM rationale contains uncertainty language
  if (llmRationale && UNCERTAINTY_RE.test(llmRationale)) {
    score += 1;
  }

  // +1: no code context + visual/interactive task type
  if (!hasCodeContext && VISUAL_TASK_TYPES.has(taskType)) {
    score += 1;
  }

  // +1: low LLM confidence (< 0.6)
  if (confidence != null && confidence < 0.6) {
    score += 1;
  }

  // +1: blank-slate session + creation verb
  if (isBlankSlate && ANY_CREATION_VERB_RE.test(prompt)) {
    score += 1;
  }

  return Math.min(score, 5);
}
