import { describe, it, expect } from "vitest";
import {
  getTaskAffinity,
  isForbidden,
} from "../src/recommender/taskModelAffinities.js";

describe("TaskModelAffinities", () => {
  describe("getTaskAffinity", () => {
    it("returns correct affinity for known model and task", () => {
      const affinity = getTaskAffinity("anthropic/claude-opus-4-5", "architecture_design");
      expect(affinity).toBe(1.0);
    });

    it("returns 0.5 (neutral) for unknown model", () => {
      expect(getTaskAffinity("unknown/model", "simple_edit")).toBe(0.5);
    });

    it("returns 0.5 for known model with unknown task type", () => {
      expect(getTaskAffinity("anthropic/claude-opus-4-5", "nonexistent" as any)).toBe(0.5);
    });

    it("haiku has lower affinity for security tasks", () => {
      const haiku = getTaskAffinity("anthropic/claude-haiku-4-5", "security_sensitive_change");
      const opus = getTaskAffinity("anthropic/claude-opus-4-5", "security_sensitive_change");
      expect(haiku).toBeLessThan(opus);
    });

    it("haiku has high affinity for simple edits", () => {
      const affinity = getTaskAffinity("anthropic/claude-haiku-4-5", "simple_edit");
      expect(affinity).toBeGreaterThan(0.9);
    });

    it("gemini flash has high affinity for explanations", () => {
      const affinity = getTaskAffinity("google/gemini-2.0-flash", "explanation");
      expect(affinity).toBeGreaterThan(0.9);
    });

    it("gpt-4o has high affinity for UI changes", () => {
      const affinity = getTaskAffinity("openai/gpt-4o", "ui_change");
      expect(affinity).toBeGreaterThan(0.9);
    });
  });

  describe("isForbidden", () => {
    it("forbids models with < 0.4 affinity for security tasks", () => {
      // GPT-4o-mini has 0.25 affinity for security_sensitive_change
      expect(isForbidden("openai/gpt-4o-mini", "security_sensitive_change")).toBe(true);
    });

    it("does not forbid strong models for security tasks", () => {
      expect(isForbidden("anthropic/claude-opus-4-5", "security_sensitive_change")).toBe(false);
    });

    it("forbids models with < 0.4 affinity for database_schema_change", () => {
      // GPT-4o-mini has 0.35 affinity for database_schema_change
      expect(isForbidden("openai/gpt-4o-mini", "database_schema_change")).toBe(true);
    });

    it("does not forbid for database_schema_change if affinity >= 0.4", () => {
      expect(isForbidden("anthropic/claude-sonnet-4-5", "database_schema_change")).toBe(false);
    });

    it("forbids models with < 0.45 affinity for creative_generation", () => {
      // Gemini 2.0 Flash has 0.40 for creative_generation
      expect(isForbidden("google/gemini-2.0-flash", "creative_generation")).toBe(true);
    });

    it("does not forbid models with >= 0.45 for creative_generation", () => {
      expect(isForbidden("anthropic/claude-opus-4-5", "creative_generation")).toBe(false);
    });

    it("returns false for unknown models (default affinity 0.5)", () => {
      expect(isForbidden("unknown/model", "security_sensitive_change")).toBe(false);
    });

    it("returns false for non-restricted task types", () => {
      expect(isForbidden("openai/gpt-4o-mini", "simple_edit")).toBe(false);
      expect(isForbidden("openai/gpt-4o-mini", "explanation")).toBe(false);
    });
  });
});
