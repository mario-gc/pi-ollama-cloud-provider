/**
 * Tests for fallback.ts — inferFromName + resolveFromModelsDev.
 *
 * Rule values verified against the live catalog on 2026-08-08
 * (models.dev/api.json ollama-cloud section + ollama.com/v1/models).
 *
 * Run with: npm test (bare `node --test`)
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { inferFromName, resolveFromModelsDev } from "../extensions/ollama-cloud/fallback.ts";

// ---------------------------------------------------------------------------
// Table-driven inferFromName cases — one per rule family
// Each modelId is chosen to match ONLY its target rule (not a more-specific one).
// ---------------------------------------------------------------------------

const RULE_CASES: Array<{
  rule: string;
  modelId: string;
  contextWindow: number;
  maxTokens: number;
  reasoning: boolean;
}> = [
  { rule: "deepseek-v4", modelId: "deepseek-v4-pro", contextWindow: 1_048_576, maxTokens: 1_048_576, reasoning: true },
  { rule: "deepseek", modelId: "deepseek-r1", contextWindow: 262_144, maxTokens: 65_536, reasoning: true },
  { rule: "kimi-k3", modelId: "kimi-k3", contextWindow: 1_048_576, maxTokens: 131_072, reasoning: true },
  { rule: "kimi", modelId: "kimi-k2", contextWindow: 262_144, maxTokens: 262_144, reasoning: true },
  { rule: "glm-5.2", modelId: "glm-5.2", contextWindow: 976_000, maxTokens: 131_072, reasoning: true },
  { rule: "glm-5", modelId: "glm-5.1", contextWindow: 202_752, maxTokens: 131_072, reasoning: true },
  { rule: "glm", modelId: "glm-4", contextWindow: 200_000, maxTokens: 65_536, reasoning: true },
  { rule: "qwen3.5", modelId: "qwen3.5-pro", contextWindow: 262_144, maxTokens: 65_536, reasoning: true },
  { rule: "qwen3", modelId: "qwen3", contextWindow: 262_144, maxTokens: 65_536, reasoning: true },
  { rule: "qwen", modelId: "qwen2", contextWindow: 128_000, maxTokens: 32_768, reasoning: false },
  { rule: "gpt-oss", modelId: "gpt-oss:120b", contextWindow: 131_072, maxTokens: 32_768, reasoning: true },
  { rule: "minimax-m3", modelId: "minimax-m3", contextWindow: 512_000, maxTokens: 131_072, reasoning: true },
  { rule: "minimax", modelId: "minimax-m2", contextWindow: 204_800, maxTokens: 131_072, reasoning: true },
  { rule: "gemma4", modelId: "gemma4:31b", contextWindow: 262_144, maxTokens: 262_144, reasoning: true },
  { rule: "gemma3", modelId: "gemma3:27b", contextWindow: 131_072, maxTokens: 8_192, reasoning: false },
  { rule: "gemma", modelId: "gemma:7b", contextWindow: 32_768, maxTokens: 8_192, reasoning: false },
  { rule: "mistral-large", modelId: "mistral-large-3", contextWindow: 262_144, maxTokens: 262_144, reasoning: false },
  { rule: "devstral", modelId: "devstral", contextWindow: 256_000, maxTokens: 256_000, reasoning: false },
  { rule: "ministral", modelId: "ministral-8b", contextWindow: 128_000, maxTokens: 128_000, reasoning: false },
  { rule: "mistral", modelId: "mistral", contextWindow: 32_768, maxTokens: 32_768, reasoning: false },
  { rule: "nemotron-3-nano", modelId: "nemotron-3-nano:30b", contextWindow: 1_048_576, maxTokens: 131_072, reasoning: true },
  { rule: "nemotron", modelId: "nemotron-3-super", contextWindow: 262_144, maxTokens: 65_536, reasoning: true },
  { rule: "cogito", modelId: "cogito-1", contextWindow: 262_144, maxTokens: 131_072, reasoning: true },
  { rule: "gemini", modelId: "gemini-2", contextWindow: 1_048_000, maxTokens: 65_536, reasoning: true },
];

describe("inferFromName — rule table", () => {
  for (const c of RULE_CASES) {
    it(`${c.rule}: "${c.modelId}" → ctx ${c.contextWindow}, max ${c.maxTokens}, reasoning ${c.reasoning}`, () => {
      const result = inferFromName(c.modelId);
      assert.strictEqual(result.contextWindow, c.contextWindow, `contextWindow for ${c.modelId}`);
      assert.strictEqual(result.maxTokens, c.maxTokens, `maxTokens for ${c.modelId}`);
      assert.strictEqual(result.reasoning, c.reasoning, `reasoning for ${c.modelId}`);
    });
  }
});

// ---------------------------------------------------------------------------
// Ordering regression cases — more-specific rules MUST match before generic
// ---------------------------------------------------------------------------

describe("inferFromName — ordering regressions", () => {
  it("ministral-8b → 128K (NOT mistral's 32K)", () => {
    assert.strictEqual(inferFromName("ministral-8b").contextWindow, 128_000);
  });

  it("qwen3.5-pro → 262K reasoning (NOT qwen3/qwen)", () => {
    const r = inferFromName("qwen3.5-pro");
    assert.strictEqual(r.contextWindow, 262_144);
    assert.strictEqual(r.reasoning, true);
  });

  it("gemma4 → 262K (NOT gemma3/gemma)", () => {
    assert.strictEqual(inferFromName("gemma4").contextWindow, 262_144);
  });

  it("deepseek-v4-pro → 1_048_576 ctx (NOT deepseek's 262K)", () => {
    assert.strictEqual(inferFromName("deepseek-v4-pro").contextWindow, 1_048_576);
  });

  it("glm-5.2 → 976K (NOT glm-5/glm)", () => {
    assert.strictEqual(inferFromName("glm-5.2").contextWindow, 976_000);
  });

  it("kimi-k3 → 1M (NOT kimi's 262K)", () => {
    assert.strictEqual(inferFromName("kimi-k3").contextWindow, 1_048_576);
  });

  it("minimax-m3 → 512K (NOT minimax's 204.8K)", () => {
    assert.strictEqual(inferFromName("minimax-m3").contextWindow, 512_000);
  });

  it("nemotron-3-nano:30b → 1M (NOT nemotron's 262K)", () => {
    assert.strictEqual(inferFromName("nemotron-3-nano:30b").contextWindow, 1_048_576);
  });
});

// ---------------------------------------------------------------------------
// Case insensitivity
// ---------------------------------------------------------------------------

describe("inferFromName — case insensitivity", () => {
  it('"DeepSeek-V4" matches deepseek-v4 rule', () => {
    assert.strictEqual(inferFromName("DeepSeek-V4").contextWindow, 1_048_576);
  });

  it('"QWEN3.5" matches qwen3.5 rule', () => {
    assert.strictEqual(inferFromName("QWEN3.5").contextWindow, 262_144);
  });
});

// ---------------------------------------------------------------------------
// Unknown model → defaults
// ---------------------------------------------------------------------------

describe("inferFromName — unknown model", () => {
  it('"unknown-model" → defaults 128_000/32_768, no reasoning', () => {
    const r = inferFromName("unknown-model");
    assert.strictEqual(r.contextWindow, 128_000);
    assert.strictEqual(r.maxTokens, 32_768);
    assert.strictEqual(r.reasoning, false);
  });
});

// ---------------------------------------------------------------------------
// resolveFromModelsDev
// ---------------------------------------------------------------------------

describe("resolveFromModelsDev", () => {
  it("exact match returns entry values", () => {
    const data = new Map([
      ["test-model", {
        name: "Test Model",
        reasoning: true,
        limit: { context: 200_000, output: 65_536 },
        modalities: { input: ["text"] },
      }],
    ]);
    const result = resolveFromModelsDev("test-model", data);
    assert.ok(result);
    assert.strictEqual(result!.contextWindow, 200_000);
    assert.strictEqual(result!.maxTokens, 65_536);
    assert.strictEqual(result!.reasoning, true);
    assert.deepStrictEqual(result!.input, ["text"]);
  });

  it("image modality → input: ['text','image']", () => {
    const data = new Map([
      ["vision-model", {
        name: "Vision Model",
        reasoning: false,
        limit: { context: 128_000, output: 4_096 },
        modalities: { input: ["text", "image"] },
      }],
    ]);
    const result = resolveFromModelsDev("vision-model", data);
    assert.ok(result);
    assert.deepStrictEqual(result!.input, ["text", "image"]);
  });

  it("missing entry → null", () => {
    const data = new Map([
      ["other-model", { name: "Other", reasoning: false }],
    ]);
    assert.strictEqual(resolveFromModelsDev("nonexistent", data), null);
  });

  it("missing limit fields → defaults 128_000/32_768", () => {
    const data = new Map([
      ["no-limits", { name: "No Limits", reasoning: true }],
    ]);
    const result = resolveFromModelsDev("no-limits", data);
    assert.ok(result);
    assert.strictEqual(result!.contextWindow, 128_000);
    assert.strictEqual(result!.maxTokens, 32_768);
  });

  it("reasoning_options passed through", () => {
    const data = new Map([
      ["reasoning-model", {
        name: "Reasoning Model",
        reasoning: true,
        limit: { context: 256_000, output: 131_072 },
        modalities: { input: ["text"] },
        reasoning_options: [{ type: "toggle" }, { type: "effort", values: ["high", "max"] }],
      }],
    ]);
    const result = resolveFromModelsDev("reasoning-model", data);
    assert.ok(result);
    assert.deepStrictEqual(result!.reasoning_options, [
      { type: "toggle" },
      { type: "effort", values: ["high", "max"] },
    ]);
  });
});