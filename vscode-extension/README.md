# Cupid AI Router — VS Code Extension v0.3.0

Cursor-style AI chat panel with intelligent multi-model routing. Analyzes your prompt and automatically selects the best model (GPT-4o-mini, Claude Sonnet, Gemini) — saving 90%+ cost vs always using the most powerful model.

---

## Quick Start

1. **Start the backend** in the repo root:
   ```bash
   pnpm dev
   ```
   The backend runs on `http://localhost:3300` by default.

2. **Install the extension** (local build):
   ```bash
   cd vscode-extension
   npm install
   npm run package          # produces cupid-ai-router-0.3.0.vsix
   code --install-extension cupid-ai-router-0.3.0.vsix
   ```

3. **Open VS Code** — the Cupid icon appears in the Activity Bar. Click it to open the chat panel.

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+K` / `Cmd+Shift+K` | Open Cupid chat panel |
| `Ctrl+Shift+L` / `Cmd+Shift+L` | Ask about selected code |
| `Ctrl+K` / `Cmd+K` (in editor) | Inline edit at cursor |
| `Enter` | Send message |
| `Shift+Enter` | New line in input |

---

## Chat Panel Features

### Markdown Rendering
Responses are fully rendered with headings, bold, italic, lists, inline code, links, and blockquotes.

### Syntax Highlighting
Code blocks show syntax highlighting for JS/TS/Python/Go/Rust/Java/C/C++ using VS Code's theme colors.

### Code Block Actions
Each code block has **Copy**, **Apply**, and **Diff** buttons (visible on hover):
- **Apply** — writes the code to the file specified by `path=` attribute, or replaces the active editor if the language matches
- **Diff** — opens a side-by-side diff before applying
- **Copy** — copies just the code content

### Apply Modes (bottom of each message)
- **Apply all** — apply all code blocks, auto-routing to the right files
- **Diff** — open diff preview first
- **New file** — always create new untitled documents
- **Insert at cursor** — insert first code block at cursor position
- **Copy all** — copy full response text

### @ File Mention
Type `@` in the input field to search workspace files. Select a file to attach it as context — its content will be included in the prompt automatically.

### Stop Button
Appears during streaming. Click to abort the current response.

---

## Inline Edit (Ctrl+K)

1. Position cursor in any editor file (optionally select code)
2. Press `Ctrl+K` (macOS: `Cmd+K`)
3. Type your edit instruction in the input box
4. Response streams in; diff decorations appear in the editor
5. A dialog asks "Accept" or "Reject"
6. **Accept**: proposed code replaces the original
7. **Reject**: original code is restored

---

## Apply Protocol — How Code Gets Applied

The extension uses a structured **EDIT MODE protocol** to ensure reliable code application:

**Full file replacement** (preferred for files < 400 lines):
````
```ts path=src/foo.ts mode=replace
// entire file here
```
````

**Search/replace patch** (for targeted changes):
````
```ts path=src/foo.ts mode=patch
<<<<<<< SEARCH
// exact lines to find
=======
// replacement lines
>>>>>>> REPLACE
```
````

When a response contains `path=` attributes, Apply writes directly to those files with a confirmation dialog. Without `path=`, Apply infers intent from language matching and your prompt phrasing.

---

## Status Bar

The Cupid status bar item (bottom-right) shows the current state:

| Display | Meaning |
|---------|---------|
| `🤖 Cupid` | Idle, backend connected |
| `⟳ Cupid · routing…` | Classifying task, selecting model |
| `⟳ Cupid · streaming…` | Response streaming |
| `⚠ Cupid · backend offline` | Cannot reach backend — click to configure |

---

## Settings

Open with `Ctrl+,` and search for "Cupid":

| Setting | Default | Description |
|---------|---------|-------------|
| `cupid.backendUrl` | `http://localhost:3300` | Backend server URL. Run `pnpm dev` in the cupid folder. |
| `cupid.userMode` | `balanced` | `cost_saving` / `balanced` / `max_quality` |
| `cupid.routingMode` | `llm_assisted` | `rule_based` (fast) or `llm_assisted` (smarter) |
| `cupid.autoMoveToRight` | `true` | Auto-move panel to Secondary Side Bar on first launch |

---

## Diff Decorations (after Apply)

After applying changes, the editor shows:
- **Green lines** — added/changed lines
- **Red indicators** — lines that were removed
- **CodeLens at top of file**: `✓ Accept Cupid changes` / `✗ Reject Cupid changes`

Click Accept to commit the changes, or Reject to restore the original.

---

## Troubleshooting

**Backend offline indicator** → Run `pnpm dev` in the repo root. Check `cupid.backendUrl` in settings.

**Apply creates wrong file** → Make sure the LLM response includes `path=filename mode=replace` in the code fence. You can re-send with "include file" checkbox enabled — this injects the active file's content into the prompt, guiding the model to use the correct path.

**Ctrl+K not working** → The keybinding only fires when the editor has text focus (`when: editorTextFocus`). Click inside a code file first.

**Syntax highlighting looks wrong** → Syntax highlighting is regex-based (no language server). It works best for JS/TS/Python. Other languages fall back to plain text.
