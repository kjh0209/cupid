import type { TaskClassification, ContextPlan, ContextRisk } from "../types.js";
import { estimateTokens } from "../utils/tokenEstimator.js";

export interface ContextPlannerInput {
  taskClassification: TaskClassification;
  rawMessage: string;
  optimizedMessage: string;
  repoSummary?: string;
  activeFile?: string;
  selectedCode?: string;
  fileSummaries?: Array<{ path: string; summary: string }>;
  recentDecisions?: string[];
  chatHistorySummary?: string;
  modelContextWindow: number;
}

export function planContext(input: ContextPlannerInput): ContextPlan {
  const {
    taskClassification,
    activeFile,
    selectedCode,
    repoSummary,
    fileSummaries,
    recentDecisions,
    chatHistorySummary,
    modelContextWindow,
  } = input;

  const { taskType, contextNeed, riskLevel } = taskClassification;

  const include: string[] = [];
  const exclude: string[] = [];
  const compressionPlan: string[] = [];

  // ── Task-specific context selection ─────────────────────────

  if (taskType === "explanation") {
    if (selectedCode) {
      include.push("selected_code");
    } else if (activeFile) {
      include.push("active_file_excerpt");
    }
    exclude.push("unrelated_files", "full_repo_map", "chat_history_raw");
    compressionPlan.push("Include only selected code or relevant function");
  }

  else if (taskType === "simple_edit" || taskType === "ui_change") {
    if (selectedCode) include.push("selected_code");
    if (activeFile) include.push("active_file");
    exclude.push("unrelated_files", "full_repo_map");
    compressionPlan.push("Include active file only");
  }

  else if (taskType === "local_bug_fix") {
    if (selectedCode) include.push("selected_code");
    if (activeFile) include.push("active_file");
    if (recentDecisions?.length) include.push("recent_decisions");
    exclude.push("unrelated_files", "old_chat_turns_not_referenced");
    compressionPlan.push("Include active file + selected code + relevant test file if present");
  }

  else if (taskType === "test_generation") {
    if (activeFile) include.push("active_file");
    if (selectedCode) include.push("selected_code");
    include.push("existing_test_file_pattern");
    exclude.push("unrelated_files", "full_repo_map");
    compressionPlan.push("Include source file being tested + example test file pattern");
  }

  else if (taskType === "api_implementation") {
    if (activeFile) include.push("active_route_file");
    include.push("related_api_route_pattern", "schema_validation_example");
    if (recentDecisions?.length) include.push("recent_decisions");
    include.push("related_middleware");
    exclude.push("unrelated_frontend_files", "old_chat_turns_not_referenced");
    compressionPlan.push("Include route file + validation pattern + middleware");
  }

  else if (taskType === "multi_file_refactor") {
    include.push("repo_map", "involved_files", "dependency_graph_summary");
    if (recentDecisions?.length) include.push("recent_decisions");
    exclude.push("non_involved_files", "unrelated_tests");
    compressionPlan.push(
      "Use repo map + selective file inclusion",
      "Summarize files not directly changed"
    );
  }

  else if (taskType === "database_schema_change") {
    if (activeFile) include.push("schema_file");
    include.push("existing_migration_examples", "affected_models");
    if (recentDecisions?.length) include.push("recent_decisions");
    exclude.push("unrelated_service_files", "frontend_files");
    compressionPlan.push("Include schema + migration pattern only");
  }

  else if (taskType === "security_sensitive_change") {
    if (activeFile) include.push("active_file");
    if (selectedCode) include.push("selected_code");
    include.push("auth_middleware", "security_constraints", "existing_tests");
    if (recentDecisions?.length) include.push("all_security_decisions");
    exclude.push("unrelated_files");
    compressionPlan.push(
      "Include auth/security context fully — do not compress security requirements",
      "Include existing test coverage for auth paths"
    );
  }

  else if (taskType === "architecture_design") {
    include.push("repo_map", "existing_architecture_docs", "service_interfaces");
    if (repoSummary) include.push("repo_summary");
    if (recentDecisions?.length) include.push("recent_decisions");
    compressionPlan.push("Use high-level summaries; include interface/contract files");
  }

  else if (taskType === "prompt_rewrite_only") {
    include.push("raw_message_only");
    exclude.push("code_files", "repo_map", "chat_history");
    compressionPlan.push("Only the raw message needed");
  }

  else {
    if (activeFile) include.push("active_file");
    if (selectedCode) include.push("selected_code");
    if (repoSummary) include.push("repo_summary_excerpt");
  }

  // ── Chat history handling ─────────────────────────────────
  if (chatHistorySummary) {
    include.push("chat_history_summary");
    compressionPlan.push("Replace raw chat history with summary");
  }

  // ── Estimate context tokens ───────────────────────────────
  const estimatedContextTokens = calculateContextTokenEstimate(
    include,
    activeFile,
    selectedCode,
    repoSummary,
    chatHistorySummary
  );

  // ── Context risk ─────────────────────────────────────────
  let contextRisk: ContextRisk = "low";
  if (estimatedContextTokens > modelContextWindow * 0.85) {
    contextRisk = "high";
    compressionPlan.push("WARNING: Context approaching model limit — apply aggressive compression");
  } else if (estimatedContextTokens > modelContextWindow * 0.6) {
    contextRisk = "medium";
    compressionPlan.push("Context is large — consider additional compression");
  }

  // High-risk tasks get a warning if context is compressed
  if (riskLevel >= 4 && compressionPlan.length > 2) {
    contextRisk = contextRisk === "low" ? "medium" : contextRisk;
  }

  return {
    include,
    exclude,
    compressionPlan,
    estimatedContextTokens,
    contextRisk,
  };
}

function calculateContextTokenEstimate(
  includes: string[],
  activeFile?: string,
  selectedCode?: string,
  repoSummary?: string,
  chatHistory?: string
): number {
  let total = 500; // system prompt baseline

  if (includes.includes("active_file") || includes.includes("active_route_file")) {
    total += activeFile ? estimateTokens(activeFile) : 2000;
  }

  if (includes.includes("selected_code")) {
    total += selectedCode ? estimateTokens(selectedCode) : 500;
  }

  if (includes.includes("repo_summary") || includes.includes("repo_summary_excerpt")) {
    total += repoSummary ? estimateTokens(repoSummary) : 1000;
  }

  if (includes.includes("repo_map")) {
    total += 3000; // estimated
  }

  if (includes.includes("chat_history_summary")) {
    total += chatHistory ? estimateTokens(chatHistory) : 300;
  }

  // Add estimates for included patterns
  const patternItems = includes.filter((i) => !["active_file", "selected_code", "repo_summary", "repo_map", "chat_history_summary"].includes(i));
  total += patternItems.length * 500;

  return total;
}
