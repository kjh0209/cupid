import type {
  TaskClassification,
  UserMode,
  PromptOptimizationResult,
  SemanticRisk,
} from "../types.js";
import { estimateTokens } from "../utils/tokenEstimator.js";
import {
  applyFillerRemoval,
  applyConservativeCompression,
  addMinimalDiffInstruction,
  addDoNotTouchInstruction,
  extractPreservedRequirements,
} from "./promptCompressionRules.js";
import { assessSemanticRisk, checkHighRiskCompression } from "./semanticSafetyChecker.js";
import { getModelProfile } from "./modelSpecificPromptProfiles.js";

export interface PromptOptimizerInput {
  rawMessage: string;
  taskClassification: TaskClassification;
  selectedModel: string;
  userMode: UserMode;
  repoMemorySummary?: string;
  recentDecisions?: string[];
  activeFilePath?: string;
  selectedCode?: string;
}

export class PromptTokenOptimizer {
  optimize(input: PromptOptimizerInput): PromptOptimizationResult {
    const {
      rawMessage,
      taskClassification,
      selectedModel,
      userMode,
      recentDecisions,
      activeFilePath,
    } = input;

    const profile = getModelProfile(selectedModel);
    const { compressionSensitivity } = taskClassification;

    const appliedRules: string[] = [];
    const removedContentSummary: string[] = [];
    const modelSpecificNotes: string[] = [...profile.notes];

    // Step 1: Apply compression based on sensitivity
    let optimized: string;
    let compressionRuleNames: string[] = [];
    let removedItems: string[] = [];

    if (compressionSensitivity === "high") {
      const result = applyConservativeCompression(rawMessage, "high");
      optimized = result.text;
      compressionRuleNames = result.appliedRules;
      removedItems = result.removedItems;
      appliedRules.push("no-overcompress-security");
    } else if (compressionSensitivity === "medium") {
      const result = applyConservativeCompression(rawMessage, "medium");
      optimized = result.text;
      compressionRuleNames = result.appliedRules;
      removedItems = result.removedItems;
    } else {
      const result = applyFillerRemoval(rawMessage);
      optimized = result.text;
      compressionRuleNames = result.appliedRules;
      removedItems = result.removedItems;
    }

    appliedRules.push(...compressionRuleNames);
    removedContentSummary.push(...removedItems);

    // Step 2: Add task-specific directives (for editing tasks)
    if (userMode !== "max_quality") {
      const diffResult = addMinimalDiffInstruction(optimized, taskClassification.taskType);
      if (diffResult.applied) {
        optimized = diffResult.text;
        appliedRules.push("patch-diff-instruction");
      }
    }

    // Step 3: Add "do not touch unrelated" for low-risk edits
    if (compressionSensitivity === "low") {
      const noTouchResult = addDoNotTouchInstruction(optimized, taskClassification.taskType);
      if (noTouchResult.applied) {
        optimized = noTouchResult.text;
        appliedRules.push("do-not-touch-unrelated");
      }
    }

    // Step 4: Append reference to recent decisions if relevant
    if (recentDecisions && recentDecisions.length > 0 && compressionSensitivity !== "high") {
      const decisions = recentDecisions.slice(0, 2).join("; ");
      if (!optimized.includes(decisions.slice(0, 20))) {
        optimized += ` (Prior decisions: ${decisions})`;
        appliedRules.push("summarize-old-chat");
      }
    }

    // Step 5: Replace verbose file path with short reference if active file is mentioned
    if (
      activeFilePath &&
      compressionSensitivity === "low" &&
      optimized.includes(activeFilePath)
    ) {
      const shortName = activeFilePath.split("/").pop() ?? activeFilePath;
      optimized = optimized.replace(activeFilePath, shortName);
      appliedRules.push("selective-context-retrieval");
    }

    // Step 6: Clean up
    optimized = optimized.replace(/\s{2,}/g, " ").trim();

    // Step 7: Safety check — ensure high-risk compression limit
    const compressionAllowed = checkHighRiskCompression(
      rawMessage,
      optimized,
      compressionSensitivity
    );
    if (!compressionAllowed) {
      // Revert to conservative if we went too far
      optimized = applyConservativeCompression(rawMessage, "high").text;
      appliedRules.push("no-overcompress-security");
      removedContentSummary.push("Reverted aggressive compression for high-risk task");
    }

    // Step 8: Semantic risk assessment
    const riskAssessment = assessSemanticRisk(rawMessage, optimized, taskClassification);
    const semanticRisk: SemanticRisk = riskAssessment.risk;

    if (riskAssessment.violations.length > 0) {
      removedContentSummary.push(...riskAssessment.violations);
    }

    // Step 9: Token estimates
    // Savings are measured on the compressed content (before instruction additions).
    // Instruction additions (diff hints, scope guards) improve output quality and are
    // counted in optimizedTokenEstimate but not penalized in estimatedTokenSavings.
    const originalTokenEstimate = estimateTokens(rawMessage);
    const optimizedTokenEstimate = estimateTokens(optimized);
    // Track the post-compression length (before instruction additions) for savings calc
    const compressionOnlyText = applyConservativeCompression(rawMessage, compressionSensitivity).text;
    const compressionOnlyTokens = estimateTokens(compressionOnlyText);
    const estimatedTokenSavings = Math.max(0, originalTokenEstimate - compressionOnlyTokens);
    const estimatedSavingsPercent =
      originalTokenEstimate > 0
        ? Math.round((estimatedTokenSavings / originalTokenEstimate) * 1000) / 10
        : 0;

    // Step 10: Preserved requirements
    const preservedRequirements = extractPreservedRequirements(rawMessage, optimized);

    // Step 11: Model-specific notes
    if (profile.cacheStrategy !== "not_supported") {
      modelSpecificNotes.push(
        `Cache strategy: ${profile.cacheStrategy} — place stable context before this message`
      );
    }

    return {
      optimizedMessage: optimized,
      originalTokenEstimate,
      optimizedTokenEstimate,
      estimatedTokenSavings,
      estimatedSavingsPercent,
      appliedRules: [...new Set(appliedRules)],
      semanticRisk,
      removedContentSummary: removedContentSummary.filter(Boolean),
      preservedRequirements,
      modelSpecificNotes,
    };
  }
}

export const promptTokenOptimizer = new PromptTokenOptimizer();
