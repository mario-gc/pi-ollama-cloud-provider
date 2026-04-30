/**
 * Ollama Cloud Provider Extension
 *
 * Registers Ollama Cloud as a model provider with dynamically discovered models.
 *
 * @see https://github.com/mario-gc/pi-ollama-cloud-provider
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default async function (pi: ExtensionAPI) {
  pi.registerProvider("ollama-cloud", {
    baseUrl: "https://ollama.com/v1",
    apiKey: "OLLAMA_CLOUD_API_KEY",
    api: "openai-completions",
    compat: {
      supportsDeveloperRole: false,
      supportsReasoningEffort: false,
    },
  });
}
