// ============================================================
// Semantic Code Mapping
//
// Replaces verbose code references in the user prompt with short
// semantic pointers. This is the "semantic code mapping" piece
// of the Prompt Optimizer from the pitch deck.
//
// Examples:
//   "the function at src/auth/login.ts line 45 that handles..."
//   → "the loginHandler in auth/login.ts"
//
//   "the long ROUTES array containing all the GET/POST routes..."
//   → "<ROUTES array (15 entries)>"
//
//   "this entire 800-line config file with all the env vars..."
//   → "<config (truncated; key env vars: NODE_ENV, PORT, DATABASE_PATH)>"
// ============================================================

export interface SemanticMapResult {
  text: string;
  mappings: Array<{ original: string; replacement: string; kind: string }>;
  tokensSavedEstimate: number;
}

const FUNCTION_DEF_REGEX = /(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g;
const CLASS_DEF_REGEX = /class\s+([A-Za-z_$][\w$]*)/g;
const CONST_FN_REGEX = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?\(?[^=]*\)?\s*=>/g;

function approximateTokens(s: string): number {
  return Math.ceil(s.length / 4);
}

/**
 * Replace pasted "code blocks" inside the user message with short summaries.
 * Code blocks here are: fenced ```...``` or large indented spans.
 *
 * Only applied when a separate rawCode/file context is already attached —
 * i.e., the user pasted the same code twice (once in prompt, once as file).
 */
export function dedupePastedCode(
  prompt: string,
  attachedCode?: string,
): SemanticMapResult {
  const mappings: SemanticMapResult["mappings"] = [];
  let tokensSaved = 0;
  let out = prompt;

  if (!attachedCode || attachedCode.length < 100) {
    return { text: prompt, mappings: [], tokensSavedEstimate: 0 };
  }

  // 1. Drop fenced code blocks from the prompt if their content also appears in attachedCode
  const fenced = /```[\s\S]*?```/g;
  out = out.replace(fenced, (match) => {
    const inner = match.replace(/```\w*\n?/, "").replace(/```$/, "").trim();
    if (inner.length > 80 && attachedCode.includes(inner.slice(0, 100))) {
      const placeholder = "<code already provided as file context>";
      mappings.push({ original: match.slice(0, 60) + "...", replacement: placeholder, kind: "deduped-fenced" });
      tokensSaved += approximateTokens(match) - approximateTokens(placeholder);
      return placeholder;
    }
    return match;
  });

  // 2. Drop indented multi-line spans (4+ spaces, 3+ lines) if also in attachedCode
  const indentedBlocks = out.match(/(?:^|\n)((?:[ \t]{4,}.*\n){3,})/g) ?? [];
  for (const block of indentedBlocks) {
    const snippet = block.slice(0, 100);
    if (attachedCode.includes(snippet.trim())) {
      out = out.replace(block, "\n<code already provided as file context>\n");
      mappings.push({ original: snippet + "...", replacement: "<code dedup>", kind: "deduped-indented" });
      tokensSaved += approximateTokens(block) - approximateTokens("<code dedup>");
    }
  }

  return { text: out, mappings, tokensSavedEstimate: Math.max(0, tokensSaved) };
}

/**
 * Build a compact "symbol map" of an attached file — used as a semantic
 * shortcut so the user can reference functions/classes by name instead of
 * pasting the full code.
 */
export function buildSymbolMap(code: string, fileName?: string): {
  symbols: Array<{ name: string; kind: "function" | "class" | "arrow"; line: number }>;
  summary: string;
} {
  if (!code) return { symbols: [], summary: "" };
  const lines = code.split("\n");
  const symbols: Array<{ name: string; kind: "function" | "class" | "arrow"; line: number }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    FUNCTION_DEF_REGEX.lastIndex = 0;
    let m;
    while ((m = FUNCTION_DEF_REGEX.exec(line)) !== null) {
      symbols.push({ name: m[1]!, kind: "function", line: i + 1 });
    }
    CLASS_DEF_REGEX.lastIndex = 0;
    while ((m = CLASS_DEF_REGEX.exec(line)) !== null) {
      symbols.push({ name: m[1]!, kind: "class", line: i + 1 });
    }
    CONST_FN_REGEX.lastIndex = 0;
    while ((m = CONST_FN_REGEX.exec(line)) !== null) {
      symbols.push({ name: m[1]!, kind: "arrow", line: i + 1 });
    }
  }

  const summary = symbols.length === 0
    ? ""
    : `${fileName ?? "file"}: ${symbols.slice(0, 20).map((s) => `${s.kind} ${s.name}@L${s.line}`).join(", ")}${symbols.length > 20 ? `, ...+${symbols.length - 20} more` : ""}`;

  return { symbols, summary };
}

/**
 * Compress verbose location references in the user prompt:
 *   "the function at src/auth/login.ts on line 45 that handles user authentication"
 *   → "loginHandler [auth/login.ts:45]"
 * Heuristic: look for "(function|class|method|component|handler) ... (in|at|from) <file>:<line>"
 */
export function compressLocationReferences(prompt: string): SemanticMapResult {
  const mappings: SemanticMapResult["mappings"] = [];
  let tokensSaved = 0;
  let out = prompt;

  // "the X function in path/to/file.ts" → "X() [path/to/file.ts]"
  const verbosePattern = /the\s+(\w+)\s+(function|class|method|component|handler|route|controller|service)\s+(?:in|at|from)\s+([\w./-]+\.\w+)(?:\s+(?:on\s+)?line\s+(\d+))?/gi;
  out = out.replace(verbosePattern, (full, name, kind, file, line) => {
    const compact = line ? `\`${name}()\` [${file}:${line}]` : `\`${name}()\` [${file}]`;
    mappings.push({ original: full, replacement: compact, kind: `compress-${kind}` });
    tokensSaved += approximateTokens(full) - approximateTokens(compact);
    return compact;
  });

  return { text: out, mappings, tokensSavedEstimate: Math.max(0, tokensSaved) };
}

export function applySemanticCodeMapping(
  prompt: string,
  attachedCode?: string,
  fileName?: string,
): SemanticMapResult {
  const allMappings: SemanticMapResult["mappings"] = [];
  let totalSaved = 0;
  let text = prompt;

  // Step 1: dedupe pasted code that's also in file context
  const step1 = dedupePastedCode(text, attachedCode);
  text = step1.text;
  allMappings.push(...step1.mappings);
  totalSaved += step1.tokensSavedEstimate;

  // Step 2: compress verbose location refs
  const step2 = compressLocationReferences(text);
  text = step2.text;
  allMappings.push(...step2.mappings);
  totalSaved += step2.tokensSavedEstimate;

  return { text, mappings: allMappings, tokensSavedEstimate: totalSaved };
}
