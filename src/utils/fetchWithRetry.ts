import { logger } from "./logger.js";

interface FetchOptions extends RequestInit {
  retries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
}

export async function fetchWithRetry(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const { retries = 3, retryDelayMs = 1000, timeoutMs = 30000, ...fetchOpts } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        ...fetchOpts,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok && response.status >= 500) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt < retries) {
        const delay = retryDelayMs * Math.pow(2, attempt);
        logger.warn(`Fetch attempt ${attempt + 1} failed for ${url}, retrying in ${delay}ms`, {
          error: lastError.message,
        });
        await sleep(delay);
      }
    }
  }

  throw new Error(`Fetch failed after ${retries + 1} attempts for ${url}: ${lastError?.message}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchJson<T>(url: string, options: FetchOptions = {}): Promise<T> {
  const response = await fetchWithRetry(url, {
    ...options,
    headers: {
      Accept: "application/json",
      ...options.headers,
    },
  });
  return response.json() as Promise<T>;
}
