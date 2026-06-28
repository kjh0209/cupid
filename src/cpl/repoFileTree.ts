// ============================================================
// Repo File Tree → CPL Auto-injection
//
// For architecture/refactor/devops tasks, the model needs to
// understand the workspace structure. This module queries the
// ide_workspace_files table (populated by the IDE plugin) and
// builds a pinned repo_summary CPL entry.
//
// The entry is injected BEFORE the preamble is assembled, so
// it appears first in the session_context block.
// ============================================================

import { getSqlite } from "../db/database.js";
import { sessionContextStore } from "./sessionContextStore.js";
import { logger } from "../utils/logger.js";
import type { TaskType } from "../types.js";

const TREE_ELIGIBLE_TASK_TYPES: TaskType[] = [
  "multi_file_refactor",
  "architecture_design",
  "devops_config",
  "dependency_update",
];

interface WorkspaceFile {
  file_path: string;
  file_type: string | null;
  description: string | null;
}

function buildAsciiTree(files: WorkspaceFile[]): string {
  const paths = files.map((f) => f.file_path).sort();

  // Group by top-level directory
  const tree: Map<string, string[]> = new Map();
  for (const p of paths) {
    const parts = p.split("/");
    const topDir = parts.length > 1 ? parts[0]! : "(root)";
    const rest = parts.length > 1 ? parts.slice(1).join("/") : p;
    const bucket = tree.get(topDir) ?? [];
    bucket.push(rest);
    tree.set(topDir, bucket);
  }

  const lines: string[] = [];
  const dirs = Array.from(tree.keys()).sort();
  for (const dir of dirs) {
    lines.push(`${dir}/`);
    const children = tree.get(dir)!.slice(0, 20); // cap per dir
    for (const child of children) {
      lines.push(`  ${child}`);
    }
    if ((tree.get(dir)?.length ?? 0) > 20) {
      lines.push(`  ... +${(tree.get(dir)?.length ?? 0) - 20} more`);
    }
  }

  return lines.join("\n");
}

/**
 * Inject a pinned repo_summary CPL entry with the workspace file tree.
 * No-op if the workspace table doesn't exist or has no files.
 * Fire-and-forget — catch errors silently.
 */
export async function injectRepoFileTree(input: {
  sessionKey: string;
  workspaceId?: string;
  taskType: TaskType;
}): Promise<{ injected: boolean; fileCount: number }> {
  if (!TREE_ELIGIBLE_TASK_TYPES.includes(input.taskType)) {
    return { injected: false, fileCount: 0 };
  }

  try {
    const sqlite = getSqlite();

    // Check if the table exists
    const tableExists = sqlite
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='ide_workspace_files'`)
      .get();
    if (!tableExists) {
      return { injected: false, fileCount: 0 };
    }

    let files: WorkspaceFile[];
    if (input.workspaceId) {
      files = sqlite
        .prepare(`SELECT file_path, file_type, description FROM ide_workspace_files WHERE workspace_id = ? ORDER BY file_path LIMIT 200`)
        .all(input.workspaceId) as WorkspaceFile[];
    } else {
      files = sqlite
        .prepare(`SELECT file_path, file_type, description FROM ide_workspace_files ORDER BY file_path LIMIT 200`)
        .all() as WorkspaceFile[];
    }

    if (files.length === 0) {
      return { injected: false, fileCount: 0 };
    }

    const tree = buildAsciiTree(files);
    const descriptions = files
      .filter((f) => f.description)
      .slice(0, 10)
      .map((f) => `- ${f.file_path}: ${f.description}`)
      .join("\n");

    const content = [
      `Workspace contains ${files.length} files.`,
      "",
      "File tree:",
      tree,
      descriptions ? `\nKey files:\n${descriptions}` : "",
    ].filter(Boolean).join("\n");

    sessionContextStore.upsert({
      sessionKey: input.sessionKey,
      kind: "repo_summary",
      title: "Workspace file tree",
      content,
      pinned: true,
      metadata: { workspaceId: input.workspaceId, fileCount: files.length, autoInjected: true },
    });

    logger.info(`RepoFileTree: injected ${files.length} files into CPL for session=${input.sessionKey}`);
    return { injected: true, fileCount: files.length };
  } catch (err) {
    logger.warn("RepoFileTree injection failed (non-fatal)", err);
    return { injected: false, fileCount: 0 };
  }
}
