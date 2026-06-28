import type { ContextStorageState } from "./types.js";
import { createHash } from "crypto";

interface Fragment {
  key: string;
  bytes: number;
  preview: string;
  storedAt: number;
  hits: number;
}

/**
 * In-memory Context Storage simulating the "shared context" node in the CUPID
 * pipeline diagram. Keys are stable hashes of (sessionKey, fileName) so that
 * repeated calls for the same workspace surface as cache hits.
 *
 * This is deliberately separate from the existing src/context module so that
 * the new pipeline route does not affect /api/compare or /api/evals behavior.
 */
class ContextStorage {
  private store = new Map<string, Map<string, Fragment>>();

  hashFragment(text: string): string {
    return createHash("sha1").update(text).digest("hex").slice(0, 12);
  }

  loadOrStore(
    sessionKey: string,
    fragmentName: string,
    payload: string,
  ): ContextStorageState {
    const sessionBucket = this.store.get(sessionKey) ?? new Map<string, Fragment>();
    const key = `${fragmentName}#${this.hashFragment(payload)}`;
    const existing = sessionBucket.get(key);
    const freshlyAddedKeys: string[] = [];
    let cacheHit = false;

    if (existing) {
      existing.hits += 1;
      cacheHit = true;
    } else {
      sessionBucket.set(key, {
        key,
        bytes: Buffer.byteLength(payload, "utf8"),
        preview: payload.slice(0, 120),
        storedAt: Date.now(),
        hits: 0,
      });
      freshlyAddedKeys.push(key);
    }
    this.store.set(sessionKey, sessionBucket);

    let bytesStored = 0;
    for (const f of sessionBucket.values()) bytesStored += f.bytes;

    return {
      sessionKey,
      fragmentCount: sessionBucket.size,
      cacheHit,
      bytesStored,
      freshlyAddedKeys,
    };
  }

  /** Inspect a session bucket — used by the /api/cupid/storage endpoint */
  inspect(sessionKey: string) {
    const bucket = this.store.get(sessionKey);
    if (!bucket) return { sessionKey, fragments: [] as Fragment[], bytesStored: 0 };
    const fragments = Array.from(bucket.values()).sort((a, b) => b.storedAt - a.storedAt);
    const bytesStored = fragments.reduce((acc, f) => acc + f.bytes, 0);
    return { sessionKey, fragments, bytesStored };
  }

  /** Clear a single session — for testing or "reset cache" UX */
  reset(sessionKey?: string) {
    if (sessionKey) this.store.delete(sessionKey);
    else this.store.clear();
  }
}

export const contextStorage = new ContextStorage();
