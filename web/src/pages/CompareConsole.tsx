import React, { useState } from "react";
import { api } from "../api/client";
import type { CompareResult, LlmRoutingMeta } from "../api/client";

const MODES = [
  { value: "cost_saving", label: "Cost saving" },
  { value: "balanced", label: "Balanced" },
  { value: "max_quality", label: "Max quality" },
] as const;

function fmtUsd(n: number) {
  if (n === 0) return "$0";
  if (n < 0.0001) return `$${n.toFixed(6)}`;
  if (n < 0.01) return `$${n.toFixed(5)}`;
  return `$${n.toFixed(4)}`;
}

function fmtMs(n: number) {
  if (n < 1000) return `${n} ms`;
  return `${(n / 1000).toFixed(2)} s`;
}

const CLASSIFIER_MODELS = [
  { id: "anthropic/claude-haiku-4-5", label: "Claude Haiku 4.5 (recommended)" },
  { id: "openai/gpt-4o-mini",        label: "GPT-4o mini" },
  { id: "google/gemini-2.0-flash",   label: "Gemini 2.0 Flash" },
  { id: "anthropic/claude-sonnet-4-5", label: "Claude Sonnet 4.5 (overkill)" },
];

export default function CompareConsole() {
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<(typeof MODES)[number]["value"]>("cost_saving");
  const [maxTokens, setMaxTokens] = useState<number>(4096);
  const [useLlmRouting, setUseLlmRouting] = useState<boolean>(true);
  const [classifierModelId, setClassifierModelId] = useState<string>(CLASSIFIER_MODELS[0]!.id);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const r = await api.compare.run(trimmed, mode, maxTokens, {
        routingMode: useLlmRouting ? "llm_assisted" : "rule_based",
        classifierModelId: useLlmRouting ? classifierModelId : undefined,
      });
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      run();
    }
  };

  return (
    <div className="h-[calc(100vh-52px)] overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold text-gray-100">Routing console</h1>
          <p className="text-sm text-gray-500">
            Cupid picks the cheapest model that meets the task floor, then runs it side-by-side with Claude Opus 4 as the benchmark.
          </p>
        </header>

        <section className="card p-5 space-y-4">
          <textarea
            className="textarea w-full h-32 text-sm leading-relaxed"
            placeholder="Enter a prompt. e.g. Summarize the differences between SQLite WAL mode and journal mode."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={onKey}
            disabled={running}
          />
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="label">Mode</span>
              <div className="flex gap-1">
                {MODES.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setMode(m.value)}
                    disabled={running}
                    className={`btn text-xs py-1 px-3 ${mode === m.value ? "btn-primary" : "btn-secondary"}`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="label">Max output</span>
              <select
                className="select text-xs py-1"
                value={maxTokens}
                onChange={(e) => setMaxTokens(Number(e.target.value))}
                disabled={running}
                title="Maximum tokens for the LLM response"
              >
                <option value={512}>512</option>
                <option value={1024}>1,024</option>
                <option value={2048}>2,048</option>
                <option value={4096}>4,096</option>
                <option value={8192}>8,192</option>
                <option value={16384}>16,384</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useLlmRouting}
                  onChange={(e) => setUseLlmRouting(e.target.checked)}
                  disabled={running}
                  className="accent-indigo-500"
                />
                <span className="label">LLM routing</span>
              </label>
              {useLlmRouting && (
                <select
                  className="select text-xs py-1 max-w-[200px]"
                  value={classifierModelId}
                  onChange={(e) => setClassifierModelId(e.target.value)}
                  disabled={running}
                  title="Classifier model — 1 cheap call to decide task type & risk"
                >
                  {CLASSIFIER_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              )}
            </div>
            <div className="ml-auto flex items-center gap-3">
              <span className="text-xs text-gray-600 hidden sm:block">Ctrl/Cmd + Enter</span>
              <button
                onClick={run}
                disabled={running || !prompt.trim()}
                className="btn-primary"
              >
                {running ? "Running…" : "Run comparison"}
              </button>
            </div>
          </div>
        </section>

        {error && (
          <div className="card p-4 border-red-800 bg-red-950/30 text-sm text-red-300">
            <span className="font-semibold mr-2">Error:</span>
            {error}
          </div>
        )}

        {running && !result && (
          <section className="card p-8 text-center text-sm text-gray-500">
            Calling router model and Claude Opus in parallel…
          </section>
        )}

        {result && <ResultView result={result} />}
      </div>
    </div>
  );
}

function ResultView({ result }: { result: CompareResult }) {
  const { routing, router, benchmark, comparison, classification, optimizedPrompt, promptTokenSavings } = result;
  const optimized = optimizedPrompt !== result.prompt;

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Cost savings" value={`${comparison.savingsPercent.toFixed(1)}%`} sub={fmtUsd(comparison.savingsUsd) + " saved"} accent="emerald" />
        <Stat label="Router cost" value={fmtUsd(router.costUsd)} sub={fmtMs(router.latencyMs)} />
        <Stat label="Benchmark cost" value={fmtUsd(benchmark.costUsd)} sub={fmtMs(benchmark.latencyMs)} />
        <Stat label="Latency delta" value={comparison.latencyDeltaMs >= 0 ? `+${fmtMs(comparison.latencyDeltaMs)}` : fmtMs(comparison.latencyDeltaMs)} sub="benchmark vs router" />
      </section>

      <section className="card p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="label">Classification</span>
          <span className={result.routingMode === "llm_assisted" ? "badge bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/20" : "badge-gray"}>
            {result.routingMode === "llm_assisted" ? "LLM-assisted" : "rule-based"}
          </span>
          <span className="badge-indigo">{classification.taskType}</span>
          <span className="badge-gray">risk {classification.riskLevel}</span>
          <span className="badge-gray">difficulty {classification.complexity}</span>
          <span className="badge-gray">{classification.contextNeed} context</span>
        </div>

        {result.llmRouting && (
          <LlmRoutingPanel meta={result.llmRouting} ruleSnapshot={result.llmRouting.ruleBasedSnapshot} llmClassification={classification} />
        )}
        {optimized && (
          <div className="text-xs text-gray-400">
            <span className="text-gray-500">Optimized prompt</span> (saved ~{promptTokenSavings} tokens): <span className="text-gray-300">{optimizedPrompt}</span>
          </div>
        )}
        <div className="space-y-1">
          <span className="label">Routing reasoning</span>
          <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
            {routing.reasons.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
        {routing.topCandidates.length > 0 && (
          <details className="text-xs text-gray-500">
            <summary className="cursor-pointer hover:text-gray-300">Top candidates considered</summary>
            <table className="w-full mt-2 text-xs">
              <thead className="text-gray-600">
                <tr><th className="text-left pb-1 pr-4">Model</th><th className="text-left pb-1 pr-4">Tier</th><th className="text-right pb-1 pr-4">Score</th><th className="text-right pb-1">Est. cost</th></tr>
              </thead>
              <tbody>
                {routing.topCandidates.map((c) => (
                  <tr key={c.modelId} className="border-t border-gray-800/50">
                    <td className="py-1 pr-4 font-mono text-gray-300">{c.modelId}</td>
                    <td className="py-1 pr-4">{c.tier}</td>
                    <td className="py-1 pr-4 text-right font-mono">{c.score.toFixed(3)}</td>
                    <td className="py-1 text-right font-mono">{fmtUsd(c.estimatedUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        )}
      </section>

      {comparison.sameModel && (
        <div className="card-sm text-sm text-amber-300 border border-amber-800/40 bg-amber-950/20">
          Router selected the same model as the benchmark. No cost differential for this prompt.
        </div>
      )}

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ExecCard
          title="Router pick"
          subtitle="Cost-efficient route"
          accent="indigo"
          exec={router}
        />
        <ExecCard
          title="Benchmark"
          subtitle="Claude Opus 4"
          accent="violet"
          exec={benchmark}
          muted={comparison.sameModel}
        />
      </section>
    </div>
  );
}

function ExecCard({
  title, subtitle, accent, exec, muted,
}: {
  title: string;
  subtitle: string;
  accent: "indigo" | "violet";
  exec: CompareResult["router"];
  muted?: boolean;
}) {
  const border = accent === "indigo" ? "border-l-indigo-500" : "border-l-violet-500";
  const tag = accent === "indigo" ? "badge-indigo" : "badge-purple";

  return (
    <div className={`card border-l-4 ${border} ${muted ? "opacity-60" : ""} p-4 flex flex-col gap-3`}>
      <header className="space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm text-gray-100">{title}</span>
          <span className={tag}>{exec.tier}</span>
        </div>
        <div className="text-xs text-gray-500">{subtitle}</div>
        <div className="font-mono text-xs text-gray-400 break-all">{exec.modelId}</div>
      </header>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <Metric label="Cost" value={fmtUsd(exec.costUsd)} />
        <Metric label="Latency" value={fmtMs(exec.latencyMs)} />
        <Metric label="Tokens" value={`${exec.inputTokens.toLocaleString()} → ${exec.outputTokens.toLocaleString()}`} />
      </div>

      {exec.error ? (
        <div className="text-xs text-red-300 bg-red-950/30 border border-red-900/40 rounded p-3 font-mono break-all">
          {exec.error}
        </div>
      ) : (
        <div className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed bg-gray-950/60 border border-gray-800 rounded-lg p-3 max-h-[480px] overflow-y-auto">
          {exec.response || <span className="text-gray-600 italic">(empty response)</span>}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: "emerald" }) {
  const color = accent === "emerald" ? "text-emerald-300" : "text-gray-100";
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${color}`}>{value}</div>
      {sub && <div className="text-xs text-gray-500">{sub}</div>}
    </div>
  );
}

function LlmRoutingPanel({
  meta,
  ruleSnapshot,
  llmClassification,
}: {
  meta: LlmRoutingMeta;
  ruleSnapshot: LlmRoutingMeta["ruleBasedSnapshot"];
  llmClassification: CompareResult["classification"];
}) {
  const diffs: Array<{ field: string; rule: string; llm: string }> = [];
  if (ruleSnapshot.taskType !== llmClassification.taskType)
    diffs.push({ field: "task_type", rule: ruleSnapshot.taskType, llm: String(llmClassification.taskType) });
  if (ruleSnapshot.riskLevel !== llmClassification.riskLevel)
    diffs.push({ field: "risk_level", rule: String(ruleSnapshot.riskLevel), llm: String(llmClassification.riskLevel) });
  if (ruleSnapshot.difficulty !== llmClassification.complexity)
    diffs.push({ field: "difficulty", rule: String(ruleSnapshot.difficulty), llm: String(llmClassification.complexity) });
  if (ruleSnapshot.contextNeed !== llmClassification.contextNeed)
    diffs.push({ field: "context_need", rule: ruleSnapshot.contextNeed, llm: String(llmClassification.contextNeed) });

  return (
    <div className="card-sm border-l-2 border-l-violet-500 space-y-2">
      <div className="flex items-center gap-2 flex-wrap text-xs">
        <span className="label">LLM classifier</span>
        <span className="badge-purple font-mono">{meta.modelId}</span>
        <span className="text-gray-500">${meta.costUsd.toFixed(6)}</span>
        <span className="text-gray-500">{meta.latencyMs}ms</span>
        <span className="text-gray-500">{meta.inputTokens}→{meta.outputTokens} tok</span>
        {meta.fellBackToRules && (
          <span className="badge-yellow" title={meta.errorMessage}>fell back to rules</span>
        )}
      </div>
      {meta.rationale && (
        <div className="text-xs text-gray-300 italic">"{meta.rationale}"</div>
      )}
      {diffs.length > 0 ? (
        <div>
          <div className="label-sm mb-1">LLM overrides vs rules</div>
          <table className="w-full text-[11px]">
            <thead className="text-gray-600">
              <tr><th className="text-left">Field</th><th className="text-left">Rule-based</th><th className="text-left">LLM</th></tr>
            </thead>
            <tbody>
              {diffs.map((d) => (
                <tr key={d.field} className="border-t border-gray-800/40">
                  <td className="font-mono text-gray-400">{d.field}</td>
                  <td className="font-mono text-gray-500">{d.rule}</td>
                  <td className="font-mono text-violet-300">{d.llm}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-[11px] text-gray-600 italic">LLM agreed with rule-based classification on all fields.</div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-gray-500 uppercase tracking-wider text-[10px] font-semibold">{label}</div>
      <div className="text-gray-200 font-mono mt-0.5">{value}</div>
    </div>
  );
}
