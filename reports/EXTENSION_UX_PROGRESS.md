# EXTENSION UX PROGRESS — Cupid v0.3.0

## Status: v0.3.0 Complete

This report documents the UX redesign of the Cupid VS Code Extension to be competitive with Cursor and Antigravity.

---

## Before (v0.2.0)

- Activity bar sidebar (LEFT panel only — not Cursor-style)
- Only ONE concurrent stream — new request aborts previous
- Basic HTML rendering: no markdown, no syntax highlighting
- `Apply` created new Untitled file instead of replacing active editor
- No `path=` / `mode=` parsing in code fences
- No SEARCH/REPLACE hunk support
- No confirmation dialog before applying
- No inline edit (Ctrl+K)
- No diff decorations after applying
- No @ file mentions
- No file attachment chips
- Status bar: simple, no state machine
- Empty state: plain text only

## After (v0.3.0)

### 1. Right Panel / Secondary Sidebar (Cursor-style)
- Auto-move on first activation to the Secondary Side Bar (right panel)
- `cupid.moveToRight` command with proper fallback instructions
- `autoMoveToRight` setting (default: true)
- Uses `workbench.action.focusAuxiliaryBar` to ensure visibility

### 2. Background Tasks (Multiple Concurrent Streams)
- Multiple requests can run simultaneously without cancellation
- Active task counter badge in toolbar: "2 active"
- Global Stop All button appears when tasks are running
- Per-message Stop button during streaming
- Status bar reflects all active streams

### 3. Chat UI — Cursor-grade Redesign (`media/chat.html`)
- **Markdown rendering**: headers (h1-h3), bold, italic, inline code, lists, blockquotes, links, horizontal rules
- **Syntax highlighting**: character-level tokenizer for JS/TS/TSX/JSX, Python, Go, Rust, Shell
- **Code block headers**: language tag + path (from `path=` fence info) + mode badge + line count
- **Per-block actions**: Copy / Apply / Diff buttons on hover (top-right corner)
- **Routing badges**: model name, task type, cost, savings percentage, CPL count — with fade-in animation
- **Streaming dots**: 3-dot pulse animation while generating
- **Stop button per message**: stop just that stream, not everything
- **@ file mention**: type `@` to open fuzzy file search dropdown; select to attach as context chip
- **Attachment chips**: show attached files above input; removable with ×
- **Backend status dot**: green/red with tooltip
- **Backend offline banner**: shows `pnpm dev` hint when disconnected
- **Empty state**: logo, description, 3 clickable example prompts, keyboard shortcuts
- **VS Code theme**: 100% CSS variable usage, no hardcoded colors

### 4. Apply Logic — Intent Inference (`src/apply.ts`)
- Parse `path=src/foo.ts mode=replace` from fence info
- SEARCH/REPLACE hunk detection (`<<<<<<< SEARCH … ======= … >>>>>>> REPLACE`)
- Fuzzy matching for SEARCH blocks (trimmed line comparison)
- Deictic expression detection ("이 파일", "here", "this file", "현재 파일", etc.)
- **Confirmation modal** before every apply: `Replace 'game.js' (45 → 47 lines)?`
- `Apply` / `Diff` / `Cancel` / `Skip` options per file
- Side-by-side diff preview via `vscode.diff`
- Transactional: all-or-nothing for multi-block applies

### 5. Diff Decoration (`src/diffDecoration.ts`)
- Green background + left border for added/changed lines after Apply
- `cupid.acceptChanges` (Ctrl+Shift+Y): clear decorations
- `cupid.rejectChanges` (Ctrl+Shift+N): restore original content + clear decorations
- Overview ruler markers

### 6. Inline Edit — Ctrl+K (`src/inlineEdit.ts`)
- `Ctrl+K` opens InputBox with file name as context
- Streams response from backend
- Ghost text at cursor line shows streaming progress
- After response: `Apply` / `Open Diff` / `Cancel` choice
- Works on selected text or full file

### 7. Status Bar State Machine (`src/extension.ts`)
- `$(robot) Cupid · gpt-4o-mini · $0.0012` — idle with last model + cost
- `$(sync~spin) Cupid · routing…` — while routing
- `$(sync~spin) Cupid · streaming…` — while generating
- `$(warning) Cupid · backend offline` — error state (red background), click to configure
- 30-second health monitor auto-recovers

### 8. Keybindings
| Key | Action |
|-----|--------|
| Ctrl+Shift+K | Open chat |
| Ctrl+Shift+L | Ask about selection |
| Ctrl+K | Inline edit |
| Ctrl+Shift+Y | Accept changes |
| Ctrl+Shift+N | Reject changes |
| Ctrl+Shift+. | Stop all streams |

---

## VS Code API Constraints (documented)

1. **Inline InputBox position**: VS Code does not support positioning an InputBox at a specific editor cursor position. Ctrl+K uses `showInputBox()` which appears at the top of the editor. Ghost text is shown at the cursor line via decoration.

2. **Per-hunk Accept/Reject**: Full LCS diff and per-hunk decoration requires a diff library. v0.3.0 implements per-file accept/reject. Per-hunk to follow in v0.4.0.

3. **Secondary Sidebar registration**: VS Code package.json does not support directly registering views in `secondarySidebar` without activity bar entry. We use programmatic moveView at activation time.

---

## Build Instructions

```bash
cd vscode-extension
npm install
npm run compile    # TypeScript → out/
npm run package    # vsce package → cupid-ai-router-0.3.0.vsix
code --install-extension cupid-ai-router-0.3.0.vsix
```

---

## LLM Cost Log (this task: UI work only)

| Timestamp | Provider | Purpose | Cost |
|-----------|----------|---------|------|
| (no LLM calls made during UI code changes) | — | — | $0.00 |
