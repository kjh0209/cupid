import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  EngineerChatSchema,
  ClassifyTaskSchema,
  OptimizePromptSchema,
  RecommendModelSchema,
  LogTaskResultSchema,
} from "./schemas.js";
import { taskClassifier } from "../classifier/taskClassifier.js";
import { modelRecommender } from "../recommender/modelRecommender.js";
import { promptTokenOptimizer } from "../optimizer/promptTokenOptimizer.js";
import { planCachePolicy } from "../optimizer/cachePolicyPlanner.js";
import { planContext } from "../context/contextPlanner.js";
import { planVerification } from "../verification/verificationPlanner.js";
import { collectLiteLLM } from "../collectors/litellmCollector.js";
import { collectOpenRouter } from "../collectors/openrouterCollector.js";
import { importAll } from "../collectors/manualImporter.js";
import { collectBuiltinBenchmarks } from "../collectors/benchmarkCollector.js";
import { collectBuiltinOptimizationRules } from "../collectors/promptOptimizationCollector.js";
import { buildAllDocuments } from "../rag/documentBuilder.js";
import { reindexAll } from "../rag/indexer.js";
import { getDb, getSqlite } from "../db/database.js";
import {
  models,
  promptOptimizationRules,
  recommendationLogs,
  taskLogs,
} from "../db/schema.js";
import { logger } from "../utils/logger.js";
import { nowIso } from "../utils/sourceFreshness.js";
import { randomUUID } from "crypto";
import { getModelById } from "../recommender/modelTiering.js";
import type { EngineerChatOutput } from "../types.js";

export async function registerRoutes(app: FastifyInstance) {

  // ── Health ─────────────────────────────────────────────────
  app.get("/health", async () => ({ status: "ok", ts: new Date().toISOString() }));

  // ── Ingest ────────────────────────────────────────────────
  app.post("/ingest/all", async (_req, reply) => {
    try {
      await importAll();
      const litellmCount = await collectLiteLLM().catch(() => 0);
      const openrouterCount = await collectOpenRouter().catch(() => 0);
      await collectBuiltinBenchmarks();
      await collectBuiltinOptimizationRules();
      await buildAllDocuments();
      return { ok: true, litellmCount, openrouterCount };
    } catch (err) {
      logger.error("Ingest failed", err);
      return reply.status(500).send({ error: String(err) });
    }
  });

  app.post("/ingest/litellm", async (_req, reply) => {
    try {
      const count = await collectLiteLLM();
      return { ok: true, count };
    } catch (err) {
      return reply.status(500).send({ error: String(err) });
    }
  });

  app.post("/ingest/openrouter", async (_req, reply) => {
    try {
      const count = await collectOpenRouter();
      return { ok: true, count };
    } catch (err) {
      return reply.status(500).send({ error: String(err) });
    }
  });

  app.post("/ingest/manual-pricing", async (_req, reply) => {
    try {
      const { importManualPricing } = await import("../collectors/manualImporter.js");
      const count = await importManualPricing();
      return { ok: true, count };
    } catch (err) {
      return reply.status(500).send({ error: String(err) });
    }
  });

  app.post("/ingest/manual-benchmark", async (_req, reply) => {
    try {
      const { importManualBenchmarks } = await import("../collectors/manualImporter.js");
      const count = await importManualBenchmarks();
      return { ok: true, count };
    } catch (err) {
      return reply.status(500).send({ error: String(err) });
    }
  });

  app.post("/ingest/prompt-optimization-rules", async (_req, reply) => {
    try {
      const count = await collectBuiltinOptimizationRules();
      return { ok: true, count };
    } catch (err) {
      return reply.status(500).send({ error: String(err) });
    }
  });

  app.post("/rag/reindex", async (_req, reply) => {
    try {
      await reindexAll();
      return { ok: true };
    } catch (err) {
      return reply.status(500).send({ error: String(err) });
    }
  });

  // ── Classify Task ─────────────────────────────────────────
  app.post("/classify-task", async (req, reply) => {
    const parsed = ClassifyTaskSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const classification = taskClassifier.classify({
      ...parsed.data,
      userMode: parsed.data.userMode,
    });

    return { classification };
  });

  // ── Optimize Prompt ───────────────────────────────────────
  app.post("/optimize-prompt", async (req, reply) => {
    const parsed = OptimizePromptSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const { message, selectedModel, userMode, ...rest } = parsed.data;

    const classification = taskClassifier.classify({
      message,
      activeFilePath: rest.activeFilePath,
      selectedCode: rest.selectedCode,
      repoSummary: rest.repoSummary,
      userMode,
    });

    const result = promptTokenOptimizer.optimize({
      rawMessage: message,
      taskClassification: classification,
      selectedModel: selectedModel ?? "anthropic/claude-sonnet-4-5",
      userMode,
      activeFilePath: rest.activeFilePath,
      selectedCode: rest.selectedCode,
      repoMemorySummary: rest.repoSummary,
      recentDecisions: rest.recentDecisions,
    });

    return { classification, promptOptimization: result };
  });

  // ── Recommend Model ───────────────────────────────────────
  app.post("/recommend-model", async (req, reply) => {
    const parsed = RecommendModelSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const { message, userMode, baselineModel, optimizePrompt, ...rest } = parsed.data;

    const classification = taskClassifier.classify({
      message,
      activeFilePath: rest.activeFilePath,
      selectedCode: rest.selectedCode,
      repoSummary: rest.repoSummary,
      changedFiles: rest.changedFiles,
      userMode,
    });

    let msgForRec = message;
    let promptOpt = null;

    if (optimizePrompt !== false) {
      const opt = promptTokenOptimizer.optimize({
        rawMessage: message,
        taskClassification: classification,
        selectedModel: "anthropic/claude-sonnet-4-5",
        userMode,
        activeFilePath: rest.activeFilePath,
        recentDecisions: rest.recentDecisions,
      });
      msgForRec = opt.optimizedMessage;
      promptOpt = opt;
    }

    const { recommended, topCandidates, fallbackPolicy } = await modelRecommender.recommend(
      classification, userMode, msgForRec, baselineModel, rest.selectedCode, rest.repoSummary
    );

    return {
      classification,
      recommended,
      promptOptimization: promptOpt,
      topCandidates: topCandidates.map((c) => ({
        modelId: c.model.id,
        tier: c.model.tier,
        score: c.score,
        estimatedUsd: c.costEstimate.estimatedUsd,
        reasons: c.reasons,
      })),
      fallbackPolicy,
    };
  });

  // ── Engineer Chat (main endpoint) ────────────────────────
  app.post("/engineer-chat", async (req, reply) => {
    const parsed = EngineerChatSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const requestId = randomUUID();
    const { message, userMode, baselineModel, ...rest } = parsed.data;

    // 1. Classify task
    const classification = taskClassifier.classify({
      message,
      activeFilePath: rest.activeFilePath,
      selectedCode: rest.selectedCode,
      repoSummary: rest.repoSummary,
      changedFiles: rest.changedFiles,
      userMode,
    });

    // 2. Get initial recommendation (with placeholder model) for optimization
    const { recommended, topCandidates, fallbackPolicy } =
      await modelRecommender.recommend(
        classification,
        userMode,
        message,
        baselineModel,
        rest.selectedCode,
        rest.repoSummary
      );

    // 3. Optimize prompt for the recommended model
    const promptOpt = promptTokenOptimizer.optimize({
      rawMessage: message,
      taskClassification: classification,
      selectedModel: recommended.modelId,
      userMode,
      activeFilePath: rest.activeFilePath,
      selectedCode: rest.selectedCode,
      repoMemorySummary: rest.repoSummary,
      recentDecisions: rest.recentDecisions,
    });

    // 4. Re-score with optimized prompt
    const { recommended: finalRec, topCandidates: finalCandidates } =
      await modelRecommender.recommend(
        classification,
        userMode,
        promptOpt.optimizedMessage,
        baselineModel,
        rest.selectedCode,
        rest.repoSummary
      );

    // 5. Plan context
    const selectedModelRecord = await getModelById(finalRec.modelId);
    const contextWindow = selectedModelRecord?.contextWindow ?? 128000;

    const contextPlan = planContext({
      taskClassification: classification,
      rawMessage: message,
      optimizedMessage: promptOpt.optimizedMessage,
      repoSummary: rest.repoSummary,
      activeFile: rest.activeFilePath,
      selectedCode: rest.selectedCode,
      recentDecisions: rest.recentDecisions,
      modelContextWindow: contextWindow,
    });

    // 6. Plan cache policy
    const cachePlan = planCachePolicy({
      systemPrompt: "You are an expert coding assistant inside Cupid IDE.",
      repoSummary: rest.repoSummary,
      currentUserMessage: promptOpt.optimizedMessage,
      selectedModelId: finalRec.modelId,
    });

    // 7. Plan verification
    const verificationPlan = planVerification(classification);

    const output: EngineerChatOutput = {
      taskClassification: classification,
      recommendedModel: finalRec,
      promptOptimization: promptOpt,
      contextPolicy: contextPlan,
      cachePlan,
      fallbackPolicy,
      verificationPlan,
      topCandidates: finalCandidates.map((c) => ({
        modelId: c.model.id,
        tier: c.model.tier,
        score: c.score,
        estimatedUsd: c.costEstimate.estimatedUsd,
        reasons: c.reasons,
      })),
    };

    // 8. Log recommendation
    try {
      const db = getDb();
      await db.insert(recommendationLogs).values({
        requestId,
        rawMessage: message,
        optimizedMessage: promptOpt.optimizedMessage,
        taskJson: JSON.stringify(classification),
        candidateModelsJson: JSON.stringify(finalCandidates.map((c) => c.model.id)),
        selectedModel: finalRec.modelId,
        recommendationJson: JSON.stringify(finalRec),
        promptOptimizationJson: JSON.stringify(promptOpt),
        estimatedRawTokens: promptOpt.originalTokenEstimate,
        estimatedOptimizedTokens: promptOpt.optimizedTokenEstimate,
        estimatedTokenSavings: promptOpt.estimatedTokenSavings,
        createdAt: nowIso(),
      });
    } catch {
      // Non-fatal logging failure
    }

    return output;
  });

  // ── Log Task Result ───────────────────────────────────────
  app.post("/log-task-result", async (req, reply) => {
    const parsed = LogTaskResultSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    try {
      const db = getDb();
      await db.insert(taskLogs).values({
        taskId: parsed.data.taskId,
        userId: parsed.data.userId,
        repoId: parsed.data.repoId,
        rawMessage: parsed.data.rawMessage,
        optimizedMessage: parsed.data.optimizedMessage,
        selectedModel: parsed.data.selectedModel,
        inputTokens: parsed.data.inputTokens,
        outputTokens: parsed.data.outputTokens,
        estimatedCost: parsed.data.estimatedCost,
        actualCost: parsed.data.actualCost,
        latencyMs: parsed.data.latencyMs,
        testPassed: parsed.data.testPassed,
        lintPassed: parsed.data.lintPassed,
        typecheckPassed: parsed.data.typecheckPassed,
        userAccepted: parsed.data.userAccepted,
        escalated: parsed.data.escalated,
        finalModel: parsed.data.finalModel,
        changedFilesCount: parsed.data.changedFilesCount,
        changedLoc: parsed.data.changedLoc,
        createdAt: nowIso(),
      });
      return { ok: true };
    } catch (err) {
      return reply.status(500).send({ error: String(err) });
    }
  });

  // ── Models ────────────────────────────────────────────────
  app.get("/models", async () => {
    const { getAllActiveModels } = await import("../recommender/modelTiering.js");
    const all = await getAllActiveModels();
    return { models: all };
  });

  app.get("/models/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const model = await getModelById(decodeURIComponent(id));
    if (!model) return reply.status(404).send({ error: "Model not found" });
    return { model };
  });

  // ── Prompt Optimization Rules ─────────────────────────────
  app.get("/prompt-optimization-rules", async () => {
    try {
      const db = getDb();
      const rules = await db.select().from(promptOptimizationRules);
      return { rules };
    } catch {
      const { BUILTIN_RULES } = await import("../collectors/promptOptimizationCollector.js").catch(
        () => ({ BUILTIN_RULES: [] })
      );
      return { rules: [] };
    }
  });

  // ── Recommendation Logs ───────────────────────────────────
  app.get("/recommendation-logs", async (req) => {
    const query = req.query as { limit?: string };
    const limit = parseInt(query.limit ?? "50");
    try {
      const sqlite = getSqlite();
      const rows = sqlite
        .prepare("SELECT * FROM recommendation_logs ORDER BY created_at DESC LIMIT ?")
        .all(limit);
      return { logs: rows };
    } catch {
      return { logs: [] };
    }
  });

  // ── Stats ─────────────────────────────────────────────────
  app.get("/stats/cost-savings", async () => {
    try {
      const sqlite = getSqlite();
      const stats = sqlite.prepare(`
        SELECT
          COUNT(*) as total_tasks,
          SUM(estimated_cost) as total_estimated_cost,
          AVG(estimated_cost) as avg_cost_per_task,
          SUM(estimated_token_savings) as total_token_savings,
          AVG(estimated_token_savings) as avg_token_savings
        FROM recommendation_logs
      `).get() as Record<string, number>;
      return { stats };
    } catch {
      return { stats: null };
    }
  });

  app.get("/stats/prompt-token-savings", async () => {
    try {
      const sqlite = getSqlite();
      const stats = sqlite.prepare(`
        SELECT
          AVG(CAST(estimated_token_savings AS FLOAT) / NULLIF(estimated_raw_tokens, 0)) as avg_savings_rate,
          SUM(estimated_token_savings) as total_tokens_saved,
          COUNT(*) as total_requests
        FROM recommendation_logs
        WHERE estimated_raw_tokens > 0
      `).get() as Record<string, number>;
      return { stats };
    } catch {
      return { stats: null };
    }
  });

  app.get("/stats/model-performance", async () => {
    try {
      const sqlite = getSqlite();
      const stats = sqlite.prepare(`
        SELECT
          selected_model,
          COUNT(*) as uses,
          AVG(CASE WHEN test_passed = 1 THEN 1 ELSE 0 END) as test_pass_rate,
          AVG(CASE WHEN escalated = 1 THEN 1 ELSE 0 END) as escalation_rate,
          AVG(estimated_cost) as avg_cost
        FROM task_logs
        GROUP BY selected_model
        ORDER BY uses DESC
      `).all();
      return { stats };
    } catch {
      return { stats: [] };
    }
  });
}
