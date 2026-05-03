// Repo memory policy: determines which repo-level context is stable vs volatile.

export interface RepoMemoryItem {
  key: string;
  content: string;
  stable: boolean;
  lastModified: string;
}

export function classifyRepoMemory(items: RepoMemoryItem[]): {
  stable: RepoMemoryItem[];
  volatile: RepoMemoryItem[];
} {
  const stable = items.filter((i) => i.stable);
  const volatile = items.filter((i) => !i.stable);
  return { stable, volatile };
}

export function buildRepoContextSummary(
  stableItems: RepoMemoryItem[],
  maxTokens = 2000
): string {
  const parts: string[] = [];
  let totalChars = 0;
  const maxChars = maxTokens * 4;

  for (const item of stableItems) {
    if (totalChars + item.content.length > maxChars) break;
    parts.push(`## ${item.key}\n${item.content}`);
    totalChars += item.content.length;
  }

  return parts.join("\n\n");
}
