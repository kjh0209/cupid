import * as vscode from "vscode";

export interface RequestRecord {
  id: string;
  timestamp: number;
  taskType: string;
  modelId: string;
  modelDisplayName: string;
  tier: string;
  inputTokens: number;
  outputTokens: number;
  actualCostUsd: number;
  baselineCostUsd: number;
  savedCostUsd: number;
  savedPct: number;
  latencyMs: number;
}

// Baseline = Claude Opus 4 pricing (benchmark in the pitch deck)
const BASELINE_INPUT_PER_M = 15;   // $15/M input tokens
const BASELINE_OUTPUT_PER_M = 75;  // $75/M output tokens

export function calcBaselineCost(inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1_000_000) * BASELINE_INPUT_PER_M
    + (outputTokens / 1_000_000) * BASELINE_OUTPUT_PER_M;
}

export interface AnalyticsSummary {
  totalRequests: number;
  totalActualCost: number;
  totalBaselineCost: number;
  totalSaved: number;
  avgSavedPct: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  modelBreakdown: Record<string, { count: number; cost: number; displayName: string; tier: string }>;
  taskTypeBreakdown: Record<string, { count: number; cost: number }>;
  recentRecords: RequestRecord[];
}

class AnalyticsStoreImpl {
  private ctx?: vscode.ExtensionContext;
  private readonly KEY = "cupid.analytics.v1";

  init(ctx: vscode.ExtensionContext) {
    this.ctx = ctx;
  }

  private load(): RequestRecord[] {
    return this.ctx?.globalState.get<RequestRecord[]>(this.KEY) ?? [];
  }

  private async save(records: RequestRecord[]): Promise<void> {
    await this.ctx?.globalState.update(this.KEY, records.slice(-2000));
  }

  async record(data: {
    taskType: string;
    modelId: string;
    modelDisplayName: string;
    tier: string;
    inputTokens: number;
    outputTokens: number;
    actualCostUsd: number;
    latencyMs: number;
  }): Promise<RequestRecord> {
    const baselineCostUsd = calcBaselineCost(data.inputTokens, data.outputTokens);
    const savedCostUsd = Math.max(0, baselineCostUsd - data.actualCostUsd);
    const savedPct = baselineCostUsd > 0 ? (savedCostUsd / baselineCostUsd) * 100 : 0;

    const record: RequestRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      taskType: data.taskType,
      modelId: data.modelId,
      modelDisplayName: data.modelDisplayName,
      tier: data.tier,
      inputTokens: data.inputTokens,
      outputTokens: data.outputTokens,
      actualCostUsd: data.actualCostUsd,
      baselineCostUsd,
      savedCostUsd,
      savedPct,
      latencyMs: data.latencyMs,
    };

    const all = this.load();
    all.push(record);
    await this.save(all);
    return record;
  }

  getSummary(): AnalyticsSummary {
    const records = this.load();
    const modelMap: Record<string, { count: number; cost: number; displayName: string; tier: string }> = {};
    const taskMap: Record<string, { count: number; cost: number }> = {};
    let totalActual = 0, totalBaseline = 0, totalIn = 0, totalOut = 0;

    for (const r of records) {
      totalActual += r.actualCostUsd;
      totalBaseline += r.baselineCostUsd;
      totalIn += r.inputTokens;
      totalOut += r.outputTokens;

      if (!modelMap[r.modelId]) {
        modelMap[r.modelId] = { count: 0, cost: 0, displayName: r.modelDisplayName, tier: r.tier };
      }
      modelMap[r.modelId]!.count++;
      modelMap[r.modelId]!.cost += r.actualCostUsd;

      const tt = r.taskType || "unknown";
      if (!taskMap[tt]) taskMap[tt] = { count: 0, cost: 0 };
      taskMap[tt]!.count++;
      taskMap[tt]!.cost += r.actualCostUsd;
    }

    const totalSaved = Math.max(0, totalBaseline - totalActual);
    return {
      totalRequests: records.length,
      totalActualCost: totalActual,
      totalBaselineCost: totalBaseline,
      totalSaved,
      avgSavedPct: totalBaseline > 0 ? (totalSaved / totalBaseline) * 100 : 0,
      totalInputTokens: totalIn,
      totalOutputTokens: totalOut,
      modelBreakdown: modelMap,
      taskTypeBreakdown: taskMap,
      recentRecords: records.slice(-100).reverse(),
    };
  }

  async clear(): Promise<void> {
    await this.save([]);
  }
}

export const analyticsStore = new AnalyticsStoreImpl();
