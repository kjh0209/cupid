import { getDb } from "../db/database.js";
import { models } from "../db/schema.js";
import { eq, and, not } from "drizzle-orm";
import type { ModelRecord, ModelTier } from "../types.js";

// Well-known model IDs for each tier (fallback when DB is empty).
const KNOWN_MODELS: ModelRecord[] = [
  // Strong tier
  {
    id: "anthropic/claude-opus-4-5",
    provider: "anthropic",
    displayName: "Claude Opus 4",
    tier: "strong",
    inputPricePerMillion: 15.0,
    outputPricePerMillion: 75.0,
    cachedInputPricePerMillion: 1.5,
    cacheWritePricePerMillion: 18.75,
    contextWindow: 200000,
    maxOutputTokens: 32000,
    modality: "text",
    toolCallingSupport: true,
    visionSupport: true,
    codingScore: 0.727,
    generalScore: 0.91,
    latencyScore: null,
    outputSpeed: 72,
    sourceConfidence: "official",
    sourceUrl: "https://docs.anthropic.com/en/docs/about-claude/models",
    lastUpdated: "2025-11-01",
    deprecated: false,
  },
  {
    id: "openai/gpt-4o",
    provider: "openai",
    displayName: "GPT-4o",
    tier: "strong",
    inputPricePerMillion: 5.0,
    outputPricePerMillion: 15.0,
    cachedInputPricePerMillion: 2.5,
    cacheWritePricePerMillion: null,
    contextWindow: 128000,
    maxOutputTokens: 16384,
    modality: "text",
    toolCallingSupport: true,
    visionSupport: true,
    codingScore: 0.464,
    generalScore: 0.887,
    latencyScore: null,
    outputSpeed: 110,
    sourceConfidence: "official",
    sourceUrl: "https://platform.openai.com/docs/pricing",
    lastUpdated: "2025-11-01",
    deprecated: false,
  },
  {
    id: "google/gemini-2.5-pro",
    provider: "google",
    displayName: "Gemini 2.5 Pro",
    tier: "strong",
    inputPricePerMillion: 1.25,
    outputPricePerMillion: 10.0,
    cachedInputPricePerMillion: 0.31,
    cacheWritePricePerMillion: null,
    contextWindow: 1000000,
    maxOutputTokens: 65536,
    modality: "text",
    toolCallingSupport: true,
    visionSupport: true,
    codingScore: 0.634,
    generalScore: 0.90,
    latencyScore: null,
    outputSpeed: 85,
    sourceConfidence: "official",
    sourceUrl: "https://ai.google.dev/pricing",
    lastUpdated: "2025-11-01",
    deprecated: false,
  },
  // Mid tier
  {
    id: "anthropic/claude-sonnet-4-5",
    provider: "anthropic",
    displayName: "Claude Sonnet 4",
    tier: "mid",
    inputPricePerMillion: 3.0,
    outputPricePerMillion: 15.0,
    cachedInputPricePerMillion: 0.3,
    cacheWritePricePerMillion: 3.75,
    contextWindow: 200000,
    maxOutputTokens: 16000,
    modality: "text",
    toolCallingSupport: true,
    visionSupport: true,
    codingScore: 0.623,
    generalScore: 0.88,
    latencyScore: null,
    outputSpeed: 98,
    sourceConfidence: "official",
    sourceUrl: "https://docs.anthropic.com/en/docs/about-claude/models",
    lastUpdated: "2025-11-01",
    deprecated: false,
  },
  {
    id: "anthropic/claude-3-5-sonnet-20241022",
    provider: "anthropic",
    displayName: "Claude 3.5 Sonnet",
    tier: "mid",
    inputPricePerMillion: 3.0,
    outputPricePerMillion: 15.0,
    cachedInputPricePerMillion: 0.3,
    cacheWritePricePerMillion: 3.75,
    contextWindow: 200000,
    maxOutputTokens: 8192,
    modality: "text",
    toolCallingSupport: true,
    visionSupport: true,
    codingScore: 0.499,
    generalScore: null,
    latencyScore: null,
    outputSpeed: null,
    sourceConfidence: "official",
    sourceUrl: "https://docs.anthropic.com/en/docs/about-claude/models",
    lastUpdated: "2025-11-01",
    deprecated: false,
  },
  {
    id: "openai/gpt-4o-mini",
    provider: "openai",
    displayName: "GPT-4o mini",
    tier: "mid",
    inputPricePerMillion: 0.15,
    outputPricePerMillion: 0.6,
    cachedInputPricePerMillion: 0.075,
    cacheWritePricePerMillion: null,
    contextWindow: 128000,
    maxOutputTokens: 16384,
    modality: "text",
    toolCallingSupport: true,
    visionSupport: true,
    codingScore: 0.284,
    generalScore: 0.82,
    latencyScore: null,
    outputSpeed: 180,
    sourceConfidence: "official",
    sourceUrl: "https://platform.openai.com/docs/pricing",
    lastUpdated: "2025-11-01",
    deprecated: false,
  },
  // Cheap tier
  {
    id: "anthropic/claude-3-5-haiku-20241022",
    provider: "anthropic",
    displayName: "Claude 3.5 Haiku",
    tier: "cheap",
    inputPricePerMillion: 0.8,
    outputPricePerMillion: 4.0,
    cachedInputPricePerMillion: 0.08,
    cacheWritePricePerMillion: 1.0,
    contextWindow: 200000,
    maxOutputTokens: 8192,
    modality: "text",
    toolCallingSupport: true,
    visionSupport: true,
    codingScore: 0.406,
    generalScore: 0.82,
    latencyScore: null,
    outputSpeed: 145,
    sourceConfidence: "official",
    sourceUrl: "https://docs.anthropic.com/en/docs/about-claude/models",
    lastUpdated: "2025-11-01",
    deprecated: false,
  },
  {
    id: "anthropic/claude-haiku-4-5",
    provider: "anthropic",
    displayName: "Claude Haiku 4",
    tier: "cheap",
    inputPricePerMillion: 0.8,
    outputPricePerMillion: 4.0,
    cachedInputPricePerMillion: 0.08,
    cacheWritePricePerMillion: 1.0,
    contextWindow: 200000,
    maxOutputTokens: 8192,
    modality: "text",
    toolCallingSupport: true,
    visionSupport: false,
    codingScore: 0.40,
    generalScore: 0.82,
    latencyScore: null,
    outputSpeed: 150,
    sourceConfidence: "official",
    sourceUrl: "https://docs.anthropic.com/en/docs/about-claude/models",
    lastUpdated: "2025-11-01",
    deprecated: false,
  },
  {
    id: "google/gemini-2.0-flash",
    provider: "google",
    displayName: "Gemini 2.0 Flash",
    tier: "cheap",
    inputPricePerMillion: 0.1,
    outputPricePerMillion: 0.4,
    cachedInputPricePerMillion: 0.025,
    cacheWritePricePerMillion: null,
    contextWindow: 1000000,
    maxOutputTokens: 8192,
    modality: "text",
    toolCallingSupport: true,
    visionSupport: true,
    codingScore: 0.358,
    generalScore: 0.85,
    latencyScore: null,
    outputSpeed: 240,
    sourceConfidence: "official",
    sourceUrl: "https://ai.google.dev/pricing",
    lastUpdated: "2025-11-01",
    deprecated: false,
  },
  // Long context
  {
    id: "google/gemini-1.5-pro",
    provider: "google",
    displayName: "Gemini 1.5 Pro",
    tier: "long_context",
    inputPricePerMillion: 1.25,
    outputPricePerMillion: 5.0,
    cachedInputPricePerMillion: 0.31,
    cacheWritePricePerMillion: null,
    contextWindow: 2000000,
    maxOutputTokens: 8192,
    modality: "text",
    toolCallingSupport: true,
    visionSupport: true,
    codingScore: null,
    generalScore: 0.87,
    latencyScore: null,
    outputSpeed: 60,
    sourceConfidence: "official",
    sourceUrl: "https://ai.google.dev/pricing",
    lastUpdated: "2025-11-01",
    deprecated: false,
  },
  // Reasoning / mid-tier
  {
    id: "openai/o3-mini",
    provider: "openai",
    displayName: "o3-mini",
    tier: "mid",
    inputPricePerMillion: 1.10,
    outputPricePerMillion: 4.40,
    cachedInputPricePerMillion: 0.55,
    cacheWritePricePerMillion: null,
    contextWindow: 200000,
    maxOutputTokens: 100000,
    modality: "text",
    toolCallingSupport: true,
    visionSupport: false,
    codingScore: 0.492,
    generalScore: 0.88,
    latencyScore: null,
    outputSpeed: 90,
    sourceConfidence: "official",
    sourceUrl: "https://platform.openai.com/docs/pricing",
    lastUpdated: "2025-11-01",
    deprecated: false,
  },
  {
    id: "openai/o1",
    provider: "openai",
    displayName: "o1",
    tier: "strong",
    inputPricePerMillion: 15.0,
    outputPricePerMillion: 60.0,
    cachedInputPricePerMillion: 7.5,
    cacheWritePricePerMillion: null,
    contextWindow: 200000,
    maxOutputTokens: 100000,
    modality: "text",
    toolCallingSupport: true,
    visionSupport: false,
    codingScore: 0.484,
    generalScore: 0.92,
    latencyScore: null,
    outputSpeed: 45,
    sourceConfidence: "official",
    sourceUrl: "https://platform.openai.com/docs/pricing",
    lastUpdated: "2025-11-01",
    deprecated: false,
  },
  // Low-cost alternatives
  {
    id: "deepseek/deepseek-chat",
    provider: "deepseek",
    displayName: "DeepSeek Chat",
    tier: "cheap",
    inputPricePerMillion: 0.27,
    outputPricePerMillion: 1.10,
    cachedInputPricePerMillion: 0.07,
    cacheWritePricePerMillion: null,
    contextWindow: 64000,
    maxOutputTokens: 8192,
    modality: "text",
    toolCallingSupport: true,
    visionSupport: false,
    codingScore: 0.423,
    generalScore: 0.84,
    latencyScore: null,
    outputSpeed: 55,
    sourceConfidence: "official",
    sourceUrl: "https://api-docs.deepseek.com/",
    lastUpdated: "2025-11-01",
    deprecated: false,
  },
];

export async function getModelsByTier(tier: ModelTier): Promise<ModelRecord[]> {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(models)
      .where(and(eq(models.tier, tier), not(eq(models.deprecated, true))));

    if (rows.length > 0) {
      return rows.map(rowToModel);
    }
  } catch {
    // DB not initialized or empty — fall through to built-in
  }

  return KNOWN_MODELS.filter((m) => m.tier === tier);
}

export async function getAllActiveModels(): Promise<ModelRecord[]> {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(models)
      .where(not(eq(models.deprecated, true)));

    if (rows.length > 0) {
      return rows.map(rowToModel);
    }
  } catch {
    // Fall through
  }

  return KNOWN_MODELS.filter((m) => !m.deprecated);
}

export async function getModelById(id: string): Promise<ModelRecord | null> {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(models)
      .where(eq(models.id, id))
      .limit(1);

    if (rows.length > 0) return rowToModel(rows[0]!);
  } catch {
    // Fall through
  }

  return KNOWN_MODELS.find((m) => m.id === id) ?? null;
}

export function getDefaultStrongModel(): ModelRecord {
  return KNOWN_MODELS.find((m) => m.id === "anthropic/claude-opus-4-5")!;
}

export function getDefaultMidModel(): ModelRecord {
  return KNOWN_MODELS.find((m) => m.id === "anthropic/claude-sonnet-4-5")!;
}

export function getDefaultCheapModel(): ModelRecord {
  return KNOWN_MODELS.find((m) => m.id === "anthropic/claude-3-5-haiku-20241022")!;
}

function rowToModel(row: typeof models.$inferSelect): ModelRecord {
  return {
    id: row.id,
    provider: row.provider,
    displayName: row.displayName,
    tier: row.tier as ModelTier,
    inputPricePerMillion: row.inputPricePerMillion,
    outputPricePerMillion: row.outputPricePerMillion,
    cachedInputPricePerMillion: row.cachedInputPricePerMillion ?? null,
    cacheWritePricePerMillion: row.cacheWritePricePerMillion ?? null,
    contextWindow: row.contextWindow,
    maxOutputTokens: row.maxOutputTokens,
    modality: row.modality,
    toolCallingSupport: row.toolCallingSupport ?? null,
    visionSupport: row.visionSupport ?? null,
    codingScore: row.codingScore ?? null,
    generalScore: row.generalScore ?? null,
    latencyScore: row.latencyScore ?? null,
    outputSpeed: row.outputSpeed ?? null,
    sourceConfidence: row.sourceConfidence as any,
    sourceUrl: row.sourceUrl,
    lastUpdated: row.lastUpdated,
    deprecated: row.deprecated,
  };
}

export { KNOWN_MODELS };
