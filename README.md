# pi-ollama-cloud-provider

Ollama Cloud provider extension for [pi](https://github.com/badlogic/pi-mono) coding agent with dynamic model discovery.

## Features

- Ollama Cloud provider registered with dynamic model discovery (coming soon)
- OpenAI-compatible endpoint via `openai-completions` API
- Capability-aware: reasoning (thinking) and vision detection per model
- Zero-cost tracking: Ollama Cloud uses flat subscription pricing

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

*(Models will be dynamically discovered from the Ollama Cloud API in a future release)*

## Commands

| Command | Description |
|---------|-------------|
| *(coming soon)* | |

## How it Works

*(documented as features are implemented)*

## License

MIT
