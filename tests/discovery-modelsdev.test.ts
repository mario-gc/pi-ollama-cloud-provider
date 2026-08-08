/**
 * Discovery tests — models.dev mode.
 *
 * Seeds the models.dev disk cache file before the first getModelsDevData() call
 * (module-level in-memory cache is populated on first call). Then
 * discoverModels(pi, { mode: "modelsdev" }) registers all models with
 * source: "modelsdev" and writes the models cache.
 *
 * node --test runs each file in its own process, so modelsDevCache starts
 * empty and the disk seed is actually read.
 *
 * Run with: npm test (bare `node --test`)
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { discoverModels } from "../extensions/ollama-cloud/discovery.ts";
import { readCache } from "../extensions/ollama-cloud/cache.ts";

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
  tempDir = mkdtempSync(join(tmpdir(), "ollama-disc-modelsdev-"));
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

// --- Helper: seed models-dev.json disk cache ---

function seedModelsDevCache(models: Record<string, unknown>) {
  const cacheDir = join(tempDir, "cache", "ollama-cloud");
  mkdirSync(cacheDir, { recursive: true });
  const data = { timestamp: Date.now(), models };
  writeFileSync(join(cacheDir, "models-dev.json"), JSON.stringify(data, null, 2));
}

// --- Tests ---

describe("discoverModels — modelsdev mode", () => {
  it("registers all models with source modelsdev and writes models cache", async () => {
    seedModelsDevCache({
      "test-model-1": {
        name: "Test Model 1",
        reasoning: true,
        limit: { context: 200_000, output: 65_536 },
        modalities: { input: ["text"] },
      },
      "test-model-2": {
        name: "Test Model 2",
        reasoning: false,
        limit: { context: 131_072, output: 8_192 },
        modalities: { input: ["text"] },
      },
    });

    const { pi, calls } = createMockPi();
    const result = await discoverModels(pi as any, { mode: "modelsdev" });

    assert.strictEqual(result.count, 2);
    assert.strictEqual(result.error, undefined);
    assert.strictEqual(result.sources.ollama, 0);
    assert.strictEqual(result.sources.modelsdev, 2);
    assert.strictEqual(result.sources.inference, 0);

    // registerProvider called once with correct config shape
    assert.strictEqual(calls.length, 1);
    assertProviderConfig(calls[0]);

    // Models cache was written — readCache should return entries with show:null
    const cached = readCache({ ignoreTTL: true });
    assert.ok(cached);
    assert.strictEqual(cached!.models.length, 2);
    for (const entry of cached!.models) {
      assert.strictEqual(entry.show, null);
      assert.strictEqual(entry.source, "modelsdev");
    }
  });

});