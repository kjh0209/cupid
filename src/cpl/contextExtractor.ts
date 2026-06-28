// ============================================================
// Context Extractor
//
// Inspects a freshly-completed task (prompt + response) and
// extracts durable facts that should survive into future tasks:
//   - User preferences ("use Tailwind", "prefer functional comp")
//   - Decisions (chose Prisma over Drizzle, JWT in httpOnly cookie)
//   - Coding conventions (TypeScript strict, async/await, etc)
//   - File summaries (when a file was the focus)
//   - Symbol maps (important identifiers introduced)
//
// These get stored in the SessionContextStore and become part of
// the preamble for every future task in this session.
// ============================================================

import { sessionContextStore, type CPLEntryKind } from "./sessionContextStore.js";
import { logger } from "../utils/logger.js";

export interface ExtractInput {
  sessionKey: string;
  userPrompt: string;
  routedModel: string;
  responseContent: string;
  taskType: string;
  fileName?: string;
  rawCode?: string;
}

export interface ExtractedFact {
  kind: CPLEntryKind;
  title: string;
  content: string;
}

// Pattern-based light extractor — runs in a few ms, always.
function patternExtract(prompt: string, response: string, taskType: string): ExtractedFact[] {
  const out: ExtractedFact[] = [];
  const combined = `${prompt}\n\n${response}`;

  // Preference patterns — match "use X", "prefer X", "I want X", "X for Y", etc.
  const prefPatterns: Array<[RegExp, string]> = [
    // Styling
    [/\b(use|prefer|stick to|always use|with)\s+(tailwind|tailwindcss)\b/i, "Styling: Tailwind CSS"],
    [/\btailwind\s+for\s+styling/i, "Styling: Tailwind CSS"],
    [/\b(use|prefer)\s+(styled.?components|emotion)\b/i, "Styling: CSS-in-JS"],
    // Language
    [/\b(use|prefer|stick to|always use|with)\s+typescript\b/i, "Language: TypeScript"],
    [/\b(typescript|TS)\s+project/i, "Language: TypeScript"],
    // ORM
    [/\b(use|prefer|with)\s+(prisma|drizzle|sequelize|typeorm|knex)\b/i, "ORM choice"],
    [/\b(prisma|drizzle|sequelize|typeorm|knex)\s+for\s+(db|orm|database)/i, "ORM choice"],
    // Validation
    [/\b(use|prefer|with)\s+(zod|yup|joi|valibot)\b/i, "Validation library"],
    [/\b(zod|yup|joi|valibot)\s+for\s+(validation|validating|schemas?)/i, "Validation library"],
    // Test
    [/\b(use|prefer|with)\s+(vitest|jest|mocha|playwright|cypress)\b/i, "Test framework"],
    [/\b(vitest|jest|mocha|playwright|cypress)\s+for\s+(test|testing|specs?)/i, "Test framework"],
    // React style
    [/\b(use|prefer)\s+functional\s+components?/i, "React style: functional components"],
    [/\bfunctional\s+(react\s+)?components?/i, "React style: functional components"],
    [/\b(no|don't use|avoid)\s+(class\s+components?)/i, "React style: no class components"],
    // Async / functions
    [/\b(use|prefer)\s+(async\/await|async-await|async\s+await)/i, "Async style: async/await"],
    [/\b(use|prefer)\s+(arrow\s+functions?)/i, "Function style: arrow"],
    // TS strict
    [/\b(use|prefer|stick to|enable)\s+(strict\s+(mode|typescript))/i, "TypeScript: strict mode"],
    // Exports
    [/\b(prefer|use)\s+(named|default)\s+exports?/i, "Module: prefer named exports"],
  ];
  for (const [rx, title] of prefPatterns) {
    const m = combined.match(rx);
    if (m) {
      out.push({ kind: "convention", title, content: m[0].slice(0, 200) });
    }
  }

  // Decision patterns (from response — "I chose X because" / "Using X over Y")
  const decisionPatterns: Array<[RegExp, string]> = [
    [/\b(chose|chosen|going with|decided on|opted for)\s+([A-Za-z0-9_-]+)\s+(over|instead of|rather than)\s+([A-Za-z0-9_-]+)/i, "Tech choice"],
    [/\b(using|use)\s+(bcrypt|argon2|scrypt|pbkdf2)\b/i, "Crypto: hashing algorithm"],
    [/\b(using|use)\s+(jose|jsonwebtoken)\s+for\s+jwt/i, "Library: JWT"],
    [/\b(httpOnly|http.only)\s+cookies?/i, "Auth: httpOnly cookies"],
    [/\bcontext.api|useContext|provider\s+pattern/i, "State: Context API"],
    [/\b(redux|zustand|jotai|recoil|valtio|mobx)\b/i, "State management lib"],
  ];
  for (const [rx, baseTitle] of decisionPatterns) {
    const m = combined.match(rx);
    if (m) {
      out.push({
        kind: "decision",
        title: `${baseTitle}: ${m[0].slice(0, 80)}`,
        content: m[0].slice(0, 240),
      });
    }
  }

  // Architecture markers
  if (/\b(monolith|microservice|event.?driven|hexagonal|clean architecture|ddd)\b/i.test(combined)) {
    const m = combined.match(/\b(monolith|microservices?|event.?driven|hexagonal|clean architecture|ddd|domain.?driven)\b/i);
    if (m) {
      out.push({
        kind: "architecture_log",
        title: `Architecture: ${m[1]}`,
        content: `Mentioned in prompt/response: ${m[0]}`,
      });
    }
  }

  return out;
}

// LLM-based deeper extractor (optional, runs on big tasks).
// Used only when the response is substantial AND task warrants it.
async function llmExtract(input: ExtractInput): Promise<ExtractedFact[]> {
  // Lazy import to keep startup light when not needed
  const { callLLM } = await import("../evaluation/llmExecutor.js");
  const model = process.env["CLASSIFICATION_LLM_MODEL"] ?? "anthropic/claude-haiku-4-5";
  const sys = `You extract durable session facts from a coding task. Output STRICT JSON array, each item:
{"kind":"convention|decision|user_preference|architecture_log|file_summary","title":"<short>","content":"<one sentence>"}

Rules:
- Only extract things that should persist into FUTURE tasks (not "I just fixed bug X").
- Skip generic info (e.g., "use async/await" unless explicitly stated by user).
- Maximum 5 items. Quality > quantity.
- If nothing useful, return [].
- No markdown, no commentary — just the JSON array.`;

  const userMsg = `Task type: ${input.taskType}
User prompt:
${input.userPrompt.slice(0, 1200)}

Assistant response (truncated):
${input.responseContent.slice(0, 2500)}

Extract durable facts.`;

  try {
    const res = await callLLM(
      model,
      [{ role: "system", content: sys }, { role: "user", content: userMsg }],
      0,
      400,
    );
    // Loose JSON extraction
    const raw = res.content.trim();
    const m = raw.match(/\[[\s\S]*\]/);
    if (!m) return [];
    const parsed = JSON.parse(m[0]);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .slice(0, 5)
      .filter((p) => p && typeof p === "object" && p.kind && p.title && p.content)
      .map((p): ExtractedFact => ({
        kind: String(p.kind) as CPLEntryKind,
        title: String(p.title).slice(0, 200),
        content: String(p.content).slice(0, 600),
      }));
  } catch (err) {
    logger.warn("LLM extractor failed, using pattern extraction only", err);
    return [];
  }
}

export async function extractAndStore(input: ExtractInput, opts: { useLlm?: boolean } = {}): Promise<{ stored: number; facts: ExtractedFact[] }> {
  const useLlm = opts.useLlm ?? input.responseContent.length > 800;

  const facts: ExtractedFact[] = [];
  facts.push(...patternExtract(input.userPrompt, input.responseContent, input.taskType));

  if (useLlm) {
    const llmFacts = await llmExtract(input);
    facts.push(...llmFacts);
  }

  // File summary — always record if a file was the focus
  if (input.fileName && input.rawCode && input.rawCode.length > 200) {
    facts.push({
      kind: "file_summary",
      title: `File: ${input.fileName}`,
      content: `${input.taskType} task touched ${input.fileName}. Size ~${input.rawCode.length} chars. Summary: ${input.responseContent.slice(0, 200)}...`,
    });
  }

  // Deduplicate by title within this batch
  const seen = new Set<string>();
  const unique = facts.filter((f) => {
    const k = `${f.kind}::${f.title}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  let stored = 0;
  for (const f of unique) {
    try {
      sessionContextStore.upsert({
        sessionKey: input.sessionKey,
        kind: f.kind,
        title: f.title,
        content: f.content,
        sourceModel: input.routedModel,
      });
      stored++;
    } catch (err) {
      logger.warn(`Failed to store CPL fact: ${f.title}`, err);
    }
  }

  return { stored, facts: unique };
}
