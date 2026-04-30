/**
 * Ollama Cloud Provider Extension
 *
 * Registers Ollama Cloud as a model provider with dynamically discovered models.
 *
 * @see https://github.com/mario-gc/pi-ollama-cloud-provider
 */

import type { ExtensionAPI, ProviderModelConfig } from "@mariozechner/pi-coding-agent";

const OLLAMA_BASE = "https://ollama.com";
const FETCH_TIMEOUT_MS = 10_000;

// --- API types ---

interface OllamaShowResponse {
  details: {
    family: string;
    parameter_size: string;
  };
  model_info: Record<string, unknown>;
  capabilities: string[];
}

// --- Helpers ---

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

// --- Main ---

export default async function (pi: ExtensionAPI) {
  let modelIds: string[];
  try {
    modelIds = await fetchModelIds();
  } catch {
    // Cannot reach API — skip registration
    return;
  }

  const results = await Promise.allSettled(
    modelIds.map(async (id) => {
      const show = await fetchModelShow(id);
      if (!show) {
        return {
          id,
          name: id,
          reasoning: false,
          input: ["text"] as ("text" | "image")[],
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          contextWindow: 128_000,
          maxTokens: 32_768,
        } satisfies ProviderModelConfig;
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
      } satisfies ProviderModelConfig;
    }),
  );

  const models = results
    .filter((r): r is PromiseFulfilledResult<ProviderModelConfig> => r.status === "fulfilled")
    .map((r) => r.value);

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
