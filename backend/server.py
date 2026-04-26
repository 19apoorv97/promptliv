import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Load .env from the project root
from pathlib import Path
_env_path = Path(__file__).parent.parent / ".env"
if _env_path.exists():
    with open(_env_path) as _f:
        for _line in _f:
            _line = _line.strip()
            if _line and not _line.startswith("#") and "=" in _line:
                _k, _, _v = _line.partition("=")
                os.environ.setdefault(_k.strip(), _v.strip())

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

from prompt_generator import PROVIDERS, build_provider, run_generate, run_improve, get_clarifying_questions

app = FastAPI(title="Prompt Generator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ClarifyRequest(BaseModel):
    provider: str
    model: Optional[str] = None
    task_or_prompt: str
    mode: str  # "generate" or "improve"
    base_url: Optional[str] = None


class GenerateRequest(BaseModel):
    provider: str
    model: Optional[str] = None
    task: str
    context: Optional[str] = ""
    base_url: Optional[str] = None


class ImproveRequest(BaseModel):
    provider: str
    model: Optional[str] = None
    prompt: str
    feedback: Optional[str] = ""
    context: Optional[str] = ""
    base_url: Optional[str] = None


def _resolve(provider_key: str, model_override: Optional[str], base_url: Optional[str]):
    if provider_key not in PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Unknown provider: {provider_key}")

    cfg = PROVIDERS[provider_key]
    env_key = cfg["env_key"]

    if not os.environ.get(env_key):
        raise HTTPException(
            status_code=400,
            detail=f"API key not set. Please set the {env_key} environment variable.",
        )

    if provider_key == "custom" and not base_url:
        raise HTTPException(
            status_code=400,
            detail="base_url is required for the custom provider.",
        )

    model = model_override or cfg.get("default_model", "")
    if not model:
        raise HTTPException(
            status_code=400,
            detail="No model specified and provider has no default model.",
        )

    provider_instance, _ = build_provider(provider_key, base_url)
    return provider_instance, model


@app.get("/api/providers")
def get_providers():
    return PROVIDERS


@app.post("/api/clarify")
def clarify(req: ClarifyRequest):
    try:
        provider_instance, model = _resolve(req.provider, req.model, req.base_url)
        questions = get_clarifying_questions(provider_instance, model, req.task_or_prompt, req.mode)
        return {"questions": questions}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/generate")
def generate(req: GenerateRequest):
    try:
        provider_instance, model = _resolve(req.provider, req.model, req.base_url)
        result = run_generate(provider_instance, model, req.task, context=req.context or "", silent=True)
        return {"result": result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/improve")
def improve(req: ImproveRequest):
    try:
        provider_instance, model = _resolve(req.provider, req.model, req.base_url)
        result = run_improve(provider_instance, model, req.prompt, req.feedback or "", context=req.context or "", silent=True)
        return {"result": result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
