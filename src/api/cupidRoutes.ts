import type { FastifyInstance } from "fastify";
import { runPipeline } from "../cupid/cupidEngine.js";
import { contextStorage } from "../cupid/contextStorage.js";
import { MODEL_REGISTRY } from "../cupid/registry.js";
import type { IDEContext } from "../cupid/types.js";
import { logger } from "../utils/logger.js";

interface PipelineRequestBody {
  prompt?: string;
  context?: Partial<IDEContext>;
  sessionKey?: string;
  /** When true, the response is streamed as SSE so the UI can animate per-step */
  stream?: boolean;
}

function normalizeContext(input: Partial<IDEContext> | undefined): IDEContext {
  return {
    fileName: input?.fileName ?? "untitled.txt",
    activeLanguage: input?.activeLanguage ?? "plaintext",
    fileLineCount: input?.fileLineCount ?? 0,
    hasTerminalError: input?.hasTerminalError ?? false,
    hasHighlightedText: input?.hasHighlightedText ?? false,
    rawCodePayload: input?.rawCodePayload ?? "",
    gitDiffText: input?.gitDiffText ?? null,
    sessionKey: input?.sessionKey,
  };
}

export async function registerCupidRoutes(app: FastifyInstance) {
  // ── Static introspection ─────────────────────────────────────
  app.get("/api/cupid/registry", async () => ({ models: MODEL_REGISTRY }));

  app.get<{ Querystring: { sessionKey?: string } }>(
    "/api/cupid/storage",
    async (req) => {
      const sessionKey = req.query.sessionKey ?? "default::session";
      return contextStorage.inspect(sessionKey);
    },
  );

  app.post<{ Body: { sessionKey?: string } }>(
    "/api/cupid/storage/reset",
    async (req) => {
      contextStorage.reset(req.body?.sessionKey);
      return { ok: true };
    },
  );

  // ── Pipeline trace ───────────────────────────────────────────
  app.post<{ Body: PipelineRequestBody }>("/api/cupid/pipeline/trace", async (req, reply) => {
    const body = req.body ?? {};
    const prompt = (body.prompt ?? "").trim();
    if (!prompt) return reply.status(400).send({ error: "prompt is required" });

    const context = normalizeContext({ ...body.context, sessionKey: body.sessionKey ?? body.context?.sessionKey });

    if (!body.stream) {
      const result = runPipeline(prompt, context);
      return reply.send(result);
    }

    // SSE streaming — emit one event per step, then a `done` event
    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    // Force flush so SSE starts streaming immediately even behind buffering proxies
    reply.raw.write(": ping\n\n");
    if (typeof (reply.raw as { flushHeaders?: () => void }).flushHeaders === "function") {
      (reply.raw as { flushHeaders: () => void }).flushHeaders();
    }

    const send = (event: string, data: unknown) => {
      reply.raw.write(`event: ${event}\n`);
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const result = runPipeline(prompt, context);
      // Replay steps with small artificial delays so the UI can animate
      for (const step of result.steps) {
        send("step", step);
        await new Promise((r) => setTimeout(r, 250));
      }
      send("done", {
        intent: result.intent,
        routedModel: result.routedModel,
        totals: result.totals,
        compressed: {
          originalTokens: result.compressed.originalTokens,
          compressedTokens: result.compressed.compressedTokens,
          rulesApplied: result.compressed.rulesApplied,
          diffSnippets: result.compressed.diffSnippets.slice(0, 30),
        },
        auction: result.auction,
        storage: result.storage,
      });
    } catch (err) {
      logger.error("Pipeline SSE failed", err);
      send("error", { message: String(err) });
    } finally {
      reply.raw.end();
    }
  });
}
