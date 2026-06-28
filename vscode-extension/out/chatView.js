"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CupidChatViewProvider = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const sessionKey_js_1 = require("./sessionKey.js");
const apply_js_1 = require("./apply.js");
class CupidChatViewProvider {
    extensionUri;
    static viewType = "cupid.chatView";
    view;
    activeStream;
    constructor(extensionUri) {
        this.extensionUri = extensionUri;
    }
    resolveWebviewView(view) {
        this.view = view;
        view.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri],
        };
        view.webview.html = this.html();
        view.webview.onDidReceiveMessage(async (msg) => {
            switch (msg.type) {
                case "send":
                    await this.handleSend(msg.text, !!msg.includeSelection);
                    break;
                case "stop":
                    this.activeStream?.abort();
                    break;
                case "apply":
                    await this.handleApply(msg.text, msg.mode);
                    break;
                case "copy":
                    await vscode.env.clipboard.writeText(msg.text);
                    vscode.window.setStatusBarMessage("Cupid: copied", 1500);
                    break;
                case "openSettings":
                    await vscode.commands.executeCommand("workbench.action.openSettings", "@ext:cupid-ai-router");
                    break;
                case "resetSession":
                    await this.handleResetSession();
                    break;
            }
        });
    }
    focus(prefill) {
        if (!this.view) {
            void vscode.commands.executeCommand("cupid.chatView.focus");
            setTimeout(() => this.view?.webview.postMessage({ type: "focusInput", prefill }), 300);
        }
        else {
            this.view.show?.(true);
            this.view.webview.postMessage({ type: "focusInput", prefill });
        }
    }
    sendSelection() {
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
    async handleSend(text, includeSelection) {
        if (!this.view)
            return;
        const config = vscode.workspace.getConfiguration("cupid");
        const backendUrl = config.get("backendUrl") ?? "http://localhost:3300";
        const userMode = config.get("userMode") ?? "balanced";
        const routingMode = config.get("routingMode") ?? "llm_assisted";
        const editor = vscode.window.activeTextEditor;
        const fileName = editor?.document.fileName;
        let rawCode;
        if (includeSelection && editor) {
            rawCode = editor.document.getText(editor.selection) || editor.document.getText();
        }
        const sessionKey = (0, sessionKey_js_1.getWorkspaceSessionKey)();
        const id = "msg-" + Date.now();
        this.view.webview.postMessage({ type: "userMsg", id, text });
        this.view.webview.postMessage({ type: "assistantStart", id });
        this.activeStream?.abort();
        this.activeStream = new AbortController();
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
                if (done)
                    break;
                buf += decoder.decode(value, { stream: true });
                while (true) {
                    const i = buf.indexOf("\n\n");
                    if (i === -1)
                        break;
                    const block = buf.slice(0, i);
                    buf = buf.slice(i + 2);
                    let event = "message";
                    let data = "";
                    for (const line of block.split(/\r?\n/)) {
                        if (line.startsWith("event: "))
                            event = line.slice(7).trim();
                        else if (line.startsWith("data: "))
                            data += line.slice(6);
                    }
                    if (!data)
                        continue;
                    try {
                        const parsed = JSON.parse(data);
                        this.view.webview.postMessage({ type: "stream", id, event, data: parsed });
                    }
                    catch { /* skip */ }
                }
            }
            this.view.webview.postMessage({ type: "assistantEnd", id });
        }
        catch (err) {
            if (err?.name === "AbortError") {
                this.view.webview.postMessage({ type: "aborted", id });
                return;
            }
            this.view.webview.postMessage({
                type: "error", id,
                message: err instanceof Error ? err.message : String(err),
            });
        }
        finally {
            this.activeStream = undefined;
        }
    }
    async handleApply(text, mode) {
        try {
            const blocks = (0, apply_js_1.extractCodeBlocks)(text);
            if (blocks.length === 0) {
                vscode.window.showInformationMessage("Cupid: no code block to apply.");
                return;
            }
            const summary = await (0, apply_js_1.applyCodeBlocks)(blocks, mode);
            vscode.window.setStatusBarMessage(`Cupid: ${summary}`, 3000);
        }
        catch (err) {
            vscode.window.showErrorMessage(`Cupid apply failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    async handleResetSession() {
        const config = vscode.workspace.getConfiguration("cupid");
        const backendUrl = config.get("backendUrl") ?? "http://localhost:3300";
        const sessionKey = (0, sessionKey_js_1.getWorkspaceSessionKey)();
        try {
            await fetch(`${backendUrl}/api/cpl/reset`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sessionKey }),
            });
            vscode.window.setStatusBarMessage("Cupid: session memory reset", 2000);
            this.view?.webview.postMessage({ type: "sessionReset" });
        }
        catch (err) {
            vscode.window.showErrorMessage(`Reset failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    html() {
        const htmlPath = path.join(this.extensionUri.fsPath, "media", "chat.html");
        try {
            return fs.readFileSync(htmlPath, "utf8");
        }
        catch (err) {
            return `<html><body>Failed to load chat UI from ${htmlPath}: ${String(err)}</body></html>`;
        }
    }
}
exports.CupidChatViewProvider = CupidChatViewProvider;
//# sourceMappingURL=chatView.js.map