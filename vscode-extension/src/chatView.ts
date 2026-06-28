import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { getWorkspaceSessionKey } from "./sessionKey.js";
import { parseFenceBlocks, applyFenceBlocks } from "./apply.js";

type StatusState = "idle" | "routing" | "streaming" | "error";
type StatusCallback = (state: StatusState, detail?: string) => void;

export class CupidChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "cupid.chatView";

  private view?: vscode.WebviewView;
  private activeStream?: AbortController;
  private lastUserPrompt = "";
  private readonly onStatus: StatusCallback;

  constructor(
    private readonly extensionUri: vscode.Uri,
    onStatus: StatusCallback,
  ) {
    this.onStatus = onStatus;
  }

  resolveWebviewView(view: vscode.WebviewView) {
    this.view = view;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };
    view.webview.html = this.html();

    view.webview.onDidReceiveMessage(async (msg: Record<string, unknown>) => {
      switch (msg["type"]) {
        case "send":
          await this.handleSend(
            msg["text"] as string,
            !!msg["includeSelection"],
            (msg["attachments"] as string[] | undefined) ?? [],
          );
          break;
        case "stop":
          this.activeStream?.abort();
          break;
        case "apply":
          await this.handleApply(
            msg["text"] as string,
            msg["mode"] as "auto" | "newFile" | "insert" | "diff",
          );
          break;
        case "copy":
          await vscode.env.clipboard.writeText(msg["text"] as string);
          vscode.window.setStatusBarMessage("Cupid: copied", 1500);
          break;
        case "openSettings":
          await vscode.commands.executeCommand("workbench.action.openSettings", "@ext:cupid-ai-router");
          break;
        case "resetSession":
          await this.handleResetSession();
          break;
        case "listFiles":
          await this.handleListFiles();
          break;
        case "readFile":
          await this.handleReadFile(msg["path"] as string);
          break;
        case "checkHealth":
          await this.handleHealthCheck();
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

  // ── Message handlers ────────────────────────────────────────────────────────

  private async handleSend(text: string, includeSelection: boolean, attachments: string[]) {
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

    // Resolve attachment file contents
    let attachmentContext = "";
    if (attachments.length > 0) {
      const ws = vscode.workspace.workspaceFolders?.[0]?.uri;
      if (ws) {
        for (const filePath of attachments) {
          try {
            const uri = vscode.Uri.joinPath(ws, filePath);
            const bytes = await vscode.workspace.fs.readFile(uri);
            const content = new TextDecoder().decode(bytes);
            attachmentContext += `\n\n--- attached: ${filePath} ---\n\`\`\`\n${content.slice(0, 8000)}\n\`\`\``;
          } catch { /* ignore unreadable files */ }
        }
      }
    }

    const fullPrompt = attachmentContext ? `${text}${attachmentContext}` : text;
    this.lastUserPrompt = text;

    const sessionKey = getWorkspaceSessionKey();
    const id = "msg-" + Date.now();
    this.view.webview.postMessage({ type: "userMsg", id, text });
    this.view.webview.postMessage({ type: "assistantStart", id });

    this.activeStream?.abort();
    this.activeStream = new AbortController();
    this.onStatus("routing");

    try {
      const res = await fetch(`${backendUrl}/api/compare/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({
          prompt: fullPrompt,
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
        this.onStatus("error", `HTTP ${res.status}`);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let hasChunks = false;

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
            if (event === "routing") this.onStatus("streaming");
            if (event === "chunk") hasChunks = true;
            this.view?.webview.postMessage({ type: "stream", id, event, data: parsed });
          } catch { /* skip */ }
        }
      }
      this.view.webview.postMessage({ type: "assistantEnd", id });
      this.onStatus("idle", hasChunks ? undefined : undefined);
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") {
        this.view?.webview.postMessage({ type: "aborted", id });
        this.onStatus("idle");
        return;
      }
      this.view?.webview.postMessage({
        type: "error", id,
        message: err instanceof Error ? err.message : String(err),
      });
      this.onStatus("error", err instanceof Error ? err.message : String(err));
    } finally {
      this.activeStream = undefined;
    }
  }

  private async handleApply(text: string, mode: "auto" | "newFile" | "insert" | "diff") {
    try {
      // Try new EDIT MODE protocol blocks first
      const fenceBlocks = parseFenceBlocks(text);
      if (fenceBlocks.length === 0) {
        vscode.window.showInformationMessage("Cupid: no code block to apply.");
        return;
      }
      const summary = await applyFenceBlocks(fenceBlocks, this.lastUserPrompt, mode);
      vscode.window.setStatusBarMessage(`Cupid: ${summary}`, 3000);
    } catch (err) {
      vscode.window.showErrorMessage(
        `Cupid apply failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private async handleListFiles() {
    const ws = vscode.workspace.workspaceFolders?.[0]?.uri;
    if (!ws) {
      this.view?.webview.postMessage({ type: "fileList", files: [] });
      return;
    }
    const uris = await vscode.workspace.findFiles("**/*", "**/node_modules/**", 200);
    const wsPath = ws.fsPath;
    const files = uris
      .map((u) => u.fsPath.replace(wsPath, "").replace(/^[/\\]/, "").replace(/\\/g, "/"))
      .sort();
    this.view?.webview.postMessage({ type: "fileList", files });
  }

  private async handleReadFile(filePath: string) {
    const ws = vscode.workspace.workspaceFolders?.[0]?.uri;
    if (!ws) {
      this.view?.webview.postMessage({ type: "fileContent", path: filePath, content: "" });
      return;
    }
    try {
      const uri = vscode.Uri.joinPath(ws, filePath);
      const bytes = await vscode.workspace.fs.readFile(uri);
      const content = new TextDecoder().decode(bytes);
      this.view?.webview.postMessage({ type: "fileContent", path: filePath, content });
    } catch {
      this.view?.webview.postMessage({ type: "fileContent", path: filePath, content: "" });
    }
  }

  private async handleHealthCheck() {
    const config = vscode.workspace.getConfiguration("cupid");
    const backendUrl = config.get<string>("backendUrl") ?? "http://localhost:3300";
    let online = false;
    try {
      const res = await fetch(`${backendUrl}/health`, { signal: AbortSignal.timeout(3000) });
      online = res.ok;
    } catch { /* offline */ }
    this.view?.webview.postMessage({ type: "healthResult", online, url: backendUrl });
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
      vscode.window.showErrorMessage(
        `Reset failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
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
