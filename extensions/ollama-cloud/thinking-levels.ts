import type { ProviderModelConfig } from "@earendil-works/pi-coding-agent";
import type { ReasoningOption } from "./fallback.ts";

export type ThinkingLevelMap = NonNullable<ProviderModelConfig["thinkingLevelMap"]>;

/**
 * DEFAULT map for models not in models.dev or with no reasoning_options.
 * Exposes off, high, max — the most commonly supported levels.
 */
export const DEFAULT_MAP: ThinkingLevelMap = {
  off: "none",
  minimal: null,
  low: null,
  medium: null,
  high: "high",
  xhigh: null,
  max: "max",
};

/**
 * Build a thinkingLevelMap from models.dev reasoning_options.
 *
 * Mapping rules:
 * - toggle present → off: "none" (can disable thinking)
 * - toggle absent  → off: null   (hide off — can't disable)
 * - Each effort value maps to the corresponding pi level
 * - minimal: null (always hidden — no Ollama equivalent)
 * - xhigh: null   (always hidden — pi's max maps to Ollama's max)
 * - Toggle-only models: off + high (binary on/off, "high" = thinking on)
 *
 * Returns undefined if the model is not a thinking model (no reasoning_options).
 * Returns DEFAULT_MAP if reasoning_options is empty or missing.
 */
export function buildThinkingLevelMap(
  reasoning_options?: ReasoningOption[],
): ThinkingLevelMap | undefined {
  if (!reasoning_options || reasoning_options.length === 0) {
    return DEFAULT_MAP;
  }

  const hasToggle = reasoning_options.some((opt) => opt.type === "toggle");
  const effortOpt = reasoning_options.find((opt) => opt.type === "effort");
  const effortValues = effortOpt?.values ?? [];

  // Toggle-only model (no effort levels): binary on/off
  if (effortValues.length === 0) {
    return {
      off: hasToggle ? "none" : null,
      minimal: null,
      low: null,
      medium: null,
      high: "high", // "on" value for toggle-only models
      xhigh: null,
      max: null,
    };
  }

  // Build map from effort values
  const map: ThinkingLevelMap = {
    off: hasToggle ? "none" : null,
    minimal: null,
    low: null,
    medium: null,
    high: null,
    xhigh: null,
    max: null,
  };

  for (const value of effortValues) {
    switch (value) {
      case "low":
        map.low = "low";
        break;
      case "medium":
        map.medium = "medium";
        break;
      case "high":
        map.high = "high";
        break;
      case "max":
        map.max = "max";
        break;
    }
  }

  return map;
}
