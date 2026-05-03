import type {
  TaskClassificationInput,
  TaskClassification,
  TaskType,
} from "../types.js";
import {
  detectTaskType,
  detectRiskLevel,
  detectDifficulty,
  detectContextNeed,
  detectChangeScope,
  detectFrameworks,
  detectCompressionSensitivity,
  PRIVACY_KEYWORDS,
} from "./rules.js";

function countKeywordHits(text: string, keywords: string[]): number {
  const lower = text.toLowerCase().replace(/[^a-z0-9\s._-]/g, " ");
  return keywords.filter((kw) => {
    const pattern = kw.replace(".", "\\s*");
    return new RegExp(pattern, "i").test(lower);
  }).length;
}

export class TaskClassifier {
  classify(input: TaskClassificationInput): TaskClassification {
    const { message, activeFilePath, selectedCode, changedFiles } = input;

    // Combine all available text signals
    const fullText = [
      message,
      activeFilePath ?? "",
      selectedCode?.slice(0, 500) ?? "",
      (changedFiles ?? []).join(" "),
    ].join(" ");

    // Step 1: Detect task type
    const taskType = detectTaskType(fullText, activeFilePath);

    // Step 2: Detect risk level
    const riskLevel = detectRiskLevel(fullText, taskType);

    // Step 3: Detect difficulty
    const difficulty = detectDifficulty(fullText, taskType);

    // Step 4: Detect context need
    const contextNeed = detectContextNeed(fullText, taskType);

    // Step 5: Detect change scope
    const expectedChangeScope = detectChangeScope(taskType, fullText);

    // Step 6: Detect frameworks / languages
    const languageOrFramework = detectFrameworks(fullText, activeFilePath);

    // Step 7: Tool calling needed?
    const needsToolCalling =
      taskType === "multi_file_refactor" ||
      taskType === "architecture_design" ||
      (changedFiles?.length ?? 0) > 0 ||
      /search|grep|find.file|browse/i.test(message);

    // Step 8: Long context?
    const needsLongContext =
      contextNeed === "huge" ||
      contextNeed === "large" ||
      (selectedCode?.length ?? 0) > 8000;

    // Step 9: Privacy sensitive?
    const privacySensitive = countKeywordHits(fullText, PRIVACY_KEYWORDS) >= 1;

    // Step 10: Compression sensitivity
    const compressionSensitivity = detectCompressionSensitivity(taskType, riskLevel);

    return {
      taskType,
      difficulty,
      riskLevel,
      contextNeed,
      expectedChangeScope,
      languageOrFramework,
      needsToolCalling,
      needsLongContext,
      privacySensitive,
      compressionSensitivity,
    };
  }

  // Optionally merge rule-based classification with an LLM-based one.
  // LLM result takes priority for task_type if provided, but rules constrain risk_level.
  mergeWithLlm(
    rulebased: TaskClassification,
    llmResult: Partial<TaskClassification>
  ): TaskClassification {
    return {
      ...rulebased,
      ...llmResult,
      // Rules win on safety-critical fields
      riskLevel: Math.max(
        rulebased.riskLevel,
        llmResult.riskLevel ?? 0
      ),
      compressionSensitivity:
        rulebased.compressionSensitivity === "high"
          ? "high"
          : llmResult.compressionSensitivity ?? rulebased.compressionSensitivity,
    };
  }
}

export const taskClassifier = new TaskClassifier();
