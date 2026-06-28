// ============================================================
// Repo File Tree — CPL auto-injection for refactor/arch tasks
//
// When the task type requires broad workspace awareness
// (multi_file_refactor, architecture_design, devops_config,
// dependency_update), this module builds an ASCII file tree
// from ide_workspace_files and stores it as a pinned
// repo_summary CPL entry for the session.
//
// The entry is only refreshed if it's older than TTL_MS or
// if the number of files in the workspace has changed.
// ============================================================

import { getSqlite } from "../db/database.js";
import { sessionContextStore } from "./sessionContextStore.js";
import { logger } from "../utils/logger.js";
import type { TaskType } from "../types.js";

const TTL_MS = 5 * 60 * 1000; // 5 minutes

const TREE_INJECTION_TASKS: Set<TaskType> = new Set([
  "multi_file_refactor",
  "architecture_design",
  "devops_config",
  "dependency_update",
  "performance_optimization",
]);

function extractWorkspaceId(sessionKey: string): string | null {
  // sessionKey format: "workbench::ws-<id>" or "<prefix>::<workspaceId>"
  const parts = sessionKey.split("::");
  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    if (!last) return null;
    // Handle "ws-<uuid>" format
    if (last.startsWith("ws-")) return last.slice(3);
    return last;
  }
  return null;
}

function buildAsciiTree(paths: string[]): string {
  if (paths.length === 0) return "(empty workspace)";

  // Sort to get a stable, directory-first order
  const sorted = [...paths].sort();

  // Build a prefix tree
  type TreeNode = { children: Map<string, TreeNode>; isFile: boolean };
  const root: TreeNode = { children: new Map(), isFile: false };

  for (const p of sorted) {
    const parts = p.replace(/^\//, "").split("/");
    let node = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      if (!node.children.has(part)) {
        node.children.set(part, { children: new Map(), isFile: false });
      }
      node = node.children.get(part)!;
      if (i === parts.length - 1) node.isFile = true;
    }
  }

  const lines: string[] = [];

  function render(node: TreeNode, prefix: string, name: string) {
    lines.push(`${prefix}${name}${node.isFile ? "" : "/"}`);
    const children = [...node.children.entries()];
    for (let i = 0; i < children.length; i++) {
      const [childName, childNode] = children[i]!;
      const isLast = i === children.length - 1;
      render(childNode, prefix + (isLast ? "    " : "│   "), (isLast ? "└── " : "├── ") + childName);
    }
  }

  for (const [name, child] of root.children) {
    render(child, "", name);
  }

  return lines.join("\n");
}

export async function injectRepoFileTree(
  sessionKey: string,
  taskType: TaskType,
): Promise<void> {
  if (!TREE_INJECTION_TASKS.has(taskType)) return;
  if (!sessionKey) return;

  const workspaceId = extractWorkspaceId(sessionKey);
  if (!workspaceId) return;

  try {
    const sqlite = getSqlite();

    // Check if we have a recent pinned repo_summary tree entry already
    const existing = sqlite.prepare(`
      SELECT id, last_used_at, metadata_json
      FROM cpl_context_entries
      WHERE session_key = ? AND kind = 'repo_summary' AND title = 'Workspace File Tree'
      LIMIT 1
    `).get(sessionKey) as { id: string; last_used_at: string; metadata_json: string } | undefined;

    if (existing) {
      const ageMs = Date.now() - new Date(existing.last_used_at).getTime();
      if (ageMs < TTL_MS) {
        logger.debug(`RepoFileTree: skipping injection — existing entry is fresh (${Math.round(ageMs / 1000)}s old)`);
        return;
      }
    }

    // Fetch file paths from ide_workspace_files
    const rows = sqlite.prepare(`
      SELECT path FROM ide_workspace_files WHERE workspace_id = ? ORDER BY path ASC LIMIT 500
    `).all(workspaceId) as Array<{ path: string }>;

    if (rows.length === 0) {
      logger.debug(`RepoFileTree: no files found for workspace ${workspaceId}`);
      return;
    }

    // If file count is same as before, skip rebuild
    if (existing) {
      try {
        const meta = JSON.parse(existing.metadata_json) as { fileCount?: number };
        if (meta.fileCount === rows.length) {
          logger.debug(`RepoFileTree: file count unchanged (${rows.length}), skipping refresh`);
          return;
        }
      } catch { /* ignore parse error */ }
    }

    const paths = rows.map((r) => r.path);
    const tree = buildAsciiTree(paths);

    const content = `Workspace file tree (${paths.length} files):\n\`\`\`\n${tree}\n\`\`\``;

    sessionContextStore.upsert({
      sessionKey,
      kind: "repo_summary",
      title: "Workspace File Tree",
      content,
      pinned: true,
      sourceModel: "system",
      metadata: { fileCount: paths.length, generatedAt: new Date().toISOString() },
    });

    logger.info(`RepoFileTree: injected ${paths.length}-file tree into session=${sessionKey}`);
  } catch (err) {
    // Non-fatal: CPL injection failure should not block the main request
    logger.warn(`RepoFileTree: injection failed (session=${sessionKey})`, err);
  }
}
