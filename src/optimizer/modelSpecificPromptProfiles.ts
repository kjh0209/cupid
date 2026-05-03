import type { ModelSpecificProfile } from "../types.js";

const PROFILES: Record<string, ModelSpecificProfile> = {
  "anthropic": {
    modelFamily: "anthropic",
    prefersStructuredPrompt: true,
    handlesLongContextWell: true,
    benefitsFromExplicitSteps: true,
    outputBudgetStrategy: "explicit_max_tokens_param",
    cacheStrategy: "prefix_cache_stable_content_first",
    toolStrategy: "minimal_relevant_tools",
    compressionAggressiveness: "medium",
    recommendedPromptShape: "structured_with_explicit_sections",
    notes: [
      "Put stable context (system prompt, repo summary) BEFORE dynamic user message for cache hits",
      "Use clear headings/sections: CONTEXT, TASK, CONSTRAINTS",
      "For coding: request minimal diff output to reduce output tokens",
      "Explicitly state output format and length limits",
      "For high-risk tasks: list constraints before instructions",
    ],
  },
  "openai": {
    modelFamily: "openai",
    prefersStructuredPrompt: true,
    handlesLongContextWell: true,
    benefitsFromExplicitSteps: true,
    outputBudgetStrategy: "max_tokens_parameter",
    cacheStrategy: "prefix_cache_stable_prefix",
    toolStrategy: "json_schema_tools",
    compressionAggressiveness: "medium",
    recommendedPromptShape: "concise_structured_json_output",
    notes: [
      "Use structured outputs / JSON schema for deterministic responses",
      "Stable system prompt + fixed content first for automatic prefix caching",
      "Use max_tokens to prevent over-generation",
      "GPT-4o responds well to numbered steps and explicit output format",
      "Tool definitions in system prompt get cached automatically",
    ],
  },
  "google": {
    modelFamily: "google",
    prefersStructuredPrompt: false,
    handlesLongContextWell: true,
    benefitsFromExplicitSteps: false,
    outputBudgetStrategy: "explicit_length_instruction",
    cacheStrategy: "context_cache_large_docs",
    toolStrategy: "selective_tool_loading",
    compressionAggressiveness: "low",
    recommendedPromptShape: "natural_with_explicit_task",
    notes: [
      "Gemini handles long context well but still select relevant files",
      "Use Gemini context caching for >32k repeated content",
      "Keep task directive explicit and compact",
      "Flash models: use shorter, focused prompts",
      "Gemini 2.5 Pro: can handle complex reasoning with minimal guidance",
    ],
  },
  "meta": {
    modelFamily: "meta",
    prefersStructuredPrompt: true,
    handlesLongContextWell: false,
    benefitsFromExplicitSteps: true,
    outputBudgetStrategy: "explicit_length_instruction",
    cacheStrategy: "not_supported",
    toolStrategy: "minimal_tools",
    compressionAggressiveness: "low",
    recommendedPromptShape: "explicit_constrained_narrow",
    notes: [
      "Use more explicit constraints and narrower context",
      "Avoid ambiguous pronouns; be explicit about which file/function",
      "Prefer smaller, isolated tasks for better reliability",
      "Provide step-by-step instructions for complex tasks",
    ],
  },
  "deepseek": {
    modelFamily: "deepseek",
    prefersStructuredPrompt: true,
    handlesLongContextWell: true,
    benefitsFromExplicitSteps: true,
    outputBudgetStrategy: "explicit_length_instruction",
    cacheStrategy: "not_supported",
    toolStrategy: "minimal_tools",
    compressionAggressiveness: "medium",
    recommendedPromptShape: "structured_coding_directive",
    notes: [
      "DeepSeek Coder excels at structured coding directives",
      "Explicit about file locations and function signatures",
      "Works well with diff/patch format output instructions",
    ],
  },
  "mistral": {
    modelFamily: "mistral",
    prefersStructuredPrompt: true,
    handlesLongContextWell: false,
    benefitsFromExplicitSteps: true,
    outputBudgetStrategy: "explicit_length_instruction",
    cacheStrategy: "not_supported",
    toolStrategy: "minimal_tools",
    compressionAggressiveness: "medium",
    recommendedPromptShape: "concise_directive",
    notes: [
      "Keep context focused and relevant",
      "Explicit output format improves reliability",
    ],
  },
};

export function getModelProfile(modelId: string): ModelSpecificProfile {
  const normalized = modelId.toLowerCase();

  for (const [family, profile] of Object.entries(PROFILES)) {
    if (normalized.includes(family) || normalized.startsWith(family + "/")) {
      return profile;
    }
  }

  // Default profile
  return {
    modelFamily: "unknown",
    prefersStructuredPrompt: true,
    handlesLongContextWell: false,
    benefitsFromExplicitSteps: true,
    outputBudgetStrategy: "explicit_length_instruction",
    cacheStrategy: "not_supported",
    toolStrategy: "minimal_tools",
    compressionAggressiveness: "low",
    recommendedPromptShape: "explicit_constrained",
    notes: ["Unknown model family: use conservative prompting"],
  };
}
