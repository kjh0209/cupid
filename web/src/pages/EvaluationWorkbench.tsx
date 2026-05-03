import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { RepoInfo, EvalRunResult, EvalTask } from "../api/client";
import { FileTree } from "../components/FileTree";
import { DiffViewer } from "../components/DiffViewer";
import {
  Spinner, StatusBadge, ModelLabel, CostDisplay,
  SavingsBadge, VerificationBadge, EmptyState, ParseStatusBadge
} from "../components/ui";

const EXPERIMENT_MODES = [
  { value: "router_vs_strong", label: "Router vs Strong Baseline" },
  { value: "router_vs_cheap_vs_strong", label: "Router vs Cheap vs Strong" },
  { value: "manual_vs_router", label: "Manual vs Router" },
] as const;

const USER_MODES = [
  { value: "cost_saving", label: "💰 Cost Saving", desc: "Minimize cost" },
  { value: "balanced", label: "⚖️ Balanced", desc: "Cost & quality" },
  { value: "max_quality", label: "🚀 Max Quality", desc: "Best output" },
] as const;

const LABEL_COLORS: Record<string, string> = {
  router: "border-indigo-500 bg-indigo-950/30",
  strong_baseline: "border-violet-500 bg-violet-950/30",
  cheap_baseline: "border-green-500 bg-green-950/30",
  manual: "border-amber-500 bg-amber-950/30",
};
const LABEL_NAMES: Record<string, string> = {
  router: "⚡ Cupid Router",
  strong_baseline: "🏔 Strong Baseline",
  cheap_baseline: "💡 Cheap Only",
  manual: "🔧 Manual",
};

export default function EvaluationWorkbench() {
  const navigate = useNavigate();

  // Repo state
  const [repos, setRepos] = useState<RepoInfo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<RepoInfo | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | undefined>();
  const [fileContent, setFileContent] = useState<string>("");
  const [loadingRepos, setLoadingRepos] = useState(true);

  // Task state
  const [taskMessage, setTaskMessage] = useState("");
  const [userMode, setUserMode] = useState<"cost_saving" | "balanced" | "max_quality">("balanced");
  const [experimentMode, setExperimentMode] = useState<"router_vs_strong" | "router_vs_cheap_vs_strong" | "manual_vs_router">("router_vs_strong");
  const [strongModel, setStrongModel] = useState("anthropic/claude-opus-4-5");
  const [cheapModel, setCheapModel] = useState("google/gemini-2.0-flash");
  const [manualModel, setManualModel] = useState("");
  const [runVerification, setRunVerification] = useState(false);

  // Sample tasks
  const [sampleTasks, setSampleTasks] = useState<EvalTask[]>([]);

  // Run state
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<EvalRunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"diff" | "tokens" | "verification" | "rating">("diff");

  // Rating state
  const [ratingPreferred, setRatingPreferred] = useState("");
  const [ratingRouterAccept, setRatingRouterAccept] = useState("");
  const [ratingNotes, setRatingNotes] = useState("");
  const [ratingSaved, setRatingSaved] = useState(false);

  useEffect(() => {
    api.repos.list().then((r) => { setRepos(r.repos); setLoadingRepos(false); }).catch(() => setLoadingRepos(false));
    api.tasks.list().then((r) => setSampleTasks(r.tasks || [])).catch(() => {});
  }, []);

  const selectRepo = async (repo: RepoInfo) => {
    setSelectedRepo(repo);
    setSelectedFile(undefined);
    setFileContent("");
    setResult(null);
    setError(null);
  };

  const selectFile = async (path: string) => {
    if (!selectedRepo) return;
    setSelectedFile(path);
    try {
      const r = await api.repos.file(selectedRepo.id, path);
      setFileContent(r.content);
    } catch { setFileContent(""); }
  };

  const loadTask = (task: EvalTask) => {
    setTaskMessage(task.message);
    if (task.activeFilePath) setSelectedFile(task.activeFilePath);
  };

  const runEval = async () => {
    if (!selectedRepo || !taskMessage.trim()) return;
    setRunning(true);
    setResult(null);
    setError(null);
    setRatingSaved(false);
    setActiveTab("diff");
    try {
      const r = await api.evals.run({
        repoId: selectedRepo.id,
        taskMessage: taskMessage.trim(),
        activeFilePath: selectedFile,
        userMode,
        experimentMode,
        strongBaselineModel: strongModel || undefined,
        cheapBaselineModel: cheapModel || undefined,
        manualModel: manualModel || undefined,
        runVerification,
      });
      setResult(r);
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
    }
  };

  const saveRating = async () => {
    if (!result) return;
    await api.evals.rate(result.runId, {
      preferredCandidate: ratingPreferred || null,
      routerAcceptance: ratingRouterAccept || null,
      ratingNotes: ratingNotes || null,
    });
    setRatingSaved(true);
  };

  const recommendation = result?.recommendation as Record<string, unknown> | null;
  const classification = result?.taskClassification as Record<string, unknown> | null;

  return (
    <div className="flex h-[calc(100vh-52px)] overflow-hidden">
      {/* LEFT: Repo + File */}
      <aside className="w-60 flex-shrink-0 border-r border-gray-800 flex flex-col overflow-hidden">
        <div className="p-3 border-b border-gray-800">
          <div className="label mb-2">Repository</div>
          {loadingRepos ? (
            <div className="space-y-1">{[1,2].map(i => <div key={i} className="shimmer h-8 rounded"/>)}</div>
          ) : (
            <div className="space-y-1">
              {repos.map((r) => (
                <button
                  key={r.id}
                  onClick={() => selectRepo(r)}
                  className={`w-full text-left px-2 py-1.5 rounded-lg text-sm transition-colors ${
                    selectedRepo?.id === r.id ? "bg-indigo-900/50 text-indigo-200 border border-indigo-700/50" : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/60"
                  }`}
                >
                  <div className="font-medium truncate">{r.name}</div>
                  <div className="text-xs text-gray-500">{r.framework}</div>
                </button>
              ))}
              {repos.length === 0 && <div className="text-xs text-gray-500">No repos found</div>}
            </div>
          )}
        </div>

        {selectedRepo && (
          <div className="flex-1 overflow-y-auto p-2">
            <div className="label px-1 mb-2">Files</div>
            <FileTree nodes={selectedRepo.fileTree} onSelect={selectFile} selectedPath={selectedFile} />
          </div>
        )}
      </aside>

      {/* CENTER: Task Config */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Task input area */}
        <div className="p-4 border-b border-gray-800 space-y-3">
          {/* Sample task buttons */}
          {sampleTasks.filter(t => !selectedRepo || t.repo === selectedRepo?.id).slice(0, 3).length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {sampleTasks.filter(t => !selectedRepo || t.repo === selectedRepo?.id).slice(0, 4).map(t => (
                <button key={t.id} onClick={() => loadTask(t)} className="text-xs px-2 py-1 rounded-md bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors border border-gray-700 truncate max-w-[180px]">
                  {t.title}
                </button>
              ))}
            </div>
          )}

          <textarea
            className="textarea w-full h-24 text-sm"
            placeholder="Describe the coding task…  e.g. 'Add Zod validation to POST /api/users, follow existing patterns'"
            value={taskMessage}
            onChange={(e) => setTaskMessage(e.target.value)}
          />

          <div className="flex flex-wrap gap-3 items-end">
            {/* User mode */}
            <div>
              <div className="label mb-1">Mode</div>
              <div className="flex gap-1">
                {USER_MODES.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setUserMode(m.value)}
                    className={`btn text-xs py-1 px-2.5 ${userMode === m.value ? "btn-primary" : "btn-secondary"}`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Experiment mode */}
            <div>
              <div className="label mb-1">Experiment</div>
              <select className="select text-xs py-1" value={experimentMode} onChange={(e) => setExperimentMode(e.target.value as typeof experimentMode)}>
                {EXPERIMENT_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>

            {/* Strong model */}
            <div>
              <div className="label mb-1">Strong Baseline</div>
              <input className="input text-xs py-1 w-52" value={strongModel} onChange={(e) => setStrongModel(e.target.value)} placeholder="anthropic/claude-opus-4-5" />
            </div>

            {experimentMode === "manual_vs_router" && (
              <div>
                <div className="label mb-1">Manual Model</div>
                <input className="input text-xs py-1 w-44" value={manualModel} onChange={(e) => setManualModel(e.target.value)} placeholder="openai/gpt-4o" />
              </div>
            )}

            <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
              <input type="checkbox" checked={runVerification} onChange={(e) => setRunVerification(e.target.checked)} className="rounded" />
              Run verification
            </label>

            <button
              onClick={runEval}
              disabled={running || !selectedRepo || !taskMessage.trim()}
              className="btn-run ml-auto"
            >
              {running ? <><Spinner size="sm" /> Running…</> : "▶ Run Evaluation"}
            </button>
          </div>
        </div>

        {/* Results area */}
        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <div className="card p-4 border-red-800 bg-red-950/20 text-red-300 text-sm mb-4 animate-fade-in">
              <strong>Error:</strong> {error}
            </div>
          )}

          {running && (
            <div className="flex flex-col items-center justify-center py-20 gap-4 animate-fade-in">
              <Spinner size="lg" />
              <div className="text-gray-400 text-sm">Calling models and generating diffs…</div>
              <div className="text-xs text-gray-600">This may take 30–90 seconds</div>
            </div>
          )}

          {result && !running && (
            <div className="space-y-4 animate-fade-in">
              {/* Status bar */}
              <div className="flex items-center gap-3 flex-wrap">
                <StatusBadge status={result.status} />
                <span className="text-xs text-gray-500">Run ID: <code className="text-gray-400">{result.runId.slice(0, 8)}</code></span>
                <button onClick={() => navigate(`/evals/${result.runId}`)} className="btn-ghost text-xs py-0.5 px-2">
                  View full report →
                </button>
              </div>

              {/* Tabs */}
              <div className="tab-bar">
                {(["diff", "tokens", "verification", "rating"] as const).map((t) => (
                  <button key={t} onClick={() => setActiveTab(t)} className={activeTab === t ? "tab-active" : "tab-inactive"}>
                    {t === "diff" ? "Diffs" : t === "tokens" ? "Tokens & Cost" : t === "verification" ? "Verification" : "Rating"}
                  </button>
                ))}
              </div>

              {activeTab === "diff" && (
                <div className="space-y-4">
                  {result.candidates.map((c) => (
                    <div key={c.label} className={`card p-0 overflow-hidden border-l-4 ${LABEL_COLORS[c.label] ?? "border-gray-700"}`}>
                      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-800/60 flex-wrap">
                        <span className="font-semibold text-sm">{LABEL_NAMES[c.label] ?? c.label}</span>
                        <ModelLabel modelId={c.modelId} isRouter={c.label === "router"} />
                        <ParseStatusBadge status={c.parseStatus} />
                        <VerificationBadge passed={c.verificationPassed} />
                        <span className="ml-auto text-xs text-gray-500">{c.filesChanged} file(s) changed</span>
                      </div>
                      {c.parseStatus === "failed" && c.summary ? (
                        <div className="px-4 py-3 text-sm text-red-300 bg-red-950/30 border-b border-red-900/40 font-mono break-all">
                          <span className="font-semibold text-red-400 mr-2">Error:</span>{c.summary}
                        </div>
                      ) : c.summary ? (
                        <div className="px-4 py-2 text-sm text-gray-300 bg-gray-800/30 border-b border-gray-800/40">{c.summary}</div>
                      ) : null}
                      <div className="p-3">
                        <DiffViewer diff={c.diff} maxHeight="350px" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === "tokens" && result.metrics && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="stat-card">
                      <div className="stat-label">Router Cost</div>
                      <div className="stat-value text-indigo-300"><CostDisplay usd={result.metrics.routerCostUsd} /></div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">Baseline Cost</div>
                      <div className="stat-value text-violet-300"><CostDisplay usd={result.metrics.strongBaselineCostUsd} /></div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">Savings</div>
                      <div className="stat-value text-emerald-300"><CostDisplay usd={result.metrics.savingsUsd} /></div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">Savings %</div>
                      <div className="stat-value"><SavingsBadge percent={result.metrics.savingsPercent} /></div>
                    </div>
                  </div>

                  <div className="card p-4">
                    <div className="label mb-3">Per-Candidate Breakdown</div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
                          <th className="pb-2 pr-4">Candidate</th>
                          <th className="pb-2 pr-4">Model</th>
                          <th className="pb-2 pr-4 text-right">Input Tokens</th>
                          <th className="pb-2 pr-4 text-right">Output Tokens</th>
                          <th className="pb-2 pr-4 text-right">Est. Cost</th>
                          <th className="pb-2 text-right">Latency</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.candidates.map((c) => (
                          <tr key={c.label} className="border-b border-gray-800/50 last:border-0">
                            <td className="py-2 pr-4 font-medium">{LABEL_NAMES[c.label] ?? c.label}</td>
                            <td className="py-2 pr-4"><ModelLabel modelId={c.modelId} /></td>
                            <td className="py-2 pr-4 text-right font-mono">{c.inputTokens.toLocaleString()}</td>
                            <td className="py-2 pr-4 text-right font-mono">{c.outputTokens.toLocaleString()}</td>
                            <td className="py-2 pr-4 text-right"><CostDisplay usd={c.costUsd} /></td>
                            <td className="py-2 text-right text-gray-500">{c.latencyMs}ms</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {result.metrics.promptTokenReductionPercent > 0 && (
                    <div className="card-sm text-sm text-gray-400">
                      ✂️ Prompt token reduction: <strong className="text-emerald-400">{result.metrics.promptTokenReductionPercent.toFixed(1)}%</strong> via Cupid optimizer
                    </div>
                  )}
                </div>
              )}

              {activeTab === "verification" && (
                <div className="space-y-3">
                  {result.candidates.map((c) => (
                    <div key={c.label} className={`card p-4 border-l-4 ${LABEL_COLORS[c.label] ?? "border-gray-700"}`}>
                      <div className="flex items-center gap-3 mb-3">
                        <span className="font-semibold text-sm">{LABEL_NAMES[c.label] ?? c.label}</span>
                        <VerificationBadge passed={c.verificationPassed} />
                      </div>
                      {c.verificationPassed === null && (
                        <p className="text-xs text-gray-500">Verification was not run for this candidate.</p>
                      )}
                    </div>
                  ))}
                  {!runVerification && (
                    <div className="card-sm text-sm text-gray-500">
                      Enable "Run verification" and re-run to see test/lint results.
                    </div>
                  )}
                </div>
              )}

              {activeTab === "rating" && (
                <div className="card p-5 space-y-4 max-w-xl">
                  <div className="section-title">🧑 Human Rating</div>

                  <div>
                    <div className="label mb-2">Preferred output</div>
                    <div className="flex gap-2 flex-wrap">
                      {result.candidates.map((c) => (
                        <button key={c.label} onClick={() => setRatingPreferred(c.label)}
                          className={`btn text-xs ${ratingPreferred === c.label ? "btn-primary" : "btn-secondary"}`}>
                          {LABEL_NAMES[c.label] ?? c.label}
                        </button>
                      ))}
                      <button onClick={() => setRatingPreferred("same")}
                        className={`btn text-xs ${ratingPreferred === "same" ? "btn-primary" : "btn-secondary"}`}>
                        Same
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="label mb-2">Router result acceptance</div>
                    <div className="flex gap-2">
                      {["accept", "reject", "needs_review"].map((v) => (
                        <button key={v} onClick={() => setRatingRouterAccept(v)}
                          className={`btn text-xs ${ratingRouterAccept === v ? "btn-primary" : "btn-secondary"}`}>
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="label mb-2">Notes</div>
                    <textarea className="textarea w-full h-20 text-sm" placeholder="Optional notes…"
                      value={ratingNotes} onChange={(e) => setRatingNotes(e.target.value)} />
                  </div>

                  <button onClick={saveRating} disabled={ratingSaved} className="btn-success">
                    {ratingSaved ? "✓ Saved" : "Save Rating"}
                  </button>
                </div>
              )}
            </div>
          )}

          {!result && !running && !error && (
            <EmptyState icon="⚡" title="Ready to evaluate"
              desc="Select a repository, write a task, and click Run Evaluation" />
          )}
        </div>
      </main>

      {/* RIGHT: Router Intelligence */}
      <aside className="w-64 flex-shrink-0 border-l border-gray-800 overflow-y-auto p-3 space-y-4">
        <div>
          <div className="label mb-2">Cupid Intelligence</div>
          {result ? (
            <div className="space-y-3 animate-fade-in">
              {classification && (
                <div className="card-sm space-y-1">
                  <div className="label-sm text-gray-500">Task Type</div>
                  <div className="text-sm font-medium">{String(classification.taskType ?? "—")}</div>
                  <div className="label-sm text-gray-500 mt-1">Complexity</div>
                  <div className="text-sm">{String(classification.complexity ?? "—")}</div>
                </div>
              )}
              {recommendation && (
                <div className="card-sm space-y-1">
                  <div className="label-sm text-gray-500">Selected Model</div>
                  <div className="text-sm font-mono text-indigo-300 break-all">{String(recommendation.modelId ?? "—")}</div>
                  <div className="label-sm text-gray-500 mt-1">Tier</div>
                  <div className="text-sm">{String(recommendation.tier ?? "—")}</div>
                  {recommendation.reasoning != null && (
                    <>
                      <div className="label-sm text-gray-500 mt-1">Reasoning</div>
                      <div className="text-xs text-gray-400">{String(recommendation.reasoning)}</div>
                    </>
                  )}
                </div>
              )}
              {result.metrics && (
                <div className="card-sm">
                  <div className="label-sm text-gray-500 mb-1">Estimated Savings</div>
                  <SavingsBadge percent={result.metrics.savingsPercent} />
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-gray-600 italic">Run an evaluation to see router insights</div>
          )}
        </div>

        {selectedFile && fileContent && (
          <div>
            <div className="label mb-1">Active File</div>
            <div className="text-xs text-gray-500 mb-1 truncate">{selectedFile}</div>
            <pre className="code-block text-xs max-h-48 overflow-auto">{fileContent.slice(0, 1200)}{fileContent.length > 1200 ? "\n…" : ""}</pre>
          </div>
        )}

        {selectedRepo && (
          <div>
            <div className="label mb-2">Repo Info</div>
            <div className="card-sm space-y-1 text-xs">
              <div><span className="text-gray-500">Framework:</span> <span>{selectedRepo.framework}</span></div>
              <div><span className="text-gray-500">Language:</span> <span>{selectedRepo.language}</span></div>
              <div><span className="text-gray-500">Scripts:</span> <span>{selectedRepo.availableScripts.join(", ") || "none"}</span></div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
