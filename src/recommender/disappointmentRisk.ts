// ============================================================
// Disappointment Risk Score (DRS) — 0 to 5 scale
//
// Estimates the probability that a user will be disappointed
// if we route their request to a cheap model. High DRS = route
// to strong tier even if the task type alone wouldn't require it.
//
// Signal rationale: cheap models produce "wireframe-quality"
// output for open-ended, creative, or ambiguous requests.
// Strong models bridge the gap between prototype and product.
// ============================================================

import type { TaskType } from "../types.js";

export interface DrsInput {
  prompt: string;
  taskType: TaskType;
  difficulty: number;
  /** Rationale string returned by the LLM classifier, if available */
  llmRationale?: string | null;
  /** True when the LLM classifier fell back to rule-based output */
  fellBackToRules?: boolean;
  /** Confidence score returned by the LLM classifier (0–1) */
  llmConfidence?: number | null;
  /** Whether selected code / repo context was provided */
  hasCodeContext: boolean;
}

export interface DrsResult {
  score: number;          // 0–5, higher = more likely to disappoint on cheap
  signals: string[];      // human-readable explanation of which signals fired
}

// Open-ended creation verbs that signal the user expects a polished result
const CREATION_VERB_RE =
  /\b(make|build|create|design|implement|code)\s+(?:me\s+)?(?:a|an)\b/i;

// Quality adjectives — "a real app", "a polished dashboard", "a nice game"
const QUALITY_ADJ_RE =
  /\b(complete|full|real|polished|fun|nice|cool|beautiful|stunning|professional|production.ready|working)\b/i;

// Ambiguity signals in rationale text
const AMBIGUITY_RE =
  /\b(ambiguous|unclear|could\s+be|might\s+be|seems?\s+like|not\s+sure|uncertain)\b/i;

// Visual/interactive task types that depend heavily on design taste
const VISUAL_TASK_TYPES = new Set<TaskType>(["creative_generation", "ui_change"]);

export function computeDisappointmentRisk(input: DrsInput): DrsResult {
  const { prompt, taskType, difficulty, llmRationale, fellBackToRules, llmConfidence, hasCodeContext } = input;
  const lower = prompt.toLowerCase();
  let score = 0;
  const signals: string[] = [];

  // Signal 1: Open-ended creation verb (+2) — "make me a game", "build an app"
  if (CREATION_VERB_RE.test(prompt)) {
    score += 2;
    signals.push("open-ended creation verb ('make/build/create a ...')");
  }

  // Signal 2: Quality adjective without code context (+1)
  if (!hasCodeContext && QUALITY_ADJ_RE.test(prompt)) {
    score += 1;
    signals.push("quality adjective ('real', 'polished', 'fun', etc.) without code context");
  }

  // Signal 3: Very short prompt + creation verb (+1) — "make a clock" has no spec
  if (prompt.trim().length < 30 && CREATION_VERB_RE.test(prompt)) {
    score += 1;
    signals.push("short prompt (<30 chars) with creation verb — insufficient specification");
  }

  // Signal 4: LLM classifier fell back to rules (+1) — uncertain classification
  if (fellBackToRules) {
    score += 1;
    signals.push("LLM classifier fell back to rule-based output (uncertain)");
  }

  // Signal 5: LLM rationale contains uncertainty language (+1)
  if (llmRationale && AMBIGUITY_RE.test(llmRationale)) {
    score += 1;
    signals.push("LLM classifier expressed uncertainty in rationale");
  }

  // Signal 6: Visual/interactive task + no code context (+1)
  if (!hasCodeContext && VISUAL_TASK_TYPES.has(taskType)) {
    score += 1;
    signals.push("visual/interactive task type without code context — design taste decisive");
  }

  // Signal 7: Low LLM confidence (+1)
  if (llmConfidence != null && llmConfidence < 0.6) {
    score += 1;
    signals.push(`low classifier confidence (${(llmConfidence * 100).toFixed(0)}%)`);
  }

  // Signal 8: High difficulty + no code context (+1)
  // A hard task without any code means the model must invent everything
  if (difficulty >= 4 && !hasCodeContext) {
    score += 1;
    signals.push("high difficulty (≥4) without code context — model must invent from scratch");
  }

  return { score: Math.min(score, 5), signals };
}

/** Returns true if DRS is high enough to forbid cheap tier given userMode. */
export function drsForbidsCheap(
  drs: number,
  userMode: "cost_aggressive" | "cost_saving" | "balanced" | "max_quality"
): boolean {
  if (userMode === "cost_aggressive") return false;
  if (userMode === "max_quality") return true;
  if (userMode === "balanced") return drs >= 2;
  // cost_saving (default)
  return drs >= 3;
}
