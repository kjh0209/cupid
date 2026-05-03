import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { EvalRunRecord } from "../api/client";
import { StatusBadge, SavingsBadge, CostDisplay, LoadingRows, EmptyState } from "../components/ui";

export default function EvalHistory() {
  const [runs, setRuns] = useState<EvalRunRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const limit = 20;

  const load = async (offset: number) => {
    setLoading(true);
    try {
      const r = await api.evals.list(limit, offset);
      setRuns(r.runs);
      setTotal(r.total);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(page * limit); }, [page]);

  const statusColor: Record<string, string> = {
    completed: "text-emerald-400",
    running: "text-blue-400",
    failed: "text-red-400",
  };

  const expLabel: Record<string, string> = {
    router_vs_strong: "Router vs Strong",
    router_vs_cheap_vs_strong: "Router vs Cheap vs Strong",
    manual_vs_router: "Manual vs Router",
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gradient">Evaluation History</h1>
          <p className="text-sm text-gray-500 mt-1">{total} total runs</p>
        </div>
        <Link to="/" className="btn-primary text-sm">+ New Evaluation</Link>
      </div>

      {loading ? (
        <LoadingRows count={8} />
      ) : runs.length === 0 ? (
        <EmptyState icon="📭" title="No evaluation runs yet" desc="Run your first evaluation from the Workbench" />
      ) : (
        <>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-left">
                  <th className="px-4 py-3 label">Task</th>
                  <th className="px-4 py-3 label">Repo</th>
                  <th className="px-4 py-3 label">Mode</th>
                  <th className="px-4 py-3 label">Status</th>
                  <th className="px-4 py-3 label text-right">Router Cost</th>
                  <th className="px-4 py-3 label text-right">Baseline Cost</th>
                  <th className="px-4 py-3 label text-right">Savings</th>
                  <th className="px-4 py-3 label">Preference</th>
                  <th className="px-4 py-3 label">Created</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => {
                  const cls = (() => {
                    try { return JSON.parse(r.task_classification_json ?? "{}"); } catch { return {}; }
                  })();
                  return (
                    <tr key={r.id} className="border-b border-gray-800/50 last:border-0 hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <Link to={`/evals/${r.id}`} className="text-indigo-300 hover:text-indigo-200 font-medium line-clamp-2 max-w-xs block">
                          {r.task_message?.slice(0, 80)}{(r.task_message?.length ?? 0) > 80 ? "…" : ""}
                        </Link>
                        {cls.taskType && <span className="text-xs text-gray-500">{String(cls.taskType)}</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-400 font-mono text-xs">{r.repo_name}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{expLabel[r.experiment_mode] ?? r.experiment_mode}</td>
                      <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                      <td className="px-4 py-3 text-right font-mono text-xs">
                        <CostDisplay usd={r.router_cost_usd ?? 0} />
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs">
                        <CostDisplay usd={r.strong_baseline_cost_usd ?? 0} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        {r.savings_percent != null ? <SavingsBadge percent={r.savings_percent} /> : <span className="text-gray-600">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {r.preferred_candidate ? (
                          <span className="badge-indigo">{r.preferred_candidate}</span>
                        ) : (
                          <span className="text-gray-600 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {new Date(r.created_at).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-gray-500">
              Showing {page * limit + 1}–{Math.min((page + 1) * limit, total)} of {total}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="btn-secondary text-xs">← Prev</button>
              <button onClick={() => setPage((p) => p + 1)} disabled={(page + 1) * limit >= total} className="btn-secondary text-xs">Next →</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
