"""Grounded Ask (G02): a question and the browser's facts in, fact IDs out. The response has no text field, on purpose.

Off unless `AGENT_ENABLED=true` and a key is set; small body; rate limited for the whole server; time limited. The question and
the facts are never logged. The agent is imported on the first request, so a server with the route off loads no ADK.
"""
from __future__ import annotations

import asyncio
import logging
from functools import lru_cache
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, ValidationError, field_validator, model_validator

from app.assistant.tools import _ISO_DATE, _is_real_date
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/agent", tags=["agent"])

# Ten facts of up to 400 characters do not fit the brief's 2000 bytes, so the whole body may be 8 000 bytes.
MAX_BODY_BYTES = 8_000
MAX_QUESTION_CHARS = 200  # the same as the browser (src/features/ask/ask.ts)


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class AskFact(_Strict):
    # The browser's fixed IDs (src/features/ask/facts.ts). The server accepts exactly this set.
    id: Literal["F-dates", "F-first", "F-last", "F-lowest", "F-highest", "F-change", "F-missing", "F-region", "F-source", "F-method"]
    kind: Literal["data", "text"]
    text: str = Field(min_length=1, max_length=400)


class AskRequest(_Strict):
    question: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=MAX_QUESTION_CHARS)]
    facts: list[AskFact] = Field(min_length=1, max_length=10)
    knownDates: list[str] = Field(max_length=400)

    @model_validator(mode="after")
    def _unique_ids(self):
        ids = [fact.id for fact in self.facts]
        if len(set(ids)) != len(ids):
            raise ValueError("fact ids must be unique")
        return self

    @field_validator("knownDates")
    @classmethod
    def _real_dates(cls, dates: list[str]) -> list[str]:
        for day in dates:
            if not _ISO_DATE.match(day) or not _is_real_date(day):
                raise ValueError("dates must be YYYY-MM-DD")
        return dates


class AskAction(BaseModel):
    kind: Literal["navigate", "set_date"]
    page: Literal["home", "learn", "listen", "compare", "about"] | None = None
    date: str | None = None


class AskResponse(BaseModel):
    factIds: list[str]
    confidence: Literal["high", "medium", "low", "none"]
    action: AskAction | None = None


@lru_cache(maxsize=1)
def _bucket():
    from app.agent.bucket import TokenBucket  # Lazy too: even importing app.agent counts as loading the agent package.

    return TokenBucket(settings.agent_max_requests_per_minute)


@lru_cache(maxsize=1)
def _service():
    from app.agent.ask import AskService  # On first use: see the module docstring.
    from app.agent.models import keyed_model

    return AskService(keyed_model(settings.agent_model))


def agent_ready() -> bool:
    return settings.agent_enabled and bool(settings.gemini_api_key.get_secret_value())


@router.post("/ask", response_model=AskResponse)
async def ask(request: Request) -> AskResponse:
    if not agent_ready():
        raise HTTPException(status_code=503, detail="agent_not_configured")
    raw = await request.body()
    if len(raw) > MAX_BODY_BYTES:
        raise HTTPException(status_code=413, detail="body_too_large")
    try:
        body = AskRequest.model_validate_json(raw)
    except ValidationError as error:
        # Where and what, never the value that was sent.
        detail = error.errors(include_url=False, include_context=False, include_input=False)
        raise HTTPException(status_code=422, detail=detail) from None
    if not _bucket().take():
        raise HTTPException(status_code=429, detail="rate_limited")

    facts = [fact.model_dump() for fact in body.facts]
    try:
        chosen = await asyncio.wait_for(
            _service().select(body.question, facts, body.knownDates), timeout=settings.agent_timeout_seconds
        )
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="timeout") from None
    except Exception as error:  # noqa: BLE001 - whatever the model or the runner raised
        logger.warning("Ask failed: %s", type(error).__name__)  # The class only: never the question or the facts.
        raise HTTPException(status_code=502, detail="model_error") from None

    confident = chosen["confidence"] in ("high", "medium")
    return AskResponse(
        factIds=chosen["fact_ids"] if confident else [],
        confidence=chosen["confidence"],
        action=AskAction(**chosen["action"]) if chosen["action"] else None,
    )
