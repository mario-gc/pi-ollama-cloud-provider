/**
 * Fallback tests — models.dev first run (no cache).
 *
 * Empty temp dir (no models-dev.json). getModelsDevData() must fetch
 * synchronously, return the fetched models, and write the disk cache with a
 * fresh timestamp and the fetched models. fetch is called exactly once.
 *
 * node --test runs each file in its own process, so the module-level
 * modelsDevCache in fallback.ts starts empty and the absent disk cache is
 * actually observed.
 *
 * Run with: npm test (bare `node --test`)
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { mock } from "node:test";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
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

function cacheFile(): string {
  return join(process.env.PI_CODING_AGENT_DIR!, "cache", "ollama-cloud", "models-dev.json");
}

// --- Env / temp-dir management ---

let tempDir: string;
let savedAgentDir: string | undefined;
let savedOffline: string | undefined;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "ollama-fallback-firstrun-"));
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

describe("getModelsDevData — first run (no cache)", () => {
  it("fetches synchronously, returns fetched models, writes disk cache", async () => {
    // No seed — empty temp dir.

    const t = { mock };
    const fetchMock = t.mock.method(globalThis, "fetch", async () =>
      new Response(JSON.stringify({ "ollama-cloud": { models: SAMPLE_MODELS } }), { status: 200 }),
    );

    const result = await getModelsDevData();

    // Result contains the fetched models.
    const entry = result.get("deepseek-v4-pro");
    assert.ok(entry, "fetched entry should be returned");
    assert.strictEqual(entry!.name, "DeepSeek V4 Pro");
    assert.strictEqual(entry!.reasoning, true);
    assert.strictEqual(entry!.limit?.context, 1_048_576);

    // fetch called exactly once (synchronous first-run fetch).
    assert.strictEqual(fetchMock.mock.calls.length, 1, "fetch should be called once on first run");

    // Disk cache written with a fresh timestamp and the fetched models.
    assert.ok(existsSync(cacheFile()), "disk cache file should be written on first run");
    const raw = JSON.parse(readFileSync(cacheFile(), "utf-8")) as {
      timestamp: number;
      models: Record<string, unknown>;
    };
    assert.ok(Math.abs(raw.timestamp - Date.now()) < 5_000, "disk cache timestamp is fresh");
    assert.deepStrictEqual(raw.models, SAMPLE_MODELS, "disk cache holds the fetched models");

    fetchMock.mock.restore();
  });
});