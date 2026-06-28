import * as vscode from "vscode";
import { callCupid, getSessionStats, resetSession, checkHealth } from "./client.js";
import { CupidPanel } from "./panel.js";
import { getWorkspaceSessionKey } from "./sessionKey.js";

let statusBar: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.text = "$(robot) Cupid";
  statusBar.tooltip = "Cupid AI Router — click to ask";
  statusBar.command = "cupid.ask";
  statusBar.show();
  context.subscriptions.push(statusBar);

  context.subscriptions.push(
    vscode.commands.registerCommand("cupid.ask", () => askCupid(context, false)),
    vscode.commands.registerCommand("cupid.askWithSelection", () => askCupid(context, true)),
    vscode.commands.registerCommand("cupid.showStats", () => showStats()),
    vscode.commands.registerCommand("cupid.resetSession", () => doResetSession()),
    vscode.commands.registerCommand("cupid.configureEndpoint", () => configureEndpoint()),
  );
}

async function askCupid(context: vscode.ExtensionContext, withSelection: boolean) {
  const config = vscode.workspace.getConfiguration("cupid");
  const backendUrl = config.get<string>("backendUrl") ?? "http://localhost:3300";

  const healthy = await checkHealth(backendUrl);
  if (!healthy) {
    vscode.window.showErrorMessage(`Cupid backend not reachable at ${backendUrl}. Run 'pnpm dev' in the cupid directory.`);
    return;
  }

  const editor = vscode.window.activeTextEditor;
  const selectedCode = withSelection && editor
    ? editor.document.getText(editor.selection) || undefined
    : undefined;
  const fileName = editor?.document.fileName;

  const prompt = await vscode.window.showInputBox({
    prompt: selectedCode
      ? "Ask about the selected code..."
      : "Ask Cupid AI (routed to best model for your task)...",
    placeHolder: "e.g. Fix the bug in this function / Explain this code / Add tests",
  });

  if (!prompt) return;

  const panel = CupidPanel.createOrShow(context.extensionUri);
  panel.showLoading(prompt);
  statusBar.text = "$(sync~spin) Cupid…";

  try {
    const sessionKey = getWorkspaceSessionKey();
    const result = await callCupid({
      backendUrl,
      prompt,
      sessionKey,
      userMode: config.get<string>("userMode") ?? "balanced",
      routingMode: config.get<string>("routingMode") ?? "rule_based",
      fileName,
      selectedCode,
      selfRevise: config.get<boolean>("selfRevise"),
    });

    const savings = result.comparison.savingsPercent;
    statusBar.text = `$(robot) Cupid ${savings > 0 ? `· ${savings.toFixed(0)}% saved` : ""}`;

    panel.showResult({
      prompt,
      response: result.router.response,
      modelName: result.router.displayName,
      taskType: result.classification.taskType,
      savingsPercent: result.comparison.savingsPercent,
      costUsd: result.router.costUsd,
      latencyMs: result.router.latencyMs,
      cplEntries: result.cpl?.injectedEntries ?? 0,
      selfReviseApplied: result.executor?.selfReviseApplied ?? false,
      selfReviseAutoTriggered: result.executor?.selfReviseAutoTriggered ?? false,
      reasons: result.routing.reasons,
    });
  } catch (err) {
    statusBar.text = "$(robot) Cupid";
    panel.showError(err instanceof Error ? err.message : String(err));
  }
}

async function showStats() {
  const config = vscode.workspace.getConfiguration("cupid");
  const backendUrl = config.get<string>("backendUrl") ?? "http://localhost:3300";
  const sessionKey = getWorkspaceSessionKey();

  try {
    const stats = await getSessionStats(backendUrl, sessionKey);
    const msg = [
      `Session: ${sessionKey}`,
      `Entries: ${stats.entryCount} | Tasks: ${stats.taskCount}`,
      `Total cost: $${stats.totalCostUsd?.toFixed(6) ?? "0"}`,
    ].join("\n");
    vscode.window.showInformationMessage(msg, { modal: true });
  } catch (err) {
    vscode.window.showErrorMessage(`Could not fetch stats: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function doResetSession() {
  const config = vscode.workspace.getConfiguration("cupid");
  const backendUrl = config.get<string>("backendUrl") ?? "http://localhost:3300";
  const sessionKey = getWorkspaceSessionKey();

  const confirm = await vscode.window.showWarningMessage(
    "Reset Cupid session memory? All CPL context entries for this workspace will be deleted.",
    "Reset", "Cancel",
  );
  if (confirm !== "Reset") return;

  try {
    await resetSession(backendUrl, sessionKey);
    vscode.window.showInformationMessage("Session memory reset.");
  } catch (err) {
    vscode.window.showErrorMessage(`Reset failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function configureEndpoint() {
  const config = vscode.workspace.getConfiguration("cupid");
  const current = config.get<string>("backendUrl") ?? "http://localhost:3300";
  const url = await vscode.window.showInputBox({
    prompt: "Enter the Cupid backend URL",
    value: current,
    placeHolder: "http://localhost:3300",
  });
  if (url) {
    await config.update("backendUrl", url, vscode.ConfigurationTarget.Global);
    vscode.window.showInformationMessage(`Cupid backend set to: ${url}`);
  }
}

export function deactivate() {
  statusBar?.dispose();
}
