/**
 * Ollama Cloud Provider Extension
 *
 * Registers Ollama Cloud as a model provider with dynamically discovered models.
 *
 * @see https://github.com/mario-gc/pi-ollama-cloud-provider
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const ALLOWLIST = [
  "glm-5.1",
  "qwen3.5:397b",
  "deepseek-v4-pro",
  "deepseek-v4-flash",
  "kimi-k2.6",
  "gpt-oss:120b",
  "gemma3:4b",
  "minimax-m2.7",
] as const;

export default async function (pi: ExtensionAPI) {
  pi.registerProvider("ollama-cloud", {
    baseUrl: "https://ollama.com/v1",
    apiKey: "OLLAMA_CLOUD_API_KEY",
    api: "openai-completions",
    compat: {
      supportsDeveloperRole: false,
      supportsReasoningEffort: false,
    },
    models: [
      {
        id: "glm-5.1",
        name: "GLM 5.1",
        reasoning: true,
        input: ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 202752,
        maxTokens: 32768,
      },
      {
        id: "qwen3.5:397b",
        name: "Qwen3.5 397B",
        reasoning: true,
        input: ["text", "image"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 262144,
        maxTokens: 32768,
      },
      {
        id: "deepseek-v4-pro",
        name: "DeepSeek V4 Pro",
        reasoning: true,
        input: ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 1048576,
        maxTokens: 32768,
      },
      {
        id: "deepseek-v4-flash",
        name: "DeepSeek V4 Flash",
        reasoning: true,
        input: ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 1048576,
        maxTokens: 32768,
      },
      {
        id: "kimi-k2.6",
        name: "Kimi K2.6",
        reasoning: true,
        input: ["text", "image"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 262144,
        maxTokens: 32768,
      },
      {
        id: "gpt-oss:120b",
        name: "GPT OSS 120B",
        reasoning: true,
        input: ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 131072,
        maxTokens: 32768,
      },
      {
        id: "gemma3:4b",
        name: "Gemma 3 4B",
        reasoning: false,
        input: ["text", "image"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 131072,
        maxTokens: 32768,
      },
      {
        id: "minimax-m2.7",
        name: "MiniMax M2.7",
        reasoning: true,
        input: ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 196608,
        maxTokens: 32768,
      },
    ],
  });
}
