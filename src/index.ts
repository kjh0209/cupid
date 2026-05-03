import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env file manually (no dotenv dependency needed)
try {
  const envPath = resolve(process.cwd(), ".env");
  const lines = readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (key && !(key in process.env)) process.env[key] = val;
  }
} catch { /* no .env file — rely on shell environment */ }

import { initDb } from "./db/database.js";
import { logger } from "./utils/logger.js";
import { importAll } from "./collectors/manualImporter.js";
import { collectBuiltinBenchmarks } from "./collectors/benchmarkCollector.js";
import { collectBuiltinOptimizationRules } from "./collectors/promptOptimizationCollector.js";
import { buildAllDocuments } from "./rag/documentBuilder.js";
import { reindexAll } from "./rag/indexer.js";
import { generateAllReports } from "./reports/reportGenerator.js";

const command = process.argv[2];

async function main() {
  if (command === "ingest") {
    logger.info("Running data ingestion...");
    initDb();
    await importAll();
    await collectBuiltinBenchmarks();
    await collectBuiltinOptimizationRules();
    await buildAllDocuments();
    await reindexAll();
    await generateAllReports();
    logger.info("Ingestion complete");
    return;
  }

  if (command === "reindex") {
    logger.info("Reindexing RAG documents...");
    initDb();
    await reindexAll();
    logger.info("Reindex complete");
    return;
  }

  // Default: start server
  const { startServer } = await import("./server.js");
  initDb();
  await startServer();
}

main().catch((err) => {
  logger.error("Fatal error", err);
  process.exit(1);
});
