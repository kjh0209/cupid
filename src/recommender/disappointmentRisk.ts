// ============================================================
// Disappointment Risk Score (DRS) — 0 to 5 scale
//
// 사용자가 cheap tier 결과를 보고 실망할 확률을 신호 가중으로 계산한다.
// DRS가 높을수록 routing policy가 cheap tier를 회피한다.
//
// 신호 목록 (각 신호의 최대 누적값):
//   +2  open-ended creation verb (make/build/create ... a/an)
//   +1  quality adjective (polished, real, cool, fun, nice) + no code context
//   +1  prompt < 30 chars + creation verb
//   +1  LLM classifier fell back to rules
//   +1  LLM rationale contains ambiguity words
//   +1  no code context + visual/interactive task type
//   +1  blank slate session + creation verb
//   +1  LLM confidence < 0.6
// ============================================================

import type { TaskType } from "../types.js";

// Open-ended creation verb pattern: "make a", "build an", "create a", "design a", etc.
const CREATION_VERB_PATTERN =
  /\b(make|build|create|design|implement|code)\s+(?:me\s+)?(?:a|an)\b/i;

// Quality adjectives that signal high design-taste expectations
const QUALITY_ADJ_PATTERN =
  /\b(polished|real|complete|full|professional|fun|nice|cool|pretty|beautiful|slick|clean|solid|production.?ready)\b/i;

// Task types where visual/interactive output is expected
const VISUAL_TASK_TYPES: Set<TaskType> = new Set([
  "creative_generation",
  "ui_change",
]);

export interface DrsInput {
  prompt: string;
  taskType: TaskType;
  llmRationale?: string | null;
  fellBackToRules?: boolean;
  hasCodeContext: boolean;
  isBlankSlate?: boolean;
  llmConfidence?: number | null;
}

export interface DrsResult {
  score: number; // 0-5
  signals: string[];
}

/**
 * Compute how likely the user will be disappointed by a cheap-tier response.
 * Higher score = more likely to disappoint = avoid cheap tier.
 */
export function computeDisappointmentRisk(input: DrsInput): DrsResult {
  const { prompt, taskType, llmRationale, fellBackToRules, hasCodeContext, isBlankSlate, llmConfidence } = input;
  let score = 0;
  const signals: string[] = [];

  // Signal 1: Open-ended creation verb (+2) — model must invent from scratch
  if (CREATION_VERB_PATTERN.test(prompt)) {
    score += 2;
    signals.push("open-ended creation verb (+2)");
  }

  // Signal 2: Quality adjectives without code context (+1)
  if (!hasCodeContext && QUALITY_ADJ_PATTERN.test(prompt)) {
    score += 1;
    signals.push("quality adjective, no code context (+1)");
  }

  // Signal 3: Very short prompt + creation verb = insufficient spec (+1)
  if (prompt.trim().length < 30 && CREATION_VERB_PATTERN.test(prompt)) {
    score += 1;
    signals.push("short prompt (<30 chars) + creation verb (+1)");
  }

  // Signal 4: LLM classifier fell back to rules = uncertain classification (+1)
  if (fellBackToRules === true) {
    score += 1;
    signals.push("LLM classifier fell back to rules (+1)");
  }

  // Signal 5: Ambiguous rationale from LLM (+1)
  if (llmRationale && /\b(ambiguous|unclear|could\s+be|might\s+be|seems?\s+like|not\s+sure|possibly|uncertain)\b/i.test(llmRationale)) {
    score += 1;
    signals.push("ambiguous LLM rationale (+1)");
  }

  // Signal 6: No code context + visual/interactive task (+1)
  if (!hasCodeContext && VISUAL_TASK_TYPES.has(taskType)) {
    score += 1;
    signals.push("visual task, no code context (+1)");
  }

  // Signal 7: Blank-slate session + creation verb (+1)
  if (isBlankSlate && CREATION_VERB_PATTERN.test(prompt)) {
    score += 1;
    signals.push("blank slate session + creation verb (+1)");
  }

  // Signal 8: Low LLM confidence (+1)
  if (typeof llmConfidence === "number" && llmConfidence < 0.6) {
    score += 1;
    signals.push(`low LLM confidence (${llmConfidence.toFixed(2)}) (+1)`);
  }

  return { score: Math.min(score, 5), signals };
}

/**
 * Returns true if the DRS score is high enough to forbid cheap tier
 * given the user's operating mode.
 */
export function drsForbidsCheap(
  drsScore: number,
  userMode: "cost_aggressive" | "cost_saving" | "balanced" | "max_quality"
): boolean {
  switch (userMode) {
    case "cost_aggressive":
      return false; // CI/batch: never override for DRS
    case "cost_saving":
      return drsScore >= 3;
    case "balanced":
      return drsScore >= 2;
    case "max_quality":
      return true; // always avoid cheap
  }
}
