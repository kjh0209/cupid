// Tracks data freshness and flags stale sources.

const FRESHNESS_THRESHOLDS_DAYS: Record<string, number> = {
  official: 90,    // Official docs: stale after 90 days
  benchmark: 180,  // Benchmark data: stale after 6 months
  community: 30,   // Community data: stale after 30 days
  internal: 365,   // Internal data: stale after 1 year
};

export function isStale(lastUpdated: string, sourceConfidence: string): boolean {
  const threshold = FRESHNESS_THRESHOLDS_DAYS[sourceConfidence] ?? 90;
  const lastUpdatedDate = new Date(lastUpdated);
  const now = new Date();
  const daysDiff = (now.getTime() - lastUpdatedDate.getTime()) / (1000 * 60 * 60 * 24);
  return daysDiff > threshold;
}

export function getFreshnessLabel(lastUpdated: string, sourceConfidence: string): string {
  const threshold = FRESHNESS_THRESHOLDS_DAYS[sourceConfidence] ?? 90;
  const lastUpdatedDate = new Date(lastUpdated);
  const now = new Date();
  const daysDiff = Math.floor((now.getTime() - lastUpdatedDate.getTime()) / (1000 * 60 * 60 * 24));

  if (daysDiff < 7) return "very_fresh";
  if (daysDiff < 30) return "fresh";
  if (daysDiff < threshold) return "acceptable";
  if (daysDiff < threshold * 2) return "stale";
  return "very_stale";
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function todayIso(): string {
  return new Date().toISOString().split("T")[0] ?? new Date().toISOString();
}
