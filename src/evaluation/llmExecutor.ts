import { logger } from "../utils/logger.js";
import { fetchWithRetry } from "../utils/fetchWithRetry.js";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface LLMResponse {
  content: string;
  usage: LLMUsage;
  latencyMs: number;
  modelId: string;
  finishReason: string;
}

export interface CodeChange {
  path: string;
  changeType: "create" | "modify" | "delete";
  content?: string;
  patch?: string;
}

export interface CodeGenerationResult {
  summary: string;
  filesChanged: CodeChange[];
  risks: string[];
  verificationNotes: string[];
  rawOutput: string;
  parseStatus: "success" | "json_repair" | "code_block" | "failed";
}

const OPENROUTER_SLUG_OVERRIDES: Record<string, string> = {
  "anthropic/claude-opus-4-5": "anthropic/claude-opus-4.5",
  "anthropic/claude-sonnet-4-5": "anthropic/claude-sonnet-4.5",
  "anthropic/claude-haiku-4-5": "anthropic/claude-haiku-4.5",
  "anthropic/claude-opus-4-7": "anthropic/claude-opus-4.7",
  "anthropic/claude-sonnet-4-6": "anthropic/claude-sonnet-4.6",
  // Gemini 2.0 Flash retired on OpenRouter → route to 2.5 Flash Lite (same tier, same price)
  "google/gemini-2.0-flash": "google/gemini-2.5-flash-lite",
  "google/gemini-2.0-flash-001": "google/gemini-2.5-flash-lite",
  "google/gemini-3.5-flash": "google/gemini-3.5-flash",
  "google/gemini-3.1-flash-lite": "google/gemini-3.1-flash-lite",
};

function toOpenRouterSlug(modelId: string): string {
  return OPENROUTER_SLUG_OVERRIDES[modelId] ?? modelId;
}

function resolveEndpoint(modelId: string): { baseUrl: string; apiKey: string } {
  const provider = modelId.split("/")[0];

  if (process.env["LITELLM_BASE_URL"] && process.env["LITELLM_API_KEY"]) {
    return { baseUrl: process.env["LITELLM_BASE_URL"], apiKey: process.env["LITELLM_API_KEY"] };
  }

  // Use direct provider endpoint only when a provider-specific key is set
  if (provider === "openai" && process.env["OPENAI_API_KEY"]) {
    return { baseUrl: "https://api.openai.com/v1", apiKey: process.env["OPENAI_API_KEY"] };
  }
  if (provider === "anthropic" && process.env["ANTHROPIC_API_KEY"]) {
    return { baseUrl: "https://api.anthropic.com/v1", apiKey: process.env["ANTHROPIC_API_KEY"] };
  }
  if (provider === "google" && (process.env["GOOGLE_API_KEY"] ?? process.env["GOOGLE_AI_API_KEY"])) {
    return {
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
      apiKey: (process.env["GOOGLE_API_KEY"] ?? process.env["GOOGLE_AI_API_KEY"])!,
    };
  }

  // Fall back to OpenRouter (handles all providers)
  const openRouterKey = process.env["OPENROUTER_API_KEY"];
  if (openRouterKey) {
    return { baseUrl: "https://openrouter.ai/api/v1", apiKey: openRouterKey };
  }

  throw new Error(`No API key found for model ${modelId}. Set OPENROUTER_API_KEY or a provider-specific key.`);
}

export async function callLLM(
  modelId: string,
  messages: LLMMessage[],
  temperature = 0.2,
  maxTokens = 4096
): Promise<LLMResponse> {
  const { baseUrl, apiKey } = resolveEndpoint(modelId);

  const start = Date.now();

  // Normalize model ID: OpenRouter/LiteLLM keep "provider/model", direct providers use "model" only
  const isOpenRouter = baseUrl.includes("openrouter.ai");
  const isLiteLLM = baseUrl === process.env["LITELLM_BASE_URL"];
  const normalizedModel = isOpenRouter
    ? toOpenRouterSlug(modelId)
    : isLiteLLM
      ? modelId
      : modelId.split("/").slice(1).join("/") || modelId;

  // Some Gemini models on OpenRouter occasionally return empty responses when
  // system messages are too long. Fold the system message into the first user
  // turn for Gemini routes to stabilize responses.
  let finalMessages = messages;
  if (normalizedModel.toLowerCase().includes("gemini")) {
    const sysParts = messages.filter((m) => m.role === "system").map((m) => m.content);
    const nonSys = messages.filter((m) => m.role !== "system");
    if (sysParts.length > 0 && nonSys.length > 0) {
      const sysText = sysParts.join("\n\n");
      finalMessages = [
        { role: nonSys[0]!.role, content: `[System instructions]\n${sysText}\n\n[User]\n${nonSys[0]!.content}` },
        ...nonSys.slice(1),
      ];
    }
  }

  const body = {
    model: normalizedModel,
    messages: finalMessages,
    temperature,
    max_tokens: maxTokens,
  };

  const response = await fetchWithRetry(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "HTTP-Referer": "https://cupid-router.dev",
      "X-Title": "Cupid Router Eval",
    },
    body: JSON.stringify(body),
    timeoutMs: 120000,
  });

  if (!response.ok) {
    let errMsg = `LLM API error ${response.status}`;
    try {
      const errBody = await response.json() as { error?: { message?: string } };
      if (errBody.error?.message) errMsg += `: ${errBody.error.message}`;
    } catch { /* ignore parse error */ }
    throw new Error(errMsg);
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string }; finish_reason: string }>;
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  };

  const latencyMs = Date.now() - start;
  const choice = data.choices[0];
  if (!choice) throw new Error("No completion returned from LLM");

  const usage: LLMUsage = {
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
    totalTokens: data.usage?.total_tokens ?? 0,
  };

  return {
    content: choice.message.content,
    usage,
    latencyMs,
    modelId,
    finishReason: choice.finish_reason ?? "stop",
  };
}

export function parseCodeGenerationOutput(rawContent: string): CodeGenerationResult {
  // Try direct JSON parse
  let parsed = tryParseJson(rawContent);

  // Try extracting JSON from markdown code block
  if (!parsed) {
    const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch?.[1]) {
      parsed = tryParseJson(jsonMatch[1].trim());
    }
  }

  if (parsed && parsed.files_changed) {
    const filesChanged: CodeChange[] = (parsed.files_changed as any[]).map((f: any) => ({
      path: String(f.path ?? ""),
      changeType: (f.change_type ?? "modify") as CodeChange["changeType"],
      content: f.content != null ? String(f.content) : undefined,
      patch: f.patch != null ? String(f.patch) : undefined,
    }));

    return {
      summary: String(parsed.summary ?? ""),
      filesChanged,
      risks: Array.isArray(parsed.risks) ? parsed.risks.map(String) : [],
      verificationNotes: Array.isArray(parsed.verification_notes) ? parsed.verification_notes.map(String) : [],
      rawOutput: rawContent,
      parseStatus: "success",
    };
  }

  // Fallback: try to extract code blocks and guess file paths
  logger.warn("Failed to parse structured LLM output, attempting code block extraction");
  const codeBlocks = extractCodeBlocks(rawContent);
  if (codeBlocks.length > 0) {
    return {
      summary: extractSummaryLine(rawContent),
      filesChanged: codeBlocks,
      risks: ["Output was not structured JSON — review carefully"],
      verificationNotes: [],
      rawOutput: rawContent,
      parseStatus: "code_block",
    };
  }

  return {
    summary: "Failed to parse LLM output",
    filesChanged: [],
    risks: ["LLM output could not be parsed"],
    verificationNotes: [],
    rawOutput: rawContent,
    parseStatus: "failed",
  };
}

function tryParseJson(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed === "object" && parsed !== null) return parsed as Record<string, unknown>;
    return null;
  } catch {
    return null;
  }
}

function extractCodeBlocks(content: string): CodeChange[] {
  const changes: CodeChange[] = [];
  // Match: path comment before code block
  const pattern = /(?:\/\/\s*File:\s*|###?\s*`?)([\w./\-]+\.\w+)`?\s*\n```[\w]*\n([\s\S]*?)```/g;
  let match;
  while ((match = pattern.exec(content)) !== null) {
    changes.push({
      path: match[1]!,
      changeType: "modify",
      content: match[2]!,
    });
  }
  return changes;
}

function extractSummaryLine(content: string): string {
  const firstLine = content.split("\n").find((l) => l.trim().length > 0) ?? "";
  return firstLine.replace(/^[#*\-\s]+/, "").slice(0, 200);
}
