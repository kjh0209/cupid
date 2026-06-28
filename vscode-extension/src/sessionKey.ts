// ============================================================
// Session Key Manager
//
// Generates a stable session key scoped to the VS Code workspace
// so all Compare/Pipeline calls within a workspace share the
// same CPL session memory — matching the web workbench behavior.
// ============================================================

import * as vscode from "vscode";
import * as crypto from "crypto";

/** Returns a stable session key for the current VS Code workspace. */
export function getWorkspaceSessionKey(): string {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    // Fallback: per-window key stored in workspace state
    return "vscode::no-workspace";
  }

  // Stable hash of the workspace root path so the key survives restarts
  const root = folders[0].uri.fsPath;
  const hash = crypto.createHash("sha1").update(root).digest("hex").slice(0, 12);
  return `vscode::ws-${hash}`;
}
