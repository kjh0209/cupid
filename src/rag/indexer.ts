import { getDb, getSqlite } from "../db/database.js";
import { documents } from "../db/schema.js";
import { embed, updateIdf } from "./embedder.js";
import { logger } from "../utils/logger.js";
import { todayIso } from "../utils/sourceFreshness.js";

export async function indexDocument(doc: {
  title: string;
  sourceName: string;
  sourceUrl: string;
  content: string;
  metadataJson?: string;
  sourceConfidence?: string;
}): Promise<number> {
  const db = getDb();
  const now = todayIso();

  const embedding = await embed(doc.content);
  const embeddingStr = JSON.stringify(embedding);

  const result = await db
    .insert(documents)
    .values({
      title: doc.title,
      sourceName: doc.sourceName,
      sourceUrl: doc.sourceUrl,
      content: doc.content,
      metadataJson: doc.metadataJson ?? "{}",
      embedding: embeddingStr,
      createdAt: now,
      lastUpdated: now,
      sourceConfidence: (doc.sourceConfidence as any) ?? "internal",
    })
    .returning({ id: documents.id });

  return result[0]?.id ?? 0;
}

export async function reindexAll(): Promise<void> {
  logger.info("Reindexing all documents...");

  const sqlite = getSqlite();
  const allDocs = sqlite
    .prepare("SELECT id, content FROM documents")
    .all() as Array<{ id: number; content: string }>;

  if (allDocs.length === 0) {
    logger.info("No documents to reindex");
    return;
  }

  // Update IDF store with full corpus and reset lazy-load flag in retriever
  updateIdf(allDocs.map((d) => d.content));

  let count = 0;
  for (const doc of allDocs) {
    const embedding = await embed(doc.content);
    sqlite
      .prepare("UPDATE documents SET embedding = ? WHERE id = ?")
      .run(JSON.stringify(embedding), doc.id);
    count++;
  }

  logger.info(`Reindexed ${count} documents`);
}

export async function clearDocuments(): Promise<void> {
  const sqlite = getSqlite();
  sqlite.prepare("DELETE FROM documents").run();
  logger.info("Cleared all documents");
}
