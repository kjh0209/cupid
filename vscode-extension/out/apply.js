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
exports.extractCodeBlocks = extractCodeBlocks;
exports.applyCodeBlocks = applyCodeBlocks;
const vscode = __importStar(require("vscode"));
/**
 * Extract fenced code blocks from a markdown-ish text. Also tries to infer a
 * file path from a leading comment (`// path/to/file.ts`) or the fence info
 * string (`\`\`\`ts path/to/file.ts`).
 */
function extractCodeBlocks(text) {
    const blocks = [];
    const re = /```([a-zA-Z0-9_+.-]*)\s*([^\n]*)\n([\s\S]*?)```/g;
    let m;
    while ((m = re.exec(text)) !== null) {
        const lang = (m[1] ?? "").trim();
        const fenceInfo = (m[2] ?? "").trim();
        let content = m[3] ?? "";
        let inferredPath;
        if (fenceInfo && /[./\\]/.test(fenceInfo) && !/\s/.test(fenceInfo)) {
            inferredPath = fenceInfo;
        }
        const firstLine = content.split("\n")[0]?.trim() ?? "";
        const commentPathMatch = firstLine.match(/^(?:\/\/|#|--|<!--)\s*(?:File:\s*)?([\w./\\-]+\.[a-zA-Z0-9]+)/);
        if (!inferredPath && commentPathMatch && commentPathMatch[1]) {
            inferredPath = commentPathMatch[1];
            content = content.split("\n").slice(1).join("\n");
        }
        blocks.push({ language: lang, inferredPath, content });
    }
    return blocks;
}
const LANG_TO_EXT = {
    ts: "ts", typescript: "ts", tsx: "tsx",
    js: "js", javascript: "js", jsx: "jsx",
    json: "json", html: "html",
    css: "css", scss: "scss", less: "less",
    py: "py", python: "py",
    go: "go", rs: "rs", rust: "rs",
    java: "java", rb: "rb", ruby: "rb", php: "php",
    sh: "sh", bash: "sh",
    yml: "yml", yaml: "yml", toml: "toml",
    md: "md", markdown: "md", sql: "sql",
    c: "c", cpp: "cpp", cxx: "cpp",
    vue: "vue", svelte: "svelte",
};
function defaultFilename(lang, idx) {
    const ext = LANG_TO_EXT[lang.toLowerCase()] ?? "txt";
    if (ext === "html")
        return "index.html";
    return idx === 0 ? `cupid.${ext}` : `cupid-${idx + 1}.${ext}`;
}
function langMatchesFile(lang, fileName) {
    const ext = LANG_TO_EXT[lang.toLowerCase()] ?? "";
    if (!ext)
        return true; // unknown lang — don't block
    return fileName.toLowerCase().endsWith("." + ext);
}
/**
 * Apply code blocks. Default behavior (Cursor-style):
 *
 * - mode="auto":
 *     - Multiple blocks OR any block has an inferred path → write to those files
 *       (creates dirs, prompts on overwrite).
 *     - Single block + active editor whose language matches → REPLACE the entire
 *       file content with the new code (undoable with Ctrl+Z, NOT inserted at
 *       cursor — this was the bug the user hit).
 *     - Single block + no editor (or lang mismatch) → create new untitled doc.
 *
 * - mode="newFile":   always create a new untitled doc per block.
 * - mode="insert":    insert at cursor in active editor (explicit user choice).
 * - mode="diff":      open a side-by-side diff editor for review before applying.
 */
async function applyCodeBlocks(blocks, mode) {
    if (blocks.length === 0)
        return "no code blocks";
    const editor = vscode.window.activeTextEditor;
    const ws = vscode.workspace.workspaceFolders?.[0]?.uri;
    // ── Explicit modes ──
    if (mode === "insert") {
        if (!editor) {
            return applyCodeBlocks(blocks, "newFile");
        }
        const block = blocks[0];
        await editor.edit((eb) => eb.insert(editor.selection.active, block.content));
        return `inserted ${block.content.split("\n").length} lines at cursor`;
    }
    if (mode === "newFile") {
        let created = 0;
        for (let i = 0; i < blocks.length; i++) {
            const b = blocks[i];
            const lang = LANG_TO_EXT[b.language?.toLowerCase()] ?? b.language ?? "plaintext";
            const doc = await vscode.workspace.openTextDocument({ language: lang, content: b.content });
            await vscode.window.showTextDocument(doc, { preview: i === 0 });
            created++;
        }
        return `created ${created} new doc${created > 1 ? "s" : ""}`;
    }
    if (mode === "diff") {
        if (!editor || blocks.length > 1) {
            return applyCodeBlocks(blocks, "newFile");
        }
        const block = blocks[0];
        await openDiffPreview(editor.document, block.content);
        return "opened diff preview — review and apply";
    }
    // ── mode === "auto" ──
    // Case 1: multiple blocks or any has explicit path → write to workspace files.
    const hasPaths = blocks.some((b) => b.inferredPath);
    if (blocks.length > 1 || hasPaths) {
        if (!ws)
            return applyCodeBlocks(blocks, "newFile");
        let written = 0;
        let firstUri = null;
        for (let i = 0; i < blocks.length; i++) {
            const b = blocks[i];
            const relPath = b.inferredPath ?? defaultFilename(b.language, i);
            const uri = vscode.Uri.joinPath(ws, relPath);
            try {
                await vscode.workspace.fs.stat(uri);
                const choice = await vscode.window.showWarningMessage(`Cupid: overwrite ${relPath}?`, { modal: true }, "Overwrite", "Skip");
                if (choice === undefined)
                    break; // user cancelled the modal
                if (choice === "Skip")
                    continue;
            }
            catch { /* doesn't exist, just write */ }
            await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(uri, ".."));
            await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(b.content));
            if (!firstUri)
                firstUri = uri;
            written++;
        }
        if (firstUri)
            await vscode.window.showTextDocument(firstUri);
        return `wrote ${written} file${written !== 1 ? "s" : ""}`;
    }
    // Case 2: single block + active editor whose language matches → REPLACE
    if (editor && langMatchesFile(blocks[0].language, editor.document.fileName)) {
        const block = blocks[0];
        const full = new vscode.Range(editor.document.positionAt(0), editor.document.positionAt(editor.document.getText().length));
        await editor.edit((eb) => eb.replace(full, block.content));
        // Move cursor to top so the user sees the changes
        editor.selection = new vscode.Selection(0, 0, 0, 0);
        editor.revealRange(new vscode.Range(0, 0, 0, 0));
        return `replaced ${editor.document.fileName.split(/[/\\]/).pop()} (${block.content.split("\n").length} lines) — Ctrl+Z to undo`;
    }
    // Case 3: fall back to new doc
    return applyCodeBlocks(blocks, "newFile");
}
/**
 * Open a side-by-side diff of the editor's document vs. proposed new content.
 * The user can then copy / edit manually.
 */
async function openDiffPreview(doc, newContent) {
    // Use untitled scheme for the "proposed" side
    const proposedUri = vscode.Uri.parse(`untitled:${doc.uri.path}.cupid-proposed`);
    const edit = new vscode.WorkspaceEdit();
    edit.createFile(proposedUri, { overwrite: true, ignoreIfExists: false });
    edit.insert(proposedUri, new vscode.Position(0, 0), newContent);
    await vscode.workspace.applyEdit(edit);
    await vscode.commands.executeCommand("vscode.diff", doc.uri, proposedUri, `Cupid: ${doc.uri.path.split("/").pop()} ↔ proposed`);
}
//# sourceMappingURL=apply.js.map