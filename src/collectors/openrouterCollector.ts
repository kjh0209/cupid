import { getDb } from "../db/database.js";
import { models } from "../db/schema.js";
import { logger } from "../utils/logger.js";
import { fetchJson } from "../utils/fetchWithRetry.js";
import { todayIso } from "../utils/sourceFreshness.js";
import type { ModelTier } from "../types.js";

const OPENROUTER_BASE = process.env["OPENROUTER_BASE_URL"] ?? "https://openrouter.ai/api/v1";

interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  context_length?: number;
  pricing?: {
    prompt?: string;
    completion?: string;
    image?: string;
    request?: string;
  };
  top_provider?: {
    context_length?: number;
    max_completion_tokens?: number;
    is_moderated?: boolean;
  };
  architecture?: {
    modality?: string;
    tokenizer?: string;
    instruct_type?: string;
  };
  supported_parameters?: string[];
}

function inferTierFromPricing(inputPerM: number): ModelTier {
  if (inputPerM === 0) return "cheap";
  if (inputPerM < 0.3) return "cheap";
  if (inputPerM < 5) return "mid";
  if (inputPerM < 25) return "strong";
  return "strong";
}

function inferProviderFromId(id: string): string {
  const parts = id.split("/");
  return parts[0] ?? "unknown";
}

export async function collectOpenRouter(): Promise<number> {
  const apiKey = process.env["OPENROUTER_API_KEY"];
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  logger.info("Fetching OpenRouter model list...");

  let data: { data: OpenRouterModel[] };
  try {
    data = await fetchJson<{ data: OpenRouterModel[] }>(
      `${OPENROUTER_BASE}/models`,
      { headers, timeoutMs: 20000 }
    );
  } catch (err) {
    logger.error("Failed to fetch OpenRouter models", err);
    return 0;
  }

  const db = getDb();
  let count = 0;
  const today = todayIso();

  for (const model of data.data ?? []) {
    if (!model.id) continue;

    const inputPerToken = parseFloat(model.pricing?.prompt ?? "0");
    const outputPerToken = parseFloat(model.pricing?.completion ?? "0");
    const inputPerM = inputPerToken * 1_000_000;
    const outputPerM = outputPerToken * 1_000_000;

    const provider = inferProviderFromId(model.id);
    const tier = inferTierFromPricing(inputPerM);
    const contextWindow =
      model.top_provider?.context_length ?? model.context_length ?? 4096;
    const maxOutput = model.top_provider?.max_completion_tokens ?? 4096;

    const hasVision = model.architecture?.modality?.includes("image") ?? false;
    const hasTools = model.supported_parameters?.includes("tools") ?? false;

    try {
      await db
        .insert(models)
        .values({
          id: model.id,
          provider,
          displayName: model.name ?? model.id,
          tier,
          inputPricePerMillion: inputPerM,
          outputPricePerMillion: outputPerM,
          cachedInputPricePerMillion: null,
          cacheWritePricePerMillion: null,
          contextWindow,
          maxOutputTokens: maxOutput,
          modality: model.architecture?.modality ?? "text",
          toolCallingSupport: hasTools,
          visionSupport: hasVision,
          sourceConfidence: "official",
          sourceUrl: "https://openrouter.ai/api/v1/models",
          lastUpdated: today,
          deprecated: false,
        })
        .onConflictDoUpdate({
          target: models.id,
          set: {
            inputPricePerMillion: inputPerM,
            outputPricePerMillion: outputPerM,
            contextWindow,
            maxOutputTokens: maxOutput,
            lastUpdated: today,
          },
        });
      count++;
    } catch {
      // Skip
    }
  }

  logger.info(`Collected ${count} models from OpenRouter`);
  return count;
}
