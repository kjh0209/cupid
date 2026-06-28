interface CupidResponse {
  routing: {
    selectedModel: string;
    tier: string;
    reasons: string[];
    topCandidates: Array<{ modelId: string; tier: string; score: number; estimatedUsd: number }>;
  };
  router: {
    modelId: string;
    displayName: string;
    tier: string;
    response: string;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    latencyMs: number;
    error?: string;
  };
  benchmark: {
    modelId: string;
    displayName: string;
    costUsd: number;
  };
  classification: {
    taskType: string;
    riskLevel: number;
    complexity: number;
  };
  comparison: {
    savingsUsd: number;
    savingsPercent: number;
  };
  executor: {
    selfReviseAutoTriggered: boolean;
    selfReviseApplied: boolean;
  } | null;
  cpl: {
    injectedEntries: number;
    extracted: { stored: number } | null;
  } | null;
}

interface SessionStats {
  entryCount: number;
  taskCount: number;
  totalCostUsd: number;
  entries: Array<{ kind: string; title: string; tokens: number }>;
}

export async function callCupid(opts: {
  backendUrl: string;
  prompt: string;
  sessionKey: string;
  userMode: string;
  routingMode: string;
  fileName?: string;
  selectedCode?: string;
  selfRevise?: boolean;
}): Promise<CupidResponse> {
  const res = await fetch(`${opts.backendUrl}/api/compare`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: opts.prompt,
      userMode: opts.userMode,
      routingMode: opts.routingMode,
      optimizePrompt: true,
      enhancedPrompts: true,
      sessionKey: opts.sessionKey,
      useCpl: true,
      extractCpl: true,
      fileName: opts.fileName,
      rawCode: opts.selectedCode,
      selfRevise: opts.selfRevise,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Cupid API error ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.json() as Promise<CupidResponse>;
}

export async function getSessionStats(backendUrl: string, sessionKey: string): Promise<SessionStats> {
  const res = await fetch(`${backendUrl}/api/cpl/stats?sessionKey=${encodeURIComponent(sessionKey)}`);
  if (!res.ok) throw new Error(`Stats API error ${res.status}`);
  return res.json() as Promise<SessionStats>;
}

export async function resetSession(backendUrl: string, sessionKey: string): Promise<void> {
  await fetch(`${backendUrl}/api/cpl/reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionKey }),
  });
}

export async function checkHealth(backendUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${backendUrl}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}
