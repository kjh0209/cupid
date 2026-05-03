// Embedder with BM25 keyword fallback.
// If EMBEDDING_PROVIDER=openai and OPENAI_API_KEY is set, uses text-embedding-3-small.
// Otherwise uses TF-IDF term vectors stored as JSON in SQLite.

import { logger } from "../utils/logger.js";

export type EmbeddingVector = number[];

// ── TF-IDF keyword embedding ──────────────────────────────────
// Builds a sparse vector over a fixed vocabulary for BM25-like retrieval.

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

function termFrequency(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokens) {
    tf.set(t, (tf.get(t) ?? 0) + 1);
  }
  return tf;
}

// Shared IDF store (populated lazily from corpus)
const idfStore = new Map<string, number>();
let corpusSize = 0;

export function updateIdf(documents: string[]): void {
  corpusSize = documents.length;
  const df = new Map<string, number>();

  for (const doc of documents) {
    const tokens = new Set(tokenize(doc));
    for (const t of tokens) {
      df.set(t, (df.get(t) ?? 0) + 1);
    }
  }

  idfStore.clear();
  for (const [term, freq] of df) {
    idfStore.set(term, Math.log((corpusSize + 1) / (freq + 1)) + 1);
  }
}

export function tfidfVector(text: string, dims = 256): EmbeddingVector {
  const tokens = tokenize(text);
  const tf = termFrequency(tokens);
  const vec: EmbeddingVector = new Array(dims).fill(0);

  for (const [term, freq] of tf) {
    const idf = idfStore.get(term) ?? 1.0;
    const tfidfScore = (freq / tokens.length) * idf;
    // Map term to dimension via hash
    const dim = Math.abs(hashCode(term)) % dims;
    vec[dim] = (vec[dim] ?? 0) + tfidfScore;
  }

  return normalize(vec);
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash;
}

function normalize(vec: EmbeddingVector): EmbeddingVector {
  const magnitude = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  if (magnitude === 0) return vec;
  return vec.map((v) => v / magnitude);
}

// ── OpenAI embeddings (optional) ─────────────────────────────
async function openaiEmbed(text: string): Promise<EmbeddingVector | null> {
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) return null;

  const model = process.env["EMBEDDING_MODEL"] ?? "text-embedding-3-small";

  try {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ input: text, model }),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as {
      data: Array<{ embedding: number[] }>;
    };
    return data.data[0]?.embedding ?? null;
  } catch {
    return null;
  }
}

// ── Public embed function ─────────────────────────────────────
export async function embed(text: string): Promise<EmbeddingVector> {
  const provider = process.env["EMBEDDING_PROVIDER"] ?? "none";

  if (provider === "openai") {
    const vec = await openaiEmbed(text);
    if (vec) return vec;
    logger.warn("OpenAI embedding failed, falling back to TF-IDF");
  }

  return tfidfVector(text);
}

export function cosineSimilarity(a: EmbeddingVector, b: EmbeddingVector): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += (a[i] ?? 0) * (b[i] ?? 0);
    magA += (a[i] ?? 0) ** 2;
    magB += (b[i] ?? 0) ** 2;
  }
  const mag = Math.sqrt(magA) * Math.sqrt(magB);
  return mag === 0 ? 0 : dot / mag;
}

// ── BM25 text scoring (for keyword fallback) ──────────────────
export function bm25Score(
  query: string,
  document: string,
  k1 = 1.5,
  b = 0.75,
  avgDocLen = 200
): number {
  const queryTerms = tokenize(query);
  const docTerms = tokenize(document);
  const docLen = docTerms.length;
  const tf = termFrequency(docTerms);

  let score = 0;
  for (const term of queryTerms) {
    const termFreq = tf.get(term) ?? 0;
    if (termFreq === 0) continue;

    const idf = idfStore.get(term) ?? Math.log((corpusSize + 1) / 2);
    const tfNorm = (termFreq * (k1 + 1)) / (termFreq + k1 * (1 - b + b * (docLen / avgDocLen)));
    score += idf * tfNorm;
  }

  return score;
}
