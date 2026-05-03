import fs from "fs";
import path from "path";
import { logger } from "../utils/logger.js";

export interface RepoInfo {
  id: string;
  name: string;
  path: string;
  description: string;
  framework: string;
  language: string;
  availableScripts: string[];
  fileTree: FileTreeNode[];
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileTreeNode[];
}

const SAMPLE_REPOS_DIR = path.resolve("./data/sample_repos");

const IGNORED_DIRS = new Set([
  "node_modules", ".git", ".next", "dist", "build", ".turbo", "coverage",
]);

const IGNORED_EXTENSIONS = new Set([
  ".lock", ".log",
]);

export function listSampleRepos(): RepoInfo[] {
  if (!fs.existsSync(SAMPLE_REPOS_DIR)) {
    logger.warn("Sample repos directory not found: " + SAMPLE_REPOS_DIR);
    return [];
  }

  const entries = fs.readdirSync(SAMPLE_REPOS_DIR, { withFileTypes: true });
  const repos: RepoInfo[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const repoPath = path.join(SAMPLE_REPOS_DIR, entry.name);
    try {
      const info = inspectRepo(entry.name, repoPath);
      repos.push(info);
    } catch (err) {
      logger.warn(`Failed to inspect repo ${entry.name}`, err);
    }
  }

  return repos;
}

export function getRepoById(repoId: string): RepoInfo | null {
  const repoPath = path.join(SAMPLE_REPOS_DIR, repoId);
  if (!fs.existsSync(repoPath)) return null;
  try {
    return inspectRepo(repoId, repoPath);
  } catch {
    return null;
  }
}

function inspectRepo(id: string, repoPath: string): RepoInfo {
  const pkgPath = path.join(repoPath, "package.json");
  let scripts: string[] = [];
  let framework = "unknown";
  let language = "typescript";

  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      const scriptNames = Object.keys(pkg.scripts ?? {});
      scripts = scriptNames.filter((s) =>
        ["test", "lint", "typecheck", "build", "check"].includes(s)
      );
      const deps = Object.keys({ ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) });
      if (deps.includes("next")) framework = "Next.js";
      else if (deps.includes("express")) framework = "Express";
      else if (deps.includes("fastify")) framework = "Fastify";
    } catch {}
  }

  const fileTree = buildFileTree(repoPath, repoPath);

  return {
    id,
    name: id,
    path: repoPath,
    description: `Sample ${framework} repository for evaluation testing`,
    framework,
    language,
    availableScripts: scripts,
    fileTree,
  };
}

function buildFileTree(rootPath: string, currentPath: string, depth = 0): FileTreeNode[] {
  if (depth > 4) return [];

  const entries = fs.readdirSync(currentPath, { withFileTypes: true });
  const nodes: FileTreeNode[] = [];

  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    if (entry.name.startsWith(".")) continue;

    const fullPath = path.join(currentPath, entry.name);
    const relativePath = path.relative(rootPath, fullPath).replace(/\\/g, "/");
    const ext = path.extname(entry.name);

    if (entry.isDirectory()) {
      nodes.push({
        name: entry.name,
        path: relativePath,
        type: "directory",
        children: buildFileTree(rootPath, fullPath, depth + 1),
      });
    } else if (!IGNORED_EXTENSIONS.has(ext)) {
      nodes.push({
        name: entry.name,
        path: relativePath,
        type: "file",
      });
    }
  }

  return nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export function readRepoFile(repoId: string, filePath: string): string {
  const repoPath = path.join(SAMPLE_REPOS_DIR, repoId);
  // Sanitize path to prevent traversal
  const resolved = path.resolve(repoPath, filePath);
  if (!resolved.startsWith(repoPath)) {
    throw new Error("Path traversal detected");
  }
  return fs.readFileSync(resolved, "utf-8");
}
