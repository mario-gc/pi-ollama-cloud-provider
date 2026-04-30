/**
 * Ollama Cloud Provider Extension
 *
 * Registers Ollama Cloud as a model provider with dynamically discovered models.
 *
 * @see https://github.com/mario-gc/pi-ollama-cloud-provider
 */

import type { ExtensionAPI, ProviderModelConfig } from "@mariozechner/pi-coding-agent";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getAgentDir } from "@mariozechner/pi-coding-agent";

const OLLAMA_BASE = "https://ollama.com";
const FETCH_TIMEOUT_MS = 10_000;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// --- Cache types ---

interface CacheEntry {
  id: string;
  show: OllamaShowResponse | null;
}

interface CacheData {
  timestamp: number;
  models: CacheEntry[];
}

// --- API types ---

interface OllamaShowResponse {
  details: {
    family: string;
    parameter_size: string;
  };
  model_info: Record<string, unknown>;
  capabilities: string[];
}

// --- Cache helpers ---

function getCacheDir(): string {
  return join(getAgentDir(), "cache", "ollama-cloud");
}

function getCacheFile(): string {
  return join(getCacheDir(), "models.json");
}

function readCache(): CacheData | null {
  try {
    const file = getCacheFile();
    if (!existsSync(file)) return null;
    const raw = readFileSync(file, "utf-8");
    const data = JSON.parse(raw) as CacheData;
    if (Date.now() - data.timestamp > CACHE_TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}

function writeCache(data: CacheData): void {
  try {
    const dir = getCacheDir();
    mkdirSync(dir, { recursive: true });
    writeFileSync(getCacheFile(), JSON.stringify(data, null, 2));
  } catch {
    // Ignore cache write errors
  }
}

// --- API helpers ---

function extractContextLength(modelInfo: Record<string, unknown>): number {
  for (const [key, value] of Object.entries(modelInfo)) {
    if (key.endsWith(".context_length") && typeof value === "number") {
      return value;
    }
  }
  return 128_000;
}

async function fetchModelIds(): Promise<string[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${OLLAMA_BASE}/v1/models`, {
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = (await res.json()) as { data: Array<{ id: string }> };
    return data.data.map((m) => m.id);
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchModelShow(
  modelId: string,
): Promise<OllamaShowResponse | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/show`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: modelId }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as OllamaShowResponse;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function buildModelConfig(
  id: string,
  show: OllamaShowResponse | null,
): ProviderModelConfig {
  if (!show) {
    return {
      id,
      name: id,
      reasoning: false,
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 128_000,
      maxTokens: 32_768,
    };
  }
  return {
    id,
    name: id,
    reasoning: show.capabilities?.includes("thinking") ?? false,
    input: show.capabilities?.includes("vision")
      ? (["text", "image"] as ("text" | "image")[])
      : (["text"] as ("text" | "image")[]),
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: extractContextLength(show.model_info ?? {}),
    maxTokens: 32_768,
  };
}

// --- Main ---

export default async function (pi: ExtensionAPI) {
  // Try to read from cache first
  const cached = readCache();
  if (cached) {
    const models = cached.models.map((entry) =>
      buildModelConfig(entry.id, entry.show),
    );
    registerProvider(pi, models);
    return;
  }

  // Cache miss or expired — fetch fresh
  let modelIds: string[];
  try {
    modelIds = await fetchModelIds();
  } catch {
    return; // Cannot reach API
  }

  const results = await Promise.allSettled(
    modelIds.map(async (id) => {
      const show = await fetchModelShow(id);
      return { id, show };
    }),
  );

  const entries: CacheEntry[] = [];
  const models: ProviderModelConfig[] = [];

  for (const result of results) {
    if (result.status === "fulfilled") {
      entries.push(result.value);
      models.push(buildModelConfig(result.value.id, result.value.show));
    }
  }

  writeCache({ timestamp: Date.now(), models: entries });
  registerProvider(pi, models);
}

function registerProvider(pi: ExtensionAPI, models: ProviderModelConfig[]) {
  pi.registerProvider("ollama-cloud", {
    baseUrl: `${OLLAMA_BASE}/v1`,
    apiKey: "OLLAMA_CLOUD_API_KEY",
    api: "openai-completions",
    compat: {
      supportsDeveloperRole: false,
      supportsReasoningEffort: false,
    },
    models,
  });
}
