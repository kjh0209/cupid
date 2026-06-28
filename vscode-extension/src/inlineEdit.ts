import * as vscode from "vscode";
import { parseFenceBlocks } from "./apply.js";
import { showDiff } from "./diffDecoration.js";

export type StatusCallback = (state: "idle" | "routing" | "streaming") => void;

// ── Session state ─────────────────────────────────────────────────────────────

interface InlineSession {
  editor: vscode.TextEditor;
  selectionRange: vscode.Range;
  ghostDecoration: vscode.TextEditorDecorationType;
  abortController: AbortController;
}

let activeSession: InlineSession | undefined;

// ── Registration ──────────────────────────────────────────────────────────────

export function registerInlineEdit(
  context: vscode.ExtensionContext,
  onStatus: StatusCallback,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("cupid.inlineEdit", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        void vscode.window.showInformationMessage("Cupid: open a file to use inline edit (Ctrl+K)");
        return;
      }

      // Abort any in-progress session
      if (activeSession) {
        activeSession.abortController.abort();
        activeSession.ghostDecoration.dispose();
        activeSession = undefined;
        onStatus("idle");
        return;
      }

      const selection = editor.selection;
      const selectionText = selection.isEmpty ? "" : editor.document.getText(selection);
      const cursorLine = selection.isEmpty ? selection.active.line : selection.end.line;
      const fileName = editor.document.fileName.split(/[/\\]/).pop() ?? editor.document.fileName;

      // Prompt input (VS Code limitation: InputBox appears at top, not inline)
      const promptText = await vscode.window.showInputBox({
        prompt: selectionText
          ? `Cupid inline edit — selection (${selectionText.split("\n").length} lines)`
          : `Cupid inline edit — ${fileName}`,
        placeHolder: "Describe the change… e.g. rename x to count, add null check, extract function",
        ignoreFocusOut: true,
      });
      if (!promptText) return;

      // Create ghost text decoration on the current line
      const ghostDecoration = vscode.window.createTextEditorDecorationType({
        after: {
          contentText: "  ⟳ Cupid generating…",
          color: new vscode.ThemeColor("editorGhostText.foreground"),
          fontStyle: "italic",
        },
      });
      editor.setDecorations(ghostDecoration, [
        { range: new vscode.Range(cursorLine, 0, cursorLine, 0) },
      ]);

      const abortController = new AbortController();
      activeSession = { editor, selectionRange: selection, ghostDecoration, abortController };

      const config = vscode.workspace.getConfiguration("cupid");
      const backendUrl = config.get<string>("backendUrl") ?? "http://localhost:3300";
      const userMode = config.get<string>("userMode") ?? "balanced";
      const routingMode = config.get<string>("routingMode") ?? "llm_assisted";
      const rawCode = selectionText || editor.document.getText();

      onStatus("routing");

      try {
        const res = await fetch(`${backendUrl}/api/compare/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
          body: JSON.stringify({
            prompt: promptText,
            userMode,
            routingMode,
            rawCode,
            fileName: editor.document.fileName,
            useCpl: false,
            extractCpl: false,
          }),
          signal: abortController.signal,
        });

        if (!res.ok || !res.body) {
          void vscode.window.showErrorMessage(`Cupid inline edit: backend error ${res.status}`);
          cleanup(onStatus);
          return;
        }

        onStatus("streaming");
        let collected = "";
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
            if (!data) continue;
            try {
              const parsed = JSON.parse(data) as Record<string, unknown>;
              if (event === "chunk" && typeof parsed["text"] === "string") {
                collected += parsed["text"];
              }
            } catch { /* skip */ }
          }
        }

        // Parse the collected response for code blocks
        const fenceBlocks = parseFenceBlocks(collected);
        const codeContent = fenceBlocks.length > 0 ? fenceBlocks[0]!.content : collected.trim();

        if (!codeContent) {
          void vscode.window.showInformationMessage("Cupid: no code change generated");
          cleanup(onStatus);
          return;
        }

        // Clean up ghost text before showing diff
        ghostDecoration.dispose();

        // Show diff in editor (accept/reject via CodeLens)
        const originalText = editor.document.getText();
        let proposedText: string;

        if (selectionText && !selection.isEmpty) {
          // Replace just the selection
          const beforeSel = originalText.slice(0, editor.document.offsetAt(selection.start));
          const afterSel = originalText.slice(editor.document.offsetAt(selection.end));
          proposedText = beforeSel + codeContent + afterSel;
        } else {
          proposedText = codeContent;
        }

        showDiff(editor, originalText, proposedText);

        // Notify user
        const choice = await vscode.window.showInformationMessage(
          `Cupid inline edit ready — accept or reject?`,
          "Accept", "Reject",
        );
        if (choice === "Accept") {
          await vscode.commands.executeCommand("cupid.acceptChanges");
        } else {
          await vscode.commands.executeCommand("cupid.rejectChanges");
        }
      } catch (err) {
        if ((err as { name?: string })?.name !== "AbortError") {
          void vscode.window.showErrorMessage(
            `Cupid inline edit failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      } finally {
        cleanup(onStatus);
      }
    }),
  );
}

function cleanup(onStatus: StatusCallback) {
  if (activeSession) {
    activeSession.ghostDecoration.dispose();
    activeSession = undefined;
  }
  onStatus("idle");
}
