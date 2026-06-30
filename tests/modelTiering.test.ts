import { describe, it, expect } from "vitest";
import {
  getDefaultStrongModel,
  getDefaultMidModel,
  getDefaultCheapModel,
  KNOWN_MODELS,
} from "../src/recommender/modelTiering.js";

describe("ModelTiering", () => {
  describe("KNOWN_MODELS", () => {
    it("contains models from multiple providers", () => {
      const providers = [...new Set(KNOWN_MODELS.map((m) => m.provider))];
      expect(providers).toContain("anthropic");
      expect(providers).toContain("openai");
      expect(providers).toContain("google");
      expect(providers).toContain("deepseek");
    });

    it("contains models across all tiers", () => {
      const tiers = [...new Set(KNOWN_MODELS.map((m) => m.tier))];
      expect(tiers).toContain("strong");
      expect(tiers).toContain("mid");
      expect(tiers).toContain("cheap");
      expect(tiers).toContain("long_context");
    });

    it("all models have required fields", () => {
      for (const model of KNOWN_MODELS) {
        expect(model.id).toBeTruthy();
        expect(model.provider).toBeTruthy();
        expect(model.displayName).toBeTruthy();
        expect(model.tier).toBeTruthy();
        expect(model.inputPricePerMillion).toBeGreaterThan(0);
        expect(model.outputPricePerMillion).toBeGreaterThan(0);
        expect(model.contextWindow).toBeGreaterThan(0);
        expect(model.maxOutputTokens).toBeGreaterThan(0);
      }
    });

    it("no deprecated models in known list", () => {
      for (const model of KNOWN_MODELS) {
        expect(model.deprecated).toBe(false);
      }
    });

    it("all model IDs follow provider/model format", () => {
      for (const model of KNOWN_MODELS) {
        expect(model.id).toMatch(/^[a-z]+\//);
      }
    });
  });

  describe("getDefaultStrongModel", () => {
    it("returns claude-opus-4-5", () => {
      const model = getDefaultStrongModel();
      expect(model.id).toBe("anthropic/claude-opus-4-5");
      expect(model.tier).toBe("strong");
    });

    it("has expected pricing", () => {
      const model = getDefaultStrongModel();
      expect(model.inputPricePerMillion).toBe(15.0);
      expect(model.outputPricePerMillion).toBe(75.0);
    });
  });

  describe("getDefaultMidModel", () => {
    it("returns claude-sonnet-4-5", () => {
      const model = getDefaultMidModel();
      expect(model.id).toBe("anthropic/claude-sonnet-4-5");
      expect(model.tier).toBe("mid");
    });
  });

  describe("getDefaultCheapModel", () => {
    it("returns claude-3-5-haiku", () => {
      const model = getDefaultCheapModel();
      expect(model.id).toBe("anthropic/claude-3-5-haiku-20241022");
      expect(model.tier).toBe("cheap");
    });

    it("has low pricing", () => {
      const model = getDefaultCheapModel();
      expect(model.inputPricePerMillion).toBeLessThan(2);
    });
  });

  describe("model pricing consistency", () => {
    it("strong tier models cost more than cheap tier", () => {
      const strong = KNOWN_MODELS.filter((m) => m.tier === "strong");
      const cheap = KNOWN_MODELS.filter((m) => m.tier === "cheap");

      const avgStrongOutput = strong.reduce((sum, m) => sum + m.outputPricePerMillion, 0) / strong.length;
      const avgCheapOutput = cheap.reduce((sum, m) => sum + m.outputPricePerMillion, 0) / cheap.length;

      expect(avgStrongOutput).toBeGreaterThan(avgCheapOutput);
    });

    it("cached input price is cheaper than regular input", () => {
      for (const model of KNOWN_MODELS) {
        if (model.cachedInputPricePerMillion !== null) {
          expect(model.cachedInputPricePerMillion).toBeLessThan(model.inputPricePerMillion);
        }
      }
    });
  });
});
