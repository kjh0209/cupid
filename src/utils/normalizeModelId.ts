// Normalizes model IDs to LiteLLM-compatible provider/model format.

const PROVIDER_PREFIXES = [
  "anthropic",
  "openai",
  "google",
  "meta",
  "mistral",
  "cohere",
  "amazon",
  "azure",
  "together",
  "groq",
  "deepseek",
  "qwen",
];

export function normalizeModelId(raw: string): string {
  const trimmed = raw.trim().toLowerCase();

  // Already has a provider prefix
  for (const prefix of PROVIDER_PREFIXES) {
    if (trimmed.startsWith(`${prefix}/`)) return trimmed;
  }

  // Map common shorthand names to LiteLLM IDs
  const shorthandMap: Record<string, string> = {
    "claude-3-5-sonnet": "anthropic/claude-3-5-sonnet-20241022",
    "claude-3-5-haiku": "anthropic/claude-3-5-haiku-20241022",
    "claude-opus-4": "anthropic/claude-opus-4-5",
    "claude-sonnet-4": "anthropic/claude-sonnet-4-5",
    "claude-haiku-4": "anthropic/claude-haiku-4-5",
    "claude-3-opus": "anthropic/claude-3-opus-20240229",
    "claude-3-sonnet": "anthropic/claude-3-sonnet-20240229",
    "claude-3-haiku": "anthropic/claude-3-haiku-20240307",
    "gpt-4o": "openai/gpt-4o",
    "gpt-4o-mini": "openai/gpt-4o-mini",
    "gpt-4-turbo": "openai/gpt-4-turbo",
    "gpt-3.5-turbo": "openai/gpt-3.5-turbo",
    "o1": "openai/o1",
    "o1-mini": "openai/o1-mini",
    "o3-mini": "openai/o3-mini",
    "gemini-1.5-pro": "google/gemini-1.5-pro",
    "gemini-1.5-flash": "google/gemini-1.5-flash",
    "gemini-2.0-flash": "google/gemini-2.0-flash",
    "gemini-2.5-pro": "google/gemini-2.5-pro",
    "llama-3.1-70b": "meta/llama-3.1-70b-instruct",
    "llama-3.1-8b": "meta/llama-3.1-8b-instruct",
    "deepseek-chat": "deepseek/deepseek-chat",
    "deepseek-coder": "deepseek/deepseek-coder",
  };

  if (shorthandMap[trimmed]) return shorthandMap[trimmed] ?? trimmed;

  // Try to detect provider from model name
  if (trimmed.includes("claude")) return `anthropic/${trimmed}`;
  if (trimmed.includes("gpt") || trimmed.startsWith("o1") || trimmed.startsWith("o3")) return `openai/${trimmed}`;
  if (trimmed.includes("gemini")) return `google/${trimmed}`;
  if (trimmed.includes("llama")) return `meta/${trimmed}`;
  if (trimmed.includes("mistral") || trimmed.includes("mixtral")) return `mistral/${trimmed}`;
  if (trimmed.includes("deepseek")) return `deepseek/${trimmed}`;

  return trimmed;
}

export function extractProvider(modelId: string): string {
  const normalized = normalizeModelId(modelId);
  const parts = normalized.split("/");
  return parts[0] ?? "unknown";
}

export function extractModelName(modelId: string): string {
  const normalized = normalizeModelId(modelId);
  const slashIdx = normalized.indexOf("/");
  if (slashIdx === -1) return normalized;
  return normalized.slice(slashIdx + 1);
}
