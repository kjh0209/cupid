// Estimates token counts without requiring a tokenizer library.
// Uses character-based heuristics calibrated against GPT/Claude tokenizers.
// Accuracy: ±15% for typical English prose, ±25% for dense code.

const AVG_CHARS_PER_TOKEN = 4.0;
const CODE_CHARS_PER_TOKEN = 3.2;
const OVERHEAD_TOKENS = 4;

export function estimateTokens(text: string): number {
  if (!text || text.length === 0) return 0;
  const isCode = /[{}();=>]/.test(text) && text.includes("\n");
  const charsPerToken = isCode ? CODE_CHARS_PER_TOKEN : AVG_CHARS_PER_TOKEN;
  return Math.ceil(text.length / charsPerToken) + OVERHEAD_TOKENS;
}

export function estimateTokensForMessages(messages: Array<{ role: string; content: string }>): number {
  return messages.reduce((total, msg) => {
    return total + estimateTokens(msg.content) + 4; // 4 tokens per message overhead
  }, 3); // 3 tokens for priming
}

export function estimateOutputTokensByTaskType(taskType: string): number {
  const map: Record<string, number> = {
    explanation: 600,
    simple_edit: 800,
    test_generation: 1500,
    local_bug_fix: 1800,
    ui_change: 1200,
    api_implementation: 2000,
    multi_file_refactor: 3500,
    database_schema_change: 2500,
    security_sensitive_change: 2500,
    architecture_design: 3000,
    prompt_rewrite_only: 300,
    unknown: 1200,
  };
  return map[taskType] ?? 1200;
}

export function estimateContextTokens(parts: {
  systemPrompt?: string;
  repoSummary?: string;
  activeFile?: string;
  selectedCode?: string;
  chatHistory?: string;
  userMessage: string;
}): number {
  const sum = [
    parts.systemPrompt ?? "",
    parts.repoSummary ?? "",
    parts.activeFile ?? "",
    parts.selectedCode ?? "",
    parts.chatHistory ?? "",
    parts.userMessage,
  ].reduce((acc, text) => acc + estimateTokens(text), 0);
  return sum;
}
