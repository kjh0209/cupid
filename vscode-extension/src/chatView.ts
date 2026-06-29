import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { getWorkspaceSessionKey } from "./sessionKey.js";
import { applyCodeBlocks, extractCodeBlocks } from "./apply.js";
import { analyticsStore, calcBaselineCost } from "./analytics.js";
import { AnalyticsPanel } from "./analyticsPanel.js";

export class CupidChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "cupid.chatView";
  public readonly extensionUri: vscode.Uri;

  private view?: vscode.WebviewView;
  private activeStream?: AbortController;

  constructor(extensionUri: vscode.Uri) {
    this.extensionUri = extensionUri;
  }

  resolveWebviewView(view: vscode.WebviewView) {
    this.view = view;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };
    view.webview.html = this.html();

    view.webview.onDidReceiveMessage(async (msg) => {
      switch (msg.type) {
        case "send":
          await this.handleSend(msg.text as string, !!msg.includeSelection);
          break;
        case "stop":
          this.activeStream?.abort();
          break;
        case "apply":
          await this.handleApply(msg.text as string, msg.mode as "auto" | "newFile" | "insert" | "diff");
          break;
        case "copy":
          await vscode.env.clipboard.writeText(msg.text as string);
          vscode.window.setStatusBarMessage("Cupid: copied", 1500);
          break;
        case "openSettings":
          await vscode.commands.executeCommand("workbench.action.openSettings", "@ext:cupid-ai-router");
          break;
        case "openAnalytics":
          AnalyticsPanel.createOrShow(this.extensionUri);
          break;
        case "resetSession":
          await this.handleResetSession();
          break;
        case "getFileList":
          await this.handleGetFileList();
          break;
      }
    });
  }

  public focus(prefill?: string) {
    if (!this.view) {
      void vscode.commands.executeCommand("cupid.chatView.focus");
      setTimeout(() => this.view?.webview.postMessage({ type: "focusInput", prefill }), 300);
    } else {
      this.view.show?.(true);
      this.view.webview.postMessage({ type: "focusInput", prefill });
    }
  }

  public sendSelection() {
    const ed = vscode.window.activeTextEditor;
    if (!ed) {
      vscode.window.showInformationMessage("Cupid: no active editor.");
      return;
    }
    const selection = ed.document.getText(ed.selection);
    if (!selection) {
      vscode.window.showInformationMessage("Cupid: nothing selected.");
      return;
    }
    this.focus(`Explain or change this code:\n\n${selection}`);
  }

  private async handleSend(text: string, includeSelection: boolean) {
    if (!this.view) return;
    const config = vscode.workspace.getConfiguration("cupid");
    const backendUrl = config.get<string>("backendUrl") ?? "http://localhost:3300";
    const userMode = config.get<string>("userMode") ?? "balanced";
    const routingMode = config.get<string>("routingMode") ?? "llm_assisted";

    const editor = vscode.window.activeTextEditor;
    const fileName = editor?.document.fileName;
    let rawCode: string | undefined;
    if (includeSelection && editor) {
      rawCode = editor.document.getText(editor.selection) || editor.document.getText();
    }

    const sessionKey = getWorkspaceSessionKey();
    const id = "msg-" + Date.now();
    this.view.webview.postMessage({ type: "userMsg", id, text });
    this.view.webview.postMessage({ type: "assistantStart", id });

    this.activeStream?.abort();
    this.activeStream = new AbortController();

    // Capture routing info for analytics
    let routingInfo: { displayName: string; tier: string; taskType: string } | null = null;

    try {
      const res = await fetch(`${backendUrl}/api/compare/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({
          prompt: text,
          userMode,
          routingMode,
          rawCode,
          fileName,
          sessionKey,
          useCpl: true,
          extractCpl: true,
        }),
        signal: this.activeStream.signal,
      });

      if (!res.ok || !res.body) {
        this.view.webview.postMessage({
          type: "error", id,
          message: `Backend returned ${res.status}. Is the server running at ${backendUrl}?`,
        });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        while (true) {
          const i = buf.indexOf("\n\n");
          if (i === -1) break;
          const block = buf.slice(0, i);
          buf = buf.slice(i + 2);
          let event = "message";
          let data = "";
          for (const line of block.split(/\r?\n/)) {
            if (line.startsWith("event: ")) event = line.slice(7).trim();
            else if (line.startsWith("data: ")) data += line.slice(6);
          }
          if (!data) continue;
          try {
            const parsed = JSON.parse(data) as Record<string, unknown>;

            if (event === "routing") {
              // Capture routing info for analytics
              const r = parsed["routing"] as Record<string, unknown> | undefined;
              const c = parsed["classification"] as Record<string, unknown> | undefined;
              routingInfo = {
                displayName: String(r?.["displayName"] ?? ""),
                tier: String(r?.["tier"] ?? ""),
                taskType: String(c?.["taskType"] ?? ""),
              };
              this.view.webview.postMessage({ type: "stream", id, event, data: parsed });

            } else if (event === "done") {
              // Compute and attach savings to the done event before forwarding
              const inputTokens = Number(parsed["inputTokens"] ?? 0);
              const outputTokens = Number(parsed["outputTokens"] ?? 0);
              const actualCostUsd = Number(parsed["costUsd"] ?? 0);
              const baselineCostUsd = calcBaselineCost(inputTokens, outputTokens);
              const savedCostUsd = Math.max(0, baselineCostUsd - actualCostUsd);
              const savedPct = baselineCostUsd > 0 ? (savedCostUsd / baselineCostUsd) * 100 : 0;

              this.view.webview.postMessage({
                type: "stream", id, event,
                data: { ...parsed, baselineCostUsd, savedCostUsd, savedPct },
              });

              // Record to analytics store and refresh panel
              if (routingInfo) {
                const modelId = String(parsed["modelId"] ?? routingInfo.displayName);
                const latencyMs = Number(parsed["latencyMs"] ?? 0);
                void analyticsStore.record({
                  taskType: routingInfo.taskType,
                  modelId,
                  modelDisplayName: routingInfo.displayName,
                  tier: routingInfo.tier,
                  inputTokens,
                  outputTokens,
                  actualCostUsd,
                  latencyMs,
                }).then(() => {
                  const summary = analyticsStore.getSummary();
                  this.view?.webview.postMessage({
                    type: "analyticsUpdate",
                    sessionSaved: summary.totalSaved,
                    sessionSavedPct: summary.avgSavedPct,
                  });
                  AnalyticsPanel.notifyUpdate();
                }).catch(() => { /* ignore analytics errors */ });
              }

            } else {
              this.view.webview.postMessage({ type: "stream", id, event, data: parsed });
            }
          } catch { /* skip unparseable SSE */ }
        }
      }
      this.view.webview.postMessage({ type: "assistantEnd", id });
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") {
        this.view.webview.postMessage({ type: "aborted", id });
        return;
      }
      this.view.webview.postMessage({
        type: "error", id,
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      this.activeStream = undefined;
    }
  }

  private async handleApply(text: string, mode: "auto" | "newFile" | "insert" | "diff") {
    try {
      const blocks = extractCodeBlocks(text);
      if (blocks.length === 0) {
        vscode.window.showInformationMessage("Cupid: no code block to apply.");
        return;
      }
      const summary = await applyCodeBlocks(blocks, mode);
      vscode.window.setStatusBarMessage(`Cupid: ${summary}`, 3000);
    } catch (err) {
      vscode.window.showErrorMessage(`Cupid apply failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async handleResetSession() {
    const config = vscode.workspace.getConfiguration("cupid");
    const backendUrl = config.get<string>("backendUrl") ?? "http://localhost:3300";
    const sessionKey = getWorkspaceSessionKey();
    try {
      await fetch(`${backendUrl}/api/cpl/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionKey }),
      });
      vscode.window.setStatusBarMessage("Cupid: session memory reset", 2000);
      this.view?.webview.postMessage({ type: "sessionReset" });
    } catch (err) {
      vscode.window.showErrorMessage(`Reset failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async handleGetFileList() {
    const files: string[] = [];
    const ws = vscode.workspace.workspaceFolders?.[0]?.uri;
    if (ws) {
      try {
        const found = await vscode.workspace.findFiles(
          "**/*.{ts,tsx,js,jsx,py,go,rs,java,md,json,yaml,yml,html,css,scss}",
          "**/node_modules/**",
          100,
        );
        for (const f of found) {
          files.push(vscode.workspace.asRelativePath(f));
        }
      } catch { /* ignore */ }
    }
    this.view?.webview.postMessage({ type: "fileList", files });
  }

  private html(): string {
    const htmlPath = path.join(this.extensionUri.fsPath, "media", "chat.html");
    try {
      return fs.readFileSync(htmlPath, "utf8");
    } catch (err) {
      return `<html><body>Failed to load chat UI from ${htmlPath}: ${String(err)}</body></html>`;
    }
  }
}
