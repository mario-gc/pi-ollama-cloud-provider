/**
 * Fallback tests — models.dev corrupt cache (invalid JSON).
 *
 * Seeds models-dev.json with invalid JSON. readModelsDevCache() catches the
 * JSON.parse failure and returns null (both with and without ignoreTTL), so
 * getModelsDevData() falls through to the synchronous first-run fetch. The
 * result must contain the fetched models, fetch is called once, and the disk
 * cache is rewritten with valid JSON.
 *
 * node --test runs each file in its own process, so the module-level
 * modelsDevCache in fallback.ts starts empty and the corrupt disk seed is
 * actually observed.
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

function seedCorruptModelsDevCache() {
  const dir = join(process.env.PI_CODING_AGENT_DIR!, "cache", "ollama-cloud");
  mkdirSync(dir, { recursive: true });
  // Invalid JSON — readModelsDevCache's JSON.parse will throw → catch → null.
  writeFileSync(join(dir, "models-dev.json"), "{ not json");
}

function cacheFile(): string {
  return join(process.env.PI_CODING_AGENT_DIR!, "cache", "ollama-cloud", "models-dev.json");
}

// --- Env / temp-dir management ---

let tempDir: string;
let savedAgentDir: string | undefined;
let savedOffline: string | undefined;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "ollama-fallback-corrupt-"));
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

describe("getModelsDevData — corrupt cache (invalid JSON)", () => {
  it("does not crash, fetches synchronously, rewrites disk with valid JSON", async () => {
    seedCorruptModelsDevCache();

    const t = { mock };
    const fetchMock = t.mock.method(globalThis, "fetch", async () =>
      new Response(JSON.stringify({ "ollama-cloud": { models: SAMPLE_MODELS } }), { status: 200 }),
    );

    // Must not throw despite the corrupt on-disk cache.
    const result = await getModelsDevData();

    // Result contains the fetched models (JSON.parse catch → null → sync fetch).
    const entry = result.get("deepseek-v4-pro");
    assert.ok(entry, "fetched entry should be returned after corrupt cache");
    assert.strictEqual(entry!.name, "DeepSeek V4 Pro");
    assert.strictEqual(entry!.reasoning, true);

    // fetch called exactly once (synchronous fetch because cache was unusable).
    assert.strictEqual(fetchMock.mock.calls.length, 1, "fetch should be called once for a corrupt cache");

    // Disk cache rewritten with valid JSON holding the fetched models.
    const raw = JSON.parse(readFileSync(cacheFile(), "utf-8")) as {
      timestamp: number;
      models: Record<string, unknown>;
    };
    assert.ok(Math.abs(raw.timestamp - Date.now()) < 5_000, "disk cache timestamp is fresh");
    assert.deepStrictEqual(raw.models, SAMPLE_MODELS, "disk cache holds the fetched models");

    fetchMock.mock.restore();
  });
});