import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { getWorkspaceSessionKey } from "./sessionKey.js";
import { applyCodeBlocks, extractCodeBlocks } from "./apply.js";

type StatusSetter = (state: "idle" | "routing" | "streaming" | "error", model?: string) => void;

export class CupidChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "cupid.chatView";

  private view?: vscode.WebviewView;
  /** Active streaming requests, keyed by message id */
  private activeStreams = new Map<string, AbortController>();
  /** Last user prompt for intent inference in apply */
  private lastUserPrompt = "";

  constructor(
    private readonly extensionUri: vscode.Uri,
    _context: vscode.ExtensionContext,
    private readonly setStatusBar: StatusSetter,
  ) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };
    view.webview.html = this.html();

    view.webview.onDidReceiveMessage(async (msg: Record<string, unknown>) => {
      switch (msg["type"] as string) {
        case "send":
          await this.handleSend(
            msg["text"] as string,
            (msg["attachments"] as Array<{ path: string; content: string }>) ?? [],
          );
          break;
        case "stop":
          this.stopStream(msg["id"] as string);
          break;
        case "stopAll":
          this.stopAll();
          break;
        case "apply":
          await this.handleApply(
            msg["text"] as string,
            (msg["mode"] as "auto" | "newFile" | "insert" | "diff") ?? "auto",
          );
          break;
        case "copy":
          await vscode.env.clipboard.writeText(msg["text"] as string);
          vscode.window.setStatusBarMessage("Cupid: copied to clipboard", 1500);
          break;
        case "openSettings":
          await vscode.commands.executeCommand("workbench.action.openSettings", "@ext:cupid-ai-router");
          break;
        case "resetSession":
          await this.handleResetSession();
          break;
        case "getFileList":
          await this.handleGetFileList();
          break;
        case "readFile":
          await this.handleReadFile(msg["path"] as string);
          break;
        case "checkHealth":
          await this.handleCheckHealth();
          break;
        case "openInlineEdit":
          await vscode.commands.executeCommand("cupid.inlineEdit");
          break;
        case "openFile":
          await this.handleOpenFile(msg["path"] as string);
          break;
      }
    });

    // Send workspace info to the webview after a short delay
    setTimeout(() => {
      const sessionKey = getWorkspaceSessionKey();
      view.webview.postMessage({ type: "init", sessionKey });
      void this.handleCheckHealth();
    }, 200);
  }

  public focus(prefill?: string): void {
    if (!this.view) {
      void vscode.commands.executeCommand("cupid.chatView.focus");
      setTimeout(() => this.view?.webview.postMessage({ type: "focusInput", prefill }), 300);
    } else {
      this.view.show?.(true);
      this.view.webview.postMessage({ type: "focusInput", prefill });
    }
  }

  public postMessage(msg: Record<string, unknown>): void {
    this.view?.webview.postMessage(msg);
  }

  public sendSelection(): void {
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
    this.focus(`Explain this code:\n\n${selection}`);
  }

  public stopAll(): void {
    for (const [, ctrl] of this.activeStreams) {
      ctrl.abort();
    }
    this.activeStreams.clear();
    this.setStatusBar("idle");
  }

  public resetSession(): void {
    void this.handleResetSession();
  }

  private stopStream(id: string): void {
    const ctrl = this.activeStreams.get(id);
    if (ctrl) {
      ctrl.abort();
      this.activeStreams.delete(id);
    }
    if (this.activeStreams.size === 0) this.setStatusBar("idle");
  }

  private async handleSend(
    text: string,
    attachments: Array<{ path: string; content: string }>,
  ): Promise<void> {
    if (!this.view) return;
    const config = vscode.workspace.getConfiguration("cupid");
    const backendUrl = config.get<string>("backendUrl") ?? "http://localhost:3300";
    const userMode = config.get<string>("userMode") ?? "balanced";
    const routingMode = config.get<string>("routingMode") ?? "llm_assisted";

    const editor = vscode.window.activeTextEditor;
    const fileName = editor?.document.fileName;
    const rawCode = editor?.document.getText();

    this.lastUserPrompt = text;

    // Build prompt with attachments
    let fullPrompt = text;
    if (attachments.length > 0) {
      fullPrompt += "\n\n" + attachments
        .map((a) => `[Attached file: ${a.path}]\n\`\`\`\n${a.content}\n\`\`\``)
        .join("\n\n");
    }

    const sessionKey = getWorkspaceSessionKey();
    const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    this.view.webview.postMessage({
      type: "userMsg",
      id,
      text,
      attachments: attachments.map((a) => a.path),
      activeFile: fileName ? path.basename(fileName) : undefined,
    });
    this.view.webview.postMessage({ type: "assistantStart", id });

    const abort = new AbortController();
    this.activeStreams.set(id, abort);
    this.setStatusBar("routing");
    this.view.webview.postMessage({ type: "activeCount", count: this.activeStreams.size });

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
        signal: abort.signal,
      });

      if (!res.ok || !res.body) {
        this.view.webview.postMessage({
          type: "error",
          id,
          message: `Backend returned ${res.status}. Is the server running at ${backendUrl}?\n\nRun: pnpm dev`,
        });
        return;
      }

      this.setStatusBar("streaming");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        while (true) {
          const sep = buf.indexOf("\n\n");
          if (sep === -1) break;
          const block = buf.slice(0, sep);
          buf = buf.slice(sep + 2);
          let event = "message";
          let data = "";
          for (const line of block.split(/\r?\n/)) {
            if (line.startsWith("event: ")) event = line.slice(7).trim();
            else if (line.startsWith("data: ")) data += line.slice(6);
          }
          if (!data) continue;
          try {
            const parsed = JSON.parse(data) as unknown;
            if (!this.view) break;
            this.view.webview.postMessage({ type: "stream", id, event, data: parsed });
          } catch { /* skip malformed */ }
        }
      }
      this.view.webview.postMessage({ type: "assistantEnd", id });
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") {
        this.view?.webview.postMessage({ type: "aborted", id });
        return;
      }
      this.view?.webview.postMessage({
        type: "error",
        id,
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      this.activeStreams.delete(id);
      if (this.activeStreams.size === 0) this.setStatusBar("idle");
      this.view?.webview.postMessage({
        type: "activeCount",
        count: this.activeStreams.size,
      });
    }
  }

  private async handleApply(text: string, mode: "auto" | "newFile" | "insert" | "diff"): Promise<void> {
    try {
      const blocks = extractCodeBlocks(text);
      if (blocks.length === 0) {
        vscode.window.showInformationMessage("Cupid: no code block found to apply.");
        return;
      }
      const summary = await applyCodeBlocks(blocks, mode, this.lastUserPrompt);
      vscode.window.setStatusBarMessage(`Cupid: ${summary}`, 3000);
    } catch (err) {
      vscode.window.showErrorMessage(
        `Cupid apply failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private async handleResetSession(): Promise<void> {
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

  private async handleGetFileList(): Promise<void> {
    try {
      const uris = await vscode.workspace.findFiles(
        "**/*.{ts,tsx,js,jsx,py,go,rs,java,rb,php,css,scss,html,json,yaml,yml,toml,md}",
        "{**/node_modules/**,**/.git/**,**/dist/**,**/out/**,**/.next/**,**/build/**}",
        300,
      );
      const files = uris
        .map((u) => vscode.workspace.asRelativePath(u))
        .sort((a, b) => a.localeCompare(b));
      this.view?.webview.postMessage({ type: "fileList", files });
    } catch {
      this.view?.webview.postMessage({ type: "fileList", files: [] });
    }
  }

  private async handleReadFile(filePath: string): Promise<void> {
    try {
      const ws = vscode.workspace.workspaceFolders?.[0];
      if (!ws) return;
      const uri = vscode.Uri.joinPath(ws.uri, filePath);
      const bytes = await vscode.workspace.fs.readFile(uri);
      const content = new TextDecoder().decode(bytes);
      // Limit content to 8000 chars to avoid huge prompts
      const truncated = content.length > 8000 ? content.slice(0, 8000) + "\n…[truncated]" : content;
      this.view?.webview.postMessage({ type: "fileContent", path: filePath, content: truncated });
    } catch (err) {
      this.view?.webview.postMessage({
        type: "fileContent",
        path: filePath,
        content: null,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private async handleCheckHealth(): Promise<void> {
    const config = vscode.workspace.getConfiguration("cupid");
    const backendUrl = config.get<string>("backendUrl") ?? "http://localhost:3300";
    try {
      const res = await fetch(`${backendUrl}/health`, { signal: AbortSignal.timeout(3000) });
      this.view?.webview.postMessage({ type: "backendStatus", online: res.ok, url: backendUrl });
    } catch {
      this.view?.webview.postMessage({ type: "backendStatus", online: false, url: backendUrl });
    }
  }

  private async handleOpenFile(filePath: string): Promise<void> {
    try {
      const ws = vscode.workspace.workspaceFolders?.[0];
      if (!ws) return;
      const uri = vscode.Uri.joinPath(ws.uri, filePath);
      await vscode.window.showTextDocument(uri);
    } catch { /* ignore */ }
  }

  private html(): string {
    const htmlPath = path.join(this.extensionUri.fsPath, "media", "chat.html");
    try {
      return fs.readFileSync(htmlPath, "utf8");
    } catch (err) {
      return `<html><body style="font-family:sans-serif;padding:20px;color:red;">
        <h3>Cupid: Failed to load chat UI</h3>
        <p>${String(err)}</p>
        <p>Expected: ${htmlPath}</p>
      </body></html>`;
    }
  }
}
