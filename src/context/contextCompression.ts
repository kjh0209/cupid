// Context compression helpers: summarize chat history and create repo pointers.

export function summarizeChatHistory(
  history: Array<{ role: string; content: string }>,
  maxItems = 3
): string {
  if (history.length === 0) return "";
  if (history.length <= maxItems) {
    return history.map((m) => `[${m.role}]: ${m.content.slice(0, 200)}`).join("\n");
  }

  const recent = history.slice(-maxItems);
  const older = history.slice(0, -maxItems);

  const olderSummary = `[Session summary: ${older.length} earlier messages. Topics: ${extractTopics(older).join(", ")}]`;
  const recentRaw = recent.map((m) => `[${m.role}]: ${m.content.slice(0, 300)}`).join("\n");

  return `${olderSummary}\n\n${recentRaw}`;
}

function extractTopics(messages: Array<{ content: string }>): string[] {
  const text = messages.map((m) => m.content).join(" ");
  const topics: string[] = [];

  if (/auth|jwt|session/i.test(text)) topics.push("auth");
  if (/test|spec|vitest|jest/i.test(text)) topics.push("testing");
  if (/api|route|endpoint/i.test(text)) topics.push("API routes");
  if (/schema|migration|prisma/i.test(text)) topics.push("database schema");
  if (/refactor|rename|move/i.test(text)) topics.push("refactoring");
  if (/bug|fix|error/i.test(text)) topics.push("bug fixes");
  if (/style|css|tailwind/i.test(text)) topics.push("UI/styling");

  return topics.length > 0 ? topics : ["general coding"];
}

export function createRepoPointer(repoSummary: string): string {
  const lines = repoSummary.split("\n").slice(0, 10);
  return `[Repo context — ${lines.length} lines summary: ${lines[0]?.slice(0, 100) ?? ""} ...]`;
}
