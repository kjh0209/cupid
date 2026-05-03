import type { TaskClassification, CompressionSensitivity } from "../types.js";

// ── Filler patterns to strip ──────────────────────────────────
const FILLER_PATTERNS: Array<[RegExp, string]> = [
  [/\b(can you (?:maybe |please |just )?|could you (?:please |just )?|would you (?:mind |please )?)/gi, ""],
  [/\b(if possible|if you could|if you can|if that makes sense)\b/gi, ""],
  [/\b(i was (?:thinking|wondering|hoping)|i think maybe|i'm not sure but)/gi, ""],
  [/\b(maybe just|perhaps just|just maybe|sort of|kind of|somewhat)\b/gi, ""],
  [/\b(also,?\s+make sure to|also,?\s+please|also,?\s+don't forget to)\b/gi, "Also:"],
  [/\b(and (?:also )?try to|and (?:also )?please)\b/gi, "and"],
  [/\b(i (?:don't really|really don't) (understand|know)|i'm having trouble)\b/gi, ""],
  [/\bthank you\b\.?/gi, ""],
  [/\bplease\b/gi, ""],
  [/\bbasically\b/gi, ""],
  [/\bin other words\b/gi, ""],
  [/\bwhat i mean is\b/gi, ""],
  [/^\s*hey[,.]?\s*/i, ""],
  [/^\s*hi[,.]?\s*/i, ""],
  [/\s{2,}/g, " "],
];

// ── Sentence consolidation patterns ──────────────────────────
const CONSOLIDATION_PATTERNS: Array<[RegExp, string]> = [
  // "Can you add X to Y? Also add Z." → "Add X to Y and Z."
  [/add (.+?) to (.+?)\. also add (.+?)\./gi, "Add $1 and $3 to $2."],
  // "Make sure it follows the pattern of..." → "Follow the pattern of..."
  [/\bmake sure (?:it |that it |this )?follows?\b/gi, "Follow"],
  [/\bmake sure (?:to |that you )?/gi, ""],
  [/\btry (?:to |not to )?/gi, ""],
  [/\bdon't forget to\b/gi, ""],
  [/\bremember to\b/gi, ""],
];

export interface CompressedPrompt {
  text: string;
  appliedRules: string[];
  removedItems: string[];
}

export function applyFillerRemoval(text: string): CompressedPrompt {
  const appliedRules: string[] = [];
  const removedItems: string[] = [];
  let result = text;

  for (const [pattern, replacement] of FILLER_PATTERNS) {
    const before = result;
    result = result.replace(pattern, replacement);
    if (result !== before) {
      appliedRules.push("remove-filler-language");
      const matched = before.match(pattern);
      if (matched) removedItems.push(...matched.slice(0, 3).map((m) => m.trim()).filter(Boolean));
    }
  }

  for (const [pattern, replacement] of CONSOLIDATION_PATTERNS) {
    const before = result;
    result = result.replace(pattern, replacement);
    if (result !== before) {
      appliedRules.push("compact-action-list");
    }
  }

  // Clean up double spaces and leading/trailing whitespace
  result = result.replace(/\s{2,}/g, " ").trim();

  return {
    text: result,
    appliedRules: [...new Set(appliedRules)],
    removedItems: [...new Set(removedItems)],
  };
}

export function addMinimalDiffInstruction(
  text: string,
  taskType: string
): { text: string; applied: boolean } {
  const editingTasks = [
    "simple_edit", "local_bug_fix", "api_implementation",
    "ui_change", "multi_file_refactor",
  ];

  if (!editingTasks.includes(taskType)) return { text, applied: false };
  if (/\bdiff\b|\bpatch\b|\bminimal\b/i.test(text)) return { text, applied: false };

  return {
    text: text + " Keep the diff minimal; do not modify unrelated files.",
    applied: true,
  };
}

export function addDoNotTouchInstruction(
  text: string,
  taskType: string
): { text: string; applied: boolean } {
  const editingTasks = [
    "simple_edit", "local_bug_fix", "ui_change",
  ];

  if (!editingTasks.includes(taskType)) return { text, applied: false };
  if (/\bnot\b.{0,30}\bunrelated\b|\bonly.{0,20}(this|the)\s+(file|route|function)\b/i.test(text)) {
    return { text, applied: false };
  }

  return {
    text: text + " Do not modify unrelated files.",
    applied: true,
  };
}

// ── Safety: extract preserved requirements ────────────────────
export function extractPreservedRequirements(
  original: string,
  optimized: string
): string[] {
  const preserved: string[] = [];

  // Filenames
  const fileMatches = original.match(/[\w.-]+\.(ts|tsx|js|jsx|py|go|rs|css|json|yaml|yml)\b/g);
  if (fileMatches) preserved.push(...fileMatches);

  // Function names (camelCase or snake_case identifiers)
  const funcMatches = original.match(/\b[a-z][a-zA-Z0-9]{2,}(?:Handler|Route|Controller|Service|Helper|Util|Hook|Component)\b/g);
  if (funcMatches) preserved.push(...funcMatches);

  // Library names
  const libMatches = original.match(/\b(zod|prisma|drizzle|express|fastify|next|react|vue|tailwind|jest|vitest|typescript)\b/gi);
  if (libMatches) preserved.push(...libMatches);

  // Error messages (quoted strings)
  const quotedMatches = original.match(/"[^"]{5,50}"|'[^']{5,50}'/g);
  if (quotedMatches) preserved.push(...quotedMatches.slice(0, 5));

  return [...new Set(preserved)];
}

export function applyConservativeCompression(
  text: string,
  sensitivity: CompressionSensitivity
): CompressedPrompt {
  if (sensitivity === "high") {
    // Only remove obvious filler, preserve everything else
    let result = text;
    const removed: string[] = [];

    // Only strip politeness phrases, not any instructions
    const safeFiller = [
      [/^\s*hey[,.]?\s*/i, ""],
      [/^\s*hi[,.]?\s*/i, ""],
      [/\bthank you\b\.?/gi, ""],
      [/\bplease\b/gi, ""],
    ] as Array<[RegExp, string]>;

    for (const [p, r] of safeFiller) {
      const before = result;
      result = result.replace(p, r);
      if (result !== before) {
        const m = before.match(p);
        if (m) removed.push(m[0]?.trim() ?? "");
      }
    }

    return {
      text: result.trim(),
      appliedRules: ["no-overcompress-security"],
      removedItems: removed.filter(Boolean),
    };
  }

  if (sensitivity === "medium") {
    const base = applyFillerRemoval(text);
    return base;
  }

  // Low sensitivity: full compression
  const base = applyFillerRemoval(text);
  return base;
}
