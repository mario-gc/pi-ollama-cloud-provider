/**
 * Tests for cache.ts — readCache, writeCache, getCacheInfo.
 *
 * Uses PI_CODING_AGENT_DIR pointing at a fresh temp dir in beforeEach so
 * cache files are isolated per test. No network calls.
 *
 * Run with: npm test (bare `node --test`)
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readCache, writeCache, getCacheInfo, CACHE_TTL_MS } from "../extensions/ollama-cloud/cache.ts";
import type { CacheData, CacheEntry } from "../extensions/ollama-cloud/cache.ts";

let tempDir: string;
let savedAgentDir: string | undefined;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "ollama-cache-test-"));
  savedAgentDir = process.env.PI_CODING_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR = tempDir;
});

afterEach(() => {
  if (savedAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
  else process.env.PI_CODING_AGENT_DIR = savedAgentDir;
  rmSync(tempDir, { recursive: true, force: true });
});

// Helper: build a sample CacheData with mixed-source entries
function sampleCacheData(timestamp: number = Date.now()): CacheData {
  const entries: CacheEntry[] = [
    {
      id: "ollama-model",
      show: {
        details: { family: "test", parameter_size: "7b" },
        model_info: { "test.context_length": 131072 },
        capabilities: ["thinking"],
      },
      source: "ollama",
    },
    { id: "modelsdev-model", show: null, source: "modelsdev" },
    { id: "inferred-model", show: null, source: "inference" },
  ];
  return { timestamp, models: entries };
}

describe("readCache / writeCache roundtrip", () => {
  it("writeCache → readCache preserves data", () => {
    const data = sampleCacheData();
    writeCache(data);
    const read = readCache();
    assert.ok(read);
    assert.strictEqual(read!.models.length, 3);
    assert.strictEqual(read!.models[0].id, "ollama-model");
    assert.strictEqual(read!.models[0].source, "ollama");
    assert.strictEqual(read!.models[1].id, "modelsdev-model");
    assert.strictEqual(read!.models[1].source, "modelsdev");
    assert.strictEqual(read!.models[2].id, "inferred-model");
    assert.strictEqual(read!.models[2].source, "inference");
  });
});

describe("readCache — no file", () => {
  it("returns null when no cache file exists", () => {
    assert.strictEqual(readCache(), null);
  });
});

describe("readCache — TTL expiry", () => {
  it("expired timestamp → null", () => {
    // 2 hours ago — past the 1h TTL
    const data = sampleCacheData(Date.now() - 2 * CACHE_TTL_MS);
    writeCache(data);
    assert.strictEqual(readCache(), null);
  });

  it("expired timestamp with ignoreTTL → returns data", () => {
    const data = sampleCacheData(Date.now() - 2 * CACHE_TTL_MS);
    writeCache(data);
    const read = readCache({ ignoreTTL: true });
    assert.ok(read);
    assert.strictEqual(read!.models.length, 3);
  });
});

describe("readCache — corrupt JSON", () => {
  it("returns null on corrupt JSON file (no throw)", () => {
    const cacheDir = join(tempDir, "cache", "ollama-cloud");
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(join(cacheDir, "models.json"), "{ not valid json");
    assert.strictEqual(readCache(), null);
  });
});

describe("getCacheInfo", () => {
  it("returns exists:false when no cache file", () => {
    const info = getCacheInfo();
    assert.strictEqual(info.exists, false);
    assert.strictEqual(info.modelCount, 0);
    assert.strictEqual(info.age, null);
    assert.strictEqual(info.size, null);
  });

  it("after write with mixed sources → correct counts, age, size", () => {
    const data = sampleCacheData();
    writeCache(data);
    const info = getCacheInfo();
    assert.strictEqual(info.exists, true);
    assert.strictEqual(info.modelCount, 3);
    assert.strictEqual(info.sources.ollama, 1);
    assert.strictEqual(info.sources.modelsdev, 1);
    assert.strictEqual(info.sources.inference, 1);
    // Age should be "0m" for a freshly written cache
    assert.strictEqual(info.age, "0m");
    // Size should be a non-empty string (KB or B suffix)
    assert.ok(typeof info.size === "string");
    assert.ok(info.size!.length > 0);
  });
});