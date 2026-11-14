"""The Jukebox orchestrator's route (G08): one question in, checked sound parameters and time-coded descriptions out.

Every run is billed and there are no accounts, so the route is off unless `JUKEBOX_ENABLED=true` and a key is set, takes a small
body, and is rate limited for the whole server and for each visitor. The graph itself is capped (app/agent/orchestrator.py, RECURSION_LIMIT) and
each run has a time limit. Request bodies are never logged.

The orchestrator is imported on the first request, not when the server starts, so a server with the route switched off loads
neither ADK nor LangGraph.
"""
from __future__ import annotations

import asyncio
import logging
from functools import lru_cache
from typing import Annotated, Any, Literal

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, ValidationError

from app import ratelimit
from app.config import settings
from app.ratelimit import TokenBucket, VisitorBuckets

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/jukebox", tags=["jukebox"])

MAX_BODY_BYTES = 2_000
MAX_QUERY_CHARS = 300


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)


class AccessibilityProfile(_Strict):
    """What the listener needs. Fixed choices only: this goes into the agents' messages."""

    contrast: Literal["low", "normal", "high"] = "normal"
    detail_level: Literal["brief", "standard", "verbose"] = Field(default="standard", alias="detailLevel")


class GenerateIn(_Strict):
    query: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=MAX_QUERY_CHARS)]
    accessibility_profile: AccessibilityProfile = Field(default_factory=AccessibilityProfile, alias="accessibilityProfile")


class GenerateOut(BaseModel):
    #: False when the auditor never approved the payloads, or no data was fetched. `feedback` then says why.
    approved: bool
    feedback: str
    revisions: int
    #: An AudioPayload and a VisionPayload (app/agent/orchestrator.py), already checked there. None when nothing was made.
    audio: dict[str, Any] | None
    vision: dict[str, Any] | None


@lru_cache(maxsize=1)
def _bucket() -> TokenBucket:
    return TokenBucket(settings.jukebox_runs_per_minute)


@lru_cache(maxsize=1)
def _visitors() -> VisitorBuckets:
    return VisitorBuckets(settings.jukebox_runs_per_minute_per_visitor)


@lru_cache(maxsize=1)
def _graph():
    from app.agent.orchestrator import build_graph  # On first use: see the module docstring.

    return build_graph()


@router.post("/generate", response_model=GenerateOut)
async def generate(request: Request) -> GenerateOut:
    if not settings.jukebox_enabled or not settings.gemini_api_key.get_secret_value():
        raise HTTPException(status_code=503, detail="jukebox_not_configured")
    origin = request.headers.get("origin")
    if origin and origin not in settings.cors_origin_list:
        raise HTTPException(status_code=403, detail="origin_not_allowed")
    raw = await request.body()
    if len(raw) > MAX_BODY_BYTES:
        raise HTTPException(status_code=413, detail="body_too_large")
    try:
        body = GenerateIn.model_validate_json(raw)
    except ValidationError as error:
        # Where and what, never the value that was sent.
        detail = error.errors(include_url=False, include_context=False, include_input=False)
        raise HTTPException(status_code=422, detail=detail) from None
    ratelimit.check(request, _bucket(), _visitors())

    state = {"user_query": body.query, "accessibility_profile": body.accessibility_profile.model_dump()}
    try:
        result = await asyncio.wait_for(_graph().ainvoke(state), timeout=settings.jukebox_timeout_seconds)
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="timeout") from None
    except Exception as error:  # noqa: BLE001 - whatever the model, the graph or a frame fetch raised
        logger.warning("Jukebox run failed: %s", type(error).__name__)  # The class only: never the question.
        raise HTTPException(status_code=502, detail="model_error") from None

    feedback = result.get("critic_feedback", "")
    return GenerateOut(
        approved=not feedback,
        feedback=feedback,
        revisions=result.get("revision_count", 0),
        audio=result.get("audio_json_payload") or None,
        vision=result.get("vision_text_payload") or None,
    )
