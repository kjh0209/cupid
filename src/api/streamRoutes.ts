// ============================================================
// SSE streaming endpoint for the VS Code chat panel.
//
// Events emitted (in order):
//   1. "routing"        — task classification + selected model
//                         (so the UI can show the routing badge IMMEDIATELY)
//   2. "chunk"          — incremental response text (Cursor-style streaming)
//   3. "done"           — final usage, cost, savings
//   4. "error"          — error message
//
// Why a separate route from /api/compare:
//   - /api/compare runs router + benchmark in parallel and waits for both.
//     For an interactive chat UI we want IMMEDIATE routing feedback, then
//     streamed router response. No benchmark (benchmark is for eval).
// ============================================================

import type { FastifyInstance } from "fastify";
import { taskClassifier } from "../classifier/taskClassifier.js";
import { classifyWithLlm } from "../classifier/llmClassifier.js";
import { modelRecommender } from "../recommender/modelRecommender.js";
import { promptTokenOptimizer } from "../optimizer/promptTokenOptimizer.js";
import { buildExecutorMessages } from "../optimizer/executorPromptBuilder.js";
import { getModelById } from "../recommender/modelTiering.js";
import { callLLMStream } from "../evaluation/llmExecutor.js";
import type { LLMMessage } from "../evaluation/llmExecutor.js";
import type { ModelRecord, ModelTier, UserMode, TaskClassification } from "../types.js";
import { logger } from "../utils/logger.js";
import { priceUsd } from "../utils/pricing.js";
import { initSSE } from "../utils/sse.js";
import { buildCPLPreamble, injectCPLRepoTree, performCPLBookkeeping } from "../utils/cplHelpers.js";

interface StreamBody {
  prompt?: string;
  userMode?: UserMode;
  maxTokens?: number;
  routingMode?: "rule_based" | "llm_assisted";
  rawCode?: string;
  fileName?: string;
  sessionKey?: string;
  useCpl?: boolean;
  extractCpl?: boolean;
}

export async function registerStreamRoutes(app: FastifyInstance) {
  app.post<{ Body: StreamBody }>("/api/compare/stream", async (req, reply) => {
    const body = req.body ?? {};
    const prompt = (body.prompt ?? "").trim();
    if (!prompt) return reply.status(400).send({ error: "prompt is required" });

    const userMode: UserMode = body.userMode ?? "balanced";
    const routingMode = body.routingMode ?? "rule_based";
    const sessionKey = body.sessionKey ?? "";
    const useCpl = (body.useCpl ?? true) && !!sessionKey;
    const extractCpl = (body.extractCpl ?? true) && !!sessionKey;
    const maxTokens = Math.min(16384, Math.max(256, Number(body.maxTokens ?? 4096)));

    const { send, end } = initSSE(reply);

    try {
      // ── Phase 1: classify ──
      let classification: TaskClassification;
      let llmRouting: {
        modelId: string; inputTokens: number; outputTokens: number;
        costUsd: number; latencyMs: number;
        rationale: string | null; fellBackToRules: boolean;
      } | null = null;

      if (routingMode === "llm_assisted") {
        const r = await classifyWithLlm({ message: prompt, userMode, selectedCode: body.rawCode, activeFilePath: body.fileName });
        classification = r.classification;
        llmRouting = {
          modelId: r.modelId, inputTokens: r.inputTokens, outputTokens: r.outputTokens,
          costUsd: r.costUsd, latencyMs: r.latencyMs,
          rationale: r.rationale, fellBackToRules: r.fellBackToRules,
        };
      } else {
        classification = taskClassifier.classify({ message: prompt, userMode, selectedCode: body.rawCode, activeFilePath: body.fileName });
      }

      if (useCpl) injectCPLRepoTree(sessionKey, classification.taskType);

      // ── Phase 2: optimize prompt + recommend model ──
      const promptOpt = promptTokenOptimizer.optimize({
        rawMessage: prompt,
        taskClassification: classification,
        selectedModel: "anthropic/claude-sonnet-4-5",
        userMode,
        activeFilePath: body.fileName,
        selectedCode: body.rawCode,
      });
      const messageForRouter = promptOpt.optimizedMessage;

      const { recommended, topCandidates } = await modelRecommender.recommend(
        classification, userMode, messageForRouter, undefined, body.rawCode,
      );
      const routerModel = await getModelById(recommended.modelId);
      if (!routerModel) {
        send("error", { message: `Router model ${recommended.modelId} not found` });
        reply.raw.end();
        return;
      }

      // ── EMIT routing event IMMEDIATELY ──
      send("routing", {
        classification: {
          taskType: classification.taskType,
          riskLevel: classification.riskLevel,
          difficulty: classification.difficulty,
          contextNeed: classification.contextNeed,
        },
        llmRouting,
        routing: {
          selectedModel: routerModel.id,
          displayName: routerModel.displayName,
          tier: routerModel.tier,
          reasons: recommended.reason,
          topCandidates: topCandidates.slice(0, 3).map((c) => ({
            modelId: c.model.id, tier: c.model.tier, score: c.score,
          })),
        },
      });

      let cplPreamble = "";
      let cplInjected = 0;
      if (useCpl) {
        const built = buildCPLPreamble({ sessionKey, prompt, fileName: body.fileName, taskType: classification.taskType });
        cplPreamble = built.preamble;
        cplInjected = built.entriesUsed;
      }
      if (cplInjected > 0) {
        send("cpl", { injectedEntries: cplInjected });
      }

      const composedUserPrompt = cplPreamble ? `${cplPreamble}\n\n${messageForRouter}` : messageForRouter;
      const build = buildExecutorMessages({
        userPrompt: composedUserPrompt,
        classification,
        modelTier: routerModel.tier as ModelTier,
        userMode,
        rawCode: body.rawCode,
        fileName: body.fileName,
      });

      // ── Phase 4: stream the response ──
      let collected = "";
      let finalUsage = { inputTokens: 0, outputTokens: 0 };
      let finalCost = 0;
      await new Promise<void>((resolve) => {
        callLLMStream(
          routerModel.id,
          build.messages,
          {
            onChunk: (text) => {
              collected += text;
              send("chunk", { text });
            },
            onDone: (usage, finishReason, latencyMs) => {
              const cost = priceUsd(routerModel, usage.inputTokens, usage.outputTokens);
              finalUsage = usage;
              finalCost = cost;
              send("done", {
                modelId: routerModel.id,
                inputTokens: usage.inputTokens,
                outputTokens: usage.outputTokens,
                costUsd: cost,
                latencyMs,
                finishReason,
                fullText: collected,
              });
              resolve();
            },
            onError: (err) => {
              send("error", { message: err.message });
              resolve();
            },
          },
          0.2,
          maxTokens,
        );
      });

      if (sessionKey && collected) {
        await performCPLBookkeeping({
          sessionKey,
          prompt,
          classification,
          routedModel: routerModel.id,
          response: collected,
          inputTokens: finalUsage.inputTokens,
          outputTokens: finalUsage.outputTokens,
          costUsd: finalCost,
          extractCpl,
          fileName: body.fileName,
          rawCode: body.rawCode,
        });
      }
    } catch (err) {
      logger.error("Stream route failed", err);
      try { send("error", { message: String(err) }); } catch { /* socket may already be closed */ }
    } finally {
      end();
    }
  });
}
