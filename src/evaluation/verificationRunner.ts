import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { logger } from "../utils/logger.js";

export interface CommandResult {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
}

export interface VerificationResult {
  testPassed: boolean | null;
  lintPassed: boolean | null;
  typecheckPassed: boolean | null;
  buildPassed: boolean | null;
  commandResults: CommandResult[];
  overallSuccess: boolean;
}

// Only allow safe, read-only or test commands
const ALLOWED_COMMANDS: Record<string, string> = {
  test: "pnpm test",
  lint: "pnpm lint",
  typecheck: "pnpm typecheck",
  build: "pnpm build",
};

// Alternative npm variants
const NPM_ALTERNATIVES: Record<string, string> = {
  test: "npm test",
  lint: "npm run lint",
  typecheck: "npm run typecheck",
  build: "npm run build",
};

const COMMAND_TIMEOUT_MS = 60000; // 60 seconds

export async function runVerification(
  workspacePath: string,
  availableScripts: string[],
  runTests = true,
  runLint = false,
  runTypecheck = false
): Promise<VerificationResult> {
  const commandResults: CommandResult[] = [];
  let testPassed: boolean | null = null;
  let lintPassed: boolean | null = null;
  let typecheckPassed: boolean | null = null;
  let buildPassed: boolean | null = null;

  const pkgPath = path.join(workspacePath, "package.json");
  const hasPkg = fs.existsSync(pkgPath);

  if (!hasPkg) {
    return {
      testPassed: null,
      lintPassed: null,
      typecheckPassed: null,
      buildPassed: null,
      commandResults: [],
      overallSuccess: true, // No package, no verification
    };
  }

  // Read package.json to determine package manager and available scripts
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  const scripts = Object.keys(pkg.scripts ?? {});
  const usePnpm = fs.existsSync(path.join(workspacePath, "pnpm-lock.yaml"));
  const pm = usePnpm ? "pnpm" : "npm";

  if (runTests && (scripts.includes("test") || availableScripts.includes("test"))) {
    const result = runCommand(`${pm} test -- --passWithNoTests`, workspacePath);
    commandResults.push(result);
    testPassed = result.exitCode === 0 && !result.timedOut;
  }

  if (runTypecheck && (scripts.includes("typecheck") || availableScripts.includes("typecheck"))) {
    const result = runCommand(`${pm} run typecheck`, workspacePath);
    commandResults.push(result);
    typecheckPassed = result.exitCode === 0 && !result.timedOut;
  }

  if (runLint && (scripts.includes("lint") || availableScripts.includes("lint"))) {
    const result = runCommand(`${pm} run lint`, workspacePath);
    commandResults.push(result);
    lintPassed = result.exitCode === 0 && !result.timedOut;
  }

  const overallSuccess = [testPassed, lintPassed, typecheckPassed, buildPassed]
    .filter((v) => v !== null)
    .every(Boolean);

  return {
    testPassed,
    lintPassed,
    typecheckPassed,
    buildPassed,
    commandResults,
    overallSuccess,
  };
}

function runCommand(command: string, cwd: string): CommandResult {
  const start = Date.now();
  logger.info(`Running: ${command} in ${cwd}`);

  try {
    const result = spawnSync(command, {
      cwd,
      shell: true,
      timeout: COMMAND_TIMEOUT_MS,
      encoding: "utf-8",
      env: {
        ...process.env,
        CI: "true",
        NODE_ENV: "test",
      },
    });

    const durationMs = Date.now() - start;
    const timedOut = result.signal === "SIGTERM" || durationMs >= COMMAND_TIMEOUT_MS;

    return {
      command,
      exitCode: result.status ?? 1,
      stdout: (result.stdout ?? "").slice(0, 10000),
      stderr: (result.stderr ?? "").slice(0, 5000),
      durationMs,
      timedOut,
    };
  } catch (err) {
    return {
      command,
      exitCode: 1,
      stdout: "",
      stderr: String(err),
      durationMs: Date.now() - start,
      timedOut: false,
    };
  }
}
