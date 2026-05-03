import type { CachePlan, CacheStrategy } from "../types.js";
import { extractProvider } from "../utils/normalizeModelId.js";

const CACHE_SUPPORTED_PROVIDERS = ["anthropic", "openai", "google"];

const CACHE_MIN_TOKENS: Record<string, number> = {
  anthropic: 1024,
  openai: 1024,
  google: 32768,
};

export interface CachePolicyInput {
  systemPrompt?: string;
  repoSummary?: string;
  fileSummaries?: string[];
  codingConventions?: string;
  toolDefinitions?: string;
  recentChatHistory?: string;
  currentUserMessage: string;
  selectedModelId: string;
}

export function planCachePolicy(input: CachePolicyInput): CachePlan {
  const provider = extractProvider(input.selectedModelId);
  const supportsCache = CACHE_SUPPORTED_PROVIDERS.includes(provider);
  const minCacheTokens = CACHE_MIN_TOKENS[provider] ?? 1024;

  const cacheableBlocks: string[] = [];
  const dynamicBlocks: string[] = [];
  const notes: string[] = [];

  let cacheStrategy: CacheStrategy;

  if (supportsCache) {
    cacheStrategy = "provider_supported";

    // Stable, cacheable content
    if (input.systemPrompt && estimateTokens(input.systemPrompt) >= minCacheTokens) {
      cacheableBlocks.push("system_prompt");
    } else if (input.systemPrompt) {
      cacheableBlocks.push("system_prompt");
      notes.push(`System prompt is ${estimateTokens(input.systemPrompt)} tokens; below ${minCacheTokens} token minimum for ${provider} caching`);
    }

    if (input.repoSummary) {
      cacheableBlocks.push("repo_summary");
    }

    if (input.codingConventions) {
      cacheableBlocks.push("coding_conventions");
    }

    if (input.toolDefinitions) {
      cacheableBlocks.push("tool_definitions");
      notes.push("Cache tool definitions to avoid re-tokenizing on each request");
    }

    if (input.fileSummaries && input.fileSummaries.length > 0) {
      cacheableBlocks.push("file_summaries");
    }

    // Dynamic, non-cacheable content
    dynamicBlocks.push("current_user_message");
    dynamicBlocks.push("active_selected_code");

    if (input.recentChatHistory) {
      // Recent history is semi-dynamic
      dynamicBlocks.push("recent_chat_history");
      notes.push("Chat history is dynamic; only the stable prefix is cacheable");
    }

    notes.push(`Use ${provider} prompt caching: place cacheable blocks BEFORE dynamic content`);

    if (provider === "anthropic") {
      notes.push("Add cache_control: {type: 'ephemeral'} to stable content blocks");
      notes.push("Cache TTL: 5 minutes (default). Consider extended TTL for long sessions");
    } else if (provider === "openai") {
      notes.push("OpenAI automatically caches prompt prefixes ≥1024 tokens at 50% cost");
    } else if (provider === "google") {
      notes.push(`Gemini context caching requires ≥${minCacheTokens.toLocaleString()} tokens`);
    }
  } else {
    cacheStrategy = "manual_reuse";

    // No provider caching: use local summary reuse
    cacheableBlocks.push("repo_summary_local_reference");
    cacheableBlocks.push("coding_conventions_local_reference");
    dynamicBlocks.push("current_user_message");
    dynamicBlocks.push("selected_code");

    notes.push(`Provider ${provider} does not support prompt caching. Use local context summaries to minimize re-sent content.`);
    notes.push("Store repo summary as a session variable; reference by pointer rather than re-sending");
  }

  return {
    cacheableBlocks,
    dynamicBlocks,
    cacheStrategy,
    notes,
  };
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
