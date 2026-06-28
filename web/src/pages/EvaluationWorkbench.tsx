import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Editor from "@monaco-editor/react";
import { api } from "../api/client";
import type {
  Workspace,
  WorkspaceFileMeta,
  WorkspaceFile,
  CompareResult,
  PipelineResult,
  MultiChatResult,
} from "../api/client";
import { useAuth } from "../auth/AuthContext";
import SandboxRunner from "../components/SandboxRunner";

// ──────────────────────────────────────────────────────────────────────
// Online IDE Workbench (replaces the old preset-repo workbench)
//
// Persistence:
//   - Identity: HTTP-only cookie (cupid_ide_session)
//   - File contents: SQLite (server-side) — survives device changes
//   - UI state (open tabs, active file, right-panel tab): localStorage
//     keyed by workspace id — survives refresh and cross-tab navigation
// ──────────────────────────────────────────────────────────────────────

const RIGHT_TABS = ["compare", "pipeline", "sandbox", "chat"] as const;
type RightTab = (typeof RIGHT_TABS)[number];

const MULTICHAT_MODELS = [
  { id: "openai/gpt-4o-mini",            label: "GPT-4o mini" },
  { id: "openai/gpt-4o",                 label: "GPT-4o" },
  { id: "anthropic/claude-haiku-4-5",    label: "Claude Haiku 4.5" },
  { id: "anthropic/claude-sonnet-4-5",   label: "Claude Sonnet 4.5" },
  { id: "anthropic/claude-opus-4-5",     label: "Claude Opus 4.5" },
  { id: "google/gemini-2.0-flash",       label: "Gemini 2.0 Flash" },
];

interface UIState {
  openFileIds: string[];
  activeFileId: string | null;
  rightTab: RightTab;
}
function loadUIState(wsId: string): UIState {
  try {
    const raw = localStorage.getItem(`cupid_ide_ui_${wsId}`);
    if (!raw) return { openFileIds: [], activeFileId: null, rightTab: "compare" };
    return JSON.parse(raw) as UIState;
  } catch { return { openFileIds: [], activeFileId: null, rightTab: "compare" }; }
}
function saveUIState(wsId: string, state: UIState) {
  try { localStorage.setItem(`cupid_ide_ui_${wsId}`, JSON.stringify(state)); } catch { /* ignore */ }
}

function languageOf(path: string): string {
  const ext = (path.split(".").pop() ?? "").toLowerCase();
  switch (ext) {
    case "ts": case "tsx": return "typescript";
    case "js": case "jsx": case "mjs": return "javascript";
    case "json": return "json";
    case "css": return "css";
    case "html": case "htm": return "html";
    case "py": return "python";
    case "go": return "go";
    case "rs": return "rust";
    case "md": return "markdown";
    case "yaml": case "yml": return "yaml";
    case "sh": return "shell";
    case "sql": return "sql";
    default: return "plaintext";
  }
}

export default function EvaluationWorkbench() {
  const { user, logout } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const wsIdFromUrl = searchParams.get("ws");

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWs, setCurrentWs] = useState<Workspace | null>(null);
  const [files, setFiles] = useState<WorkspaceFileMeta[]>([]);
  const [openFiles, setOpenFiles] = useState<Map<string, WorkspaceFile>>(new Map());
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [rightTab, setRightTab] = useState<RightTab>("compare");
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  // ── Load workspaces on mount ───────────────────────────────
  useEffect(() => {
    void (async () => {
      try {
        const { workspaces } = await api.workspaces.list();
        setWorkspaces(workspaces);
        const targetId = wsIdFromUrl || workspaces[0]?.id || null;
        if (targetId && !wsIdFromUrl) setSearchParams({ ws: targetId }, { replace: true });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
    // eslint-disable-next-line
  }, []);

  // ── Load files when workspace changes ──────────────────────
  useEffect(() => {
    if (!wsIdFromUrl) return;
    void (async () => {
      try {
        setError(null);
        const r = await api.workspaces.files(wsIdFromUrl);
        setCurrentWs(r.workspace);
        setFiles(r.files);
        const ui = loadUIState(wsIdFromUrl);
        setRightTab(ui.rightTab);
        const stillExisting = ui.openFileIds.filter((id) => r.files.some((f) => f.id === id));
        const restored = new Map<string, WorkspaceFile>();
        for (const fid of stillExisting) {
          try {
            const fr = await api.workspaces.file(wsIdFromUrl, fid);
            restored.set(fid, fr.file);
          } catch { /* skip */ }
        }
        setOpenFiles(restored);
        setActiveFileId(stillExisting.includes(ui.activeFileId ?? "") ? ui.activeFileId : stillExisting[0] ?? null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [wsIdFromUrl]);

  // ── Persist UI state ───────────────────────────────────────
  useEffect(() => {
    if (!wsIdFromUrl) return;
    saveUIState(wsIdFromUrl, {
      openFileIds: Array.from(openFiles.keys()),
      activeFileId,
      rightTab,
    });
  }, [wsIdFromUrl, openFiles, activeFileId, rightTab]);

  // ── File operations ────────────────────────────────────────
  const openFile = async (fileId: string) => {
    if (!wsIdFromUrl) return;
    if (openFiles.has(fileId)) {
      setActiveFileId(fileId);
      return;
    }
    try {
      const r = await api.workspaces.file(wsIdFromUrl, fileId);
      setOpenFiles((m) => new Map([...m, [fileId, r.file]]));
      setActiveFileId(fileId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const closeTab = (fileId: string) => {
    setOpenFiles((m) => {
      const next = new Map(m);
      next.delete(fileId);
      return next;
    });
    if (activeFileId === fileId) {
      const remaining = Array.from(openFiles.keys()).filter((id) => id !== fileId);
      setActiveFileId(remaining[0] ?? null);
    }
  };

  const createFile = async () => {
    if (!wsIdFromUrl) return;
    const name = window.prompt("File path (e.g. utils/math.ts)");
    if (!name) return;
    try {
      const r = await api.workspaces.createFile(wsIdFromUrl, name);
      setFiles((fs) => [...fs, { id: r.file.id, path: r.file.path, updated_at: r.file.updated_at, size: r.file.content.length }]);
      setOpenFiles((m) => new Map([...m, [r.file.id, r.file]]));
      setActiveFileId(r.file.id);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e));
    }
  };

  const deleteFile = async (fileId: string, path: string) => {
    if (!wsIdFromUrl) return;
    if (!window.confirm(`Delete ${path}?`)) return;
    try {
      await api.workspaces.deleteFile(wsIdFromUrl, fileId);
      setFiles((fs) => fs.filter((f) => f.id !== fileId));
      closeTab(fileId);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e));
    }
  };

  const renameFileFn = async (fileId: string, oldPath: string) => {
    if (!wsIdFromUrl) return;
    const next = window.prompt("Rename to", oldPath);
    if (!next || next === oldPath) return;
    try {
      const r = await api.workspaces.updateFile(wsIdFromUrl, fileId, { path: next });
      setFiles((fs) => fs.map((f) => f.id === fileId ? { ...f, path: r.file.path, updated_at: r.file.updated_at } : f));
      setOpenFiles((m) => {
        const cur = m.get(fileId);
        if (!cur) return m;
        const nx = new Map(m);
        nx.set(fileId, { ...cur, path: r.file.path });
        return nx;
      });
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e));
    }
  };

  // ── Auto-save with debounce ────────────────────────────────
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onEdit = useCallback((value: string | undefined) => {
    if (!wsIdFromUrl || !activeFileId || value === undefined) return;
    setOpenFiles((m) => {
      const cur = m.get(activeFileId);
      if (!cur || cur.content === value) return m;
      const next = new Map(m);
      next.set(activeFileId, { ...cur, content: value });
      return next;
    });
    setSaving("saving");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        await api.workspaces.updateFile(wsIdFromUrl, activeFileId, { content: value });
        setSaving("saved");
        setFiles((fs) => fs.map((f) => f.id === activeFileId ? { ...f, updated_at: new Date().toISOString(), size: value.length } : f));
        setTimeout(() => setSaving("idle"), 1200);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setSaving("idle");
      }
    }, 600);
  }, [wsIdFromUrl, activeFileId]);

  // ── Workspace ops ──────────────────────────────────────────
  const createWorkspace = async () => {
    const name = window.prompt("New workspace name");
    if (!name) return;
    try {
      const r = await api.workspaces.create(name);
      setWorkspaces((ws) => [r.workspace, ...ws]);
      setSearchParams({ ws: r.workspace.id });
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e));
    }
  };

  const renameWorkspace = async () => {
    if (!currentWs) return;
    const next = window.prompt("Rename workspace", currentWs.name);
    if (!next || next === currentWs.name) return;
    try {
      const r = await api.workspaces.rename(currentWs.id, next);
      setCurrentWs(r.workspace);
      setWorkspaces((ws) => ws.map((w) => w.id === r.workspace.id ? r.workspace : w));
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e));
    }
  };

  const deleteWorkspace = async () => {
    if (!currentWs) return;
    if (!window.confirm(`Delete workspace "${currentWs.name}" and all its files?`)) return;
    try {
      await api.workspaces.remove(currentWs.id);
      const remaining = workspaces.filter((w) => w.id !== currentWs.id);
      setWorkspaces(remaining);
      if (remaining[0]) setSearchParams({ ws: remaining[0].id });
      else {
        setCurrentWs(null);
        setFiles([]);
        setOpenFiles(new Map());
        setActiveFileId(null);
      }
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e));
    }
  };

  const activeFile = activeFileId ? openFiles.get(activeFileId) : undefined;
  const activeLang = activeFile ? languageOf(activeFile.path) : "plaintext";

  return (
    <div className="h-[calc(100vh-52px)] flex flex-col bg-gray-950">
      {/* Workspace toolbar */}
      <div className="h-10 border-b border-gray-800 px-3 flex items-center gap-3 text-sm flex-shrink-0 bg-gray-900/50">
        <span className="label">Workspace</span>
        <select
          className="select text-xs py-1 max-w-[260px]"
          value={currentWs?.id ?? ""}
          onChange={(e) => setSearchParams({ ws: e.target.value })}
        >
          {workspaces.length === 0 && <option value="">(none)</option>}
          {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <button onClick={createWorkspace} className="btn-ghost text-xs py-1 px-2" title="New workspace">+ New</button>
        {currentWs && <button onClick={renameWorkspace} className="btn-ghost text-xs py-1 px-2">Rename</button>}
        {currentWs && <button onClick={deleteWorkspace} className="btn-ghost text-xs py-1 px-2 text-red-400 hover:text-red-300">Delete</button>}
        <div className="ml-auto flex items-center gap-3 text-xs text-gray-500">
          <span>
            {saving === "saving" && <span className="text-amber-400">saving…</span>}
            {saving === "saved" && <span className="text-emerald-400">✓ saved</span>}
          </span>
          <span>{user?.email}</span>
          <button onClick={async () => { await logout(); navigate("/login"); }} className="btn-ghost text-xs py-1 px-2">Sign out</button>
        </div>
      </div>

      {error && (
        <div className="px-4 py-2 text-xs text-red-300 bg-red-950/40 border-b border-red-900/40 flex items-center gap-2">
          <span>Error: {error}</span>
          <button onClick={() => setError(null)} className="ml-auto btn-ghost text-xs py-0.5 px-2">dismiss</button>
        </div>
      )}

      <div className="flex-1 flex min-h-0">
        {/* File tree */}
        <aside className="w-56 border-r border-gray-800 flex flex-col bg-gray-900/30 flex-shrink-0">
          <div className="h-9 px-3 border-b border-gray-800 flex items-center gap-2">
            <span className="label">Files</span>
            <button onClick={createFile} disabled={!currentWs} className="btn-ghost text-xs py-0.5 px-2 ml-auto">+ New</button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {files.length === 0 ? (
              <div className="p-3 text-xs text-gray-600">No files. Click "+ New" to create.</div>
            ) : (
              files.map((f) => (
                <FileRow key={f.id}
                  file={f}
                  active={f.id === activeFileId}
                  onOpen={() => openFile(f.id)}
                  onRename={() => renameFileFn(f.id, f.path)}
                  onDelete={() => deleteFile(f.id, f.path)}
                />
              ))
            )}
          </div>
        </aside>

        {/* Editor */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="h-9 border-b border-gray-800 flex items-center bg-gray-900/30 overflow-x-auto scrollbar-hide flex-shrink-0">
            {Array.from(openFiles.values()).map((f) => (
              <button
                key={f.id}
                onClick={() => setActiveFileId(f.id)}
                className={`h-full px-3 flex items-center gap-2 text-xs whitespace-nowrap border-r border-gray-800 ${
                  f.id === activeFileId ? "bg-gray-950 text-gray-100" : "text-gray-400 hover:bg-gray-800/50"
                }`}
              >
                <span className="font-mono">{f.path}</span>
                <span
                  onClick={(e) => { e.stopPropagation(); closeTab(f.id); }}
                  className="text-gray-600 hover:text-gray-300 w-4 h-4 flex items-center justify-center rounded hover:bg-gray-700/50"
                >
                  ×
                </span>
              </button>
            ))}
            {openFiles.size === 0 && (
              <div className="px-3 text-xs text-gray-600 italic">No file open. Click a file in the sidebar to open it.</div>
            )}
          </div>

          <div className="flex-1 min-h-0">
            {activeFile ? (
              <Editor
                key={activeFile.id}
                height="100%"
                theme="vs-dark"
                path={activeFile.path}
                language={activeLang}
                value={activeFile.content}
                onChange={onEdit}
                options={{
                  fontSize: 13,
                  fontFamily: "JetBrains Mono, monospace",
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  smoothScrolling: true,
                  automaticLayout: true,
                  tabSize: 2,
                  wordWrap: "on",
                }}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-gray-500">
                Open a file from the sidebar to start editing.
              </div>
            )}
          </div>
        </div>

        {/* Right panel */}
        <aside className="w-[460px] border-l border-gray-800 flex flex-col bg-gray-900/30 flex-shrink-0">
          <div className="h-9 px-1 border-b border-gray-800 flex gap-1 items-center flex-shrink-0">
            {RIGHT_TABS.map((t) => (
              <button
                key={t}
                onClick={() => setRightTab(t)}
                className={`px-3 py-1 text-xs rounded ${rightTab === t ? "bg-indigo-600/20 text-indigo-300 ring-1 ring-indigo-500/30" : "text-gray-400 hover:bg-gray-800"}`}
              >
                {t === "compare" ? "Compare" : t === "pipeline" ? "Pipeline" : t === "sandbox" ? "Sandbox" : "Multi-chat"}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {rightTab === "compare" && <ComparePanel activeFile={activeFile} />}
            {rightTab === "pipeline" && <PipelinePanel activeFile={activeFile} workspaceId={currentWs?.id} />}
            {rightTab === "sandbox" && <SandboxPanel activeFile={activeFile} />}
            {rightTab === "chat" && <MultiChatPanel />}
          </div>
        </aside>
      </div>
    </div>
  );
}

function FileRow({ file, active, onOpen, onRename, onDelete }: {
  file: WorkspaceFileMeta;
  active: boolean;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={`group px-2 py-1 text-xs cursor-pointer flex items-center gap-1 ${active ? "bg-indigo-600/10 text-indigo-200" : "text-gray-300 hover:bg-gray-800/40"}`}
         onClick={onOpen}>
      <span className="flex-1 font-mono truncate">{file.path}</span>
      <button onClick={(e) => { e.stopPropagation(); onRename(); }} className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-gray-200 px-1" title="Rename">✎</button>
      <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-300 px-1" title="Delete">×</button>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Right panel — Compare
// ──────────────────────────────────────────────────────────────────────
function ComparePanel({ activeFile }: { activeFile?: WorkspaceFile }) {
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<"cost_saving" | "balanced" | "max_quality">("cost_saving");
  const [maxTokens, setMaxTokens] = useState(4096);
  const [includeFile, setIncludeFile] = useState(true);
  const [useLlmRouting, setUseLlmRouting] = useState(true);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // We need workspace context to thread sessionKey through CPL
  // Use search params if present in router; fall back to "ide-session"
  const run = async () => {
    if (!prompt.trim()) return;
    setRunning(true); setError(null); setResult(null);
    try {
      // Derive workspace-scoped session key from URL ?ws= or fall back
      const wsId = new URLSearchParams(window.location.search).get("ws") || "anon";
      const r = await api.compare.run(prompt, mode, maxTokens, {
        routingMode: useLlmRouting ? "llm_assisted" : "rule_based",
        sessionKey: `workbench::ws-${wsId}`,
        rawCode: includeFile && activeFile ? activeFile.content : undefined,
        fileName: includeFile && activeFile ? activeFile.path : undefined,
      });
      setResult(r);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setRunning(false); }
  };

  return (
    <div className="space-y-3">
      <textarea className="textarea w-full h-24 text-sm" placeholder="Prompt — e.g. 'add unit tests for this'"
        value={prompt} onChange={(e) => setPrompt(e.target.value)} disabled={running} />
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <select className="select text-xs py-1" value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
          <option value="cost_saving">cost_saving</option>
          <option value="balanced">balanced</option>
          <option value="max_quality">max_quality</option>
        </select>
        <select className="select text-xs py-1" value={maxTokens} onChange={(e) => setMaxTokens(Number(e.target.value))}>
          <option value={1024}>1k</option>
          <option value={2048}>2k</option>
          <option value={4096}>4k</option>
          <option value={8192}>8k</option>
          <option value={16384}>16k</option>
        </select>
        <label className="flex items-center gap-1 cursor-pointer">
          <input type="checkbox" checked={includeFile} onChange={(e) => setIncludeFile(e.target.checked)} className="accent-indigo-500" />
          <span className="text-gray-400">include file</span>
        </label>
        <label className="flex items-center gap-1 cursor-pointer">
          <input type="checkbox" checked={useLlmRouting} onChange={(e) => setUseLlmRouting(e.target.checked)} className="accent-indigo-500" />
          <span className="text-gray-400">LLM routing</span>
        </label>
        <button onClick={run} disabled={running || !prompt.trim()} className="btn-run text-xs py-1 px-3 ml-auto">
          {running ? "Running…" : "Run"}
        </button>
      </div>
      {error && <div className="text-xs text-red-400">{error}</div>}
      {result && (
        <div className="space-y-2 text-xs">
          <div className="card-sm text-emerald-300">
            Saved <strong>{result.comparison.savingsPercent.toFixed(1)}%</strong> · <span className="badge-gray ml-1">{result.routingMode === "llm_assisted" ? "LLM-assisted" : "rule-based"}</span>
            <div className="text-[11px] text-gray-500 mt-1">router=<code>{result.routing.selectedModel}</code> · benchmark=<code>{result.benchmark.modelId}</code></div>
          </div>
          {result.llmRouting && (
            <div className="card-sm border-l-2 border-l-violet-500 text-[11px] space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-gray-400">classifier</span>
                <span className="badge-purple font-mono">{result.llmRouting.modelId}</span>
                <span className="text-gray-500">${result.llmRouting.costUsd.toFixed(6)}</span>
                <span className="text-gray-500">{result.llmRouting.latencyMs}ms</span>
                {result.llmRouting.fellBackToRules && <span className="badge-yellow">fell back</span>}
              </div>
              {result.llmRouting.rationale && (
                <div className="text-gray-300 italic">"{result.llmRouting.rationale}"</div>
              )}
            </div>
          )}
          <CompareSide title="Router pick" exec={result.router} accent="indigo" />
          <CompareSide title="Benchmark (Opus)" exec={result.benchmark} accent="violet" />
        </div>
      )}
    </div>
  );
}

function CompareSide({ title, exec, accent }: { title: string; exec: CompareResult["router"]; accent: "indigo" | "violet" }) {
  const border = accent === "indigo" ? "border-l-indigo-500" : "border-l-violet-500";
  return (
    <div className={`card-sm border-l-2 ${border}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="font-semibold text-gray-200">{title}</span>
        <span className="badge-gray font-mono">{exec.modelId}</span>
      </div>
      <div className="flex gap-3 text-[11px] text-gray-500 font-mono mb-2">
        <span>${exec.costUsd.toFixed(5)}</span>
        <span>{exec.latencyMs}ms</span>
        <span>{exec.inputTokens} → {exec.outputTokens}</span>
      </div>
      <pre className="code-block text-[11px] max-h-64 overflow-auto whitespace-pre-wrap">{exec.response || (exec.error ? `ERROR: ${exec.error}` : "(empty)")}</pre>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Right panel — Pipeline
// ──────────────────────────────────────────────────────────────────────
function PipelinePanel({ activeFile, workspaceId }: { activeFile?: WorkspaceFile; workspaceId?: string }) {
  const [prompt, setPrompt] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!prompt.trim()) return;
    setRunning(true); setError(null); setResult(null);
    try {
      const r = await api.cupid.runOnce(prompt, {
        fileName: activeFile?.path ?? "untitled",
        activeLanguage: activeFile ? languageOf(activeFile.path) : "plaintext",
        fileLineCount: activeFile ? activeFile.content.split("\n").length : 0,
        hasTerminalError: false,
        hasHighlightedText: false,
        rawCodePayload: activeFile?.content ?? "",
        gitDiffText: null,
      }, `workspace::${workspaceId ?? "anon"}`);
      setResult(r);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setRunning(false); }
  };

  return (
    <div className="space-y-3">
      <textarea className="textarea w-full h-20 text-sm" placeholder="Prompt for pipeline trace"
        value={prompt} onChange={(e) => setPrompt(e.target.value)} disabled={running} />
      <button onClick={run} disabled={running || !prompt.trim()} className="btn-run text-xs py-1 px-3">
        {running ? "Tracing…" : "Run pipeline trace"}
      </button>
      {error && <div className="text-xs text-red-400">{error}</div>}
      {result && (
        <div className="space-y-2 text-xs">
          <div className="card-sm">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">Intent</span>
              <span className="badge-indigo">{result.intent}</span>
            </div>
            <div className="flex items-center justify-between text-xs mt-1">
              <span className="text-gray-400">Routed to</span>
              <span className="badge-green font-mono">{result.routedModel}</span>
            </div>
            <div className="flex items-center justify-between text-xs mt-1">
              <span className="text-gray-400">Tokens</span>
              <span className="font-mono text-gray-300">{result.totals.baselineTokens.toLocaleString()} → {result.totals.finalTokens.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-xs mt-1">
              <span className="text-gray-400">Cost savings</span>
              <span className="font-mono text-emerald-300">${result.totals.estimatedCostSavingsUsd.toFixed(5)}</span>
            </div>
          </div>
          <details className="card-sm">
            <summary className="cursor-pointer text-gray-400">Steps ({result.steps.length})</summary>
            <ol className="mt-2 space-y-1.5">
              {result.steps.map((s) => (
                <li key={s.step} className="border-l-2 border-indigo-500/40 pl-2">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-200">{s.label}</span>
                    <span className="font-mono text-gray-500">{s.durationMs.toFixed(2)}ms</span>
                  </div>
                  {s.notes?.length ? <ul className="text-[10px] text-gray-500 list-disc list-inside">{s.notes.map((n, i) => <li key={i}>{n}</li>)}</ul> : null}
                </li>
              ))}
            </ol>
          </details>
          <details className="card-sm">
            <summary className="cursor-pointer text-gray-400">Auction scores</summary>
            <table className="w-full mt-1 text-[11px]">
              <thead className="text-gray-600"><tr><th className="text-left">Model</th><th className="text-right">Q</th><th className="text-right">−C</th><th className="text-right">−L</th><th className="text-right">−R</th><th className="text-right">Total</th></tr></thead>
              <tbody>
                {result.auction.scores.map((s) => (
                  <tr key={s.modelId} className={s.modelId === result.auction.winner.id ? "text-emerald-300" : "text-gray-400"}>
                    <td className="font-mono">{s.modelId}</td>
                    <td className="text-right font-mono">{s.weightedQuality.toFixed(2)}</td>
                    <td className="text-right font-mono">{s.weightedCost.toFixed(2)}</td>
                    <td className="text-right font-mono">{s.weightedLatency.toFixed(2)}</td>
                    <td className="text-right font-mono">{s.weightedRisk.toFixed(2)}</td>
                    <td className="text-right font-mono">{s.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </div>
      )}
      <div className="text-[11px] text-gray-600">
        For the full animated pipeline diagram, see the <a className="text-indigo-300 hover:text-indigo-200" href="/pipeline">Pipeline page</a>.
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Right panel — Sandbox
// ──────────────────────────────────────────────────────────────────────
function SandboxPanel({ activeFile }: { activeFile?: WorkspaceFile }) {
  const [bumpKey, setBumpKey] = useState(0);
  useEffect(() => setBumpKey((k) => k + 1), [activeFile?.id]);

  if (!activeFile) {
    return <div className="text-xs text-gray-500">Open a file to run it in the sandbox.</div>;
  }
  const lang = languageOf(activeFile.path);
  const supported = lang === "javascript" || lang === "typescript" || lang === "html";
  if (!supported) {
    return <div className="text-xs text-amber-400">Sandbox supports JavaScript, TypeScript, and HTML. Current file is <code>{lang}</code>.</div>;
  }
  return (
    <div className="h-[calc(100vh-160px)]">
      <SandboxRunner code={activeFile.content} language={lang as "javascript" | "typescript" | "html"} bumpKey={bumpKey} />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Right panel — Multi-chat
// ──────────────────────────────────────────────────────────────────────
function MultiChatPanel() {
  const [selected, setSelected] = useState<Set<string>>(new Set(["openai/gpt-4o-mini", "anthropic/claude-haiku-4-5"]));
  const [prompt, setPrompt] = useState("");
  const [maxTokens, setMaxTokens] = useState(2048);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<MultiChatResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const run = async () => {
    if (!prompt.trim() || selected.size === 0) return;
    setRunning(true); setError(null); setResults([]);
    try {
      const r = await api.chat.multi(
        Array.from(selected),
        [{ role: "user", content: prompt }],
        maxTokens,
      );
      setResults(r.results);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setRunning(false); }
  };

  return (
    <div className="space-y-3">
      <div>
        <div className="label-sm mb-1">Models to query (parallel)</div>
        <div className="flex flex-wrap gap-1.5">
          {MULTICHAT_MODELS.map((m) => (
            <button key={m.id} onClick={() => toggle(m.id)}
              className={`text-xs px-2 py-1 rounded border ${selected.has(m.id) ? "bg-indigo-600/20 text-indigo-200 border-indigo-500/40" : "border-gray-700 text-gray-400 hover:text-gray-200 hover:bg-gray-800"}`}>
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <textarea className="textarea w-full h-24 text-sm" placeholder="Same prompt sent to all selected models"
        value={prompt} onChange={(e) => setPrompt(e.target.value)} disabled={running} />
      <div className="flex items-center gap-2">
        <select className="select text-xs py-1" value={maxTokens} onChange={(e) => setMaxTokens(Number(e.target.value))}>
          <option value={512}>512</option>
          <option value={1024}>1k</option>
          <option value={2048}>2k</option>
          <option value={4096}>4k</option>
          <option value={8192}>8k</option>
        </select>
        <button onClick={run} disabled={running || !prompt.trim() || selected.size === 0} className="btn-run text-xs py-1 px-3 ml-auto">
          {running ? "Calling…" : `Query ${selected.size} models`}
        </button>
      </div>
      {error && <div className="text-xs text-red-400">{error}</div>}
      {results.length > 0 && (
        <div className="space-y-2">
          {results.map((r) => (
            <div key={r.modelId} className="card-sm">
              <div className="flex items-center gap-2 mb-1 text-xs">
                <span className="font-semibold text-gray-200">{r.displayName}</span>
                <span className="badge-gray font-mono">{r.tier}</span>
                <span className="ml-auto font-mono text-gray-500">
                  ${r.costUsd.toFixed(5)} · {r.latencyMs}ms · {r.inputTokens}→{r.outputTokens}
                </span>
              </div>
              {r.error ? (
                <div className="text-[11px] text-red-300">{r.error}</div>
              ) : (
                <pre className="text-[11px] text-gray-200 whitespace-pre-wrap leading-relaxed max-h-64 overflow-auto">{r.content}</pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
