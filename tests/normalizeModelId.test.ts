import { describe, it, expect } from "vitest";
import {
  normalizeModelId,
  extractProvider,
  extractModelName,
} from "../src/utils/normalizeModelId.js";

describe("normalizeModelId", () => {
  describe("already-prefixed IDs", () => {
    it("returns as-is when already has provider prefix", () => {
      expect(normalizeModelId("anthropic/claude-3-5-sonnet")).toBe("anthropic/claude-3-5-sonnet");
      expect(normalizeModelId("openai/gpt-4o")).toBe("openai/gpt-4o");
      expect(normalizeModelId("google/gemini-2.5-pro")).toBe("google/gemini-2.5-pro");
    });

    it("lowercases already-prefixed IDs", () => {
      expect(normalizeModelId("Anthropic/Claude-3-5-Sonnet")).toBe("anthropic/claude-3-5-sonnet");
    });

    it("trims whitespace", () => {
      expect(normalizeModelId("  openai/gpt-4o  ")).toBe("openai/gpt-4o");
    });
  });

  describe("shorthand mappings", () => {
    it("maps claude-3-5-sonnet", () => {
      expect(normalizeModelId("claude-3-5-sonnet")).toBe("anthropic/claude-3-5-sonnet-20241022");
    });

    it("maps gpt-4o", () => {
      expect(normalizeModelId("gpt-4o")).toBe("openai/gpt-4o");
    });

    it("maps gpt-4o-mini", () => {
      expect(normalizeModelId("gpt-4o-mini")).toBe("openai/gpt-4o-mini");
    });

    it("maps o3-mini", () => {
      expect(normalizeModelId("o3-mini")).toBe("openai/o3-mini");
    });

    it("maps gemini-2.5-pro", () => {
      expect(normalizeModelId("gemini-2.5-pro")).toBe("google/gemini-2.5-pro");
    });

    it("maps deepseek-chat", () => {
      expect(normalizeModelId("deepseek-chat")).toBe("deepseek/deepseek-chat");
    });

    it("maps claude-opus-4", () => {
      expect(normalizeModelId("claude-opus-4")).toBe("anthropic/claude-opus-4-5");
    });

    it("maps claude-sonnet-4", () => {
      expect(normalizeModelId("claude-sonnet-4")).toBe("anthropic/claude-sonnet-4-5");
    });
  });

  describe("provider detection from model name", () => {
    it("detects claude models as anthropic", () => {
      expect(normalizeModelId("claude-unknown-version")).toBe("anthropic/claude-unknown-version");
    });

    it("detects gpt models as openai", () => {
      expect(normalizeModelId("gpt-5-turbo")).toBe("openai/gpt-5-turbo");
    });

    it("detects o1 prefix as openai", () => {
      expect(normalizeModelId("o1-preview")).toBe("openai/o1-preview");
    });

    it("detects gemini models as google", () => {
      expect(normalizeModelId("gemini-3.0-ultra")).toBe("google/gemini-3.0-ultra");
    });

    it("detects llama models as meta", () => {
      expect(normalizeModelId("llama-4-70b")).toBe("meta/llama-4-70b");
    });

    it("detects mistral models", () => {
      expect(normalizeModelId("mistral-large")).toBe("mistral/mistral-large");
    });

    it("detects mixtral models as mistral", () => {
      expect(normalizeModelId("mixtral-8x7b")).toBe("mistral/mixtral-8x7b");
    });

    it("detects deepseek models", () => {
      expect(normalizeModelId("deepseek-v2")).toBe("deepseek/deepseek-v2");
    });

    it("returns trimmed lower for unrecognized models", () => {
      expect(normalizeModelId("some-unknown-model")).toBe("some-unknown-model");
    });
  });
});

describe("extractProvider", () => {
  it("extracts provider from prefixed model", () => {
    expect(extractProvider("anthropic/claude-3-5-sonnet")).toBe("anthropic");
  });

  it("extracts provider from shorthand after normalization", () => {
    expect(extractProvider("gpt-4o")).toBe("openai");
  });

  it("returns the full string as provider when no slash present", () => {
    // normalizeModelId returns "some-unknown-model" (no slash), so parts[0] = full string
    expect(extractProvider("some-unknown-model")).toBe("some-unknown-model");
  });
});

describe("extractModelName", () => {
  it("extracts model name from prefixed model", () => {
    expect(extractModelName("anthropic/claude-3-5-sonnet")).toBe("claude-3-5-sonnet");
  });

  it("extracts model name after normalizing shorthand", () => {
    expect(extractModelName("gpt-4o")).toBe("gpt-4o");
  });

  it("returns full string if no slash present after normalization", () => {
    expect(extractModelName("some-unknown-model")).toBe("some-unknown-model");
  });
});
