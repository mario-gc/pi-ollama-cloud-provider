/**
 * Interactive TUI menu for the /ollama-cloud command.
 *
 * Uses SettingsList from @mariozechner/pi-tui for native pi menu behavior.
 */

import type { ExtensionAPI, ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import { getSettingsListTheme, Theme } from "@mariozechner/pi-coding-agent";
import { Container, type Component, type SettingItem, SettingsList } from "@mariozechner/pi-tui";
import { discoverModels, registerProvider, OLLAMA_BASE } from "./discovery.js";
import { readCache, getCacheInfo } from "./cache.js";

// --- Status submenu ---

function buildStatusSubmenu(
  settingsTheme: ReturnType<typeof getSettingsListTheme>,
  modelCount: number,
  done: () => void,
): Component {
  const cacheInfo = getCacheInfo();

  const items: SettingItem[] = [
    {
      id: "models",
      label: "Registered Models",
      currentValue: String(modelCount),
      values: [String(modelCount)],
      description: "Total models registered from Ollama Cloud API",
    },
    {
      id: "endpoint",
      label: "API Endpoint",
      currentValue: OLLAMA_BASE,
      values: [OLLAMA_BASE],
      description: "Ollama Cloud API base URL",
    },
    {
      id: "cache",
      label: "Cache",
      currentValue: cacheInfo.exists ? `Age: ${cacheInfo.age}` : "Not found",
      values: [cacheInfo.exists ? "hit" : "miss"],
      description: cacheInfo.exists
        ? `Cached ${cacheInfo.modelCount} models, ${cacheInfo.size}`
        : "No cache file — models fetched fresh",
    },
    {
      id: "ttl",
      label: "Cache TTL",
      currentValue: "1 hour",
      values: ["1 hour"],
      description: "Cache expires after 1 hour from last refresh",
    },
  ];

  return new SettingsList(
    items,
    Math.min(items.length + 2, 8),
    settingsTheme,
    () => {},
    done,
  );
}

// --- Main menu ---

export function buildMainMenu(
  pi: ExtensionAPI,
  tuiTheme: Theme,
  settingsTheme: ReturnType<typeof getSettingsListTheme>,
  notify: ExtensionCommandContext["ui"]["notify"],
  setWorkingMessage: ExtensionCommandContext["ui"]["setWorkingMessage"],
  done: () => void,
  onRebuild: (comp: Component) => void,
): Component {
  const cacheInfo = getCacheInfo();
  const cached = readCache();
  const modelCount = cached ? cached.models.length : 0;

  const items: SettingItem[] = [
    {
      id: "refresh",
      label: "Refresh Models",
      currentValue: "→",
      values: ["→"],
      description: "Force-fetch model list from the API and update cache",
    },
    {
      id: "status",
      label: "Status",
      currentValue: "submenu",
      description: "View connection info, cache status, and model count",
      submenu: (_currentValue, subDone) =>
        buildStatusSubmenu(settingsTheme, modelCount, () => {
          subDone();
          onRebuild(
            buildMainMenu(pi, tuiTheme, settingsTheme, notify, setWorkingMessage, done, onRebuild),
          );
        }),
    },
    {
      id: "cache_info",
      label: "Cache Info",
      currentValue: cacheInfo.exists ? `${cacheInfo.age} ago` : "Empty",
      values: [cacheInfo.exists ? "hit" : "miss"],
      description: cacheInfo.exists
        ? `${cacheInfo.modelCount} models cached, ${cacheInfo.size}`
        : "No cache — will fetch fresh on next discovery",
    },
  ];

  const container = new Container();
  container.addChild(
    new (class {
      render(_width: number) {
        return [tuiTheme.fg("accent", tuiTheme.bold("Ollama Cloud")), ""];
      }
      invalidate() {}
    })(),
  );

  let currentList: SettingsList;

  function buildList(): SettingsList {
    return new SettingsList(
      items,
      Math.min(items.length + 2, 8),
      settingsTheme,
      async (id) => {
        if (id === "refresh") {
          setWorkingMessage("Refreshing Ollama Cloud models...");
          const result = await discoverModels(pi, { force: true });
          setWorkingMessage();
          if (result.error) {
            notify(`Refresh failed: ${result.error}`, "error");
          } else {
            notify(
              `Registered ${result.count} models${result.failedApi > 0 ? ` (${result.failedApi} from fallback)` : ""}`,
              "info",
            );
          }
          // Rebuild menu to show updated cache info
          onRebuild(
            buildMainMenu(pi, tuiTheme, settingsTheme, notify, setWorkingMessage, done, onRebuild),
          );
        }
      },
      done,
    );
  }

  currentList = buildList();
  container.addChild(currentList);

  return {
    render(width: number) {
      return container.render(width);
    },
    invalidate() {
      container.invalidate();
    },
    handleInput(data: string) {
      currentList.handleInput(data);
    },
  };
}
