import * as vscode from "vscode";
import { showDiffDecorations } from "./diffDecoration.js";

export interface CodeBlock {
  language: string;
  inferredPath?: string;
  mode: "replace" | "patch" | "insert" | null;
  content: string;
  searchReplaceHunks?: Array<{ search: string; replace: string }>;
}

// ---------- Parsing ----------

function parseSearchReplaceHunks(content: string): Array<{ search: string; replace: string }> {
  const hunks: Array<{ search: string; replace: string }> = [];
  const re = /<<<<<<< SEARCH\r?\n([\s\S]*?)\r?\n=======\r?\n([\s\S]*?)\r?\n>>>>>>> REPLACE/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    hunks.push({ search: m[1] ?? "", replace: m[2] ?? "" });
  }
  return hunks;
}

export function extractCodeBlocks(text: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  const re = /```([a-zA-Z0-9_+.-]*)\s*([^\n]*)\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const lang = (m[1] ?? "").trim();
    const fenceInfo = (m[2] ?? "").trim();
    let content = m[3] ?? "";
    let inferredPath: string | undefined;
    let mode: "replace" | "patch" | "insert" | null = null;

    // Parse structured fence info: path=src/foo.ts mode=replace
    const pathMatch = fenceInfo.match(/path=([^\s]+)/);
    const modeMatch = fenceInfo.match(/mode=(replace|patch|insert)/);
    if (pathMatch?.[1]) inferredPath = pathMatch[1];
    if (modeMatch?.[1]) mode = modeMatch[1] as "replace" | "patch" | "insert";

    // Legacy: bare path in fence info (no spaces)
    if (!inferredPath && fenceInfo && /[./\\]/.test(fenceInfo) && !/\s/.test(fenceInfo)) {
      inferredPath = fenceInfo;
    }

    // Infer path from first-line comment: // src/foo.ts  or  # foo.py
    if (!inferredPath) {
      const firstLine = content.split("\n")[0]?.trim() ?? "";
      const cpMatch = firstLine.match(
        /^(?:\/\/|#|--|<!--)\s*(?:File:\s*)?([\w./\\-]+\.[a-zA-Z0-9]+)/,
      );
      if (cpMatch?.[1]) {
        inferredPath = cpMatch[1];
        content = content.split("\n").slice(1).join("\n");
      }
    }

    // Detect SEARCH/REPLACE hunks
    const srHunks = parseSearchReplaceHunks(content);
    if (srHunks.length > 0 && !mode) mode = "patch";

    blocks.push({ language: lang, inferredPath, mode, content, searchReplaceHunks: srHunks });
  }
  return blocks;
}

// ---------- Helpers ----------

function hasDeiticExpression(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  return [
    "이 파일", "여기", "현재 파일", "this file", "here", "current file",
    "이거", "이것", "여기서", "지금", "above", "위에", "below", "이 코드",
    "in this", "the file", "그 파일",
  ].some((p) => lower.includes(p));
}

const LANG_TO_EXT: Record<string, string> = {
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

function defaultFilename(lang: string, idx: number): string {
  const ext = LANG_TO_EXT[lang.toLowerCase()] ?? "txt";
  return idx === 0 ? `cupid.${ext}` : `cupid-${idx + 1}.${ext}`;
}

function langMatchesFile(lang: string, fileName: string): boolean {
  const ext = LANG_TO_EXT[lang.toLowerCase()];
  if (!ext) return true; // unknown lang — allow
  return fileName.toLowerCase().endsWith("." + ext);
}

// ---------- Patch application ----------

async function applySearchReplaceHunks(
  editor: vscode.TextEditor,
  hunks: Array<{ search: string; replace: string }>,
): Promise<{ applied: number; failed: number }> {
  let applied = 0;
  let failed = 0;

  for (const hunk of hunks) {
    const text = editor.document.getText();

    // Exact match first
    const exactIdx = text.indexOf(hunk.search);
    if (exactIdx !== -1) {
      const start = editor.document.positionAt(exactIdx);
      const end = editor.document.positionAt(exactIdx + hunk.search.length);
      await editor.edit((eb) => eb.replace(new vscode.Range(start, end), hunk.replace));
      applied++;
      continue;
    }

    // Fuzzy match: compare trimmed lines
    const docLines = editor.document.getText().split("\n");
    const searchLines = hunk.search.split("\n").map((l) => l.trim());
    let matchStart = -1;

    outer: for (let i = 0; i <= docLines.length - searchLines.length; i++) {
      for (let j = 0; j < searchLines.length; j++) {
        if ((docLines[i + j] ?? "").trim() !== searchLines[j]) continue outer;
      }
      matchStart = i;
      break;
    }

    if (matchStart !== -1) {
      const startPos = editor.document.lineAt(matchStart).range.start;
      const endLine = Math.min(matchStart + searchLines.length - 1, editor.document.lineCount - 1);
      const endPos = editor.document.lineAt(endLine).range.end;
      await editor.edit((eb) => eb.replace(new vscode.Range(startPos, endPos), hunk.replace));
      applied++;
    } else {
      failed++;
    }
  }

  return { applied, failed };
}

// ---------- Diff preview ----------

async function openDiffPreview(doc: vscode.TextDocument, newContent: string): Promise<void> {
  const proposed = vscode.Uri.parse(`untitled:${doc.uri.path}.cupid-proposed`);
  const edit = new vscode.WorkspaceEdit();
  edit.createFile(proposed, { overwrite: true, ignoreIfExists: false });
  edit.insert(proposed, new vscode.Position(0, 0), newContent);
  await vscode.workspace.applyEdit(edit);
  await vscode.commands.executeCommand(
    "vscode.diff",
    doc.uri,
    proposed,
    `Cupid: ${doc.uri.path.split("/").pop()} ↔ proposed`,
  );
}

// ---------- Main entry ----------

export async function applyCodeBlocks(
  blocks: CodeBlock[],
  mode: "auto" | "newFile" | "insert" | "diff",
  userPrompt?: string,
): Promise<string> {
  if (blocks.length === 0) return "no code blocks found";

  const editor = vscode.window.activeTextEditor;
  const ws = vscode.workspace.workspaceFolders?.[0]?.uri;

  // ── Explicit modes ──
  if (mode === "insert") {
    if (!editor) return applyCodeBlocks(blocks, "newFile", userPrompt);
    await editor.edit((eb) => eb.insert(editor.selection.active, blocks[0]!.content));
    return `inserted ${blocks[0]!.content.split("\n").length} lines at cursor`;
  }

  if (mode === "newFile") {
    let created = 0;
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i]!;
      const lang = LANG_TO_EXT[b.language?.toLowerCase()] ?? b.language ?? "plaintext";
      const doc = await vscode.workspace.openTextDocument({ language: lang, content: b.content });
      await vscode.window.showTextDocument(doc, { preview: i === 0 });
      created++;
    }
    return `created ${created} new doc${created !== 1 ? "s" : ""}`;
  }

  if (mode === "diff") {
    if (!editor || blocks.length > 1) return applyCodeBlocks(blocks, "newFile", userPrompt);
    await openDiffPreview(editor.document, blocks[0]!.content);
    return "opened diff preview — review and apply";
  }

  // ── mode === "auto" ── smart intent inference

  // Case A: SEARCH/REPLACE patch
  const patchBlock = blocks.find((b) => b.mode === "patch" && b.searchReplaceHunks?.length);
  if (patchBlock) {
    let targetEditor = editor;

    if (patchBlock.inferredPath && ws) {
      try {
        const uri = vscode.Uri.joinPath(ws, patchBlock.inferredPath);
        const doc = await vscode.workspace.openTextDocument(uri);
        targetEditor = await vscode.window.showTextDocument(doc);
      } catch { /* fallback to active editor */ }
    }

    if (!targetEditor) return applyCodeBlocks(blocks, "newFile", userPrompt);

    const hunks = patchBlock.searchReplaceHunks!;
    const { applied, failed } = await applySearchReplaceHunks(targetEditor, hunks);

    if (failed > 0) {
      const choice = await vscode.window.showWarningMessage(
        `Cupid: ${applied}/${hunks.length} hunks applied. ${failed} couldn't be matched.`,
        "Open Diff",
        "OK",
      );
      if (choice === "Open Diff") await openDiffPreview(targetEditor.document, patchBlock.content);
    }

    return `applied ${applied}/${hunks.length} hunks`;
  }

  // Case B: Replace mode with explicit path(s)
  const hasExplicitPaths = blocks.some((b) => b.inferredPath && b.mode === "replace");
  if (hasExplicitPaths && ws) {
    const results: string[] = [];
    for (const block of blocks) {
      if (!block.inferredPath) continue;
      const uri = vscode.Uri.joinPath(ws, block.inferredPath);
      const shortName = block.inferredPath.split("/").pop() ?? block.inferredPath;
      let existingContent = "";
      let fileExists = false;
      try {
        existingContent = new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
        fileExists = true;
      } catch { /* new file */ }

      const oldLines = fileExists ? existingContent.split("\n").length : 0;
      const newLines = block.content.split("\n").length;

      const choice = await vscode.window.showWarningMessage(
        fileExists
          ? `Cupid: Replace \`${shortName}\` (${oldLines} → ${newLines} lines)?`
          : `Cupid: Create \`${shortName}\` (${newLines} lines)?`,
        { modal: true },
        "Apply",
        "Diff",
        "Skip",
      );

      if (!choice || choice === "Skip") { results.push(`skipped ${shortName}`); continue; }

      if (choice === "Diff") {
        const proposedUri = vscode.Uri.parse(`untitled:${shortName}.proposed`);
        const we = new vscode.WorkspaceEdit();
        we.createFile(proposedUri, { overwrite: true });
        we.insert(proposedUri, new vscode.Position(0, 0), block.content);
        await vscode.workspace.applyEdit(we);
        await vscode.commands.executeCommand("vscode.diff", uri, proposedUri, `Cupid: ${shortName}`);
        results.push(`diff: ${shortName}`);
        continue;
      }

      await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(uri, ".."));
      await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(block.content));
      const opened = await vscode.window.showTextDocument(uri);
      showDiffDecorations(opened, existingContent, block.content);
      results.push(`${fileExists ? "replaced" : "created"} ${shortName}`);
    }
    return results.join(", ") || "no files changed";
  }

  // Case C: Multiple blocks or any with inferred paths → workspace files
  const hasPaths = blocks.some((b) => b.inferredPath);
  if (blocks.length > 1 || hasPaths) {
    if (!ws) return applyCodeBlocks(blocks, "newFile", userPrompt);
    let written = 0;
    let firstUri: vscode.Uri | null = null;
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i]!;
      const relPath = b.inferredPath ?? defaultFilename(b.language, i);
      const uri = vscode.Uri.joinPath(ws, relPath);
      try {
        await vscode.workspace.fs.stat(uri);
        const choice = await vscode.window.showWarningMessage(
          `Cupid: overwrite ${relPath}?`,
          { modal: true },
          "Overwrite",
          "Skip",
        );
        if (choice === undefined) break;
        if (choice === "Skip") continue;
      } catch { /* doesn't exist — write it */ }
      await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(uri, ".."));
      await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(b.content));
      if (!firstUri) firstUri = uri;
      written++;
    }
    if (firstUri) await vscode.window.showTextDocument(firstUri);
    return `wrote ${written} file${written !== 1 ? "s" : ""}`;
  }

  // Case D: Single block + active editor language matches → REPLACE with confirmation
  if (editor && langMatchesFile(blocks[0]!.language, editor.document.fileName)) {
    const block = blocks[0]!;
    const originalContent = editor.document.getText();
    const oldLines = originalContent.split("\n").length;
    const newLines = block.content.split("\n").length;
    const fileName = editor.document.fileName.split(/[/\\]/).pop()!;

    const choice = await vscode.window.showWarningMessage(
      `Cupid: Replace \`${fileName}\` (${oldLines} → ${newLines} lines, ${newLines - oldLines >= 0 ? "+" : ""}${newLines - oldLines} lines)?`,
      { modal: true },
      "Apply",
      "Diff",
      "Cancel",
    );

    if (!choice || choice === "Cancel") return "cancelled";
    if (choice === "Diff") {
      await openDiffPreview(editor.document, block.content);
      return "opened diff preview";
    }

    const full = new vscode.Range(
      editor.document.positionAt(0),
      editor.document.positionAt(editor.document.getText().length),
    );
    await editor.edit((eb) => eb.replace(full, block.content));
    showDiffDecorations(editor, originalContent, block.content);
    editor.selection = new vscode.Selection(0, 0, 0, 0);
    editor.revealRange(new vscode.Range(0, 0, 0, 0));
    return `replaced ${fileName} (${newLines} lines) — Ctrl+Z to undo`;
  }

  // Case E: Single block + deictic expression in user prompt → apply to active editor
  if (editor && userPrompt && hasDeiticExpression(userPrompt)) {
    const block = blocks[0]!;
    const originalContent = editor.document.getText();
    const fileName = editor.document.fileName.split(/[/\\]/).pop()!;
    const oldLines = originalContent.split("\n").length;
    const newLines = block.content.split("\n").length;

    const choice = await vscode.window.showWarningMessage(
      `Cupid: Apply to current file \`${fileName}\` (${oldLines} → ${newLines} lines)?`,
      { modal: true },
      "Apply",
      "Diff",
      "New File",
    );

    if (choice === "Apply") {
      const full = new vscode.Range(
        editor.document.positionAt(0),
        editor.document.positionAt(editor.document.getText().length),
      );
      await editor.edit((eb) => eb.replace(full, block.content));
      showDiffDecorations(editor, originalContent, block.content);
      return `replaced ${fileName} (${newLines} lines)`;
    }
    if (choice === "Diff") {
      await openDiffPreview(editor.document, block.content);
      return "opened diff preview";
    }
  }

  // Case F: Fallback → new untitled doc
  return applyCodeBlocks(blocks, "newFile", userPrompt);
}
