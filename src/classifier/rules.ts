import type {
  TaskType,
  ContextNeed,
  ChangeScope,
  CompressionSensitivity,
} from "../types.js";

// ── Keyword patterns for deterministic classification ─────────

export const SECURITY_KEYWORDS = [
  "auth", "authentication", "authorization", "permission", "role",
  "jwt", "token", "session", "cookie", "oauth", "saml", "sso",
  "password", "secret", "api.key", "apikey", "credentials",
  "encrypt", "decrypt", "hash", "bcrypt", "argon",
  "sql.injection", "xss", "csrf", "cors", "helmet",
  "payment", "billing", "stripe", "credit.card",
  "rate.limit", "ratelimit", "ddos", "brute.force",
  "firewall", "acl", "rbac", "abac",
  "sanitize", "escape", "validate.input",
  "privilege", "sudo", "admin",
];

export const DATABASE_KEYWORDS = [
  "migration", "migrate", "schema", "prisma", "drizzle", "sequelize",
  "typeorm", "knex", "mongoose", "transaction",
  "rollback", "alter.table", "drop.table", "create.table",
  "foreign.key", "constraint", "index", "unique",
  "seed", "backup", "restore", "replication",
  "postgres", "postgresql", "mysql", "sqlite", "mongodb",
  "redis", "cassandra", "elasticsearch",
];

export const ARCHITECTURE_KEYWORDS = [
  "architect", "design", "system.design", "refactor.entire",
  "module.split", "monolith", "microservice", "event.driven",
  "domain.driven", "ddd", "cqrs", "event.sourcing",
  "service.layer", "repository.pattern", "dependency.injection",
  "interface", "abstraction", "clean.architecture",
  "restructure", "reorganize", "split.into", "extract.module",
  "design.pattern",
];

export const MULTI_FILE_KEYWORDS = [
  "across.files", "multiple.files", "all.files", "entire.codebase",
  "refactor", "move.to", "extract.to", "split.into",
  "update.all", "change.all", "everywhere", "throughout.the",
];

export const EXPLANATION_KEYWORDS = [
  "explain", "what.does", "how.does", "what.is", "describe",
  "understand", "tell.me", "walk.me.through", "summarize",
  "what.are", "why.does", "how.works", "meaning.of",
  "documentation", "comment.this", "add.jsdoc", "add.comments",
];

export const TEST_KEYWORDS = [
  "test", "spec", "unit.test", "integration.test", "e2e",
  "jest", "vitest", "mocha", "chai", "cypress", "playwright",
  "mock", "stub", "spy", "coverage", "test.suite",
  "describe(", "it(", "test(",
];

export const UI_KEYWORDS = [
  "css", "style", "tailwind", "className", "component",
  "ui", "ux", "layout", "responsive", "animation",
  "color", "font", "padding", "margin", "flex", "grid",
  "react", "vue", "svelte", "angular", "html",
  "button", "form", "modal", "dialog", "dropdown",
  "dark.mode", "theme", "design.system",
  "spinner", "tooltip", "loading", "skeleton", "placeholder",
  "icon", "badge", "banner", "toast", "snackbar", "alert",
];

export const SIMPLE_EDIT_KEYWORDS = [
  "rename", "change.name", "update.variable", "fix.typo",
  "add.comment", "remove.comment", "add.log", "add.console",
  "add.import", "remove.import", "update.import",
  "change.type", "update.type", "fix.lint",
  "change.format", "update.format", "date.format", "format.from",
  "add.tooltip", "add.badge", "add.icon",
];

export const PROMPT_REWRITE_KEYWORDS = [
  "rewrite.prompt", "optimize.prompt", "reduce.tokens",
  "make.shorter", "compress.this", "shorten.this",
  "simplify.this.message", "token.optimization",
  "rewrite.this", "make.it.shorter", "more.concise",
  "verbose.prompt", "shorter.prompt",
];

export const LONG_CONTEXT_TRIGGERS = [
  "entire.codebase", "full.repo", "all.files", "whole.project",
  "throughout.the.project", "across.the.entire",
];

export const PRIVACY_KEYWORDS = [
  "private", "local.only", "no.cloud", "sensitive", "pii",
  "personal.data", "hipaa", "gdpr", "confidential",
  "internal.only", "proprietary",
];

export const FRAMEWORK_PATTERNS: Array<{ pattern: RegExp; framework: string }> = [
  { pattern: /next\.js|nextjs|next\s+app|next\.config/i, framework: "Next.js" },
  { pattern: /react|tsx|jsx|useState|useEffect/i, framework: "React" },
  { pattern: /vue|nuxt|\.vue/i, framework: "Vue" },
  { pattern: /angular|ng[A-Z]/i, framework: "Angular" },
  { pattern: /svelte|sveltekit/i, framework: "Svelte" },
  { pattern: /express|fastify|koa|hono/i, framework: "Node.js" },
  { pattern: /prisma|drizzle|typeorm|sequelize/i, framework: "ORM" },
  { pattern: /zod|yup|joi|valibot/i, framework: "Validation" },
  { pattern: /typescript|\.ts|interface\s+\w|type\s+\w/i, framework: "TypeScript" },
  { pattern: /python|\.py|django|flask|fastapi/i, framework: "Python" },
  { pattern: /rust|cargo\.toml/i, framework: "Rust" },
  { pattern: /golang|go\s+|\.go\b/i, framework: "Go" },
  { pattern: /java\b|spring|maven|gradle/i, framework: "Java" },
  { pattern: /tailwind|tw-/i, framework: "Tailwind CSS" },
  { pattern: /graphql|apollo|hasura/i, framework: "GraphQL" },
  { pattern: /postgres|postgresql|pg\./i, framework: "PostgreSQL" },
  { pattern: /mongodb|mongoose/i, framework: "MongoDB" },
];

// ── Scoring helpers ───────────────────────────────────────────

function countKeywordHits(text: string, keywords: string[]): number {
  const lower = text.toLowerCase().replace(/[^a-z0-9\s._-]/g, " ");
  return keywords.filter((kw) => {
    // Escape all regex special chars, then convert dots to \s*
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = escaped.replace("\\.", "\\s*");
    try {
      return new RegExp(pattern, "i").test(lower);
    } catch {
      return lower.includes(kw.replace(".", " "));
    }
  }).length;
}

export function detectTaskType(message: string, filePath?: string): TaskType {
  const text = `${message} ${filePath ?? ""}`;

  if (countKeywordHits(text, PROMPT_REWRITE_KEYWORDS) >= 1) return "prompt_rewrite_only";

  const secHits = countKeywordHits(text, SECURITY_KEYWORDS);
  const testHits = countKeywordHits(text, TEST_KEYWORDS);

  // If test signals are strong and at least as prominent as security signals, prefer test_generation.
  // This handles "write integration tests for auth endpoint" correctly.
  if (testHits >= 2 && testHits >= secHits) return "test_generation";
  if (secHits >= 2) return "security_sensitive_change";

  if (countKeywordHits(text, DATABASE_KEYWORDS) >= 2) return "database_schema_change";
  if (countKeywordHits(text, ARCHITECTURE_KEYWORDS) >= 2) return "architecture_design";
  if (countKeywordHits(text, MULTI_FILE_KEYWORDS) >= 2) return "multi_file_refactor";
  if (countKeywordHits(text, EXPLANATION_KEYWORDS) >= 1) return "explanation";
  if (testHits >= 2) return "test_generation";
  if (countKeywordHits(text, UI_KEYWORDS) >= 2) return "ui_change";
  if (countKeywordHits(text, SIMPLE_EDIT_KEYWORDS) >= 1) return "simple_edit";

  // API impl detection
  if (/api.route|endpoint|handler|controller|middleware|rest.api|graphql.resolver/i.test(text)) {
    return "api_implementation";
  }

  if (/bug|fix|broken|error|crash|exception|issue|wrong|incorrect/i.test(text)) {
    return "local_bug_fix";
  }

  return "unknown";
}

export function detectRiskLevel(
  message: string,
  taskType: TaskType
): number {
  const baseRisk: Record<TaskType, number> = {
    explanation: 1,
    simple_edit: 1,
    test_generation: 2,
    local_bug_fix: 2,
    ui_change: 1,
    api_implementation: 3,
    multi_file_refactor: 4,
    database_schema_change: 4,
    security_sensitive_change: 5,
    architecture_design: 4,
    prompt_rewrite_only: 1,
    unknown: 2,
  };

  let risk = baseRisk[taskType] ?? 2;

  const secHits = countKeywordHits(message, SECURITY_KEYWORDS);
  if (secHits >= 3) risk = Math.max(risk, 5);
  else if (secHits >= 1) risk = Math.max(risk, 3);

  const dbHits = countKeywordHits(message, DATABASE_KEYWORDS);
  if (dbHits >= 2) risk = Math.max(risk, 3);

  if (/production|prod\b|live.server|live.database/i.test(message)) {
    risk = Math.min(risk + 1, 5);
  }

  return risk;
}

export function detectDifficulty(message: string, taskType: TaskType): number {
  const base: Record<TaskType, number> = {
    explanation: 1,
    simple_edit: 1,
    test_generation: 2,
    local_bug_fix: 2,
    ui_change: 2,
    api_implementation: 3,
    multi_file_refactor: 4,
    database_schema_change: 3,
    security_sensitive_change: 4,
    architecture_design: 5,
    prompt_rewrite_only: 1,
    unknown: 2,
  };

  let diff = base[taskType] ?? 2;

  if (countKeywordHits(message, MULTI_FILE_KEYWORDS) >= 2) diff = Math.max(diff, 4);
  if (/complex|advanced|sophisticated|tricky|hard/i.test(message)) diff = Math.min(diff + 1, 5);

  return diff;
}

export function detectContextNeed(message: string, taskType: TaskType): ContextNeed {
  if (countKeywordHits(message, LONG_CONTEXT_TRIGGERS) >= 1) return "huge";

  const map: Record<TaskType, ContextNeed> = {
    explanation: "small",
    simple_edit: "small",
    test_generation: "medium",
    local_bug_fix: "medium",
    ui_change: "small",
    api_implementation: "medium",
    multi_file_refactor: "large",
    database_schema_change: "medium",
    security_sensitive_change: "medium",
    architecture_design: "large",
    prompt_rewrite_only: "small",
    unknown: "medium",
  };

  return map[taskType] ?? "medium";
}

export function detectChangeScope(taskType: TaskType, message: string): ChangeScope {
  if (/repo.wide|entire.codebase|all.files/i.test(message)) return "repo_wide";

  const map: Record<TaskType, ChangeScope> = {
    explanation: "none",
    simple_edit: "single_file",
    test_generation: "single_file",
    local_bug_fix: "single_file",
    ui_change: "single_file",
    api_implementation: "multi_file",
    multi_file_refactor: "multi_file",
    database_schema_change: "multi_file",
    security_sensitive_change: "multi_file",
    architecture_design: "repo_wide",
    prompt_rewrite_only: "none",
    unknown: "single_file",
  };

  return map[taskType] ?? "single_file";
}

export function detectFrameworks(message: string, filePath?: string): string[] {
  const text = `${message} ${filePath ?? ""}`;
  const detected: string[] = [];
  for (const { pattern, framework } of FRAMEWORK_PATTERNS) {
    if (pattern.test(text) && !detected.includes(framework)) {
      detected.push(framework);
    }
  }
  return detected;
}

export function detectCompressionSensitivity(
  taskType: TaskType,
  riskLevel: number
): CompressionSensitivity {
  if (riskLevel >= 4) return "high";
  if (riskLevel === 3) return "medium";
  if (taskType === "security_sensitive_change" || taskType === "database_schema_change") return "high";
  if (taskType === "architecture_design" || taskType === "multi_file_refactor") return "medium";
  return "low";
}
