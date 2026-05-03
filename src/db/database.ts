import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";
import { logger } from "../utils/logger.js";
import path from "path";
import fs from "fs";

const DEFAULT_DB_PATH = "./cupid_router.db";

let _db: ReturnType<typeof drizzle> | null = null;
let _sqlite: Database.Database | null = null;

export function getDb() {
  if (!_db) {
    throw new Error("Database not initialized. Call initDb() first.");
  }
  return _db;
}

export function getSqlite() {
  if (!_sqlite) {
    throw new Error("Database not initialized. Call initDb() first.");
  }
  return _sqlite;
}

export function initDb(dbPath?: string): ReturnType<typeof drizzle> {
  const resolvedPath = dbPath ?? process.env["DATABASE_PATH"] ?? DEFAULT_DB_PATH;
  const absolutePath = path.resolve(resolvedPath);

  const dir = path.dirname(absolutePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  logger.info(`Initializing database at: ${absolutePath}`);

  _sqlite = new Database(absolutePath);
  _sqlite.pragma("journal_mode = WAL");
  _sqlite.pragma("foreign_keys = ON");
  _sqlite.pragma("synchronous = NORMAL");

  _db = drizzle(_sqlite, { schema });

  runMigrations(_sqlite);

  logger.info("Database initialized successfully");
  return _db;
}

function runMigrations(sqlite: Database.Database) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS models (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      display_name TEXT NOT NULL,
      tier TEXT NOT NULL DEFAULT 'unknown',
      input_price_per_million REAL NOT NULL DEFAULT 0,
      output_price_per_million REAL NOT NULL DEFAULT 0,
      cached_input_price_per_million REAL,
      cache_write_price_per_million REAL,
      context_window INTEGER NOT NULL DEFAULT 4096,
      max_output_tokens INTEGER NOT NULL DEFAULT 4096,
      modality TEXT NOT NULL DEFAULT 'text',
      tool_calling_support INTEGER,
      vision_support INTEGER,
      coding_score REAL,
      general_score REAL,
      latency_score REAL,
      output_speed REAL,
      source_confidence TEXT NOT NULL DEFAULT 'internal',
      source_url TEXT NOT NULL DEFAULT '',
      last_updated TEXT NOT NULL,
      deprecated INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS benchmarks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      model_id TEXT NOT NULL REFERENCES models(id),
      benchmark_name TEXT NOT NULL,
      score REAL NOT NULL,
      metric_type TEXT NOT NULL,
      source_url TEXT NOT NULL DEFAULT '',
      date_collected TEXT NOT NULL,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      source_name TEXT NOT NULL,
      source_url TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      embedding TEXT,
      created_at TEXT NOT NULL,
      last_updated TEXT NOT NULL,
      source_confidence TEXT NOT NULL DEFAULT 'internal'
    );

    CREATE TABLE IF NOT EXISTS prompt_optimization_rules (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      rule_type TEXT NOT NULL,
      applies_to_models_json TEXT NOT NULL DEFAULT '[]',
      applies_to_task_types_json TEXT NOT NULL DEFAULT '[]',
      expected_benefit TEXT NOT NULL,
      risk_level TEXT NOT NULL DEFAULT 'low',
      source_url TEXT NOT NULL DEFAULT '',
      source_confidence TEXT NOT NULL DEFAULT 'internal',
      last_updated TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS task_logs (
      task_id TEXT PRIMARY KEY,
      user_id TEXT,
      repo_id TEXT,
      raw_message TEXT NOT NULL,
      optimized_message TEXT NOT NULL,
      selected_model TEXT NOT NULL,
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      estimated_cost REAL NOT NULL DEFAULT 0,
      actual_cost REAL,
      latency_ms INTEGER,
      test_passed INTEGER,
      lint_passed INTEGER,
      typecheck_passed INTEGER,
      user_accepted INTEGER,
      escalated INTEGER NOT NULL DEFAULT 0,
      final_model TEXT,
      changed_files_count INTEGER,
      changed_loc INTEGER,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recommendation_logs (
      request_id TEXT PRIMARY KEY,
      raw_message TEXT NOT NULL,
      optimized_message TEXT NOT NULL,
      task_json TEXT NOT NULL,
      candidate_models_json TEXT NOT NULL,
      selected_model TEXT NOT NULL,
      recommendation_json TEXT NOT NULL,
      prompt_optimization_json TEXT NOT NULL,
      estimated_raw_tokens INTEGER NOT NULL DEFAULT 0,
      estimated_optimized_tokens INTEGER NOT NULL DEFAULT 0,
      estimated_token_savings INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_models_provider ON models(provider);
    CREATE INDEX IF NOT EXISTS idx_models_tier ON models(tier);
    CREATE INDEX IF NOT EXISTS idx_benchmarks_model ON benchmarks(model_id);
    CREATE INDEX IF NOT EXISTS idx_documents_source ON documents(source_name);
    CREATE INDEX IF NOT EXISTS idx_task_logs_model ON task_logs(selected_model);
    CREATE INDEX IF NOT EXISTS idx_task_logs_created ON task_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_rec_logs_created ON recommendation_logs(created_at);

    CREATE TABLE IF NOT EXISTS eval_runs (
      id TEXT PRIMARY KEY,
      repo_id TEXT NOT NULL,
      repo_name TEXT NOT NULL DEFAULT '',
      task_message TEXT NOT NULL,
      optimized_message TEXT NOT NULL DEFAULT '',
      user_mode TEXT NOT NULL DEFAULT 'balanced',
      experiment_mode TEXT NOT NULL DEFAULT 'router_vs_strong',
      task_classification_json TEXT NOT NULL DEFAULT '{}',
      recommendation_json TEXT NOT NULL DEFAULT '{}',
      context_plan_json TEXT NOT NULL DEFAULT '{}',
      cache_plan_json TEXT NOT NULL DEFAULT '{}',
      verification_plan_json TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'pending',
      error_message TEXT,
      created_at TEXT NOT NULL,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS eval_candidates (
      id TEXT PRIMARY KEY,
      eval_run_id TEXT NOT NULL REFERENCES eval_runs(id),
      label TEXT NOT NULL,
      model_id TEXT NOT NULL,
      tier TEXT NOT NULL DEFAULT 'unknown',
      workspace_path TEXT NOT NULL DEFAULT '',
      raw_prompt TEXT NOT NULL DEFAULT '',
      optimized_prompt TEXT NOT NULL DEFAULT '',
      llm_output_json TEXT NOT NULL DEFAULT '{}',
      output_parse_status TEXT NOT NULL DEFAULT 'pending',
      diff_text TEXT NOT NULL DEFAULT '',
      files_changed_json TEXT NOT NULL DEFAULT '[]',
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      total_tokens INTEGER NOT NULL DEFAULT 0,
      estimated_cost_usd REAL NOT NULL DEFAULT 0,
      actual_cost_usd REAL,
      latency_ms INTEGER,
      verification_json TEXT NOT NULL DEFAULT '{}',
      success INTEGER,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS eval_metrics (
      id TEXT PRIMARY KEY,
      eval_run_id TEXT NOT NULL REFERENCES eval_runs(id),
      router_cost_usd REAL NOT NULL DEFAULT 0,
      strong_baseline_cost_usd REAL NOT NULL DEFAULT 0,
      savings_usd REAL NOT NULL DEFAULT 0,
      savings_percent REAL NOT NULL DEFAULT 0,
      prompt_token_reduction_percent REAL NOT NULL DEFAULT 0,
      router_success INTEGER,
      baseline_success INTEGER,
      quality_retention REAL,
      success_per_dollar REAL,
      diff_comparison_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS human_ratings (
      id TEXT PRIMARY KEY,
      eval_run_id TEXT NOT NULL REFERENCES eval_runs(id),
      preferred_candidate TEXT,
      router_acceptance TEXT,
      baseline_acceptance TEXT,
      rating_notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_eval_runs_status ON eval_runs(status);
    CREATE INDEX IF NOT EXISTS idx_eval_runs_created ON eval_runs(created_at);
    CREATE INDEX IF NOT EXISTS idx_eval_candidates_run ON eval_candidates(eval_run_id);
    CREATE INDEX IF NOT EXISTS idx_eval_candidates_label ON eval_candidates(label);
    CREATE INDEX IF NOT EXISTS idx_eval_metrics_run ON eval_metrics(eval_run_id);
    CREATE INDEX IF NOT EXISTS idx_human_ratings_run ON human_ratings(eval_run_id);
  `);
}

export function closeDb() {
  if (_sqlite) {
    _sqlite.close();
    _sqlite = null;
    _db = null;
    logger.info("Database closed");
  }
}
