"""Echo's live data (G11): a question in; a reply, a theme and an AudioPayload out, from Microsoft Planetary Computer.

Off unless `MASCOT_ENABLED=true` and a key is set; small body; rate limited for the whole server and for each visitor; time limited.
The reply is built from the fetched numbers (app/agent/planetary.py), never written by the model. The question is never logged.
The agent is imported on the first request, so a server with the route off loads neither ADK nor pystac.
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

router = APIRouter(prefix="/api/v1/mascot", tags=["mascot"])

MAX_BODY_BYTES = 24_000  # 40 entries of an id, a title and a summary
MAX_PROMPT_CHARS = 300  # the same as the browser (src/features/jukebox/mascotQuery.ts)
MAX_CATALOG = 40


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class CatalogEntry(_Strict):
    """One of the app's data sets (public/data/index.json), sent by the browser: the server has no copy."""

    id: Annotated[str, StringConstraints(pattern=r"^[a-z0-9][a-z0-9-]{0,63}$")]
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
    # Sent as in the catalog file; the agent reads only the id and the title.
    summary: Annotated[str, StringConstraints(max_length=400)] = ""


class MascotQuery(_Strict):
    user_prompt: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=MAX_PROMPT_CHARS)]
    audio_preference: Literal["gentle", "normal", "bold"] = "normal"
    catalog: list[CatalogEntry] = Field(default_factory=list, max_length=MAX_CATALOG)


class SeriesOut(BaseModel):
    metric: str  # what the values are, e.g. "Air temperature"
    unit: str  # e.g. "°C"; may be empty
    times: list[str]  # ISO 8601: a day, or an hour in UTC
    values: list[float]


class MascotAnswer(BaseModel):
    mascot_reply: str
    dataset_theme: Literal["ocean", "atmosphere", "forest", "default"]
    #: An AudioPayload (app/agent/orchestrator.py), already checked. None when nothing was found.
    sonification_json: dict[str, Any] | None
    #: One of the catalog ids that were sent, when an app data set answers the question.
    local_dataset_id: str | None
    #: WX02: every value behind the sound, one per step, for the "Show the numbers" table. None when nothing was found.
    series: SeriesOut | None = None


@lru_cache(maxsize=1)
def _bucket() -> TokenBucket:
    return TokenBucket(settings.mascot_runs_per_minute)


@lru_cache(maxsize=1)
def _visitors() -> VisitorBuckets:
    return VisitorBuckets(settings.mascot_runs_per_minute_per_visitor)


@lru_cache(maxsize=1)
def _service():
    from app.agent.models import keyed_model  # On first use: see the module docstring.
    from app.agent.planetary import MascotService

    return MascotService(keyed_model(settings.mascot_model))


@router.post("/query", response_model=MascotAnswer)
async def query(request: Request) -> MascotAnswer:
    if not settings.mascot_enabled or not settings.gemini_api_key.get_secret_value():
        raise HTTPException(status_code=503, detail="mascot_not_configured")
    origin = request.headers.get("origin")
    if origin and origin not in settings.cors_origin_list:
        raise HTTPException(status_code=403, detail="origin_not_allowed")
    raw = await request.body()
    if len(raw) > MAX_BODY_BYTES:
        raise HTTPException(status_code=413, detail="body_too_large")
    try:
        body = MascotQuery.model_validate_json(raw)
    except ValidationError as error:
        # Where and what, never the value that was sent.
        detail = error.errors(include_url=False, include_context=False, include_input=False)
        raise HTTPException(status_code=422, detail=detail) from None
    ratelimit.check(request, _bucket(), _visitors())

    catalog = [entry.model_dump() for entry in body.catalog]
    try:
        answer = await asyncio.wait_for(
            _service().query(body.user_prompt, body.audio_preference, catalog), timeout=settings.mascot_timeout_seconds
        )
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="timeout") from None
    except Exception as error:  # noqa: BLE001 - whatever the model or the runner raised
        logger.warning("Mascot query failed: %s", type(error).__name__)  # The class only: never the question.
        raise HTTPException(status_code=502, detail="model_error") from None
    return MascotAnswer(**answer)
