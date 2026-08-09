/**
 * Fallback tests — models.dev stale-while-revalidate: failure path.
 *
 * Seeds models-dev.json with an expired timestamp. getModelsDevData() must
 * serve the stale entry immediately and fire a background refresh. When the
 * background fetch rejects, the error is swallowed inside
 * refreshModelsDevCache (try/catch) and the on-disk cache must be left
 * untouched. No unhandled promise rejection should surface.
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
  tempDir = mkdtempSync(join(tmpdir(), "ollama-fallback-stale-failure-"));
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

describe("getModelsDevData — stale cache, background fetch rejects", () => {
  it("serves stale entry, leaves disk cache untouched, no unhandled rejection", async () => {
    const expiredTimestamp = Date.now() - 8 * 24 * 3600 * 1000; // 8 days — expired
    seedModelsDevCache(expiredTimestamp, SAMPLE_MODELS);

    // Snapshot the on-disk seed so we can prove it is left untouched.
    const seededRaw = readFileSync(cacheFile(), "utf-8");

    const t = { mock };
    const fetchMock = t.mock.method(globalThis, "fetch", async () => {
      throw new Error("network down");
    });

    // Track any unhandled rejection — the try/catch in refreshModelsDevCache
    // should swallow the error, so this must never fire.
    let unhandled: unknown = null;
    const rejectionHandler = (err: unknown) => { unhandled = err; };
    process.on("unhandledRejection", rejectionHandler);

    const result = await getModelsDevData();

    // Stale data returned.
    const entry = result.get("deepseek-v4-pro");
    assert.ok(entry, "stale seeded entry should be returned");
    assert.strictEqual(entry!.name, "DeepSeek V4 Pro");
    assert.strictEqual(fetchMock.mock.calls.length, 1, "background refresh fetch was fired");

    // Wait for the background refresh to settle. The fetch mock rejects, so we
    // use Promise.allSettled (do NOT await mock.calls[0].result directly).
    await Promise.allSettled([fetchMock.mock.calls[0].result]);
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));

    // The on-disk cache must be byte-for-byte identical to the seed.
    const afterRaw = readFileSync(cacheFile(), "utf-8");
    assert.strictEqual(afterRaw, seededRaw, "disk cache must be unchanged after a failed refresh");

    // And parsed values must match the seed exactly.
    const after = JSON.parse(afterRaw) as { timestamp: number; models: Record<string, unknown> };
    assert.strictEqual(after.timestamp, expiredTimestamp);
    assert.deepStrictEqual(after.models, SAMPLE_MODELS);

    // No unhandled rejection surfaced.
    assert.strictEqual(unhandled, null, "refreshModelsDevCache should swallow the fetch error");

    process.removeListener("unhandledRejection", rejectionHandler);
    fetchMock.mock.restore();
  });
});