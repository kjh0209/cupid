import * as vscode from "vscode";

// ── Types ────────────────────────────────────────────────────────────────────

export interface FenceBlock {
  language: string;
  path?: string;
  mode: "replace" | "patch" | "new";
  content: string;
  rawFenceInfo: string;
}

export interface SearchReplaceHunk {
  search: string;
  replace: string;
}

/** Backwards-compat type used by chatView */
export interface CodeBlock {
  language: string;
  inferredPath?: string;
  content: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

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

// Korean + English deictic expressions meaning "this file / current file"
const DEICTIC_RE = /\b(this file|here|current file|the file|이 파일|현재 파일|여기|지금 파일)\b/i;

// ── Parsing ───────────────────────────────────────────────────────────────────

/**
 * Parse fenced code blocks, extracting path= and mode= attributes from fence info.
 * Handles both EDIT MODE protocol blocks and plain fenced blocks.
 */
export function parseFenceBlocks(text: string): FenceBlock[] {
  const blocks: FenceBlock[] = [];
  const re = /```([a-zA-Z0-9_+.-]*)([ \t][^\n]*)?\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const lang = (m[1] ?? "").trim();
    const rawFenceInfo = (m[2] ?? "").trim();
    const content = m[3] ?? "";

    // Extract path= and mode= from fence info
    const pathMatch = rawFenceInfo.match(/path=([^\s]+)/);
    const modeMatch = rawFenceInfo.match(/mode=(replace|patch)/);

    let path = pathMatch?.[1];
    let mode: FenceBlock["mode"] = (modeMatch?.[1] as "replace" | "patch") ?? "new";

    // Fallback: bare path in fence info (e.g., ```ts src/foo.ts)
    if (!path) {
      const bare = rawFenceInfo.replace(/mode=\S+/g, "").trim();
      if (bare && /[./\\]/.test(bare) && !/\s/.test(bare)) {
        path = bare;
      }
    }

    // Fallback: path from first-line comment (// path/to/file.ts)
    if (!path && content) {
      const firstLine = content.split("\n")[0]?.trim() ?? "";
      const commentMatch = firstLine.match(/^(?:\/\/|#|--|<!--)\s*(?:File:\s*)?([\w./\\-]+\.[a-zA-Z0-9]+)/);
      if (commentMatch?.[1]) {
        path = commentMatch[1];
      }
    }

    // Auto-detect patch mode from SEARCH/REPLACE markers
    if (content.includes("<<<<<<< SEARCH") && content.includes(">>>>>>> REPLACE")) {
      mode = "patch";
    }

    blocks.push({ language: lang, path, mode, content, rawFenceInfo });
  }
  return blocks;
}

/** Parse SEARCH/REPLACE hunks from a patch block's content. */
export function parseSearchReplaceHunks(content: string): SearchReplaceHunk[] {
  const hunks: SearchReplaceHunk[] = [];
  const re = /<<<<<<< SEARCH\r?\n([\s\S]*?)=======\r?\n([\s\S]*?)>>>>>>> REPLACE/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    hunks.push({ search: m[1] ?? "", replace: m[2] ?? "" });
  }
  return hunks;
}

/** Legacy compat: extract code blocks in the old format */
export function extractCodeBlocks(text: string): CodeBlock[] {
  return parseFenceBlocks(text).map((b) => ({
    language: b.language,
    inferredPath: b.path,
    content: b.content,
  }));
}

// ── Fuzzy matching ────────────────────────────────────────────────────────────

/**
 * Find `search` string within `text`.
 * First tries exact match, then trimmed-line match (ignores trailing whitespace differences).
 */
function fuzzyFind(text: string, search: string): { start: number; end: number } | null {
  // Exact match
  const exact = text.indexOf(search);
  if (exact !== -1) return { start: exact, end: exact + search.length };

  // Trimmed-line match
  const searchLines = search.split("\n").map((l) => l.trimEnd());
  const textLines = text.split("\n");

  for (let i = 0; i <= textLines.length - searchLines.length; i++) {
    let match = true;
    for (let j = 0; j < searchLines.length; j++) {
      if ((textLines[i + j] ?? "").trimEnd() !== searchLines[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      const startLineOffset = textLines.slice(0, i).join("\n").length + (i > 0 ? 1 : 0);
      const matchedChunk = textLines.slice(i, i + searchLines.length).join("\n");
      return { start: startLineOffset, end: startLineOffset + matchedChunk.length };
    }
  }
  return null;
}

/** Apply SEARCH/REPLACE hunks to `originalText`. Returns patched text and list of failed hunks. */
function applyPatchToText(
  originalText: string,
  hunks: SearchReplaceHunk[],
): { result: string; failed: SearchReplaceHunk[] } {
  let text = originalText;
  const failed: SearchReplaceHunk[] = [];

  for (const hunk of hunks) {
    const found = fuzzyFind(text, hunk.search);
    if (found) {
      text = text.slice(0, found.start) + hunk.replace + text.slice(found.end);
    } else {
      failed.push(hunk);
    }
  }
  return { result: text, failed };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function langMatchesFile(lang: string, fileName: string): boolean {
  const ext = LANG_TO_EXT[lang.toLowerCase()] ?? "";
  if (!ext) return true; // unknown lang — don't block
  return fileName.toLowerCase().endsWith("." + ext);
}

function defaultFilename(lang: string, idx: number): string {
  const ext = LANG_TO_EXT[lang.toLowerCase()] ?? "txt";
  return idx === 0 ? `cupid.${ext}` : `cupid-${idx + 1}.${ext}`;
}

async function writeFileToWorkspace(uri: vscode.Uri, content: string): Promise<void> {
  // Ensure parent directory exists
  const parentUri = vscode.Uri.joinPath(uri, "..");
  try { await vscode.workspace.fs.createDirectory(parentUri); } catch { /* may exist */ }
  await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(content));
}

async function openDiffPreview(doc: vscode.TextDocument, newContent: string): Promise<void> {
  const proposedUri = vscode.Uri.parse(`untitled:${doc.uri.path}.cupid-proposed`);
  const edit = new vscode.WorkspaceEdit();
  edit.createFile(proposedUri, { overwrite: true, ignoreIfExists: false });
  edit.insert(proposedUri, new vscode.Position(0, 0), newContent);
  await vscode.workspace.applyEdit(edit);
  await vscode.commands.executeCommand(
    "vscode.diff",
    doc.uri,
    proposedUri,
    `Cupid: ${doc.uri.path.split("/").pop()} ↔ proposed`,
  );
}

// ── Main apply function ───────────────────────────────────────────────────────

/**
 * Apply parsed fence blocks to workspace files.
 *
 * Logic (auto mode):
 *   1. Blocks with explicit `path=` → write/patch those files.
 *   2. Single block, no path, active editor language matches → replace active editor content.
 *   3. Fallback → new untitled document(s).
 *
 * Modes:
 *   - replace: full file content replacement.
 *   - patch: SEARCH/REPLACE hunks applied to existing content.
 *   - new: create untitled document.
 */
export async function applyFenceBlocks(
  blocks: FenceBlock[],
  userPrompt: string,
  mode: "auto" | "newFile" | "insert" | "diff",
): Promise<string> {
  if (blocks.length === 0) return "no code blocks found";

  const editor = vscode.window.activeTextEditor;
  const ws = vscode.workspace.workspaceFolders?.[0]?.uri;

  // ── Explicit override modes ───────────────────────────────────────────────
  if (mode === "insert") {
    if (!editor) return applyFenceBlocks(blocks, userPrompt, "newFile");
    const block = blocks[0]!;
    await editor.edit((eb) => eb.insert(editor.selection.active, block.content));
    return `inserted ${block.content.split("\n").length} lines at cursor`;
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
    return `created ${created} new doc${created > 1 ? "s" : ""}`;
  }

  if (mode === "diff") {
    if (!editor) return applyFenceBlocks(blocks, userPrompt, "newFile");
    await openDiffPreview(editor.document, blocks[0]!.content);
    return "opened diff preview — review and apply";
  }

  // ── mode === "auto" ───────────────────────────────────────────────────────

  // Case 1: blocks with explicit path= → write to workspace
  const pathBlocks = blocks.filter((b) => b.path);
  if (pathBlocks.length > 0) {
    if (!ws) return applyFenceBlocks(blocks, userPrompt, "newFile");

    const fileList = pathBlocks.map((b) => b.path!).join(", ");
    const confirm = await vscode.window.showInformationMessage(
      `Cupid: Apply changes to ${fileList}?`,
      { modal: true },
      "Apply", "Cancel",
    );
    if (confirm !== "Apply") return "cancelled";

    const results: string[] = [];
    let firstUri: vscode.Uri | null = null;

    for (const block of pathBlocks) {
      const uri = vscode.Uri.joinPath(ws, block.path!);
      if (!firstUri) firstUri = uri;

      if (block.mode === "patch") {
        const hunks = parseSearchReplaceHunks(block.content);

        if (hunks.length === 0) {
          // patch mode but no SEARCH/REPLACE markers → treat as replace
          await writeFileToWorkspace(uri, block.content);
          results.push(`replaced ${block.path}`);
          continue;
        }

        let originalText = "";
        try {
          originalText = new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
        } catch { /* new file */ }

        const { result, failed } = applyPatchToText(originalText, hunks);

        if (failed.length > 0) {
          const choice = await vscode.window.showWarningMessage(
            `Cupid: ${failed.length} hunk(s) couldn't be matched in ${block.path}. Open diff editor?`,
            "Open Diff", "Skip",
          );
          if (choice === "Open Diff") {
            let doc: vscode.TextDocument;
            try {
              doc = await vscode.workspace.openTextDocument(uri);
            } catch {
              doc = await vscode.workspace.openTextDocument({ content: originalText });
            }
            await openDiffPreview(doc, result);
          }
          continue;
        }

        await writeFileToWorkspace(uri, result);
        results.push(`patched ${block.path} (${hunks.length} hunk${hunks.length > 1 ? "s" : ""})`);
      } else {
        // replace or new → full file write
        await writeFileToWorkspace(uri, block.content);
        results.push(`${block.mode === "replace" ? "replaced" : "created"} ${block.path}`);
      }
    }

    if (firstUri) {
      try { await vscode.window.showTextDocument(firstUri); } catch { /* ignore */ }
    }
    return results.join(", ") || "no changes applied";
  }

  // Case 2: multiple path-less blocks → new files
  if (blocks.length > 1) {
    return applyFenceBlocks(blocks, userPrompt, "newFile");
  }

  // Case 3: single block, no explicit path
  const block = blocks[0]!;

  if (editor) {
    const fileName = editor.document.fileName;
    const isDeicticRef = DEICTIC_RE.test(userPrompt);
    const langMatches = langMatchesFile(block.language, fileName);

    // SEARCH/REPLACE patch against active file
    if (block.mode === "patch") {
      const hunks = parseSearchReplaceHunks(block.content);
      if (hunks.length > 0) {
        const originalText = editor.document.getText();
        const { result, failed } = applyPatchToText(originalText, hunks);

        if (failed.length > 0) {
          const choice = await vscode.window.showWarningMessage(
            `Cupid: ${failed.length} hunk(s) couldn't be matched. Open diff view?`,
            "Open Diff", "Cancel",
          );
          if (choice === "Open Diff") await openDiffPreview(editor.document, result);
          return "patch failed — opened diff view";
        }

        const baseName = fileName.split(/[/\\]/).pop() ?? fileName;
        const confirm = await vscode.window.showInformationMessage(
          `Cupid: Apply ${hunks.length} patch hunk(s) to \`${baseName}\`?`,
          { modal: true },
          "Apply", "Cancel",
        );
        if (confirm !== "Apply") return "cancelled";

        const full = new vscode.Range(
          editor.document.positionAt(0),
          editor.document.positionAt(editor.document.getText().length),
        );
        await editor.edit((eb) => eb.replace(full, result));
        editor.selection = new vscode.Selection(0, 0, 0, 0);
        return `patched ${baseName} (${hunks.length} hunk${hunks.length > 1 ? "s" : ""})`;
      }
    }

    // Full replace against active file (deictic reference or language match)
    if (isDeicticRef || langMatches) {
      const baseName = fileName.split(/[/\\]/).pop() ?? fileName;
      const currentLines = editor.document.getText().split("\n").length;
      const newLines = block.content.split("\n").length;

      const confirm = await vscode.window.showInformationMessage(
        `Cupid: Replace \`${baseName}\` (${currentLines} → ${newLines} lines)?`,
        { modal: true },
        "Replace", "Diff first", "Cancel",
      );
      if (confirm === "Cancel" || confirm === undefined) return "cancelled";
      if (confirm === "Diff first") {
        await openDiffPreview(editor.document, block.content);
        return "opened diff preview";
      }

      const full = new vscode.Range(
        editor.document.positionAt(0),
        editor.document.positionAt(editor.document.getText().length),
      );
      await editor.edit((eb) => eb.replace(full, block.content));
      editor.selection = new vscode.Selection(0, 0, 0, 0);
      editor.revealRange(new vscode.Range(0, 0, 0, 0));
      return `replaced ${baseName} (${newLines} lines) — Ctrl+Z to undo`;
    }
  }

  // Case 4: fallback — new untitled document
  return applyFenceBlocks(blocks, userPrompt, "newFile");
}

/**
 * Legacy wrapper kept for backwards compatibility with chatView.ts.
 * Converts old CodeBlock[] to FenceBlock[] and delegates.
 */
export async function applyCodeBlocks(
  blocks: CodeBlock[],
  mode: "auto" | "newFile" | "insert" | "diff",
  userPrompt = "",
): Promise<string> {
  const fenceBlocks: FenceBlock[] = blocks.map((b) => ({
    language: b.language,
    path: b.inferredPath,
    mode: b.inferredPath ? ("replace" as const) : ("new" as const),
    content: b.content,
    rawFenceInfo: b.inferredPath ? `path=${b.inferredPath} mode=replace` : "",
  }));
  return applyFenceBlocks(fenceBlocks, userPrompt, mode);
}
