import * as vscode from "vscode";
import { CupidChatViewProvider } from "./chatView.js";
import { getWorkspaceSessionKey } from "./sessionKey.js";
import { registerDiffCodeLens } from "./diffDecoration.js";
import { registerInlineEdit } from "./inlineEdit.js";

let chatProvider: CupidChatViewProvider | undefined;
let statusBar: vscode.StatusBarItem | undefined;

// ── Status bar state machine ──────────────────────────────────────────────────

export type StatusState = "idle" | "routing" | "streaming" | "error";

export function setStatusState(state: StatusState, detail?: string): void {
  if (!statusBar) return;
  switch (state) {
    case "idle":
      statusBar.text = detail
        ? `$(robot) Cupid · ${detail}`
        : "$(robot) Cupid";
      statusBar.tooltip = "Open Cupid chat";
      statusBar.backgroundColor = undefined;
      break;
    case "routing":
      statusBar.text = "$(sync~spin) Cupid · routing…";
      statusBar.tooltip = "Cupid is routing your request";
      statusBar.backgroundColor = undefined;
      break;
    case "streaming":
      statusBar.text = "$(sync~spin) Cupid · streaming…";
      statusBar.tooltip = "Cupid is generating a response";
      statusBar.backgroundColor = undefined;
      break;
    case "error":
      statusBar.text = "$(warning) Cupid · backend offline";
      statusBar.tooltip = `${detail ?? "Cannot reach backend"}\nClick to configure endpoint`;
      statusBar.backgroundColor = new vscode.ThemeColor("statusBarItem.errorBackground");
      break;
  }
}

// ── Health check ──────────────────────────────────────────────────────────────

async function checkHealth(): Promise<boolean> {
  const config = vscode.workspace.getConfiguration("cupid");
  const backendUrl = config.get<string>("backendUrl") ?? "http://localhost:3300";
  try {
    const res = await fetch(`${backendUrl}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Activation ────────────────────────────────────────────────────────────────

export function activate(context: vscode.ExtensionContext) {
  chatProvider = new CupidChatViewProvider(context.extensionUri, (state, detail) => {
    setStatusState(state, detail);
  });

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(CupidChatViewProvider.viewType, chatProvider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
  );

  // ── Commands ────────────────────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand("cupid.openChat", async () => {
      await vscode.commands.executeCommand("workbench.view.extension.cupid-sidebar");
      chatProvider?.focus();
    }),

    vscode.commands.registerCommand("cupid.askWithSelection", async () => {
      await vscode.commands.executeCommand("workbench.view.extension.cupid-sidebar");
      chatProvider?.sendSelection();
    }),

    vscode.commands.registerCommand("cupid.showStats", () => showStats()),
    vscode.commands.registerCommand("cupid.resetSession", () => resetSession()),
    vscode.commands.registerCommand("cupid.configureEndpoint", () => configureEndpoint()),
    vscode.commands.registerCommand("cupid.moveToRight", () => moveChatToRight()),
  );

  // ── Diff CodeLens + inline edit ─────────────────────────────────────────────
  registerDiffCodeLens(context);
  registerInlineEdit(context, (state) => setStatusState(state));

  // ── Auto-move to right Secondary Side Bar ───────────────────────────────────
  void maybeAutoMove(context);

  // ── Status bar ──────────────────────────────────────────────────────────────
  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.command = "cupid.openChat";
  setStatusState("idle");
  statusBar.show();
  context.subscriptions.push(statusBar);

  // ── Background health monitoring (every 30s) ────────────────────────────────
  const healthInterval = setInterval(async () => {
    const healthy = await checkHealth();
    if (!healthy && statusBar?.text.includes("$(robot)")) {
      setStatusState("error", "http://localhost:3300 unreachable");
    } else if (healthy && statusBar?.text.includes("$(warning)")) {
      setStatusState("idle");
    }
  }, 30_000);
  context.subscriptions.push({ dispose: () => clearInterval(healthInterval) });

  // Initial health check
  void checkHealth().then((ok) => {
    if (!ok) setStatusState("error", "Backend not reachable");
  });
}

// ── Commands ──────────────────────────────────────────────────────────────────

async function showStats() {
  const config = vscode.workspace.getConfiguration("cupid");
  const backendUrl = config.get<string>("backendUrl") ?? "http://localhost:3300";
  const sessionKey = getWorkspaceSessionKey();
  try {
    const res = await fetch(
      `${backendUrl}/api/cpl/stats?sessionKey=${encodeURIComponent(sessionKey)}`,
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const stats = await res.json() as {
      entryCount: number; historyCount: number; totalCostUsd: number; modelsUsed: string[];
    };
    vscode.window.showInformationMessage(
      [
        `Session: ${sessionKey}`,
        `Memory entries: ${stats.entryCount}  |  Tasks logged: ${stats.historyCount}`,
        `Total cost (est.): $${(stats.totalCostUsd ?? 0).toFixed(6)}`,
        `Models used: ${(stats.modelsUsed ?? []).join(", ") || "—"}`,
      ].join("\n"),
      { modal: true },
    );
  } catch (err) {
    vscode.window.showErrorMessage(
      `Cupid stats: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

async function resetSession() {
  const config = vscode.workspace.getConfiguration("cupid");
  const backendUrl = config.get<string>("backendUrl") ?? "http://localhost:3300";
  const sessionKey = getWorkspaceSessionKey();
  const confirm = await vscode.window.showWarningMessage(
    "Reset Cupid session memory for this workspace? All CPL context entries will be deleted.",
    "Reset", "Cancel",
  );
  if (confirm !== "Reset") return;
  try {
    await fetch(`${backendUrl}/api/cpl/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionKey }),
    });
    vscode.window.setStatusBarMessage("Cupid: session memory reset", 2000);
  } catch (err) {
    vscode.window.showErrorMessage(
      `Reset failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

async function configureEndpoint() {
  const config = vscode.workspace.getConfiguration("cupid");
  const current = config.get<string>("backendUrl") ?? "http://localhost:3300";
  const url = await vscode.window.showInputBox({
    prompt: "Cupid backend URL",
    value: current,
    placeHolder: "http://localhost:3300",
  });
  if (url) {
    await config.update("backendUrl", url, vscode.ConfigurationTarget.Global);
    vscode.window.showInformationMessage(`Cupid backend set to: ${url}`);
    // Re-check health with new URL
    const ok = await checkHealth();
    setStatusState(ok ? "idle" : "error", ok ? undefined : `${url} unreachable`);
  }
}

async function moveChatToRight() {
  try {
    await vscode.commands.executeCommand("cupid.chatView.focus");
    await new Promise((r) => setTimeout(r, 100));
    await vscode.commands.executeCommand("workbench.action.moveView", {
      viewId: "cupid.chatView",
      destinationId: "workbench.parts.auxiliarybar",
    } as unknown as never);
  } catch {
    try {
      await vscode.commands.executeCommand("workbench.action.toggleAuxiliaryBar");
    } catch { /* ignore */ }
    vscode.window.showInformationMessage(
      "Cupid: drag the Cupid AI panel to the right Secondary Side Bar.",
    );
  }
}

async function maybeAutoMove(context: vscode.ExtensionContext) {
  const config = vscode.workspace.getConfiguration("cupid");
  if (!config.get<boolean>("autoMoveToRight")) return;
  const key = "cupid.didAutoMove";
  if (context.globalState.get<boolean>(key)) return;
  await new Promise((r) => setTimeout(r, 600));
  await moveChatToRight();
  await context.globalState.update(key, true);
}

export function deactivate() { /* nothing to do */ }
