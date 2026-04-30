/**
 * Model discovery from the Ollama Cloud API.
 *
 * Uses two endpoints:
 *   GET  /v1/models    — list of model IDs
 *   POST /api/show     — per-model details (capabilities, context length)
 */

import type { ProviderModelConfig } from "@mariozechner/pi-coding-agent";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { OllamaShowResponse, CacheEntry, CacheData } from "./cache.js";
import { readCache, writeCache } from "./cache.js";

export const OLLAMA_BASE = "https://ollama.com";
const FETCH_TIMEOUT_MS = 10_000;

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

async function fetchModelShow(modelId: string): Promise<OllamaShowResponse | null> {
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

// --- Model assembly ---

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

export function registerProvider(pi: ExtensionAPI, models: ProviderModelConfig[]) {
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

// --- Discovery (shared by startup and refresh) ---

export interface DiscoverResult {
  count: number;
  failed: number;
  error?: string;
}

export async function discoverModels(
  pi: ExtensionAPI,
  options: { force?: boolean } = {},
): Promise<DiscoverResult> {
  const { force = false } = options;

  // Try cache first (unless forced)
  const cached = !force ? readCache() : null;
  if (cached) {
    const models = cached.models.map((entry) =>
      buildModelConfig(entry.id, entry.show),
    );
    registerProvider(pi, models);
    return { count: models.length, failed: 0 };
  }

  // Fetch fresh
  let modelIds: string[];
  try {
    modelIds = await fetchModelIds();
  } catch (err) {
    return {
      count: 0,
      failed: 0,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }

  const results = await Promise.allSettled(
    modelIds.map(async (id) => {
      const show = await fetchModelShow(id);
      return { id, show };
    }),
  );

  const entries: CacheEntry[] = [];
  const models: ProviderModelConfig[] = [];
  let failed = 0;

  for (const result of results) {
    if (result.status === "fulfilled") {
      entries.push(result.value);
      models.push(buildModelConfig(result.value.id, result.value.show));
    } else {
      failed++;
    }
  }

  writeCache({ timestamp: Date.now(), models: entries } as CacheData);
  registerProvider(pi, models);

  return { count: models.length, failed };
}
