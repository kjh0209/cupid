import * as vscode from "vscode";
import { CupidChatViewProvider } from "./chatView.js";
import { getWorkspaceSessionKey } from "./sessionKey.js";
import { CupidInlineEdit } from "./inlineEdit.js";
import { registerDiffCommands } from "./diffDecoration.js";

let chatProvider: CupidChatViewProvider | undefined;
let statusBar!: vscode.StatusBarItem; // assigned in activate() before any use
let healthInterval: ReturnType<typeof setInterval> | undefined;
let lastKnownModel = "";
let lastKnownCost = 0;

// ── Status bar state machine ──────────────────────────────────────────────────

function setStatusBar(
  state: "idle" | "routing" | "streaming" | "error",
  model?: string,
): void {
  if (!statusBar) return;
  if (model) lastKnownModel = model;

  switch (state) {
    case "idle": {
      const modelPart = lastKnownModel ? ` · ${lastKnownModel}` : "";
      const costPart = lastKnownCost > 0 ? ` · $${lastKnownCost.toFixed(4)}` : "";
      statusBar.text = `$(robot) Cupid${modelPart}${costPart}`;
      statusBar.tooltip = "Open Cupid AI chat (Ctrl+Shift+K)";
      statusBar.backgroundColor = undefined;
      statusBar.command = "cupid.openChat";
      break;
    }
    case "routing":
      statusBar.text = "$(sync~spin) Cupid · routing…";
      statusBar.tooltip = "Routing to the best model for your task";
      statusBar.backgroundColor = undefined;
      statusBar.command = "cupid.openChat";
      break;
    case "streaming":
      statusBar.text = "$(sync~spin) Cupid · streaming…";
      statusBar.tooltip = "Generating response — click to open chat";
      statusBar.backgroundColor = undefined;
      statusBar.command = "cupid.openChat";
      break;
    case "error":
      statusBar.text = "$(warning) Cupid · backend offline";
      statusBar.tooltip = "Cupid backend is offline. Click to configure.";
      statusBar.backgroundColor = new vscode.ThemeColor("statusBarItem.errorBackground");
      statusBar.command = "cupid.configureEndpoint";
      break;
  }
}

// ── Activate ─────────────────────────────────────────────────────────────────

export function activate(context: vscode.ExtensionContext): void {
  // Status bar
  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  setStatusBar("idle");
  statusBar.show();
  context.subscriptions.push(statusBar);

  // Chat provider
  chatProvider = new CupidChatViewProvider(context.extensionUri, context, setStatusBar);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      CupidChatViewProvider.viewType,
      chatProvider,
      { webviewOptions: { retainContextWhenHidden: true } },
    ),
  );

  // Register diff accept/reject commands
  registerDiffCommands(context);

  // Core commands
  context.subscriptions.push(
    vscode.commands.registerCommand("cupid.openChat", async () => {
      await revealChatView();
      chatProvider?.focus();
    }),

    vscode.commands.registerCommand("cupid.askWithSelection", async () => {
      await revealChatView();
      chatProvider?.sendSelection();
    }),

    vscode.commands.registerCommand("cupid.showStats", () => showStats()),

    vscode.commands.registerCommand("cupid.resetSession", () => {
      chatProvider?.resetSession();
    }),

    vscode.commands.registerCommand("cupid.configureEndpoint", () => configureEndpoint()),

    vscode.commands.registerCommand("cupid.moveToRight", () => moveChatToRight()),

    vscode.commands.registerCommand("cupid.stopAll", () => {
      chatProvider?.stopAll();
      vscode.window.setStatusBarMessage("Cupid: all streams stopped", 2000);
    }),

    vscode.commands.registerCommand("cupid.inlineEdit", async () => {
      await CupidInlineEdit.trigger(context);
    }),
  );

  // Auto-move to secondary sidebar on first activation
  void maybeAutoMove(context);

  // Background health check
  void startHealthMonitor(context);
}

// ── Helper: reveal chat view (try secondary sidebar first) ───────────────────

async function revealChatView(): Promise<void> {
  // Try the secondary sidebar (Cursor-style right panel) first
  try {
    await vscode.commands.executeCommand("workbench.view.extension.cupid-sidebar");
  } catch {
    try {
      await vscode.commands.executeCommand("cupid.chatView.focus");
    } catch { /* ignore */ }
  }
}

// ── Move chat to right Secondary Side Bar ────────────────────────────────────

async function moveChatToRight(): Promise<void> {
  try {
    await vscode.commands.executeCommand("cupid.chatView.focus");
    await new Promise<void>((r) => setTimeout(r, 150));
    await vscode.commands.executeCommand(
      "workbench.action.moveView",
      { viewId: "cupid.chatView", destinationId: "workbench.parts.auxiliarybar" },
    );
    await new Promise<void>((r) => setTimeout(r, 200));
    // Make sure the auxiliary bar is visible
    await vscode.commands.executeCommand("workbench.action.focusAuxiliaryBar");
  } catch {
    // Fallback: show instruction
    const choice = await vscode.window.showInformationMessage(
      "Cupid: Drag the Cupid AI panel to the right Secondary Side Bar (like Cursor). View → Appearance → Secondary Side Bar.",
      "Open Secondary Side Bar",
    );
    if (choice) {
      try { await vscode.commands.executeCommand("workbench.action.toggleAuxiliaryBar"); } catch { /* ignore */ }
    }
  }
}

async function maybeAutoMove(context: vscode.ExtensionContext): Promise<void> {
  const config = vscode.workspace.getConfiguration("cupid");
  if (!config.get<boolean>("autoMoveToRight", true)) return;
  const key = "cupid.didAutoMove.v2";
  if (context.globalState.get<boolean>(key)) return;

  // Wait for the UI to settle
  await new Promise<void>((r) => setTimeout(r, 800));
  await moveChatToRight();
  await context.globalState.update(key, true);
}

// ── Health monitor ────────────────────────────────────────────────────────────

async function startHealthMonitor(context: vscode.ExtensionContext): Promise<void> {
  const check = async () => {
    const config = vscode.workspace.getConfiguration("cupid");
    const backendUrl = config.get<string>("backendUrl") ?? "http://localhost:3300";
    try {
      const res = await fetch(`${backendUrl}/health`, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        chatProvider?.postMessage({ type: "backendStatus", online: true, url: backendUrl });
        // Only clear error state; don't overwrite routing/streaming state
        if (statusBar?.text.includes("$(warning)")) setStatusBar("idle");
      } else {
        throw new Error("unhealthy");
      }
    } catch {
      chatProvider?.postMessage({ type: "backendStatus", online: false });
      // Only show error if not actively routing/streaming
      if (!statusBar?.text.includes("$(sync~spin)")) setStatusBar("error");
    }
  };

  await check();
  healthInterval = setInterval(() => void check(), 30_000);
  context.subscriptions.push({ dispose: () => { if (healthInterval) clearInterval(healthInterval); } });
}

// ── Stats command ─────────────────────────────────────────────────────────────

async function showStats(): Promise<void> {
  const config = vscode.workspace.getConfiguration("cupid");
  const backendUrl = config.get<string>("backendUrl") ?? "http://localhost:3300";
  const sessionKey = getWorkspaceSessionKey();
  try {
    const res = await fetch(`${backendUrl}/api/cpl/stats?sessionKey=${encodeURIComponent(sessionKey)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const stats = await res.json() as {
      entryCount: number;
      historyCount: number;
      totalCostUsd: number;
      modelsUsed: string[];
    };
    lastKnownCost = stats.totalCostUsd ?? 0;
    const msg = [
      `Session: ${sessionKey}`,
      `Memory entries: ${stats.entryCount}  |  Tasks logged: ${stats.historyCount}`,
      `Total cost (estimated): $${(stats.totalCostUsd ?? 0).toFixed(6)}`,
      `Models used: ${(stats.modelsUsed ?? []).join(", ") || "—"}`,
    ].join("\n");
    vscode.window.showInformationMessage(msg, { modal: true });
  } catch (err) {
    vscode.window.showErrorMessage(
      `Cupid stats: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

// ── Configure endpoint ────────────────────────────────────────────────────────

async function configureEndpoint(): Promise<void> {
  const config = vscode.workspace.getConfiguration("cupid");
  const current = config.get<string>("backendUrl") ?? "http://localhost:3300";
  const url = await vscode.window.showInputBox({
    title: "Cupid Backend URL",
    prompt: "Enter the URL of the Cupid backend server",
    value: current,
    placeHolder: "http://localhost:3300",
  });
  if (url) {
    await config.update("backendUrl", url, vscode.ConfigurationTarget.Global);
    vscode.window.showInformationMessage(`Cupid: backend set to ${url}`);
    // Re-check health
    setTimeout(() => chatProvider?.postMessage({ type: "checkHealth" }), 500);
  }
}

export function deactivate(): void {
  if (healthInterval) clearInterval(healthInterval);
}
