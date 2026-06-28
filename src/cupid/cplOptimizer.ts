import type { IDEContext, CompressionResult, CupidIntent } from "./types.js";
import { getEncoding } from "js-tiktoken";

const tokenizer = getEncoding("cl100k_base");

export function compress(
  context: IDEContext,
  intent: CupidIntent,
): CompressionResult {
  const originalChars = context.rawCodePayload.length;
  const originalTokens = tokenizer.encode(context.rawCodePayload).length;
  const rulesApplied: string[] = [];
  const diffSnippets: CompressionResult["diffSnippets"] = [];

  let payload = context.rawCodePayload;

  // Rule 1: GitOps → substitute diff
  if (intent === "GitOps" && context.gitDiffText) {
    payload = context.gitDiffText;
    rulesApplied.push("CPL: Diff Substitution");
    diffSnippets.push({ type: "removed", line: `<${originalChars} chars of full file>` });
    diffSnippets.push({ type: "kept", line: context.gitDiffText.slice(0, 200) });
    const compressedTokens = tokenizer.encode(payload).length;
    return {
      originalChars,
      compressedChars: payload.length,
      originalTokens,
      compressedTokens,
      rulesApplied,
      diffSnippets,
      compressedPayload: payload,
    };
  }

  // Rule 2: Explain w/o highlight → signature-only
  if (intent === "Explain" && !context.hasHighlightedText) {
    const lines = payload.split("\n");
    const kept: string[] = [];
    for (const line of lines) {
      const isSig = /\bclass\s/.test(line) || /\bfunction\s/.test(line) || /\bimport\s/.test(line);
      if (isSig) {
        kept.push(line);
        if (diffSnippets.length < 60) diffSnippets.push({ type: "kept", line });
      } else if (diffSnippets.length < 60) {
        diffSnippets.push({ type: "removed", line });
      }
    }
    payload = kept.join("\n") + "\n// ... [Internal logic truncated] ...";
    rulesApplied.push("CPL: Signature Truncation");
  }

  // Rule 3: Heavy tasks → strip comments + blank lines
  if (intent === "ComplexArchitecture" || intent === "Debug") {
    const before = payload.length;
    payload = payload.replace(/\n\s*\n/g, "\n").replace(/\/\/.*$/gm, "");
    if (payload.length !== before) rulesApplied.push("CPL: Strip Comments & Whitespace");
  }

  const compressedTokens = tokenizer.encode(payload).length;
  return {
    originalChars,
    compressedChars: payload.length,
    originalTokens,
    compressedTokens,
    rulesApplied,
    diffSnippets: diffSnippets.length > 0 ? diffSnippets : [{ type: "kept", line: "<no compression applied>" }],
    compressedPayload: payload,
  };
}
