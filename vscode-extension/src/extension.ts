import * as vscode from "vscode";
import { CupidChatViewProvider } from "./chatView.js";
import { getWorkspaceSessionKey } from "./sessionKey.js";
import { analyticsStore } from "./analytics.js";
import { AnalyticsPanel } from "./analyticsPanel.js";

let chatProvider: CupidChatViewProvider | undefined;
let statusBar: vscode.StatusBarItem | undefined;

export function activate(context: vscode.ExtensionContext) {
  // Init analytics store first so chatView can use it
  analyticsStore.init(context);

  chatProvider = new CupidChatViewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(CupidChatViewProvider.viewType, chatProvider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
  );

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
    vscode.commands.registerCommand("cupid.openAnalytics", () => {
      AnalyticsPanel.createOrShow(context.extensionUri);
    }),
  );

  // First-time auto-move to right Secondary Side Bar (Cursor-style)
  void maybeAutoMove(context);

  // Status bar
  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  updateStatusBar();
  statusBar.command = "cupid.openChat";
  statusBar.show();
  context.subscriptions.push(statusBar);

  // Refresh status bar to show savings every 30 seconds
  const timer = setInterval(() => updateStatusBar(), 30_000);
  context.subscriptions.push({ dispose: () => clearInterval(timer) });
}

function updateStatusBar() {
  if (!statusBar) return;
  const summary = analyticsStore.getSummary();
  if (summary.totalSaved > 0.0001) {
    statusBar.text = `$(robot) Cupid · $${summary.totalSaved.toFixed(4)} saved`;
    statusBar.tooltip = `CUPID Arbitrage: ${summary.avgSavedPct.toFixed(0)}% avg savings vs Opus · ${summary.totalRequests} requests`;
  } else {
    statusBar.text = "$(robot) Cupid";
    statusBar.tooltip = "Open Cupid chat";
  }
}

async function showStats() {
  const config = vscode.workspace.getConfiguration("cupid");
  const backendUrl = config.get<string>("backendUrl") ?? "http://localhost:3300";
  const sessionKey = getWorkspaceSessionKey();
  try {
    const res = await fetch(`${backendUrl}/api/cpl/stats?sessionKey=${encodeURIComponent(sessionKey)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const stats = await res.json() as { entryCount: number; historyCount: number; totalCostUsd: number; modelsUsed: string[] };
    const localSummary = analyticsStore.getSummary();
    const msg = [
      `Session: ${sessionKey}`,
      `Memory entries: ${stats.entryCount}  |  Tasks logged: ${stats.historyCount}`,
      `Total cost (estimated): $${(stats.totalCostUsd ?? 0).toFixed(6)}`,
      `Models used: ${(stats.modelsUsed ?? []).join(", ") || "—"}`,
      ``,
      `Local analytics: ${localSummary.totalRequests} requests · $${localSummary.totalSaved.toFixed(4)} saved (${localSummary.avgSavedPct.toFixed(0)}% vs Opus)`,
    ].join("\n");
    vscode.window.showInformationMessage(msg, { modal: true }, "Open Dashboard").then((action) => {
      if (action === "Open Dashboard") {
        void vscode.commands.executeCommand("cupid.openAnalytics");
      }
    });
  } catch (err) {
    vscode.window.showErrorMessage(`Cupid stats: ${err instanceof Error ? err.message : String(err)}`);
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
    vscode.window.showErrorMessage(`Reset failed: ${err instanceof Error ? err.message : String(err)}`);
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
      "Cupid: drag the Cupid AI panel to the right Secondary Side Bar (View → Appearance → Secondary Side Bar).",
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
