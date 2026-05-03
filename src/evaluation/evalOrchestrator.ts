import { randomUUID } from "crypto";
import path from "path";
import fs from "fs";
import { getSqlite } from "../db/database.js";
import { taskClassifier } from "../classifier/taskClassifier.js";
import { modelRecommender } from "../recommender/modelRecommender.js";
import { promptTokenOptimizer } from "../optimizer/promptTokenOptimizer.js";
import { planContext } from "../context/contextPlanner.js";
import { planCachePolicy } from "../optimizer/cachePolicyPlanner.js";
import { planVerification } from "../verification/verificationPlanner.js";
import { getModelById, KNOWN_MODELS } from "../recommender/modelTiering.js";
import { listSampleRepos, getRepoById, readRepoFile } from "./repoManager.js";
import { createWorkspace, applyFileChanges } from "./sandboxManager.js";
import { generateWorkspaceDiff } from "./diffService.js";
import { callLLM, parseCodeGenerationOutput } from "./llmExecutor.js";
import { buildCodeGenPrompt } from "./codePromptBuilder.js";
import { runVerification } from "./verificationRunner.js";
import { estimateCost } from "../recommender/costEstimator.js";
import { logger } from "../utils/logger.js";
import type { UserMode } from "../types.js";

export interface EvalRunInput {
  repoId: string;
  taskMessage: string;
  activeFilePath?: string;
  userMode: UserMode;
  experimentMode: "router_vs_strong" | "router_vs_cheap_vs_strong" | "manual_vs_router";
  strongBaselineModel?: string;
  cheapBaselineModel?: string;
  manualModel?: string;
  runVerification?: boolean;
}

export interface EvalRunResult {
  runId: string;
  status: "completed" | "failed" | "partial";
  taskClassification: unknown;
  recommendation: unknown;
  candidates: CandidateResult[];
  metrics: unknown;
  error?: string;
}

export interface CandidateResult {
  label: string;
  modelId: string;
  diff: string;
  filesChanged: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  verificationPassed: boolean | null;
  parseStatus: string;
  summary: string;
}

const STRONG_BASELINE_DEFAULT = "anthropic/claude-opus-4-5";
const CHEAP_BASELINE_DEFAULT = "google/gemini-2.0-flash";

export async function runEvaluation(input: EvalRunInput): Promise<EvalRunResult> {
  const runId = randomUUID();
  const now = new Date().toISOString();
  const sqlite = getSqlite();

  logger.info(`Starting eval run ${runId} for repo ${input.repoId}`);

  // Insert run record
  sqlite.prepare(`
    INSERT INTO eval_runs (id, repo_id, repo_name, task_message, user_mode, experiment_mode, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'running', ?)
  `).run(runId, input.repoId, input.repoId, input.taskMessage, input.userMode, input.experimentMode, now);

  try {
    // 1. Get repo info
    const repo = getRepoById(input.repoId);
    if (!repo) throw new Error(`Repo not found: ${input.repoId}`);

    // 2. Classify task
    const classification = taskClassifier.classify({
      message: input.taskMessage,
      activeFilePath: input.activeFilePath,
      userMode: input.userMode,
    });

    // 3. Recommend model
    const { recommended, fallbackPolicy } = await modelRecommender.recommend(
      classification,
      input.userMode,
      input.taskMessage
    );

    // 4. Optimize prompt
    const promptOpt = promptTokenOptimizer.optimize({
      rawMessage: input.taskMessage,
      taskClassification: classification,
      selectedModel: recommended.modelId,
      userMode: input.userMode,
      activeFilePath: input.activeFilePath,
    });

    // 5. Build context
    const modelRecord = await getModelById(recommended.modelId);
    const contextPlan = planContext({
      taskClassification: classification,
      rawMessage: input.taskMessage,
      optimizedMessage: promptOpt.optimizedMessage,
      activeFile: input.activeFilePath,
      modelContextWindow: modelRecord?.contextWindow ?? 128000,
    });

    const cachePlan = planCachePolicy({
      systemPrompt: "You are an expert coding assistant. Implement the requested changes precisely.",
      currentUserMessage: promptOpt.optimizedMessage,
      selectedModelId: recommended.modelId,
    });

    const verificationPlan = planVerification(classification);

    // Update run with classification + recommendation
    sqlite.prepare(`
      UPDATE eval_runs SET
        optimized_message = ?,
        task_classification_json = ?,
        recommendation_json = ?,
        context_plan_json = ?,
        cache_plan_json = ?,
        verification_plan_json = ?
      WHERE id = ?
    `).run(
      promptOpt.optimizedMessage,
      JSON.stringify(classification),
      JSON.stringify(recommended),
      JSON.stringify(contextPlan),
      JSON.stringify(cachePlan),
      JSON.stringify(verificationPlan),
      runId
    );

    // 6. Load active file content
    let activeFileContent: string | undefined;
    if (input.activeFilePath) {
      try {
        activeFileContent = readRepoFile(input.repoId, input.activeFilePath);
      } catch { /* file might not exist */ }
    }

    // Load related files (first few TypeScript/JS files)
    const relatedFiles = loadRelatedFiles(repo.path, input.activeFilePath);

    // 7. Determine models to run
    const strongModel = input.strongBaselineModel ?? STRONG_BASELINE_DEFAULT;
    const routerModel = recommended.modelId;

    const modelsToRun: Array<{ label: string; model: string }> = [
      { label: "router", model: routerModel },
      { label: "strong_baseline", model: strongModel },
    ];

    if (input.experimentMode === "router_vs_cheap_vs_strong") {
      modelsToRun.push({ label: "cheap_baseline", model: input.cheapBaselineModel ?? CHEAP_BASELINE_DEFAULT });
    }
    if (input.experimentMode === "manual_vs_router" && input.manualModel) {
      modelsToRun.push({ label: "manual", model: input.manualModel });
    }

    // 8. Execute each model
    const candidateResults: CandidateResult[] = [];

    for (const { label, model } of modelsToRun) {
      logger.info(`Executing ${label} with model ${model}`);

      const candidateId = randomUUID();
      const now2 = new Date().toISOString();

      const useOptimized = label === "router";
      const taskMsg = useOptimized ? promptOpt.optimizedMessage : input.taskMessage;

      const { systemPrompt, userPrompt } = buildCodeGenPrompt({
        taskMessage: input.taskMessage,
        optimizedMessage: taskMsg,
        taskClassification: classification,
        activeFilePath: input.activeFilePath,
        activeFileContent,
        relatedFiles,
        repoDescription: repo.description,
        frameworkHints: [repo.framework, repo.language],
      });

      // Create workspace
      const workspace = createWorkspace(repo.path, runId, label);

      let llmOutput: string = "";
      let inputTokens = 0, outputTokens = 0, latencyMs = 0;
      let parseStatus = "failed";
      let diffText = "";
      let filesChanged: unknown[] = [];
      let estimatedCost = 0;
      let candidateSummary = "";

      try {
        const llmResult = await callLLM(model, [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ]);

        llmOutput = llmResult.content;
        inputTokens = llmResult.usage.inputTokens;
        outputTokens = llmResult.usage.outputTokens;
        latencyMs = llmResult.latencyMs;

        // Estimate cost
        const modelRec = await getModelById(model) ?? KNOWN_MODELS.find(m => m.id === model);
        if (modelRec) {
          const costEst = estimateCost(modelRec, { inputTokens, outputTokens, cachedInputTokens: 0 });
          estimatedCost = costEst.estimatedUsd;
        }

        // Parse output
        const parsed = parseCodeGenerationOutput(llmOutput);
        parseStatus = parsed.parseStatus;
        candidateSummary = parsed.summary;
        filesChanged = parsed.filesChanged;

        // Apply file changes to workspace
        if (parsed.filesChanged.length > 0) {
          const changes = parsed.filesChanged
            .filter((f) => f.content != null)
            .map((f) => ({
              path: f.path,
              content: f.content!,
              changeType: f.changeType,
            }));

          if (changes.length > 0) {
            applyFileChanges(workspace.workspacePath, changes);
          }
        }

        // Generate diff
        const diffSummary = generateWorkspaceDiff(
          repo.path,
          workspace.workspacePath,
          input.activeFilePath
        );

        // Build unified diff text
        diffText = diffSummary.fileDiffs
          .filter((d) => d.unifiedDiff)
          .map((d) => d.unifiedDiff)
          .join("\n\n");

      } catch (err) {
        logger.error(`LLM execution failed for ${label}:`, err);
        llmOutput = `Error: ${String(err)}`;
        parseStatus = "failed";
        candidateSummary = String(err);
      }

      // Run verification if requested
      let verificationResult = {
        testPassed: null as boolean | null,
        lintPassed: null as boolean | null,
        typecheckPassed: null as boolean | null,
        buildPassed: null as boolean | null,
        commandResults: [] as unknown[],
        overallSuccess: false,
      };

      if (input.runVerification && parseStatus !== "failed" && filesChanged.length > 0) {
        try {
          verificationResult = await runVerification(
            workspace.workspacePath,
            repo.availableScripts,
            true,
            false,
            false
          );
        } catch (err) {
          logger.warn(`Verification failed for ${label}:`, err);
        }
      }

      // Save candidate
      sqlite.prepare(`
        INSERT INTO eval_candidates
        (id, eval_run_id, label, model_id, tier, workspace_path, raw_prompt, optimized_prompt,
         llm_output_json, output_parse_status, diff_text, files_changed_json,
         input_tokens, output_tokens, total_tokens, estimated_cost_usd, latency_ms,
         verification_json, success, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        candidateId, runId, label, model,
        KNOWN_MODELS.find(m => m.id === model)?.tier ?? "unknown",
        workspace.workspacePath,
        input.taskMessage, taskMsg,
        llmOutput.slice(0, 50000), parseStatus,
        diffText, JSON.stringify(filesChanged),
        inputTokens, outputTokens, inputTokens + outputTokens,
        estimatedCost, latencyMs,
        JSON.stringify(verificationResult),
        verificationResult.overallSuccess ? 1 : null,
        now2
      );

      candidateResults.push({
        label,
        modelId: model,
        diff: diffText,
        filesChanged: Array.isArray(filesChanged) ? filesChanged.length : 0,
        inputTokens,
        outputTokens,
        costUsd: estimatedCost,
        latencyMs,
        verificationPassed: verificationResult.overallSuccess || null,
        parseStatus,
        summary: candidateSummary,
      });
    }

    // 9. Compute metrics
    const routerCandidate = candidateResults.find((c) => c.label === "router");
    const baselineCandidate = candidateResults.find((c) => c.label === "strong_baseline");

    const metricsId = randomUUID();
    const routerCost = routerCandidate?.costUsd ?? 0;
    const baselineCost = baselineCandidate?.costUsd ?? 0;
    const savingsUsd = baselineCost - routerCost;
    const savingsPercent = baselineCost > 0 ? (savingsUsd / baselineCost) * 100 : 0;
    const promptReduction = promptOpt.estimatedSavingsPercent;

    sqlite.prepare(`
      INSERT INTO eval_metrics
      (id, eval_run_id, router_cost_usd, strong_baseline_cost_usd, savings_usd, savings_percent,
       prompt_token_reduction_percent, router_success, baseline_success, quality_retention,
       success_per_dollar, diff_comparison_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      metricsId, runId,
      routerCost, baselineCost, savingsUsd, savingsPercent,
      promptReduction,
      routerCandidate?.verificationPassed ? 1 : null,
      baselineCandidate?.verificationPassed ? 1 : null,
      null, null, "{}", now
    );

    // 10. Mark complete
    sqlite.prepare(`
      UPDATE eval_runs SET status = 'completed', completed_at = ? WHERE id = ?
    `).run(new Date().toISOString(), runId);

    return {
      runId,
      status: "completed",
      taskClassification: classification,
      recommendation: recommended,
      candidates: candidateResults,
      metrics: {
        routerCostUsd: routerCost,
        strongBaselineCostUsd: baselineCost,
        savingsUsd,
        savingsPercent,
        promptTokenReductionPercent: promptReduction,
      },
    };

  } catch (err) {
    const errMsg = String(err);
    logger.error(`Eval run ${runId} failed:`, err);
    sqlite.prepare(`UPDATE eval_runs SET status = 'failed', error_message = ?, completed_at = ? WHERE id = ?`)
      .run(errMsg, new Date().toISOString(), runId);

    return {
      runId,
      status: "failed",
      taskClassification: null,
      recommendation: null,
      candidates: [],
      metrics: null,
      error: errMsg,
    };
  }
}

function loadRelatedFiles(
  repoPath: string,
  activeFilePath?: string,
  maxFiles = 3
): Array<{ path: string; content: string }> {
  const result: Array<{ path: string; content: string }> = [];
  const IGNORED = new Set(["node_modules", ".git", ".next", "dist", "build"]);
  const TEXT_EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".json", ".md"]);

  function walk(dir: string) {
    if (result.length >= maxFiles) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (result.length >= maxFiles) break;
      if (IGNORED.has(entry.name)) continue;
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(repoPath, fullPath).replace(/\\/g, "/");
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (TEXT_EXTS.has(path.extname(entry.name)) && relativePath !== activeFilePath) {
        try {
          const content = fs.readFileSync(fullPath, "utf-8");
          if (content.length < 5000) {
            result.push({ path: relativePath, content });
          }
        } catch { /* skip */ }
      }
    }
  }

  if (fs.existsSync(repoPath)) walk(repoPath);
  return result;
}
