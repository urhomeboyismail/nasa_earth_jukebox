"""Echo's weather (WX01): hourly air temperature 2 m above the ground at one point, from the Meteomatics API.

The client only: arguments checked, one GET with HTTP Basic auth, the JSON checked. The ADK tool that uses it is in
app/agent/planetary.py. Nothing the API sends is shown as text; only its numbers are used.

Manual check against the live API (needs METEOMATICS_USERNAME and METEOMATICS_PASSWORD): `.venv/bin/python -m app.agent.weather`.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import httpx
from pydantic import BaseModel, Field

from app.config import settings

API_URL = "https://api.meteomatics.com"
PARAMETER = "t_2m:C"
#: The longest series: a week of hours.
MAX_HOURS = 168
TIMEOUT_SECONDS = 15.0
#: Meteomatics' value for "no data".
NO_VALUE = -999.0

Point = tuple[datetime, float]


class _Value(BaseModel):
    date: datetime
    value: float | None


class _Coordinates(BaseModel):
    dates: list[_Value]


class _Parameter(BaseModel):
    coordinates: list[_Coordinates] = Field(min_length=1)


class _Response(BaseModel):
    data: list[_Parameter] = Field(min_length=1)


def configured() -> bool:
    return bool(settings.meteomatics_username and settings.meteomatics_password.get_secret_value())


def _number(value: object) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def checked_args(latitude: object, longitude: object, start: object, hours: object) -> tuple[float, float, datetime, int] | dict:
    """The point, the first hour (UTC) and the number of hours, or the error dict to hand back to the model."""
    if not (_number(latitude) and _number(longitude) and -90 <= latitude <= 90 and -180 <= longitude <= 180):
        return {"error": "latitude must be -90 to 90 and longitude -180 to 180, in decimal degrees."}
    if not isinstance(hours, int) or isinstance(hours, bool) or not 1 <= hours <= MAX_HOURS:
        return {"error": f"hours must be a whole number from 1 to {MAX_HOURS}."}
    try:
        first = datetime.fromisoformat(str(start).strip())
    except ValueError:
        return {"error": "start must be an ISO 8601 time in UTC, like 2026-11-14T00:00:00Z."}
    first = (first.replace(tzinfo=timezone.utc) if first.tzinfo is None else first.astimezone(timezone.utc)).replace(
        minute=0, second=0, microsecond=0
    )
    return round(float(latitude), 4), round(float(longitude), 4), first, hours


def url_for(latitude: float, longitude: float, first: datetime, hours: int) -> str:
    last = first + timedelta(hours=hours - 1)
    span = f"{first:%Y-%m-%dT%H:%M:%SZ}--{last:%Y-%m-%dT%H:%M:%SZ}:PT1H"
    return f"{API_URL}/{span}/{PARAMETER}/{latitude},{longitude}/json"


def parse(body: bytes) -> list[Point]:
    """The hourly values, oldest first, without Meteomatics' "no data". Raises pydantic.ValidationError on another shape."""
    dates = _Response.model_validate_json(body).data[0].coordinates[0].dates
    return [(entry.date, entry.value) for entry in dates if entry.value is not None and entry.value != NO_VALUE]


def summary(points: list[Point]) -> str:
    """One sentence for the voice guide to read out, built from the values only. `points` must not be empty."""
    values = [value for _, value in points]
    low, high = values.index(min(values)), values.index(max(values))
    at = lambda index: f"{points[index][0]:%H:%M} UTC"  # noqa: E731 - three uses in one sentence
    return (
        f"Air temperature for the next {len(points)} hours: now {values[0]:g} °C, lowest {values[low]:g} °C at {at(low)}, "
        f"highest {values[high]:g} °C at {at(high)}."
    )


async def hourly_temperature(
    latitude: float, longitude: float, first: datetime, hours: int, transport: httpx.AsyncBaseTransport | None = None
) -> list[Point]:
    """Raises httpx.HTTPError when Meteomatics refuses or does not answer. `transport` is for tests."""
    auth = (settings.meteomatics_username, settings.meteomatics_password.get_secret_value())
    async with httpx.AsyncClient(auth=auth, timeout=TIMEOUT_SECONDS, transport=transport) as client:
        response = await client.get(url_for(latitude, longitude, first, hours))
        response.raise_for_status()
    return parse(response.content)


if __name__ == "__main__":
    import asyncio

    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    for when, value in asyncio.run(hourly_temperature(-20.1609, 57.5012, now, 24)):  # Port Louis, the next 24 hours
        print(f"{when:%Y-%m-%d %H:%M}Z  {value:g} °C")
