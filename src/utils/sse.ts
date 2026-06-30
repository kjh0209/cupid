import type { FastifyReply } from "fastify";

export interface SSEWriter {
  send: (event: string, data: unknown) => void;
  end: () => void;
}

export function initSSE(reply: FastifyReply): SSEWriter {
  reply.hijack();
  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  reply.raw.write(": ping\n\n");
  if (typeof (reply.raw as { flushHeaders?: () => void }).flushHeaders === "function") {
    (reply.raw as { flushHeaders: () => void }).flushHeaders();
  }

  const send = (event: string, data: unknown) => {
    reply.raw.write(`event: ${event}\n`);
    reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const end = () => {
    try { reply.raw.end(); } catch { /* socket may already be closed */ }
  };

  return { send, end };
}
