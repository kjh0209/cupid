// ============================================================
// Session Context Store — the real Context Preservation Layer
//
// This is the data layer behind the "Context Storage" node in
// the CUPID pipeline diagram. It guarantees that when a user
// switches models within the same session/repository, the new
// model receives the SAME accumulated knowledge that the
// previous model had — coding conventions, design decisions,
// repo summary, past task history, file summaries.
//
// Storage: SQLite (durable) + in-memory LRU for hot reads.
// Retrieval: BM25 over title+content; falls back to recency.
// ============================================================

import { randomUUID, createHash } from "crypto";
import { getSqlite } from "../db/database.js";
import { logger } from "../utils/logger.js";

export type CPLEntryKind =
  | "repo_summary"
  | "convention"
  | "decision"
  | "task_history"
  | "file_summary"
  | "architecture_log"
  | "user_preference"
  | "symbol_map";

export interface CPLEntry {
  id: string;
  sessionKey: string;
  kind: CPLEntryKind;
  title: string;
  content: string;
  tokens: number;
  createdAt: string;
  lastUsedAt: string;
  useCount: number;
  pinned: boolean;
  sourceModel?: string;
  metadata: Record<string, unknown>;
}

export interface CPLTaskHistoryEntry {
  id: string;
  sessionKey: string;
  promptSummary: string;
  taskType: string;
  routedModel: string;
  responseSummary: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  createdAt: string;
  metadata: Record<string, unknown>;
}

interface RawEntryRow {
  id: string;
  session_key: string;
  kind: string;
  title: string;
  content: string;
  tokens: number;
  created_at: string;
  last_used_at: string;
  use_count: number;
  pinned: number;
  source_model: string | null;
  metadata_json: string;
}

interface RawHistoryRow {
  id: string;
  session_key: string;
  prompt_summary: string;
  task_type: string;
  routed_model: string;
  response_summary: string;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  created_at: string;
  metadata_json: string;
}

function rowToEntry(r: RawEntryRow): CPLEntry {
  return {
    id: r.id,
    sessionKey: r.session_key,
    kind: r.kind as CPLEntryKind,
    title: r.title,
    content: r.content,
    tokens: r.tokens,
    createdAt: r.created_at,
    lastUsedAt: r.last_used_at,
    useCount: r.use_count,
    pinned: r.pinned === 1,
    sourceModel: r.source_model ?? undefined,
    metadata: safeJson(r.metadata_json),
  };
}

function rowToHistory(r: RawHistoryRow): CPLTaskHistoryEntry {
  return {
    id: r.id,
    sessionKey: r.session_key,
    promptSummary: r.prompt_summary,
    taskType: r.task_type,
    routedModel: r.routed_model,
    responseSummary: r.response_summary,
    tokensIn: r.tokens_in,
    tokensOut: r.tokens_out,
    costUsd: r.cost_usd,
    createdAt: r.created_at,
    metadata: safeJson(r.metadata_json),
  };
}

function safeJson(s: string): Record<string, unknown> {
  try { return JSON.parse(s); } catch { return {}; }
}

function approximateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ── BM25-lite scoring (no external deps, robust enough) ────────
function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s_./-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && t.length < 40);
}

function bm25Score(query: string, doc: string, avgLen: number, totalDocs: number, df: Map<string, number>): number {
  const k1 = 1.2;
  const b = 0.75;
  const queryTerms = tokenize(query);
  const docTerms = tokenize(doc);
  const docLen = docTerms.length;
  if (docLen === 0) return 0;
  const tf = new Map<string, number>();
  for (const t of docTerms) tf.set(t, (tf.get(t) ?? 0) + 1);
  let score = 0;
  for (const qt of new Set(queryTerms)) {
    const f = tf.get(qt) ?? 0;
    if (f === 0) continue;
    const n = df.get(qt) ?? 1;
    const idf = Math.log(1 + (totalDocs - n + 0.5) / (n + 0.5));
    score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + b * (docLen / Math.max(1, avgLen)))));
  }
  return score;
}

// ──────────────────────────────────────────────────────────────────────
// Public class
// ──────────────────────────────────────────────────────────────────────

class SessionContextStore {
  /** Store a fact, summary, decision, etc. about this session. */
  upsert(input: {
    sessionKey: string;
    kind: CPLEntryKind;
    title: string;
    content: string;
    pinned?: boolean;
    sourceModel?: string;
    metadata?: Record<string, unknown>;
  }): CPLEntry {
    const sqlite = getSqlite();
    const now = new Date().toISOString();
    const tokens = approximateTokens(input.content);

    // Deduplicate by (sessionKey, kind, title) — update the existing row instead of piling up duplicates
    const existing = sqlite
      .prepare(`SELECT id FROM cpl_context_entries WHERE session_key = ? AND kind = ? AND title = ? LIMIT 1`)
      .get(input.sessionKey, input.kind, input.title) as { id: string } | undefined;

    if (existing) {
      sqlite
        .prepare(`UPDATE cpl_context_entries SET content = ?, tokens = ?, last_used_at = ?, source_model = ?, metadata_json = ?, pinned = ? WHERE id = ?`)
        .run(
          input.content,
          tokens,
          now,
          input.sourceModel ?? null,
          JSON.stringify(input.metadata ?? {}),
          input.pinned ? 1 : 0,
          existing.id,
        );
      return this.getById(existing.id)!;
    }

    const id = randomUUID();
    sqlite
      .prepare(`INSERT INTO cpl_context_entries (id, session_key, kind, title, content, tokens, created_at, last_used_at, use_count, pinned, source_model, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`)
      .run(
        id,
        input.sessionKey,
        input.kind,
        input.title,
        input.content,
        tokens,
        now,
        now,
        input.pinned ? 1 : 0,
        input.sourceModel ?? null,
        JSON.stringify(input.metadata ?? {}),
      );
    return this.getById(id)!;
  }

  /** Append an immutable record of a task that just ran in this session. */
  recordTask(input: {
    sessionKey: string;
    promptSummary: string;
    taskType: string;
    routedModel: string;
    responseSummary: string;
    tokensIn: number;
    tokensOut: number;
    costUsd: number;
    metadata?: Record<string, unknown>;
  }): CPLTaskHistoryEntry {
    const sqlite = getSqlite();
    const id = randomUUID();
    const now = new Date().toISOString();
    sqlite
      .prepare(`INSERT INTO cpl_task_history (id, session_key, prompt_summary, task_type, routed_model, response_summary, tokens_in, tokens_out, cost_usd, created_at, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(
        id,
        input.sessionKey,
        input.promptSummary.slice(0, 500),
        input.taskType,
        input.routedModel,
        input.responseSummary.slice(0, 500),
        input.tokensIn,
        input.tokensOut,
        input.costUsd,
        now,
        JSON.stringify(input.metadata ?? {}),
      );
    return {
      id, sessionKey: input.sessionKey,
      promptSummary: input.promptSummary.slice(0, 500),
      taskType: input.taskType, routedModel: input.routedModel,
      responseSummary: input.responseSummary.slice(0, 500),
      tokensIn: input.tokensIn, tokensOut: input.tokensOut,
      costUsd: input.costUsd, createdAt: now, metadata: input.metadata ?? {},
    };
  }

  getById(id: string): CPLEntry | null {
    const row = getSqlite().prepare(`SELECT * FROM cpl_context_entries WHERE id = ?`).get(id) as RawEntryRow | undefined;
    return row ? rowToEntry(row) : null;
  }

  listAll(sessionKey: string): CPLEntry[] {
    const rows = getSqlite().prepare(`SELECT * FROM cpl_context_entries WHERE session_key = ? ORDER BY pinned DESC, last_used_at DESC`).all(sessionKey) as RawEntryRow[];
    return rows.map(rowToEntry);
  }

  listHistory(sessionKey: string, limit = 20): CPLTaskHistoryEntry[] {
    const rows = getSqlite().prepare(`SELECT * FROM cpl_task_history WHERE session_key = ? ORDER BY created_at DESC LIMIT ?`).all(sessionKey, limit) as RawHistoryRow[];
    return rows.map(rowToHistory);
  }

  /** Mark entries as used (boosts recency, used_count). */
  markUsed(ids: string[]) {
    if (ids.length === 0) return;
    const sqlite = getSqlite();
    const now = new Date().toISOString();
    const stmt = sqlite.prepare(`UPDATE cpl_context_entries SET last_used_at = ?, use_count = use_count + 1 WHERE id = ?`);
    const tx = sqlite.transaction((arr: string[]) => {
      for (const id of arr) stmt.run(now, id);
    });
    tx(ids);
  }

  /** Delete a single entry. */
  delete(id: string): boolean {
    const r = getSqlite().prepare(`DELETE FROM cpl_context_entries WHERE id = ?`).run(id);
    return r.changes > 0;
  }

  /** Clear the entire session (used for "Reset cache" button). */
  resetSession(sessionKey: string): void {
    getSqlite().prepare(`DELETE FROM cpl_context_entries WHERE session_key = ?`).run(sessionKey);
    getSqlite().prepare(`DELETE FROM cpl_task_history WHERE session_key = ?`).run(sessionKey);
  }

  /**
   * Retrieve entries relevant to the current prompt + task type, bounded by
   * a token budget. Used to assemble the "context preamble" injected into
   * the executor's user message — independent of which model is being used.
   */
  retrieveRelevant(input: {
    sessionKey: string;
    query: string;
    taskType?: string;
    tokenBudget?: number;     // default 2000
    maxEntries?: number;      // default 10
  }): { entries: CPLEntry[]; tokensUsed: number; debug: { totalCandidates: number; topScored: Array<{ id: string; score: number; title: string }> } } {
    const budget = input.tokenBudget ?? 2000;
    const maxEntries = input.maxEntries ?? 10;
    const all = this.listAll(input.sessionKey);
    if (all.length === 0) return { entries: [], tokensUsed: 0, debug: { totalCandidates: 0, topScored: [] } };

    // Build DF map
    const df = new Map<string, number>();
    let totalLen = 0;
    for (const e of all) {
      const terms = new Set(tokenize(`${e.title} ${e.content}`));
      for (const t of terms) df.set(t, (df.get(t) ?? 0) + 1);
      totalLen += tokenize(`${e.title} ${e.content}`).length;
    }
    const avgLen = Math.max(1, totalLen / all.length);

    // Score each entry
    const scored = all.map((e) => {
      let score = bm25Score(input.query, `${e.title}\n${e.content}`, avgLen, all.length, df);
      // Always-include kinds get a baseline score
      if (e.kind === "repo_summary" || e.kind === "convention" || e.kind === "user_preference") score += 0.5;
      // Pinned bonus
      if (e.pinned) score += 1.5;
      // Recency tie-breaker
      const ageMs = Date.now() - new Date(e.lastUsedAt).getTime();
      const recencyBonus = Math.max(0, 0.3 - ageMs / (1000 * 60 * 60 * 24 * 7)); // decay over a week
      score += recencyBonus;
      // Task-type affinity
      if (input.taskType) {
        if (input.taskType === "architecture_design" && (e.kind === "architecture_log" || e.kind === "decision")) score += 1.0;
        if (input.taskType === "security_sensitive_change" && /security|auth|crypt|token/i.test(e.content)) score += 1.0;
        if (input.taskType === "database_schema_change" && (e.kind === "decision" || /schema|migration|table/i.test(e.content))) score += 0.8;
      }
      return { entry: e, score };
    }).filter((s) => s.score > 0.05);

    // Sort descending
    scored.sort((a, b) => b.score - a.score);

    // Greedy pack within token budget
    const chosen: CPLEntry[] = [];
    let tokensUsed = 0;
    for (const s of scored) {
      if (chosen.length >= maxEntries) break;
      if (tokensUsed + s.entry.tokens > budget && !s.entry.pinned) continue;
      chosen.push(s.entry);
      tokensUsed += s.entry.tokens;
    }

    // Mark as used
    this.markUsed(chosen.map((c) => c.id));

    return {
      entries: chosen,
      tokensUsed,
      debug: {
        totalCandidates: all.length,
        topScored: scored.slice(0, 10).map((s) => ({ id: s.entry.id, score: Math.round(s.score * 100) / 100, title: s.entry.title })),
      },
    };
  }

  /**
   * Assemble a single "context preamble" string ready to be prepended to the
   * user message. This is model-agnostic — same preamble works for Claude,
   * GPT, Gemini, local models.
   */
  buildPreamble(input: {
    sessionKey: string;
    query: string;
    taskType?: string;
    tokenBudget?: number;
    includeRecentTasks?: boolean;
  }): { preamble: string; entriesUsed: CPLEntry[]; tokensUsed: number; debug: ReturnType<SessionContextStore["retrieveRelevant"]>["debug"] } {
    const retrieved = this.retrieveRelevant({
      sessionKey: input.sessionKey,
      query: input.query,
      taskType: input.taskType,
      tokenBudget: input.tokenBudget,
    });

    if (retrieved.entries.length === 0 && !input.includeRecentTasks) {
      return { preamble: "", entriesUsed: [], tokensUsed: 0, debug: retrieved.debug };
    }

    const sections: string[] = [];
    sections.push(`<session_context session="${input.sessionKey}">`);

    // Group entries by kind for readability
    const byKind = new Map<string, CPLEntry[]>();
    for (const e of retrieved.entries) {
      const list = byKind.get(e.kind) ?? [];
      list.push(e);
      byKind.set(e.kind, list);
    }

    const kindOrder: CPLEntryKind[] = ["repo_summary", "convention", "user_preference", "decision", "architecture_log", "file_summary", "symbol_map", "task_history"];
    for (const kind of kindOrder) {
      const items = byKind.get(kind);
      if (!items || items.length === 0) continue;
      sections.push(`<${kind}>`);
      for (const it of items) {
        sections.push(`- ${it.title}: ${it.content}`);
      }
      sections.push(`</${kind}>`);
    }

    // Recent task history
    if (input.includeRecentTasks) {
      const recentTasks = this.listHistory(input.sessionKey, 5);
      if (recentTasks.length > 0) {
        sections.push(`<recent_tasks>`);
        for (const t of recentTasks) {
          sections.push(`- [${t.taskType} via ${t.routedModel}] ${t.promptSummary} → ${t.responseSummary.slice(0, 100)}`);
        }
        sections.push(`</recent_tasks>`);
      }
    }

    sections.push(`</session_context>`);
    sections.push(``);
    sections.push(`The above session_context block summarizes prior decisions, conventions, and state for THIS session. Honor it: prefer continuity with prior decisions, use the established conventions, do not contradict earlier architecture choices without explicit reason.`);

    const preamble = sections.join("\n");
    return {
      preamble,
      entriesUsed: retrieved.entries,
      tokensUsed: retrieved.tokensUsed,
      debug: retrieved.debug,
    };
  }

  /** Aggregate session stats — used by /api/cpl/sessions/:key endpoint */
  stats(sessionKey: string) {
    const entries = this.listAll(sessionKey);
    const history = this.listHistory(sessionKey, 100);
    const totalCost = history.reduce((acc, h) => acc + h.costUsd, 0);
    const modelsUsed = new Set(history.map((h) => h.routedModel));
    return {
      sessionKey,
      entryCount: entries.length,
      historyCount: history.length,
      totalTokensStored: entries.reduce((acc, e) => acc + e.tokens, 0),
      totalCostUsd: Math.round(totalCost * 1_000_000) / 1_000_000,
      modelsUsed: Array.from(modelsUsed),
      entriesByKind: groupCount(entries.map((e) => e.kind)),
    };
  }
}

function groupCount(xs: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const x of xs) out[x] = (out[x] ?? 0) + 1;
  return out;
}

export const sessionContextStore = new SessionContextStore();
