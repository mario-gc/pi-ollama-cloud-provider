# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

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
- GitHub Actions workflow for OIDC npm publishing
- release-it configuration for automated releases

## [0.1.0] - Initial release

- Initial project scaffold with pi extension entry point
- package.json with pi manifest and release-it configuration
- GitHub Actions workflow for npm publishing (OIDC trusted publishing)
