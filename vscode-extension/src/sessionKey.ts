import * as vscode from "vscode";
import { createHash } from "crypto";

/** Returns a stable CPL session key for the current VS Code workspace.
 *  Matches the format used by the web workbench: "workbench::ws-<hash>"
 */
export function getWorkspaceSessionKey(): string {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    return "vscode::no-workspace";
  }
  const rootPath = folders[0]!.uri.fsPath;
  const hash = createHash("sha1").update(rootPath).digest("hex").slice(0, 16);
  return `vscode::ws-${hash}`;
}
