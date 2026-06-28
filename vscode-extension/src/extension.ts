// ============================================================
// Cupid VS Code Extension — main entry point
//
// Registers all commands and keeps a status bar item showing
// the last routing decision (model name + cost savings).
// ============================================================

import * as vscode from "vscode";
import { callCupid, checkHealth, getSessionStats, resetSession } from "./client";
import { CupidPanel } from "./panel";
import { getWorkspaceSessionKey } from "./sessionKey";

let statusBarItem: vscode.StatusBarItem;
let _abortController: AbortController | undefined;

export function activate(context: vscode.ExtensionContext) {
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = "cupid.showStats";
  statusBarItem.text = "$(sparkle) Cupid";
  statusBarItem.tooltip = "Cupid LLM Router — click for session stats";
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  context.subscriptions.push(
    vscode.commands.registerCommand("cupid.ask", () => askCupid(context, false)),
    vscode.commands.registerCommand("cupid.askWithSelection", () => askCupid(context, true)),
    vscode.commands.registerCommand("cupid.showStats", () => showStats()),
    vscode.commands.registerCommand("cupid.resetSession", () => doResetSession()),
    vscode.commands.registerCommand("cupid.configureEndpoint", () => configureEndpoint()),
  );

  // Health-check on activation
  const cfg = vscode.workspace.getConfiguration("cupid");
  const serverUrl = cfg.get<string>("serverUrl", "http://localhost:3300");
  checkHealth(serverUrl).then((ok) => {
    if (!ok) {
      vscode.window
        .showWarningMessage(
          `Cupid: cannot reach server at ${serverUrl}. Start the backend (pnpm dev) or update the URL.`,
          "Configure URL",
        )
        .then((action) => {
          if (action === "Configure URL") {
            vscode.commands.executeCommand("cupid.configureEndpoint");
          }
        });
    }
  });
}

async function askCupid(context: vscode.ExtensionContext, useSelection: boolean) {
  const cfg = vscode.workspace.getConfiguration("cupid");
  const serverUrl = cfg.get<string>("serverUrl", "http://localhost:3300");
  const userMode = cfg.get<"cost_saving" | "balanced" | "max_quality">("userMode", "balanced");
  const routingMode = cfg.get<"rule_based" | "llm_assisted">("routingMode", "rule_based");
  const enableCpl = cfg.get<boolean>("enableCpl", true);
  const selfRevise = cfg.get<boolean>("enableSelfRevise", false);

  const editor = vscode.window.activeTextEditor;

  // Gather context from the editor
  const rawCode = useSelection && editor && !editor.selection.isEmpty
    ? editor.document.getText(editor.selection)
    : editor?.document.getText().slice(0, 8000);
  const fileName = editor?.document.fileName;
  const highlightedRegion = useSelection && editor && !editor.selection.isEmpty
    ? editor.document.getText(editor.selection)
    : undefined;

  const prompt = await vscode.window.showInputBox({
    prompt: "Ask Cupid — your request will be routed to the optimal AI model",
    placeHolder: "e.g. Write unit tests for this function",
    ignoreFocusOut: true,
  });

  if (!prompt) return;

  // Cancel any in-flight request
  _abortController?.abort();
  _abortController = new AbortController();

  const panel = CupidPanel.createOrShow(context.extensionUri);
  panel.showLoading(prompt);
  statusBarItem.text = "$(loading~spin) Cupid";

  try {
    const sessionKey = getWorkspaceSessionKey();
    const response = await callCupid(
      { prompt, rawCode, fileName, highlightedRegion },
      { serverUrl, sessionKey, userMode, routingMode, enableCpl, selfRevise },
      _abortController.signal,
    );

    panel.showResult(response, prompt);

    const model = response.routing.selectedModel.split("/").pop() ?? "";
    const savings = response.comparison?.savingsPercent?.toFixed(0) ?? "0";
    statusBarItem.text = `$(sparkle) ${model} (${savings}% saved)`;
    statusBarItem.tooltip = `Last: ${response.classification.taskType} → ${response.routing.selectedModel}\nCost: $${response.router.costUsd.toFixed(5)} | Saved: ${savings}%\nClick for session stats`;

  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") return;
    const msg = err instanceof Error ? err.message : String(err);
    panel.showError(msg);
    statusBarItem.text = "$(sparkle) Cupid (error)";
    vscode.window.showErrorMessage(`Cupid error: ${msg}`);
  }
}

async function showStats() {
  const cfg = vscode.workspace.getConfiguration("cupid");
  const serverUrl = cfg.get<string>("serverUrl", "http://localhost:3300");
  const sessionKey = getWorkspaceSessionKey();

  try {
    const stats = await getSessionStats(serverUrl, sessionKey) as Record<string, unknown>;
    const lines = [
      `Session: ${sessionKey}`,
      `Entries stored: ${stats["entryCount"] ?? "—"}`,
      `Tasks recorded: ${stats["historyCount"] ?? "—"}`,
      `Total cost: $${Number(stats["totalCostUsd"] ?? 0).toFixed(5)}`,
      `Models used: ${Array.isArray(stats["modelsUsed"]) ? (stats["modelsUsed"] as string[]).map((m: string) => m.split("/").pop()).join(", ") : "—"}`,
    ];
    vscode.window.showInformationMessage(lines.join(" | "), "Reset Session").then((action) => {
      if (action === "Reset Session") doResetSession();
    });
  } catch (err) {
    vscode.window.showErrorMessage(`Could not fetch stats: ${err}`);
  }
}

async function doResetSession() {
  const cfg = vscode.workspace.getConfiguration("cupid");
  const serverUrl = cfg.get<string>("serverUrl", "http://localhost:3300");
  const sessionKey = getWorkspaceSessionKey();

  const confirm = await vscode.window.showWarningMessage(
    "Reset Cupid session context? This clears all stored conventions, decisions, and history for this workspace.",
    { modal: true },
    "Reset",
  );
  if (confirm !== "Reset") return;

  try {
    await resetSession(serverUrl, sessionKey);
    vscode.window.showInformationMessage("Cupid session context reset.");
    statusBarItem.text = "$(sparkle) Cupid";
  } catch (err) {
    vscode.window.showErrorMessage(`Reset failed: ${err}`);
  }
}

async function configureEndpoint() {
  const cfg = vscode.workspace.getConfiguration("cupid");
  const current = cfg.get<string>("serverUrl", "http://localhost:3300");
  const url = await vscode.window.showInputBox({
    prompt: "Cupid server URL",
    value: current,
    validateInput: (v) => {
      try { new URL(v); return null; } catch { return "Enter a valid URL"; }
    },
  });
  if (url) {
    await cfg.update("serverUrl", url, vscode.ConfigurationTarget.Global);
    vscode.window.showInformationMessage(`Cupid: server URL updated to ${url}`);
  }
}

export function deactivate() {
  _abortController?.abort();
}
