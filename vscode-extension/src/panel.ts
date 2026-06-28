// ============================================================
// Cupid Result Panel
//
// Renders the router response, model selection rationale, and
// cost savings in a VS Code WebviewPanel. Supports copy-to-clipboard
// and apply-to-editor actions.
// ============================================================

import * as vscode from "vscode";
import type { CupidResponse } from "./client";

export class CupidPanel {
  static currentPanel: CupidPanel | undefined;

  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel) {
    this._panel = panel;
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
  }

  static createOrShow(extensionUri: vscode.Uri): CupidPanel {
    const column = vscode.ViewColumn.Beside;

    if (CupidPanel.currentPanel) {
      CupidPanel.currentPanel._panel.reveal(column);
      return CupidPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      "cupidResult",
      "Cupid Result",
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, "media")],
      },
    );

    CupidPanel.currentPanel = new CupidPanel(panel);
    return CupidPanel.currentPanel;
  }

  showLoading(prompt: string) {
    this._panel.title = "Cupid — Routing...";
    this._panel.webview.html = this._buildLoadingHtml(prompt);
  }

  showResult(response: CupidResponse, prompt: string) {
    const savings = response.comparison?.savingsPercent?.toFixed(1) ?? "0";
    const model = response.routing.selectedModel.split("/").pop() ?? response.routing.selectedModel;
    this._panel.title = `Cupid — ${model} (${savings}% saved)`;
    this._panel.webview.html = this._buildResultHtml(response, prompt);

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      (message: { command: string; text?: string }) => {
        if (message.command === "copyToClipboard" && message.text) {
          vscode.env.clipboard.writeText(message.text);
          vscode.window.showInformationMessage("Copied to clipboard");
        }
        if (message.command === "insertAtCursor" && message.text) {
          const editor = vscode.window.activeTextEditor;
          if (editor) {
            editor.edit((editBuilder) => {
              editBuilder.insert(editor.selection.active, message.text!);
            });
          }
        }
      },
      null,
      this._disposables,
    );
  }

  showError(error: string) {
    this._panel.title = "Cupid — Error";
    this._panel.webview.html = this._buildErrorHtml(error);
  }

  dispose() {
    CupidPanel.currentPanel = undefined;
    this._panel.dispose();
    for (const d of this._disposables) d.dispose();
    this._disposables = [];
  }

  private _buildLoadingHtml(prompt: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><style>
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); padding: 20px; }
  .loading { display: flex; align-items: center; gap: 12px; margin-top: 40px; }
  .spinner { width: 20px; height: 20px; border: 2px solid var(--vscode-progressBar-background); border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .prompt { margin-top: 20px; padding: 12px; background: var(--vscode-textBlockQuote-background); border-left: 3px solid var(--vscode-textBlockQuote-border); font-style: italic; opacity: 0.8; }
</style></head>
<body>
  <div class="loading"><div class="spinner"></div><span>Routing to optimal model...</span></div>
  <div class="prompt">${escapeHtml(prompt.slice(0, 200))}${prompt.length > 200 ? "…" : ""}</div>
</body></html>`;
  }

  private _buildResultHtml(r: CupidResponse, prompt: string): string {
    const model = r.routing.selectedModel;
    const tier = r.routing.tier;
    const cost = r.router.costUsd.toFixed(5);
    const savings = r.comparison?.savingsPercent?.toFixed(1) ?? "—";
    const latency = (r.router.latencyMs / 1000).toFixed(1);
    const taskType = r.classification.taskType.replace(/_/g, " ");
    const riskLevel = r.classification.riskLevel;
    const reasons = r.routing.reasons.map((s) => `<li>${escapeHtml(s)}</li>`).join("");
    const autoRevised = r.executor?.selfReviseAutoTriggered
      ? '<span class="badge badge-warning">auto self-revised (risk≥4)</span>'
      : r.executor?.selfReviseApplied
      ? '<span class="badge badge-info">self-revised</span>'
      : "";
    const cplInfo = r.cpl && r.cpl.injectedEntries > 0
      ? `<div class="cpl-info">Session memory: ${r.cpl.injectedEntries} entries injected (~${r.cpl.injectedTokens} tokens)</div>`
      : "";

    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><style>
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); padding: 16px; margin: 0; }
  .header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
  .model-name { font-size: 1.1em; font-weight: bold; color: var(--vscode-textLink-foreground); }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 0.75em; margin-left: 4px; }
  .badge-tier { background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); }
  .badge-warning { background: #b8860b20; color: #b8860b; border: 1px solid #b8860b40; }
  .badge-info { background: var(--vscode-progressBar-background)20; color: var(--vscode-progressBar-background); }
  .metrics { display: flex; gap: 16px; font-size: 0.85em; opacity: 0.8; margin-bottom: 12px; flex-wrap: wrap; }
  .metric { display: flex; flex-direction: column; }
  .metric-label { font-size: 0.75em; text-transform: uppercase; opacity: 0.6; }
  .metric-value { font-weight: bold; }
  .metric-value.savings { color: #4caf50; }
  .reasons { font-size: 0.85em; background: var(--vscode-textBlockQuote-background); border-left: 3px solid var(--vscode-textBlockQuote-border); padding: 8px 12px; margin-bottom: 12px; }
  .reasons ul { margin: 0; padding-left: 16px; }
  .response { background: var(--vscode-editor-background); border: 1px solid var(--vscode-panel-border); border-radius: 4px; padding: 12px; white-space: pre-wrap; font-size: 0.9em; line-height: 1.5; overflow-x: auto; }
  .actions { margin-bottom: 10px; display: flex; gap: 8px; }
  button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 0.85em; }
  button:hover { background: var(--vscode-button-hoverBackground); }
  .cpl-info { font-size: 0.8em; opacity: 0.7; margin-bottom: 8px; }
  .task-info { font-size: 0.8em; opacity: 0.6; margin-bottom: 8px; }
</style></head>
<body>
  <div class="header">
    <span class="model-name">${escapeHtml(model)}</span>
    <span class="badge badge-tier">${escapeHtml(tier)}</span>
    ${autoRevised}
  </div>
  <div class="task-info">Task: ${escapeHtml(taskType)} · Risk: ${riskLevel}/5</div>
  <div class="metrics">
    <div class="metric"><span class="metric-label">Cost</span><span class="metric-value">$${cost}</span></div>
    <div class="metric"><span class="metric-label">Saved</span><span class="metric-value savings">${savings}%</span></div>
    <div class="metric"><span class="metric-label">Latency</span><span class="metric-value">${latency}s</span></div>
  </div>
  ${cplInfo}
  <div class="reasons"><strong>Why this model:</strong><ul>${reasons}</ul></div>
  <div class="actions">
    <button onclick="copyResponse()">Copy Response</button>
    <button onclick="insertAtCursor()">Insert at Cursor</button>
  </div>
  <div class="response" id="response">${escapeHtml(r.router.response)}</div>
  <script>
    const vscode = acquireVsCodeApi();
    const responseText = ${JSON.stringify(r.router.response)};
    function copyResponse() { vscode.postMessage({ command: 'copyToClipboard', text: responseText }); }
    function insertAtCursor() { vscode.postMessage({ command: 'insertAtCursor', text: responseText }); }
  </script>
</body></html>`;
  }

  private _buildErrorHtml(error: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><style>
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); padding: 20px; }
  .error { background: var(--vscode-inputValidation-errorBackground); border: 1px solid var(--vscode-inputValidation-errorBorder); padding: 12px; border-radius: 4px; }
</style></head>
<body><div class="error"><strong>Cupid Error:</strong><br>${escapeHtml(error)}</div></body></html>`;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
