import { getDb } from "../db/database.js";
import { models } from "../db/schema.js";
import { logger } from "../utils/logger.js";
import { fetchJson } from "../utils/fetchWithRetry.js";
import { todayIso } from "../utils/sourceFreshness.js";
import { normalizeModelId } from "../utils/normalizeModelId.js";
import type { ModelTier } from "../types.js";

const LITELLM_URL =
  process.env["LITELLM_COST_MAP_URL"] ??
  "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json";

interface LiteLLMModelEntry {
  input_cost_per_token?: number;
  output_cost_per_token?: number;
  cache_read_input_token_cost?: number;
  cache_creation_input_token_cost?: number;
  max_tokens?: number;
  max_input_tokens?: number;
  max_output_tokens?: number;
  supports_function_calling?: boolean;
  supports_vision?: boolean;
  supports_tool_choice?: boolean;
  mode?: string;
  litellm_provider?: string;
  deprecation_date?: string;
}

function inferTier(modelId: string, inputPricePerM: number): ModelTier {
  const id = modelId.toLowerCase();

  if (id.includes("local") || id.includes("ollama") || id.includes("lmstudio")) return "local_private";

  if (inputPricePerM === 0) return "local_private";

  if (
    id.includes("gemini-1.5-pro") ||
    id.includes("gemini-2.5-pro") ||
    id.includes("claude-opus") ||
    id.includes("gpt-4o") && !id.includes("mini") ||
    id.includes("o1") && !id.includes("mini") ||
    id.includes("o3") && !id.includes("mini")
  ) {
    return inputPricePerM > 20 ? "strong" : "mid";
  }

  if (id.includes("128k") || id.includes("1m") || id.includes("gemini-1.5") || id.includes("gemini-2")) {
    if (inputPricePerM < 1) return "long_context";
  }

  if (inputPricePerM <= 0.5) return "cheap";
  if (inputPricePerM <= 5) return "mid";
  if (inputPricePerM <= 20) return "strong";
  return "strong";
}

function inferProvider(modelId: string, litellmProvider?: string): string {
  if (litellmProvider && litellmProvider !== "openai") return litellmProvider;
  const id = modelId.toLowerCase();
  if (id.startsWith("claude") || id.includes("anthropic")) return "anthropic";
  if (id.startsWith("gemini") || id.startsWith("palm")) return "google";
  if (id.startsWith("gpt") || id.startsWith("o1") || id.startsWith("o3") || id.startsWith("text-")) return "openai";
  if (id.startsWith("llama") || id.startsWith("meta")) return "meta";
  if (id.startsWith("mistral") || id.startsWith("mixtral")) return "mistral";
  if (id.startsWith("deepseek")) return "deepseek";
  if (id.startsWith("command")) return "cohere";
  return litellmProvider ?? "unknown";
}

export async function collectLiteLLM(): Promise<number> {
  logger.info(`Fetching LiteLLM cost map from ${LITELLM_URL}`);

  let data: Record<string, LiteLLMModelEntry>;
  try {
    data = await fetchJson<Record<string, LiteLLMModelEntry>>(LITELLM_URL, {
      timeoutMs: 30000,
    });
  } catch (err) {
    logger.error("Failed to fetch LiteLLM cost map", err);
    return 0;
  }

  const db = getDb();
  let count = 0;
  const today = todayIso();

  for (const [rawId, entry] of Object.entries(data)) {
    if (rawId === "sample_spec") continue;
    if (!entry || typeof entry !== "object") continue;

    const inputPricePerToken = entry.input_cost_per_token ?? 0;
    const outputPricePerToken = entry.output_cost_per_token ?? 0;
    const inputPricePerMillion = inputPricePerToken * 1_000_000;
    const outputPricePerMillion = outputPricePerToken * 1_000_000;

    const cachedInput = entry.cache_read_input_token_cost != null
      ? entry.cache_read_input_token_cost * 1_000_000
      : null;
    const cacheWrite = entry.cache_creation_input_token_cost != null
      ? entry.cache_creation_input_token_cost * 1_000_000
      : null;

    const provider = inferProvider(rawId, entry.litellm_provider);
    const normalizedId = normalizeModelId(rawId);
    const tier = inferTier(normalizedId, inputPricePerMillion);

    const contextWindow = entry.max_input_tokens ?? entry.max_tokens ?? 4096;
    const maxOutput = entry.max_output_tokens ?? entry.max_tokens ?? 4096;

    try {
      await db
        .insert(models)
        .values({
          id: normalizedId,
          provider,
          displayName: rawId,
          tier,
          inputPricePerMillion,
          outputPricePerMillion,
          cachedInputPricePerMillion: cachedInput,
          cacheWritePricePerMillion: cacheWrite,
          contextWindow,
          maxOutputTokens: maxOutput,
          modality: entry.mode ?? "chat",
          toolCallingSupport: entry.supports_function_calling ?? entry.supports_tool_choice ?? null,
          visionSupport: entry.supports_vision ?? null,
          sourceConfidence: "official",
          sourceUrl: LITELLM_URL,
          lastUpdated: today,
          deprecated: entry.deprecation_date != null,
        })
        .onConflictDoUpdate({
          target: models.id,
          set: {
            inputPricePerMillion,
            outputPricePerMillion,
            cachedInputPricePerMillion: cachedInput,
            cacheWritePricePerMillion: cacheWrite,
            contextWindow,
            maxOutputTokens: maxOutput,
            lastUpdated: today,
            deprecated: entry.deprecation_date != null,
          },
        });
      count++;
    } catch {
      // Skip invalid entries
    }
  }

  logger.info(`Collected ${count} models from LiteLLM`);
  return count;
}
