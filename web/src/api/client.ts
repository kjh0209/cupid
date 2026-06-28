const BASE = "";

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export interface RepoInfo {
  id: string;
  name: string;
  description: string;
  framework: string;
  language: string;
  availableScripts: string[];
  fileTree: FileTreeNode[];
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileTreeNode[];
}

export interface EvalTask {
  id: string;
  repo: string;
  title: string;
  message: string;
  activeFilePath?: string;
  expectedTaskType?: string;
  expectedTier?: string;
}

export interface EvalRunInput {
  repoId: string;
  taskMessage: string;
  activeFilePath?: string;
  userMode: "cost_saving" | "balanced" | "max_quality";
  experimentMode: "router_vs_strong" | "router_vs_cheap_vs_strong" | "manual_vs_router";
  strongBaselineModel?: string;
  cheapBaselineModel?: string;
  manualModel?: string;
  runVerification?: boolean;
}

export interface CandidateResult {
  label: string;
  modelId: string;
  diff: string;
  filesChanged: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  verificationPassed: boolean | null;
  parseStatus: string;
  summary: string;
}

export interface EvalRunResult {
  runId: string;
  status: "completed" | "failed" | "partial";
  taskClassification: Record<string, unknown> | null;
  recommendation: Record<string, unknown> | null;
  candidates: CandidateResult[];
  metrics: {
    routerCostUsd: number;
    strongBaselineCostUsd: number;
    savingsUsd: number;
    savingsPercent: number;
    promptTokenReductionPercent: number;
  } | null;
  error?: string;
}

export interface EvalRunRecord {
  id: string;
  repo_id: string;
  repo_name: string;
  task_message: string;
  optimized_message: string;
  user_mode: string;
  experiment_mode: string;
  status: string;
  created_at: string;
  completed_at?: string;
  savings_percent?: number;
  router_cost_usd?: number;
  strong_baseline_cost_usd?: number;
  preferred_candidate?: string;
  router_acceptance?: string;
  task_classification_json: string;
  recommendation_json: string;
}

export interface AggregateStats {
  totalRuns: number;
  completedRuns: number;
  averageSavingsPercent: number;
  averageRouterCostUsd: number;
  routerSuccessCount: number;
  topTaskTypes: Array<{ task_type: string; count: number; avg_savings: number }>;
}

export interface CompareCandidate {
  modelId: string;
  tier: string;
  score: number;
  estimatedUsd: number;
}

export interface CompareExecution {
  modelId: string;
  displayName: string;
  tier: string;
  response: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  error?: string;
}

export interface LlmRoutingMeta {
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  rationale: string | null;
  fellBackToRules: boolean;
  errorMessage?: string;
  ruleBasedSnapshot: {
    taskType: string;
    riskLevel: number;
    difficulty: number;
    contextNeed: string;
  };
}

export interface CompareResult {
  prompt: string;
  optimizedPrompt: string;
  promptTokenSavings: number;
  routingMode: "rule_based" | "llm_assisted";
  classification: {
    taskType: string;
    riskLevel: number;
    complexity: number | string;
    contextNeed: string;
  };
  llmRouting: LlmRoutingMeta | null;
  routing: {
    selectedModel: string;
    tier: string;
    reasons: string[];
    topCandidates: CompareCandidate[];
  };
  router: CompareExecution;
  benchmark: CompareExecution & { isBenchmark: true };
  comparison: {
    sameModel: boolean;
    savingsUsd: number;
    savingsPercent: number;
    latencyDeltaMs: number;
  };
}

// ── CUPID Pipeline (rule-based engine) ─────────────────────────────
export interface PipelineContext {
  fileName?: string;
  activeLanguage?: string;
  fileLineCount?: number;
  hasTerminalError?: boolean;
  hasHighlightedText?: boolean;
  rawCodePayload?: string;
  gitDiffText?: string | null;
  sessionKey?: string;
}

export interface PipelineTraceStep {
  step: "prompt_intake" | "intent_detection" | "auction" | "cpl_compression" | "context_storage" | "model_execution";
  label: string;
  startedAtMs: number;
  endedAtMs: number;
  durationMs: number;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  notes?: string[];
}

export interface PipelineAuctionScore {
  modelId: string;
  baseQuality: number;
  weightedQuality: number;
  weightedCost: number;
  weightedLatency: number;
  weightedRisk: number;
  total: number;
}

export interface PipelineAuction {
  intent: string;
  dials: { alpha: number; beta: number; gamma: number; delta: number };
  scores: PipelineAuctionScore[];
  winner: {
    id: string;
    baseQuality: number;
    costPer1kTokens: number;
    costScore: number;
    latencyScore: number;
    riskScore: number;
  };
  override?: string;
}

export interface PipelineCompression {
  originalChars: number;
  compressedChars: number;
  originalTokens: number;
  compressedTokens: number;
  rulesApplied: string[];
  diffSnippets: Array<{ type: "removed" | "kept"; line: string }>;
}

export interface PipelineStorage {
  sessionKey: string;
  fragmentCount: number;
  cacheHit: boolean;
  bytesStored: number;
  freshlyAddedKeys: string[];
}

export interface PipelineDone {
  intent: string;
  routedModel: string;
  totals: {
    baselineTokens: number;
    finalTokens: number;
    tokensSaved: number;
    estimatedCostSavingsUsd: number;
    totalLatencyMs: number;
  };
  compressed: PipelineCompression;
  auction: PipelineAuction;
  storage: PipelineStorage;
}

export interface PipelineResult extends PipelineDone {
  prompt: string;
  steps: PipelineTraceStep[];
}

export interface StorageFragment {
  key: string;
  bytes: number;
  preview: string;
  storedAt: number;
  hits: number;
}
export interface StorageInspect {
  sessionKey: string;
  fragments: StorageFragment[];
  bytesStored: number;
}

// ── IDE Auth + Workspaces + Chat ─────────────────────────────────
export interface AuthUser {
  id: string;
  email: string;
  created_at?: string;
}

export interface Workspace {
  id: string;
  owner_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceFileMeta {
  id: string;
  path: string;
  updated_at: string;
  size: number;
}

export interface WorkspaceFile {
  id: string;
  workspace_id: string;
  path: string;
  content: string;
  updated_at: string;
}

export interface MultiChatResult {
  modelId: string;
  displayName: string;
  tier: string;
  content: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  error?: string;
}

export const api = {
  auth: {
    me: () => apiFetch<{ user: AuthUser | null }>("/api/auth/me"),
    login: (email: string, password: string) =>
      apiFetch<{ user: AuthUser }>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
    signup: (email: string, password: string) =>
      apiFetch<{ user: AuthUser; workspaceId: string }>("/api/auth/signup", { method: "POST", body: JSON.stringify({ email, password }) }),
    logout: () => apiFetch<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
  },
  workspaces: {
    list: () => apiFetch<{ workspaces: Workspace[] }>("/api/workspaces"),
    create: (name: string) => apiFetch<{ workspace: Workspace }>("/api/workspaces", { method: "POST", body: JSON.stringify({ name }) }),
    rename: (id: string, name: string) => apiFetch<{ workspace: Workspace }>(`/api/workspaces/${id}`, { method: "PATCH", body: JSON.stringify({ name }) }),
    remove: (id: string) => apiFetch<{ ok: boolean }>(`/api/workspaces/${id}`, { method: "DELETE" }),
    files: (id: string) => apiFetch<{ workspace: Workspace; files: WorkspaceFileMeta[] }>(`/api/workspaces/${id}/files`),
    file: (id: string, fileId: string) => apiFetch<{ file: WorkspaceFile }>(`/api/workspaces/${id}/files/${fileId}`),
    createFile: (id: string, path: string, content = "") =>
      apiFetch<{ file: WorkspaceFile }>(`/api/workspaces/${id}/files`, { method: "POST", body: JSON.stringify({ path, content }) }),
    updateFile: (id: string, fileId: string, body: { content?: string; path?: string }) =>
      apiFetch<{ file: WorkspaceFile }>(`/api/workspaces/${id}/files/${fileId}`, { method: "PATCH", body: JSON.stringify(body) }),
    deleteFile: (id: string, fileId: string) =>
      apiFetch<{ ok: boolean }>(`/api/workspaces/${id}/files/${fileId}`, { method: "DELETE" }),
  },
  chat: {
    multi: (modelIds: string[], messages: Array<{ role: "system" | "user" | "assistant"; content: string }>, maxTokens?: number) =>
      apiFetch<{ results: MultiChatResult[] }>("/api/chat/multi", { method: "POST", body: JSON.stringify({ modelIds, messages, maxTokens }) }),
  },
  cupid: {
    runOnce: (prompt: string, context: PipelineContext, sessionKey: string) =>
      apiFetch<PipelineResult>("/api/cupid/pipeline/trace", {
        method: "POST",
        body: JSON.stringify({ prompt, context, sessionKey }),
      }),
    streamUrl: () => "/api/cupid/pipeline/trace",
    storage: (sessionKey: string) =>
      apiFetch<StorageInspect>(`/api/cupid/storage?sessionKey=${encodeURIComponent(sessionKey)}`),
    resetStorage: (sessionKey?: string) =>
      apiFetch<{ ok: boolean }>("/api/cupid/storage/reset", {
        method: "POST",
        body: JSON.stringify(sessionKey ? { sessionKey } : {}),
      }),
  },
  compare: {
    run: (
      prompt: string,
      userMode: "cost_saving" | "balanced" | "max_quality" = "cost_saving",
      maxTokens?: number,
      opts?: {
        routingMode?: "rule_based" | "llm_assisted";
        classifierModelId?: string;
        sessionKey?: string;
        rawCode?: string;
        fileName?: string;
        selfRevise?: boolean;
      },
    ) =>
      apiFetch<CompareResult>("/api/compare", {
        method: "POST",
        body: JSON.stringify({
          prompt,
          userMode,
          maxTokens,
          routingMode: opts?.routingMode,
          classifierModelId: opts?.classifierModelId,
          sessionKey: opts?.sessionKey,
          rawCode: opts?.rawCode,
          fileName: opts?.fileName,
          selfRevise: opts?.selfRevise,
        }),
      }),
  },
  repos: {
    list: () => apiFetch<{ repos: RepoInfo[] }>("/api/repos"),
    tree: (id: string) => apiFetch<{ repo: RepoInfo }>(`/api/repos/${id}/tree`),
    file: (id: string, path: string) =>
      apiFetch<{ content: string; path: string }>(`/api/repos/${id}/file?path=${encodeURIComponent(path)}`),
  },
  evals: {
    run: (input: EvalRunInput) =>
      apiFetch<EvalRunResult>("/api/evals/run", { method: "POST", body: JSON.stringify(input) }),
    list: (limit = 20, offset = 0) =>
      apiFetch<{ runs: EvalRunRecord[]; total: number }>(`/api/evals?limit=${limit}&offset=${offset}`),
    get: (id: string) =>
      apiFetch<{ run: EvalRunRecord; candidates: unknown[]; metrics: unknown; rating: unknown }>(`/api/evals/${id}`),
    rate: (id: string, rating: Record<string, unknown>) =>
      apiFetch<{ success: boolean }>(`/api/evals/${id}/rating`, { method: "POST", body: JSON.stringify(rating) }),
    export: (id: string) =>
      apiFetch<{ reportPath: string; report: string }>(`/api/evals/${id}/export`, { method: "POST" }),
  },
  stats: {
    aggregate: () => apiFetch<AggregateStats>("/api/stats/aggregate"),
  },
  tasks: {
    list: () => apiFetch<{ tasks: EvalTask[] }>("/api/eval-tasks"),
  },
};
