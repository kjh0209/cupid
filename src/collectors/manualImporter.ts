import fs from "fs";
import path from "path";
import { parse as parseYaml } from "yaml";
import { parse as parseCsv } from "csv-parse/sync";
import { getDb } from "../db/database.js";
import { models, benchmarks, promptOptimizationRules } from "../db/schema.js";
import { logger } from "../utils/logger.js";
import { todayIso } from "../utils/sourceFreshness.js";
import type { ModelTier, SourceConfidence, MetricType, RuleType, SemanticRisk } from "../types.js";

const DATA_DIR = path.resolve("./data/manual_overrides");

// ── Provider Pricing ────────────────────────────────────────
export async function importManualPricing(): Promise<number> {
  const filePath = path.join(DATA_DIR, "provider_pricing.yaml");
  if (!fs.existsSync(filePath)) {
    logger.warn("provider_pricing.yaml not found, skipping");
    return 0;
  }

  const raw = fs.readFileSync(filePath, "utf-8");
  const data = parseYaml(raw) as { models: Array<Record<string, unknown>> };
  const db = getDb();
  let count = 0;

  for (const m of data.models ?? []) {
    try {
      await db
        .insert(models)
        .values({
          id: String(m["id"] ?? ""),
          provider: String(m["provider"] ?? ""),
          displayName: String(m["display_name"] ?? m["id"] ?? ""),
          tier: (m["tier"] as ModelTier) ?? "unknown",
          inputPricePerMillion: Number(m["input_price_per_million"] ?? 0),
          outputPricePerMillion: Number(m["output_price_per_million"] ?? 0),
          cachedInputPricePerMillion: m["cached_input_price_per_million"] != null
            ? Number(m["cached_input_price_per_million"])
            : null,
          cacheWritePricePerMillion: m["cache_write_price_per_million"] != null
            ? Number(m["cache_write_price_per_million"])
            : null,
          contextWindow: Number(m["context_window"] ?? 4096),
          maxOutputTokens: Number(m["max_output_tokens"] ?? 4096),
          modality: String(m["modality"] ?? "text"),
          toolCallingSupport: m["tool_calling_support"] != null ? Boolean(m["tool_calling_support"]) : null,
          visionSupport: m["vision_support"] != null ? Boolean(m["vision_support"]) : null,
          codingScore: m["coding_score"] != null ? Number(m["coding_score"]) : null,
          generalScore: m["general_score"] != null ? Number(m["general_score"]) : null,
          latencyScore: m["latency_score"] != null ? Number(m["latency_score"]) : null,
          outputSpeed: m["output_speed"] != null ? Number(m["output_speed"]) : null,
          sourceConfidence: (m["source_confidence"] as SourceConfidence) ?? "official",
          sourceUrl: String(m["source_url"] ?? ""),
          lastUpdated: String(m["last_updated"] ?? todayIso()),
          deprecated: Boolean(m["deprecated"] ?? false),
        })
        .onConflictDoUpdate({
          target: models.id,
          set: {
            inputPricePerMillion: Number(m["input_price_per_million"] ?? 0),
            outputPricePerMillion: Number(m["output_price_per_million"] ?? 0),
            cachedInputPricePerMillion: m["cached_input_price_per_million"] != null
              ? Number(m["cached_input_price_per_million"])
              : null,
            cacheWritePricePerMillion: m["cache_write_price_per_million"] != null
              ? Number(m["cache_write_price_per_million"])
              : null,
            tier: (m["tier"] as ModelTier) ?? "unknown",
            contextWindow: Number(m["context_window"] ?? 4096),
            maxOutputTokens: Number(m["max_output_tokens"] ?? 4096),
            lastUpdated: String(m["last_updated"] ?? todayIso()),
          },
        });
      count++;
    } catch (err) {
      logger.error(`Failed to import model ${m["id"]}`, err);
    }
  }

  logger.info(`Imported ${count} models from provider_pricing.yaml`);
  return count;
}

// ── Benchmark Scores ─────────────────────────────────────────
export async function importManualBenchmarks(): Promise<number> {
  const filePath = path.join(DATA_DIR, "benchmark_scores.csv");
  if (!fs.existsSync(filePath)) {
    logger.warn("benchmark_scores.csv not found, skipping");
    return 0;
  }

  const raw = fs.readFileSync(filePath, "utf-8");
  const rows = parseCsv(raw, { columns: true, skip_empty_lines: true }) as Array<Record<string, string>>;
  const db = getDb();
  let count = 0;

  for (const row of rows) {
    try {
      await db.insert(benchmarks).values({
        modelId: row["model_id"] ?? "",
        benchmarkName: row["benchmark_name"] ?? "",
        score: parseFloat(row["score"] ?? "0"),
        metricType: (row["metric_type"] as MetricType) ?? "coding_quality",
        sourceUrl: row["source_url"] ?? "",
        dateCollected: row["date_collected"] ?? todayIso(),
        notes: row["notes"] ?? null,
      }).onConflictDoNothing();
      count++;
    } catch (err) {
      logger.error(`Failed to import benchmark row`, { row, err });
    }
  }

  logger.info(`Imported ${count} benchmark rows from benchmark_scores.csv`);
  return count;
}

// ── Prompt Optimization Rules ─────────────────────────────────
export async function importPromptOptimizationRules(): Promise<number> {
  const filePath = path.join(DATA_DIR, "prompt_optimization_rules.yaml");
  if (!fs.existsSync(filePath)) {
    logger.warn("prompt_optimization_rules.yaml not found, skipping");
    return 0;
  }

  const raw = fs.readFileSync(filePath, "utf-8");
  const data = parseYaml(raw) as { rules: Array<Record<string, unknown>> };
  const db = getDb();
  let count = 0;

  for (const rule of data.rules ?? []) {
    try {
      await db
        .insert(promptOptimizationRules)
        .values({
          id: String(rule["id"] ?? ""),
          title: String(rule["title"] ?? ""),
          description: String(rule["description"] ?? ""),
          ruleType: (rule["rule_type"] as RuleType) ?? "compression",
          appliesToModelsJson: JSON.stringify(rule["applies_to_models"] ?? []),
          appliesToTaskTypesJson: JSON.stringify(rule["applies_to_task_types"] ?? []),
          expectedBenefit: String(rule["expected_benefit"] ?? ""),
          riskLevel: (rule["risk_level"] as SemanticRisk) ?? "low",
          sourceUrl: String(rule["source_url"] ?? ""),
          sourceConfidence: (rule["source_confidence"] as SourceConfidence) ?? "internal",
          lastUpdated: String(rule["last_updated"] ?? todayIso()),
        })
        .onConflictDoUpdate({
          target: promptOptimizationRules.id,
          set: {
            description: String(rule["description"] ?? ""),
            expectedBenefit: String(rule["expected_benefit"] ?? ""),
            lastUpdated: String(rule["last_updated"] ?? todayIso()),
          },
        });
      count++;
    } catch (err) {
      logger.error(`Failed to import rule ${rule["id"]}`, err);
    }
  }

  logger.info(`Imported ${count} prompt optimization rules`);
  return count;
}

export async function importAll(): Promise<void> {
  logger.info("Starting manual data import...");
  await importManualPricing();
  await importManualBenchmarks();
  await importPromptOptimizationRules();
  logger.info("Manual data import complete");
}
