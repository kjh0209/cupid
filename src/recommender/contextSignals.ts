// ============================================================
// Context Signals — empty-workspace detector
//
// Provides isBlankSlateSession() which checks whether the current
// session has any meaningful code context (workspace files and
// task history). Used by the DRS calculator to detect high-risk
// open-ended creation requests with no grounding context.
// ============================================================

import { getSqlite } from "../db/database.js";
import { logger } from "../utils/logger.js";

function extractWorkspaceId(sessionKey: string): string | null {
  // sessionKey format: "workbench::ws-<id>" or "<prefix>::<workspaceId>"
  const parts = sessionKey.split("::");
  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    if (!last) return null;
    if (last.startsWith("ws-")) return last.slice(3);
    return last;
  }
  return null;
}

/**
 * Returns true if the session appears to be a "blank slate":
 * workspace has ≤1 file OR session has no task history.
 *
 * Non-fatal: if the DB is unavailable, returns false so routing
 * is not blocked.
 */
export function isBlankSlateSession(sessionKey: string): boolean {
  if (!sessionKey) return false;
  try {
    const db = getSqlite();

    // Check ide_workspace_files count for this workspace
    const workspaceId = extractWorkspaceId(sessionKey);
    if (workspaceId) {
      const row = db
        .prepare("SELECT COUNT(*) AS cnt FROM ide_workspace_files WHERE workspace_id = ?")
        .get(workspaceId) as { cnt: number } | undefined;
      if (row && row.cnt <= 1) return true;
    }

    // Check CPL task history for this session
    const histRow = db
      .prepare(
        "SELECT COUNT(*) AS cnt FROM cpl_context_entries WHERE session_key = ? AND kind = 'task_history'",
      )
      .get(sessionKey) as { cnt: number } | undefined;
    if (histRow && histRow.cnt === 0) return true;

    return false;
  } catch (err) {
    logger.debug("contextSignals.isBlankSlateSession: DB query failed", err);
    return false;
  }
}
