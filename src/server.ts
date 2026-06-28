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
import { initDb } from "./db/database.js";
import { logger } from "./utils/logger.js";

export async function createServer() {
  const app = Fastify({
    logger: false,
    disableRequestLogging: true,
  });

  await app.register(cors, {
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  });

  app.addContentTypeParser("application/json", { parseAs: "string" }, (req, body, done) => {
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
