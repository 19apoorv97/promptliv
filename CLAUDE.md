# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Setup

```bash
pip install -r requirements.txt
```

API keys go in `.env` (gitignored). Supported keys: `GROQ_API_KEY`, `GOOGLE_API_KEY`. Anthropic and OpenAI keys are read from environment variables `ANTHROPIC_API_KEY` and `OPENAI_API_KEY`.

## Running

```bash
# Interactive mode
python3 prompt_generator.py

# Generate a prompt from a task description
python3 prompt_generator.py generate --provider anthropic --task "Classify support tickets"

# Improve an existing prompt
python3 prompt_generator.py improve --provider openai --prompt "Summarize {{text}}" --feedback "Too verbose"

# Use a local/custom OpenAI-compatible endpoint (e.g. Ollama)
python3 prompt_generator.py generate --provider custom --base-url http://localhost:11434/v1 --model llama3
```

## Architecture

`prompt_generator.py` is the entire application — a single-file CLI tool that replicates Anthropic Console's prompt generation feature.

**Two modes:**
- `generate` — converts a task description into a structured prompt template using a meta-prompt
- `improve` — refines an existing prompt with optional user feedback

**Provider abstraction:** `LLMProvider` (ABC) with two concrete implementations:
- `AnthropicProvider` — uses the Anthropic SDK with streaming and adaptive thinking enabled
- `OpenAICompatibleProvider` — handles OpenAI, Groq, Google Gemini, and custom endpoints via the OpenAI SDK

`build_provider()` is the factory function. `PROVIDERS` dict holds default model/config per provider name.

**Meta-prompts:** `GENERATE_META_PROMPT` and `IMPROVE_META_PROMPT` are the core of the tool. They follow Anthropic's published metaprompt structure and instruct the LLM to produce XML-structured output with `{{double-brace}}` placeholders for template variables.

Both modes stream output in real-time.
