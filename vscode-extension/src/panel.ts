import * as vscode from "vscode";
import type { CupidResponse } from "./client.js";

export class CupidPanel {
  static currentPanel: CupidPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel, context: vscode.ExtensionContext) {
    this._panel = panel;
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.html = this._getLoadingHtml();
  }

  static createOrShow(context: vscode.ExtensionContext): CupidPanel {
    const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.Beside;
    if (CupidPanel.currentPanel) {
      CupidPanel.currentPanel._panel.reveal(column);
      return CupidPanel.currentPanel;
    }
    const panel = vscode.window.createWebviewPanel("cupidResult", "Cupid AI", column, {
      enableScripts: true,
      retainContextWhenHidden: true,
    });
    CupidPanel.currentPanel = new CupidPanel(panel, context);
    return CupidPanel.currentPanel;
  }

  showResult(result: CupidResponse, prompt: string): void {
    const savings = result.comparison.savingsPercent.toFixed(1);
    const model = result.routing.selectedModel.split("/").pop() ?? result.routing.selectedModel;
    const taskType = result.classification.taskType.replace(/_/g, " ");
    const riskColor = result.classification.riskLevel >= 4 ? "#dc2626" : result.classification.riskLevel >= 3 ? "#d97706" : "#16a34a";
    const selfReviseNote = result.executor?.selfReviseApplied
      ? result.executor.selfReviseAutoTriggered
        ? ' <span style="color:#7c3aed;font-size:11px">[auto self-revised — risk≥4]</span>'
        : ' <span style="color:#7c3aed;font-size:11px">[self-revised]</span>'
      : "";
    const cplNote = (result.cpl?.injectedEntries ?? 0) > 0
      ? `<div style="font-size:11px;color:#6b7280;margin-top:4px">CPL: ${result.cpl!.injectedEntries} context entries injected (~${result.cpl!.injectedTokens} tokens)</div>`
      : "";
    const tokenSavings = result.promptTokenSavings > 0
      ? `<div style="font-size:11px;color:#6b7280">Prompt optimized: −${result.promptTokenSavings} tokens</div>`
      : "";
    const reasonsHtml = result.routing.reasons
      .slice(0, 3)
      .map((r) => `<li>${this._escapeHtml(r)}</li>`)
      .join("");

    this._panel.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Cupid Result</title>
<style>
  body { font-family: var(--vscode-font-family); background: var(--vscode-editor-background); color: var(--vscode-editor-foreground); padding: 16px; margin: 0; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
  .model-badge { background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; }
  .savings-badge { background: #16a34a; color: white; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; }
  .task-meta { font-size: 11px; color: var(--vscode-descriptionForeground); margin-bottom: 8px; }
  .risk-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${riskColor}; margin-right: 4px; }
  .reasons { font-size: 11px; color: var(--vscode-descriptionForeground); padding-left: 16px; margin: 4px 0 10px; }
  .prompt-box { background: var(--vscode-textBlockQuote-background); border-left: 3px solid var(--vscode-textBlockQuote-border); padding: 8px 12px; margin-bottom: 12px; font-size: 12px; max-height: 80px; overflow: hidden; }
  .response-box { background: var(--vscode-editor-background); border: 1px solid var(--vscode-editorWidget-border); border-radius: 4px; padding: 12px; white-space: pre-wrap; font-family: var(--vscode-editor-font-family); font-size: 13px; line-height: 1.5; max-height: 500px; overflow-y: auto; }
  .actions { margin-top: 10px; display: flex; gap: 8px; }
  button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 6px 14px; border-radius: 4px; cursor: pointer; font-size: 12px; }
  button:hover { background: var(--vscode-button-hoverBackground); }
  button.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
</style>
</head>
<body>
<div class="header">
  <span class="model-badge">⚡ ${this._escapeHtml(model)}${selfReviseNote}</span>
  <span class="savings-badge">💰 ${savings}% saved</span>
</div>
<div class="task-meta">
  <span class="risk-dot"></span>${this._escapeHtml(taskType)} · risk ${result.classification.riskLevel}/5 · $${result.router.costUsd.toFixed(4)} · ${result.router.latencyMs}ms
</div>
${cplNote}
${tokenSavings}
<ul class="reasons">${reasonsHtml}</ul>
<div class="prompt-box">${this._escapeHtml(prompt.slice(0, 200))}${prompt.length > 200 ? "…" : ""}</div>
<div class="response-box" id="response">${this._escapeHtml(result.router.response)}</div>
<div class="actions">
  <button onclick="copyResponse()">Copy response</button>
  <button class="secondary" onclick="insertAtCursor()">Insert at cursor</button>
</div>
<script>
  const vscode = acquireVsCodeApi();
  const response = ${JSON.stringify(result.router.response)};
  function copyResponse() {
    navigator.clipboard.writeText(response);
  }
  function insertAtCursor() {
    vscode.postMessage({ type: 'insertAtCursor', text: response });
  }
</script>
</body>
</html>`;
  }

  showLoading(prompt: string): void {
    this._panel.webview.html = this._getLoadingHtml(prompt);
  }

  showError(message: string): void {
    this._panel.webview.html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family:var(--vscode-font-family);padding:16px;color:var(--vscode-errorForeground)">
<strong>Cupid error</strong><p>${this._escapeHtml(message)}</p>
<p style="font-size:12px;color:var(--vscode-descriptionForeground)">Is the Cupid server running? Check your endpoint setting.</p>
</body></html>`;
  }

  private _getLoadingHtml(prompt?: string): string {
    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family:var(--vscode-font-family);padding:16px">
<p>⚡ Cupid is routing your request…</p>
${prompt ? `<p style="font-size:12px;color:var(--vscode-descriptionForeground)">${this._escapeHtml(prompt.slice(0, 100))}…</p>` : ""}
</body></html>`;
  }

  private _escapeHtml(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  dispose(): void {
    CupidPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) this._disposables.pop()!.dispose();
  }
}
