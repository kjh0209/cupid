import type { ModelStats } from "./types.js";

export const MODEL_REGISTRY: ModelStats[] = [
  { id: "llama-3-8b-local",  costPer1kTokens: 0.0,     costScore: 0.0, latencyScore: 0.1, riskScore: 0.6,  baseQuality: 0.5 },
  { id: "claude-3.5-haiku",  costPer1kTokens: 0.00015, costScore: 0.1, latencyScore: 0.2, riskScore: 0.3,  baseQuality: 0.7 },
  { id: "gpt-4o-mini",       costPer1kTokens: 0.00015, costScore: 0.2, latencyScore: 0.3, riskScore: 0.4,  baseQuality: 0.75 },
  { id: "gemini-1.5-pro",    costPer1kTokens: 0.00125, costScore: 0.6, latencyScore: 0.6, riskScore: 0.2,  baseQuality: 0.9 },
  { id: "claude-3.5-sonnet", costPer1kTokens: 0.003,   costScore: 0.9, latencyScore: 0.8, riskScore: 0.1,  baseQuality: 1.0 },
  { id: "claude-4.7-opus",   costPer1kTokens: 0.015,   costScore: 1.0, latencyScore: 1.0, riskScore: 0.05, baseQuality: 1.0 },
];

export const BASELINE_MODEL_ID = "claude-4.7-opus";

export const ACTION_WEIGHTS: Record<string, { intent: string; weight: number }> = {
  fix:          { intent: "Debug",                weight: 0.8 },
  error:        { intent: "Debug",                weight: 0.9 },
  crash:        { intent: "Debug",                weight: 0.9 },
  refactor:     { intent: "Refactor",             weight: 0.9 },
  optimize:     { intent: "Refactor",             weight: 0.9 },
  architecture: { intent: "ComplexArchitecture",  weight: 0.9 },
  database:     { intent: "ComplexArchitecture",  weight: 0.8 },
  explain:      { intent: "Explain",              weight: 0.9 },
  how:          { intent: "Explain",              weight: 0.5 },
  commit:       { intent: "GitOps",               weight: 0.9 },
  review:       { intent: "GitOps",               weight: 0.8 },
};

export const SYSTEM_EXTENSIONS = [".rs", ".cpp", ".c", ".zig", ".go"];
