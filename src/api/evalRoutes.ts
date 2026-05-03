import type { FastifyInstance } from "fastify";
import { randomUUID } from "crypto";
import { getSqlite } from "../db/database.js";
import { runEvaluation } from "../evaluation/evalOrchestrator.js";
import { listSampleRepos, getRepoById, readRepoFile } from "../evaluation/repoManager.js";
import { generateMarkdownReport } from "../evaluation/reportExporter.js";
import fs from "fs";
import path from "path";

export async function registerEvalRoutes(app: FastifyInstance) {

  // GET /api/repos
  app.get("/api/repos", async (_req, reply) => {
    const repos = listSampleRepos();
    return reply.send({ repos });
  });

  // GET /api/repos/:repoId/tree
  app.get<{ Params: { repoId: string } }>("/api/repos/:repoId/tree", async (req, reply) => {
    const repo = getRepoById(req.params.repoId);
    if (!repo) return reply.status(404).send({ error: "Repo not found" });
    return reply.send({ repo });
  });

  // GET /api/repos/:repoId/file?path=
  app.get<{ Params: { repoId: string }; Querystring: { path: string } }>(
    "/api/repos/:repoId/file",
    async (req, reply) => {
      try {
        const content = readRepoFile(req.params.repoId, req.query.path);
        return reply.send({ content, path: req.query.path });
      } catch (err) {
        return reply.status(404).send({ error: String(err) });
      }
    }
  );

  // POST /api/evals/run
  app.post<{ Body: unknown }>("/api/evals/run", async (req, reply) => {
    const body = req.body as Record<string, unknown>;

    if (!body.repoId || !body.taskMessage) {
      return reply.status(400).send({ error: "repoId and taskMessage are required" });
    }

    const input = {
      repoId: String(body.repoId),
      taskMessage: String(body.taskMessage),
      activeFilePath: body.activeFilePath ? String(body.activeFilePath) : undefined,
      userMode: (body.userMode ?? "balanced") as "cost_saving" | "balanced" | "max_quality",
      experimentMode: (body.experimentMode ?? "router_vs_strong") as "router_vs_strong" | "router_vs_cheap_vs_strong" | "manual_vs_router",
      strongBaselineModel: body.strongBaselineModel ? String(body.strongBaselineModel) : undefined,
      cheapBaselineModel: body.cheapBaselineModel ? String(body.cheapBaselineModel) : undefined,
      manualModel: body.manualModel ? String(body.manualModel) : undefined,
      runVerification: Boolean(body.runVerification ?? false),
    };

    // Run async - return run ID immediately for polling, or wait for small tasks
    const result = await runEvaluation(input);
    return reply.send(result);
  });

  // GET /api/evals
  app.get<{ Querystring: { limit?: string; offset?: string } }>("/api/evals", async (req, reply) => {
    const limit = parseInt(req.query.limit ?? "20");
    const offset = parseInt(req.query.offset ?? "0");
    const sqlite = getSqlite();

    const runs = sqlite.prepare(`
      SELECT r.*,
        m.savings_percent, m.router_cost_usd, m.strong_baseline_cost_usd,
        hr.preferred_candidate, hr.router_acceptance
      FROM eval_runs r
      LEFT JOIN eval_metrics m ON m.eval_run_id = r.id
      LEFT JOIN human_ratings hr ON hr.eval_run_id = r.id
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);

    const total = (sqlite.prepare("SELECT COUNT(*) as count FROM eval_runs").get() as { count: number }).count;

    return reply.send({ runs, total, limit, offset });
  });

  // GET /api/evals/:id
  app.get<{ Params: { id: string } }>("/api/evals/:id", async (req, reply) => {
    const sqlite = getSqlite();
    const run = sqlite.prepare("SELECT * FROM eval_runs WHERE id = ?").get(req.params.id);
    if (!run) return reply.status(404).send({ error: "Run not found" });

    const candidates = sqlite.prepare("SELECT * FROM eval_candidates WHERE eval_run_id = ? ORDER BY created_at").all(req.params.id);
    const metrics = sqlite.prepare("SELECT * FROM eval_metrics WHERE eval_run_id = ?").get(req.params.id);
    const rating = sqlite.prepare("SELECT * FROM human_ratings WHERE eval_run_id = ?").get(req.params.id);

    return reply.send({ run, candidates, metrics, rating });
  });

  // POST /api/evals/:id/rating
  app.post<{ Params: { id: string }; Body: unknown }>("/api/evals/:id/rating", async (req, reply) => {
    const sqlite = getSqlite();
    const body = req.body as Record<string, unknown>;
    const runId = req.params.id;

    const run = sqlite.prepare("SELECT id FROM eval_runs WHERE id = ?").get(runId);
    if (!run) return reply.status(404).send({ error: "Run not found" });

    const ratingId = randomUUID();
    sqlite.prepare(`
      INSERT OR REPLACE INTO human_ratings (id, eval_run_id, preferred_candidate, router_acceptance, baseline_acceptance, rating_notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      ratingId, runId,
      body.preferredCandidate ? String(body.preferredCandidate) : null,
      body.routerAcceptance ? String(body.routerAcceptance) : null,
      body.baselineAcceptance ? String(body.baselineAcceptance) : null,
      body.ratingNotes ? String(body.ratingNotes) : null,
      new Date().toISOString()
    );

    return reply.send({ success: true, ratingId });
  });

  // GET /api/stats/aggregate
  app.get("/api/stats/aggregate", async (_req, reply) => {
    const sqlite = getSqlite();

    const total = (sqlite.prepare("SELECT COUNT(*) as count FROM eval_runs").get() as { count: number }).count;
    const completed = (sqlite.prepare("SELECT COUNT(*) as count FROM eval_runs WHERE status = 'completed'").get() as { count: number }).count;

    const avgSavings = sqlite.prepare(
      "SELECT AVG(savings_percent) as avg_savings, AVG(router_cost_usd) as avg_router_cost FROM eval_metrics"
    ).get() as { avg_savings: number | null; avg_router_cost: number | null };

    const routerSuccess = sqlite.prepare(
      "SELECT COUNT(*) as count FROM eval_candidates WHERE label = 'router' AND success = 1"
    ).get() as { count: number };

    const topTaskTypes = sqlite.prepare(`
      SELECT json_extract(task_classification_json, '$.taskType') as task_type,
             COUNT(*) as count,
             AVG(m.savings_percent) as avg_savings
      FROM eval_runs r
      LEFT JOIN eval_metrics m ON m.eval_run_id = r.id
      WHERE r.status = 'completed'
      GROUP BY task_type
      ORDER BY avg_savings DESC
      LIMIT 10
    `).all();

    return reply.send({
      totalRuns: total,
      completedRuns: completed,
      averageSavingsPercent: avgSavings?.avg_savings ?? 0,
      averageRouterCostUsd: avgSavings?.avg_router_cost ?? 0,
      routerSuccessCount: routerSuccess.count,
      topTaskTypes,
    });
  });

  // POST /api/evals/:id/export
  app.post<{ Params: { id: string } }>("/api/evals/:id/export", async (req, reply) => {
    const sqlite = getSqlite();
    const run = sqlite.prepare("SELECT * FROM eval_runs WHERE id = ?").get(req.params.id) as Record<string, unknown> | undefined;
    if (!run) return reply.status(404).send({ error: "Run not found" });

    const candidates = sqlite.prepare("SELECT * FROM eval_candidates WHERE eval_run_id = ?").all(req.params.id) as unknown[];
    const metrics = sqlite.prepare("SELECT * FROM eval_metrics WHERE eval_run_id = ?").get(req.params.id) as unknown;
    const rating = sqlite.prepare("SELECT * FROM human_ratings WHERE eval_run_id = ?").get(req.params.id) as unknown;

    const report = generateMarkdownReport({ run: run as any, candidates: candidates as any, metrics: metrics as any, rating: rating as any });

    const reportsDir = path.resolve("./reports/evals");
    if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
    const reportPath = path.join(reportsDir, `eval-${req.params.id}.md`);
    fs.writeFileSync(reportPath, report, "utf-8");

    return reply.send({ reportPath, report });
  });

  // GET /api/eval-tasks
  app.get("/api/eval-tasks", async (_req, reply) => {
    try {
      const tasksPath = path.resolve("./data/sample_eval_tasks.json");
      const tasks = JSON.parse(fs.readFileSync(tasksPath, "utf-8"));
      return reply.send(tasks);
    } catch {
      return reply.send({ tasks: [] });
    }
  });
}
