# pi-ollama-cloud-provider

Ollama Cloud provider extension for [pi](https://github.com/badlogic/pi-mono) coding agent with dynamic model discovery.

## Features

- **Dynamic model discovery** — fetches all available Ollama Cloud models at startup
- **Persistent cache** — model details cached for 1 hour for instant subsequent startups
- **Capability detection** — reasoning (thinking) and vision support from `/api/show`
- **Accurate context windows** — extracted from model metadata, not hardcoded
- OpenAI-compatible endpoint via `openai-completions` API
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

Models are fetched dynamically from the Ollama Cloud API at startup.
All available models are registered with accurate context windows and
capability detection (reasoning, vision).

Run `pi --list-models | grep ollama-cloud` to see the full list.

## Commands

| Command | Description |
|---------|-------------|
| `/ollama-cloud` | Interactive menu: refresh models, view status, cache info |

## How it Works

On first startup, the extension fetches the full model list from Ollama Cloud
and queries `/api/show` for each model to determine capabilities and context length.
Results are cached at `~/.pi/agent/cache/ollama-cloud/models.json` with a 1-hour TTL.

Subsequent startups within the TTL window use the cached data for instant registration.
When the cache expires, a fresh fetch is performed automatically.

## License

MIT
