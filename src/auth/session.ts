import { randomBytes } from "crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { getSqlite } from "../db/database.js";

export const SESSION_COOKIE = "cupid_ide_session";
const SESSION_TTL_DAYS = 30;

interface SessionRow {
  token: string;
  user_id: string;
  created_at: string;
  last_seen_at: string;
}

interface UserRow {
  id: string;
  email: string;
  created_at: string;
}

export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function createSession(userId: string, userAgent?: string): string {
  const token = newSessionToken();
  const now = new Date().toISOString();
  getSqlite()
    .prepare(
      `INSERT INTO ide_sessions (token, user_id, created_at, last_seen_at, user_agent) VALUES (?, ?, ?, ?, ?)`,
    )
    .run(token, userId, now, now, userAgent ?? null);
  return token;
}

export function destroySession(token: string): void {
  getSqlite().prepare(`DELETE FROM ide_sessions WHERE token = ?`).run(token);
}

export function getSessionUser(token: string): UserRow | null {
  const session = getSqlite()
    .prepare(`SELECT * FROM ide_sessions WHERE token = ?`)
    .get(token) as SessionRow | undefined;
  if (!session) return null;
  // Touch last_seen_at
  getSqlite()
    .prepare(`UPDATE ide_sessions SET last_seen_at = ? WHERE token = ?`)
    .run(new Date().toISOString(), token);
  const user = getSqlite()
    .prepare(`SELECT id, email, created_at FROM ide_users WHERE id = ?`)
    .get(session.user_id) as UserRow | undefined;
  return user ?? null;
}

export function setSessionCookie(reply: FastifyReply, token: string) {
  const maxAge = SESSION_TTL_DAYS * 24 * 60 * 60;
  // SameSite=Lax + HttpOnly. Don't set Secure in dev (HTTP) — set it in prod via env.
  const secure = process.env["NODE_ENV"] === "production" ? "; Secure" : "";
  reply.header(
    "Set-Cookie",
    `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure}`,
  );
}

export function clearSessionCookie(reply: FastifyReply) {
  reply.header(
    "Set-Cookie",
    `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`,
  );
}

export function readSessionToken(req: FastifyRequest): string | null {
  const cookieHeader = req.headers.cookie ?? "";
  for (const pair of cookieHeader.split(/;\s*/)) {
    const [k, ...rest] = pair.split("=");
    if (k === SESSION_COOKIE) return rest.join("=");
  }
  return null;
}

export interface AuthedRequest extends FastifyRequest {
  authUser?: UserRow;
}

/** Returns the authenticated user, or sends 401 + null. */
export function requireAuth(req: FastifyRequest, reply: FastifyReply): UserRow | null {
  const token = readSessionToken(req);
  if (!token) {
    reply.status(401).send({ error: "unauthenticated" });
    return null;
  }
  const user = getSessionUser(token);
  if (!user) {
    reply.status(401).send({ error: "unauthenticated" });
    return null;
  }
  (req as AuthedRequest).authUser = user;
  return user;
}
