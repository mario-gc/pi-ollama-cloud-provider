# pi-ollama-cloud-provider

Ollama Cloud provider extension for [pi](https://github.com/badlogic/pi-mono) coding agent with dynamic model discovery.

[![npm version](https://img.shields.io/npm/v/pi-ollama-cloud-provider.svg)](https://www.npmjs.com/package/pi-ollama-cloud-provider)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- **8 curated models** from Ollama Cloud, registered as a pi provider
- **Capability-aware**: reasoning (thinking) and vision detection per model
- **Zero-cost tracking**: Ollama Cloud uses flat subscription pricing
- **OpenAI-compatible** endpoint via `openai-completions` API

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
2. Set it as `OLLAMA_CLOUD_API_KEY` or add to `~/.pi/agent/auth.json`:
   ```json
   { "ollama-cloud": { "type": "api_key", "key": "your-key" } }
   ```
3. Use `/model` or `Ctrl+P` to select an Ollama Cloud model

## Available Models

| Model | Reasoning | Vision | Context |
|-------|-----------|--------|---------|
| GLM 5.1 | ✅ | — | 202K |
| Qwen3.5 397B | ✅ | ✅ | 262K |
| DeepSeek V4 Pro | ✅ | — | 1M |
| DeepSeek V4 Flash | ✅ | — | 1M |
| Kimi K2.6 | ✅ | ✅ | 262K |
| GPT OSS 120B | ✅ | — | 131K |
| Gemma 3 4B | — | ✅ | 131K |
| MiniMax M2.7 | ✅ | — | 196K |

## Commands

| Command | Description |
|---------|-------------|
| *(coming soon)* | |

## How it Works

*(documented as features are implemented)*

## License

MIT
