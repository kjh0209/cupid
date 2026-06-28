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
exports.CupidPanel = void 0;
const vscode = __importStar(require("vscode"));
class CupidPanel {
    static currentPanel;
    _panel;
    _disposables = [];
    constructor(panel, _extensionUri) {
        this._panel = panel;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    }
    static createOrShow(extensionUri) {
        const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;
        if (CupidPanel.currentPanel) {
            CupidPanel.currentPanel._panel.reveal(column);
            return CupidPanel.currentPanel;
        }
        const panel = vscode.window.createWebviewPanel("cupidAI", "Cupid AI", vscode.ViewColumn.Beside, { enableScripts: true, retainContextWhenHidden: true });
        CupidPanel.currentPanel = new CupidPanel(panel, extensionUri);
        return CupidPanel.currentPanel;
    }
    showLoading(prompt) {
        this._panel.webview.html = this._buildLoadingHtml(prompt);
    }
    showResult(opts) {
        this._panel.webview.html = this._buildResultHtml(opts);
        this._panel.webview.onDidReceiveMessage((msg) => {
            if (msg.command === "copy" && msg.text) {
                vscode.env.clipboard.writeText(msg.text);
                vscode.window.showInformationMessage("Copied to clipboard!");
            }
            if (msg.command === "insert" && msg.text) {
                const editor = vscode.window.activeTextEditor;
                if (editor) {
                    editor.insertSnippet(new vscode.SnippetString(msg.text));
                }
            }
        }, undefined, this._disposables);
    }
    showError(message) {
        this._panel.webview.html = this._buildErrorHtml(message);
    }
    _buildLoadingHtml(prompt) {
        return `<!DOCTYPE html><html><body style="font-family:system-ui;padding:16px;color:#ccc;background:#1e1e1e">
      <h3 style="color:#fff">⚡ Cupid AI</h3>
      <p style="color:#aaa">Routing: <em>${this._esc(prompt.slice(0, 80))}${prompt.length > 80 ? "…" : ""}</em></p>
      <div style="color:#569cd6">🔄 Calling best model for this task…</div>
    </body></html>`;
    }
    _buildResultHtml(opts) {
        const savingsColor = opts.savingsPercent >= 80 ? "#4ec9b0" : opts.savingsPercent >= 50 ? "#dcdcaa" : "#ce9178";
        const escapedResponse = this._esc(opts.response);
        return `<!DOCTYPE html><html><body style="font-family:system-ui;padding:16px;color:#ccc;background:#1e1e1e;margin:0">
      <style>
        pre { background:#252526;padding:12px;border-radius:4px;overflow:auto;white-space:pre-wrap;word-break:break-word; }
        .badge { display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;margin:2px; }
        .btn { background:#0e639c;color:#fff;border:none;padding:6px 14px;border-radius:4px;cursor:pointer;margin:4px; }
        .btn:hover { background:#1177bb; }
        .reasons { font-size:12px;color:#858585;margin-top:8px; }
      </style>
      <h3 style="color:#fff;margin:0 0 8px">⚡ Cupid AI</h3>
      <div style="margin-bottom:12px">
        <span class="badge" style="background:#264f78;color:#9cdcfe">${this._esc(opts.modelName)}</span>
        <span class="badge" style="background:#3c3c00;color:#dcdcaa">${this._esc(opts.taskType)}</span>
        <span class="badge" style="background:#1e3a1e;color:${savingsColor}">💰 ${opts.savingsPercent.toFixed(0)}% saved</span>
        ${opts.selfReviseApplied ? `<span class="badge" style="background:#3a1e3a;color:#c586c0">✏️ revised${opts.selfReviseAutoTriggered ? " (auto)" : ""}</span>` : ""}
        ${opts.cplEntries > 0 ? `<span class="badge" style="background:#1e2a3a;color:#4fc1ff">🧠 ${opts.cplEntries} CPL</span>` : ""}
      </div>
      <div class="reasons">${opts.reasons.slice(0, 3).map(r => `• ${this._esc(r)}`).join("<br>")}</div>
      <div style="margin:12px 0">
        <button class="btn" onclick="copyText()">📋 Copy</button>
        <button class="btn" onclick="insertText()">↩️ Insert at cursor</button>
      </div>
      <pre id="response">${escapedResponse}</pre>
      <div style="font-size:11px;color:#555;margin-top:8px">
        $${opts.costUsd.toFixed(6)} · ${opts.latencyMs}ms
      </div>
      <script>
        const vscode = acquireVsCodeApi();
        const text = ${JSON.stringify(opts.response)};
        function copyText() { vscode.postMessage({ command: 'copy', text }); }
        function insertText() { vscode.postMessage({ command: 'insert', text }); }
      </script>
    </body></html>`;
    }
    _buildErrorHtml(message) {
        return `<!DOCTYPE html><html><body style="font-family:system-ui;padding:16px;color:#f48771;background:#1e1e1e">
      <h3>⚡ Cupid AI — Error</h3>
      <p>${this._esc(message)}</p>
      <p style="color:#858585;font-size:12px">Make sure the backend is running: <code>pnpm dev</code></p>
    </body></html>`;
    }
    _esc(str) {
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }
    dispose() {
        CupidPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length)
            this._disposables.pop().dispose();
    }
}
exports.CupidPanel = CupidPanel;
//# sourceMappingURL=panel.js.map