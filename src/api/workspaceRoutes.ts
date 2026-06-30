import type { FastifyInstance } from "fastify";
import { randomUUID } from "crypto";
import { getSqlite } from "../db/database.js";
import { requireAuth } from "../auth/session.js";
import { logger } from "../utils/logger.js";

interface WorkspaceRow {
  id: string;
  owner_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

interface FileRow {
  id: string;
  workspace_id: string;
  path: string;
  content: string;
  updated_at: string;
}

interface CreateWorkspaceBody { name?: string }
interface RenameWorkspaceBody { name?: string }
interface CreateFileBody { path?: string; content?: string }
interface UpdateFileBody { content?: string; path?: string }

function getWorkspace(id: string, userId: string): WorkspaceRow | null {
  const ws = getSqlite()
    .prepare(`SELECT * FROM ide_workspaces WHERE id = ? AND owner_id = ?`)
    .get(id, userId) as WorkspaceRow | undefined;
  return ws ?? null;
}

export async function registerWorkspaceRoutes(app: FastifyInstance) {
  // ── List my workspaces ───────────────────────────────────────
  app.get("/api/workspaces", async (req, reply) => {
    const user = requireAuth(req, reply);
    if (!user) return;
    const rows = getSqlite()
      .prepare(`SELECT * FROM ide_workspaces WHERE owner_id = ? ORDER BY updated_at DESC`)
      .all(user.id) as WorkspaceRow[];
    return reply.send({ workspaces: rows });
  });

  // ── Create workspace ─────────────────────────────────────────
  app.post<{ Body: CreateWorkspaceBody }>("/api/workspaces", async (req, reply) => {
    const user = requireAuth(req, reply);
    if (!user) return;
    const name = (req.body?.name ?? "Untitled").trim().slice(0, 80) || "Untitled";
    const id = randomUUID();
    const now = new Date().toISOString();
    getSqlite()
      .prepare(`INSERT INTO ide_workspaces (id, owner_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`)
      .run(id, user.id, name, now, now);
    // Seed a default file
    getSqlite()
      .prepare(`INSERT INTO ide_workspace_files (id, workspace_id, path, content, updated_at) VALUES (?, ?, ?, ?, ?)`)
      .run(randomUUID(), id, "main.ts", "// new workspace\n", now);
    return reply.send({ workspace: { id, owner_id: user.id, name, created_at: now, updated_at: now } });
  });

  // ── Rename workspace ─────────────────────────────────────────
  app.patch<{ Params: { id: string }; Body: RenameWorkspaceBody }>(
    "/api/workspaces/:id",
    async (req, reply) => {
      const user = requireAuth(req, reply);
      if (!user) return;
      const ws = getWorkspace(req.params.id, user.id);
      if (!ws) return reply.status(404).send({ error: "workspace not found" });
      const name = (req.body?.name ?? ws.name).trim().slice(0, 80) || ws.name;
      const now = new Date().toISOString();
      getSqlite()
        .prepare(`UPDATE ide_workspaces SET name = ?, updated_at = ? WHERE id = ?`)
        .run(name, now, req.params.id);
      return reply.send({ workspace: { ...ws, name, updated_at: now } });
    },
  );

  // ── Delete workspace ─────────────────────────────────────────
  app.delete<{ Params: { id: string } }>("/api/workspaces/:id", async (req, reply) => {
    const user = requireAuth(req, reply);
    if (!user) return;
    const ws = getWorkspace(req.params.id, user.id);
    if (!ws) return reply.status(404).send({ error: "workspace not found" });
    getSqlite().prepare(`DELETE FROM ide_workspaces WHERE id = ?`).run(req.params.id);
    return reply.send({ ok: true });
  });

  // ── List files in a workspace ────────────────────────────────
  app.get<{ Params: { id: string } }>("/api/workspaces/:id/files", async (req, reply) => {
    const user = requireAuth(req, reply);
    if (!user) return;
    const ws = getWorkspace(req.params.id, user.id);
    if (!ws) return reply.status(404).send({ error: "workspace not found" });
    const files = getSqlite()
      .prepare(`SELECT id, path, updated_at, length(content) AS size FROM ide_workspace_files WHERE workspace_id = ? ORDER BY path`)
      .all(req.params.id) as Array<{ id: string; path: string; updated_at: string; size: number }>;
    return reply.send({ workspace: ws, files });
  });

  // ── Read single file ─────────────────────────────────────────
  app.get<{ Params: { id: string; fileId: string } }>(
    "/api/workspaces/:id/files/:fileId",
    async (req, reply) => {
      const user = requireAuth(req, reply);
      if (!user) return;
      const ws = getWorkspace(req.params.id, user.id);
      if (!ws) return reply.status(404).send({ error: "workspace not found" });
      const file = getSqlite()
        .prepare(`SELECT * FROM ide_workspace_files WHERE id = ? AND workspace_id = ?`)
        .get(req.params.fileId, req.params.id) as FileRow | undefined;
      if (!file) return reply.status(404).send({ error: "file not found" });
      return reply.send({ file });
    },
  );

  // ── Create file ──────────────────────────────────────────────
  app.post<{ Params: { id: string }; Body: CreateFileBody }>(
    "/api/workspaces/:id/files",
    async (req, reply) => {
      const user = requireAuth(req, reply);
      if (!user) return;
      const ws = getWorkspace(req.params.id, user.id);
      if (!ws) return reply.status(404).send({ error: "workspace not found" });
      const path = (req.body?.path ?? "").trim();
      if (!path) return reply.status(400).send({ error: "path is required" });
      if (path.length > 200 || /[<>:"|?*\x00]/.test(path)) return reply.status(400).send({ error: "invalid path" });
      const content = req.body?.content ?? "";
      const id = randomUUID();
      const now = new Date().toISOString();
      try {
        getSqlite()
          .prepare(`INSERT INTO ide_workspace_files (id, workspace_id, path, content, updated_at) VALUES (?, ?, ?, ?, ?)`)
          .run(id, req.params.id, path, content, now);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("UNIQUE constraint")) {
          return reply.status(409).send({ error: "file with that path already exists" });
        }
        logger.error("Failed to create workspace file", e);
        return reply.status(500).send({ error: "failed to create file" });
      }
      getSqlite()
        .prepare(`UPDATE ide_workspaces SET updated_at = ? WHERE id = ?`)
        .run(now, req.params.id);
      return reply.send({ file: { id, workspace_id: req.params.id, path, content, updated_at: now } });
    },
  );

  // ── Update file (content and/or path) ────────────────────────
  app.patch<{ Params: { id: string; fileId: string }; Body: UpdateFileBody }>(
    "/api/workspaces/:id/files/:fileId",
    async (req, reply) => {
      const user = requireAuth(req, reply);
      if (!user) return;
      const ws = getWorkspace(req.params.id, user.id);
      if (!ws) return reply.status(404).send({ error: "workspace not found" });
      const file = getSqlite()
        .prepare(`SELECT * FROM ide_workspace_files WHERE id = ? AND workspace_id = ?`)
        .get(req.params.fileId, req.params.id) as FileRow | undefined;
      if (!file) return reply.status(404).send({ error: "file not found" });

      const newContent = req.body?.content ?? file.content;
      let newPath = file.path;
      if (req.body?.path && req.body.path !== file.path) {
        newPath = req.body.path.trim();
        if (!newPath || newPath.length > 200 || /[<>:"|?*\x00]/.test(newPath)) {
          return reply.status(400).send({ error: "invalid path" });
        }
      }
      const now = new Date().toISOString();
      try {
        getSqlite()
          .prepare(`UPDATE ide_workspace_files SET content = ?, path = ?, updated_at = ? WHERE id = ?`)
          .run(newContent, newPath, now, req.params.fileId);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("UNIQUE constraint")) {
          return reply.status(409).send({ error: "path conflict" });
        }
        logger.error("Failed to update workspace file", e);
        return reply.status(500).send({ error: "failed to update file" });
      }
      getSqlite()
        .prepare(`UPDATE ide_workspaces SET updated_at = ? WHERE id = ?`)
        .run(now, req.params.id);
      return reply.send({ file: { ...file, content: newContent, path: newPath, updated_at: now } });
    },
  );

  // ── Delete file ──────────────────────────────────────────────
  app.delete<{ Params: { id: string; fileId: string } }>(
    "/api/workspaces/:id/files/:fileId",
    async (req, reply) => {
      const user = requireAuth(req, reply);
      if (!user) return;
      const ws = getWorkspace(req.params.id, user.id);
      if (!ws) return reply.status(404).send({ error: "workspace not found" });
      const res = getSqlite()
        .prepare(`DELETE FROM ide_workspace_files WHERE id = ? AND workspace_id = ?`)
        .run(req.params.fileId, req.params.id);
      if (res.changes === 0) return reply.status(404).send({ error: "file not found" });
      return reply.send({ ok: true });
    },
  );
}
