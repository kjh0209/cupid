import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { AggregateStats } from "../api/client";
import { LoadingRows, EmptyState, SavingsBadge, CostDisplay } from "../components/ui";

export default function AggregateStats() {
  const [stats, setStats] = useState<AggregateStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.stats.aggregate().then(setStats).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8"><LoadingRows count={6} /></div>;
  if (!stats) return <div className="p-8"><EmptyState icon="📊" title="No stats available" /></div>;

  const successRate = stats.completedRuns > 0
    ? ((stats.routerSuccessCount / stats.completedRuns) * 100).toFixed(1)
    : "0";

  return (
    <div className="max-w-5xl mx-auto p-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gradient">Aggregate Stats</h1>
        <p className="text-sm text-gray-500 mt-1">Summary across all evaluation runs</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="stat-card">
          <div className="stat-label">Total Runs</div>
          <div className="stat-value">{stats.totalRuns}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Completed</div>
          <div className="stat-value text-emerald-300">{stats.completedRuns}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg Savings</div>
          <div className="pt-1">
            <SavingsBadge percent={stats.averageSavingsPercent} />
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg Router Cost</div>
          <div className="stat-value text-indigo-300 text-xl">
            <CostDisplay usd={stats.averageRouterCostUsd} />
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Router Successes</div>
          <div className="stat-value text-emerald-300">{stats.routerSuccessCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Success Rate</div>
          <div className="stat-value">{successRate}%</div>
        </div>
      </div>

      {/* Top task types */}
      <div className="card p-4 mb-4">
        <div className="section-title">🏆 Top Task Types by Savings</div>
        {stats.topTaskTypes.length === 0 ? (
          <p className="text-sm text-gray-500">No task type data yet. Run more evaluations.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left">
                <th className="pb-2 label">Task Type</th>
                <th className="pb-2 label text-right">Runs</th>
                <th className="pb-2 label text-right">Avg Savings</th>
                <th className="pb-2 label">Savings Bar</th>
              </tr>
            </thead>
            <tbody>
              {stats.topTaskTypes.map((t) => (
                <tr key={t.task_type} className="border-b border-gray-800/50 last:border-0">
                  <td className="py-2 pr-4 font-medium">{t.task_type ?? "unknown"}</td>
                  <td className="py-2 pr-4 text-right text-gray-400">{t.count}</td>
                  <td className="py-2 pr-4 text-right">
                    <SavingsBadge percent={t.avg_savings ?? 0} />
                  </td>
                  <td className="py-2">
                    <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500"
                        style={{ width: `${Math.min(100, Math.max(0, t.avg_savings ?? 0))}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {stats.totalRuns === 0 && (
        <div className="card p-8 text-center">
          <EmptyState icon="🚀" title="No evaluations yet"
            desc="Run your first evaluation from the Workbench to start collecting stats." />
          <Link to="/" className="btn-primary mt-4 inline-flex">Go to Workbench</Link>
        </div>
      )}
    </div>
  );
}
