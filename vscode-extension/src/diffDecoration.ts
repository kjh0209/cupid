import * as vscode from "vscode";

const addedDecType = vscode.window.createTextEditorDecorationType({
  backgroundColor: "rgba(46, 160, 67, 0.15)",
  isWholeLine: true,
  overviewRulerColor: "rgba(46, 160, 67, 0.7)",
  overviewRulerLane: vscode.OverviewRulerLane.Left,
  borderLeft: "2px solid rgba(46, 160, 67, 0.8)",
});

const removedDecType = vscode.window.createTextEditorDecorationType({
  backgroundColor: "rgba(248, 81, 73, 0.1)",
  isWholeLine: true,
  overviewRulerColor: "rgba(248, 81, 73, 0.7)",
  overviewRulerLane: vscode.OverviewRulerLane.Left,
  textDecoration: "line-through rgba(248, 81, 73, 0.5)",
  borderLeft: "2px solid rgba(248, 81, 73, 0.8)",
});

// Pending changes per document URI: original content before apply
const pendingChanges = new Map<string, string>();

/** Show green highlights on lines that differ from originalContent in the editor. */
export function showDiffDecorations(
  editor: vscode.TextEditor,
  originalContent: string,
  proposedContent: string,
): void {
  const uri = editor.document.uri.toString();
  pendingChanges.set(uri, originalContent);

  const origLines = originalContent.split("\n");
  const newLines = proposedContent.split("\n");

  // LCS-based line diff to find added ranges
  const origSet = new Set(origLines.map((l) => l.trim()).filter(Boolean));
  const addedRanges: vscode.Range[] = [];

  const lineCount = editor.document.lineCount;
  for (let i = 0; i < Math.min(newLines.length, lineCount); i++) {
    const trimmed = (newLines[i] ?? "").trim();
    if (trimmed && !origSet.has(trimmed)) {
      addedRanges.push(new vscode.Range(i, 0, i, (newLines[i] ?? "").length));
    }
  }

  editor.setDecorations(addedDecType, addedRanges);
  editor.setDecorations(removedDecType, []);

  // Status bar hint
  vscode.window.setStatusBarMessage(
    `Cupid: ${addedRanges.length} changed lines — Accept ($(check)) or Reject ($(x))`,
    8000,
  );
}

export function clearDiffDecorations(editor: vscode.TextEditor): void {
  editor.setDecorations(addedDecType, []);
  editor.setDecorations(removedDecType, []);
  pendingChanges.delete(editor.document.uri.toString());
}

export function hasPendingChange(uri: string): boolean {
  return pendingChanges.has(uri);
}

export function getPendingOriginal(uri: string): string | undefined {
  return pendingChanges.get(uri);
}

export function registerDiffCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("cupid.acceptChanges", () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      clearDiffDecorations(editor);
      vscode.window.setStatusBarMessage("Cupid: changes accepted ✓", 2000);
    }),

    vscode.commands.registerCommand("cupid.rejectChanges", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      const original = pendingChanges.get(editor.document.uri.toString());
      if (original === undefined) {
        vscode.window.showInformationMessage("Cupid: no pending changes to reject.");
        return;
      }
      const full = new vscode.Range(
        editor.document.positionAt(0),
        editor.document.positionAt(editor.document.getText().length),
      );
      await editor.edit((eb) => eb.replace(full, original));
      clearDiffDecorations(editor);
      vscode.window.setStatusBarMessage("Cupid: changes rejected ✗", 2000);
    }),
  );
}
