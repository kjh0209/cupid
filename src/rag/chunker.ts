// Splits documents into overlapping chunks for RAG indexing.

export interface Chunk {
  content: string;
  startIndex: number;
  endIndex: number;
  chunkIndex: number;
}

export function chunkText(
  text: string,
  chunkSize = 512,
  overlapSize = 64
): Chunk[] {
  if (!text || text.length === 0) return [];

  // Try to split on paragraph/sentence boundaries first
  const paragraphs = text.split(/\n{2,}/);
  const chunks: Chunk[] = [];
  let currentChunk = "";
  let charOffset = 0;
  let chunkIndex = 0;

  for (const para of paragraphs) {
    if (currentChunk.length + para.length + 2 <= chunkSize) {
      currentChunk += (currentChunk ? "\n\n" : "") + para;
    } else {
      if (currentChunk) {
        chunks.push({
          content: currentChunk,
          startIndex: charOffset - currentChunk.length,
          endIndex: charOffset,
          chunkIndex: chunkIndex++,
        });
        // Overlap: keep last overlapSize chars
        const overlap = currentChunk.slice(-overlapSize);
        currentChunk = overlap + "\n\n" + para;
      } else {
        currentChunk = para;
      }
    }
    charOffset += para.length + 2;
  }

  if (currentChunk) {
    chunks.push({
      content: currentChunk,
      startIndex: charOffset - currentChunk.length,
      endIndex: charOffset,
      chunkIndex: chunkIndex,
    });
  }

  return chunks;
}

export function chunkByTokenEstimate(
  text: string,
  targetTokens = 256,
  overlapTokens = 32
): Chunk[] {
  // Approximately 4 chars per token
  return chunkText(text, targetTokens * 4, overlapTokens * 4);
}
