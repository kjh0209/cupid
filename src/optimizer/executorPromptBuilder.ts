// ============================================================
// Executor prompt builder
//
// Constructs the final message array sent to the routed LLM.
// Combines:
//   - Task-aware system prompt (taskSystemPrompts.ts)
//   - Optional few-shot for weaker models
//   - CPL-compressed code context (contextPreservationLayer.ts)
//   - User's prompt (optionally already token-optimized)
// ============================================================

import type { TaskClassification, ModelTier, UserMode } from "../types.js";
import type { LLMMessage } from "../evaluation/llmExecutor.js";
import { buildSystemPrompt } from "./taskSystemPrompts.js";
import { applyCPL } from "./contextPreservationLayer.js";

export interface ExecutorPromptInput {
  userPrompt: string;
  classification: TaskClassification;
  modelTier: ModelTier;
  userMode: UserMode;
  rawCode?: string;
  fileName?: string;
  hasHighlight?: boolean;
  highlightedRegion?: string;
  gitDiff?: string;
  /** Inline the few-shot examples even for stronger models (forces alignment) */
  forceFewShot?: boolean;
}

export interface ExecutorPromptOutput {
  messages: LLMMessage[];
  cpl: ReturnType<typeof applyCPL> | null;
  system: ReturnType<typeof buildSystemPrompt>;
  totalChars: number;
}

export function buildExecutorMessages(input: ExecutorPromptInput): ExecutorPromptOutput {
  const sys = buildSystemPrompt({
    taskType: input.classification.taskType,
    modelTier: input.modelTier,
    userMode: input.userMode,
    includeFewShot: input.forceFewShot,
    language: input.classification.languageOrFramework?.[0],
    framework: input.classification.languageOrFramework,
    riskLevel: input.classification.riskLevel,
    contextNeed: input.classification.contextNeed,
  });

  let cpl: ReturnType<typeof applyCPL> | null = null;
  let codeContext = "";
  if (input.rawCode && input.rawCode.trim().length > 0) {
    cpl = applyCPL({
      taskType: input.classification.taskType,
      rawCode: input.rawCode,
      fileName: input.fileName,
      hasHighlight: input.hasHighlight,
      highlightedRegion: input.highlightedRegion,
      userPrompt: input.userPrompt,
      gitDiff: input.gitDiff,
    });
    codeContext = cpl.compressedCode;
  }

  const messages: LLMMessage[] = [
    { role: "system", content: sys.systemMessage },
  ];

  for (const fs of sys.fewShotMessages) {
    messages.push({ role: fs.role, content: fs.content });
  }

  // Assemble the user turn
  const userTurnParts: string[] = [];
  userTurnParts.push(input.userPrompt.trim());
  if (codeContext) {
    const filenameHint = input.fileName ? ` (${input.fileName})` : "";
    userTurnParts.push(
      `\n\n--- code context${filenameHint} ---\n\`\`\`\n${codeContext}\n\`\`\``,
    );
  }
  if (input.gitDiff && !messages.some((m) => m.content.includes(input.gitDiff!))) {
    userTurnParts.push(`\n\n--- git diff ---\n\`\`\`diff\n${input.gitDiff}\n\`\`\``);
  }

  messages.push({ role: "user", content: userTurnParts.join("") });

  const totalChars = messages.reduce((acc, m) => acc + m.content.length, 0);
  return { messages, cpl, system: sys, totalChars };
}

/**
 * Build a self-revision pass message array. Given the first response and the
 * original request, ask the same model to critique and revise its own answer.
 * Targeted use case: when the router picks a weaker model and we want to close
 * the gap to Opus quality at ~2x cost instead of 30x.
 */
export function buildSelfRevisionMessages(input: {
  originalSystem: string;
  userPrompt: string;
  codeContext?: string;
  firstResponse: string;
  taskType: string;
}): LLMMessage[] {
  return [
    {
      role: "system",
      content: `${input.originalSystem}

You are now in the SELF-REVISION phase. You just produced a first-pass answer to the user's request. Your job:
1. Find the 1–3 most important problems with your first answer (correctness, missing edge case, wrong assumption, padding, drift from the task).
2. Produce a revised answer that fixes them.
3. If the first answer was already correct and complete, say "REVISION: no changes needed — first answer accepted." and stop.

Be ruthless. The goal is the user receiving a better second answer, not protecting your first.`,
    },
    {
      role: "user",
      content:
        `Original request:\n${input.userPrompt}` +
        (input.codeContext ? `\n\nCode context:\n\`\`\`\n${input.codeContext}\n\`\`\`` : "") +
        `\n\n--- your first-pass answer ---\n${input.firstResponse}\n--- end first-pass ---\n\nNow self-critique and revise. Return ONLY the final answer (or "REVISION: no changes needed"). Do not include the critique in your output.`,
    },
  ];
}
