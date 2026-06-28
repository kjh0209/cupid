import { getEncoding } from "js-tiktoken";
import { evaluateIntent, runAuction } from "./cupidBrain.js";
import { compress } from "./cplOptimizer.js";
import { contextStorage } from "./contextStorage.js";
import { MODEL_REGISTRY, BASELINE_MODEL_ID } from "./registry.js";
import type {
  IDEContext,
  PipelineTraceResult,
  TraceStep,
} from "./types.js";

const tokenizer = getEncoding("cl100k_base");

function timed<T>(
  step: TraceStep["step"],
  label: string,
  fn: () => T,
  input?: Record<string, unknown>,
  noteFn?: (out: T) => string[] | undefined,
): { trace: TraceStep; result: T } {
  const startedAtMs = performance.now();
  const result = fn();
  const endedAtMs = performance.now();
  return {
    result,
    trace: {
      step,
      label,
      startedAtMs,
      endedAtMs,
      durationMs: endedAtMs - startedAtMs,
      input,
      output: result as unknown as Record<string, unknown>,
      notes: noteFn ? noteFn(result) : undefined,
    },
  };
}

export function runPipeline(prompt: string, context: IDEContext): PipelineTraceResult {
  const pipelineStart = performance.now();

  // ── Step 0: prompt intake ───────────────────────────────────
  const intakeStart = performance.now();
  const baselineTokens = tokenizer.encode(prompt + "\n" + context.rawCodePayload).length;
  const intakeEnd = performance.now();
  const intakeStep: TraceStep = {
    step: "prompt_intake",
    label: "User Prompt",
    startedAtMs: intakeStart - pipelineStart,
    endedAtMs: intakeEnd - pipelineStart,
    durationMs: intakeEnd - intakeStart,
    input: { prompt, fileName: context.fileName, language: context.activeLanguage },
    output: { baselineTokens, payloadChars: context.rawCodePayload.length },
    notes: [`Tokenized baseline = ${baselineTokens} tokens`],
  };

  // ── Step 1: Intent detection (Cupid Engine) ─────────────────
  const intentTimer = timed(
    "intent_detection",
    "Prompt-engineered Cupid Engine",
    () => evaluateIntent(prompt, context),
    { prompt, fileLineCount: context.fileLineCount, hasTerminalError: context.hasTerminalError },
    (out) => [
      `Intent = ${out.intent}`,
      `Confidence = ${(out.confidence * 100).toFixed(1)}%`,
      ...out.rulesTriggered.map((r) => `Rule: ${r}`),
    ],
  );
  intentTimer.trace.startedAtMs = intakeEnd - pipelineStart;
  intentTimer.trace.endedAtMs = intentTimer.trace.startedAtMs + intentTimer.trace.durationMs;

  // ── Step 2: Auction (Prompt Optimizer / model picker) ───────
  const auctionTimer = timed(
    "auction",
    "Prompt Optimizer (Model Auction)",
    () =>
      runAuction(
        intentTimer.result.intent,
        context,
        intentTimer.result.confidence,
        Math.floor(context.rawCodePayload.length / 4),
      ),
    { intent: intentTimer.result.intent, confidence: intentTimer.result.confidence },
    (out) => [
      `Winner = ${out.winner.id}`,
      `Dials α=${out.dials.alpha} β=${out.dials.beta} γ=${out.dials.gamma} δ=${out.dials.delta}`,
      ...(out.override ? [`Override: ${out.override}`] : []),
    ],
  );
  auctionTimer.trace.startedAtMs = intentTimer.trace.endedAtMs;
  auctionTimer.trace.endedAtMs = auctionTimer.trace.startedAtMs + auctionTimer.trace.durationMs;

  // ── Step 3: CPL compression ─────────────────────────────────
  const cplTimer = timed(
    "cpl_compression",
    "Context Preservation Layer (CPL)",
    () => compress(context, intentTimer.result.intent),
    { intent: intentTimer.result.intent, originalBytes: context.rawCodePayload.length },
    (out) => [
      `${out.originalTokens} → ${out.compressedTokens} tokens (${(
        ((out.originalTokens - out.compressedTokens) / Math.max(1, out.originalTokens)) *
        100
      ).toFixed(1)}% saved)`,
      ...out.rulesApplied.map((r) => `Applied: ${r}`),
    ],
  );
  cplTimer.trace.startedAtMs = auctionTimer.trace.endedAtMs;
  cplTimer.trace.endedAtMs = cplTimer.trace.startedAtMs + cplTimer.trace.durationMs;
  // Avoid sending the entire payload back over the wire
  cplTimer.trace.output = {
    originalChars: cplTimer.result.originalChars,
    compressedChars: cplTimer.result.compressedChars,
    originalTokens: cplTimer.result.originalTokens,
    compressedTokens: cplTimer.result.compressedTokens,
    rulesApplied: cplTimer.result.rulesApplied,
    diffSnippets: cplTimer.result.diffSnippets.slice(0, 30),
  };

  // ── Step 4: Context Storage ─────────────────────────────────
  const sessionKey = context.sessionKey ?? `${context.fileName || "anon"}::session`;
  const storageTimer = timed(
    "context_storage",
    "Context Storage",
    () => contextStorage.loadOrStore(sessionKey, context.fileName, cplTimer.result.compressedPayload),
    { sessionKey, fragmentName: context.fileName },
    (out) => [
      out.cacheHit ? "Cache HIT — shared context reused" : "Cache MISS — fragment stored",
      `Fragments in bucket = ${out.fragmentCount}`,
      `Stored bytes = ${out.bytesStored.toLocaleString()}`,
    ],
  );
  storageTimer.trace.startedAtMs = cplTimer.trace.endedAtMs;
  storageTimer.trace.endedAtMs = storageTimer.trace.startedAtMs + storageTimer.trace.durationMs;

  // ── Step 5: Model Execution (simulated — no LLM call here) ──
  const finalPayload = prompt + "\n" + cplTimer.result.compressedPayload;
  const finalTokens = tokenizer.encode(finalPayload).length;
  const baselineCost =
    (baselineTokens / 1000) *
    (MODEL_REGISTRY.find((m) => m.id === BASELINE_MODEL_ID)!.costPer1kTokens);
  const finalCost = (finalTokens / 1000) * auctionTimer.result.winner.costPer1kTokens;

  const execStart = storageTimer.trace.endedAtMs;
  const execEnd = execStart + Math.max(2, auctionTimer.result.winner.latencyScore * 12); // simulated
  const execStep: TraceStep = {
    step: "model_execution",
    label: "Model Execution",
    startedAtMs: execStart,
    endedAtMs: execEnd,
    durationMs: execEnd - execStart,
    input: { model: auctionTimer.result.winner.id, finalTokens },
    output: {
      model: auctionTimer.result.winner.id,
      finalTokens,
      finalCostUsd: finalCost,
      baselineCostUsd: baselineCost,
    },
    notes: [
      `Routed to ${auctionTimer.result.winner.id}`,
      `Final cost ≈ $${finalCost.toFixed(5)} (baseline $${baselineCost.toFixed(5)})`,
      "Simulated latency — actual call lives in /api/compare when needed",
    ],
  };

  return {
    prompt,
    intent: intentTimer.result.intent,
    routedModel: auctionTimer.result.winner.id,
    compressed: cplTimer.result,
    auction: auctionTimer.result,
    storage: storageTimer.result,
    steps: [
      intakeStep,
      intentTimer.trace,
      auctionTimer.trace,
      cplTimer.trace,
      storageTimer.trace,
      execStep,
    ],
    totals: {
      baselineTokens,
      finalTokens,
      tokensSaved: baselineTokens - finalTokens,
      estimatedCostSavingsUsd: baselineCost - finalCost,
      totalLatencyMs: execEnd,
    },
  };
}
