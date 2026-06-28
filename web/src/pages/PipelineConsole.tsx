import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/client";
import type {
  PipelineContext,
  PipelineDone,
  PipelineResult,
  PipelineTraceStep,
  PipelineAuctionScore,
  StorageInspect,
} from "../api/client";

// ──────────────────────────────────────────────────────────────────────
// CUPID Pipeline Console
//   Mirrors the technical workflow diagram:
//     User prompt → Cupid Engine → Prompt Optimizer
//                            ↓
//                    Context Storage → Model Execution
//
//   This page is fully isolated from /api/compare. It calls the new
//   /api/cupid/pipeline/trace endpoint and streams each step as SSE so
//   nodes light up sequentially.
// ──────────────────────────────────────────────────────────────────────

type Phase = "idle" | "running" | "done" | "error";

const NODES = [
  { key: "prompt_intake",      title: "User Prompt",                short: "Prompt",     x: 40,  y: 70 },
  { key: "intent_detection",   title: "Prompt-engineered Cupid Engine", short: "Cupid Engine", x: 320, y: 70 },
  { key: "auction",            title: "Prompt Optimizer",           short: "Optimizer",  x: 620, y: 70 },
  { key: "cpl_compression",    title: "Context Preservation",       short: "Compress",   x: 40,  y: 250 },
  { key: "context_storage",    title: "Context Storage",            short: "Storage",    x: 320, y: 250 },
  { key: "model_execution",    title: "Model Execution",            short: "Execute",    x: 620, y: 250 },
] as const;

const EDGES: Array<[string, string, string]> = [
  ["prompt_intake", "intent_detection", "user prompt"],
  ["intent_detection", "auction", "we choose the right model"],
  ["auction", "cpl_compression", "we compress the prompt"],
  ["cpl_compression", "context_storage", "store fragment"],
  ["context_storage", "model_execution", "we load shared context"],
];

const SAMPLES: Array<{ label: string; prompt: string; ctx: PipelineContext }> = [
  {
    label: "Fix error in CSS file",
    prompt: "There is an error in line 56, fix it",
    ctx: { fileName: "app.css", activeLanguage: "css", fileLineCount: 520, hasTerminalError: true, hasHighlightedText: false, rawCodePayload: defaultDummy(), gitDiffText: null },
  },
  {
    label: "Write commit message (diff)",
    prompt: "Write a commit message for this",
    ctx: { fileName: "auth.ts", activeLanguage: "typescript", fileLineCount: 320, hasTerminalError: false, hasHighlightedText: false, rawCodePayload: defaultDummy(), gitDiffText: "+ const token = getJWT();\n- const token = null;" },
  },
  {
    label: "Explain C++ memory architecture",
    prompt: "Explain the architecture of this memory management",
    ctx: { fileName: "memory.cpp", activeLanguage: "cpp", fileLineCount: 800, hasTerminalError: false, hasHighlightedText: false, rawCodePayload: defaultDummy(), gitDiffText: null },
  },
  {
    label: "Refactor highlighted JS",
    prompt: "Refactor this highlighted function to be faster",
    ctx: { fileName: "utils.js", activeLanguage: "javascript", fileLineCount: 420, hasTerminalError: false, hasHighlightedText: true, rawCodePayload: defaultDummy(), gitDiffText: null },
  },
];

function defaultDummy(): string {
  return ("import { api } from 'core';\n" + "// This is a comment\n\n\nconst x = 1;\n").repeat(120);
}

function fmtMs(n: number): string {
  if (n < 1) return `${n.toFixed(2)} ms`;
  if (n < 1000) return `${n.toFixed(1)} ms`;
  return `${(n / 1000).toFixed(2)} s`;
}
function fmtUsd(n: number): string {
  if (n === 0) return "$0";
  if (Math.abs(n) < 0.0001) return `$${n.toFixed(6)}`;
  if (Math.abs(n) < 0.01) return `$${n.toFixed(5)}`;
  return `$${n.toFixed(4)}`;
}

export default function PipelineConsole() {
  const [prompt, setPrompt] = useState(SAMPLES[0]!.prompt);
  const [ctx, setCtx] = useState<PipelineContext>(SAMPLES[0]!.ctx);
  const [sessionKey, setSessionKey] = useState("workspace::demo");
  const [phase, setPhase] = useState<Phase>("idle");
  const [activeStep, setActiveStep] = useState<string | null>(null);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [steps, setSteps] = useState<PipelineTraceStep[]>([]);
  const [done, setDone] = useState<PipelineDone | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [storage, setStorage] = useState<StorageInspect | null>(null);
  const [useStream, setUseStream] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const refreshStorage = async () => {
    try {
      setStorage(await api.cupid.storage(sessionKey));
    } catch { /* ignore */ }
  };

  useEffect(() => { void refreshStorage(); /* eslint-disable-next-line */ }, [sessionKey]);

  const run = async () => {
    if (!prompt.trim()) return;
    setPhase("running");
    setError(null);
    setSteps([]);
    setDone(null);
    setCompleted(new Set());
    setActiveStep(NODES[0]!.key);

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    if (!useStream) {
      // Non-stream path: single POST, then replay steps client-side with delays
      try {
        const r = await api.cupid.runOnce(prompt, ctx, sessionKey);
        for (const step of r.steps) {
          setSteps((s) => [...s, step]);
          setActiveStep(step.step);
          setCompleted((c) => new Set([...c, step.step]));
          await new Promise((res) => setTimeout(res, 220));
        }
        setDone({
          intent: r.intent,
          routedModel: r.routedModel,
          totals: r.totals,
          compressed: r.compressed,
          auction: r.auction,
          storage: r.storage,
        });
        setActiveStep(null);
        setPhase("done");
        void refreshStorage();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setPhase("error");
      }
      return;
    }

    // Stream path (SSE) — POST via fetch + manual SSE parsing
    try {
      const res = await fetch("/api/cupid/pipeline/trace", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({ prompt, context: ctx, sessionKey, stream: true }),
        signal: abortRef.current.signal,
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done: streamDone } = await reader.read();
        if (streamDone) break;
        buf += decoder.decode(value, { stream: true });
        // Tolerate both \n\n and \r\n\r\n delimiters
        let idx;
        while (true) {
          const i1 = buf.indexOf("\n\n");
          const i2 = buf.indexOf("\r\n\r\n");
          if (i1 === -1 && i2 === -1) break;
          let cut: number;
          let skip: number;
          if (i1 === -1) { cut = i2; skip = 4; }
          else if (i2 === -1) { cut = i1; skip = 2; }
          else { cut = Math.min(i1, i2); skip = cut === i2 ? 4 : 2; }
          idx = cut;
          const block = buf.slice(0, idx);
          buf = buf.slice(idx + skip);
          let event = "message";
          let data = "";
          for (const rawLine of block.split(/\r?\n/)) {
            if (rawLine.startsWith("event: ")) event = rawLine.slice(7).trim();
            else if (rawLine.startsWith("data: ")) data += rawLine.slice(6);
            else if (rawLine.startsWith(":")) { /* comment/ping */ }
          }
          if (!data) continue;
          try {
            const parsed = JSON.parse(data);
            if (event === "step") {
              const step = parsed as PipelineTraceStep;
              setSteps((s) => [...s, step]);
              setActiveStep(step.step);
              setCompleted((c) => new Set([...c, step.step]));
            } else if (event === "done") {
              setDone(parsed as PipelineDone);
              setPhase("done");
              setActiveStep(null);
              void refreshStorage();
            } else if (event === "error") {
              setError(String(parsed.message ?? parsed));
              setPhase("error");
            }
          } catch { /* swallow parse */ }
        }
      }
    } catch (e) {
      if ((e as { name?: string })?.name === "AbortError") return;
      setError(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  };

  const applySample = (i: number) => {
    const s = SAMPLES[i]!;
    setPrompt(s.prompt);
    setCtx(s.ctx);
    setPhase("idle");
    setSteps([]);
    setDone(null);
    setCompleted(new Set());
    setActiveStep(null);
  };

  const result = useMemo<PipelineResult | null>(() => {
    if (!done) return null;
    return { ...done, prompt, steps };
  }, [done, prompt, steps]);

  return (
    <div className="h-[calc(100vh-52px)] overflow-y-auto">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold text-gray-100">
            <span className="text-gradient">CUPID Pipeline</span> — Live Trace
          </h1>
          <p className="text-sm text-gray-500">
            Visualizes the rule-based engine end-to-end: prompt intake → intent auction → CPL compression → shared context storage → model execution. Independent from the Compare console.
          </p>
        </header>

        {/* Input panel */}
        <section className="card p-5 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="label">Sample scenarios</span>
            {SAMPLES.map((s, i) => (
              <button key={s.label} onClick={() => applySample(i)} className="btn-secondary text-xs py-1 px-3">
                {s.label}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-2">
              <label className="flex items-center gap-1 cursor-pointer text-xs">
                <input type="checkbox" checked={useStream} onChange={(e) => setUseStream(e.target.checked)} className="accent-indigo-500" />
                <span className="label-sm">stream (SSE)</span>
              </label>
              <span className="label-sm">Session</span>
              <input
                className="input text-xs py-1 w-40"
                value={sessionKey}
                onChange={(e) => setSessionKey(e.target.value)}
              />
              <button
                onClick={async () => { await api.cupid.resetStorage(sessionKey); await refreshStorage(); }}
                className="btn-ghost text-xs py-1 px-2"
                title="Reset shared context for this session"
              >
                Reset cache
              </button>
            </div>
          </div>
          <textarea
            className="textarea w-full h-24 text-sm"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter a user prompt to trace through the pipeline"
            disabled={phase === "running"}
          />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <CtxField label="file" value={ctx.fileName ?? ""} onChange={(v) => setCtx({ ...ctx, fileName: v })} />
            <CtxField label="language" value={ctx.activeLanguage ?? ""} onChange={(v) => setCtx({ ...ctx, activeLanguage: v })} />
            <CtxField label="lines" value={String(ctx.fileLineCount ?? 0)} onChange={(v) => setCtx({ ...ctx, fileLineCount: parseInt(v) || 0 })} />
            <CtxToggle label="hasTerminalError" value={!!ctx.hasTerminalError} onChange={(v) => setCtx({ ...ctx, hasTerminalError: v })} />
            <CtxToggle label="hasHighlightedText" value={!!ctx.hasHighlightedText} onChange={(v) => setCtx({ ...ctx, hasHighlightedText: v })} />
            <CtxToggle label="hasGitDiff" value={!!ctx.gitDiffText} onChange={(v) => setCtx({ ...ctx, gitDiffText: v ? "+ added\n- removed" : null })} />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={run}
              disabled={phase === "running" || !prompt.trim()}
              className="btn-run"
            >
              {phase === "running" ? "Tracing pipeline…" : "Run pipeline"}
            </button>
            {error && <span className="text-xs text-red-400">{error}</span>}
            {result && (
              <div className="ml-auto flex items-center gap-3 text-xs text-gray-400">
                <span>Intent: <span className="text-indigo-300">{result.intent}</span></span>
                <span>Routed: <span className="text-emerald-300">{result.routedModel}</span></span>
                <span>Tokens saved: <span className="text-emerald-300">{result.totals.tokensSaved.toLocaleString()}</span></span>
                <span>Cost saved: <span className="text-emerald-300">{fmtUsd(result.totals.estimatedCostSavingsUsd)}</span></span>
              </div>
            )}
          </div>
        </section>

        {/* Flow diagram */}
        <section className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="section-title">Technical workflow</h2>
            <div className="flex items-center gap-3 text-[11px] text-gray-500">
              <LegendDot color="indigo" label="active" />
              <LegendDot color="emerald" label="done" />
              <LegendDot color="gray" label="pending" />
            </div>
          </div>
          <FlowDiagram completed={completed} active={activeStep} />
        </section>

        {/* Step-by-step metric cards */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <IntentCard step={findStep(steps, "intent_detection")} />
          <AuctionCard step={findStep(steps, "auction")} />
          <CompressionCard step={findStep(steps, "cpl_compression")} done={done} />
          <StorageCard step={findStep(steps, "context_storage")} storage={storage} sessionKey={sessionKey} />
          <ExecutionCard step={findStep(steps, "model_execution")} done={done} />
          <TimingCard steps={steps} />
        </section>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// SVG flow diagram
// ──────────────────────────────────────────────────────────────────────
function FlowDiagram({ completed, active }: { completed: Set<string>; active: string | null }) {
  const W = 840;
  const H = 380;
  const cardW = 180;
  const cardH = 80;

  const nodeColor = (key: string) => {
    if (active === key) return { fill: "#4f46e5", stroke: "#818cf8", glow: "url(#glow-indigo)" };
    if (completed.has(key)) return { fill: "#065f46", stroke: "#10b981", glow: "" };
    return { fill: "#1f2937", stroke: "#374151", glow: "" };
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      <defs>
        <filter id="glow-indigo" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
          <path d="M0,0 L8,3 L0,6 Z" fill="#6b7280" />
        </marker>
      </defs>

      {/* Edges */}
      {EDGES.map(([from, to, label], i) => {
        const a = NODES.find((n) => n.key === from)!;
        const b = NODES.find((n) => n.key === to)!;
        const ax = a.x + cardW / 2;
        const ay = a.y + cardH / 2;
        const bx = b.x + cardW / 2;
        const by = b.y + cardH / 2;
        const isLit = completed.has(from);
        const color = isLit ? "#10b981" : "#4b5563";
        const isAuctionToCpl = from === "auction" && to === "cpl_compression";
        // Routed path for the loop: optimizer (right top) → compress (left bottom)
        const pathD = isAuctionToCpl
          ? `M ${a.x + cardW / 2} ${a.y + cardH}
             C ${a.x + cardW / 2} ${a.y + cardH + 60},
               ${b.x + cardW / 2} ${b.y - 60},
               ${b.x + cardW / 2} ${b.y}`
          : `M ${ax} ${ay} L ${bx} ${by}`;
        return (
          <g key={i}>
            <path
              d={pathD}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeDasharray={isLit ? "0" : "4 4"}
              markerEnd="url(#arrow)"
            />
            {!isAuctionToCpl && (
              <text
                x={(ax + bx) / 2}
                y={(ay + by) / 2 - 8}
                textAnchor="middle"
                className="text-[10px]"
                fill="#9ca3af"
              >
                {label}
              </text>
            )}
          </g>
        );
      })}

      {/* Nodes */}
      {NODES.map((n) => {
        const c = nodeColor(n.key);
        return (
          <g key={n.key} filter={c.glow}>
            <rect
              x={n.x}
              y={n.y}
              width={cardW}
              height={cardH}
              rx={10}
              fill={c.fill}
              stroke={c.stroke}
              strokeWidth={2}
            />
            <text
              x={n.x + cardW / 2}
              y={n.y + cardH / 2 - 4}
              textAnchor="middle"
              className="text-xs font-semibold"
              fill="#f3f4f6"
            >
              {n.title.length > 22 ? n.short : n.title}
            </text>
            <text
              x={n.x + cardW / 2}
              y={n.y + cardH / 2 + 14}
              textAnchor="middle"
              className="text-[10px]"
              fill={active === n.key ? "#c7d2fe" : completed.has(n.key) ? "#a7f3d0" : "#6b7280"}
            >
              {active === n.key ? "running…" : completed.has(n.key) ? "done" : "pending"}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function LegendDot({ color, label }: { color: "indigo" | "emerald" | "gray"; label: string }) {
  const bg = color === "indigo" ? "bg-indigo-500" : color === "emerald" ? "bg-emerald-500" : "bg-gray-600";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-2.5 h-2.5 rounded-full ${bg}`} />
      <span>{label}</span>
    </span>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Step metric cards
// ──────────────────────────────────────────────────────────────────────
function findStep(steps: PipelineTraceStep[], key: PipelineTraceStep["step"]): PipelineTraceStep | undefined {
  return steps.find((s) => s.step === key);
}

function IntentCard({ step }: { step?: PipelineTraceStep }) {
  if (!step) return <PendingCard title="Intent Detection" subtitle="Cupid Engine" />;
  const o = step.output as { intent: string; confidence: number; intentScores: Record<string, number>; matchedTokens: Array<{ token: string; intent: string; weight: number }>; rulesTriggered: string[] };
  const maxScore = Math.max(0.0001, ...Object.values(o.intentScores ?? {}));
  return (
    <article className="card p-4 space-y-3 animate-fade-in">
      <header className="flex items-center justify-between">
        <h3 className="section-title m-0">① Intent Detection</h3>
        <span className="badge-indigo">{o.intent} · {(o.confidence * 100).toFixed(0)}%</span>
      </header>

      <div>
        <div className="label-sm mb-1">Intent score distribution</div>
        <div className="space-y-1">
          {Object.entries(o.intentScores ?? {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
            <div key={k} className="flex items-center gap-2 text-xs">
              <span className="w-32 text-gray-400">{k}</span>
              <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500" style={{ width: `${(v / maxScore) * 100}%` }} />
              </div>
              <span className="w-10 text-right font-mono text-gray-300">{v.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>

      {o.matchedTokens?.length > 0 && (
        <div>
          <div className="label-sm mb-1">Matched lexical tokens</div>
          <div className="flex flex-wrap gap-1.5">
            {o.matchedTokens.map((t, i) => (
              <span key={i} className="badge bg-indigo-500/10 text-indigo-300 ring-1 ring-indigo-500/20 font-mono">
                {t.token} → {t.intent} <span className="text-gray-500 ml-1">+{t.weight}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {o.rulesTriggered?.length > 0 && (
        <div>
          <div className="label-sm mb-1">Contextual rules triggered</div>
          <ul className="text-xs text-amber-300 list-disc list-inside">
            {o.rulesTriggered.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}

      <Footer step={step} />
    </article>
  );
}

function AuctionCard({ step }: { step?: PipelineTraceStep }) {
  if (!step) return <PendingCard title="Model Auction" subtitle="Prompt Optimizer" />;
  const o = step.output as {
    intent: string;
    dials: { alpha: number; beta: number; gamma: number; delta: number };
    scores: PipelineAuctionScore[];
    winner: { id: string };
    override?: string;
  };
  const min = Math.min(...o.scores.map((s) => s.total));
  const max = Math.max(...o.scores.map((s) => s.total));
  const range = Math.max(0.0001, max - min);

  return (
    <article className="card p-4 space-y-3 animate-fade-in">
      <header className="flex items-center justify-between">
        <h3 className="section-title m-0">② Model Auction</h3>
        <span className="badge-green">winner: {o.winner.id}</span>
      </header>

      <div className="flex flex-wrap gap-2 text-[11px]">
        <Dial k="α" v={o.dials.alpha} hint="quality" />
        <Dial k="β" v={o.dials.beta} hint="cost penalty" />
        <Dial k="γ" v={o.dials.gamma} hint="latency penalty" />
        <Dial k="δ" v={o.dials.delta} hint="risk penalty" />
        {o.override && <span className="badge-yellow">override: {o.override}</span>}
      </div>

      <div>
        <div className="label-sm mb-1">Bid breakdown (Q − C − L − R)</div>
        <div className="space-y-1.5">
          {o.scores.map((s) => {
            const pct = ((s.total - min) / range) * 100;
            const winner = s.modelId === o.winner.id;
            return (
              <div key={s.modelId} className="flex items-center gap-2 text-xs">
                <span className={`w-36 truncate font-mono ${winner ? "text-emerald-300" : "text-gray-300"}`}>{s.modelId}</span>
                <div className="flex-1 h-3 bg-gray-800 rounded overflow-hidden flex">
                  <div className="h-full bg-emerald-600/70" style={{ width: `${(s.weightedQuality / Math.max(1, s.weightedQuality + s.weightedCost + s.weightedLatency + s.weightedRisk)) * 60}%` }} />
                  <div className="h-full bg-red-700/60" style={{ width: `${(s.weightedCost / Math.max(1, s.weightedQuality + s.weightedCost + s.weightedLatency + s.weightedRisk)) * 30}%` }} />
                  <div className="h-full bg-yellow-700/50" style={{ width: `${(s.weightedLatency / Math.max(1, s.weightedQuality + s.weightedCost + s.weightedLatency + s.weightedRisk)) * 30}%` }} />
                  <div className="h-full bg-purple-700/50" style={{ width: `${(s.weightedRisk / Math.max(1, s.weightedQuality + s.weightedCost + s.weightedLatency + s.weightedRisk)) * 30}%` }} />
                </div>
                <span className={`w-14 text-right font-mono ${winner ? "text-emerald-300" : "text-gray-400"}`}>
                  {s.total.toFixed(2)}
                </span>
                <span className="w-8 text-right text-[10px] text-gray-600">{pct.toFixed(0)}%</span>
              </div>
            );
          })}
        </div>
        <div className="flex gap-3 text-[10px] text-gray-500 mt-2">
          <span><span className="inline-block w-2 h-2 bg-emerald-600 mr-1" />quality</span>
          <span><span className="inline-block w-2 h-2 bg-red-700 mr-1" />cost</span>
          <span><span className="inline-block w-2 h-2 bg-yellow-700 mr-1" />latency</span>
          <span><span className="inline-block w-2 h-2 bg-purple-700 mr-1" />risk</span>
        </div>
      </div>

      <Footer step={step} />
    </article>
  );
}

function Dial({ k, v, hint }: { k: string; v: number; hint: string }) {
  const accent = v > 1 ? "text-indigo-300" : v < 1 ? "text-gray-500" : "text-gray-300";
  return (
    <span className="badge-gray font-mono">
      {k}=<span className={accent}>{v.toFixed(2)}</span>
      <span className="text-gray-600 ml-1">({hint})</span>
    </span>
  );
}

function CompressionCard({ step, done }: { step?: PipelineTraceStep; done: PipelineDone | null }) {
  if (!step) return <PendingCard title="Compression (CPL)" subtitle="Context Preservation Layer" />;
  const o = step.output as {
    originalChars: number;
    compressedChars: number;
    originalTokens: number;
    compressedTokens: number;
    rulesApplied: string[];
    diffSnippets: Array<{ type: "removed" | "kept"; line: string }>;
  };
  const ratio = o.originalTokens > 0 ? (o.compressedTokens / o.originalTokens) * 100 : 0;

  return (
    <article className="card p-4 space-y-3 animate-fade-in">
      <header className="flex items-center justify-between">
        <h3 className="section-title m-0">③ Context Preservation Layer</h3>
        <span className="badge-green">
          {o.originalTokens.toLocaleString()} → {o.compressedTokens.toLocaleString()} tokens
        </span>
      </header>

      <div>
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>Compression ratio</span>
          <span className="font-mono">{ratio.toFixed(1)}% kept</span>
        </div>
        <div className="h-3 bg-gray-800 rounded overflow-hidden">
          <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-700" style={{ width: `${Math.min(100, ratio)}%` }} />
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {o.rulesApplied.length === 0 ? (
          <span className="text-xs text-gray-500">No CPL rules applied (payload passthrough)</span>
        ) : o.rulesApplied.map((r) => (
          <span key={r} className="badge-purple">{r}</span>
        ))}
      </div>

      <div>
        <div className="label-sm mb-1">Before / after fragments (first 30)</div>
        <div className="code-block max-h-48 overflow-auto">
          <pre>
            {o.diffSnippets.map((d, i) => (
              <div key={i} className={d.type === "removed" ? "diff-remove px-1" : "diff-add px-1"}>
                <span className="text-gray-600 mr-2">{d.type === "removed" ? "−" : "+"}</span>
                {d.line.slice(0, 200)}
              </div>
            ))}
          </pre>
        </div>
      </div>

      {done && (
        <div className="flex justify-between text-xs text-gray-400">
          <span>Baseline tokens</span>
          <span className="font-mono">{done.totals.baselineTokens.toLocaleString()} → final {done.totals.finalTokens.toLocaleString()}</span>
        </div>
      )}

      <Footer step={step} />
    </article>
  );
}

function StorageCard({ step, storage, sessionKey }: { step?: PipelineTraceStep; storage: StorageInspect | null; sessionKey: string }) {
  if (!step) return <PendingCard title="Context Storage" subtitle="Shared context cache" />;
  const o = step.output as { sessionKey: string; fragmentCount: number; cacheHit: boolean; bytesStored: number; freshlyAddedKeys: string[] };

  return (
    <article className="card p-4 space-y-3 animate-fade-in">
      <header className="flex items-center justify-between">
        <h3 className="section-title m-0">④ Context Storage</h3>
        <span className={o.cacheHit ? "badge-green" : "badge-blue"}>{o.cacheHit ? "CACHE HIT" : "CACHE MISS"}</span>
      </header>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <Metric label="Session" value={<span className="font-mono text-[11px] break-all">{sessionKey}</span>} />
        <Metric label="Fragments" value={String(o.fragmentCount)} />
        <Metric label="Bytes stored" value={o.bytesStored.toLocaleString()} />
      </div>

      {storage && storage.fragments.length > 0 && (
        <div>
          <div className="label-sm mb-1">Stored fragments (live)</div>
          <div className="max-h-44 overflow-auto space-y-1">
            {storage.fragments.map((f) => (
              <div key={f.key} className="flex items-start gap-2 text-[11px] py-1 border-b border-gray-800/50">
                <span className="font-mono text-indigo-300 w-44 truncate">{f.key}</span>
                <span className="text-gray-500 font-mono w-16">{f.bytes.toLocaleString()}B</span>
                <span className="text-gray-500 font-mono w-12">hits {f.hits}</span>
                <span className="text-gray-600 flex-1 truncate">{f.preview}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Footer step={step} />
    </article>
  );
}

function ExecutionCard({ step, done }: { step?: PipelineTraceStep; done: PipelineDone | null }) {
  if (!step) return <PendingCard title="Model Execution" subtitle="Routed model call (simulated)" />;
  const o = step.output as { model: string; finalTokens: number; finalCostUsd: number; baselineCostUsd: number };
  const saved = o.baselineCostUsd - o.finalCostUsd;
  const savedPct = o.baselineCostUsd > 0 ? (saved / o.baselineCostUsd) * 100 : 0;
  return (
    <article className="card p-4 space-y-3 animate-fade-in">
      <header className="flex items-center justify-between">
        <h3 className="section-title m-0">⑤ Model Execution</h3>
        <span className="badge-green">{o.model}</span>
      </header>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <Metric label="Final tokens" value={o.finalTokens.toLocaleString()} />
        <Metric label="Final cost" value={fmtUsd(o.finalCostUsd)} />
        <Metric label="Baseline cost (Opus)" value={fmtUsd(o.baselineCostUsd)} />
      </div>
      <div className="border-t border-gray-800 pt-3 flex items-center justify-between text-sm">
        <span className="text-gray-400">Savings vs benchmark</span>
        <span className="text-emerald-300 font-semibold">{fmtUsd(saved)} ({savedPct.toFixed(1)}%)</span>
      </div>
      {done && (
        <div className="text-[11px] text-gray-500">
          ⚠ Simulated execution. To run the actual LLM call, use the <code className="text-gray-400">/</code> Compare console.
        </div>
      )}
      <Footer step={step} />
    </article>
  );
}

function TimingCard({ steps }: { steps: PipelineTraceStep[] }) {
  if (steps.length === 0) return <PendingCard title="Latency Timeline" subtitle="End-to-end timing" />;
  const total = Math.max(1, ...steps.map((s) => s.endedAtMs));
  return (
    <article className="card p-4 space-y-3 animate-fade-in">
      <header className="flex items-center justify-between">
        <h3 className="section-title m-0">⏱ Latency Timeline</h3>
        <span className="badge-gray">{fmtMs(total)} total</span>
      </header>
      <div className="space-y-1.5">
        {steps.map((s) => {
          const startPct = (s.startedAtMs / total) * 100;
          const widthPct = Math.max(1, (s.durationMs / total) * 100);
          return (
            <div key={s.step} className="text-xs">
              <div className="flex justify-between text-gray-400 mb-0.5">
                <span>{s.label}</span>
                <span className="font-mono">{fmtMs(s.durationMs)}</span>
              </div>
              <div className="relative h-2.5 bg-gray-800 rounded overflow-hidden">
                <div className="absolute top-0 h-full bg-gradient-to-r from-indigo-500 to-violet-500" style={{ left: `${startPct}%`, width: `${widthPct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function PendingCard({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <article className="card p-4 space-y-2 opacity-70">
      <header>
        <h3 className="section-title m-0 text-gray-500">{title}</h3>
        <p className="text-xs text-gray-600">{subtitle}</p>
      </header>
      <div className="shimmer h-2 w-3/4" />
      <div className="shimmer h-2 w-1/2" />
      <div className="text-[11px] text-gray-600 italic">awaiting trace…</div>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-gray-500 uppercase tracking-wider text-[10px] font-semibold">{label}</div>
      <div className="text-gray-200 font-mono mt-0.5">{value}</div>
    </div>
  );
}

function Footer({ step }: { step: PipelineTraceStep }) {
  return (
    <div className="border-t border-gray-800 pt-2 flex items-center justify-between text-[10px] text-gray-500">
      <span>started @ {fmtMs(step.startedAtMs)} → ended @ {fmtMs(step.endedAtMs)}</span>
      <span className="font-mono">Δ {fmtMs(step.durationMs)}</span>
    </div>
  );
}

function CtxField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-2">
      <span className="label-sm w-28">{label}</span>
      <input className="input text-xs py-1 flex-1" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function CtxToggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} className="accent-indigo-500" />
      <span className="label-sm">{label}</span>
    </label>
  );
}
