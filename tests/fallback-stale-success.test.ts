/**
 * Fallback tests — models.dev stale-while-revalidate: success path.
 *
 * Seeds models-dev.json with an expired timestamp. getModelsDevData() must
 * return the stale entry IMMEDIATELY (before the background fetch resolves).
 * A deferred fetch mock lets the test prove the stale data is returned without
 * waiting on the network. After the fetch is resolved, the background refresh
 * rewrites the disk cache with the fetched models and a fresh timestamp.
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
  tempDir = mkdtempSync(join(tmpdir(), "ollama-fallback-stale-success-"));
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

describe("getModelsDevData — stale served before fetch resolves, then refreshed", () => {
  it("returns stale entry immediately, then background refresh rewrites disk", async () => {
    const expiredTimestamp = Date.now() - 8 * 24 * 3600 * 1000; // 8 days — expired
    seedModelsDevCache(expiredTimestamp, SAMPLE_MODELS);

    // Deferred fetch: the test controls when it resolves, proving getModelsDevData
    // does NOT wait for the fetch.
    let resolveFetch!: (r: Response) => void;
    const t = { mock };
    const fetchMock = t.mock.method(
      globalThis,
      "fetch",
      () => new Promise<Response>((r) => { resolveFetch = r; }),
    );

    const resultPromise = getModelsDevData();

    // BEFORE resolving the fetch: the promise must resolve with the stale entry
    // (it must NOT wait for the fetch).
    const result = await resultPromise;
    const entry = result.get("deepseek-v4-pro");
    assert.ok(entry, "stale seeded entry should be returned before fetch resolves");
    assert.strictEqual(entry!.name, "DeepSeek V4 Pro");
    assert.strictEqual(fetchMock.mock.calls.length, 1, "background refresh fetch was fired");

    // Now resolve the fetch and let the background refresh complete.
    resolveFetch(new Response(JSON.stringify({ "ollama-cloud": { models: SAMPLE_MODELS } }), { status: 200 }));

    await Promise.allSettled([fetchMock.mock.calls[0].result]);
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));

    // Poll the disk cache until it updates (bounded so the test cannot hang).
    let updated = false;
    let raw: { timestamp: number; models: Record<string, unknown> } | null = null;
    for (let i = 0; i < 100 && !updated; i++) {
      await new Promise((r) => setTimeout(r, 10));
      raw = JSON.parse(readFileSync(cacheFile(), "utf-8"));
      updated = Math.abs(raw!.timestamp - Date.now()) < 5_000;
    }
    assert.ok(updated, "disk cache was refreshed in the background");
    assert.deepStrictEqual(raw!.models, SAMPLE_MODELS, "disk cache holds the fetched models");

    fetchMock.mock.restore();
  });
});