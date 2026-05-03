type LogLevel = "debug" | "info" | "warn" | "error";

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function getConfiguredLevel(): LogLevel {
  const env = process.env["LOG_LEVEL"]?.toLowerCase() ?? "info";
  if (env in LEVELS) return env as LogLevel;
  return "info";
}

function format(level: LogLevel, message: string, data?: unknown): string {
  const ts = new Date().toISOString();
  const upper = level.toUpperCase().padEnd(5);
  const pretty = process.env["LOG_FORMAT"] !== "json";

  if (pretty) {
    const colors: Record<LogLevel, string> = {
      debug: "\x1b[36m",
      info: "\x1b[32m",
      warn: "\x1b[33m",
      error: "\x1b[31m",
    };
    const reset = "\x1b[0m";
    const colored = `${colors[level]}${upper}${reset}`;
    const dataStr = data !== undefined ? ` ${JSON.stringify(data)}` : "";
    return `${ts} ${colored} ${message}${dataStr}`;
  }

  return JSON.stringify({ ts, level, message, ...(data ? { data } : {}) });
}

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] >= LEVELS[getConfiguredLevel()];
}

export const logger = {
  debug(message: string, data?: unknown) {
    if (shouldLog("debug")) console.debug(format("debug", message, data));
  },
  info(message: string, data?: unknown) {
    if (shouldLog("info")) console.info(format("info", message, data));
  },
  warn(message: string, data?: unknown) {
    if (shouldLog("warn")) console.warn(format("warn", message, data));
  },
  error(message: string, data?: unknown) {
    if (shouldLog("error")) console.error(format("error", message, data));
  },
};
