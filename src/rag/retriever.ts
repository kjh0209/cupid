import { getSqlite } from "../db/database.js";
import { embed, cosineSimilarity, bm25Score, updateIdf } from "./embedder.js";
import type { RagResult } from "../types.js";

interface RawDoc {
  id: number;
  title: string;
  content: string;
  source_name: string;
  source_url: string;
  embedding: string | null;
}

let idfLoaded = false;

function ensureIdfLoaded(sqlite: ReturnType<typeof getSqlite>): void {
  if (idfLoaded) return;
  try {
    const allContent = sqlite
      .prepare("SELECT content FROM documents")
      .all() as Array<{ content: string }>;
    if (allContent.length > 0) {
      updateIdf(allContent.map((d) => d.content));
      idfLoaded = true;
    }
  } catch {
    // DB might not be ready yet — skip
  }
}

export async function retrieve(
  query: string,
  opts: {
    topK?: number;
    minScore?: number;
    sourceName?: string;
  } = {}
): Promise<RagResult[]> {
  const { topK = 5, minScore = 0.05 } = opts;

  const sqlite = getSqlite();

  // Lazily initialize the IDF store from the corpus on first call
  ensureIdfLoaded(sqlite);

  let sql = "SELECT id, title, content, source_name, source_url, embedding FROM documents";
  const params: unknown[] = [];

  if (opts.sourceName) {
    sql += " WHERE source_name = ?";
    params.push(opts.sourceName);
  }

  const docs = sqlite.prepare(sql).all(...params) as RawDoc[];

  if (docs.length === 0) return [];

  const queryEmbedding = await embed(query);

  const scored = docs.map((doc) => {
    let score = 0;

    // Vector similarity if embeddings are available
    if (doc.embedding) {
      try {
        const docVec = JSON.parse(doc.embedding) as number[];
        const vecScore = cosineSimilarity(queryEmbedding, docVec);
        score += vecScore * 0.6;
      } catch {
        // Fall through to BM25
      }
    }

    // BM25 keyword score
    const kwScore = Math.min(bm25Score(query, doc.content) / 20, 1.0);
    score += kwScore * 0.4;

    return {
      documentId: doc.id,
      title: doc.title,
      content: doc.content,
      score,
      sourceName: doc.source_name,
      sourceUrl: doc.source_url,
    } satisfies RagResult;
  });

  return scored
    .filter((r) => r.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

export async function retrieveForTask(
  query: string,
  taskType?: string,
  topK = 5
): Promise<RagResult[]> {
  // Build enriched query with task context
  const enrichedQuery = taskType
    ? `${query} [task: ${taskType}]`
    : query;
  return retrieve(enrichedQuery, { topK });
}
