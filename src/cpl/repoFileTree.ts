// ============================================================
// Repo File Tree Builder
//
// Builds a compact file-tree string from the ide_workspace_files
// table for a given workspace and injects it into the CPL as a
// pinned repo_summary entry.  This gives the routed LLM a map
// of the codebase for multi_file_refactor and architecture tasks,
// significantly improving its ability to locate files and respect
// existing structure.
//
// The tree is stored as a pinned CPL entry so it surfaces in
// every future preamble for this session without burning extra
// token budget on retrieval scoring.
// ============================================================

import { getSqlite } from "../db/database.js";
import { sessionContextStore } from "./sessionContextStore.js";
import { logger } from "../utils/logger.js";

interface WorkspaceFile {
  path: string;
  content: string;
}

/** Extract workspace ID from a sessionKey like "workbench::ws-<uuid>" */
function extractWorkspaceId(sessionKey: string): string | null {
  const m = sessionKey.match(/ws-([a-f0-9-]+)/i);
  return m ? m[1] : null;
}

/** Build a compact ASCII tree from a list of file paths */
function buildAsciiTree(paths: string[]): string {
  if (paths.length === 0) return "(empty)";

  // Sort so that directories are listed before their children
  const sorted = [...paths].sort();

  const tree: string[] = [];
  const seenDirs = new Set<string>();

  for (const p of sorted) {
    const parts = p.split("/");
    for (let depth = 0; depth < parts.length - 1; depth++) {
      const dir = parts.slice(0, depth + 1).join("/");
      if (!seenDirs.has(dir)) {
        seenDirs.add(dir);
        tree.push("  ".repeat(depth) + parts[depth] + "/");
      }
    }
    // File itself
    const depth = parts.length - 1;
    tree.push("  ".repeat(depth) + parts[depth]);
  }

  return tree.join("\n");
}

/**
 * Build a compact summary line for a file (first non-blank line or path).
 * Keeps the tree entry informative without blowing the token budget.
 */
function briefFileSummary(path: string, content: string): string {
  const lines = content.split("\n").map((l) => l.trim()).filter(Boolean);
  const first = lines[0] ?? "";
  // Strip common boilerplate prefixes
  const clean = first
    .replace(/^\/\/\s*/, "")
    .replace(/^\/\*+\s*/, "")
    .replace(/^#\s*/, "")
    .replace(/^"""/, "")
    .slice(0, 120);
  return clean || path;
}

/**
 * Inject the workspace file tree into the CPL for `sessionKey`.
 *
 * Idempotent — if the tree entry already exists it is updated, not duplicated
 * (handled by sessionContextStore.upsert dedup logic).
 *
 * Only runs for task types where file-tree awareness helps:
 *   multi_file_refactor, architecture_design, dependency_update
 */
export async function injectRepoFileTree(opts: {
  sessionKey: string;
  taskType: string;
  sourceModel?: string;
}): Promise<{ injected: boolean; fileCount: number }> {
  const TREE_RELEVANT_TASKS = new Set([
    "multi_file_refactor",
    "architecture_design",
    "dependency_update",
    "devops_config",
    "multi_file_refactor",
  ]);

  if (!TREE_RELEVANT_TASKS.has(opts.taskType)) {
    return { injected: false, fileCount: 0 };
  }

  // Try to resolve the workspace from the sessionKey
  const workspaceId = extractWorkspaceId(opts.sessionKey);

  let files: WorkspaceFile[] = [];

  if (workspaceId) {
    try {
      const sqlite = getSqlite();
      const rows = sqlite
        .prepare(
          `SELECT path, content FROM ide_workspace_files
           WHERE workspace_id = ?
           ORDER BY path ASC
           LIMIT 500`
        )
        .all(workspaceId) as WorkspaceFile[];
      files = rows;
    } catch (err) {
      logger.warn("repoFileTree: failed to query ide_workspace_files", err);
    }
  }

  if (files.length === 0) {
    return { injected: false, fileCount: 0 };
  }

  // Exclude common noise paths
  const EXCLUDE = /node_modules|\.git|\.next|dist\/|build\/|\.cache|__pycache__|\.pyc$/;
  const filtered = files.filter((f) => !EXCLUDE.test(f.path));

  const tree = buildAsciiTree(filtered.map((f) => f.path));

  // Build a richer summary: tree + per-file one-liners for TS/JS files
  const summaryLines: string[] = [
    `Repository file tree (${filtered.length} files):`,
    "```",
    tree.slice(0, 3000), // cap to avoid huge tokens
    "```",
  ];

  // Add brief description for key source files
  const srcFiles = filtered.filter(
    (f) => /\.(ts|js|tsx|jsx|py|go|rs|java)$/.test(f.path) && f.content.length > 0
  ).slice(0, 30);

  if (srcFiles.length > 0) {
    summaryLines.push("\nKey source files:");
    for (const f of srcFiles) {
      summaryLines.push(`  ${f.path} — ${briefFileSummary(f.path, f.content)}`);
    }
  }

  const content = summaryLines.join("\n");

  try {
    sessionContextStore.upsert({
      sessionKey: opts.sessionKey,
      kind: "repo_summary",
      title: "Repository File Tree",
      content,
      pinned: true,
      sourceModel: opts.sourceModel,
      metadata: { fileCount: filtered.length, generatedAt: new Date().toISOString() },
    });
    logger.info(`repoFileTree: injected tree (${filtered.length} files) for session=${opts.sessionKey}`);
    return { injected: true, fileCount: filtered.length };
  } catch (err) {
    logger.warn("repoFileTree: failed to upsert CPL entry", err);
    return { injected: false, fileCount: 0 };
  }
}
