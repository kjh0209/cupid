import type { FastifyInstance } from "fastify";
import { sessionContextStore, type CPLEntryKind } from "../cpl/sessionContextStore.js";

interface UpsertBody {
  sessionKey: string;
  kind: CPLEntryKind;
  title: string;
  content: string;
  pinned?: boolean;
  sourceModel?: string;
  metadata?: Record<string, unknown>;
}

export async function registerCplRoutes(app: FastifyInstance) {
  // List entries for a session
  app.get<{ Querystring: { sessionKey?: string } }>("/api/cpl/entries", async (req, reply) => {
    const sessionKey = req.query.sessionKey ?? "";
    if (!sessionKey) return reply.status(400).send({ error: "sessionKey required" });
    return { entries: sessionContextStore.listAll(sessionKey) };
  });

  // Stats for a session
  app.get<{ Querystring: { sessionKey?: string } }>("/api/cpl/stats", async (req, reply) => {
    const sessionKey = req.query.sessionKey ?? "";
    if (!sessionKey) return reply.status(400).send({ error: "sessionKey required" });
    return sessionContextStore.stats(sessionKey);
  });

  // Recent task history
  app.get<{ Querystring: { sessionKey?: string; limit?: string } }>("/api/cpl/history", async (req, reply) => {
    const sessionKey = req.query.sessionKey ?? "";
    if (!sessionKey) return reply.status(400).send({ error: "sessionKey required" });
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit ?? "20", 10) || 20));
    return { history: sessionContextStore.listHistory(sessionKey, limit) };
  });

  // Manually add an entry (e.g., user adds a project README summary as repo_summary)
  app.post<{ Body: UpsertBody }>("/api/cpl/entries", async (req, reply) => {
    const b = req.body;
    if (!b?.sessionKey || !b?.kind || !b?.title || !b?.content) {
      return reply.status(400).send({ error: "sessionKey, kind, title, content required" });
    }
    const entry = sessionContextStore.upsert(b);
    return { entry };
  });

  // Delete entry
  app.delete<{ Params: { id: string } }>("/api/cpl/entries/:id", async (req) => {
    const ok = sessionContextStore.delete(req.params.id);
    return { ok };
  });

  // Reset entire session
  app.post<{ Body: { sessionKey?: string } }>("/api/cpl/reset", async (req, reply) => {
    if (!req.body?.sessionKey) return reply.status(400).send({ error: "sessionKey required" });
    sessionContextStore.resetSession(req.body.sessionKey);
    return { ok: true };
  });

  // Preview the preamble that would be injected for a given prompt
  app.post<{ Body: { sessionKey?: string; prompt?: string; taskType?: string } }>("/api/cpl/preview", async (req, reply) => {
    if (!req.body?.sessionKey || !req.body?.prompt) {
      return reply.status(400).send({ error: "sessionKey and prompt required" });
    }
    const built = sessionContextStore.buildPreamble({
      sessionKey: req.body.sessionKey,
      query: req.body.prompt,
      taskType: req.body.taskType,
      tokenBudget: 1800,
      includeRecentTasks: true,
    });
    return {
      preamble: built.preamble,
      entriesUsed: built.entriesUsed,
      tokensUsed: built.tokensUsed,
      debug: built.debug,
    };
  });
}
