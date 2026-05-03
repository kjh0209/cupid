import { z } from "zod";

export const UserModeSchema = z.enum(["cost_saving", "balanced", "max_quality"]);

export const EngineerChatSchema = z.object({
  message: z.string().min(1).max(10000),
  activeFilePath: z.string().optional(),
  selectedCode: z.string().max(50000).optional(),
  repoSummary: z.string().max(20000).optional(),
  recentDecisions: z.array(z.string()).max(10).optional(),
  changedFiles: z.array(z.string()).max(50).optional(),
  userMode: UserModeSchema.default("balanced"),
  baselineModel: z.string().optional(),
});

export const ClassifyTaskSchema = z.object({
  message: z.string().min(1),
  activeFilePath: z.string().optional(),
  selectedCode: z.string().optional(),
  repoSummary: z.string().optional(),
  changedFiles: z.array(z.string()).optional(),
  userMode: UserModeSchema.default("balanced"),
});

export const OptimizePromptSchema = z.object({
  message: z.string().min(1),
  selectedModel: z.string().optional(),
  userMode: UserModeSchema.default("balanced"),
  activeFilePath: z.string().optional(),
  selectedCode: z.string().optional(),
  repoSummary: z.string().optional(),
  recentDecisions: z.array(z.string()).optional(),
});

export const RecommendModelSchema = z.object({
  message: z.string().min(1),
  activeFilePath: z.string().optional(),
  selectedCode: z.string().optional(),
  repoSummary: z.string().optional(),
  recentDecisions: z.array(z.string()).optional(),
  changedFiles: z.array(z.string()).optional(),
  userMode: UserModeSchema.default("balanced"),
  baselineModel: z.string().optional(),
  optimizePrompt: z.boolean().default(true),
});

export const LogTaskResultSchema = z.object({
  taskId: z.string(),
  selectedModel: z.string(),
  rawMessage: z.string(),
  optimizedMessage: z.string(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  estimatedCost: z.number().nonnegative(),
  actualCost: z.number().nonnegative().optional(),
  latencyMs: z.number().int().nonnegative().optional(),
  testPassed: z.boolean().optional(),
  lintPassed: z.boolean().optional(),
  typecheckPassed: z.boolean().optional(),
  userAccepted: z.boolean().optional(),
  escalated: z.boolean().default(false),
  finalModel: z.string().optional(),
  changedFilesCount: z.number().int().nonnegative().optional(),
  changedLoc: z.number().int().nonnegative().optional(),
  userId: z.string().optional(),
  repoId: z.string().optional(),
});

export type EngineerChatInput = z.infer<typeof EngineerChatSchema>;
export type ClassifyTaskInput = z.infer<typeof ClassifyTaskSchema>;
export type OptimizePromptInput = z.infer<typeof OptimizePromptSchema>;
export type RecommendModelInput = z.infer<typeof RecommendModelSchema>;
export type LogTaskResultInput = z.infer<typeof LogTaskResultSchema>;
