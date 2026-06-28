// ============================================================
// Cupid API Client
//
// Thin wrapper around /api/compare that maps VS Code editor
// context (active file, selection, git diff) to the request
// body the Cupid backend expects.
// ============================================================

export interface CupidRequestOptions {
  serverUrl: string;
  sessionKey: string;
  userMode: "cost_saving" | "balanced" | "max_quality";
  routingMode: "rule_based" | "llm_assisted";
  enableCpl: boolean;
  selfRevise?: boolean;
}

export interface CupidRequest {
  prompt: string;
  rawCode?: string;
  fileName?: string;
  highlightedRegion?: string;
  gitDiff?: string;
}

export interface RoutingInfo {
  selectedModel: string;
  tier: string;
  reasons: string[];
}

export interface CupidResponse {
  routing: RoutingInfo;
  router: {
    response: string;
    costUsd: number;
    latencyMs: number;
    displayName: string;
    revisionApplied?: boolean;
  };
  benchmark?: {
    costUsd: number;
    displayName: string;
  };
  comparison?: {
    savingsPercent: number;
    savingsUsd: number;
  };
  classification: {
    taskType: string;
    riskLevel: number;
  };
  executor?: {
    selfReviseAutoTriggered?: boolean;
    selfReviseApplied?: boolean;
  };
  cpl?: {
    injectedEntries: number;
    injectedTokens: number;
  };
}

export async function callCupid(
  request: CupidRequest,
  opts: CupidRequestOptions,
  signal?: AbortSignal,
): Promise<CupidResponse> {
  const body = {
    prompt: request.prompt,
    rawCode: request.rawCode,
    fileName: request.fileName,
    highlightedRegion: request.highlightedRegion,
    gitDiff: request.gitDiff,
    userMode: opts.userMode,
    routingMode: opts.routingMode,
    sessionKey: opts.sessionKey,
    useCpl: opts.enableCpl,
    extractCpl: opts.enableCpl,
    selfRevise: opts.selfRevise,
    optimizePrompt: true,
    enhancedPrompts: true,
  };

  const res = await fetch(`${opts.serverUrl}/api/compare`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "unknown error");
    throw new Error(`Cupid server returned ${res.status}: ${text.slice(0, 300)}`);
  }

  return res.json() as Promise<CupidResponse>;
}

export async function getSessionStats(serverUrl: string, sessionKey: string): Promise<unknown> {
  const res = await fetch(`${serverUrl}/api/cpl/stats?sessionKey=${encodeURIComponent(sessionKey)}`);
  if (!res.ok) throw new Error(`Failed to fetch session stats: ${res.status}`);
  return res.json();
}

export async function resetSession(serverUrl: string, sessionKey: string): Promise<void> {
  await fetch(`${serverUrl}/api/cpl/reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionKey }),
  });
}

export async function checkHealth(serverUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${serverUrl}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}
