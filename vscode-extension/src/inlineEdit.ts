import * as vscode from "vscode";

const ghostDecType = vscode.window.createTextEditorDecorationType({
  after: {
    color: new vscode.ThemeColor("editorGhostText.foreground"),
    fontStyle: "italic",
  },
});

export class CupidInlineEdit {
  private static activeAbort: AbortController | undefined;

  static async trigger(context: vscode.ExtensionContext): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showInformationMessage("Cupid: open a file to use inline edit.");
      return;
    }

    // Cancel any previous inline edit
    CupidInlineEdit.activeAbort?.abort();

    const prompt = await vscode.window.showInputBox({
      title: "Cupid Inline Edit (Ctrl+K)",
      prompt: `Editing: ${editor.document.fileName.split(/[/\\]/).pop()}`,
      placeHolder: "e.g. rename this variable to count, add null check, convert to async…",
      ignoreFocusOut: true,
    });

    if (!prompt) return;

    const config = vscode.workspace.getConfiguration("cupid");
    const backendUrl = config.get<string>("backendUrl") ?? "http://localhost:3300";
    const userMode = config.get<string>("userMode") ?? "balanced";
    const routingMode = config.get<string>("routingMode") ?? "llm_assisted";

    const doc = editor.document;
    const selection = editor.selection;
    const selectedText = selection.isEmpty ? "" : doc.getText(selection);
    const fileContent = doc.getText();
    const fileName = doc.fileName.split(/[/\\]/).pop() ?? doc.fileName;
    const cursorLine = editor.selection.active.line;

    // Ghost text: "thinking..."
    setGhost(editor, cursorLine, " ⟳ Cupid thinking…");

    const abort = new AbortController();
    CupidInlineEdit.activeAbort = abort;

    let accumulated = "";

    try {
      const body: Record<string, unknown> = {
        prompt: selectedText
          ? `Inline edit request for ${fileName}. User says: "${prompt}"\n\nSelected code to modify:\n${selectedText}`
          : `Inline edit request for ${fileName}. User says: "${prompt}"\n\nFull file:\n${fileContent}`,
        userMode,
        routingMode,
        rawCode: selectedText || fileContent,
        fileName: doc.fileName,
      };

      const res = await fetch(`${backendUrl}/api/compare/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify(body),
        signal: abort.signal,
      });

      if (!res.ok || !res.body) {
        clearGhost(editor);
        vscode.window.showErrorMessage(`Cupid inline edit: backend ${res.status}`);
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
          if (!data || event !== "chunk") continue;
          try {
            const parsed = JSON.parse(data) as { text?: string };
            accumulated += parsed.text ?? "";
            const preview = accumulated.replace(/\n/g, "↩").slice(-80);
            setGhost(editor, cursorLine, ` ⟳ ${preview}`);
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") {
        clearGhost(editor);
        return;
      }
      clearGhost(editor);
      vscode.window.showErrorMessage(`Cupid inline edit: ${err instanceof Error ? err.message : String(err)}`);
      return;
    } finally {
      clearGhost(editor);
      CupidInlineEdit.activeAbort = undefined;
    }

    if (!accumulated) {
      vscode.window.showWarningMessage("Cupid: no response from backend.");
      return;
    }

    // Extract code block if present
    const codeBlockMatch = accumulated.match(/```[a-zA-Z0-9_+.-]*[^\n]*\n([\s\S]*?)```/);
    const newCode = codeBlockMatch ? codeBlockMatch[1]!.trimEnd() : accumulated.trim();

    // Show confirmation with option to view diff
    const targetDesc = selection.isEmpty ? `full ${fileName}` : `selected ${selection.end.line - selection.start.line + 1} lines`;
    const choice = await vscode.window.showInformationMessage(
      `Cupid: Apply inline edit to ${targetDesc}? (${newCode.split("\n").length} lines generated)`,
      { modal: false },
      "Apply",
      "Open Diff",
      "Cancel",
    );

    if (choice === "Apply") {
      const range = selection.isEmpty
        ? new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length))
        : selection;
      await editor.edit((eb) => eb.replace(range, newCode));
      vscode.window.setStatusBarMessage(`Cupid: inline edit applied (${newCode.split("\n").length} lines)`, 3000);
    } else if (choice === "Open Diff") {
      await openDiffPreview(doc, newCode);
    }
  }
}

function setGhost(editor: vscode.TextEditor, line: number, text: string): void {
  const lineLen = editor.document.lineAt(line).text.length;
  editor.setDecorations(ghostDecType, [{
    range: new vscode.Range(line, lineLen, line, lineLen),
    renderOptions: { after: { contentText: text } },
  }]);
}

function clearGhost(editor: vscode.TextEditor): void {
  editor.setDecorations(ghostDecType, []);
}

async function openDiffPreview(doc: vscode.TextDocument, newContent: string): Promise<void> {
  const proposed = vscode.Uri.parse(`untitled:${doc.uri.path}.cupid-inline`);
  const edit = new vscode.WorkspaceEdit();
  edit.createFile(proposed, { overwrite: true, ignoreIfExists: false });
  edit.insert(proposed, new vscode.Position(0, 0), newContent);
  await vscode.workspace.applyEdit(edit);
  await vscode.commands.executeCommand(
    "vscode.diff",
    doc.uri,
    proposed,
    `Cupid: ${doc.uri.path.split("/").pop()} ↔ inline edit`,
  );
}
