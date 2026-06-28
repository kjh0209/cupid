import * as vscode from "vscode";

export interface CupidResponse {
  routing: {
    selectedModel: string;
    tier: string;
    reasons: string[];
  };
  router: {
    response: string;
    costUsd: number;
    latencyMs: number;
    modelId: string;
    displayName: string;
  };
  benchmark: {
    costUsd: number;
    modelId: string;
  };
  classification: {
    taskType: string;
    riskLevel: number;
  };
  comparison: {
    savingsPercent: number;
    savingsUsd: number;
  };
  executor?: {
    selfReviseApplied: boolean;
    selfReviseAutoTriggered: boolean;
    cplStrategies: string[];
  };
  cpl?: {
    injectedEntries: number;
    injectedTokens: number;
  };
  optimizedPrompt: string;
  promptTokenSavings: number;
}

export interface SessionStats {
  sessionKey: string;
  entryCount: number;
  historyCount: number;
  totalTokensStored: number;
  totalCostUsd: number;
  modelsUsed: string[];
  entriesByKind: Record<string, number>;
}

function getEndpoint(): string {
  const cfg = vscode.workspace.getConfiguration("cupid");
  return (cfg.get<string>("serverEndpoint") ?? "http://localhost:3000").replace(/\/$/, "");
}

export async function callCupid(opts: {
  prompt: string;
  rawCode?: string;
  fileName?: string;
  highlightedRegion?: string;
  sessionKey: string;
}): Promise<CupidResponse> {
  const cfg = vscode.workspace.getConfiguration("cupid");
  const userMode = cfg.get<string>("userMode") ?? "balanced";
  const routingMode = cfg.get<string>("routingMode") ?? "rule_based";
  const useCpl = cfg.get<boolean>("useCpl") ?? true;

  const body = {
    prompt: opts.prompt,
    userMode,
    routingMode,
    rawCode: opts.rawCode,
    fileName: opts.fileName,
    highlightedRegion: opts.highlightedRegion,
    sessionKey: opts.sessionKey,
    useCpl,
    extractCpl: true,
    optimizePrompt: true,
    enhancedPrompts: true,
  };

  const res = await fetch(`${getEndpoint()}/api/compare`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Cupid server error ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.json() as Promise<CupidResponse>;
}

export async function getSessionStats(sessionKey: string): Promise<SessionStats | null> {
  try {
    const res = await fetch(`${getEndpoint()}/api/cpl/stats?sessionKey=${encodeURIComponent(sessionKey)}`);
    if (!res.ok) return null;
    return res.json() as Promise<SessionStats>;
  } catch {
    return null;
  }
}

export async function resetSession(sessionKey: string): Promise<boolean> {
  try {
    const res = await fetch(`${getEndpoint()}/api/cpl/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionKey }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${getEndpoint()}/health`);
    return res.ok;
  } catch {
    return false;
  }
}
