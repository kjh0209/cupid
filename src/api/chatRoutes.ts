import type { FastifyInstance } from "fastify";
import { callLLM } from "../evaluation/llmExecutor.js";
import { getModelById } from "../recommender/modelTiering.js";
import { logger } from "../utils/logger.js";
import { requireAuth } from "../auth/session.js";

interface ChatMessage { role: "system" | "user" | "assistant"; content: string }

interface MultiChatBody {
  modelIds?: string[];
  messages?: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
}

interface ModelResult {
  modelId: string;
  displayName: string;
  tier: string;
  content: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  error?: string;
}

export async function registerChatRoutes(app: FastifyInstance) {
  app.post<{ Body: MultiChatBody }>("/api/chat/multi", async (req, reply) => {
    const user = requireAuth(req, reply);
    if (!user) return;
    const body = req.body ?? {};
    const modelIds = (body.modelIds ?? []).slice(0, 6);
    const messages = body.messages ?? [];
    const temperature = body.temperature ?? 0.3;
    const maxTokens = Math.min(16384, Math.max(128, body.maxTokens ?? 2048));

    if (modelIds.length === 0) return reply.status(400).send({ error: "modelIds is required" });
    if (messages.length === 0) return reply.status(400).send({ error: "messages is required" });
    const lastRole = messages[messages.length - 1]?.role;
    if (lastRole !== "user") return reply.status(400).send({ error: "last message must be from user" });

    const results = await Promise.all(
      modelIds.map(async (modelId): Promise<ModelResult> => {
        const start = Date.now();
        try {
          const model = await getModelById(modelId);
          if (!model) {
            return { modelId, displayName: modelId, tier: "unknown", content: "", inputTokens: 0, outputTokens: 0, costUsd: 0, latencyMs: 0, error: "model not in catalogue" };
          }
          const res = await callLLM(modelId, messages, temperature, maxTokens);
          const inputCost = (res.usage.inputTokens / 1_000_000) * model.inputPricePerMillion;
          const outputCost = (res.usage.outputTokens / 1_000_000) * model.outputPricePerMillion;
          return {
            modelId,
            displayName: model.displayName,
            tier: model.tier,
            content: res.content,
            inputTokens: res.usage.inputTokens,
            outputTokens: res.usage.outputTokens,
            costUsd: Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000,
            latencyMs: res.latencyMs,
          };
        } catch (err) {
          logger.error(`multi-chat failed for ${modelId}`, err);
          return { modelId, displayName: modelId, tier: "unknown", content: "", inputTokens: 0, outputTokens: 0, costUsd: 0, latencyMs: Date.now() - start, error: String(err) };
        }
      }),
    );

    return reply.send({ results });
  });
}
