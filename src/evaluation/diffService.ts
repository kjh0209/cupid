import fs from "fs";
import path from "path";

export interface FileDiff {
  path: string;
  before: string | null;
  after: string | null;
  changeType: "created" | "modified" | "deleted" | "unchanged";
  additions: number;
  deletions: number;
  unifiedDiff: string;
}

export interface DiffSummary {
  totalFilesChanged: number;
  totalAdditions: number;
  totalDeletions: number;
  totalChangedLoc: number;
  unrelatedFilesModified: boolean;
  fileDiffs: FileDiff[];
}

export function generateWorkspaceDiff(
  originalPath: string,
  modifiedPath: string,
  activeFilePath?: string
): DiffSummary {
  const originalFiles = collectWorkspaceFiles(originalPath);
  const modifiedFiles = collectWorkspaceFiles(modifiedPath);

  const allPaths = new Set([...originalFiles.keys(), ...modifiedFiles.keys()]);
  const fileDiffs: FileDiff[] = [];

  for (const filePath of allPaths) {
    const before = originalFiles.get(filePath) ?? null;
    const after = modifiedFiles.get(filePath) ?? null;

    if (before === after) continue;

    const diff = createUnifiedDiff(filePath, before, after);
    fileDiffs.push(diff);
  }

  const totalAdditions = fileDiffs.reduce((s, d) => s + d.additions, 0);
  const totalDeletions = fileDiffs.reduce((s, d) => s + d.deletions, 0);

  const unrelatedFilesModified =
    activeFilePath != null &&
    fileDiffs.some((d) => d.changeType !== "unchanged" && d.path !== activeFilePath);

  return {
    totalFilesChanged: fileDiffs.length,
    totalAdditions,
    totalDeletions,
    totalChangedLoc: totalAdditions + totalDeletions,
    unrelatedFilesModified,
    fileDiffs,
  };
}

export function createUnifiedDiff(
  filePath: string,
  before: string | null,
  after: string | null
): FileDiff {
  const beforeLines = (before ?? "").split("\n");
  const afterLines = (after ?? "").split("\n");

  const changeType: FileDiff["changeType"] =
    before === null ? "created" :
    after === null ? "deleted" :
    before !== after ? "modified" : "unchanged";

  if (changeType === "unchanged") {
    return { path: filePath, before, after, changeType, additions: 0, deletions: 0, unifiedDiff: "" };
  }

  const diff = computeUnifiedDiff(filePath, beforeLines, afterLines);
  const additions = (diff.match(/^\+[^+]/gm) ?? []).length;
  const deletions = (diff.match(/^-[^-]/gm) ?? []).length;

  return { path: filePath, before, after, changeType, additions, deletions, unifiedDiff: diff };
}

function computeUnifiedDiff(filePath: string, before: string[], after: string[]): string {
  // Simple LCS-based unified diff
  const hunks = computeHunks(before, after);
  if (hunks.length === 0) return "";

  const lines: string[] = [
    `--- a/${filePath}`,
    `+++ b/${filePath}`,
  ];

  for (const hunk of hunks) {
    const beforeStart = hunk.beforeStart + 1;
    const afterStart = hunk.afterStart + 1;
    lines.push(`@@ -${beforeStart},${hunk.beforeCount} +${afterStart},${hunk.afterCount} @@`);
    lines.push(...hunk.lines);
  }

  return lines.join("\n");
}

interface Hunk {
  beforeStart: number;
  beforeCount: number;
  afterStart: number;
  afterCount: number;
  lines: string[];
}

function computeHunks(before: string[], after: string[]): Hunk[] {
  const CONTEXT = 3;
  const changes = computeLCS(before, after);
  const hunks: Hunk[] = [];

  let i = 0;
  while (i < changes.length) {
    if (changes[i]!.type === "equal") { i++; continue; }

    // Found a change — expand with context
    const hunkStart = Math.max(0, i - CONTEXT);
    let hunkEnd = i;

    // Find end of contiguous changes + trailing context
    while (hunkEnd < changes.length) {
      if (changes[hunkEnd]!.type !== "equal") {
        hunkEnd++;
      } else if (hunkEnd + CONTEXT < changes.length && changes.slice(hunkEnd, hunkEnd + CONTEXT + 1).some(c => c.type !== "equal")) {
        hunkEnd++;
      } else {
        hunkEnd = Math.min(hunkEnd + CONTEXT, changes.length);
        break;
      }
    }

    const hunkChanges = changes.slice(hunkStart, hunkEnd);
    const hunkLines: string[] = [];
    let beforeCount = 0, afterCount = 0;
    let beforeStart = -1, afterStart = -1;

    for (const c of hunkChanges) {
      if (beforeStart === -1 && (c.type === "equal" || c.type === "delete")) beforeStart = c.beforeIdx;
      if (afterStart === -1 && (c.type === "equal" || c.type === "insert")) afterStart = c.afterIdx;
      if (c.type === "equal") {
        hunkLines.push(` ${c.line}`);
        beforeCount++; afterCount++;
      } else if (c.type === "delete") {
        hunkLines.push(`-${c.line}`);
        beforeCount++;
      } else {
        hunkLines.push(`+${c.line}`);
        afterCount++;
      }
    }

    if (hunkLines.some(l => l.startsWith("+") || l.startsWith("-"))) {
      hunks.push({ beforeStart: beforeStart >= 0 ? beforeStart : 0, beforeCount, afterStart: afterStart >= 0 ? afterStart : 0, afterCount, lines: hunkLines });
    }

    i = hunkEnd;
  }

  return hunks;
}

interface Change {
  type: "equal" | "insert" | "delete";
  line: string;
  beforeIdx: number;
  afterIdx: number;
}

function computeLCS(before: string[], after: string[]): Change[] {
  // Use simple Myers diff for small files, line-by-line
  const m = before.length;
  const n = after.length;

  if (m === 0) {
    return after.map((line, i) => ({ type: "insert" as const, line, beforeIdx: 0, afterIdx: i }));
  }
  if (n === 0) {
    return before.map((line, i) => ({ type: "delete" as const, line, beforeIdx: i, afterIdx: 0 }));
  }

  // DP table for LCS
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (before[i] === after[j]) {
        dp[i]![j] = 1 + dp[i + 1]![j + 1]!;
      } else {
        dp[i]![j] = Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
      }
    }
  }

  // Backtrack
  const result: Change[] = [];
  let i = 0, j = 0;
  while (i < m && j < n) {
    if (before[i] === after[j]) {
      result.push({ type: "equal", line: before[i]!, beforeIdx: i, afterIdx: j });
      i++; j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      result.push({ type: "delete", line: before[i]!, beforeIdx: i, afterIdx: j });
      i++;
    } else {
      result.push({ type: "insert", line: after[j]!, beforeIdx: i, afterIdx: j });
      j++;
    }
  }
  while (i < m) {
    result.push({ type: "delete", line: before[i]!, beforeIdx: i, afterIdx: j });
    i++;
  }
  while (j < n) {
    result.push({ type: "insert", line: after[j]!, beforeIdx: i, afterIdx: j });
    j++;
  }
  return result;
}

function collectWorkspaceFiles(dirPath: string): Map<string, string> {
  const files = new Map<string, string>();
  const IGNORED = new Set(["node_modules", ".git", ".next", "dist", "build"]);

  function walk(currentPath: string) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      if (IGNORED.has(entry.name)) continue;
      const fullPath = path.join(currentPath, entry.name);
      const relativePath = path.relative(dirPath, fullPath).replace(/\\/g, "/");
      if (entry.isDirectory()) {
        walk(fullPath);
      } else {
        try {
          const content = fs.readFileSync(fullPath, "utf-8");
          if (content.length < 200000) files.set(relativePath, content);
        } catch { /* skip */ }
      }
    }
  }

  if (fs.existsSync(dirPath)) walk(dirPath);
  return files;
}
