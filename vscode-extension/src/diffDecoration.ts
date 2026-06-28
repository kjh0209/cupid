import * as vscode from "vscode";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DiffState {
  originalText: string;
  proposedText: string;
  addedType: vscode.TextEditorDecorationType;
  removedType: vscode.TextEditorDecorationType;
  changedType: vscode.TextEditorDecorationType;
}

// keyed by document URI string
const activeDiffs = new Map<string, DiffState>();

// ── Line diff ─────────────────────────────────────────────────────────────────

interface LineDiff {
  addedRanges: vscode.Range[];    // lines in new doc that were added/changed
  removedLines: number[];          // line numbers in new doc where removals are annotated
}

function computeLineDiff(oldLines: string[], newLines: string[]): LineDiff {
  // Simple patience-like diff: find common lines, mark gaps as changed
  const addedRanges: vscode.Range[] = [];
  const removedLines: number[] = [];

  // Build LCS index for fast lookup
  const oldSet = new Map<string, number[]>();
  for (let i = 0; i < oldLines.length; i++) {
    const line = oldLines[i]!;
    const arr = oldSet.get(line) ?? [];
    arr.push(i);
    oldSet.set(line, arr);
  }

  let oldIdx = 0;
  let newIdx = 0;

  while (newIdx < newLines.length) {
    const newLine = newLines[newIdx]!;
    const candidates = oldSet.get(newLine);
    const matchOld = candidates?.find((c) => c >= oldIdx);

    if (matchOld !== undefined) {
      // Lines from oldIdx..matchOld-1 were removed; lines from start of new gap are added
      for (let r = oldIdx; r < matchOld; r++) {
        removedLines.push(newIdx);
      }
      oldIdx = matchOld + 1;
      newIdx++;
    } else {
      // This line is new/changed
      addedRanges.push(new vscode.Range(newIdx, 0, newIdx, newLines[newIdx]!.length));
      newIdx++;
    }
  }

  return { addedRanges, removedLines };
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Show diff decorations in the editor for proposed changes. */
export function showDiff(
  editor: vscode.TextEditor,
  originalText: string,
  proposedText: string,
): void {
  const key = editor.document.uri.toString();
  clearDiff(editor);

  const oldLines = originalText.split("\n");
  const newLines = proposedText.split("\n");
  const diff = computeLineDiff(oldLines, newLines);

  const addedType = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    backgroundColor: new vscode.ThemeColor("diffEditor.insertedLineBackground"),
    overviewRulerColor: new vscode.ThemeColor("editorOverviewRuler.addedForeground"),
    overviewRulerLane: vscode.OverviewRulerLane.Right,
  });

  const removedType = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    backgroundColor: new vscode.ThemeColor("diffEditor.removedLineBackground"),
    overviewRulerColor: new vscode.ThemeColor("editorOverviewRuler.deletedForeground"),
    overviewRulerLane: vscode.OverviewRulerLane.Right,
  });

  const changedType = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    after: {
      contentText: " ← Cupid proposed change",
      color: new vscode.ThemeColor("editorGhostText.foreground"),
      fontStyle: "italic",
      margin: "0 0 0 12px",
    },
  });

  editor.setDecorations(addedType, diff.addedRanges);

  // Removed lines annotation (shown as "ghost" marker at the target line)
  const removedRanges = [...new Set(diff.removedLines)].map(
    (l) => new vscode.Range(l, 0, l, 0),
  );
  editor.setDecorations(removedType, removedRanges);

  // Whole-change header annotation at line 0
  if (diff.addedRanges.length > 0 || diff.removedLines.length > 0) {
    editor.setDecorations(changedType, [new vscode.Range(0, 0, 0, 0)]);
  }

  activeDiffs.set(key, {
    originalText,
    proposedText,
    addedType,
    removedType,
    changedType,
  });
}

/** Clear diff decorations for this editor. */
export function clearDiff(editor: vscode.TextEditor): void {
  const key = editor.document.uri.toString();
  const state = activeDiffs.get(key);
  if (!state) return;
  state.addedType.dispose();
  state.removedType.dispose();
  state.changedType.dispose();
  activeDiffs.delete(key);
}

/** Accept the proposed change: replace editor content with proposedText. */
export async function acceptDiff(editor: vscode.TextEditor): Promise<void> {
  const key = editor.document.uri.toString();
  const state = activeDiffs.get(key);
  if (!state) {
    vscode.window.showInformationMessage("Cupid: no pending diff to accept");
    return;
  }

  const full = new vscode.Range(
    editor.document.positionAt(0),
    editor.document.positionAt(editor.document.getText().length),
  );
  await editor.edit((eb) => eb.replace(full, state.proposedText));
  clearDiff(editor);
  vscode.window.setStatusBarMessage("Cupid: changes accepted", 2000);
}

/** Reject the proposed change: restore original content. */
export async function rejectDiff(editor: vscode.TextEditor): Promise<void> {
  const key = editor.document.uri.toString();
  const state = activeDiffs.get(key);
  if (!state) {
    vscode.window.showInformationMessage("Cupid: no pending diff to reject");
    return;
  }

  const full = new vscode.Range(
    editor.document.positionAt(0),
    editor.document.positionAt(editor.document.getText().length),
  );
  await editor.edit((eb) => eb.replace(full, state.originalText));
  clearDiff(editor);
  vscode.window.setStatusBarMessage("Cupid: changes rejected", 2000);
}

/** Returns true if the given editor has an active diff. */
export function hasDiff(editor: vscode.TextEditor): boolean {
  return activeDiffs.has(editor.document.uri.toString());
}

/** Register CodeLens provider for accept/reject at the top of documents with active diffs. */
export function registerDiffCodeLens(context: vscode.ExtensionContext): void {
  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand("cupid.acceptChanges", async () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) await acceptDiff(editor);
    }),
    vscode.commands.registerCommand("cupid.rejectChanges", async () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) await rejectDiff(editor);
    }),
  );

  // CodeLens provider
  const provider: vscode.CodeLensProvider = {
    provideCodeLenses(document) {
      if (!activeDiffs.has(document.uri.toString())) return [];
      const topRange = new vscode.Range(0, 0, 0, 0);
      return [
        new vscode.CodeLens(topRange, {
          title: "$(check) Accept Cupid changes",
          command: "cupid.acceptChanges",
        }),
        new vscode.CodeLens(topRange, {
          title: "$(x) Reject Cupid changes",
          command: "cupid.rejectChanges",
        }),
      ];
    },
  };

  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider({ pattern: "**/*" }, provider),
  );
}
