import * as vscode from "vscode";
import { callCupid, getSessionStats, resetSession, checkHealth } from "./client.js";
import { CupidPanel } from "./panel.js";
import { getSessionKey } from "./sessionKey.js";

let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext): void {
  // Status bar — shows last model used + savings
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.text = "$(zap) Cupid";
  statusBarItem.tooltip = "Cupid AI Router — click to ask";
  statusBarItem.command = "cupid.ask";
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // ── Commands ────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand("cupid.ask", async () => {
      const prompt = await vscode.window.showInputBox({
        prompt: "Ask Cupid (auto-routes to the best AI model)",
        placeHolder: "e.g. Add input validation to this endpoint",
        ignoreFocusOut: true,
      });
      if (!prompt) return;
      await runCupid(context, prompt);
    }),

    vscode.commands.registerCommand("cupid.askWithSelection", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      const selection = editor.document.getText(editor.selection);
      const fileName = editor.document.fileName;
      const prompt = await vscode.window.showInputBox({
        prompt: "Ask Cupid about the selected code",
        placeHolder: "What do you want to do with this code?",
        ignoreFocusOut: true,
      });
      if (!prompt) return;
      await runCupid(context, prompt, {
        rawCode: selection,
        fileName,
        highlightedRegion: selection,
      });
    }),

    vscode.commands.registerCommand("cupid.showStats", async () => {
      const sessionKey = getSessionKey();
      const stats = await getSessionStats(sessionKey);
      if (!stats) {
        vscode.window.showInformationMessage("Cupid: No session stats available. Is the server running?");
        return;
      }
      const lines = [
        `Session: ${stats.sessionKey}`,
        `Entries: ${stats.entryCount} | History: ${stats.historyCount}`,
        `Models used: ${stats.modelsUsed.join(", ") || "none"}`,
        `Total cost: $${stats.totalCostUsd.toFixed(4)}`,
        `Tokens stored: ${stats.totalTokensStored}`,
      ];
      vscode.window.showInformationMessage(lines.join(" | "), { modal: false });
    }),

    vscode.commands.registerCommand("cupid.resetSession", async () => {
      const confirm = await vscode.window.showWarningMessage(
        "Reset Cupid session memory? The AI will lose context of past tasks in this workspace.",
        "Reset", "Cancel",
      );
      if (confirm !== "Reset") return;
      const sessionKey = getSessionKey();
      const ok = await resetSession(sessionKey);
      vscode.window.showInformationMessage(ok ? "Cupid: Session memory cleared." : "Cupid: Reset failed.");
    }),

    vscode.commands.registerCommand("cupid.configureEndpoint", async () => {
      const current = vscode.workspace.getConfiguration("cupid").get<string>("serverEndpoint") ?? "http://localhost:3000";
      const endpoint = await vscode.window.showInputBox({
        prompt: "Cupid server endpoint",
        value: current,
        ignoreFocusOut: true,
      });
      if (!endpoint) return;
      await vscode.workspace.getConfiguration("cupid").update("serverEndpoint", endpoint, vscode.ConfigurationTarget.Global);
      const healthy = await checkHealth();
      vscode.window.showInformationMessage(
        healthy ? `Cupid: Connected to ${endpoint}` : `Cupid: Server at ${endpoint} is not responding.`,
      );
    }),
  );
}

async function runCupid(
  context: vscode.ExtensionContext,
  prompt: string,
  opts?: { rawCode?: string; fileName?: string; highlightedRegion?: string },
): Promise<void> {
  const panel = CupidPanel.createOrShow(context);
  panel.showLoading(prompt);

  const sessionKey = getSessionKey();
  const editor = vscode.window.activeTextEditor;
  const fileName = opts?.fileName ?? editor?.document.fileName;
  const rawCode = opts?.rawCode ?? (editor ? editor.document.getText() : undefined);

  try {
    const result = await callCupid({
      prompt,
      rawCode,
      fileName,
      highlightedRegion: opts?.highlightedRegion,
      sessionKey,
    });

    panel.showResult(result, prompt);

    // Update status bar
    const model = result.routing.selectedModel.split("/").pop() ?? "?";
    const savings = result.comparison.savingsPercent.toFixed(0);
    statusBarItem.text = `$(zap) ${model} (−${savings}%)`;
    statusBarItem.tooltip = [
      `Last: ${result.routing.selectedModel}`,
      `Task: ${result.classification.taskType}`,
      `Cost: $${result.router.costUsd.toFixed(4)} (saved ${savings}%)`,
      `Latency: ${result.router.latencyMs}ms`,
      ...result.routing.reasons.slice(0, 2),
    ].join("\n");
  } catch (err) {
    panel.showError(String(err));
    statusBarItem.text = "$(zap) Cupid ⚠";
  }
}

export function deactivate(): void {
  statusBarItem?.dispose();
}
