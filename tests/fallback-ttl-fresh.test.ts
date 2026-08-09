/**
 * Fallback tests — models.dev cache TTL: fresh path.
 *
 * Seeds models-dev.json with a timestamp 2 days old. Under the 7-day TTL this
 * is considered fresh, so getModelsDevData() must return the seeded entry and
 * NOT call fetch (no background refresh).
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
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
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

// --- Env / temp-dir management ---

let tempDir: string;
let savedAgentDir: string | undefined;
let savedOffline: string | undefined;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "ollama-fallback-ttl-fresh-"));
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

describe("getModelsDevData — fresh TTL (2 days old under 7-day TTL)", () => {
  it("returns seeded entry without calling fetch", async () => {
    // 2 days old — fresh under the 7-day TTL (would have been stale under the
    // old 24h TTL).
    seedModelsDevCache(Date.now() - 2 * 24 * 3600 * 1000, SAMPLE_MODELS);

    // Spy on fetch — it must NOT be called for a fresh cache.
    const t = { mock };
    const fetchMock = t.mock.method(globalThis, "fetch", async () =>
      new Response(JSON.stringify({ "ollama-cloud": { models: SAMPLE_MODELS } }), { status: 200 }),
    );

    const result = await getModelsDevData();

    assert.strictEqual(fetchMock.mock.calls.length, 0, "fetch must not be called for a fresh cache");
    const entry = result.get("deepseek-v4-pro");
    assert.ok(entry, "seeded entry should be returned");
    assert.strictEqual(entry!.name, "DeepSeek V4 Pro");
    assert.strictEqual(entry!.reasoning, true);
    assert.strictEqual(entry!.limit?.context, 1_048_576);

    fetchMock.mock.restore();
  });
});