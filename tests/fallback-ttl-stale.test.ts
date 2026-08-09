/**
 * Fallback tests — models.dev cache TTL: stale path.
 *
 * Seeds models-dev.json with a timestamp 7 days + 1ms old (stale under the
 * 7-day TTL). getModelsDevData() must serve the stale entry immediately and
 * fire a background refresh (fetch called once). After the refresh settles,
 * the disk cache is rewritten with a fresh timestamp and the fetched models.
 *
 * node --test runs each file in its own process, so the module-level
 * modelsDevCache in fallback.ts starts empty and the disk seed is actually
 * read.
 *
 * Run with: npm test (bare `node --test`)
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { mock } from "node:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { getModelsDevData } from "../extensions/ollama-cloud/fallback.ts";
import type { ModelsDevModelData } from "../extensions/ollama-cloud/fallback.ts";

// --- Sample models payload (shape matches ModelsDevModelData) ---

const SAMPLE_MODELS: Record<string, ModelsDevModelData> = {
  "deepseek-v4-pro": {
    name: "DeepSeek V4 Pro",
    reasoning: true,
    limit: { context: 1_048_576, output: 1_048_576 },
    modalities: { input: ["text"] },
  },
};

// --- Shared seed helper ---

function seedModelsDevCache(timestamp: number, models: Record<string, unknown> = {}) {
  const dir = join(process.env.PI_CODING_AGENT_DIR!, "cache", "ollama-cloud");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "models-dev.json"), JSON.stringify({ timestamp, models }, null, 2));
}

function cacheFile(): string {
  return join(process.env.PI_CODING_AGENT_DIR!, "cache", "ollama-cloud", "models-dev.json");
}

// --- Env / temp-dir management ---

let tempDir: string;
let savedAgentDir: string | undefined;
let savedOffline: string | undefined;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "ollama-fallback-ttl-stale-"));
  savedAgentDir = process.env.PI_CODING_AGENT_DIR;
  savedOffline = process.env.PI_OFFLINE;
  process.env.PI_CODING_AGENT_DIR = tempDir;
  // Ensure we are NOT offline (default, but explicit for determinism)
  delete process.env.PI_OFFLINE;
});

afterEach(() => {
  if (savedAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
  else process.env.PI_CODING_AGENT_DIR = savedAgentDir;
  if (savedOffline === undefined) delete process.env.PI_OFFLINE;
  else process.env.PI_OFFLINE = savedOffline;
  rmSync(tempDir, { recursive: true, force: true });
});

// --- Tests ---

describe("getModelsDevData — stale TTL (7 days + 1ms) triggers background refresh", () => {
  it("serves stale entry, fetches once, then rewrites disk cache", async () => {
    const staleTimestamp = Date.now() - 7 * 24 * 3600 * 1000 - 1; // 7 days + 1ms — stale
    seedModelsDevCache(staleTimestamp, SAMPLE_MODELS);

    const t = { mock };
    const fetchMock = t.mock.method(globalThis, "fetch", async () =>
      new Response(JSON.stringify({ "ollama-cloud": { models: SAMPLE_MODELS } }), { status: 200 }),
    );

    const result = await getModelsDevData();

    // Stale data returned immediately.
    const entry = result.get("deepseek-v4-pro");
    assert.ok(entry, "stale seeded entry should be returned");
    assert.strictEqual(entry!.name, "DeepSeek V4 Pro");

    // Background refresh fired (treated as stale → fetch called once).
    assert.strictEqual(fetchMock.mock.calls.length, 1, "fetch should be called once for a stale cache");

    // Wait for the background refresh to settle.
    await Promise.allSettled([fetchMock.mock.calls[0].result]);
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));

    // Poll the disk cache until it is rewritten with a fresh timestamp
    // (bounded so the test cannot hang).
    let updated = false;
    let raw: { timestamp: number; models: Record<string, unknown> } | null = null;
    for (let i = 0; i < 100 && !updated; i++) {
      await new Promise((r) => setTimeout(r, 10));
      raw = JSON.parse(readFileSync(cacheFile(), "utf-8"));
      updated = Math.abs(raw!.timestamp - Date.now()) < 5_000;
    }
    assert.ok(updated, "disk cache was rewritten with a fresh timestamp");
    assert.deepStrictEqual(raw!.models, SAMPLE_MODELS, "disk cache holds the fetched models");

    fetchMock.mock.restore();
  });
});