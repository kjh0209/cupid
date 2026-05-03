import { getDb } from "../db/database.js";
import { benchmarks, models } from "../db/schema.js";
import { logger } from "../utils/logger.js";
import { todayIso } from "../utils/sourceFreshness.js";
import { eq } from "drizzle-orm";
import type { MetricType } from "../types.js";

// Built-in benchmark data from public leaderboards (as of April 2026).
// Sources: SWE-bench Verified, Artificial Analysis, public model cards.
const BUILTIN_BENCHMARKS: Array<{
  modelId: string;
  benchmarkName: string;
  score: number;
  metricType: MetricType;
  sourceUrl: string;
  notes: string;
}> = [
  // SWE-bench Verified (coding quality)
  { modelId: "anthropic/claude-opus-4-5", benchmarkName: "SWE-bench Verified", score: 0.727, metricType: "coding_quality", sourceUrl: "https://www.swebench.com/", notes: "As of 2025-11" },
  { modelId: "anthropic/claude-sonnet-4-5", benchmarkName: "SWE-bench Verified", score: 0.623, metricType: "coding_quality", sourceUrl: "https://www.swebench.com/", notes: "As of 2025-11" },
  { modelId: "anthropic/claude-3-5-sonnet-20241022", benchmarkName: "SWE-bench Verified", score: 0.499, metricType: "coding_quality", sourceUrl: "https://www.swebench.com/", notes: "Claude 3.5 Sonnet Oct" },
  { modelId: "anthropic/claude-3-5-haiku-20241022", benchmarkName: "SWE-bench Verified", score: 0.406, metricType: "coding_quality", sourceUrl: "https://www.swebench.com/", notes: "Claude 3.5 Haiku" },
  { modelId: "openai/gpt-4o", benchmarkName: "SWE-bench Verified", score: 0.464, metricType: "coding_quality", sourceUrl: "https://www.swebench.com/", notes: "GPT-4o" },
  { modelId: "openai/gpt-4o-mini", benchmarkName: "SWE-bench Verified", score: 0.284, metricType: "coding_quality", sourceUrl: "https://www.swebench.com/", notes: "GPT-4o-mini" },
  { modelId: "openai/o3-mini", benchmarkName: "SWE-bench Verified", score: 0.493, metricType: "coding_quality", sourceUrl: "https://www.swebench.com/", notes: "o3-mini medium" },
  { modelId: "openai/o1", benchmarkName: "SWE-bench Verified", score: 0.488, metricType: "coding_quality", sourceUrl: "https://www.swebench.com/", notes: "o1" },
  { modelId: "google/gemini-2.5-pro", benchmarkName: "SWE-bench Verified", score: 0.634, metricType: "coding_quality", sourceUrl: "https://www.swebench.com/", notes: "Gemini 2.5 Pro" },
  { modelId: "google/gemini-2.0-flash", benchmarkName: "SWE-bench Verified", score: 0.358, metricType: "coding_quality", sourceUrl: "https://www.swebench.com/", notes: "Gemini 2.0 Flash" },
  { modelId: "deepseek/deepseek-coder", benchmarkName: "SWE-bench Verified", score: 0.38, metricType: "coding_quality", sourceUrl: "https://www.swebench.com/", notes: "DeepSeek Coder V2" },

  // Artificial Analysis - Output speed (tokens/sec)
  { modelId: "anthropic/claude-opus-4-5", benchmarkName: "AA Output Speed", score: 72, metricType: "output_speed", sourceUrl: "https://artificialanalysis.ai/", notes: "tokens/sec approx" },
  { modelId: "anthropic/claude-sonnet-4-5", benchmarkName: "AA Output Speed", score: 98, metricType: "output_speed", sourceUrl: "https://artificialanalysis.ai/", notes: "tokens/sec approx" },
  { modelId: "anthropic/claude-3-5-haiku-20241022", benchmarkName: "AA Output Speed", score: 145, metricType: "output_speed", sourceUrl: "https://artificialanalysis.ai/", notes: "tokens/sec approx" },
  { modelId: "openai/gpt-4o", benchmarkName: "AA Output Speed", score: 110, metricType: "output_speed", sourceUrl: "https://artificialanalysis.ai/", notes: "tokens/sec approx" },
  { modelId: "openai/gpt-4o-mini", benchmarkName: "AA Output Speed", score: 180, metricType: "output_speed", sourceUrl: "https://artificialanalysis.ai/", notes: "tokens/sec approx" },
  { modelId: "google/gemini-2.0-flash", benchmarkName: "AA Output Speed", score: 240, metricType: "output_speed", sourceUrl: "https://artificialanalysis.ai/", notes: "tokens/sec approx" },
  { modelId: "google/gemini-2.5-pro", benchmarkName: "AA Output Speed", score: 85, metricType: "output_speed", sourceUrl: "https://artificialanalysis.ai/", notes: "tokens/sec approx" },

  // General intelligence (MMLU / general score 0-1)
  { modelId: "anthropic/claude-opus-4-5", benchmarkName: "MMLU General", score: 0.91, metricType: "general_intelligence", sourceUrl: "https://artificialanalysis.ai/", notes: "Approx" },
  { modelId: "anthropic/claude-sonnet-4-5", benchmarkName: "MMLU General", score: 0.88, metricType: "general_intelligence", sourceUrl: "https://artificialanalysis.ai/", notes: "Approx" },
  { modelId: "anthropic/claude-3-5-haiku-20241022", benchmarkName: "MMLU General", score: 0.82, metricType: "general_intelligence", sourceUrl: "https://artificialanalysis.ai/", notes: "Approx" },
  { modelId: "openai/gpt-4o", benchmarkName: "MMLU General", score: 0.887, metricType: "general_intelligence", sourceUrl: "https://artificialanalysis.ai/", notes: "Approx" },
  { modelId: "openai/gpt-4o-mini", benchmarkName: "MMLU General", score: 0.82, metricType: "general_intelligence", sourceUrl: "https://artificialanalysis.ai/", notes: "Approx" },
  { modelId: "google/gemini-2.5-pro", benchmarkName: "MMLU General", score: 0.90, metricType: "general_intelligence", sourceUrl: "https://artificialanalysis.ai/", notes: "Approx" },
  { modelId: "google/gemini-2.0-flash", benchmarkName: "MMLU General", score: 0.85, metricType: "general_intelligence", sourceUrl: "https://artificialanalysis.ai/", notes: "Approx" },
];

export async function collectBuiltinBenchmarks(): Promise<number> {
  const db = getDb();
  let count = 0;
  const today = todayIso();

  for (const entry of BUILTIN_BENCHMARKS) {
    // Only insert if model exists in DB
    const existing = await db
      .select({ id: models.id })
      .from(models)
      .where(eq(models.id, entry.modelId))
      .limit(1);

    if (existing.length === 0) continue;

    try {
      await db.insert(benchmarks).values({
        modelId: entry.modelId,
        benchmarkName: entry.benchmarkName,
        score: entry.score,
        metricType: entry.metricType,
        sourceUrl: entry.sourceUrl,
        dateCollected: today,
        notes: entry.notes,
      }).onConflictDoNothing();

      // Also update model's coding/general/speed scores
      if (entry.metricType === "coding_quality") {
        await db.update(models)
          .set({ codingScore: entry.score })
          .where(eq(models.id, entry.modelId));
      } else if (entry.metricType === "general_intelligence") {
        await db.update(models)
          .set({ generalScore: entry.score })
          .where(eq(models.id, entry.modelId));
      } else if (entry.metricType === "output_speed") {
        await db.update(models)
          .set({ outputSpeed: entry.score })
          .where(eq(models.id, entry.modelId));
      }

      count++;
    } catch {
      // Skip
    }
  }

  logger.info(`Collected ${count} benchmark entries`);
  return count;
}
