/**
 * Advanced classifier tests — edge cases, regression guards, boundary conditions.
 * These go beyond the baseline classifier.test.ts to catch subtle misclassifications
 * and verify the improvements from Round 3.
 */
import { describe, it, expect } from "vitest";
import { taskClassifier } from "../src/classifier/taskClassifier.js";
import { detectTaskType, detectRiskLevel, detectDifficulty } from "../src/classifier/rules.js";

// ── Rule 16 regression guard: code_review vs generative verbs ──────────────
describe("Rule 16: code_review detection (regression guard)", () => {
  // These MUST be classified as code_review (review verb is primary action)
  const codeReviewCases = [
    "review this migration for production safety",
    "give me feedback on this auth handler",
    "is this React component idiomatic? what would you change",
    "review this PR diff and call out issues by severity",
    "check this code for bugs",
    "what would you change about this module?",
    "is this good practice?",
  ];

  for (const prompt of codeReviewCases) {
    it(`classifies as code_review: "${prompt.slice(0, 50)}"`, () => {
      const result = taskClassifier.classify({ message: prompt, userMode: "balanced" });
      expect(result.taskType).toBe("code_review");
    });
  }

  // These must NOT be classified as code_review (generative verb is primary)
  const notCodeReviewCases: Array<{ prompt: string; expected: string }> = [
    {
      prompt: "design the migration plan to shard the orders table by tenant_id",
      expected: "database_schema_change",
    },
    {
      prompt: "write a migration to add NOT NULL column to users table",
      expected: "database_schema_change",
    },
    {
      prompt: "implement JWT token rotation with RS256 key",
      expected: "security_sensitive_change",
    },
    {
      prompt: "build the auth system from scratch",
      expected: "security_sensitive_change",
    },
    {
      prompt: "create a new migration for soft-delete support",
      expected: "database_schema_change",
    },
  ];

  for (const { prompt, expected } of notCodeReviewCases) {
    it(`should NOT classify as code_review: "${prompt.slice(0, 60)}"`, () => {
      const result = taskClassifier.classify({ message: prompt, userMode: "balanced" });
      expect(result.taskType).not.toBe("code_review");
      // For db/security cases, the classifier should get the domain right
      if (expected === "database_schema_change" || expected === "security_sensitive_change") {
        expect(result.taskType).toBe(expected);
      }
    });
  }
});

// ── Creative generation vs UI change boundary ─────────────────────────────
describe("creative_generation vs ui_change boundary", () => {
  const creativeCases = [
    "make a breakout game",
    "build a snake game in HTML and JS",
    "create a landing page for an AI startup",
    "make a 2048 game in vanilla JS",
    "build a pomodoro timer app",
    "make a calculator app",
    "build a kanban board with drag and drop",
    "create an interactive demo of conway's game of life",
  ];

  for (const prompt of creativeCases) {
    it(`classifies as creative_generation: "${prompt}"`, () => {
      const result = taskClassifier.classify({ message: prompt, userMode: "balanced" });
      expect(result.taskType).toBe("creative_generation");
    });
  }

  const uiChangeCases = [
    { prompt: "add hover styles to this button", rawCode: "<button>Click</button>" },
    { prompt: "make this card responsive on mobile", rawCode: "<div class='flex'>" },
    { prompt: "change the primary color to emerald", rawCode: "bg-indigo-500" },
    { prompt: "add aria-label to this icon button", rawCode: "<button><Icon /></button>" },
  ];

  for (const { prompt, rawCode } of uiChangeCases) {
    it(`classifies as ui_change (not creative): "${prompt}"`, () => {
      const result = taskClassifier.classify({ message: prompt, selectedCode: rawCode, userMode: "balanced" });
      expect(result.taskType).toBe("ui_change");
      expect(result.taskType).not.toBe("creative_generation");
    });
  }
});

// ── Security sensitive detection — risk level ─────────────────────────────
describe("Security task risk levels", () => {
  const highRiskSecCases = [
    { prompt: "implement bcrypt password hashing and verify", minRisk: 4 },
    { prompt: "add OAuth2 PKCE flow for SPA login", minRisk: 4 },
    { prompt: "validate Stripe webhook HMAC signature", minRisk: 4 },
    { prompt: "implement rate limiting for login to prevent brute force", minRisk: 4 },
    { prompt: "encrypt API keys at rest with AES-256-GCM", minRisk: 4 },
    { prompt: "add CSRF protection to all mutating endpoints", minRisk: 4 },
  ];

  for (const { prompt, minRisk } of highRiskSecCases) {
    it(`"${prompt.slice(0, 50)}" — risk >= ${minRisk}`, () => {
      const result = taskClassifier.classify({ message: prompt, userMode: "balanced" });
      expect(result.riskLevel).toBeGreaterThanOrEqual(minRisk);
      expect(result.taskType).toBe("security_sensitive_change");
    });
  }
});

// ── Database task risk levels ─────────────────────────────────────────────
describe("Database task risk levels", () => {
  const dbCases = [
    { prompt: "add a migration to add NOT NULL created_at to orders (50M rows)", minRisk: 4 },
    { prompt: "add unique composite index on (user_id, slug) without locking", minRisk: 4 },
    { prompt: "split name column into first_name and last_name with data migration", minRisk: 4 },
    { prompt: "convert enum column to lookup table — preserve historical data", minRisk: 4 },
  ];

  for (const { prompt, minRisk } of dbCases) {
    it(`"${prompt.slice(0, 50)}" — taskType=db, risk >= ${minRisk}`, () => {
      const result = taskClassifier.classify({ message: prompt, userMode: "balanced" });
      expect(result.taskType).toBe("database_schema_change");
      expect(result.riskLevel).toBeGreaterThanOrEqual(minRisk);
    });
  }
});

// ── Vague/ambiguous bug reports — difficulty floor ────────────────────────
describe("Vague bug reports: difficulty floor", () => {
  const vaguesBugs = [
    { prompt: "why is my code slow", minDiff: 3 },
    { prompt: "something feels off", minDiff: 3 },
    { prompt: "this doesn't work", minDiff: 3 },
    { prompt: "why doesn't this work", minDiff: 3 },
  ];

  for (const { prompt, minDiff } of vaguesBugs) {
    it(`"${prompt}" — difficulty >= ${minDiff}`, () => {
      const result = taskClassifier.classify({ message: prompt, userMode: "balanced" });
      expect(result.taskType).toBe("local_bug_fix");
      expect(result.difficulty).toBeGreaterThanOrEqual(minDiff);
    });
  }
});

// ── Memory leak / race condition / vectorize — risk/difficulty boost ───────
describe("Advanced diagnostics: risk and difficulty boosts", () => {
  it("memory leak gets riskLevel >= 4", () => {
    const risk = detectRiskLevel("memory leak in my Node service — heap grows ~50MB per hour", "local_bug_fix");
    expect(risk).toBeGreaterThanOrEqual(4);
  });

  it("race condition gets riskLevel >= 4", () => {
    const risk = detectRiskLevel("fix the race condition when two requests increment the counter", "local_bug_fix");
    expect(risk).toBeGreaterThanOrEqual(4);
  });

  it("vectorize/SIMD gets riskLevel >= 4", () => {
    const risk = detectRiskLevel("this loop is hot in flamegraph — vectorize or rewrite for speed", "performance_optimization");
    expect(risk).toBeGreaterThanOrEqual(4);
  });

  it("memory leak gets difficulty >= 4", () => {
    const diff = detectDifficulty("heap grows 50MB per hour — memory leak somewhere in event listeners", "local_bug_fix");
    expect(diff).toBeGreaterThanOrEqual(4);
  });

  it("deadlock gets difficulty >= 4", () => {
    const diff = detectDifficulty("deadlock between two transactions in the checkout flow", "local_bug_fix");
    expect(diff).toBeGreaterThanOrEqual(4);
  });

  it("hot loop vectorize gets difficulty >= 4", () => {
    const diff = detectDifficulty("this loop is in a flamegraph hot path — vectorize for SIMD", "performance_optimization");
    expect(diff).toBeGreaterThanOrEqual(4);
  });

  it("sharding gets riskLevel >= 4", () => {
    const risk = detectRiskLevel("shard the orders table by tenant_id — design the migration plan", "database_schema_change");
    expect(risk).toBeGreaterThanOrEqual(4);
  });
});

// ── Open-ended creation verb: difficulty floor ────────────────────────────
describe("Open-ended creation verb: difficulty floor (no code context)", () => {
  const creationCases = [
    { prompt: "make a clock", desc: "15 chars" },
    { prompt: "build a calculator", desc: "18 chars" },
    { prompt: "create a simple game", desc: "20 chars" },
    { prompt: "build me an app from scratch", desc: "from scratch" },
    { prompt: "implement a complete todo list", desc: "complete keyword" },
  ];

  for (const { prompt, desc } of creationCases) {
    it(`"${prompt}" (${desc}) → difficulty >= 4 (no code context)`, () => {
      const diff = detectDifficulty(prompt, "creative_generation", false);
      expect(diff).toBeGreaterThanOrEqual(4);
    });
  }
});

// ── File path hints ───────────────────────────────────────────────────────
describe("File path hints influence classification", () => {
  it("auth.ts path boosts security classification", () => {
    const result = taskClassifier.classify({
      message: "add rate limiting to this endpoint",
      activeFilePath: "src/auth/authMiddleware.ts",
      userMode: "balanced",
    });
    expect(result.taskType).toBe("security_sensitive_change");
  });

  it("migration file path boosts db classification", () => {
    const result = taskClassifier.classify({
      message: "add this column",
      activeFilePath: "db/migrations/001_add_users_column.sql",
      userMode: "balanced",
    });
    expect(result.taskType).toBe("database_schema_change");
  });

  it("test file path boosts test_generation", () => {
    const result = taskClassifier.classify({
      message: "add more coverage for edge cases",
      activeFilePath: "src/__tests__/userService.test.ts",
      userMode: "balanced",
    });
    expect(result.taskType).toBe("test_generation");
  });
});

// ── Multi-signal integration: architecture ───────────────────────────────
describe("Architecture design detection", () => {
  const archCases = [
    "design a notification system supporting email, SMS, and push — extensible to new channels",
    "we have a monolith with auth, payments, analytics — should we split into microservices?",
    "design a multi-tenant data model with row-level isolation",
    "real-time collaborative editing — propose the conflict resolution model using OT or CRDT",
  ];

  for (const prompt of archCases) {
    it(`classifies as architecture_design: "${prompt.slice(0, 60)}"`, () => {
      const result = taskClassifier.classify({ message: prompt, userMode: "balanced" });
      expect(result.taskType).toBe("architecture_design");
      expect(result.difficulty).toBeGreaterThanOrEqual(4);
    });
  }
});

// ── Performance optimization detection ───────────────────────────────────
describe("Performance optimization detection", () => {
  const perfCases = [
    { prompt: "this list query is N+1. rewrite with eager loading", expected: "performance_optimization" },
    { prompt: "our LCP is 4.2s — give me a prioritized list of fixes", expected: "performance_optimization" },
    { prompt: "bundle size is 1.8MB — propose code splitting", expected: "performance_optimization" },
  ];

  for (const { prompt, expected } of perfCases) {
    it(`classifies correctly: "${prompt.slice(0, 60)}"`, () => {
      const result = taskClassifier.classify({ message: prompt, userMode: "balanced" });
      expect(result.taskType).toBe(expected);
    });
  }
});

// ── Prompt rewrite detection (exclusive) ─────────────────────────────────
describe("Prompt rewrite only — exclusive classifier", () => {
  const rewriteCases = [
    "rewrite this prompt to reduce tokens",
    "make this prompt shorter and clearer",
    "shorten this prompt while keeping all constraints",
    "compress this prompt — way too verbose",
    "simplify this prompt",
  ];

  for (const prompt of rewriteCases) {
    it(`classifies as prompt_rewrite_only: "${prompt}"`, () => {
      const result = taskClassifier.classify({ message: prompt, userMode: "balanced" });
      expect(result.taskType).toBe("prompt_rewrite_only");
    });
  }
});

// ── DevOps risk level ─────────────────────────────────────────────────────
describe("DevOps tasks have elevated risk", () => {
  const devopsCases = [
    "write a multi-stage Dockerfile for Next.js production build",
    "write a GitHub Actions CI workflow that runs lint, test, deploy",
    "k8s deployment + service + HPA for Node service",
  ];

  for (const prompt of devopsCases) {
    it(`DevOps risk >= 3: "${prompt.slice(0, 50)}"`, () => {
      const result = taskClassifier.classify({ message: prompt, userMode: "balanced" });
      expect(result.taskType).toBe("devops_config");
      expect(result.riskLevel).toBeGreaterThanOrEqual(3);
    });
  }
});

// ── Framework detection precision ─────────────────────────────────────────
describe("Framework detection", () => {
  it("detects TypeScript, Next.js, and Zod together", () => {
    const result = taskClassifier.classify({
      message: "Add a Zod-validated API route in Next.js",
      activeFilePath: "app/api/users/route.ts",
      userMode: "balanced",
    });
    expect(result.languageOrFramework).toContain("TypeScript");
    expect(result.languageOrFramework).toContain("Next.js");
  });

  it("detects Prisma from message", () => {
    const result = taskClassifier.classify({
      message: "write a Prisma migration to add the deleted_at column",
      userMode: "balanced",
    });
    expect(result.languageOrFramework).toContain("ORM");
  });

  it("detects Python/Django", () => {
    const result = taskClassifier.classify({
      message: "write a Django REST framework view for user registration",
      userMode: "balanced",
    });
    expect(result.languageOrFramework).toContain("Python");
  });

  it("detects Rust from file extension", () => {
    const result = taskClassifier.classify({
      message: "implement a concurrent queue",
      activeFilePath: "src/queue.rs",
      userMode: "balanced",
    });
    expect(result.languageOrFramework).toContain("Rust");
  });
});

// ── Production / financial signals bump risk ──────────────────────────────
describe("Production and financial signals bump risk", () => {
  it("'production database' mention bumps risk", () => {
    const risk = detectRiskLevel("apply this migration to the production database tonight", "database_schema_change");
    expect(risk).toBeGreaterThanOrEqual(4);
  });

  it("'billing' mention bumps risk to 4+", () => {
    const risk = detectRiskLevel("update the billing calculation for annual plans", "api_implementation");
    expect(risk).toBeGreaterThanOrEqual(4);
  });

  it("'payment' mention bumps risk to 4+", () => {
    const risk = detectRiskLevel("process payment webhook from Stripe", "api_implementation");
    expect(risk).toBeGreaterThanOrEqual(4);
  });

  it("'drop table' bumps risk", () => {
    const risk = detectRiskLevel("drop the legacy users_old table after migration", "database_schema_change");
    expect(risk).toBeGreaterThanOrEqual(4);
  });
});

// ── Corpus spot-checks: edge cases from the eval corpus ──────────────────
describe("Corpus spot-checks", () => {
  it("bug-11: memory leak → strong tier (riskLevel 4+)", () => {
    const result = taskClassifier.classify({
      message: "memory leak in my Node service — heap grows ~50MB per hour",
      userMode: "balanced",
    });
    expect(result.riskLevel).toBeGreaterThanOrEqual(4);
  });

  it("bug-12: deadlock → strong tier (riskLevel 4+)", () => {
    const result = taskClassifier.classify({
      message: "deadlock between two transactions. trace and fix",
      userMode: "balanced",
    });
    expect(result.riskLevel).toBeGreaterThanOrEqual(4);
  });

  it("perf-6: vectorize hot loop → strong tier (riskLevel 4+)", () => {
    const result = taskClassifier.classify({
      message: "this loop is hot in flamegraph — vectorize or rewrite for speed",
      userMode: "balanced",
    });
    expect(result.riskLevel).toBeGreaterThanOrEqual(4);
  });

  it("arch-3: job queue design → architecture_design, difficulty 4+", () => {
    const result = taskClassifier.classify({
      message: "design a job queue with retries, DLQ, and exactly-once semantics",
      userMode: "balanced",
    });
    expect(result.taskType).toBe("architecture_design");
    expect(result.difficulty).toBeGreaterThanOrEqual(4);
  });

  it("db-8: shard orders table — architecture_design or database_schema_change, NOT code_review", () => {
    const result = taskClassifier.classify({
      message: "shard the orders table by tenant_id — design the migration plan",
      userMode: "balanced",
    });
    expect(result.taskType).not.toBe("code_review");
    expect(["architecture_design", "database_schema_change"]).toContain(result.taskType);
  });

  it("rev-4: review migration for production safety → code_review", () => {
    const result = taskClassifier.classify({
      message: "review this migration for production safety",
      userMode: "balanced",
    });
    expect(result.taskType).toBe("code_review");
  });
});
