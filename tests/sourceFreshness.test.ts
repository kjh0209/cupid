import { describe, it, expect, vi, afterEach } from "vitest";
import { isStale, getFreshnessLabel, nowIso, todayIso } from "../src/utils/sourceFreshness.js";

describe("SourceFreshness", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("isStale", () => {
    it("returns false for recently updated official source", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-06-01"));
      expect(isStale("2025-05-01", "official")).toBe(false); // 31 days < 90
    });

    it("returns true for old official source", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-06-01"));
      expect(isStale("2025-01-01", "official")).toBe(true); // 151 days > 90
    });

    it("uses 180 days threshold for benchmark sources", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-06-01"));
      expect(isStale("2025-01-01", "benchmark")).toBe(false); // 151 < 180
      expect(isStale("2024-06-01", "benchmark")).toBe(true);  // 365 > 180
    });

    it("uses 30 days threshold for community sources", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-06-01"));
      expect(isStale("2025-05-20", "community")).toBe(false); // 12 < 30
      expect(isStale("2025-04-01", "community")).toBe(true);  // 61 > 30
    });

    it("uses 365 days threshold for internal sources", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-06-01"));
      expect(isStale("2025-01-01", "internal")).toBe(false); // 151 < 365
      expect(isStale("2024-01-01", "internal")).toBe(true);  // 518 > 365
    });

    it("defaults to 90 days for unknown source confidence", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-06-01"));
      expect(isStale("2025-04-01", "unknown_type")).toBe(false); // 61 < 90
      expect(isStale("2025-01-01", "unknown_type")).toBe(true);  // 151 > 90
    });
  });

  describe("getFreshnessLabel", () => {
    it("returns very_fresh for <7 days", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-06-10"));
      expect(getFreshnessLabel("2025-06-05", "official")).toBe("very_fresh");
    });

    it("returns fresh for 7-29 days", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-06-30"));
      expect(getFreshnessLabel("2025-06-15", "official")).toBe("fresh");
    });

    it("returns acceptable for within threshold", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-06-01"));
      // 45 days, threshold is 90 for official
      expect(getFreshnessLabel("2025-04-17", "official")).toBe("acceptable");
    });

    it("returns stale for past threshold but within 2x", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-06-01"));
      // 120 days, threshold is 90, 2x=180 for official
      expect(getFreshnessLabel("2025-02-01", "official")).toBe("stale");
    });

    it("returns very_stale for past 2x threshold", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-06-01"));
      // 365 days, threshold is 90, 2x=180 for official
      expect(getFreshnessLabel("2024-06-01", "official")).toBe("very_stale");
    });
  });

  describe("nowIso", () => {
    it("returns ISO string format", () => {
      const result = nowIso();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe("todayIso", () => {
    it("returns date-only ISO string", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-03-15T12:00:00Z"));
      expect(todayIso()).toBe("2025-03-15");
    });
  });
});
