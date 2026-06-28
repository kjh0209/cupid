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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const chatView_js_1 = require("./chatView.js");
const sessionKey_js_1 = require("./sessionKey.js");
let chatProvider;
function activate(context) {
    chatProvider = new chatView_js_1.CupidChatViewProvider(context.extensionUri);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(chatView_js_1.CupidChatViewProvider.viewType, chatProvider, {
        webviewOptions: { retainContextWhenHidden: true },
    }));
    context.subscriptions.push(vscode.commands.registerCommand("cupid.openChat", async () => {
        // Reveal the sidebar view and focus the chat input
        await vscode.commands.executeCommand("workbench.view.extension.cupid-sidebar");
        chatProvider?.focus();
    }), vscode.commands.registerCommand("cupid.askWithSelection", async () => {
        await vscode.commands.executeCommand("workbench.view.extension.cupid-sidebar");
        chatProvider?.sendSelection();
    }), vscode.commands.registerCommand("cupid.showStats", () => showStats()), vscode.commands.registerCommand("cupid.resetSession", () => resetSession()), vscode.commands.registerCommand("cupid.configureEndpoint", () => configureEndpoint()), vscode.commands.registerCommand("cupid.moveToRight", () => moveChatToRight()));
    // First-time auto-move to right Secondary Side Bar (Cursor-style)
    void maybeAutoMove(context);
    // Status bar item
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBar.text = "$(robot) Cupid";
    statusBar.tooltip = "Open Cupid chat";
    statusBar.command = "cupid.openChat";
    statusBar.show();
    context.subscriptions.push(statusBar);
}
async function showStats() {
    const config = vscode.workspace.getConfiguration("cupid");
    const backendUrl = config.get("backendUrl") ?? "http://localhost:3300";
    const sessionKey = (0, sessionKey_js_1.getWorkspaceSessionKey)();
    try {
        const res = await fetch(`${backendUrl}/api/cpl/stats?sessionKey=${encodeURIComponent(sessionKey)}`);
        if (!res.ok)
            throw new Error(`HTTP ${res.status}`);
        const stats = await res.json();
        const msg = [
            `Session: ${sessionKey}`,
            `Memory entries: ${stats.entryCount}  |  Tasks logged: ${stats.historyCount}`,
            `Total cost (estimated): $${(stats.totalCostUsd ?? 0).toFixed(6)}`,
            `Models used: ${(stats.modelsUsed ?? []).join(", ") || "—"}`,
        ].join("\n");
        vscode.window.showInformationMessage(msg, { modal: true });
    }
    catch (err) {
        vscode.window.showErrorMessage(`Cupid stats: ${err instanceof Error ? err.message : String(err)}`);
    }
}
async function resetSession() {
    const config = vscode.workspace.getConfiguration("cupid");
    const backendUrl = config.get("backendUrl") ?? "http://localhost:3300";
    const sessionKey = (0, sessionKey_js_1.getWorkspaceSessionKey)();
    const confirm = await vscode.window.showWarningMessage("Reset Cupid session memory for this workspace? All CPL context entries will be deleted.", "Reset", "Cancel");
    if (confirm !== "Reset")
        return;
    try {
        await fetch(`${backendUrl}/api/cpl/reset`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionKey }),
        });
        vscode.window.setStatusBarMessage("Cupid: session memory reset", 2000);
    }
    catch (err) {
        vscode.window.showErrorMessage(`Reset failed: ${err instanceof Error ? err.message : String(err)}`);
    }
}
async function configureEndpoint() {
    const config = vscode.workspace.getConfiguration("cupid");
    const current = config.get("backendUrl") ?? "http://localhost:3300";
    const url = await vscode.window.showInputBox({
        prompt: "Cupid backend URL",
        value: current,
        placeHolder: "http://localhost:3300",
    });
    if (url) {
        await config.update("backendUrl", url, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`Cupid backend set to: ${url}`);
    }
}
async function moveChatToRight() {
    try {
        // Focus the view first so the command knows what to move
        await vscode.commands.executeCommand("cupid.chatView.focus");
        await new Promise((r) => setTimeout(r, 100));
        // Move the focused view to the auxiliary (secondary side) bar
        await vscode.commands.executeCommand("workbench.action.moveView", {
            viewId: "cupid.chatView",
            destinationId: "workbench.parts.auxiliarybar",
        });
    }
    catch {
        // Fallback: open the auxiliary bar so user knows it exists
        try {
            await vscode.commands.executeCommand("workbench.action.toggleAuxiliaryBar");
        }
        catch { /* ignore */ }
        vscode.window.showInformationMessage("Cupid: drag the Cupid AI panel to the right Secondary Side Bar (View → Appearance → Secondary Side Bar).");
    }
}
async function maybeAutoMove(context) {
    const config = vscode.workspace.getConfiguration("cupid");
    if (!config.get("autoMoveToRight"))
        return;
    const key = "cupid.didAutoMove";
    if (context.globalState.get(key))
        return;
    // Wait a moment for views to finish registering
    await new Promise((r) => setTimeout(r, 600));
    await moveChatToRight();
    await context.globalState.update(key, true);
}
function deactivate() { }
//# sourceMappingURL=extension.js.map