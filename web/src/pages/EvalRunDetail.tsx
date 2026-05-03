import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api/client";
import { DiffViewer } from "../components/DiffViewer";
import {
  Spinner, StatusBadge, ModelLabel, CostDisplay, SavingsBadge,
  VerificationBadge, ParseStatusBadge, LoadingRows, EmptyState
} from "../components/ui";

const LABEL_COLORS: Record<string, string> = {
  router: "border-indigo-500 bg-indigo-950/20",
  strong_baseline: "border-violet-500 bg-violet-950/20",
  cheap_baseline: "border-green-500 bg-green-950/20",
  manual: "border-amber-500 bg-amber-950/20",
};
const LABEL_NAMES: Record<string, string> = {
  router: "⚡ Cupid Router",
  strong_baseline: "🏔 Strong Baseline",
  cheap_baseline: "💡 Cheap Only",
  manual: "🔧 Manual",
};

interface RunDetail {
  run: Record<string, unknown>;
  candidates: Record<string, unknown>[];
  metrics: Record<string, unknown> | null;
  rating: Record<string, unknown> | null;
}

export default function EvalRunDetail() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<RunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportedReport, setExportedReport] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "diffs" | "tokens" | "report">("overview");

  // Rating
  const [ratingPreferred, setRatingPreferred] = useState("");
  const [ratingAccept, setRatingAccept] = useState("");
  const [ratingNotes, setRatingNotes] = useState("");
  const [ratingSaved, setRatingSaved] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.evals.get(id).then((r) => {
      setData(r as unknown as RunDetail);
      const rat = r.rating as Record<string, unknown> | null;
      if (rat) {
        setRatingPreferred(String(rat.preferred_candidate ?? ""));
        setRatingAccept(String(rat.router_acceptance ?? ""));
        setRatingNotes(String(rat.rating_notes ?? ""));
      }
    }).finally(() => setLoading(false));
  }, [id]);

  const exportReport = async () => {
    if (!id) return;
    setExporting(true);
    try {
      const r = await api.evals.export(id);
      setExportedReport(r.report);
      setActiveTab("report");
    } finally { setExporting(false); }
  };

  const saveRating = async () => {
    if (!id) return;
    await api.evals.rate(id, {
      preferredCandidate: ratingPreferred || null,
      routerAcceptance: ratingAccept || null,
      ratingNotes: ratingNotes || null,
    });
    setRatingSaved(true);
  };

  if (loading) return <div className="p-8"><LoadingRows count={6} /></div>;
  if (!data) return <div className="p-8"><EmptyState icon="🔍" title="Run not found" /></div>;

  const run = data.run;
  const metrics = data.metrics;
  const candidates = data.candidates as Record<string, unknown>[];

  const classification = (() => {
    try { return JSON.parse(String(run.task_classification_json ?? "{}")); } catch { return {}; }
  })();
  const recommendation = (() => {
    try { return JSON.parse(String(run.recommendation_json ?? "{}")); } catch { return {}; }
  })();
  const contextPlan = (() => {
    try { return JSON.parse(String(run.context_plan_json ?? "{}")); } catch { return {}; }
  })();
  const verificationPlan = (() => {
    try { return JSON.parse(String(run.verification_plan_json ?? "{}")); } catch { return {}; }
  })();

  return (
    <div className="max-w-7xl mx-auto p-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link to="/history" className="text-gray-500 hover:text-gray-300 text-sm">← History</Link>
            <StatusBadge status={String(run.status ?? "unknown")} />
          </div>
          <h1 className="text-lg font-bold text-gray-100 max-w-2xl">
            {String(run.task_message ?? "")}
          </h1>
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
            <span>Repo: <code>{String(run.repo_name ?? "")}</code></span>
            <span>Mode: {String(run.user_mode ?? "")}</span>
            <span>{new Date(String(run.created_at ?? "")).toLocaleString()}</span>
            <code className="text-gray-600">{String(run.id ?? "").slice(0, 8)}</code>
          </div>
        </div>
        <button onClick={exportReport} disabled={exporting} className="btn-secondary text-sm flex-shrink-0">
          {exporting ? <><Spinner size="sm" /> Exporting…</> : "📄 Export Report"}
        </button>
      </div>

      {/* Tabs */}
      <div className="tab-bar">
        {(["overview", "diffs", "tokens", "report"] as const).map((t) => (
          <button key={t} onClick={() => setActiveTab(t)} className={activeTab === t ? "tab-active" : "tab-inactive"}>
            {t === "overview" ? "Overview" : t === "diffs" ? "Diffs" : t === "tokens" ? "Tokens & Cost" : "Report"}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Classification */}
          <div className="card p-4">
            <div className="section-title">🧠 Task Classification</div>
            <dl className="space-y-2 text-sm">
              {Object.entries(classification).slice(0, 8).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2">
                  <dt className="text-gray-500 capitalize">{k.replace(/([A-Z])/g, " $1")}</dt>
                  <dd className="text-gray-200 font-mono text-xs text-right">{String(v)}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Recommendation */}
          <div className="card p-4">
            <div className="section-title">⚡ Model Recommendation</div>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500">Selected Model</dt>
                <dd><ModelLabel modelId={String(recommendation.modelId ?? "—")} isRouter /></dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500">Tier</dt>
                <dd className="text-gray-200">{String(recommendation.tier ?? "—")}</dd>
              </div>
              {recommendation.reasoning != null && (
                <div className="pt-2 border-t border-gray-800">
                  <dt className="text-gray-500 mb-1">Reasoning</dt>
                  <dd className="text-xs text-gray-400">{String(recommendation.reasoning)}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Prompt Optimization */}
          <div className="card p-4 md:col-span-2">
            <div className="section-title">✂️ Prompt Optimization</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="label mb-1">Original Task</div>
                <div className="code-block text-xs max-h-32 overflow-auto">{String(run.task_message ?? "")}</div>
              </div>
              <div>
                <div className="label mb-1">Optimized Message</div>
                <div className="code-block text-xs max-h-32 overflow-auto">{String(run.optimized_message ?? "")}</div>
              </div>
            </div>
          </div>

          {/* Metrics summary */}
          {metrics && (
            <div className="card p-4">
              <div className="section-title">💰 Cost Summary</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="stat-card">
                  <div className="stat-label">Router Cost</div>
                  <div className="stat-value text-indigo-300 text-xl">
                    <CostDisplay usd={Number(metrics.router_cost_usd ?? 0)} />
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Baseline Cost</div>
                  <div className="stat-value text-violet-300 text-xl">
                    <CostDisplay usd={Number(metrics.strong_baseline_cost_usd ?? 0)} />
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Savings</div>
                  <div className="stat-value text-emerald-300 text-xl">
                    <CostDisplay usd={Number(metrics.savings_usd ?? 0)} />
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Savings %</div>
                  <div className="pt-1"><SavingsBadge percent={Number(metrics.savings_percent ?? 0)} /></div>
                </div>
              </div>
            </div>
          )}

          {/* Human Rating */}
          <div className="card p-4">
            <div className="section-title">🧑 Human Rating</div>
            <div className="space-y-3">
              <div>
                <div className="label mb-1.5">Preferred</div>
                <div className="flex gap-1.5 flex-wrap">
                  {candidates.map((c) => (
                    <button key={String(c.label)} onClick={() => setRatingPreferred(String(c.label))}
                      className={`btn text-xs py-0.5 ${ratingPreferred === String(c.label) ? "btn-primary" : "btn-secondary"}`}>
                      {LABEL_NAMES[String(c.label)] ?? String(c.label)}
                    </button>
                  ))}
                  <button onClick={() => setRatingPreferred("same")}
                    className={`btn text-xs py-0.5 ${ratingPreferred === "same" ? "btn-primary" : "btn-secondary"}`}>
                    Same
                  </button>
                </div>
              </div>
              <div>
                <div className="label mb-1.5">Router acceptance</div>
                <div className="flex gap-1.5">
                  {["accept", "reject", "needs_review"].map(v => (
                    <button key={v} onClick={() => setRatingAccept(v)}
                      className={`btn text-xs py-0.5 ${ratingAccept === v ? "btn-primary" : "btn-secondary"}`}>{v}</button>
                  ))}
                </div>
              </div>
              <textarea className="textarea w-full h-16 text-sm" placeholder="Notes…"
                value={ratingNotes} onChange={(e) => setRatingNotes(e.target.value)} />
              <button onClick={saveRating} disabled={ratingSaved} className="btn-success text-sm">
                {ratingSaved ? "✓ Saved" : "Save Rating"}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === "diffs" && (
        <div className="space-y-4">
          {candidates.map((c) => (
            <div key={String(c.label)} className={`card overflow-hidden border-l-4 ${LABEL_COLORS[String(c.label)] ?? "border-gray-700"}`}>
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800/60 flex-wrap">
                <span className="font-semibold">{LABEL_NAMES[String(c.label)] ?? String(c.label)}</span>
                <ModelLabel modelId={String(c.model_id ?? "")} isRouter={c.label === "router"} />
                <ParseStatusBadge status={String(c.output_parse_status ?? "—")} />
                <span className="ml-auto text-xs text-gray-500">
                  {String(c.input_tokens ?? 0)} in / {String(c.output_tokens ?? 0)} out tokens
                </span>
              </div>
              {c.llm_output_json != null && (
                <div className="px-4 py-2 text-xs text-gray-400 bg-gray-800/20 border-b border-gray-800/40 line-clamp-2">
                  {String(c.llm_output_json).slice(0, 200)}
                </div>
              )}
              <div className="p-3">
                <DiffViewer diff={String(c.diff_text ?? "")} maxHeight="400px" />
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "tokens" && (
        <div className="space-y-4">
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-left bg-gray-800/30">
                  <th className="px-4 py-3 label">Candidate</th>
                  <th className="px-4 py-3 label">Model</th>
                  <th className="px-4 py-3 label text-right">Input</th>
                  <th className="px-4 py-3 label text-right">Output</th>
                  <th className="px-4 py-3 label text-right">Total</th>
                  <th className="px-4 py-3 label text-right">Cost</th>
                  <th className="px-4 py-3 label text-right">Latency</th>
                  <th className="px-4 py-3 label">Verification</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((c) => (
                  <tr key={String(c.label)} className="border-b border-gray-800/50 last:border-0 hover:bg-gray-800/20">
                    <td className="px-4 py-3 font-medium">{LABEL_NAMES[String(c.label)] ?? String(c.label)}</td>
                    <td className="px-4 py-3"><ModelLabel modelId={String(c.model_id ?? "")} /></td>
                    <td className="px-4 py-3 text-right font-mono text-xs">{Number(c.input_tokens ?? 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs">{Number(c.output_tokens ?? 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs">{Number(c.total_tokens ?? 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right"><CostDisplay usd={Number(c.estimated_cost_usd ?? 0)} /></td>
                    <td className="px-4 py-3 text-right text-gray-500 text-xs">{String(c.latency_ms ?? 0)}ms</td>
                    <td className="px-4 py-3">
                      <VerificationBadge passed={c.success != null ? Boolean(c.success) : null} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {metrics && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="stat-card">
                <div className="stat-label">Savings $</div>
                <div className="stat-value text-emerald-300 text-xl"><CostDisplay usd={Number(metrics.savings_usd ?? 0)} /></div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Savings %</div>
                <div className="pt-1"><SavingsBadge percent={Number(metrics.savings_percent ?? 0)} /></div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Prompt Reduction</div>
                <div className="stat-value text-blue-300 text-xl">{Number(metrics.prompt_token_reduction_percent ?? 0).toFixed(1)}%</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Router Success</div>
                <div className="pt-1"><VerificationBadge passed={metrics.router_success != null ? Boolean(metrics.router_success) : null} /></div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "report" && (
        <div className="card p-5">
          {exportedReport ? (
            <pre className="whitespace-pre-wrap text-xs text-gray-300 font-mono overflow-auto max-h-[70vh]">{exportedReport}</pre>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <p className="mb-4">Click "Export Report" to generate a markdown evaluation report.</p>
              <button onClick={exportReport} disabled={exporting} className="btn-primary">
                {exporting ? <><Spinner size="sm" /> Generating…</> : "📄 Generate Report"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
