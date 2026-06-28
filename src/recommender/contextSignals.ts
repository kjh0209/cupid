// ============================================================
// Context Signals — workspace / session awareness
//
// Detects "blank slate" sessions where the user has no existing
// code context. Blank slate + creation verb dramatically raises
// the risk of cheap-model disappointment.
// ============================================================

/** Returns true when the workspace/session has no meaningful code context. */
export function isBlankSlateSession(opts: {
  workspaceFileCount?: number;
  sessionTaskCount?: number;
  hasSelectedCode: boolean;
  hasActiveFile: boolean;
  hasRepoSummary: boolean;
}): boolean {
  const { workspaceFileCount, sessionTaskCount, hasSelectedCode, hasActiveFile, hasRepoSummary } = opts;

  // If any explicit code context was provided, not blank slate
  if (hasSelectedCode || hasActiveFile || hasRepoSummary) return false;

  // Workspace with very few files is essentially blank
  if (workspaceFileCount != null && workspaceFileCount <= 1) return true;

  // No prior tasks in session + no workspace info = blank slate
  if (sessionTaskCount != null && sessionTaskCount === 0) return true;

  // If we have no information at all, assume blank slate conservatively
  if (workspaceFileCount == null && sessionTaskCount == null) return true;

  return false;
}
