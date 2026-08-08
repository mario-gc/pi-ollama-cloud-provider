/**
 * Discovery tests — offline mode.
 *
 * Mock-pi pattern: plain object with recording registerProvider spy.
 * PI_OFFLINE=1 forces offline path (cache-only, no network).
 *
 * node --test runs each file in its own process, so the module-level
 * modelsDevCache in fallback.ts cannot leak between files.
 *
 * Run with: npm test (bare `node --test`)
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { discoverModels } from "../extensions/ollama-cloud/discovery.ts";
import { writeCache } from "../extensions/ollama-cloud/cache.ts";
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

// Assert the provider config shape registered with pi
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
  tempDir = mkdtempSync(join(tmpdir(), "ollama-disc-offline-"));
  savedAgentDir = process.env.PI_CODING_AGENT_DIR;
  savedOffline = process.env.PI_OFFLINE;
  process.env.PI_CODING_AGENT_DIR = tempDir;
});

afterEach(() => {
  if (savedAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
  else process.env.PI_CODING_AGENT_DIR = savedAgentDir;
  if (savedOffline === undefined) delete process.env.PI_OFFLINE;
  else process.env.PI_OFFLINE = savedOffline;
  rmSync(tempDir, { recursive: true, force: true });
});

// --- Tests ---

describe("discoverModels — offline, no cache", () => {
  it("returns count 0 with error, does not call registerProvider", async () => {
    process.env.PI_OFFLINE = "1";
    const { pi, calls } = createMockPi();
    const result = await discoverModels(pi as any);

    assert.strictEqual(result.count, 0);
    assert.strictEqual(result.error, "Offline mode: no cached models available");
    assert.strictEqual(result.sources.ollama, 0);
    assert.strictEqual(result.sources.modelsdev, 0);
    assert.strictEqual(result.sources.inference, 0);
    assert.strictEqual(calls.length, 0, "registerProvider should NOT be called");
  });
});

describe("discoverModels — offline, seeded cache", () => {
  it("registers models from cache with correct sources, no network", async () => {
    process.env.PI_OFFLINE = "1";

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

    assert.strictEqual(result.count, 3);
    assert.strictEqual(result.error, undefined);
    // Sources: entry with show → ollama; entries without show → their cache source
    assert.strictEqual(result.sources.ollama, 1);
    assert.strictEqual(result.sources.modelsdev, 1);
    assert.strictEqual(result.sources.inference, 1);

    // registerProvider was called once with correct config shape
    assert.strictEqual(calls.length, 1);
    assertProviderConfig(calls[0]);
  });
});