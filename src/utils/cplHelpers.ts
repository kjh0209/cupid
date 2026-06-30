import { sessionContextStore } from "../cpl/sessionContextStore.js";
import { extractAndStore } from "../cpl/contextExtractor.js";
import { injectRepoFileTree } from "../cpl/repoFileTree.js";
import { logger } from "./logger.js";
import type { TaskClassification, TaskType } from "../types.js";

export interface CPLPreambleResult {
  preamble: string;
  entriesUsed: number;
  tokensUsed: number;
  debug: unknown;
}

export function buildCPLPreamble(opts: {
  sessionKey: string;
  prompt: string;
  fileName?: string;
  taskType: string;
  tokenBudget?: number;
}): CPLPreambleResult {
  const built = sessionContextStore.buildPreamble({
    sessionKey: opts.sessionKey,
    query: opts.prompt + " " + (opts.fileName ?? ""),
    taskType: opts.taskType,
    tokenBudget: opts.tokenBudget ?? 1800,
    includeRecentTasks: true,
  });
  return {
    preamble: built.preamble,
    entriesUsed: built.entriesUsed.length,
    tokensUsed: built.tokensUsed,
    debug: built.debug,
  };
}

export function injectCPLRepoTree(sessionKey: string, taskType: TaskType): void {
  void injectRepoFileTree(sessionKey, taskType);
}

export function recordCPLTask(opts: {
  sessionKey: string;
  prompt: string;
  taskType: string;
  routedModel: string;
  response: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  riskLevel: number;
  difficulty: number;
}): void {
  sessionContextStore.recordTask({
    sessionKey: opts.sessionKey,
    promptSummary: opts.prompt.slice(0, 480),
    taskType: opts.taskType,
    routedModel: opts.routedModel,
    responseSummary: opts.response.slice(0, 480),
    tokensIn: opts.inputTokens,
    tokensOut: opts.outputTokens,
    costUsd: opts.costUsd,
    metadata: { riskLevel: opts.riskLevel, difficulty: opts.difficulty },
  });
}

export async function extractCPLFacts(opts: {
  sessionKey: string;
  userPrompt: string;
  routedModel: string;
  responseContent: string;
  taskType: string;
  fileName?: string;
  rawCode?: string;
  useLlm: boolean;
}): Promise<{ stored: number; facts: Array<{ kind: string; title: string }> }> {
  const ext = await extractAndStore({
    sessionKey: opts.sessionKey,
    userPrompt: opts.userPrompt,
    routedModel: opts.routedModel,
    responseContent: opts.responseContent,
    taskType: opts.taskType,
    fileName: opts.fileName,
    rawCode: opts.rawCode,
  }, { useLlm: opts.useLlm });
  return {
    stored: ext.stored,
    facts: ext.facts.map((f) => ({ kind: f.kind, title: f.title })),
  };
}

export async function performCPLBookkeeping(opts: {
  sessionKey: string;
  prompt: string;
  classification: TaskClassification;
  routedModel: string;
  response: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  extractCpl: boolean;
  fileName?: string;
  rawCode?: string;
}): Promise<{ stored: number; facts: Array<{ kind: string; title: string }> } | null> {
  try {
    recordCPLTask({
      sessionKey: opts.sessionKey,
      prompt: opts.prompt,
      taskType: opts.classification.taskType,
      routedModel: opts.routedModel,
      response: opts.response,
      inputTokens: opts.inputTokens,
      outputTokens: opts.outputTokens,
      costUsd: opts.costUsd,
      riskLevel: opts.classification.riskLevel,
      difficulty: opts.classification.difficulty,
    });
    if (opts.extractCpl) {
      return await extractCPLFacts({
        sessionKey: opts.sessionKey,
        userPrompt: opts.prompt,
        routedModel: opts.routedModel,
        responseContent: opts.response,
        taskType: opts.classification.taskType,
        fileName: opts.fileName,
        rawCode: opts.rawCode,
        useLlm: opts.classification.difficulty >= 3 && opts.response.length > 600,
      });
    }
    return null;
  } catch (err) {
    logger.warn("CPL bookkeeping failed", err);
    return null;
  }
}
