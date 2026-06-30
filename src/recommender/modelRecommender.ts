import type {
  TaskClassification,
  ModelRecord,
  ModelCandidate,
  UserMode,
  EngineerChatOutput,
  ModelRecommendation,
  RagResult,
} from "../types.js";
import { getAllActiveModels, getDefaultStrongModel, KNOWN_MODELS } from "./modelTiering.js";
import { getTierPolicy, isTierAllowed, getFallbackPolicy } from "./riskPolicy.js";
import { estimateTokens, estimateCost, estimateSavingsVsBaseline } from "./costEstimator.js";
import { scoreModel, rankCandidates } from "./scoring.js";
import { logger } from "../utils/logger.js";
import { retrieveForTask } from "../rag/retriever.js";

export interface RecommendationResult {
  recommended: ModelRecommendation;
  topCandidates: ModelCandidate[];
  fallbackPolicy: ReturnType<typeof getFallbackPolicy>;
}

export class ModelRecommender {
  async recommend(
    classification: TaskClassification,
    userMode: UserMode,
    optimizedMessage: string,
    baselineModelId?: string,
    selectedCode?: string,
    repoSummary?: string
  ): Promise<RecommendationResult> {
    // Step 1: Get all active models
    let allModels: ModelRecord[];
    try {
      allModels = await getAllActiveModels();
    } catch (err) {
      logger.warn("Failed to fetch models from DB, falling back to built-in catalogue", err);
      allModels = KNOWN_MODELS.filter((m) => !m.deprecated);
    }

    if (allModels.length === 0) {
      allModels = KNOWN_MODELS.filter((m) => !m.deprecated);
    }

    // Step 2: Apply tier policy
    const policy = getTierPolicy(classification, userMode);
    const eligibleModels = allModels.filter((m) =>
      isTierAllowed(m.tier, policy)
    );

    const candidates = eligibleModels.length > 0 ? eligibleModels : allModels;

    // Step 3: Calculate costs for normalization
    const tokens = estimateTokens(
      classification,
      optimizedMessage,
      selectedCode,
      repoSummary
    );

    const allCosts = candidates.map((m) => estimateCost(m, tokens).estimatedUsd);

    // Step 3.5: Retrieve RAG context for this task
    let ragHints: RagResult[] = [];
    try {
      ragHints = await retrieveForTask(optimizedMessage, classification.taskType, 5);
      if (ragHints.length > 0) {
        logger.info(`RAG: ${ragHints.length} hints retrieved (top: "${ragHints[0]!.title}" score=${ragHints[0]!.score.toFixed(3)})`);
      }
    } catch (err) {
      logger.warn("RAG retrieval failed, proceeding without hints", err);
    }

    // Step 4: Score each candidate
    const scoredCandidates: ModelCandidate[] = candidates.map((model) => {
      const { score, reasons } = scoreModel(
        model,
        classification,
        userMode,
        allCosts,
        optimizedMessage,
        selectedCode,
        repoSummary,
        ragHints
      );

      const costEstimate = estimateCost(model, tokens);

      return {
        model,
        score,
        costEstimate,
        qualityScore: 0,
        latencyScore: 0,
        reasons,
      };
    });

    // Step 5: Rank
    const ranked = rankCandidates(scoredCandidates);

    // Step 6: Select winner
    const winner = ranked[0];
    if (!winner) {
      const fallback = getDefaultStrongModel();
      logger.warn("No candidates scored, falling back to strong model");
      const fallbackTokens = estimateTokens(classification, optimizedMessage, selectedCode, repoSummary);
      const fallbackCost = estimateCost(fallback, fallbackTokens);
      return {
        recommended: {
          modelId: fallback.id,
          tier: fallback.tier,
          reason: [policy.reason, "Fallback: no candidates available"],
          estimatedCost: fallbackCost,
          estimatedSavingsVsStrong: {
            baselineModel: fallback.id,
            baselineEstimatedUsd: fallbackCost.estimatedUsd,
            savingsPercent: 0,
          },
        },
        topCandidates: [],
        fallbackPolicy: getFallbackPolicy(fallback.id, classification.riskLevel),
      };
    }

    // Step 7: Calculate savings vs baseline
    const baselineId = baselineModelId ?? "anthropic/claude-opus-4-5";
    const baselineModel =
      allModels.find((m) => m.id === baselineId) ??
      getDefaultStrongModel();

    const { baselineEstimatedUsd, savingsPercent } = estimateSavingsVsBaseline(
      winner.costEstimate.estimatedUsd,
      baselineModel,
      tokens
    );

    const reasons = [
      policy.reason,
      ...winner.reasons,
    ];

    if (savingsPercent > 0) {
      reasons.push(
        `Saves ${savingsPercent.toFixed(1)}% vs ${baselineModel.displayName} ($${baselineEstimatedUsd.toFixed(4)} → $${winner.costEstimate.estimatedUsd.toFixed(4)})`
      );
    }

    const recommended: ModelRecommendation = {
      modelId: winner.model.id,
      tier: winner.model.tier,
      reason: reasons,
      estimatedCost: winner.costEstimate,
      estimatedSavingsVsStrong: {
        baselineModel: baselineModel.id,
        baselineEstimatedUsd,
        savingsPercent,
      },
    };

    const topCandidates = ranked.slice(0, 5);
    const fallbackPolicy = getFallbackPolicy(winner.model.id, classification.riskLevel);

    logger.info(`Recommended: ${winner.model.id} (score: ${winner.score.toFixed(3)}, cost: $${winner.costEstimate.estimatedUsd.toFixed(4)})`);

    return { recommended, topCandidates, fallbackPolicy };
  }
}

export const modelRecommender = new ModelRecommender();
