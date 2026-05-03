const BASE = "";

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
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

export const api = {
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
