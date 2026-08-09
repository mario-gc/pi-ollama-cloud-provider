# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- GitHub Actions CI pipeline — type checking (`tsc --noEmit`), unit tests
  (`node --test`), and package validation (`npm pack --dry-run`) on every push
  to `main` and every pull request
- Unit test suite for discovery, fallback, cache, and thinking-levels logic
  (67 tests, zero dependencies, deterministic — no network calls), and the
  models.dev stale-while-revalidate path (TTL boundary, background refresh
  success/failure, first-run fetch)

### Changed
- Provider compat flags (`supportsDeveloperRole: false`, `supportsReasoningEffort: true`) moved from provider-level to per-model — all registered models now carry the flags, matching documented intent

### Fixed
- Fixed 4 pre-existing TypeScript type errors that prevented `tsc --noEmit` from passing: `compat` on `ProviderConfig` (not a valid provider-level field), `successes.push` type narrowing, `SettingsListTheme`/`Theme` mismatch in refresh submenu
- Startup no longer blocks on a slow or unreachable models.dev when the
  fallback cache is expired — stale cache is served immediately and refreshed
  in the background (stale-while-revalidate), and the cache TTL was raised
  from 24h to 7 days. Thanks to [@pi-dal](https://github.com/pi-dal) for the
  contribution ([#20](https://github.com/mario-gc/pi-ollama-cloud-provider/pull/20)).

## [0.4.0] - 2026-08-06

### Added
- Max thinking level support — models that support `max` reasoning effort
  (e.g., deepseek-v4-pro, minimax-m3, kimi-k3) now show `max` in pi's
  thinking level selector
- Per-model thinking level detection from models.dev `reasoning_options` —
  each model exposes only the thinking levels it actually supports

### Changed
- models.dev is now always fetched at startup (not just as a fallback) to
  obtain per-model thinking level metadata (`reasoning_options`)
- `supportsReasoningEffort` set to `true` — pi now sends `reasoning_effort`
  to Ollama Cloud's OpenAI-compatible endpoint

## [0.3.0] - 2026-06-15

### Changed
- Migrated all package references from `@mariozechner/*` to `@earendil-works/*` scope (pi v0.74.0+)

### Fixed
- Changed apiKey to use $-prefixed env var syntax ("$OLLAMA_CLOUD_API_KEY") to eliminate deprecation warning

## [0.2.0] - 2026-05-05

### Added
- Offline mode (`PI_OFFLINE=1`) — uses cached data only, no network calls
- Cache reads ignore TTL when offline, gracefully handle missing cache
- Offline indicator in `/ollama-cloud` menu header and status view
- "Refresh Models" disabled in menu when offline, shows "Unavailable" instead

### Changed
- Removed release-it and its configuration

### Removed
- GitHub Actions publish workflow (auto-publishing on tag push)

## [0.1.0] - Initial release

### Added
- Dynamic model discovery from Ollama Cloud API (`GET /v1/models` + `POST /api/show`)
- Interactive `/ollama-cloud` management menu with SettingsList TUI
- Refresh Models submenu: choose between Ollama API or models.dev source
- Status submenu with source breakdown (ollama, modelsdev, inference)
- Persistent cache with 1-hour TTL for fast subsequent startups
- Fallback chain: `/api/show` → models.dev API → name-based inference
- Source tracking per model entry in cache
- Capability detection (reasoning/thinking, vision) from `/api/show`
- Accurate context windows and maxTokens from API metadata
- Zero-cost tracking (Ollama Cloud uses flat subscription pricing)
- Initial project scaffold with pi extension entry point
- release-it configuration for automated releases
- GitHub Actions workflow for OIDC npm publishing
