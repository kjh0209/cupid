import { getDb } from "../db/database.js";
import { benchmarks, models } from "../db/schema.js";
import { logger } from "../utils/logger.js";
import { todayIso } from "../utils/sourceFreshness.js";
import { eq } from "drizzle-orm";
import type { MetricType } from "../types.js";

// Built-in benchmark data from public leaderboards (as of 2026 Q2).
// Sources: SWE-bench Verified, Aider, HumanEval, MMLU, BFCL, MATH, GPQA,
// Artificial Analysis, public model cards.
const BUILTIN_BENCHMARKS: Array<{
  modelId: string;
  benchmarkName: string;
  score: number;
  metricType: MetricType;
  sourceUrl: string;
  notes: string;
}> = [
  // ── SWE-bench Verified (coding quality) ─────────────────────
  { modelId: "anthropic/claude-opus-4-5",          benchmarkName: "SWE-bench Verified", score: 0.727, metricType: "coding_quality", sourceUrl: "https://www.swebench.com/",          notes: "Opus 4.5" },
  { modelId: "anthropic/claude-sonnet-4-5",        benchmarkName: "SWE-bench Verified", score: 0.623, metricType: "coding_quality", sourceUrl: "https://www.swebench.com/",          notes: "Sonnet 4.5" },
  { modelId: "anthropic/claude-haiku-4-5",         benchmarkName: "SWE-bench Verified", score: 0.512, metricType: "coding_quality", sourceUrl: "https://www.swebench.com/",          notes: "Haiku 4.5" },
  { modelId: "anthropic/claude-3-5-sonnet-20241022", benchmarkName: "SWE-bench Verified", score: 0.499, metricType: "coding_quality", sourceUrl: "https://www.swebench.com/",        notes: "Claude 3.5 Sonnet Oct" },
  { modelId: "anthropic/claude-3-5-haiku-20241022",  benchmarkName: "SWE-bench Verified", score: 0.406, metricType: "coding_quality", sourceUrl: "https://www.swebench.com/",        notes: "Claude 3.5 Haiku" },
  { modelId: "openai/gpt-4o",                      benchmarkName: "SWE-bench Verified", score: 0.464, metricType: "coding_quality", sourceUrl: "https://www.swebench.com/",          notes: "GPT-4o" },
  { modelId: "openai/gpt-4o-mini",                 benchmarkName: "SWE-bench Verified", score: 0.284, metricType: "coding_quality", sourceUrl: "https://www.swebench.com/",          notes: "GPT-4o-mini" },
  { modelId: "openai/o3-mini",                     benchmarkName: "SWE-bench Verified", score: 0.493, metricType: "coding_quality", sourceUrl: "https://www.swebench.com/",          notes: "o3-mini medium" },
  { modelId: "openai/o1",                          benchmarkName: "SWE-bench Verified", score: 0.488, metricType: "coding_quality", sourceUrl: "https://www.swebench.com/",          notes: "o1" },
  { modelId: "openai/o3",                          benchmarkName: "SWE-bench Verified", score: 0.713, metricType: "coding_quality", sourceUrl: "https://www.swebench.com/",          notes: "o3 (estimated)" },
  { modelId: "google/gemini-2.5-pro",              benchmarkName: "SWE-bench Verified", score: 0.634, metricType: "coding_quality", sourceUrl: "https://www.swebench.com/",          notes: "Gemini 2.5 Pro" },
  { modelId: "google/gemini-2.0-flash",            benchmarkName: "SWE-bench Verified", score: 0.358, metricType: "coding_quality", sourceUrl: "https://www.swebench.com/",          notes: "Gemini 2.0 Flash" },
  { modelId: "deepseek/deepseek-coder",            benchmarkName: "SWE-bench Verified", score: 0.380, metricType: "coding_quality", sourceUrl: "https://www.swebench.com/",          notes: "DeepSeek Coder V2" },
  { modelId: "deepseek/deepseek-r1",               benchmarkName: "SWE-bench Verified", score: 0.493, metricType: "coding_quality", sourceUrl: "https://www.swebench.com/",          notes: "DeepSeek R1" },
  { modelId: "deepseek/deepseek-v3",               benchmarkName: "SWE-bench Verified", score: 0.420, metricType: "coding_quality", sourceUrl: "https://www.swebench.com/",          notes: "DeepSeek V3" },
  { modelId: "qwen/qwen-2.5-coder-32b",            benchmarkName: "SWE-bench Verified", score: 0.310, metricType: "coding_quality", sourceUrl: "https://www.swebench.com/",          notes: "Qwen2.5 Coder 32B" },
  { modelId: "meta-llama/llama-3.3-70b-instruct",  benchmarkName: "SWE-bench Verified", score: 0.265, metricType: "coding_quality", sourceUrl: "https://www.swebench.com/",          notes: "Llama 3.3 70B" },
  { modelId: "mistralai/mistral-large",            benchmarkName: "SWE-bench Verified", score: 0.310, metricType: "coding_quality", sourceUrl: "https://www.swebench.com/",          notes: "Mistral Large 2" },

  // ── Aider Polyglot Coding Edit Benchmark ────────────────────
  { modelId: "anthropic/claude-opus-4-5",          benchmarkName: "Aider Polyglot", score: 0.792, metricType: "coding_quality", sourceUrl: "https://aider.chat/docs/leaderboards/", notes: "Polyglot edit" },
  { modelId: "anthropic/claude-sonnet-4-5",        benchmarkName: "Aider Polyglot", score: 0.696, metricType: "coding_quality", sourceUrl: "https://aider.chat/docs/leaderboards/", notes: "Sonnet 4.5" },
  { modelId: "anthropic/claude-haiku-4-5",         benchmarkName: "Aider Polyglot", score: 0.502, metricType: "coding_quality", sourceUrl: "https://aider.chat/docs/leaderboards/", notes: "Haiku 4.5" },
  { modelId: "openai/o1",                          benchmarkName: "Aider Polyglot", score: 0.617, metricType: "coding_quality", sourceUrl: "https://aider.chat/docs/leaderboards/", notes: "o1" },
  { modelId: "openai/o3",                          benchmarkName: "Aider Polyglot", score: 0.815, metricType: "coding_quality", sourceUrl: "https://aider.chat/docs/leaderboards/", notes: "o3" },
  { modelId: "openai/gpt-4o",                      benchmarkName: "Aider Polyglot", score: 0.336, metricType: "coding_quality", sourceUrl: "https://aider.chat/docs/leaderboards/", notes: "GPT-4o" },
  { modelId: "openai/gpt-4o-mini",                 benchmarkName: "Aider Polyglot", score: 0.182, metricType: "coding_quality", sourceUrl: "https://aider.chat/docs/leaderboards/", notes: "GPT-4o-mini" },
  { modelId: "google/gemini-2.5-pro",              benchmarkName: "Aider Polyglot", score: 0.726, metricType: "coding_quality", sourceUrl: "https://aider.chat/docs/leaderboards/", notes: "Gemini 2.5 Pro" },
  { modelId: "deepseek/deepseek-r1",               benchmarkName: "Aider Polyglot", score: 0.566, metricType: "coding_quality", sourceUrl: "https://aider.chat/docs/leaderboards/", notes: "R1" },

  // ── HumanEval (functional coding) ───────────────────────────
  { modelId: "anthropic/claude-opus-4-5",          benchmarkName: "HumanEval",        score: 0.965, metricType: "coding_quality", sourceUrl: "https://github.com/openai/human-eval", notes: "Opus 4.5" },
  { modelId: "anthropic/claude-sonnet-4-5",        benchmarkName: "HumanEval",        score: 0.942, metricType: "coding_quality", sourceUrl: "https://github.com/openai/human-eval", notes: "Sonnet 4.5" },
  { modelId: "anthropic/claude-haiku-4-5",         benchmarkName: "HumanEval",        score: 0.892, metricType: "coding_quality", sourceUrl: "https://github.com/openai/human-eval", notes: "Haiku 4.5" },
  { modelId: "openai/gpt-4o",                      benchmarkName: "HumanEval",        score: 0.902, metricType: "coding_quality", sourceUrl: "https://github.com/openai/human-eval", notes: "GPT-4o" },
  { modelId: "openai/gpt-4o-mini",                 benchmarkName: "HumanEval",        score: 0.872, metricType: "coding_quality", sourceUrl: "https://github.com/openai/human-eval", notes: "GPT-4o-mini" },
  { modelId: "google/gemini-2.5-pro",              benchmarkName: "HumanEval",        score: 0.96,  metricType: "coding_quality", sourceUrl: "https://github.com/openai/human-eval", notes: "Gemini 2.5 Pro" },
  { modelId: "google/gemini-2.0-flash",            benchmarkName: "HumanEval",        score: 0.901, metricType: "coding_quality", sourceUrl: "https://github.com/openai/human-eval", notes: "Gemini 2.0 Flash" },
  { modelId: "deepseek/deepseek-coder",            benchmarkName: "HumanEval",        score: 0.901, metricType: "coding_quality", sourceUrl: "https://github.com/openai/human-eval", notes: "DeepSeek Coder V2" },
  { modelId: "deepseek/deepseek-r1",               benchmarkName: "HumanEval",        score: 0.965, metricType: "coding_quality", sourceUrl: "https://github.com/openai/human-eval", notes: "R1" },
  { modelId: "qwen/qwen-2.5-coder-32b",            benchmarkName: "HumanEval",        score: 0.927, metricType: "coding_quality", sourceUrl: "https://github.com/openai/human-eval", notes: "Qwen2.5 Coder 32B" },
  { modelId: "meta-llama/llama-3.3-70b-instruct",  benchmarkName: "HumanEval",        score: 0.886, metricType: "coding_quality", sourceUrl: "https://github.com/openai/human-eval", notes: "Llama 3.3" },

  // ── MMLU (general intelligence) ─────────────────────────────
  { modelId: "anthropic/claude-opus-4-5",          benchmarkName: "MMLU",             score: 0.915, metricType: "general_intelligence", sourceUrl: "https://artificialanalysis.ai/", notes: "MMLU" },
  { modelId: "anthropic/claude-sonnet-4-5",        benchmarkName: "MMLU",             score: 0.888, metricType: "general_intelligence", sourceUrl: "https://artificialanalysis.ai/", notes: "Sonnet 4.5" },
  { modelId: "anthropic/claude-haiku-4-5",         benchmarkName: "MMLU",             score: 0.842, metricType: "general_intelligence", sourceUrl: "https://artificialanalysis.ai/", notes: "Haiku 4.5" },
  { modelId: "anthropic/claude-3-5-haiku-20241022", benchmarkName: "MMLU",            score: 0.82,  metricType: "general_intelligence", sourceUrl: "https://artificialanalysis.ai/", notes: "Claude 3.5 Haiku" },
  { modelId: "openai/gpt-4o",                      benchmarkName: "MMLU",             score: 0.887, metricType: "general_intelligence", sourceUrl: "https://artificialanalysis.ai/", notes: "GPT-4o" },
  { modelId: "openai/gpt-4o-mini",                 benchmarkName: "MMLU",             score: 0.82,  metricType: "general_intelligence", sourceUrl: "https://artificialanalysis.ai/", notes: "GPT-4o-mini" },
  { modelId: "openai/o1",                          benchmarkName: "MMLU",             score: 0.92,  metricType: "general_intelligence", sourceUrl: "https://artificialanalysis.ai/", notes: "o1" },
  { modelId: "openai/o3",                          benchmarkName: "MMLU",             score: 0.93,  metricType: "general_intelligence", sourceUrl: "https://artificialanalysis.ai/", notes: "o3" },
  { modelId: "google/gemini-2.5-pro",              benchmarkName: "MMLU",             score: 0.90,  metricType: "general_intelligence", sourceUrl: "https://artificialanalysis.ai/", notes: "Gemini 2.5" },
  { modelId: "google/gemini-2.0-flash",            benchmarkName: "MMLU",             score: 0.85,  metricType: "general_intelligence", sourceUrl: "https://artificialanalysis.ai/", notes: "Gemini 2.0 Flash" },
  { modelId: "deepseek/deepseek-r1",               benchmarkName: "MMLU",             score: 0.908, metricType: "general_intelligence", sourceUrl: "https://artificialanalysis.ai/", notes: "DeepSeek R1" },
  { modelId: "meta-llama/llama-3.3-70b-instruct",  benchmarkName: "MMLU",             score: 0.86,  metricType: "general_intelligence", sourceUrl: "https://artificialanalysis.ai/", notes: "Llama 3.3" },

  // ── GPQA Diamond (hard reasoning) ───────────────────────────
  { modelId: "anthropic/claude-opus-4-5",          benchmarkName: "GPQA Diamond",     score: 0.745, metricType: "general_intelligence", sourceUrl: "https://artificialanalysis.ai/", notes: "Opus 4.5" },
  { modelId: "anthropic/claude-sonnet-4-5",        benchmarkName: "GPQA Diamond",     score: 0.67,  metricType: "general_intelligence", sourceUrl: "https://artificialanalysis.ai/", notes: "Sonnet 4.5" },
  { modelId: "openai/o1",                          benchmarkName: "GPQA Diamond",     score: 0.776, metricType: "general_intelligence", sourceUrl: "https://artificialanalysis.ai/", notes: "o1" },
  { modelId: "openai/o3",                          benchmarkName: "GPQA Diamond",     score: 0.875, metricType: "general_intelligence", sourceUrl: "https://artificialanalysis.ai/", notes: "o3" },
  { modelId: "google/gemini-2.5-pro",              benchmarkName: "GPQA Diamond",     score: 0.84,  metricType: "general_intelligence", sourceUrl: "https://artificialanalysis.ai/", notes: "Gemini 2.5" },
  { modelId: "deepseek/deepseek-r1",               benchmarkName: "GPQA Diamond",     score: 0.715, metricType: "general_intelligence", sourceUrl: "https://artificialanalysis.ai/", notes: "R1" },

  // ── MATH-500 (math reasoning) ────────────────────────────────
  { modelId: "openai/o1",                          benchmarkName: "MATH-500",         score: 0.949, metricType: "general_intelligence", sourceUrl: "https://artificialanalysis.ai/", notes: "o1" },
  { modelId: "openai/o3",                          benchmarkName: "MATH-500",         score: 0.96,  metricType: "general_intelligence", sourceUrl: "https://artificialanalysis.ai/", notes: "o3" },
  { modelId: "deepseek/deepseek-r1",               benchmarkName: "MATH-500",         score: 0.973, metricType: "general_intelligence", sourceUrl: "https://artificialanalysis.ai/", notes: "R1" },
  { modelId: "anthropic/claude-opus-4-5",          benchmarkName: "MATH-500",         score: 0.91,  metricType: "general_intelligence", sourceUrl: "https://artificialanalysis.ai/", notes: "Opus 4.5" },
  { modelId: "anthropic/claude-sonnet-4-5",        benchmarkName: "MATH-500",         score: 0.86,  metricType: "general_intelligence", sourceUrl: "https://artificialanalysis.ai/", notes: "Sonnet 4.5" },
  { modelId: "google/gemini-2.5-pro",              benchmarkName: "MATH-500",         score: 0.92,  metricType: "general_intelligence", sourceUrl: "https://artificialanalysis.ai/", notes: "Gemini 2.5" },

  // ── BFCL (function calling / tool use) ──────────────────────
  { modelId: "anthropic/claude-opus-4-5",          benchmarkName: "BFCL",             score: 0.91,  metricType: "tool_use",            sourceUrl: "https://gorilla.cs.berkeley.edu/leaderboard.html", notes: "Tool use" },
  { modelId: "anthropic/claude-sonnet-4-5",        benchmarkName: "BFCL",             score: 0.89,  metricType: "tool_use",            sourceUrl: "https://gorilla.cs.berkeley.edu/leaderboard.html", notes: "Sonnet 4.5" },
  { modelId: "anthropic/claude-haiku-4-5",         benchmarkName: "BFCL",             score: 0.85,  metricType: "tool_use",            sourceUrl: "https://gorilla.cs.berkeley.edu/leaderboard.html", notes: "Haiku 4.5" },
  { modelId: "openai/gpt-4o",                      benchmarkName: "BFCL",             score: 0.87,  metricType: "tool_use",            sourceUrl: "https://gorilla.cs.berkeley.edu/leaderboard.html", notes: "GPT-4o" },
  { modelId: "openai/gpt-4o-mini",                 benchmarkName: "BFCL",             score: 0.81,  metricType: "tool_use",            sourceUrl: "https://gorilla.cs.berkeley.edu/leaderboard.html", notes: "GPT-4o-mini" },
  { modelId: "google/gemini-2.5-pro",              benchmarkName: "BFCL",             score: 0.84,  metricType: "tool_use",            sourceUrl: "https://gorilla.cs.berkeley.edu/leaderboard.html", notes: "Gemini 2.5" },

  // ── Output Speed (tokens/sec, Artificial Analysis) ──────────
  { modelId: "anthropic/claude-opus-4-5",          benchmarkName: "AA Output Speed",  score: 72,    metricType: "output_speed",         sourceUrl: "https://artificialanalysis.ai/", notes: "tokens/sec" },
  { modelId: "anthropic/claude-sonnet-4-5",        benchmarkName: "AA Output Speed",  score: 98,    metricType: "output_speed",         sourceUrl: "https://artificialanalysis.ai/", notes: "tokens/sec" },
  { modelId: "anthropic/claude-haiku-4-5",         benchmarkName: "AA Output Speed",  score: 165,   metricType: "output_speed",         sourceUrl: "https://artificialanalysis.ai/", notes: "tokens/sec" },
  { modelId: "anthropic/claude-3-5-haiku-20241022", benchmarkName: "AA Output Speed", score: 145,   metricType: "output_speed",         sourceUrl: "https://artificialanalysis.ai/", notes: "tokens/sec" },
  { modelId: "openai/gpt-4o",                      benchmarkName: "AA Output Speed",  score: 110,   metricType: "output_speed",         sourceUrl: "https://artificialanalysis.ai/", notes: "tokens/sec" },
  { modelId: "openai/gpt-4o-mini",                 benchmarkName: "AA Output Speed",  score: 180,   metricType: "output_speed",         sourceUrl: "https://artificialanalysis.ai/", notes: "tokens/sec" },
  { modelId: "openai/o1",                          benchmarkName: "AA Output Speed",  score: 25,    metricType: "output_speed",         sourceUrl: "https://artificialanalysis.ai/", notes: "Slow, reasoning" },
  { modelId: "openai/o3-mini",                     benchmarkName: "AA Output Speed",  score: 95,    metricType: "output_speed",         sourceUrl: "https://artificialanalysis.ai/", notes: "Reasoning, mid" },
  { modelId: "google/gemini-2.0-flash",            benchmarkName: "AA Output Speed",  score: 240,   metricType: "output_speed",         sourceUrl: "https://artificialanalysis.ai/", notes: "tokens/sec" },
  { modelId: "google/gemini-2.5-pro",              benchmarkName: "AA Output Speed",  score: 85,    metricType: "output_speed",         sourceUrl: "https://artificialanalysis.ai/", notes: "tokens/sec" },
  { modelId: "deepseek/deepseek-r1",               benchmarkName: "AA Output Speed",  score: 60,    metricType: "output_speed",         sourceUrl: "https://artificialanalysis.ai/", notes: "Reasoning" },
  { modelId: "deepseek/deepseek-v3",               benchmarkName: "AA Output Speed",  score: 115,   metricType: "output_speed",         sourceUrl: "https://artificialanalysis.ai/", notes: "tokens/sec" },
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

      // For coding_score, prefer SWE-bench Verified (real-world signal).
      // Fall back to Aider Polyglot, then HumanEval (which is saturated and
      // overstates real coding ability).
      if (entry.metricType === "coding_quality") {
        const isSweBench = entry.benchmarkName.toLowerCase().includes("swe-bench");
        const isAider = entry.benchmarkName.toLowerCase().includes("aider");
        const existingCoding = (await db
          .select({ codingScore: models.codingScore })
          .from(models)
          .where(eq(models.id, entry.modelId))
          .limit(1))[0]?.codingScore ?? 0;
        // Always overwrite from SWE-bench; from Aider only if no current score;
        // from HumanEval never (it's too saturated to be a routing signal).
        if (isSweBench || (isAider && (existingCoding ?? 0) === 0)) {
          await db.update(models).set({ codingScore: entry.score }).where(eq(models.id, entry.modelId));
        }
      } else if (entry.metricType === "general_intelligence") {
        const existingGen = (await db
          .select({ generalScore: models.generalScore })
          .from(models)
          .where(eq(models.id, entry.modelId))
          .limit(1))[0]?.generalScore ?? 0;
        if (entry.score > (existingGen ?? 0)) {
          await db.update(models).set({ generalScore: entry.score }).where(eq(models.id, entry.modelId));
        }
      } else if (entry.metricType === "output_speed") {
        await db.update(models).set({ outputSpeed: entry.score }).where(eq(models.id, entry.modelId));
      }

      count++;
    } catch {
      // Skip
    }
  }

  logger.info(`Collected ${count} benchmark entries`);
  return count;
}
