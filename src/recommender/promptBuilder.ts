// Builds the structured prompt payload for a given model recommendation.

import type { TaskClassification, ModelRecord, ContextPlan } from "../types.js";

export function buildEngineerPrompt(
  optimizedMessage: string,
  classification: TaskClassification,
  model: ModelRecord,
  contextPlan: ContextPlan
): string {
  const parts: string[] = [];

  // System instructions
  parts.push(
    `You are an expert ${classification.languageOrFramework.join("/")} engineer inside Cupid IDE.`
  );

  if (classification.taskType !== "explanation" && classification.taskType !== "prompt_rewrite_only") {
    parts.push("Output only the changed code sections (diff/patch format preferred).");
    parts.push("Do not modify files not mentioned in the task.");
  }

  if (classification.riskLevel >= 4) {
    parts.push(
      "IMPORTANT: This is a high-risk task. Before applying changes, list potentially risky modifications."
    );
  }

  if (classification.needsLongContext) {
    parts.push(`Context window available: ${model.contextWindow.toLocaleString()} tokens. Use selectively.`);
  }

  parts.push("");
  parts.push("--- CONTEXT ---");
  parts.push(`Included: ${contextPlan.include.join(", ")}`);

  if (contextPlan.compressionPlan.length > 0) {
    parts.push(`Compression applied: ${contextPlan.compressionPlan.join("; ")}`);
  }

  parts.push("");
  parts.push("--- TASK ---");
  parts.push(optimizedMessage);

  return parts.join("\n");
}
