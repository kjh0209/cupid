import type {
  TaskType,
  ContextNeed,
  ChangeScope,
  CompressionSensitivity,
} from "../types.js";

// ============================================================
// Keyword dictionaries — expanded 3-5x for higher routing accuracy
// ============================================================

export const SECURITY_KEYWORDS = [
  // auth basics
  "auth", "authentication", "authorization", "permission", "permissions", "role", "roles",
  "rbac", "abac", "acl", "policy", "policies", "grant", "revoke", "scope", "scopes",
  // tokens / sessions
  "jwt", "json.web.token", "token", "tokens", "refresh.token", "access.token", "bearer.token",
  "session", "sessions", "cookie", "cookies", "csrf.token", "oauth", "oauth2", "openid",
  "saml", "sso", "single.sign.on", "magic.link", "passkey", "passkeys", "webauthn", "fido2",
  // credentials / secrets
  "password", "passwords", "secret", "secrets", "api.key", "apikey", "api.token",
  "credentials", "credential", "private.key", "public.key", "kms", "vault",
  // crypto
  "encrypt", "decrypt", "encryption", "decryption", "hash", "hashing", "bcrypt", "argon2",
  "scrypt", "pbkdf2", "sha256", "sha512", "hmac", "aes", "rsa", "ecdsa", "ed25519",
  "symmetric", "asymmetric", "cipher", "nonce", "salt", "pepper",
  // attacks
  "sql.injection", "xss", "cross.site.scripting", "csrf", "cross.site.request",
  "cors", "ssrf", "rce", "remote.code.execution", "path.traversal", "directory.traversal",
  "command.injection", "ldap.injection", "xxe", "deserialization", "prototype.pollution",
  "open.redirect", "clickjacking", "session.fixation", "session.hijack",
  // billing / payments
  "payment", "payments", "billing", "stripe", "paypal", "credit.card", "debit.card",
  "card.number", "cvv", "cvc", "pci", "pci.dss", "iban", "swift.code",
  // rate / abuse
  "rate.limit", "rate.limiter", "ratelimit", "throttle", "throttling", "ddos", "dos",
  "brute.force", "captcha", "recaptcha", "honeypot", "abuse",
  // network / infra
  "firewall", "waf", "tls", "ssl", "https", "mtls", "x509", "cert", "certificate",
  // sanitization
  "sanitize", "sanitization", "escape", "escaping", "validate.input", "input.validation",
  "html.encode", "html.entities",
  // privilege
  "privilege", "privileges", "escalation", "sudo", "root", "admin", "superuser",
  // compliance
  "hipaa", "gdpr", "pii", "phi", "ccpa", "soc2", "iso27001",
];

export const DATABASE_KEYWORDS = [
  // migrations / DDL
  "migration", "migrations", "migrate", "schema", "ddl", "alter.table", "drop.table",
  "create.table", "create.index", "drop.index", "add.column", "drop.column", "rename.column",
  "rename.table", "change.column", "modify.column",
  // ORMs / query builders
  "prisma", "drizzle", "sequelize", "typeorm", "knex", "mongoose", "objection",
  "diesel", "sqlx", "active.record", "sqlalchemy", "django.orm",
  // transactions / consistency
  "transaction", "transactions", "rollback", "commit", "savepoint", "isolation.level",
  "serializable", "repeatable.read", "read.committed", "read.uncommitted",
  "deadlock", "lock", "row.lock", "table.lock", "advisory.lock",
  // constraints / indexes
  "foreign.key", "primary.key", "constraint", "constraints", "unique", "not.null",
  "check.constraint", "default.value", "index", "indexes", "composite.index",
  "partial.index", "covering.index", "gin.index", "gist.index", "btree", "hash.index",
  // seeding / backups
  "seed", "seeds", "fixtures", "backup", "backups", "restore", "snapshot",
  "replication", "primary.replica", "read.replica", "logical.replication",
  // engines
  "postgres", "postgresql", "pg.", "mysql", "mariadb", "sqlite", "mongodb",
  "redis", "memcached", "cassandra", "scylla", "dynamodb", "cosmosdb",
  "elasticsearch", "opensearch", "clickhouse", "duckdb", "bigquery", "snowflake",
  "supabase", "neon", "planetscale", "turso", "cockroachdb", "tidb",
  // query language
  "sql", "nosql", "join", "left.join", "inner.join", "outer.join", "cross.join",
  "subquery", "cte", "common.table.expression", "window.function", "aggregate",
  "group.by", "having", "partition.by", "vacuum", "analyze", "explain.plan",
];

export const ARCHITECTURE_KEYWORDS = [
  // high-level design
  "architect", "architecture", "design", "system.design", "high.level.design",
  "refactor.entire", "rewrite.entire", "restructure", "reorganize", "redesign",
  // modularity
  "module.split", "module.boundaries", "split.into", "extract.module", "extract.package",
  "monolith", "monorepo", "microservice", "microservices", "service.mesh",
  "serverless", "edge.compute", "edge.functions",
  // patterns
  "event.driven", "event.bus", "pub.sub", "message.queue", "saga.pattern",
  "domain.driven", "ddd", "cqrs", "event.sourcing", "hexagonal", "onion.architecture",
  "clean.architecture", "layered.architecture", "ports.adapters",
  "service.layer", "repository.pattern", "factory.pattern", "builder.pattern",
  "strategy.pattern", "observer.pattern", "decorator.pattern", "singleton",
  "dependency.injection", "inversion.of.control", "ioc.container",
  "interface", "abstraction", "polymorphism", "encapsulation",
  // scaling
  "horizontal.scaling", "vertical.scaling", "load.balancer", "auto.scaling",
  "sharding", "partitioning", "consistent.hashing", "circuit.breaker", "bulkhead",
  "rate.limiter", "throttling", "backpressure",
  // patterns / approaches
  "design.pattern", "anti.pattern", "best.practice", "trade.off", "trade.offs",
];

export const MULTI_FILE_KEYWORDS = [
  "across.files", "multiple.files", "all.files", "every.file", "entire.codebase",
  "refactor", "refactoring", "rename.across", "move.to", "move.into", "extract.to",
  "extract.into", "split.into", "split.across", "update.all", "change.all",
  "replace.all", "everywhere", "throughout.the", "globally", "project.wide",
  "search.and.replace", "find.and.replace", "consolidate", "deduplicate",
];

export const EXPLANATION_KEYWORDS = [
  "explain", "explanation", "what.does", "how.does", "what.is", "what.are",
  "describe", "description", "understand", "tell.me", "walk.me.through", "walk.through",
  "summarize", "summary", "overview", "intro.to", "tutorial",
  "why.does", "why.is", "how.works", "how.it.works", "meaning.of", "purpose.of",
  "documentation", "document.this", "docstring", "jsdoc", "tsdoc",
  "add.jsdoc", "add.comments", "add.docstring", "comment.this", "annotate",
  "diagram", "flowchart", "sequence.diagram", "explain.like",
];

export const TEST_KEYWORDS = [
  "test", "tests", "testing", "spec", "specs", "unit.test", "integration.test",
  "e2e.test", "end.to.end", "smoke.test", "regression.test", "acceptance.test",
  "jest", "vitest", "mocha", "chai", "jasmine", "ava", "tap",
  "cypress", "playwright", "puppeteer", "selenium", "webdriver",
  "rspec", "minitest", "pytest", "unittest", "go.test", "junit",
  "mock", "mocks", "stub", "stubs", "spy", "spies", "fake", "test.double",
  "coverage", "code.coverage", "test.suite", "test.runner", "fixture", "fixtures",
  "describe(", "it(", "test(", "expect(", "assert(", "beforeeach", "aftereach",
  "snapshot.test", "property.based", "fuzz", "fuzzing",
];

export const UI_KEYWORDS = [
  // styling
  "css", "scss", "sass", "less", "stylus", "style", "styles", "styling",
  "tailwind", "twin.macro", "windicss", "uno.css",
  "styled.components", "emotion", "css.modules", "vanilla.extract",
  "classname", "class.name", "inline.style",
  // structure
  "component", "components", "props", "state", "ref", "context",
  "ui", "ux", "user.interface", "user.experience",
  "layout", "responsive", "mobile.first", "desktop.first", "breakpoint",
  // visuals
  "animation", "animate", "transition", "keyframes", "framer.motion",
  "color", "colors", "palette", "theme", "themes", "dark.mode", "light.mode",
  "font", "fonts", "typography", "padding", "margin", "spacing",
  "flex", "flexbox", "grid", "css.grid", "gap",
  // frameworks
  "react", "vue", "svelte", "angular", "solid", "qwik", "lit", "preact",
  "next.js", "nuxt", "remix", "astro", "sveltekit", "solidstart",
  "html", "jsx", "tsx", "vue.template", "svelte.template",
  // widgets
  "button", "buttons", "form", "forms", "input", "inputs", "checkbox", "radio",
  "select", "dropdown", "combobox", "modal", "dialog", "drawer", "sidebar",
  "navbar", "header", "footer", "hero", "card", "table", "list",
  "spinner", "loader", "loading.state", "skeleton", "placeholder",
  "tooltip", "popover", "icon", "icons", "badge", "tag", "chip",
  "banner", "toast", "snackbar", "alert", "notification",
  "carousel", "slider", "tabs", "accordion", "stepper", "wizard",
  // accessibility
  "a11y", "accessibility", "aria", "wcag", "screen.reader", "keyboard.nav",
  "focus.trap", "focus.ring", "tab.index",
];

export const SIMPLE_EDIT_KEYWORDS = [
  // naming
  "rename", "change.name", "update.name", "update.variable", "fix.typo", "typo",
  "spelling", "grammar.fix",
  // comments / docs
  "add.comment", "remove.comment", "update.comment",
  // logs
  "add.log", "add.logs", "add.console", "console.log", "add.debug.log",
  "remove.log", "remove.console",
  // imports
  "add.import", "remove.import", "update.import", "reorder.import",
  "organize.import", "missing.import",
  // types
  "change.type", "update.type", "add.type", "remove.type", "fix.type.error",
  "type.annotation",
  // lint / format
  "fix.lint", "lint.error", "lint.warning", "format.code", "prettier", "eslint",
  "auto.format", "code.style",
  // misc small
  "change.format", "update.format", "date.format", "format.from",
  "add.tooltip", "add.badge", "add.icon",
  "increase.font.size", "decrease.font.size", "change.color", "swap.color",
  "rename.file", "move.file",
];

export const PROMPT_REWRITE_KEYWORDS = [
  "rewrite.prompt", "rewrite.this.prompt", "optimize.prompt", "improve.prompt",
  "reduce.tokens", "reduce.token.count", "shrink.prompt",
  "make.shorter", "compress.this", "shorten.this", "tighten.this",
  "simplify.this.message", "simplify.this.prompt", "token.optimization",
  "rewrite.this", "make.it.shorter", "more.concise", "more.compact",
  "verbose.prompt", "shorter.prompt", "trim.this",
];

export const LONG_CONTEXT_TRIGGERS = [
  "entire.codebase", "full.repo", "all.files", "whole.project", "the.whole.project",
  "throughout.the.project", "across.the.entire", "every.module", "every.file",
  "project.wide", "repo.wide", "monorepo.wide",
  "long.document", "long.transcript", "summarize.book",
  "100k.tokens", "200k.tokens", "1m.tokens",
];

export const PRIVACY_KEYWORDS = [
  "private", "local.only", "no.cloud", "on.prem", "on.premise", "self.host",
  "sensitive", "pii", "personally.identifiable",
  "personal.data", "patient.data", "hipaa", "phi", "gdpr", "ccpa",
  "confidential", "classified", "trade.secret",
  "internal.only", "proprietary", "company.internal",
  "air.gapped", "offline",
];

export const TOOL_USE_KEYWORDS = [
  "tool.use", "tool.calling", "function.calling", "function.call",
  "agent", "agentic", "react.agent", "auto.gpt", "babyagi",
  "browse.the.web", "web.search", "fetch.url", "scrape",
  "run.command", "shell.command", "execute.code",
  "read.file", "write.file", "edit.file",
  "code.interpreter", "python.repl", "sandbox",
];

export const VISION_KEYWORDS = [
  "image", "images", "photo", "photos", "picture", "screenshot",
  "ocr", "extract.text", "read.image",
  "describe.image", "analyze.image", "vision",
  "chart", "graph", "diagram.from", "draw.this",
  "ui.from.image", "wireframe", "mockup",
];

export const FRAMEWORK_PATTERNS: Array<{ pattern: RegExp; framework: string }> = [
  // JS frameworks
  { pattern: /next\.js|nextjs|next\s+app|next\.config|app\/router/i, framework: "Next.js" },
  { pattern: /\breact\b|\btsx\b|\bjsx\b|useState|useEffect|useContext|useReducer/i, framework: "React" },
  { pattern: /\bvue\b|nuxt|\.vue\b|setup\(\)|defineComponent/i, framework: "Vue" },
  { pattern: /angular|ng[A-Z]\w+|@Component|@Injectable/i, framework: "Angular" },
  { pattern: /svelte|sveltekit|\.svelte\b/i, framework: "Svelte" },
  { pattern: /solid-?js|createSignal|createEffect/i, framework: "Solid" },
  { pattern: /qwik|component\$|useSignal/i, framework: "Qwik" },
  { pattern: /astro|\.astro\b/i, framework: "Astro" },
  { pattern: /remix|@remix-run/i, framework: "Remix" },
  // backend
  { pattern: /\bexpress\b|\bfastify\b|\bkoa\b|\bhono\b|\bnest\.?js\b/i, framework: "Node.js" },
  { pattern: /trpc|@trpc\//i, framework: "tRPC" },
  // ORMs
  { pattern: /\bprisma\b|\bdrizzle\b|\btypeorm\b|\bsequelize\b|\bmongoose\b/i, framework: "ORM" },
  // validation
  { pattern: /\bzod\b|\byup\b|\bjoi\b|\bvalibot\b|\bsuperstruct\b/i, framework: "Validation" },
  // types
  { pattern: /typescript|\.tsx?\b|interface\s+\w|type\s+\w+\s*=/i, framework: "TypeScript" },
  // python
  { pattern: /\bpython\b|\.py\b|\bdjango\b|\bflask\b|\bfastapi\b|\bpydantic\b|\bnumpy\b|\bpandas\b/i, framework: "Python" },
  // systems
  { pattern: /\brust\b|cargo\.toml|\.rs\b|\btokio\b|\bserde\b/i, framework: "Rust" },
  { pattern: /\bgolang\b|\bgo\b|\.go\b|\bgin\b|\bechofw\b/i, framework: "Go" },
  { pattern: /\bzig\b|\.zig\b/i, framework: "Zig" },
  { pattern: /\bcpp\b|\bc\+\+\b|\.cpp\b|\.hpp\b/i, framework: "C++" },
  // jvm
  { pattern: /\bjava\b|spring|maven|gradle|\.kt\b|\bkotlin\b/i, framework: "JVM" },
  // styling
  { pattern: /\btailwind\b|tw-\w+|@apply/i, framework: "Tailwind CSS" },
  { pattern: /styled.components|emotion\.css|\.module\.css/i, framework: "CSS-in-JS" },
  // graphql / apis
  { pattern: /graphql|\bapollo\b|\bhasura\b|@graphql/i, framework: "GraphQL" },
  // databases
  { pattern: /\bpostgres(ql)?\b|\bpg\b\./i, framework: "PostgreSQL" },
  { pattern: /\bmongodb\b|\bmongoose\b/i, framework: "MongoDB" },
  { pattern: /\bredis\b|\bioredis\b/i, framework: "Redis" },
  { pattern: /\bsqlite\b|better-sqlite3/i, framework: "SQLite" },
  // cloud
  { pattern: /\baws\b|\bs3\b|\blambda\b|\bdynamo\b|\bcloudformation\b/i, framework: "AWS" },
  { pattern: /\bgcp\b|\bgoogle.cloud\b|firestore|bigquery/i, framework: "GCP" },
  { pattern: /\bazure\b|\bcosmos.?db\b/i, framework: "Azure" },
  { pattern: /\bvercel\b|\bnetlify\b|\bcloudflare\b|\bworkers\b/i, framework: "Edge" },
  // build
  { pattern: /\bvite\b|webpack|rollup|esbuild|turbopack|parcel/i, framework: "Build tools" },
  { pattern: /\bdocker\b|kubernetes|k8s|helm|terraform/i, framework: "DevOps" },
];

// ── Scoring helpers ───────────────────────────────────────────

function countKeywordHits(text: string, keywords: string[]): number {
  const lower = text.toLowerCase().replace(/[^a-z0-9\s._-]/g, " ");
  return keywords.filter((kw) => {
    // Escape all regex special chars, then convert dots to \s*
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = escaped.replace(/\\\./g, "[.\\s_-]*");
    try {
      return new RegExp(`(?<![a-z0-9])${pattern}(?![a-z0-9])`, "i").test(lower);
    } catch {
      return lower.includes(kw.replace(".", " "));
    }
  }).length;
}

interface ClassificationSignals {
  scores: Record<TaskType, number>;
  topHits: Record<string, number>;
}

function gatherSignals(text: string): ClassificationSignals {
  const hits = {
    security: countKeywordHits(text, SECURITY_KEYWORDS),
    database: countKeywordHits(text, DATABASE_KEYWORDS),
    architecture: countKeywordHits(text, ARCHITECTURE_KEYWORDS),
    multiFile: countKeywordHits(text, MULTI_FILE_KEYWORDS),
    explanation: countKeywordHits(text, EXPLANATION_KEYWORDS),
    test: countKeywordHits(text, TEST_KEYWORDS),
    ui: countKeywordHits(text, UI_KEYWORDS),
    simpleEdit: countKeywordHits(text, SIMPLE_EDIT_KEYWORDS),
    promptRewrite: countKeywordHits(text, PROMPT_REWRITE_KEYWORDS),
  };

  // Each task type accumulates a weighted score from relevant signals
  const scores: Record<TaskType, number> = {
    explanation: 0,
    simple_edit: 0,
    test_generation: 0,
    local_bug_fix: 0,
    ui_change: 0,
    api_implementation: 0,
    multi_file_refactor: 0,
    database_schema_change: 0,
    security_sensitive_change: 0,
    architecture_design: 0,
    prompt_rewrite_only: 0,
    performance_optimization: 0,
    devops_config: 0,
    documentation_write: 0,
    dependency_update: 0,
    code_review: 0,
    unknown: 0,
  };

  // Prompt rewrite is exclusive — strong signal beats all
  scores.prompt_rewrite_only += hits.promptRewrite * 3.0;

  scores.security_sensitive_change += hits.security * 1.2;
  scores.database_schema_change += hits.database * 1.0;
  scores.architecture_design += hits.architecture * 1.0;
  scores.multi_file_refactor += hits.multiFile * 0.9;
  scores.explanation += hits.explanation * 1.0;
  scores.test_generation += hits.test * 1.2;
  scores.ui_change += hits.ui * 0.9;
  scores.simple_edit += hits.simpleEdit * 1.0;

  // API impl detection (regex-based)
  if (/api.?route|endpoint|handler|controller|middleware|rest.?api|graphql.?resolver|route\.(?:get|post|put|delete|patch)/i.test(text)) {
    scores.api_implementation += 2.0;
  }

  // Bug fix detection (regex-based)
  if (/\b(bug|broken|crash|exception|stack.?trace|error|wrong|incorrect|not.?work|doesn't.?work|fails?|misbehav)/i.test(text)) {
    scores.local_bug_fix += 1.5;
  }
  if (/\bfix\b|\bdebug\b|\bsolve\b/i.test(text)) {
    scores.local_bug_fix += 0.8;
  }
  // Vague performance/quality complaints — these need difficulty bumped at the
  // recommender step because root-cause reasoning over vague signals is hard
  if (/\bwhy.?is.?my.?code.?slow|why.?is.?this.?slow|why.?doesn.?t.?(?:this|it).?work\b|something.?feels?.?(off|wrong)/i.test(text)) {
    scores.local_bug_fix += 1.0;
  }

  // Performance optimization detection
  if (/\b(optimize|optimization|performance|bottleneck|slow|speed\s+up|memory.?leak|profil|n\+1|bundle.?size|latency|throughput)/i.test(text)) {
    scores.performance_optimization += 1.5;
  }
  if (/\b(memoize|debounce|throttle|lazy.?load|code.?split|cache.?strategy|pagination|virtuali[sz])/i.test(text)) {
    scores.performance_optimization += 1.0;
  }

  // DevOps / config detection
  if (/\b(dockerfile|docker.?compose|github.?actions|ci\/cd|pipeline|kubernetes|k8s|helm|nginx|terraform|ansible|deploy)/i.test(text)) {
    scores.devops_config += 2.0;
  }
  if (/\b(healthcheck|health.?check|liveness|readiness|probe|graceful.?shutdown|rolling.?deploy)/i.test(text)) {
    scores.devops_config += 1.0;
  }

  // Documentation detection
  if (/\b(readme|jsdoc|tsdoc|docstring|document.?this|add.?comments?|api.?docs?|openapi|swagger|adr|architecture.?decision)/i.test(text)) {
    scores.documentation_write += 2.0;
  }

  // Dependency update detection
  if (/\b(upgrade|update|bump|migrate).+(?:version|v\d|package|library|dependency|dep)/i.test(text)) {
    scores.dependency_update += 2.0;
  }
  if (/\b(breaking.?change|changelog|peer.?dep|npm.?install|pnpm.?add)/i.test(text)) {
    scores.dependency_update += 1.0;
  }

  // Code review detection (question without implementation verb)
  if (/\b(review|audit|look.?at|check.?this|is.?this.?correct|any.?issues?|feedback.?on|what.?do.?you.?think)/i.test(text) &&
      !/\b(write|implement|add|create|build|generate|fix|refactor)\b/i.test(text)) {
    scores.code_review += 2.0;
  }

  return { scores, topHits: hits };
}

export function detectTaskType(message: string, filePath?: string): TaskType {
  const text = `${message} ${filePath ?? ""}`;
  const { scores } = gatherSignals(text);

  // Hard rules / overrides first
  if (scores.prompt_rewrite_only >= 3) return "prompt_rewrite_only";

  // Filename hints
  if (filePath) {
    const lowerPath = filePath.toLowerCase();
    if (/\.(test|spec)\./.test(lowerPath) || /__tests__/.test(lowerPath)) {
      scores.test_generation += 1.0;
    }
    if (/\.(css|scss|sass|less)$/.test(lowerPath)) scores.ui_change += 1.0;
    if (/migration|schema/.test(lowerPath)) scores.database_schema_change += 1.0;
    if (/route|api|controller|handler/.test(lowerPath)) scores.api_implementation += 0.8;
    if (/auth|security|crypto/.test(lowerPath)) scores.security_sensitive_change += 1.0;
  }

  // Find max
  let best: TaskType = "unknown";
  let bestScore = 0.5; // threshold — below this stay unknown
  for (const [k, v] of Object.entries(scores) as Array<[TaskType, number]>) {
    if (v > bestScore) {
      bestScore = v;
      best = k;
    }
  }

  // Don't pick "unknown" if we have any bug fix signal — default to local_bug_fix
  if (best === "unknown" && scores.local_bug_fix > 0) return "local_bug_fix";

  return best;
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
    performance_optimization: 3,
    devops_config: 4,
    documentation_write: 1,
    dependency_update: 3,
    code_review: 1,
    unknown: 2,
  };

  let risk = baseRisk[taskType] ?? 2;

  const secHits = countKeywordHits(message, SECURITY_KEYWORDS);
  if (secHits >= 4) risk = Math.max(risk, 5);
  else if (secHits >= 2) risk = Math.max(risk, 4);
  else if (secHits >= 1) risk = Math.max(risk, 3);

  const dbHits = countKeywordHits(message, DATABASE_KEYWORDS);
  if (dbHits >= 3) risk = Math.max(risk, 4);
  else if (dbHits >= 2) risk = Math.max(risk, 3);

  // Production / live signals bump risk
  if (/\bproduction\b|\bprod\b|\blive.?(server|database|env|environment)\b|\bcustomer.?data\b/i.test(message)) {
    risk = Math.min(risk + 1, 5);
  }

  // "money", "billing", "payment" — financial risk
  if (/\b(money|billing|payment|invoice|charge|refund|transaction)\b/i.test(message)) {
    risk = Math.max(risk, 4);
  }

  // "delete", "drop", "truncate" — destructive
  if (/\b(delete.?all|drop.?table|truncate|wipe|purge|hard.?delete)\b/i.test(message)) {
    risk = Math.min(risk + 1, 5);
  }

  return risk;
}

export function detectDifficulty(message: string, taskType: TaskType): number {
  const base: Record<TaskType, number> = {
    explanation: 2,
    simple_edit: 1,
    test_generation: 2,
    local_bug_fix: 3,
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
  if (/\bcomplex\b|\badvanced\b|\bsophisticated\b|\btricky\b|\bhard\b|\bnon.?trivial\b/i.test(message)) diff = Math.min(diff + 1, 5);
  if (/\bconcurren|\brace.?condition\b|\bdeadlock\b|\bthread.?safe\b|\batomic\b/i.test(message)) diff = Math.min(diff + 1, 5);
  if (/\bdistributed\b|\bsharded\b|\beventually.?consistent\b|\bconsensus\b/i.test(message)) diff = Math.min(diff + 1, 5);

  // Vague bug reports require strong reasoning to diagnose
  if (taskType === "local_bug_fix" && /\bwhy.?is.?(my.?code|this|it).?slow|why.?doesn.?t.?(?:this|it).?work|something.?feels?.?(off|wrong)/i.test(message)) {
    diff = Math.max(diff, 4);
  }

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

  let need = map[taskType] ?? "medium";

  // Promotion based on message keywords
  if (/\bentire\b|\bwhole\b|\bfull.?repo\b|\bevery.?file\b/i.test(message)) {
    if (need === "small") need = "medium";
    else if (need === "medium") need = "large";
    else if (need === "large") need = "huge";
  }

  return need;
}

export function detectChangeScope(taskType: TaskType, message: string): ChangeScope {
  if (/repo.?wide|entire.?codebase|all.?files|every.?file|across.?the.?project/i.test(message)) return "repo_wide";

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
