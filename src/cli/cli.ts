#!/usr/bin/env node
import { Command } from "commander";
import { initDb } from "../db/database.js";
import { taskClassifier } from "../classifier/taskClassifier.js";
import { modelRecommender } from "../recommender/modelRecommender.js";
import { promptTokenOptimizer } from "../optimizer/promptTokenOptimizer.js";
import { planCachePolicy } from "../optimizer/cachePolicyPlanner.js";
import { planContext } from "../context/contextPlanner.js";
import { planVerification } from "../verification/verificationPlanner.js";
import { getModelById } from "../recommender/modelTiering.js";
import { logger } from "../utils/logger.js";
import type { UserMode, EngineerChatOutput } from "../types.js";

const program = new Command();
program
  .name("cupid-router")
  .description("Cupid Engineered LLM Router CLI")
  .version("0.1.0");

// ── classify ─────────────────────────────────────────────────
program
  .command("classify")
  .description("Classify a task message")
  .requiredOption("--message <message>", "Developer message to classify")
  .option("--file <path>", "Active file path")
  .option("--mode <mode>", "User mode: cost_saving | balanced | max_quality", "balanced")
  .action(async (opts) => {
    initDb();
    const classification = taskClassifier.classify({
      message: opts.message,
      activeFilePath: opts.file,
      userMode: opts.mode as UserMode,
    });

    console.log("\n╔═══════════════════════════════════════╗");
    console.log("║        TASK CLASSIFICATION            ║");
    console.log("╚═══════════════════════════════════════╝");
    console.log(JSON.stringify(classification, null, 2));
  });

// ── optimize ─────────────────────────────────────────────────
program
  .command("optimize")
  .description("Optimize a prompt message")
  .requiredOption("--message <message>", "Raw developer message to optimize")
  .option("--model <id>", "Target model ID", "anthropic/claude-sonnet-4-5")
  .option("--mode <mode>", "User mode", "balanced")
  .option("--file <path>", "Active file path")
  .action(async (opts) => {
    initDb();
    const classification = taskClassifier.classify({
      message: opts.message,
      activeFilePath: opts.file,
      userMode: opts.mode as UserMode,
    });

    const result = promptTokenOptimizer.optimize({
      rawMessage: opts.message,
      taskClassification: classification,
      selectedModel: opts.model,
      userMode: opts.mode as UserMode,
      activeFilePath: opts.file,
    });

    console.log("\n╔═══════════════════════════════════════╗");
    console.log("║        PROMPT OPTIMIZATION            ║");
    console.log("╚═══════════════════════════════════════╝");
    console.log(`\nOriginal  (${result.originalTokenEstimate} tokens): "${opts.message}"`);
    console.log(`\nOptimized (${result.optimizedTokenEstimate} tokens): "${result.optimizedMessage}"`);
    console.log(`\nToken savings: ${result.estimatedTokenSavings} tokens (${result.estimatedSavingsPercent}%)`);
    console.log(`Semantic risk: ${result.semanticRisk}`);
    console.log(`\nApplied rules: ${result.appliedRules.join(", ") || "none"}`);
    if (result.preservedRequirements.length > 0) {
      console.log(`Preserved: ${result.preservedRequirements.join(", ")}`);
    }
  });

// ── recommend ─────────────────────────────────────────────────
program
  .command("recommend")
  .description("Recommend a model for a task")
  .requiredOption("--message <message>", "Developer message")
  .option("--mode <mode>", "User mode: cost_saving | balanced | max_quality", "balanced")
  .option("--file <path>", "Active file path")
  .option("--baseline <model>", "Baseline model for savings calculation", "anthropic/claude-opus-4-5")
  .action(async (opts) => {
    initDb();
    const classification = taskClassifier.classify({
      message: opts.message,
      activeFilePath: opts.file,
      userMode: opts.mode as UserMode,
    });

    const { recommended, topCandidates, fallbackPolicy } =
      await modelRecommender.recommend(
        classification,
        opts.mode as UserMode,
        opts.message,
        opts.baseline
      );

    console.log("\n╔═══════════════════════════════════════╗");
    console.log("║         MODEL RECOMMENDATION          ║");
    console.log("╚═══════════════════════════════════════╝");
    console.log(`\nTask type:  ${classification.taskType}`);
    console.log(`Difficulty: ${classification.difficulty}/5`);
    console.log(`Risk level: ${classification.riskLevel}/5`);
    console.log(`\n▶ Recommended: ${recommended.modelId} [${recommended.tier}]`);
    console.log(`  Est. cost:   $${recommended.estimatedCost.estimatedUsd.toFixed(5)}`);
    console.log(`  Savings vs ${recommended.estimatedSavingsVsStrong.baselineModel}:`);
    console.log(`             -$${(recommended.estimatedSavingsVsStrong.baselineEstimatedUsd - recommended.estimatedCost.estimatedUsd).toFixed(5)} (${recommended.estimatedSavingsVsStrong.savingsPercent}%)`);
    console.log("\n  Reasons:");
    recommended.reason.forEach((r) => console.log(`  • ${r}`));

    console.log("\n  Top candidates:");
    topCandidates.forEach((c, i) => {
      console.log(`  ${i + 1}. ${c.model.id} [${c.model.tier}] score=${c.score.toFixed(3)} $${c.costEstimate.estimatedUsd.toFixed(5)}`);
    });

    console.log(`\n  Fallback: ${fallbackPolicy.fallbackModel}`);
    console.log(`  On typecheck fail: ${fallbackPolicy.onTypecheckFail}`);
    console.log(`  On test fail: ${fallbackPolicy.onTestFail}`);
  });

// ── engineer ─────────────────────────────────────────────────
program
  .command("engineer")
  .description("Full engineering chat routing (classify + recommend + optimize)")
  .requiredOption("--message <message>", "Developer message")
  .option("--mode <mode>", "User mode", "balanced")
  .option("--file <path>", "Active file path")
  .option("--baseline <model>", "Baseline model", "anthropic/claude-opus-4-5")
  .action(async (opts) => {
    initDb();
    const message = opts.message;
    const userMode = opts.mode as UserMode;

    // 1. Classify
    const classification = taskClassifier.classify({
      message,
      activeFilePath: opts.file,
      userMode,
    });

    // 2. Recommend
    const { recommended, topCandidates, fallbackPolicy } =
      await modelRecommender.recommend(
        classification,
        userMode,
        message,
        opts.baseline
      );

    // 3. Optimize for the recommended model
    const promptOpt = promptTokenOptimizer.optimize({
      rawMessage: message,
      taskClassification: classification,
      selectedModel: recommended.modelId,
      userMode,
      activeFilePath: opts.file,
    });

    // 4. Context plan
    const modelRecord = await getModelById(recommended.modelId);
    const contextPlan = planContext({
      taskClassification: classification,
      rawMessage: message,
      optimizedMessage: promptOpt.optimizedMessage,
      activeFile: opts.file,
      modelContextWindow: modelRecord?.contextWindow ?? 128000,
    });

    // 5. Cache plan
    const cachePlan = planCachePolicy({
      systemPrompt: "You are an expert coding assistant inside Cupid IDE. Help with coding tasks concisely.",
      currentUserMessage: promptOpt.optimizedMessage,
      selectedModelId: recommended.modelId,
    });

    // 6. Verification plan
    const verificationPlan = planVerification(classification);

    const output: EngineerChatOutput = {
      taskClassification: classification,
      recommendedModel: recommended,
      promptOptimization: promptOpt,
      contextPolicy: contextPlan,
      cachePlan,
      fallbackPolicy,
      verificationPlan,
      topCandidates: topCandidates.map((c) => ({
        modelId: c.model.id,
        tier: c.model.tier,
        score: c.score,
        estimatedUsd: c.costEstimate.estimatedUsd,
        reasons: c.reasons,
      })),
    };

    printEngineerOutput(output, message);
  });

function printEngineerOutput(output: EngineerChatOutput, rawMessage: string) {
  const { taskClassification: tc, recommendedModel: rm, promptOptimization: po } = output;

  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║             CUPID ENGINEERED LLM ROUTER              ║");
  console.log("╚══════════════════════════════════════════════════════╝\n");

  console.log("━━━ TASK CLASSIFICATION ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  Task type:   ${tc.taskType}`);
  console.log(`  Difficulty:  ${tc.difficulty}/5`);
  console.log(`  Risk level:  ${tc.riskLevel}/5`);
  console.log(`  Context:     ${tc.contextNeed}`);
  console.log(`  Frameworks:  ${tc.languageOrFramework.join(", ") || "unknown"}`);
  console.log(`  Sensitivity: ${tc.compressionSensitivity}`);

  console.log("\n━━━ RECOMMENDED MODEL ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  ▶ ${rm.modelId} [${rm.tier}]`);
  console.log(`  Input tokens:  ${rm.estimatedCost.inputTokens.toLocaleString()}`);
  console.log(`  Output tokens: ${rm.estimatedCost.outputTokens.toLocaleString()}`);
  console.log(`  Estimated cost: $${rm.estimatedCost.estimatedUsd.toFixed(5)}`);
  console.log(`  Savings vs ${rm.estimatedSavingsVsStrong.baselineModel.split("/")[1]}: ${rm.estimatedSavingsVsStrong.savingsPercent.toFixed(1)}%`);
  console.log("  Reasons:");
  rm.reason.slice(0, 6).forEach((r) => console.log(`    • ${r}`));

  console.log("\n━━━ PROMPT OPTIMIZATION ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  Original  (${po.originalTokenEstimate} tokens): "${rawMessage.slice(0, 80)}${rawMessage.length > 80 ? "..." : ""}"`);
  console.log(`  Optimized (${po.optimizedTokenEstimate} tokens): "${po.optimizedMessage.slice(0, 80)}${po.optimizedMessage.length > 80 ? "..." : ""}"`);
  console.log(`  Savings: ${po.estimatedTokenSavings} tokens (${po.estimatedSavingsPercent}%)`);
  console.log(`  Semantic risk: ${po.semanticRisk}`);
  console.log(`  Rules applied: ${po.appliedRules.join(", ") || "none"}`);

  console.log("\n━━━ TOP CANDIDATES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  output.topCandidates.slice(0, 5).forEach((c, i) => {
    console.log(`  ${i + 1}. ${c.modelId} [${c.tier}]  score=${c.score.toFixed(3)}  $${c.estimatedUsd.toFixed(5)}`);
  });

  console.log("\n━━━ CONTEXT PLAN ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  Include: ${output.contextPolicy.include.join(", ")}`);
  console.log(`  Exclude: ${output.contextPolicy.exclude.join(", ")}`);
  console.log(`  Est. context tokens: ${output.contextPolicy.estimatedContextTokens}`);
  console.log(`  Context risk: ${output.contextPolicy.contextRisk}`);

  console.log("\n━━━ CACHE PLAN ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  Strategy: ${output.cachePlan.cacheStrategy}`);
  console.log(`  Cacheable: ${output.cachePlan.cacheableBlocks.join(", ") || "none"}`);
  console.log(`  Dynamic: ${output.cachePlan.dynamicBlocks.join(", ")}`);
  if (output.cachePlan.notes && output.cachePlan.notes.length > 0) {
    output.cachePlan.notes.slice(0, 2).forEach((n) => console.log(`  ℹ ${n}`));
  }

  console.log("\n━━━ FALLBACK POLICY ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  Fallback model: ${output.fallbackPolicy.fallbackModel}`);
  console.log(`  On typecheck fail: ${output.fallbackPolicy.onTypecheckFail}`);
  console.log(`  On test fail: ${output.fallbackPolicy.onTestFail}`);
  console.log(`  On security detected: ${output.fallbackPolicy.onSecurityDetected}`);

  console.log("\n━━━ VERIFICATION PLAN ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  Required: ${output.verificationPlan.required.join(", ") || "none"}`);
  console.log(`  Optional: ${output.verificationPlan.optional.join(", ") || "none"}`);

  console.log("\n");
}

program.parse(process.argv);
