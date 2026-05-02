/**
 * Model discovery from the Ollama Cloud API.
 *
 * Priority chain (per model):
 *   1. POST /api/show          — capabilities, context length (primary)
 *   2. https://models.dev/api.json — fallback if /api/show fails
 *   3. Name-based inference    — last resort
 */

import type { ProviderModelConfig } from "@mariozechner/pi-coding-agent";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { OllamaShowResponse, CacheEntry, CacheData } from "./cache.js";
import { readCache, writeCache } from "./cache.js";
import {
  getModelsDevData,
  resolveFromModelsDev,
  inferFromName,
  type ModelsDevModelData,
  type ResolvedModelData,
} from "./fallback.js";

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

// --- Fallback resolution (lazy: only fetched when needed) ---

async function resolveFallback(
  id: string,
  modelsDevData: Map<string, ModelsDevModelData> | null,
): Promise<ResolvedModelData> {
  // Priority 1: models.dev exact match (only if data was fetched)
  if (modelsDevData) {
    const fromModelsDev = resolveFromModelsDev(id, modelsDevData);
    if (fromModelsDev) return fromModelsDev;
  }

  // Priority 2: name-based inference
  return inferFromName(id);
}

// --- Model assembly ---

function buildModelConfig(
  id: string,
  show: OllamaShowResponse | null,
  fallback: ResolvedModelData,
): ProviderModelConfig {
  let contextWindow: number;
  let maxTokens: number;
  let reasoning: boolean;
  let input: ("text" | "image")[];

  if (show) {
    // Primary: real /api/show data
    contextWindow = extractContextLength(show.model_info ?? {});
    maxTokens = fallback.maxTokens; // /api/show doesn't provide max output
    reasoning = show.capabilities?.includes("thinking") ?? false;
    input = show.capabilities?.includes("vision")
      ? ["text", "image"]
      : ["text"];
  } else {
    // Fallback: models.dev or name inference
    contextWindow = fallback.contextWindow;
    maxTokens = fallback.maxTokens;
    reasoning = fallback.reasoning;
    input = fallback.input;
  }

  return {
    id,
    name: id,
    reasoning,
    input,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow,
    maxTokens,
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
  failedApi: number;
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
    // Check if any cached entries are missing /api/show data
    const needsFallback = cached.models.some((entry) => !entry.show);

    let modelsDevData: Map<string, ModelsDevModelData> | null = null;
    if (needsFallback) {
      // Only fetch models.dev if at least one model needs fallback
      modelsDevData = await getModelsDevData();
    }

    const models: ProviderModelConfig[] = [];
    for (const entry of cached.models) {
      const fallback = await resolveFallback(entry.id, modelsDevData);
      models.push(buildModelConfig(entry.id, entry.show, fallback));
    }
    registerProvider(pi, models);
    return { count: models.length, failedApi: needsFallback ? 1 : 0 };
  }

  // Fetch fresh
  let modelIds: string[];
  try {
    modelIds = await fetchModelIds();
  } catch (err) {
    return {
      count: 0,
      failedApi: 0,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }

  // Step 1: Try /api/show for ALL models (primary)
  const results = await Promise.allSettled(
    modelIds.map(async (id) => {
      const show = await fetchModelShow(id);
      return { id, show };
    }),
  );

  // Step 2: Separate successes from failures
  const successes: Array<{ id: string; show: OllamaShowResponse }> = [];
  const failedIds: string[] = [];

  for (const result of results) {
    if (result.status === "fulfilled" && result.value.show) {
      successes.push(result.value);
    } else if (result.status === "fulfilled") {
      failedIds.push(result.value.id);
    } else {
      failedIds.push("unknown");
    }
  }

  // Step 3: Only fetch models.dev if there are failures
  let modelsDevData: Map<string, ModelsDevModelData> | null = null;
  if (failedIds.length > 0) {
    modelsDevData = await getModelsDevData();
  }

  // Step 4: Build configs
  const entries: CacheEntry[] = [];
  const models: ProviderModelConfig[] = [];

  // Successful models
  for (const { id, show } of successes) {
    const fallback = await resolveFallback(id, modelsDevData);
    entries.push({ id, show });
    models.push(buildModelConfig(id, show, fallback));
  }

  // Failed models
  for (const id of failedIds) {
    const fallback = await resolveFallback(id, modelsDevData);
    entries.push({ id, show: null });
    models.push(buildModelConfig(id, null, fallback));
  }

  writeCache({ timestamp: Date.now(), models: entries } as CacheData);
  registerProvider(pi, models);

  return { count: models.length, failedApi: failedIds.length };
}
