import fs from "fs";
import path from "path";
import { logger } from "../utils/logger.js";

const WORKSPACES_DIR = path.resolve("./workspaces");

export interface Workspace {
  id: string;
  repoId: string;
  label: string; // router | strong_baseline | cheap_baseline | manual
  sourcePath: string;
  workspacePath: string;
  createdAt: string;
}

export function createWorkspace(repoSourcePath: string, runId: string, label: string): Workspace {
  if (!fs.existsSync(WORKSPACES_DIR)) {
    fs.mkdirSync(WORKSPACES_DIR, { recursive: true });
  }

  const workspaceId = `${runId}-${label}`;
  const workspacePath = path.join(WORKSPACES_DIR, workspaceId);

  if (fs.existsSync(workspacePath)) {
    fs.rmSync(workspacePath, { recursive: true, force: true });
  }

  copyDirectory(repoSourcePath, workspacePath);

  logger.info(`Created workspace: ${workspacePath}`);

  return {
    id: workspaceId,
    repoId: path.basename(repoSourcePath),
    label,
    sourcePath: repoSourcePath,
    workspacePath,
    createdAt: new Date().toISOString(),
  };
}

export function cleanupWorkspace(workspacePath: string): void {
  try {
    if (fs.existsSync(workspacePath)) {
      fs.rmSync(workspacePath, { recursive: true, force: true });
      logger.info(`Cleaned up workspace: ${workspacePath}`);
    }
  } catch (err) {
    logger.warn(`Failed to cleanup workspace: ${workspacePath}`, err);
  }
}

export function cleanupRunWorkspaces(runId: string): void {
  if (!fs.existsSync(WORKSPACES_DIR)) return;
  const entries = fs.readdirSync(WORKSPACES_DIR);
  for (const entry of entries) {
    if (entry.startsWith(runId)) {
      cleanupWorkspace(path.join(WORKSPACES_DIR, entry));
    }
  }
}

export function getWorkspaceFiles(workspacePath: string): Map<string, string> {
  const files = new Map<string, string>();
  collectFiles(workspacePath, workspacePath, files);
  return files;
}

export function applyFileChanges(
  workspacePath: string,
  changes: Array<{ path: string; content: string; changeType: "create" | "modify" | "delete" }>
): void {
  for (const change of changes) {
    // Sanitize path
    const fullPath = path.resolve(workspacePath, change.path);
    if (!fullPath.startsWith(workspacePath)) {
      throw new Error(`Path traversal detected: ${change.path}`);
    }

    if (change.changeType === "delete") {
      if (fs.existsSync(fullPath)) {
        fs.rmSync(fullPath);
      }
    } else {
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(fullPath, change.content, "utf-8");
    }
  }
}

function copyDirectory(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;

    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function collectFiles(
  rootPath: string,
  currentPath: string,
  files: Map<string, string>,
  maxFiles = 200
): void {
  if (files.size >= maxFiles) return;

  const IGNORED = new Set(["node_modules", ".git", ".next", "dist", "build"]);
  const entries = fs.readdirSync(currentPath, { withFileTypes: true });

  for (const entry of entries) {
    if (IGNORED.has(entry.name)) continue;
    const fullPath = path.join(currentPath, entry.name);
    const relativePath = path.relative(rootPath, fullPath).replace(/\\/g, "/");

    if (entry.isDirectory()) {
      collectFiles(rootPath, fullPath, files, maxFiles);
    } else {
      try {
        const content = fs.readFileSync(fullPath, "utf-8");
        if (content.length < 100000) { // skip files > 100KB
          files.set(relativePath, content);
        }
      } catch { /* skip unreadable files */ }
    }
  }
}

export function generateWorkspaceDiff(sourcePath: string, workspacePath: string): void {
  // Placeholder — actual diff generation is in diffService.ts
}
