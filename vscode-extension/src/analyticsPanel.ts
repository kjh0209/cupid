import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { analyticsStore } from "./analytics.js";

export class AnalyticsPanel {
  public static currentPanel: AnalyticsPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private disposables: vscode.Disposable[] = [];

  public static createOrShow(extensionUri: vscode.Uri) {
    if (AnalyticsPanel.currentPanel) {
      AnalyticsPanel.currentPanel.panel.reveal(vscode.ViewColumn.Beside);
      AnalyticsPanel.currentPanel.refresh();
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      "cupidAnalytics",
      "Cupid — Savings Dashboard",
      vscode.ViewColumn.Beside,
      { enableScripts: true, retainContextWhenHidden: true },
    );
    AnalyticsPanel.currentPanel = new AnalyticsPanel(panel, extensionUri);
  }

  public static notifyUpdate() {
    AnalyticsPanel.currentPanel?.refresh();
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    this.refresh();
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.panel.webview.onDidReceiveMessage(async (msg: { type: string }) => {
      switch (msg.type) {
        case "clear":
          await analyticsStore.clear();
          this.refresh();
          break;
        case "refresh":
          this.refresh();
          break;
      }
    }, null, this.disposables);
  }

  public refresh() {
    const summary = analyticsStore.getSummary();
    const htmlPath = path.join(this.extensionUri.fsPath, "media", "analytics.html");
    try {
      let html = fs.readFileSync(htmlPath, "utf8");
      html = html.replace("__ANALYTICS_DATA__", JSON.stringify(summary));
      this.panel.webview.html = html;
    } catch (err) {
      this.panel.webview.html = `<!DOCTYPE html><html><body style="color:var(--vscode-foreground);background:var(--vscode-editor-background);padding:20px;font-family:system-ui">
        <h3>⚡ CUPID Analytics</h3><p style="color:var(--vscode-errorForeground)">Failed to load dashboard: ${String(err)}</p>
      </body></html>`;
    }
  }

  dispose() {
    AnalyticsPanel.currentPanel = undefined;
    this.panel.dispose();
    for (const d of this.disposables) d.dispose();
    this.disposables = [];
  }
}
