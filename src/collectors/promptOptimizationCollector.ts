import { getDb } from "../db/database.js";
import { promptOptimizationRules } from "../db/schema.js";
import { logger } from "../utils/logger.js";
import { todayIso } from "../utils/sourceFreshness.js";

// Built-in prompt optimization rules based on official provider documentation
// and engineering best practices.
export const BUILTIN_RULES = [
  {
    id: "stable-context-first",
    title: "Place stable context before dynamic instructions",
    description: "Put system prompt, repo summary, coding conventions, and tool definitions before the user message. This enables prompt caching on providers that support prefix-based caching (Anthropic, OpenAI).",
    ruleType: "caching",
    appliesToModels: ["anthropic", "openai"],
    appliesToTaskTypes: ["all"],
    expectedBenefit: "Up to 90% cost reduction on cached tokens; latency reduction on repeated context",
    riskLevel: "low",
    sourceUrl: "https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching",
    sourceConfidence: "official",
  },
  {
    id: "cache-static-system-prompt",
    title: "Cache large static system prompts",
    description: "For system prompts exceeding 1024 tokens (Anthropic) or 1024 tokens (OpenAI), add cache_control breakpoints to enable prefix caching. Particularly valuable for coding conventions and long tool definitions.",
    ruleType: "caching",
    appliesToModels: ["anthropic/claude-3-5-sonnet", "anthropic/claude-3-5-haiku", "openai/gpt-4o"],
    appliesToTaskTypes: ["all"],
    expectedBenefit: "90% cost reduction on the cached prefix in subsequent requests",
    riskLevel: "low",
    sourceUrl: "https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching",
    sourceConfidence: "official",
  },
  {
    id: "remove-filler-language",
    title: "Remove filler and conversational padding",
    description: "Remove phrases like 'Can you maybe...', 'I was thinking...', 'if possible', 'perhaps', 'maybe just'. Convert natural language requests into compact imperative directives.",
    ruleType: "compression",
    appliesToModels: ["all"],
    appliesToTaskTypes: ["all"],
    expectedBenefit: "10-35% token reduction on typical developer messages with no semantic loss",
    riskLevel: "low",
    sourceUrl: "https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview",
    sourceConfidence: "official",
  },
  {
    id: "compact-action-list",
    title: "Convert verbose instructions to compact action list",
    description: "Reformat multi-sentence instructions as a numbered or bulleted list of actions. Eliminates repetition and makes requirements explicit.",
    ruleType: "compression",
    appliesToModels: ["all"],
    appliesToTaskTypes: ["api_implementation", "multi_file_refactor", "test_generation", "local_bug_fix"],
    expectedBenefit: "15-40% token reduction with improved clarity",
    riskLevel: "low",
    sourceUrl: "https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview",
    sourceConfidence: "official",
  },
  {
    id: "patch-diff-instruction",
    title: "Request patch/diff output instead of full file",
    description: "For editing tasks, instruct the model to output only the changed sections or a unified diff, not the entire file. Prevents large output token waste.",
    ruleType: "output_limiting",
    appliesToModels: ["all"],
    appliesToTaskTypes: ["simple_edit", "local_bug_fix", "api_implementation", "ui_change"],
    expectedBenefit: "40-80% output token reduction for edits to large files",
    riskLevel: "low",
    sourceUrl: "https://platform.openai.com/docs/guides/prompt-engineering",
    sourceConfidence: "official",
  },
  {
    id: "explicit-output-budget",
    title: "Add explicit max output token budget",
    description: "Include an instruction like 'Keep response under X lines' or use max_tokens parameter. Prevents over-generation and reduces cost.",
    ruleType: "output_limiting",
    appliesToModels: ["all"],
    appliesToTaskTypes: ["explanation", "simple_edit", "test_generation"],
    expectedBenefit: "Prevents 2-5x output bloat on explanation tasks",
    riskLevel: "low",
    sourceUrl: "https://platform.openai.com/docs/guides/prompt-engineering",
    sourceConfidence: "official",
  },
  {
    id: "selective-context-retrieval",
    title: "Retrieve only relevant files, not full repo",
    description: "Instead of providing all files, retrieve only the files referenced by the task: active file, related modules, test files for the component. Use repo map + selective fetch.",
    ruleType: "context_selection",
    appliesToModels: ["all"],
    appliesToTaskTypes: ["all"],
    expectedBenefit: "50-90% reduction in context tokens for large repos",
    riskLevel: "low",
    sourceUrl: "https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview",
    sourceConfidence: "official",
  },
  {
    id: "summarize-old-chat",
    title: "Summarize old chat turns instead of resending raw",
    description: "For long sessions, replace old conversation history with a compact summary of decisions made. Keep only the last 2-3 turns raw. Generate a 'session context' summary.",
    ruleType: "context_selection",
    appliesToModels: ["all"],
    appliesToTaskTypes: ["all"],
    expectedBenefit: "30-70% reduction in chat history tokens",
    riskLevel: "low",
    sourceUrl: "https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview",
    sourceConfidence: "official",
  },
  {
    id: "lazy-tool-loading",
    title: "Use lazy/selective tool loading for large tool sets",
    description: "When tool definitions are large, only include tools relevant to the current task. For general tasks, skip specifying tool schemas entirely. For coding, include only search, read, edit, write.",
    ruleType: "tool_loading",
    appliesToModels: ["all"],
    appliesToTaskTypes: ["all"],
    expectedBenefit: "20-60% input token reduction when tool schemas are large",
    riskLevel: "low",
    sourceUrl: "https://docs.anthropic.com/en/docs/build-with-claude/tool-use",
    sourceConfidence: "official",
  },
  {
    id: "no-overcompress-security",
    title: "Never overcompress security-sensitive requirements",
    description: "When the task involves auth, secrets, payments, permissions, SQL injection, XSS, or CSRF, preserve all explicit requirements. Do not remove constraints, threat model descriptions, or acceptance criteria.",
    ruleType: "safety",
    appliesToModels: ["all"],
    appliesToTaskTypes: ["security_sensitive_change"],
    expectedBenefit: "Prevents silently dropping critical security requirements",
    riskLevel: "high",
    sourceUrl: "https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview",
    sourceConfidence: "official",
  },
  {
    id: "preserve-identifiers",
    title: "Always preserve filenames, function names, and API names",
    description: "During compression, never remove or alter specific identifiers: function names, file paths, API names, variable names, error messages, library names. These are load-bearing references.",
    ruleType: "safety",
    appliesToModels: ["all"],
    appliesToTaskTypes: ["all"],
    expectedBenefit: "Prevents loss of precision in implementation directives",
    riskLevel: "high",
    sourceUrl: "internal",
    sourceConfidence: "internal",
  },
  {
    id: "gemini-context-caching",
    title: "Use Gemini context caching for large repeated documents",
    description: "Google Gemini supports context caching for repeated large documents (min 32k tokens). Cache repo documentation, large codebases, or long system prompts that persist across requests.",
    ruleType: "caching",
    appliesToModels: ["google/gemini-1.5-pro", "google/gemini-2.0", "google/gemini-2.5-pro"],
    appliesToTaskTypes: ["all"],
    expectedBenefit: "Significant cost reduction on Gemini when context > 32k tokens",
    riskLevel: "low",
    sourceUrl: "https://ai.google.dev/gemini-api/docs/caching",
    sourceConfidence: "official",
  },
  {
    id: "do-not-touch-unrelated",
    title: "Add instruction to not modify unrelated files",
    description: "Append 'Do not modify unrelated files' or 'Only change the specified file' to coding prompts. Prevents models from refactoring unrelated code unprompted.",
    ruleType: "output_limiting",
    appliesToModels: ["all"],
    appliesToTaskTypes: ["simple_edit", "local_bug_fix", "api_implementation", "ui_change"],
    expectedBenefit: "Prevents unnecessary output and unintended side effects",
    riskLevel: "low",
    sourceUrl: "internal",
    sourceConfidence: "internal",
  },
  {
    id: "structured-output-schema",
    title: "Use structured output schemas for predictable responses",
    description: "For tasks requiring structured output (code review, analysis), use JSON schema or function calling to constrain format. Reduces output token overhead from formatting prose.",
    ruleType: "model_specific",
    appliesToModels: ["openai/gpt-4o", "openai/gpt-4o-mini", "anthropic"],
    appliesToTaskTypes: ["explanation", "architecture_design"],
    expectedBenefit: "15-30% output token reduction; better parseability",
    riskLevel: "low",
    sourceUrl: "https://platform.openai.com/docs/guides/structured-outputs",
    sourceConfidence: "official",
  },
  {
    id: "preserve-test-requirements",
    title: "Preserve all test and acceptance criteria during compression",
    description: "When task mentions specific test cases, edge cases, or 'make sure X works', always preserve these. Compression must not remove test requirements or edge case handling.",
    ruleType: "safety",
    appliesToModels: ["all"],
    appliesToTaskTypes: ["test_generation", "local_bug_fix", "api_implementation"],
    expectedBenefit: "Prevents silently dropping test requirements",
    riskLevel: "high",
    sourceUrl: "internal",
    sourceConfidence: "internal",
  },
];

export async function collectBuiltinOptimizationRules(): Promise<number> {
  const db = getDb();
  let count = 0;
  const today = todayIso();

  for (const rule of BUILTIN_RULES) {
    try {
      await db
        .insert(promptOptimizationRules)
        .values({
          id: rule.id,
          title: rule.title,
          description: rule.description,
          ruleType: rule.ruleType as any,
          appliesToModelsJson: JSON.stringify(rule.appliesToModels),
          appliesToTaskTypesJson: JSON.stringify(rule.appliesToTaskTypes),
          expectedBenefit: rule.expectedBenefit,
          riskLevel: rule.riskLevel as any,
          sourceUrl: rule.sourceUrl,
          sourceConfidence: rule.sourceConfidence as any,
          lastUpdated: today,
        })
        .onConflictDoUpdate({
          target: promptOptimizationRules.id,
          set: {
            description: rule.description,
            expectedBenefit: rule.expectedBenefit,
            lastUpdated: today,
          },
        });
      count++;
    } catch (err) {
      logger.error(`Failed to insert rule ${rule.id}`, err);
    }
  }

  logger.info(`Collected ${count} built-in optimization rules`);
  return count;
}
