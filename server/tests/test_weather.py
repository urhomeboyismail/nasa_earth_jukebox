"""WX01: Echo's weather from Meteomatics. No login, no network: httpx.MockTransport and FakeLlm."""

import asyncio
import base64
import json
from datetime import date, datetime, timezone

import httpx
import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr, ValidationError

from app.agent import planetary, weather
from app.agent.fake import FakeLlm, FunctionCallSpec, tool_then_text
from app.api import mascot as mascot_api
from app.config import settings
from app.main import app

START = datetime(2026, 11, 14, tzinfo=timezone.utc)


def _body(values, parameter="t_2m:C"):
    dates = [{"date": f"2026-11-14T{hour:02d}:00:00Z", "value": value} for hour, value in enumerate(values)]
    return json.dumps(
        {"version": "3.0", "status": "OK", "data": [{"parameter": parameter, "coordinates": [{"lat": -20.16, "lon": 57.5, "dates": dates}]}]}
    ).encode()


@pytest.fixture
def login(monkeypatch):
    monkeypatch.setattr(settings, "meteomatics_username", "echo")
    monkeypatch.setattr(settings, "meteomatics_password", SecretStr("not-a-real-password"))


# --- The client --------------------------------------------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("latitude", "longitude", "start", "hours"),
    [
        (91, 57.5, "2026-11-14T00:00:00Z", 24),  # off the globe
        (-20, 181, "2026-11-14T00:00:00Z", 24),
        ("-20", 57.5, "2026-11-14T00:00:00Z", 24),  # a string
        (True, 57.5, "2026-11-14T00:00:00Z", 24),  # a bool is not a number
        (-20, 57.5, "today", 24),  # not a time
        (-20, 57.5, "2026-11-14T00:00:00Z", 0),
        (-20, 57.5, "2026-11-14T00:00:00Z", weather.MAX_HOURS + 1),
        (-20, 57.5, "2026-11-14T00:00:00Z", 2.5),
    ],
)
def test_bad_arguments_are_errors_for_the_model(latitude, longitude, start, hours):
    assert "error" in weather.checked_args(latitude, longitude, start, hours)


def test_good_arguments_are_utc_whole_hours():
    assert weather.checked_args(-20.16093, 57.50123, "2026-11-14T04:30:00+04:00", 24) == (-20.1609, 57.5012, START, 24)
    assert weather.checked_args(0, 0, "2026-11-14T00:00:00", 1)[2] == START  # no zone is read as UTC


def test_url():
    assert weather.url_for(-20.1609, 57.5012, START, 24) == (
        "https://api.meteomatics.com/2026-11-14T00:00:00Z--2026-11-14T23:00:00Z:PT1H/t_2m:C/-20.1609,57.5012/json"
    )


def test_parse_drops_no_value_and_rejects_another_shape():
    assert weather.parse(_body([21.5, -999, None, 23.0])) == [
        (START, 21.5),
        (datetime(2026, 11, 14, 3, tzinfo=timezone.utc), 23.0),
    ]
    with pytest.raises(ValidationError):
        weather.parse(b'{"data": []}')


def test_fetch_sends_the_login(login):
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"], seen["auth"] = str(request.url), request.headers["authorization"]
        return httpx.Response(200, content=_body([20.0, 22.0]))

    points = asyncio.run(weather.hourly_temperature(-20.1609, 57.5012, START, 2, transport=httpx.MockTransport(handler)))
    assert [value for _, value in points] == [20.0, 22.0]
    assert seen["url"].endswith("/t_2m:C/-20.1609,57.5012/json")
    assert seen["auth"] == "Basic " + base64.b64encode(b"echo:not-a-real-password").decode()


# --- The reply ---------------------------------------------------------------------------------------------------------------


def test_reply_for_hours_of_weather():
    points = [(datetime(2026, 11, 14, hour, tzinfo=timezone.utc), value) for hour, value in ((0, 21.0), (13, 27.5), (23, 22.0))]
    answer = planetary.answer_for({planetary.SERIES_KEY: planetary.series_of(planetary.WEATHER_SOURCE, points)}, "normal", [])
    assert answer["mascot_reply"] == (
        "I found 3 hours of air temperature between 14 November 2026 at 00:00 UTC and 14 November 2026 at 23:00 UTC. "
        "Air temperature went from 21 °C to 27.5 °C, highest on 14 November 2026 at 13:00 UTC. Press Play to hear it."
    )
    assert answer["dataset_theme"] == "atmosphere"
    assert answer["sonification_json"]["tracks"][0]["volume_curve"] == [0.15, 1.0, 0.2808]


def test_days_still_read_as_days():
    assert planetary._when(date(2026, 10, 1).isoformat()) == "1 October 2026"


def test_weather_is_not_a_planetary_computer_collection():
    assert "error" in planetary.checked_args(planetary.WEATHER_SOURCE, [46, -19, 47, -18], "2026-10-01/2026-10-31")


# --- The route ---------------------------------------------------------------------------------------------------------------


def _weather_call(**changes):
    return FunctionCallSpec("fetch_weather", {"latitude": -20.16, "longitude": 57.5, "start": "2026-11-14T00:00:00Z", "hours": 24, **changes})


@pytest.fixture
def client(monkeypatch):
    """The route switched on, with a model key that is never used, full buckets and no network."""
    monkeypatch.setattr(settings, "mascot_enabled", True)
    monkeypatch.setattr(settings, "gemini_api_key", SecretStr("not-a-real-key"))
    monkeypatch.setattr(settings, "mascot_runs_per_minute", 100)
    monkeypatch.setattr(settings, "mascot_runs_per_minute_per_visitor", 100)
    mascot_api._bucket.cache_clear()
    mascot_api._visitors.cache_clear()
    yield TestClient(app)
    mascot_api._bucket.cache_clear()
    mascot_api._visitors.cache_clear()


def _ask(client, monkeypatch, call):
    service = planetary.MascotService(FakeLlm(script=tool_then_text(call, "done")))
    monkeypatch.setattr(mascot_api, "_service", lambda: service)
    response = client.post("/api/v1/mascot/query", json={"user_prompt": "The weather in Port Louis today"})
    assert response.status_code == 200
    return response.json()


def test_weather_gives_a_reply_and_a_payload(client, monkeypatch, login):
    seen = {}

    async def fetch(*args):
        seen["args"] = args
        return [(datetime(2026, 11, 14, hour, tzinfo=timezone.utc), 20.0 + hour) for hour in range(24)]

    monkeypatch.setattr(weather, "hourly_temperature", fetch)
    body = _ask(client, monkeypatch, _weather_call())
    assert body["mascot_reply"].startswith("I found 24 hours of air temperature")
    assert "from 20 °C to 43 °C" in body["mascot_reply"]
    assert len(body["sonification_json"]["tracks"][0]["volume_curve"]) == 24
    assert seen["args"] == (-20.16, 57.5, START, 24)


def test_no_login_is_an_answer(client, monkeypatch):
    monkeypatch.setattr(settings, "meteomatics_username", "")
    monkeypatch.setattr(weather, "hourly_temperature", lambda *args: pytest.fail("no fetch expected"))
    body = _ask(client, monkeypatch, _weather_call())
    assert body["mascot_reply"] == planetary.WEATHER_REPLIES["off"]
    assert body["sonification_json"] is None


@pytest.mark.parametrize("status", [401, 403, 500])
def test_meteomatics_refusing_is_an_answer(client, monkeypatch, login, status, caplog):
    real = weather.hourly_temperature
    transport = httpx.MockTransport(lambda request: httpx.Response(status, text="Unauthorized"))
    monkeypatch.setattr(weather, "hourly_temperature", lambda *args: real(*args, transport=transport))
    body = _ask(client, monkeypatch, _weather_call())
    assert body["mascot_reply"] == planetary.WEATHER_REPLIES["down"]
    assert "not-a-real-password" not in caplog.text and "57.5" not in caplog.text


# --- WX04: the voice guide's get_weather -------------------------------------------------------------------------------------

from types import SimpleNamespace  # noqa: E402 - kept with the WX04 tests

from app.agent import tools as agent_tools  # noqa: E402


def _voice_context():
    """Stands in for ADK's ToolContext, as in test_agent_core.py."""
    return SimpleNamespace(state={"page": "home", "language": "en", "screens": {}}, session=SimpleNamespace(id="s1"))


def _hours(*values):
    return [(datetime(2026, 11, 14, hour, tzinfo=timezone.utc), value) for hour, value in enumerate(values)]


def test_summary_reads_now_lowest_and_highest():
    assert weather.summary(_hours(25.0, 23.2, 31.6)) == (
        "Air temperature for the next 3 hours: now 25 °C, lowest 23.2 °C at 01:00 UTC, highest 31.6 °C at 02:00 UTC."
    )


def test_voice_weather_gives_the_summary_and_every_hour(monkeypatch, login):
    seen = {}

    async def fetch(*args):
        seen["args"] = args
        return _hours(25.0, 23.2, 31.6)

    monkeypatch.setattr(weather, "hourly_temperature", fetch)
    result = asyncio.run(agent_tools.get_weather(-20.16, 57.5, tool_context=_voice_context(), hours=3))
    assert result["summary"].startswith("Air temperature for the next 3 hours: now 25 °C")
    assert result["hourly"][2] == ["2026-11-14 02:00 UTC", 31.6]
    latitude, longitude, first, hours = seen["args"]
    assert (latitude, longitude, hours) == (-20.16, 57.5, 3) and first.tzinfo is not None and first.minute == 0


@pytest.mark.parametrize(("latitude", "hours"), [(95, 24), (-20, 0), (-20, 500)])
def test_voice_weather_bad_arguments_fetch_nothing(monkeypatch, login, latitude, hours):
    monkeypatch.setattr(weather, "hourly_temperature", lambda *args: pytest.fail("no fetch expected"))
    assert "error" in asyncio.run(agent_tools.get_weather(latitude, 57.5, tool_context=_voice_context(), hours=hours))


def test_voice_weather_without_a_login(monkeypatch):
    monkeypatch.setattr(settings, "meteomatics_username", "")
    monkeypatch.setattr(weather, "hourly_temperature", lambda *args: pytest.fail("no fetch expected"))
    result = asyncio.run(agent_tools.get_weather(-20.16, 57.5, tool_context=_voice_context()))
    assert "not set up" in result["error"]


def test_voice_weather_down_is_an_error_for_the_model(monkeypatch, login, caplog):
    real = weather.hourly_temperature
    transport = httpx.MockTransport(lambda request: httpx.Response(401, text="Unauthorized"))
    monkeypatch.setattr(weather, "hourly_temperature", lambda *args: real(*args, transport=transport))
    result = asyncio.run(agent_tools.get_weather(-20.16, 57.5, tool_context=_voice_context()))
    assert "did not answer" in result["error"]
    assert "401" in caplog.text and "57.5" not in caplog.text and "not-a-real-password" not in caplog.text


def test_voice_weather_is_capped_for_each_session(monkeypatch, login):
    calls = []

    async def fetch(*args):
        calls.append(args)
        return _hours(20.0)

    monkeypatch.setattr(weather, "hourly_temperature", fetch)
    context = _voice_context()
    results = [asyncio.run(agent_tools.get_weather(-20.16, 57.5, tool_context=context)) for _ in range(agent_tools.MAX_WEATHER_CALLS + 1)]
    assert len(calls) == agent_tools.MAX_WEATHER_CALLS
    assert "summary" in results[0] and "error" in results[-1]


def test_the_weather_line_follows_the_rules_it_relaxes():
    from app.assistant.knowledge import system_instruction

    instruction = system_instruction("Earth Jukebox", "en", "home", page_label="{page_title}") + agent_tools.WEATHER_INSTRUCTION
    assert instruction.index("Never invent temperatures") < instruction.index("get_weather")
