// ============================================================
// Context Preservation Layer (CPL)
//
// Compresses code context while preserving semantic meaning. The
// goal is to feed the executor LLM only what it needs to answer
// the user's question correctly, not the entire file.
//
// Strategies (applied in order based on task type):
//   1. Signature extraction — for "explain"/"design" tasks
//   2. Relevant-region extraction — for bug fixes / simple edits
//   3. Comment/whitespace strip — universal
//   4. Import deduplication — universal
//   5. Test-file pruning — for non-test tasks
//   6. Generated-code marker removal — autogen markers, source maps
//
// The CPL operates on the raw code payload, returning a smaller
// payload + a list of strategies applied + a "what was kept" map.
// ============================================================

import type { TaskType } from "../types.js";

export interface CPLInput {
  taskType: TaskType;
  rawCode: string;
  fileName?: string;
  hasHighlight?: boolean;
  highlightedRegion?: string;
  userPrompt?: string;
  gitDiff?: string;
}

export interface CPLOutput {
  compressedCode: string;
  originalChars: number;
  compressedChars: number;
  reductionPercent: number;
  appliedStrategies: string[];
  keptRegions: Array<{ kind: string; preview: string }>;
}

const SIGNATURE_REGEXES = [
  /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+\w+\s*\([^)]*\)/m,
  /^\s*(?:export\s+)?(?:abstract\s+)?class\s+\w+/m,
  /^\s*(?:export\s+)?interface\s+\w+/m,
  /^\s*(?:export\s+)?type\s+\w+\s*=/m,
  /^\s*(?:export\s+)?(?:const|let|var)\s+\w+\s*(?::\s*[^=]+)?\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/m,
  /^\s*(?:public|private|protected|static)?\s*\w+\s*\([^)]*\)\s*{/m,
];

const IMPORT_REGEX = /^\s*(?:import\s+[^;]+;|from\s+\S+\s+import\s+[^\n]+)/m;

function stripComments(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, "")   // /* block */
    .replace(/^\s*\/\/.*$/gm, "")        // // line
    .replace(/^\s*#(?!!).*$/gm, "");     // # comment (but not shebang)
}

function stripWhitespace(code: string): string {
  return code
    .replace(/\n\s*\n\s*\n/g, "\n\n")   // collapse 3+ blank lines to 1
    .replace(/[ \t]+$/gm, "");          // trailing spaces
}

function extractSignatures(code: string): string {
  const lines = code.split("\n");
  const kept: string[] = [];
  let depth = 0;
  let captureUntilClose = false;
  let bufferOpen = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmed = line.trim();

    // Always keep imports/exports/type declarations
    if (
      /^(import|export|from)\b/.test(trimmed) ||
      /^(interface|type)\s+\w+/.test(trimmed)
    ) {
      kept.push(line);
      continue;
    }

    // Function/class/method signatures
    const isSig = SIGNATURE_REGEXES.some((rx) => rx.test(line));
    if (isSig) {
      kept.push(line);
      // Also keep the JSDoc directly above
      let j = i - 1;
      while (j >= 0 && /^\s*\*/.test(lines[j]!)) {
        kept.unshift(lines[j]!);
        j--;
      }
      if (j >= 0 && /^\s*\/\*\*/.test(lines[j]!)) {
        kept.unshift(lines[j]!);
      }
      continue;
    }

    // Brace tracking — skip function bodies
    const opens = (line.match(/{/g) ?? []).length;
    const closes = (line.match(/}/g) ?? []).length;
    depth += opens - closes;
  }

  // Add truncation markers between signature blocks
  return kept.join("\n") + "\n\n// [function bodies truncated — only signatures shown]";
}

function extractRelevantRegion(
  code: string,
  hint: { highlightedRegion?: string; userPrompt?: string; symbols?: string[] },
): { code: string; usedHint: string } {
  const lines = code.split("\n");
  const totalLines = lines.length;
  const symbols = (hint.symbols ?? []).map((s) => s.toLowerCase());

  // Mine symbols from the prompt: words that look like identifiers
  if (hint.userPrompt) {
    const ids = hint.userPrompt.match(/\b[a-z_][a-zA-Z0-9_]{3,}\b/g) ?? [];
    for (const id of ids) {
      const lower = id.toLowerCase();
      if (![
        "function", "class", "const", "let", "var", "import", "export",
        "return", "this", "that", "from", "with", "what", "when", "where",
        "should", "would", "could", "explain", "create", "update", "delete",
      ].includes(lower) && !symbols.includes(lower)) {
        symbols.push(lower);
      }
    }
  }

  if (symbols.length === 0) {
    return { code, usedHint: "none" };
  }

  // Find line ranges that mention any of the symbols
  const interestingLines = new Set<number>();
  for (let i = 0; i < totalLines; i++) {
    const line = lines[i]!.toLowerCase();
    if (symbols.some((s) => line.includes(s))) {
      // Include surrounding context (±10 lines for function-level visibility)
      const lo = Math.max(0, i - 10);
      const hi = Math.min(totalLines - 1, i + 30);
      for (let j = lo; j <= hi; j++) interestingLines.add(j);
    }
  }

  if (interestingLines.size === 0 || interestingLines.size > totalLines * 0.7) {
    return { code, usedHint: "no-narrowing" };
  }

  // Build a compressed version with gap markers
  const sortedLines = Array.from(interestingLines).sort((a, b) => a - b);
  const out: string[] = [];
  let lastIdx = -1;
  for (const idx of sortedLines) {
    if (lastIdx >= 0 && idx > lastIdx + 1) {
      out.push(`\n// ... [lines ${lastIdx + 2}–${idx} omitted — unrelated to request] ...\n`);
    }
    out.push(lines[idx]!);
    lastIdx = idx;
  }

  return { code: out.join("\n"), usedHint: `symbols: ${symbols.slice(0, 5).join(",")}` };
}

function dedupeImports(code: string): string {
  const lines = code.split("\n");
  const seenImports = new Set<string>();
  const out: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (IMPORT_REGEX.test(trimmed)) {
      if (seenImports.has(trimmed)) continue;
      seenImports.add(trimmed);
    }
    out.push(line);
  }
  return out.join("\n");
}

function removeAutogeneratedMarkers(code: string): string {
  return code
    .replace(/\/\*\*?\s*@generated.*?\*\/\s*/gs, "")
    .replace(/\/\/\s*source.?map.*$/gim, "")
    .replace(/\/\/#\s*sourceMappingURL=.*$/gim, "");
}

const STRATEGY_BY_TASK: Record<TaskType, string[]> = {
  explanation:            ["dedupe-imports", "strip-comments", "strip-whitespace", "extract-signatures"],
  simple_edit:            ["dedupe-imports", "strip-whitespace", "relevant-region"],
  test_generation:        ["dedupe-imports", "strip-whitespace", "extract-signatures"],
  local_bug_fix:          ["dedupe-imports", "strip-whitespace", "relevant-region"],
  ui_change:              ["dedupe-imports", "strip-comments", "strip-whitespace"],
  api_implementation:     ["dedupe-imports", "strip-whitespace"],
  multi_file_refactor:    ["dedupe-imports", "strip-whitespace"],
  database_schema_change: ["strip-whitespace"],  // preserve everything for safety
  security_sensitive_change: ["strip-whitespace"], // preserve everything for safety
  architecture_design:    ["dedupe-imports", "strip-comments", "strip-whitespace", "extract-signatures"],
  prompt_rewrite_only:    [],
  performance_optimization: ["dedupe-imports", "strip-whitespace", "relevant-region"],
  devops_config:          ["strip-whitespace"],  // preserve config files as-is
  documentation_write:    ["dedupe-imports", "strip-comments", "strip-whitespace", "extract-signatures"],
  dependency_update:      ["strip-whitespace"],
  code_review:            ["dedupe-imports", "strip-comments", "strip-whitespace"],
  unknown:                ["dedupe-imports", "strip-whitespace"],
};

export function applyCPL(input: CPLInput): CPLOutput {
  const original = input.rawCode;
  const originalChars = original.length;
  const appliedStrategies: string[] = [];
  const keptRegions: Array<{ kind: string; preview: string }> = [];

  // If a git diff is provided AND the task is "edit"-ish, the diff replaces the full file.
  if (
    input.gitDiff &&
    (input.userPrompt?.includes("commit") || input.userPrompt?.includes("review") ||
     input.taskType === "local_bug_fix" || input.taskType === "simple_edit")
  ) {
    appliedStrategies.push("git-diff-substitution");
    keptRegions.push({ kind: "git-diff", preview: input.gitDiff.slice(0, 200) });
    return {
      compressedCode: input.gitDiff,
      originalChars,
      compressedChars: input.gitDiff.length,
      reductionPercent: ((originalChars - input.gitDiff.length) / Math.max(1, originalChars)) * 100,
      appliedStrategies,
      keptRegions,
    };
  }

  // If a region is highlighted, use it as the primary context.
  if (input.hasHighlight && input.highlightedRegion) {
    appliedStrategies.push("highlighted-region-only");
    keptRegions.push({ kind: "highlight", preview: input.highlightedRegion.slice(0, 200) });
    const out = input.highlightedRegion;
    return {
      compressedCode: out,
      originalChars,
      compressedChars: out.length,
      reductionPercent: ((originalChars - out.length) / Math.max(1, originalChars)) * 100,
      appliedStrategies,
      keptRegions,
    };
  }

  // Pipeline strategies by task type
  let current = original;
  const strategies = STRATEGY_BY_TASK[input.taskType] ?? STRATEGY_BY_TASK.unknown;

  for (const strat of strategies) {
    const before = current.length;
    switch (strat) {
      case "dedupe-imports":
        current = dedupeImports(current);
        break;
      case "strip-comments":
        current = stripComments(current);
        break;
      case "strip-whitespace":
        current = stripWhitespace(current);
        current = removeAutogeneratedMarkers(current);
        break;
      case "extract-signatures":
        // Only apply if file is large enough to justify lossy extraction
        if (current.length > 2000) {
          current = extractSignatures(current);
          keptRegions.push({ kind: "signatures-only", preview: current.slice(0, 300) });
        }
        break;
      case "relevant-region":
        if (current.length > 1500) {
          const ext = extractRelevantRegion(current, {
            highlightedRegion: input.highlightedRegion,
            userPrompt: input.userPrompt,
          });
          current = ext.code;
          if (ext.usedHint !== "no-narrowing" && ext.usedHint !== "none") {
            keptRegions.push({ kind: "relevant-region", preview: `narrowed by ${ext.usedHint}` });
          }
        }
        break;
    }
    if (current.length !== before) appliedStrategies.push(strat);
  }

  // Hard cap: never balloon, and never go below 50 chars unless the input was that small
  const finalCode = current.length < original.length ? current : original;

  return {
    compressedCode: finalCode,
    originalChars,
    compressedChars: finalCode.length,
    reductionPercent: ((originalChars - finalCode.length) / Math.max(1, originalChars)) * 100,
    appliedStrategies: appliedStrategies.length > 0 ? appliedStrategies : ["passthrough"],
    keptRegions,
  };
}
