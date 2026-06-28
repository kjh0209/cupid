import * as vscode from "vscode";
import * as crypto from "crypto";

/**
 * Derives a stable session key from the workspace root path.
 * Matches the web workbench behavior: SHA1(workspaceRoot) → "vscode::ws-<hex8>"
 *
 * This ensures that all VS Code Cupid calls from the same workspace share
 * the same CPL session memory as the web workbench.
 */
export function getSessionKey(): string {
  const folders = vscode.workspace.workspaceFolders;
  const root = folders && folders.length > 0 ? folders[0]!.uri.fsPath : "unknown";
  const hash = crypto.createHash("sha1").update(root).digest("hex").slice(0, 8);
  return `vscode::ws-${hash}`;
}
