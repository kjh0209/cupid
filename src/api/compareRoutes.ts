import type { FastifyInstance } from "fastify";
import { taskClassifier } from "../classifier/taskClassifier.js";
import { classifyWithLlm } from "../classifier/llmClassifier.js";
import { modelRecommender } from "../recommender/modelRecommender.js";
import { promptTokenOptimizer } from "../optimizer/promptTokenOptimizer.js";
import { buildExecutorMessages, buildSelfRevisionMessages } from "../optimizer/executorPromptBuilder.js";
import { getModelById } from "../recommender/modelTiering.js";
import { callLLM } from "../evaluation/llmExecutor.js";
import type { LLMMessage } from "../evaluation/llmExecutor.js";
import type { ModelRecord, ModelTier, UserMode, TaskClassification } from "../types.js";
import { logger } from "../utils/logger.js";
import { sessionContextStore } from "../cpl/sessionContextStore.js";
import { extractAndStore } from "../cpl/contextExtractor.js";
import { injectRepoFileTree } from "../cpl/repoFileTree.js";

const BENCHMARK_MODEL_ID = "anthropic/claude-opus-4-5";

type RoutingMode = "rule_based" | "llm_assisted";

interface CompareRequestBody {
  prompt?: string;
  userMode?: UserMode;
  optimizePrompt?: boolean;
  maxTokens?: number;
  routingMode?: RoutingMode;
  classifierModelId?: string;
  /** Raw code context (e.g. active file content) */
  rawCode?: string;
  fileName?: string;
  highlightedRegion?: string;
  gitDiff?: string;
  /** Run a self-revision pass on the router output to close the gap to Opus */
  selfRevise?: boolean;
  /** Use task-aware system prompts + few-shot (default: true) */
  enhancedPrompts?: boolean;
  /** Session/repo key for the Context Preservation Layer */
  sessionKey?: string;
  /** Inject CPL preamble (session memory) into both router and benchmark calls */
  useCpl?: boolean;
  /** Extract durable facts from the response into the CPL after the call */
  extractCpl?: boolean;
}

interface ExecutionResult {
  modelId: string;
  displayName: string;
  tier: string;
  response: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  error?: string;
  revisionApplied?: boolean;
  firstPassResponse?: string;
}

function priceUsd(model: ModelRecord, inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1_000_000) * model.inputPricePerMillion;
  const outputCost = (outputTokens / 1_000_000) * model.outputPricePerMillion;
  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000;
}

async function executeWithMessages(
  model: ModelRecord,
  messages: LLMMessage[],
  maxTokens: number,
  temperature = 0.2,
): Promise<ExecutionResult> {
  const start = Date.now();
  try {
    const res = await callLLM(model.id, messages, temperature, maxTokens);
    return {
      modelId: model.id,
      displayName: model.displayName,
      tier: model.tier,
      response: res.content,
      inputTokens: res.usage.inputTokens,
      outputTokens: res.usage.outputTokens,
      costUsd: priceUsd(model, res.usage.inputTokens, res.usage.outputTokens),
      latencyMs: res.latencyMs,
    };
  } catch (err) {
    return {
      modelId: model.id,
      displayName: model.displayName,
      tier: model.tier,
      response: "",
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      latencyMs: Date.now() - start,
      error: String(err),
    };
  }
}

export async function registerCompareRoutes(app: FastifyInstance) {
  app.post<{ Body: CompareRequestBody }>("/api/compare", async (req, reply) => {
    const body = req.body ?? {};
    const prompt = (body.prompt ?? "").trim();
    const userMode: UserMode = body.userMode ?? "cost_saving";
    const optimizePrompt = body.optimizePrompt ?? true;
    const routingMode: RoutingMode = body.routingMode ?? "rule_based";
    const enhancedPrompts = body.enhancedPrompts ?? true;
    // selfRevise will be finalized after classification (auto-ON for risk≥4)
    const selfReviseOverride = body.selfRevise;
    const sessionKey = body.sessionKey ?? "";
    const useCpl = (body.useCpl ?? true) && !!sessionKey;
    const extractCpl = (body.extractCpl ?? true) && !!sessionKey;
    // Dynamic default based on task type — refactor/architecture/db need more headroom
    const defaultMaxTokens = 4096;
    const maxTokens = Math.min(
      16384,
      Math.max(256, Number(body.maxTokens ?? process.env["COMPARE_MAX_TOKENS"] ?? defaultMaxTokens)),
    );

    if (!prompt) {
      return reply.status(400).send({ error: "prompt is required" });
    }

    let classification: TaskClassification;
    let llmRouting: {
      modelId: string;
      inputTokens: number;
      outputTokens: number;
      costUsd: number;
      latencyMs: number;
      rationale: string | null;
      fellBackToRules: boolean;
      errorMessage?: string;
      ruleBasedSnapshot: TaskClassification;
    } | null = null;

    if (routingMode === "llm_assisted") {
      const r = await classifyWithLlm(
        {
          message: prompt,
          userMode,
          selectedCode: body.rawCode,
          activeFilePath: body.fileName,
        },
        body.classifierModelId ? { modelId: body.classifierModelId } : {},
      );
      classification = r.classification;
      llmRouting = {
        modelId: r.modelId,
        inputTokens: r.inputTokens,
        outputTokens: r.outputTokens,
        costUsd: r.costUsd,
        latencyMs: r.latencyMs,
        rationale: r.rationale,
        fellBackToRules: r.fellBackToRules,
        errorMessage: r.errorMessage,
        ruleBasedSnapshot: r.ruleBased,
      };
      logger.info(`Compare: LLM-assisted classification via ${r.modelId} → ${classification.taskType} (risk=${classification.riskLevel}, fellback=${r.fellBackToRules})`);
    } else {
      classification = taskClassifier.classify({
        message: prompt,
        userMode,
        selectedCode: body.rawCode,
        activeFilePath: body.fileName,
      });
    }

    // Auto-enable self-revision for high-risk tasks (riskLevel≥4) when the
    // caller hasn't explicitly opted out. This closes the quality gap on
    // security/db/refactor/architecture tasks where a second-pass review
    // catches common mistakes without user intervention.
    const selfRevise =
      selfReviseOverride !== undefined
        ? selfReviseOverride
        : classification.riskLevel >= 4;

    // Task 2: inject repo file tree for refactor/architecture tasks so the
    // routed model can reason about the full file structure.
    if (sessionKey && useCpl) {
      injectRepoFileTree({
        sessionKey,
        taskType: classification.taskType,
        sourceModel: "system",
      }).catch((err) => logger.warn("repoFileTree injection failed", err));
    }

    const promptOpt = optimizePrompt
      ? promptTokenOptimizer.optimize({
          rawMessage: prompt,
          taskClassification: classification,
          selectedModel: "anthropic/claude-sonnet-4-5",
          userMode,
          activeFilePath: body.fileName,
          selectedCode: body.rawCode,
        })
      : null;

    const messageForRouter = promptOpt?.optimizedMessage ?? prompt;

    const { recommended, topCandidates } = await modelRecommender.recommend(
      classification,
      userMode,
      messageForRouter,
      BENCHMARK_MODEL_ID,
      body.rawCode,
    );

    const [routerModel, benchmarkModel] = await Promise.all([
      getModelById(recommended.modelId),
      getModelById(BENCHMARK_MODEL_ID),
    ]);

    if (!routerModel) return reply.status(500).send({ error: `Router model ${recommended.modelId} not found in catalogue` });
    if (!benchmarkModel) return reply.status(500).send({ error: `Benchmark model ${BENCHMARK_MODEL_ID} not found in catalogue` });

    const sameModel = routerModel.id === benchmarkModel.id;

    logger.info(`Compare: router=${routerModel.id} vs benchmark=${benchmarkModel.id}`);

    // ── Build CPL preamble (model-agnostic session memory) ──────
    let cplPreamble = "";
    let cplDebug: { entriesUsed: number; tokensUsed: number; debug: unknown } | null = null;
    if (useCpl) {
      const built = sessionContextStore.buildPreamble({
        sessionKey,
        query: prompt + " " + (body.fileName ?? ""),
        taskType: classification.taskType,
        tokenBudget: 1800,
        includeRecentTasks: true,
      });
      cplPreamble = built.preamble;
      cplDebug = {
        entriesUsed: built.entriesUsed.length,
        tokensUsed: built.tokensUsed,
        debug: built.debug,
      };
      if (cplPreamble) {
        logger.info(`CPL: injected ${built.entriesUsed.length} entries (~${built.tokensUsed} tokens) into session=${sessionKey}`);
      }
    }

    // Compose user prompt with CPL preamble — the preamble is injected
    // INSIDE the user message so it travels regardless of which model
    // is being used (system message handling varies per provider).
    const composedUserPrompt = cplPreamble
      ? `${cplPreamble}\n\n${messageForRouter}`
      : messageForRouter;
    const composedBenchmarkPrompt = cplPreamble
      ? `${cplPreamble}\n\n${prompt}`
      : prompt;

    // ── Build executor messages (task-aware system + CPL) ──────
    const routerBuild = enhancedPrompts
      ? buildExecutorMessages({
          userPrompt: composedUserPrompt,
          classification,
          modelTier: routerModel.tier as ModelTier,
          userMode,
          rawCode: body.rawCode,
          fileName: body.fileName,
          highlightedRegion: body.highlightedRegion,
          hasHighlight: !!body.highlightedRegion,
          gitDiff: body.gitDiff,
        })
      : null;

    const routerMessages: LLMMessage[] = routerBuild
      ? routerBuild.messages
      : [
          { role: "system", content: "You are a helpful assistant. Answer the user's request directly and concisely." },
          { role: "user", content: composedUserPrompt },
        ];

    // Benchmark also receives the CPL preamble so the comparison is fair —
    // both models see the same session memory, and the only differences are
    // the model strength and (for the router) prompt optimization.
    const benchmarkMessages: LLMMessage[] = enhancedPrompts
      ? buildExecutorMessages({
          userPrompt: composedBenchmarkPrompt,
          classification,
          modelTier: benchmarkModel.tier as ModelTier,
          userMode,
          rawCode: body.rawCode,
          fileName: body.fileName,
          highlightedRegion: body.highlightedRegion,
          hasHighlight: !!body.highlightedRegion,
          gitDiff: body.gitDiff,
        }).messages
      : [
          { role: "system", content: "You are a helpful assistant. Answer the user's request directly and concisely." },
          { role: "user", content: composedBenchmarkPrompt + (body.rawCode ? `\n\n--- code ---\n${body.rawCode}` : "") },
        ];

    // ── Execute router + benchmark in parallel ─────────────────
    let [routerExec, benchmarkExec] = sameModel
      ? await Promise.all([
          executeWithMessages(routerModel, routerMessages, maxTokens),
          Promise.resolve<ExecutionResult | null>(null),
        ])
      : await Promise.all([
          executeWithMessages(routerModel, routerMessages, maxTokens),
          executeWithMessages(benchmarkModel, benchmarkMessages, maxTokens),
        ]);

    // ── Auto-fallback: if router produced empty/error response, escalate ───
    // Pick the next candidate from topCandidates that has a different model id.
    if ((!routerExec.response || routerExec.error) && topCandidates.length > 1) {
      const fallback = topCandidates.find((c) => c.model.id !== routerModel.id && !c.model.deprecated);
      if (fallback) {
        logger.warn(`Compare: router ${routerModel.id} returned empty/error, falling back to ${fallback.model.id}`);
        const fallbackExec = await executeWithMessages(fallback.model, routerMessages, maxTokens);
        if (fallbackExec.response && !fallbackExec.error) {
          routerExec = {
            ...fallbackExec,
            // Surface the fallback so the UI shows what really ran
            modelId: fallback.model.id,
            displayName: fallback.model.displayName,
            tier: fallback.model.tier,
          };
        }
      }
    }

    // ── Optional: self-revision pass on the router output ──────
    let finalRouterExec = routerExec;
    if (selfRevise && routerExec.response && !routerExec.error && routerBuild) {
      const revisionMessages = buildSelfRevisionMessages({
        originalSystem: routerBuild.system.systemMessage,
        userPrompt: messageForRouter,
        codeContext: routerBuild.cpl?.compressedCode,
        firstResponse: routerExec.response,
        taskType: classification.taskType,
      });
      const revisionExec = await executeWithMessages(routerModel, revisionMessages, maxTokens, 0.2);
      if (revisionExec.response && !revisionExec.error && !/REVISION:\s*no changes/i.test(revisionExec.response)) {
        finalRouterExec = {
          ...routerExec,
          response: revisionExec.response,
          inputTokens: routerExec.inputTokens + revisionExec.inputTokens,
          outputTokens: routerExec.outputTokens + revisionExec.outputTokens,
          costUsd: Math.round((routerExec.costUsd + revisionExec.costUsd) * 1_000_000) / 1_000_000,
          latencyMs: routerExec.latencyMs + revisionExec.latencyMs,
          revisionApplied: true,
          firstPassResponse: routerExec.response,
        };
      } else {
        finalRouterExec = { ...routerExec, revisionApplied: false, firstPassResponse: routerExec.response };
      }
    }

    const benchmarkResult = benchmarkExec ?? finalRouterExec;
    const savingsUsd = Math.max(0, benchmarkResult.costUsd - finalRouterExec.costUsd);
    const savingsPercent =
      benchmarkResult.costUsd > 0 ? (savingsUsd / benchmarkResult.costUsd) * 100 : 0;

    // ── CPL: record task history + extract durable facts ──────
    let cplExtraction: { stored: number; facts: Array<{ kind: string; title: string }> } | null = null;
    if (sessionKey && finalRouterExec.response && !finalRouterExec.error) {
      try {
        sessionContextStore.recordTask({
          sessionKey,
          promptSummary: prompt.slice(0, 480),
          taskType: classification.taskType,
          routedModel: finalRouterExec.modelId,
          responseSummary: finalRouterExec.response.slice(0, 480),
          tokensIn: finalRouterExec.inputTokens,
          tokensOut: finalRouterExec.outputTokens,
          costUsd: finalRouterExec.costUsd,
          metadata: { riskLevel: classification.riskLevel, difficulty: classification.difficulty },
        });
        if (extractCpl) {
          const ext = await extractAndStore({
            sessionKey,
            userPrompt: prompt,
            routedModel: finalRouterExec.modelId,
            responseContent: finalRouterExec.response,
            taskType: classification.taskType,
            fileName: body.fileName,
            rawCode: body.rawCode,
          }, { useLlm: classification.difficulty >= 3 && finalRouterExec.response.length > 600 });
          cplExtraction = {
            stored: ext.stored,
            facts: ext.facts.map((f) => ({ kind: f.kind, title: f.title })),
          };
        }
      } catch (err) {
        logger.warn("CPL record/extract failed", err);
      }
    }

    return reply.send({
      prompt,
      optimizedPrompt: promptOpt?.optimizedMessage ?? prompt,
      promptTokenSavings: promptOpt?.estimatedTokenSavings ?? 0,
      routingMode,
      classification: {
        taskType: classification.taskType,
        riskLevel: classification.riskLevel,
        complexity: classification.difficulty,
        contextNeed: classification.contextNeed,
      },
      llmRouting,
      executor: routerBuild
        ? {
            systemReinforcements: routerBuild.system.appliedReinforcements,
            fewShotCount: routerBuild.system.fewShotMessages.length,
            cplStrategies: routerBuild.cpl?.appliedStrategies ?? [],
            cplReductionPercent: routerBuild.cpl?.reductionPercent ?? 0,
            cplOriginalChars: routerBuild.cpl?.originalChars ?? 0,
            cplCompressedChars: routerBuild.cpl?.compressedChars ?? 0,
            selfReviseRequested: selfRevise,
            selfReviseAutoTriggered: selfReviseOverride === undefined && classification.riskLevel >= 4,
            selfReviseApplied: finalRouterExec.revisionApplied ?? false,
          }
        : null,
      cpl: cplDebug ? {
        sessionKey,
        injectedEntries: cplDebug.entriesUsed,
        injectedTokens: cplDebug.tokensUsed,
        extracted: cplExtraction,
        retrievalDebug: cplDebug.debug,
      } : null,
      routing: {
        selectedModel: recommended.modelId,
        tier: recommended.tier,
        reasons: recommended.reason,
        topCandidates: topCandidates.slice(0, 5).map((c) => ({
          modelId: c.model.id,
          tier: c.model.tier,
          score: c.score,
          estimatedUsd: c.costEstimate.estimatedUsd,
        })),
      },
      router: finalRouterExec,
      benchmark: { ...benchmarkResult, isBenchmark: true, modelId: benchmarkModel.id, displayName: benchmarkModel.displayName, tier: benchmarkModel.tier },
      comparison: {
        sameModel,
        savingsUsd,
        savingsPercent,
        latencyDeltaMs: benchmarkResult.latencyMs - finalRouterExec.latencyMs,
      },
    });
  });
}
