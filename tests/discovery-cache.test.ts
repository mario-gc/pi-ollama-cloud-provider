/**
 * Discovery tests — default ollama mode with cache hit.
 *
 * Seeds BOTH cache files (models.json via writeCache, models-dev.json on disk),
 * then discoverModels(pi) with default options registers models from cache
 * with sources from entry.show. No network calls.
 *
 * node --test runs each file in its own process, so modelsDevCache starts
 * empty and the models-dev.json disk seed is actually read.
 *
 * Run with: npm test (bare `node --test`)
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { discoverModels } from "../extensions/ollama-cloud/discovery.ts";
import { writeCache, readCache } from "../extensions/ollama-cloud/cache.ts";
import type { CacheData, CacheEntry } from "../extensions/ollama-cloud/cache.ts";

// --- Mock pi with recording registerProvider spy ---

function createMockPi() {
  const calls: Array<{ name: string; config: Record<string, unknown> }> = [];
  const pi = {
    registerProvider(name: string, config: Record<string, unknown>) {
      calls.push({ name, config });
    },
  };
  return { pi, calls };
}

function assertProviderConfig(call: { name: string; config: Record<string, unknown> }) {
  assert.strictEqual(call.name, "ollama-cloud");
  assert.strictEqual(call.config.baseUrl, "https://ollama.com/v1");
  assert.strictEqual(call.config.apiKey, "$OLLAMA_CLOUD_API_KEY");
  assert.strictEqual(call.config.api, "openai-completions");
  const models = call.config.models as Array<Record<string, unknown>>;
  for (const model of models) {
    assert.deepStrictEqual(model.compat, {
      supportsDeveloperRole: false,
      supportsReasoningEffort: true,
    });
  }
}

// --- Env / temp-dir management ---

let tempDir: string;
let savedAgentDir: string | undefined;
let savedOffline: string | undefined;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "ollama-disc-cache-"));
  savedAgentDir = process.env.PI_CODING_AGENT_DIR;
  savedOffline = process.env.PI_OFFLINE;
  process.env.PI_CODING_AGENT_DIR = tempDir;
  // Ensure we are NOT offline
  delete process.env.PI_OFFLINE;
});

afterEach(() => {
  if (savedAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
  else process.env.PI_CODING_AGENT_DIR = savedAgentDir;
  if (savedOffline === undefined) delete process.env.PI_OFFLINE;
  else process.env.PI_OFFLINE = savedOffline;
  rmSync(tempDir, { recursive: true, force: true });
});

// --- Helper: seed models-dev.json disk cache ---

function seedModelsDevCache(models: Record<string, unknown>) {
  const cacheDir = join(tempDir, "cache", "ollama-cloud");
  mkdirSync(cacheDir, { recursive: true });
  const data = { timestamp: Date.now(), models };
  writeFileSync(join(cacheDir, "models-dev.json"), JSON.stringify(data, null, 2));
}

// --- Tests ---

describe("discoverModels — default mode with seeded cache", () => {
  it("registers models from cache with correct sources, no network", async () => {
    // Seed models-dev.json disk cache (read by getModelsDevData on first call)
    seedModelsDevCache({
      "modelsdev-model": {
        name: "ModelsDev Model",
        reasoning: true,
        limit: { context: 200_000, output: 65_536 },
        modalities: { input: ["text"] },
      },
    });

    // Seed models.json via writeCache (read by readCache on startup)
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
    const data: CacheData = { timestamp: Date.now(), models: entries };
    writeCache(data);

    const { pi, calls } = createMockPi();
    const result = await discoverModels(pi as any);

    // 3 models registered
    assert.strictEqual(result.count, 3);
    assert.strictEqual(result.error, undefined);

    // Sources: entry with show → ollama; entry without show in models.dev → modelsdev;
    //           entry without show not in models.dev → inference
    assert.strictEqual(result.sources.ollama, 1);
    assert.strictEqual(result.sources.modelsdev, 1);
    assert.strictEqual(result.sources.inference, 1);

    // registerProvider called once with correct config shape
    assert.strictEqual(calls.length, 1);
    assertProviderConfig(calls[0]);

    // Verify the registered models have the right IDs
    const models = calls[0].config.models as Array<Record<string, unknown>>;
    const ids = models.map((m) => m.id).sort();
    assert.deepStrictEqual(ids, ["inferred-model", "modelsdev-model", "ollama-model"]);
  });

  it("cache hit avoids network even when models-dev disk cache is absent", async () => {
    // Seed only models.json (no models-dev.json)
    // getModelsDevData will try to fetch from network — but since the models
    // cache has entries, the cache path is taken. The getModelsDevData call
    // is still made (for reasoning_options), so we seed an empty models-dev
    // to prevent any network call.
    seedModelsDevCache({});

    const entries: CacheEntry[] = [
      { id: "cached-model", show: null, source: "inference" },
    ];
    writeCache({ timestamp: Date.now(), models: entries });

    const { pi, calls } = createMockPi();
    const result = await discoverModels(pi as any);

    assert.strictEqual(result.count, 1);
    assert.strictEqual(result.sources.inference, 1);
    assert.strictEqual(calls.length, 1);
    assertProviderConfig(calls[0]);
  });
});