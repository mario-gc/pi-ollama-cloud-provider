# pi-ollama-cloud-provider

Ollama Cloud provider extension for [pi](https://github.com/badlogic/pi-mono) coding agent with dynamic model discovery.

> **Status:** Work in progress

## Features

- Dynamic model discovery from Ollama Cloud API
- Persistent cache for fast startup
- Capability detection (reasoning, vision, tools)

## Installation

```bash
# npm (recommended)
pi install npm:pi-ollama-cloud-provider

# git (bleeding edge)
pi install git:github.com/mario-gc/pi-ollama-cloud-provider

# local path (development)
pi install /path/to/pi-ollama-cloud-provider
```

## Quick Start

1. Get an API key from [ollama.com](https://ollama.com)
2. Set it as `OLLAMA_CLOUD_API_KEY` or add to `~/.pi/agent/auth.json`
3. Use `/model` to select an Ollama Cloud model

## Commands

| Command | Description |
|---------|-------------|
| *(coming soon)* | |

## How it Works

*(documented as features are implemented)*

## License

MIT
