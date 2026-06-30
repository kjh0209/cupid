import Fastify from "fastify";
import cors from "@fastify/cors";
import { registerRoutes } from "./api/routes.js";
import { registerEvalRoutes } from "./api/evalRoutes.js";
import { registerCompareRoutes } from "./api/compareRoutes.js";
import { registerCupidRoutes } from "./api/cupidRoutes.js";
import { registerAuthRoutes } from "./api/authRoutes.js";
import { registerWorkspaceRoutes } from "./api/workspaceRoutes.js";
import { registerChatRoutes } from "./api/chatRoutes.js";
import { registerCplRoutes } from "./api/cplRoutes.js";
import { registerStreamRoutes } from "./api/streamRoutes.js";
import { initDb } from "./db/database.js";
import { logger } from "./utils/logger.js";
import { apiLimiter } from "./api/rateLimiter.js";

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000",
];

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  const envOrigins = process.env["CORS_ORIGINS"];
  if (envOrigins) {
    const extra = envOrigins.split(",").map((s) => s.trim());
    if (extra.includes(origin)) return true;
  }
  return ALLOWED_ORIGINS.includes(origin);
}

export async function createServer() {
  const app = Fastify({
    logger: false,
    disableRequestLogging: true,
  });

  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin || isAllowedOrigin(origin)) {
        cb(null, true);
      } else {
        cb(new Error("CORS: origin not allowed"), false);
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  });

  // Security headers
  app.addHook("onSend", async (_req, reply) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Frame-Options", "DENY");
    reply.header("X-XSS-Protection", "0");
    reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
    if (process.env["NODE_ENV"] === "production") {
      reply.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
  });

  // Global rate limiter
  app.addHook("onRequest", async (req, reply) => {
    const ip = req.ip;
    if (!apiLimiter.consume(ip)) {
      reply.status(429).send({ error: "too many requests" });
    }
  });

  app.addContentTypeParser("application/json", { parseAs: "string", bodyLimit: 1_048_576 }, (req, body, done) => {
    try {
      done(null, JSON.parse(body as string));
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  await registerRoutes(app);
  await registerEvalRoutes(app);
  await registerCompareRoutes(app);
  await registerCupidRoutes(app);
  await registerAuthRoutes(app);
  await registerWorkspaceRoutes(app);
  await registerChatRoutes(app);
  await registerCplRoutes(app);
  await registerStreamRoutes(app);

  return app;
}

export async function startServer() {
  const db = initDb();
  const app = await createServer();

  const port = parseInt(process.env["PORT"] ?? "3000");
  const host = process.env["HOST"] ?? "0.0.0.0";

  try {
    await app.listen({ port, host });
    logger.info(`Server listening on http://${host}:${port}`);
    logger.info(`API docs: http://localhost:${port}/health`);
  } catch (err) {
    logger.error("Failed to start server", err);
    process.exit(1);
  }

  return app;
}
