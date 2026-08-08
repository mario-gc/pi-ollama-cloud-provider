/**
 * Tests for thinking-levels.ts — buildThinkingLevelMap + DEFAULT_MAP.
 *
 * Run with: npm test (bare `node --test`)
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { buildThinkingLevelMap, DEFAULT_MAP } from "../extensions/ollama-cloud/thinking-levels.ts";

describe("buildThinkingLevelMap", () => {
  it("returns DEFAULT_MAP when reasoning_options is undefined", () => {
    assert.deepStrictEqual(buildThinkingLevelMap(undefined), DEFAULT_MAP);
  });

  it("returns DEFAULT_MAP when reasoning_options is empty array", () => {
    assert.deepStrictEqual(buildThinkingLevelMap([]), DEFAULT_MAP);
  });

  it("toggle-only model (has toggle, no effort values) → off:'none', high:'high', rest null", () => {
    const result = buildThinkingLevelMap([{ type: "toggle" }]);
    assert.deepStrictEqual(result, {
      off: "none",
      minimal: null,
      low: null,
      medium: null,
      high: "high",
      xhigh: null,
      max: null,
    });
  });

  it("toggle-only without toggle (no toggle, no effort values) → off:null, high:'high'", () => {
    const result = buildThinkingLevelMap([{ type: "effort", values: [] }]);
    assert.deepStrictEqual(result, {
      off: null,
      minimal: null,
      low: null,
      medium: null,
      high: "high",
      xhigh: null,
      max: null,
    });
  });

  it("effort values [low,medium,high,max] with no toggle → each maps to pi level, off:null", () => {
    const result = buildThinkingLevelMap([
      { type: "effort", values: ["low", "medium", "high", "max"] },
    ]);
    assert.deepStrictEqual(result, {
      off: null,
      minimal: null,
      low: "low",
      medium: "medium",
      high: "high",
      xhigh: null,
      max: "max",
    });
  });

  it("effort values with toggle → off:'none' plus effort mappings", () => {
    const result = buildThinkingLevelMap([
      { type: "toggle" },
      { type: "effort", values: ["low", "high"] },
    ]);
    assert.deepStrictEqual(result, {
      off: "none",
      minimal: null,
      low: "low",
      medium: null,
      high: "high",
      xhigh: null,
      max: null,
    });
  });

  it("unknown effort value (e.g. 'ultra') is ignored, no throw", () => {
    const result = buildThinkingLevelMap([
      { type: "effort", values: ["ultra", "high"] },
    ]);
    // 'ultra' is not in the switch → ignored; only 'high' mapped
    assert.strictEqual(result!.high, "high");
    assert.strictEqual(result!.low, null);
    assert.strictEqual(result!.medium, null);
    assert.strictEqual(result!.max, null);
    assert.strictEqual(result!.off, null);
  });
});

describe("DEFAULT_MAP", () => {
  it("has the expected shape: off:'none', high:'high', max:'max', rest null", () => {
    assert.deepStrictEqual(DEFAULT_MAP, {
      off: "none",
      minimal: null,
      low: null,
      medium: null,
      high: "high",
      xhigh: null,
      max: "max",
    });
  });
});