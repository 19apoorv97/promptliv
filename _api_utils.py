"""Shared utilities for Vercel Python serverless handlers.
Callers must insert the project root and this directory into sys.path first.
"""
import json
import os
from http.server import BaseHTTPRequestHandler

from prompt_generator import PROVIDERS, AnthropicProvider, OpenAICompatibleProvider


def resolve_provider(body: dict):
    """Return (provider_instance, model) from a parsed request body."""
    byok_key = body.get("byok_key")
    byok_provider = body.get("byok_provider")
    provider_key = (byok_provider if byok_key else None) or body.get("provider", "groq")
    model = body.get("model") or ""
    base_url = body.get("base_url")

    cfg = PROVIDERS.get(provider_key, {})
    if not model:
        model = cfg.get("default_model", "")
    if not model:
        raise ValueError("No model specified and provider has no default model.")

    if byok_key:
        if provider_key == "anthropic":
            return AnthropicProvider(byok_key), model
        url = base_url or cfg.get("base_url")
        return OpenAICompatibleProvider(byok_key, url), model

    env_key = cfg.get("env_key", "")
    api_key = os.environ.get(env_key, "")
    if not api_key:
        raise ValueError(f"API key not configured. Set {env_key} in environment.")
    if provider_key == "anthropic":
        return AnthropicProvider(api_key), model
    url = base_url or cfg.get("base_url")
    return OpenAICompatibleProvider(api_key, url), model


class BaseHandler(BaseHTTPRequestHandler):
    def _json(self, status: int, data: dict):
        payload = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def _read_body(self) -> dict:
        length = int(self.headers.get("Content-Length", 0))
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def log_message(self, fmt, *args):
        pass
