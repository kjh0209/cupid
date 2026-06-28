import type { FastifyInstance } from "fastify";
import { randomUUID } from "crypto";
import { getSqlite } from "../db/database.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import {
  createSession,
  destroySession,
  setSessionCookie,
  clearSessionCookie,
  readSessionToken,
  getSessionUser,
} from "../auth/session.js";
import { logger } from "../utils/logger.js";

interface SignupBody { email?: string; password?: string }
interface LoginBody { email?: string; password?: string }

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post<{ Body: SignupBody }>("/api/auth/signup", async (req, reply) => {
    const email = (req.body?.email ?? "").trim().toLowerCase();
    const password = req.body?.password ?? "";
    if (!isValidEmail(email)) return reply.status(400).send({ error: "invalid email" });
    if (password.length < 8) return reply.status(400).send({ error: "password must be ≥ 8 chars" });

    const existing = getSqlite().prepare(`SELECT id FROM ide_users WHERE email = ?`).get(email);
    if (existing) return reply.status(409).send({ error: "email already registered" });

    const { hash, salt } = await hashPassword(password);
    const id = randomUUID();
    const now = new Date().toISOString();
    getSqlite()
      .prepare(`INSERT INTO ide_users (id, email, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?, ?)`)
      .run(id, email, hash, salt, now);

    // Bootstrap a default workspace so the user can immediately start coding
    const wsId = randomUUID();
    getSqlite()
      .prepare(`INSERT INTO ide_workspaces (id, owner_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`)
      .run(wsId, id, "My workspace", now, now);
    const seed = "// Welcome to your Cupid IDE workspace.\n// Edit, save (auto), and run via the right-side panel.\n\nconsole.log('hello from cupid');\n";
    getSqlite()
      .prepare(`INSERT INTO ide_workspace_files (id, workspace_id, path, content, updated_at) VALUES (?, ?, ?, ?, ?)`)
      .run(randomUUID(), wsId, "main.ts", seed, now);

    const token = createSession(id, req.headers["user-agent"] ?? undefined);
    setSessionCookie(reply, token);
    logger.info(`signup: ${email}`);
    return reply.send({ user: { id, email }, workspaceId: wsId });
  });

  app.post<{ Body: LoginBody }>("/api/auth/login", async (req, reply) => {
    const email = (req.body?.email ?? "").trim().toLowerCase();
    const password = req.body?.password ?? "";
    const user = getSqlite()
      .prepare(`SELECT id, email, password_hash, password_salt FROM ide_users WHERE email = ?`)
      .get(email) as { id: string; email: string; password_hash: string; password_salt: string } | undefined;
    if (!user) return reply.status(401).send({ error: "invalid credentials" });
    const ok = await verifyPassword(password, user.password_hash, user.password_salt);
    if (!ok) return reply.status(401).send({ error: "invalid credentials" });

    const token = createSession(user.id, req.headers["user-agent"] ?? undefined);
    setSessionCookie(reply, token);
    return reply.send({ user: { id: user.id, email: user.email } });
  });

  app.post("/api/auth/logout", async (req, reply) => {
    const token = readSessionToken(req);
    if (token) destroySession(token);
    clearSessionCookie(reply);
    return reply.send({ ok: true });
  });

  app.get("/api/auth/me", async (req, reply) => {
    const token = readSessionToken(req);
    if (!token) return reply.send({ user: null });
    const user = getSessionUser(token);
    return reply.send({ user });
  });
}
