"""Listening-test endpoints (docs/PLAN.md §5.5).

Nothing identifying is stored, and request bodies are never logged. Comments are free text from a
participant, so the CSV export neutralises spreadsheet formulas.
"""
from __future__ import annotations

import csv
import hmac
import io
from typing import Annotated, Literal

from fastapi import APIRouter, Header, HTTPException, Response
from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictInt, StringConstraints, field_validator

from app.config import settings
from app.study import db

router = APIRouter(prefix="/api/v1/tests", tags=["study"])


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)


class SessionIn(_Strict):
    participant: Literal["sighted", "blind_low_vision", "not_said"]
    screen_reader: StrictBool = Field(alias="screenReader")
    saw_images: StrictBool = Field(alias="sawImages")
    consent: StrictBool

    @field_validator("consent")
    @classmethod
    def _must_consent(cls, value: bool) -> bool:
        if not value:
            raise ValueError("consent must be given before the test starts")
        return value


class SessionOut(BaseModel):
    id: str


class ResponseIn(_Strict):
    comparison_id: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100, pattern=r"^[A-Za-z0-9._-]+$")] = Field(alias="comparisonId")
    answer: Literal["a", "b", "same"]
    correct: StrictBool
    response_ms: StrictInt = Field(alias="responseMs", ge=0, le=3_600_000)
    confidence: StrictInt | None = Field(default=None, ge=1, le=5)
    comment: Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)] | None = None


@router.post("", response_model=SessionOut, status_code=201)
def create_test(body: SessionIn) -> SessionOut:
    return SessionOut(id=db.create_session(body.participant, body.screen_reader, body.saw_images))


@router.post("/{session_id}/responses", status_code=204)
def add_response(session_id: str, body: ResponseIn) -> Response:
    try:
        db.add_response(session_id, body.comparison_id, body.answer, body.correct, body.response_ms, body.confidence, body.comment or None)
    except db.SessionNotFound:
        raise HTTPException(404, "No such test session.") from None
    except db.SessionFull:
        raise HTTPException(409, f"A session holds at most {settings.study_max_responses} answers.") from None
    return Response(status_code=204)


def _safe_cell(value: object) -> object:
    """A cell that starts with = + - @ (or a tab/CR) would run as a formula in a spreadsheet."""
    if isinstance(value, str) and value[:1] in ("=", "+", "-", "@", "\t", "\r"):
        return "'" + value
    return "" if value is None else value


@router.get("/export.csv")
def export_csv(x_team_token: Annotated[str | None, Header()] = None) -> Response:
    expected = settings.study_export_token.get_secret_value()
    # An unset token disables the export; an empty header must never match an empty setting.
    if not expected or not x_team_token or not hmac.compare_digest(x_team_token.encode(), expected.encode()):
        raise HTTPException(403, "Missing or wrong team token.")
    out = io.StringIO()
    writer = csv.writer(out, lineterminator="\n")
    writer.writerow(db.EXPORT_COLUMNS)
    for row in db.export_rows():
        writer.writerow([_safe_cell(cell) for cell in row])
    return Response(out.getvalue(), media_type="text/csv", headers={"Content-Disposition": 'attachment; filename="listening-test.csv"'})
