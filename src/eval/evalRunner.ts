#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { initDb } from "../db/database.js";
import { taskClassifier } from "../classifier/taskClassifier.js";
import { modelRecommender } from "../recommender/modelRecommender.js";
import { promptTokenOptimizer } from "../optimizer/promptTokenOptimizer.js";
import { collectBuiltinBenchmarks } from "../collectors/benchmarkCollector.js";
import { collectBuiltinOptimizationRules } from "../collectors/promptOptimizationCollector.js";
import { importManualPricing } from "../collectors/manualImporter.js";
import { logger } from "../utils/logger.js";
import {
  computeRecommendationMetrics,
  computePromptOptimizationMetrics,
  type EvalResult,
  type RecommendationEvalDetail,
  type PromptOptimizationEvalDetail,
} from "./metrics.js";
import type { EvalTask, PromptOptimizationEvalItem, UserMode } from "../types.js";

const EVAL_TASKS_PATH = path.resolve("./data/eval_tasks.json");
const PROMPT_EVAL_PATH = path.resolve("./data/prompt_optimization_eval.json");
const REPORTS_DIR = path.resolve("./reports");

async function runRecommendationEval(): Promise<void> {
  logger.info("Running recommendation evaluation...");

  const tasks: EvalTask[] = JSON.parse(fs.readFileSync(EVAL_TASKS_PATH, "utf-8"));
  const results: EvalResult<RecommendationEvalDetail>[] = [];

  for (const task of tasks) {
    const classification = taskClassifier.classify({
      message: task.rawMessage,
      userMode: "balanced" as UserMode,
    });

    const { recommended } = await modelRecommender.recommend(
      classification,
      "balanced" as UserMode,
      task.rawMessage
    );

    const actualTier = recommended.tier;
    const tierMatch = task.acceptableTiers.includes(actualTier);
    const wasUnacceptable = task.unacceptableTiers.includes(actualTier);
    const riskViolation = wasUnacceptable;

    results.push({
      id: task.id,
      passed: tierMatch && !wasUnacceptable,
      details: {
        rawMessage: task.rawMessage.slice(0, 80),
        expectedTier: task.expectedTier,
        actualTier,
        selectedModel: recommended.modelId,
        tierMatch,
        wasUnacceptable,
        riskViolation,
        estimatedUsd: recommended.estimatedCost.estimatedUsd,
        notes: task.rationale,
      },
    });
  }

  const metrics = computeRecommendationMetrics(results);
  generateRecommendationReport(results, metrics);

  console.log("\n╔═══════════════════════════════════════════╗");
  console.log("║     RECOMMENDATION EVAL RESULTS           ║");
  console.log("╚═══════════════════════════════════════════╝");
  console.log(`  Total tasks:         ${metrics.totalTasks}`);
  console.log(`  Tier accuracy:       ${(metrics.tierAccuracy * 100).toFixed(1)}%`);
  console.log(`  Overuse strong rate: ${(metrics.overuseStrongRate * 100).toFixed(1)}%`);
  console.log(`  Unsafe cheap rate:   ${(metrics.unsafeCheapRate * 100).toFixed(1)}%`);
  console.log(`  Risk violations:     ${metrics.riskPolicyViolations}`);
  console.log(`  Est. savings vs always-strong: ${metrics.estimatedSavingsPercent}%`);

  const failedTasks = results.filter((r) => !r.passed);
  if (failedTasks.length > 0) {
    console.log(`\n  Failed (${failedTasks.length}):`);
    failedTasks.forEach((r) => {
      console.log(`    ✗ [${r.id}] expected=${r.details.expectedTier} actual=${r.details.actualTier}`);
      if (r.details.riskViolation) console.log(`       ⚠️ RISK POLICY VIOLATION`);
    });
  }

  console.log(`\n  Report: ${path.join(REPORTS_DIR, "eval_recommendation_report.md")}`);
}

async function runPromptOptimizationEval(): Promise<void> {
  logger.info("Running prompt optimization evaluation...");

  const items: PromptOptimizationEvalItem[] = JSON.parse(
    fs.readFileSync(PROMPT_EVAL_PATH, "utf-8")
  );
  const results: EvalResult<PromptOptimizationEvalDetail>[] = [];

  for (const item of items) {
    const classification = taskClassifier.classify({
      message: item.rawMessage,
      userMode: "balanced" as UserMode,
    });

    // Override classification for eval accuracy
    classification.taskType = item.taskType;
    classification.riskLevel = item.riskLevel;

    const result = promptTokenOptimizer.optimize({
      rawMessage: item.rawMessage,
      taskClassification: classification,
      selectedModel: "anthropic/claude-sonnet-4-5",
      userMode: "balanced" as UserMode,
    });

    const originalTokens = result.originalTokenEstimate;
    const optimizedTokens = result.optimizedTokenEstimate;
    const reductionPercent =
      originalTokens > 0
        ? ((originalTokens - optimizedTokens) / originalTokens) * 100
        : 0;

    // Check preserved requirements
    const preserved = item.expectedPreservedRequirements.filter((req) =>
      result.optimizedMessage.toLowerCase().includes(req.toLowerCase()) ||
      result.preservedRequirements.some((p) => p.toLowerCase().includes(req.toLowerCase()))
    );

    // Check should-not-removes
    const missingRequired = item.shouldNotRemove.filter((req) =>
      !result.optimizedMessage.toLowerCase().includes(req.toLowerCase())
    );

    results.push({
      id: item.id,
      passed: missingRequired.length === 0 && result.semanticRisk !== "high",
      details: {
        rawMessage: item.rawMessage.slice(0, 80),
        optimizedMessage: result.optimizedMessage.slice(0, 80),
        taskType: item.taskType,
        riskLevel: item.riskLevel,
        originalTokens,
        optimizedTokens,
        tokenReductionPercent: Math.round(reductionPercent * 10) / 10,
        preservedRequirementsCount: preserved.length,
        totalRequirements: item.expectedPreservedRequirements.length,
        semanticRisk: result.semanticRisk,
        missingRequirements: missingRequired,
        notes: missingRequired.length > 0
          ? `Missing: ${missingRequired.join(", ")}`
          : "OK",
      },
    });
  }

  const metrics = computePromptOptimizationMetrics(results);
  generatePromptOptimizationReport(results, metrics);

  console.log("\n╔═══════════════════════════════════════════╗");
  console.log("║   PROMPT OPTIMIZATION EVAL RESULTS        ║");
  console.log("╚═══════════════════════════════════════════╝");
  console.log(`  Total prompts:              ${metrics.totalPrompts}`);
  console.log(`  Avg token reduction:        ${metrics.avgTokenReductionPercent}%`);
  console.log(`  Preserved requirement rate: ${metrics.preservedRequirementRate}%`);
  console.log(`  High semantic risk rate:    ${metrics.semanticHighRiskRate}%`);
  console.log(`  Overcompression rate:       ${metrics.overcompressionRate}%`);
  console.log(`  High-risk violations:       ${metrics.highRiskCompressionViolationRate}%`);

  const failedItems = results.filter((r) => !r.passed);
  if (failedItems.length > 0) {
    console.log(`\n  Failed (${failedItems.length}):`);
    failedItems.slice(0, 5).forEach((r) => {
      console.log(`    ✗ [${r.id}] ${r.details.notes}`);
    });
  }

  console.log(`\n  Report: ${path.join(REPORTS_DIR, "eval_prompt_optimization_report.md")}`);
}

function generateRecommendationReport(
  results: EvalResult<RecommendationEvalDetail>[],
  metrics: ReturnType<typeof computeRecommendationMetrics>
): void {
  const lines: string[] = [
    "# Recommendation Evaluation Report",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Summary",
    "",
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Total tasks | ${metrics.totalTasks} |`,
    `| Tier accuracy | ${(metrics.tierAccuracy * 100).toFixed(1)}% |`,
    `| Overuse-strong rate | ${(metrics.overuseStrongRate * 100).toFixed(1)}% |`,
    `| Unsafe-cheap rate | ${(metrics.unsafeCheapRate * 100).toFixed(1)}% |`,
    `| Risk policy violations | ${metrics.riskPolicyViolations} |`,
    `| Est. savings vs always-strong | ${metrics.estimatedSavingsPercent}% |`,
    "",
    "## Detailed Results",
    "",
    "| ID | Message | Expected | Actual | Match | Unacceptable | USD |",
    "|----|---------|---------|----|------|--------|-----|",
    ...results.map((r) =>
      `| ${r.id} | ${r.details.rawMessage.slice(0, 40)} | ${r.details.expectedTier} | ${r.details.actualTier} | ${r.details.tierMatch ? "✓" : "✗"} | ${r.details.wasUnacceptable ? "⚠️" : "–"} | $${r.details.estimatedUsd.toFixed(5)} |`
    ),
    "",
    "## Risk Policy Violations",
    "",
    ...(results.filter((r) => r.details.riskViolation).length === 0
      ? ["No risk policy violations detected. ✓"]
      : results
          .filter((r) => r.details.riskViolation)
          .map((r) => `- **[${r.id}]** ${r.details.rawMessage.slice(0, 60)}: assigned ${r.details.actualTier} tier (unacceptable)`)),
  ];

  fs.writeFileSync(
    path.join(REPORTS_DIR, "eval_recommendation_report.md"),
    lines.join("\n")
  );
}

function generatePromptOptimizationReport(
  results: EvalResult<PromptOptimizationEvalDetail>[],
  metrics: ReturnType<typeof computePromptOptimizationMetrics>
): void {
  const lines: string[] = [
    "# Prompt Optimization Evaluation Report",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Summary",
    "",
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Total prompts | ${metrics.totalPrompts} |`,
    `| Avg token reduction | ${metrics.avgTokenReductionPercent}% |`,
    `| Preserved requirement rate | ${metrics.preservedRequirementRate}% |`,
    `| High semantic risk rate | ${metrics.semanticHighRiskRate}% |`,
    `| Overcompression rate | ${metrics.overcompressionRate}% |`,
    `| High-risk compression violations | ${metrics.highRiskCompressionViolationRate}% |`,
    "",
    "## Detailed Results",
    "",
    "| ID | Task | Risk | Original | Optimized | Reduction | Risk | Pass |",
    "|----|------|------|----------|-----------|-----------|------|------|",
    ...results.map((r) =>
      `| ${r.id} | ${r.details.taskType} | ${r.details.riskLevel} | ${r.details.originalTokens} | ${r.details.optimizedTokens} | ${r.details.tokenReductionPercent}% | ${r.details.semanticRisk} | ${r.passed ? "✓" : "✗"} |`
    ),
    "",
    "## Failed Cases",
    "",
    ...(results.filter((r) => !r.passed).length === 0
      ? ["No failures detected. ✓"]
      : results
          .filter((r) => !r.passed)
          .map((r) => `- **[${r.id}]** ${r.details.notes}\n  Original: "${r.details.rawMessage}"\n  Optimized: "${r.details.optimizedMessage}"`)),
  ];

  fs.writeFileSync(
    path.join(REPORTS_DIR, "eval_prompt_optimization_report.md"),
    lines.join("\n")
  );
}

// ── Main ──────────────────────────────────────────────────────
const subcommand = process.argv[2];

async function main() {
  initDb();
  await importManualPricing().catch((err) => {
    logger.warn("Failed to import manual pricing, continuing with existing data", err);
  });
  await collectBuiltinBenchmarks().catch((err) => {
    logger.warn("Failed to collect builtin benchmarks, continuing with existing data", err);
  });
  await collectBuiltinOptimizationRules().catch((err) => {
    logger.warn("Failed to collect optimization rules, continuing with existing data", err);
  });

  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });

  if (subcommand === "recommendation" || subcommand === "all") {
    await runRecommendationEval();
  }
  if (subcommand === "prompt-optimization" || subcommand === "all") {
    await runPromptOptimizationEval();
  }

  if (!subcommand) {
    console.log("Usage: tsx src/eval/evalRunner.ts <recommendation|prompt-optimization|all>");
  }
}

main().catch((err) => {
  logger.error("Eval failed", err);
  process.exit(1);
});
