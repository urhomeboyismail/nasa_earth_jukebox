"""The voice guide (Google ADK, G04/G05): `run_tool` unit tests, the browser protocol and the persona and page drift checks.
A fake live session replaces `connect_adk`, so no network and no key are used."""
import asyncio
import contextlib
import logging
import re
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr

from app.agent.callbacks import PLAYER_TOOLS
from app.agent.limits import MAX_AUDIO_FRAME_BYTES
from app.agent.sink import sink
from app.agent.tools import AGENT_TOOLS
from app.api import assistant as assistant_api
from app.assistant.knowledge import PAGE_IDS, PAGES, system_instruction
from app.assistant.tools import COMPASS_PLACES, PLAYBACK_COMMANDS, SessionState, run_tool
from app.config import settings
from app.main import app

ORIGIN = {"origin": "http://localhost:5173"}
LIVE = "/api/v1/assistant/live"
REPO_ROOT = Path(__file__).resolve().parents[2]
AUDIO = b"\x01\x00" * 10
END = object()


def _event(*, audio=None, user_text=None, text=None, finished=False, interrupted=False, turn_complete=False):
    parts = [SimpleNamespace(inline_data=SimpleNamespace(data=audio))] if audio else []
    transcribe = lambda value: SimpleNamespace(text=value, finished=finished) if value is not None else None  # noqa: E731
    return SimpleNamespace(
        content=SimpleNamespace(parts=parts) if parts else None,
        input_transcription=transcribe(user_text), output_transcription=transcribe(text),
        interrupted=interrupted, turn_complete=turn_complete,
    )


class FakeLiveSession:
    """Stands in for `connect_adk`'s session. A text turn runs a tool the way the agent would, then yields the model's events."""

    def __init__(self, page="home", language="en"):
        self.session_id = "fake-session"
        self.state = {"page": page, "page_title": PAGES[page]["title"], "language": language, "screens": {}}
        self.call = ("navigate_to", {"page": "listen"})
        self.audio_frames: list[bytes] = []
        self.texts: list[str] = []
        self.audio_ends = 0
        self.closed = False
        self.fail: Exception | None = None
        self.hang = False
        self.scripted: list[object] = []  # events to yield for the next text turn instead of the default flow
        self._queue: asyncio.Queue | None = None

    def _q(self) -> asyncio.Queue:
        if self._queue is None:
            self._queue = asyncio.Queue()
        return self._queue

    async def events(self):
        if self.fail:
            raise self.fail
        while not self.hang:
            item = await self._q().get()
            if item is END:
                return
            yield item
        await asyncio.sleep(3600)

    async def send_audio(self, pcm):
        self.audio_frames.append(pcm)

    async def send_text(self, text):
        self.texts.append(text)
        if text.startswith("[App update"):
            return
        if self.scripted:
            for item in self.scripted:
                await self._q().put(item)
            return
        name, args = self.call
        result = run_tool(name, args, SessionState(page=self.state["page"], language="en", screens=self.state["screens"]))
        # The guard refuses a player tool off the Listen page, so no action is produced.
        if result.client_action and not (name in PLAYER_TOOLS and self.state["page"] != "listen"):
            sink.put(self.session_id, result.client_action)
            if result.client_action.get("action") == "navigate":
                self.state["page"] = result.client_action["page"]
        await self._q().put(_event())  # the function-call event: the action is queued by now, but nothing is said yet
        await self._q().put(_event(audio=AUDIO, text="Here you are."))
        await self._q().put(_event(turn_complete=True))

    async def audio_end(self):
        self.audio_ends += 1

    def close(self):
        self.closed = True
        self._q().put_nowait(END)


@pytest.fixture
def live(monkeypatch):
    session = FakeLiveSession()

    @contextlib.asynccontextmanager
    async def connect(language, page):
        session.state.update(page=page, page_title=PAGES[page]["title"], language=language)
        sink.open(session.session_id)
        try:
            yield session
        finally:
            session.close()
            sink.close(session.session_id)

    monkeypatch.setattr(settings, "gemini_api_key", SecretStr("test-key"))
    monkeypatch.setattr(assistant_api, "connect_adk", connect)
    return session


def _open(ws, page="home"):
    ws.send_json({"type": "start", "language": "en", "page": page})
    assert ws.receive_json() == {"type": "ready"}


# ---- run_tool: the one place that checks page names, playback commands and dates ----

def test_tools_only_navigate_or_read():
    home = SessionState(page="home")
    assert run_tool("navigate_to", {"page": "listen"}, home).client_action == {"action": "navigate", "page": "listen"}
    assert "error" in run_tool("navigate_to", {"page": "admin"}, home).response
    assert run_tool("explain_section", {"page": "learn"}, home).client_action is None
    assert "error" in run_tool("delete_data", {}, home).response


def test_screen_context():
    state = SessionState(page="listen", screens={"player": {"date": "2026-01-01"}, "facts": None})
    context = run_tool("get_screen_context", {}, state).response
    assert context["current_page"]["id"] == "listen"
    assert context["player"] == {"date": "2026-01-01"} and "facts" not in context


LISTEN = SessionState(page="listen")


@pytest.mark.parametrize("command", ["play", "pause", "stop", "replay", "next", "previous"])
def test_control_playback_returns_a_player_action(command):
    result = run_tool("control_playback", {"command": command}, LISTEN)
    assert result.client_action == {"action": "player", "command": command}
    assert result.response == {"ok": True, "command": command}


@pytest.mark.parametrize("command", ["rewind", "", None, 5, "PLAY", "play; drop table"])
def test_control_playback_rejects_other_commands(command):
    result = run_tool("control_playback", {"command": command}, LISTEN)
    assert result.client_action is None and "error" in result.response


def test_control_playback_with_no_arguments():
    assert "error" in run_tool("control_playback", None, LISTEN).response


def test_set_date_returns_a_player_action():
    result = run_tool("set_date", {"date": "2024-07-15"}, LISTEN)
    assert result.client_action == {"action": "player", "command": {"setDate": "2024-07-15"}}
    assert result.response == {"ok": True, "date": "2024-07-15"}


@pytest.mark.parametrize("value", ["15 July 2024", "2024-7-15", "2024-13-01", "2024-02-30", "", None, 20240715, "2024-07-15T00:00:00"])
def test_set_date_rejects_anything_but_a_real_iso_date(value):
    result = run_tool("set_date", {"date": value}, LISTEN)
    assert result.client_action is None and "error" in result.response


@pytest.mark.parametrize("page", ["home", "learn", "about"])
def test_playback_tools_only_work_on_the_listen_page(page):
    state = SessionState(page=page)
    for name, args in (("control_playback", {"command": "play"}), ("set_date", {"date": "2024-07-15"})):
        result = run_tool(name, args, state)
        assert result.client_action is None
        assert "Listen page" in result.response["error"]


def test_the_guide_is_told_about_the_playback_tools():
    from app.assistant.knowledge import system_instruction
    text = system_instruction("Earth Jukebox", "en", "listen")
    assert "control_playback" in text and "set_date" in text


# IX09: point_to points at a place on the sound map with a beacon. It only reads the context and returns an allow-listed action.
SPOTS = {"exploring": True, "hotspots": [{"id": "h1", "place": "north-east"}, {"id": "h3", "place": "centre"}]}


def test_point_to_a_reported_hot_spot_returns_a_point_action():
    result = run_tool("point_to", {"target": "h3"}, SessionState(page="listen", screens={"explore": SPOTS}))
    assert result.client_action == {"action": "point", "target": "h3"}
    assert result.response == {"ok": True, "target": "h3"}


def test_point_to_an_unknown_hot_spot_is_an_error_with_the_valid_list():
    result = run_tool("point_to", {"target": "h9"}, SessionState(page="listen", screens={"explore": SPOTS}))
    assert result.client_action is None
    assert result.response["error"].startswith("Unknown target. Valid targets: h1, h3, north-west")


@pytest.mark.parametrize("place", COMPASS_PLACES)
def test_point_to_a_compass_place_works_with_no_hot_spots_reported(place):
    result = run_tool("point_to", {"target": place}, LISTEN)
    assert result.client_action == {"action": "point", "target": place}


def test_point_to_a_hot_spot_id_is_refused_when_none_were_reported():
    # Until the sound map's context carries its hot spots (board R-20261113-IX09-1), an id cannot be checked, so it is refused.
    result = run_tool("point_to", {"target": "h1"}, SessionState(page="listen", screens={"explore": {"exploring": True}}))
    assert result.client_action is None


@pytest.mark.parametrize("args", [{"target": 3}, {"target": None}, {"target": ["h1"]}, {}])
def test_point_to_checks_the_argument_type(args):
    result = run_tool("point_to", args, LISTEN)
    assert result.client_action is None
    assert "Unknown target" in result.response["error"]


@pytest.mark.parametrize("page", ["home", "learn", "about"])
def test_point_to_only_works_on_the_listen_page(page):
    result = run_tool("point_to", {"target": "centre"}, SessionState(page=page))
    assert result.client_action is None
    assert "Listen page" in result.response["error"]


def test_the_compass_places_match_the_browser():
    source = (REPO_ROOT / "src" / "features" / "point" / "places.ts").read_text(encoding="utf-8")
    listed = re.search(r"export const COMPASS_PLACES = \[([^\]]*)\] as const", source)
    assert listed, "COMPASS_PLACES not found in src/features/point/places.ts"
    assert re.findall(r"'([^']+)'", listed.group(1)) == COMPASS_PLACES


def test_the_adk_guide_is_not_told_about_point_to_because_it_has_no_such_tool():
    # G05 retired the bridge, which was the only path with point_to (IX09). Add the tool to app/agent/tools.py before offering it here.
    assert "point_to" not in system_instruction("Earth Jukebox", "en", "listen", page_label="{page_title}")
    assert "point_to" not in {tool.name for tool in AGENT_TOOLS}


def test_the_agent_has_the_six_tools_in_order_with_their_enum_lists():
    assert [tool.name for tool in AGENT_TOOLS] == ["navigate_to", "explain_section", "control_playback", "set_date", "get_screen_context", "get_weather"]
    schemas = {tool.name: tool._get_declaration().parameters_json_schema for tool in AGENT_TOOLS}
    assert schemas["navigate_to"]["properties"]["page"]["enum"] == PAGE_IDS
    assert schemas["explain_section"]["properties"]["page"]["enum"] == PAGE_IDS
    assert schemas["control_playback"]["properties"]["command"]["enum"] == PLAYBACK_COMMANDS


def test_tools_py_has_no_google_genai_types():
    source = (REPO_ROOT / "server" / "app" / "assistant" / "tools.py").read_text(encoding="utf-8")
    assert "google.genai" not in source and "google import genai" not in source


# ---- persona and drift ----

def test_the_guide_speaks_as_the_mascot_and_keeps_its_rules():
    from app.assistant.knowledge import PERSONA_NAME, system_instruction
    text = system_instruction("Earth Jukebox", "en", "home")
    assert f"Your name is {PERSONA_NAME}" in text
    # Echo is a program, not a person (F58).
    assert "robot" in text and "a program and not a person" in text
    assert "astronaut" not in text
    assert "Rules you must never break" in text and "never play sound yourself" in text
    # The persona changes how the guide sounds, not what it can do.
    assert len(AGENT_TOOLS) == 6


def test_the_persona_name_matches_the_frontend():
    source = (REPO_ROOT / "src" / "features" / "welcome" / "lines.ts").read_text(encoding="utf-8")
    from app.assistant.knowledge import PERSONA_NAME
    assert f"MASCOT_NAME = '{PERSONA_NAME}'" in source


def test_pages_match_frontend():
    source = (REPO_ROOT / "src" / "pages.ts").read_text(encoding="utf-8")
    assert re.findall(r'id: "([a-z]+)"', source) == PAGE_IDS


# ---- the browser protocol ----

def test_navigation_round_trip(live):
    with TestClient(app).websocket_connect("/api/v1/assistant/live", headers=ORIGIN) as ws:
        _open(ws)
        ws.send_bytes(b"\x00\x00" * 800)
        ws.send_json({"type": "text", "text": "Take me to the player"})
        assert ws.receive_json() == {"type": "action", "action": "navigate", "page": "listen"}
        assert ws.receive_bytes() == AUDIO
        assert ws.receive_json() == {"type": "transcript", "role": "assistant", "text": "Here you are."}
        assert ws.receive_json() == {"type": "turn_complete"}
        ws.send_json({"type": "stop"})
        assert ws.receive_json()["type"] == "ended"
    assert len(live.audio_frames) == 1
    assert live.state["page"] == "listen" and live.state["page_title"] == PAGES["listen"]["title"]
    assert live.closed


def test_playback_action_reaches_the_browser(live):
    live.call = ("control_playback", {"command": "pause"})
    with TestClient(app).websocket_connect("/api/v1/assistant/live", headers=ORIGIN) as ws:
        _open(ws, "listen")
        ws.send_json({"type": "text", "text": "Pause"})
        assert ws.receive_json() == {"type": "action", "action": "player", "command": "pause"}
        assert ws.receive_bytes() == AUDIO


def test_set_date_reaches_the_browser(live):
    live.call = ("set_date", {"date": "2024-07-15"})
    with TestClient(app).websocket_connect("/api/v1/assistant/live", headers=ORIGIN) as ws:
        _open(ws, "listen")
        ws.send_json({"type": "text", "text": "Play July 15"})
        assert ws.receive_json() == {"type": "action", "action": "player", "command": {"setDate": "2024-07-15"}}
        assert ws.receive_bytes() == AUDIO


def test_no_action_off_the_listen_page_but_the_audio_still_comes(live):
    live.call = ("control_playback", {"command": "pause"})
    with TestClient(app).websocket_connect("/api/v1/assistant/live", headers=ORIGIN) as ws:
        _open(ws, "home")
        ws.send_json({"type": "text", "text": "Pause"})
        assert ws.receive_bytes() == AUDIO


def test_player_context_prompts_feedback_once_per_gap(live):
    with TestClient(app).websocket_connect("/api/v1/assistant/live", headers=ORIGIN) as ws:
        _open(ws, "listen")
        ws.send_json({"type": "context", "key": "player", "data": {"visualization": "v", "date": "2026-01-01", "region": "r", "category": "hot", "playing": True}, "announce": "playback_finished:1"})
        ws.send_json({"type": "context", "key": "player", "data": {"visualization": "v", "date": "2026-01-02", "region": "r", "category": "hot", "playing": True}, "announce": "playback_finished:1"})
        ws.send_json({"type": "context", "key": "bogus", "data": {"x": 1}, "announce": "playback_finished:1"})
        ws.send_json({"type": "stop"})
        ws.receive_json()
    assert len(live.texts) == 1 and "get_screen_context" in live.texts[0]
    assert live.state["screens"] == {"player": {"visualization": "v", "date": "2026-01-02", "region": "r", "category": "hot", "playing": True}}


def test_not_configured_without_key(monkeypatch):
    monkeypatch.setattr(settings, "gemini_api_key", SecretStr(""))
    with TestClient(app).websocket_connect("/api/v1/assistant/live", headers=ORIGIN) as ws:
        assert ws.receive_json()["code"] == "not_configured"


def test_foreign_origin_rejected(live):
    from starlette.websockets import WebSocketDisconnect
    with pytest.raises(WebSocketDisconnect):
        with TestClient(app).websocket_connect("/api/v1/assistant/live", headers={"origin": "https://evil.example"}) as ws:
            ws.receive_json()


# ---- browser to model ----

def test_audio_frames_pass_through_and_oversize_ones_are_dropped(live):
    with TestClient(app).websocket_connect("/api/v1/assistant/live", headers=ORIGIN) as ws:
        _open(ws)
        ws.send_bytes(b"\x01\x02" * 800)
        ws.send_bytes(b"\x00" * (MAX_AUDIO_FRAME_BYTES + 1))
        ws.send_json({"type": "stop"})
        ws.receive_json()
    assert live.audio_frames == [b"\x01\x02" * 800]


def test_mic_off_ends_the_audio_stream(live):
    with TestClient(app).websocket_connect("/api/v1/assistant/live", headers=ORIGIN) as ws:
        _open(ws)
        ws.send_json({"type": "mic_off"})
        ws.send_json({"type": "stop"})
        ws.receive_json()
    assert live.audio_ends == 1


def test_text_is_capped_and_blank_text_is_ignored(live):
    live.scripted = [_event(turn_complete=True)]
    with TestClient(app).websocket_connect("/api/v1/assistant/live", headers=ORIGIN) as ws:
        _open(ws)
        ws.send_json({"type": "text", "text": "   \n"})
        ws.send_json({"type": "text", "text": "x" * 2500})
        assert ws.receive_json() == {"type": "turn_complete"}
        ws.send_json({"type": "stop"})
        ws.receive_json()
    assert live.texts == ["x" * 2000]


def test_bad_json_and_unknown_types_are_ignored(live):
    with TestClient(app).websocket_connect("/api/v1/assistant/live", headers=ORIGIN) as ws:
        _open(ws)
        ws.send_text("not json")
        ws.send_json({"type": "nonsense"})
        ws.send_json(["a", "list"])
        ws.send_json({"type": "page", "page": "not-a-page"})
        ws.send_json({"type": "page", "page": "about"})
        ws.send_json({"type": "stop"})
        assert ws.receive_json()["type"] == "ended"
    assert live.state["page"] == "about" and live.state["page_title"] == PAGES["about"]["title"]


def test_oversized_context_is_ignored(live):
    with TestClient(app).websocket_connect("/api/v1/assistant/live", headers=ORIGIN) as ws:
        _open(ws, "listen")
        ws.send_json({"type": "context", "key": "player", "data": {"blob": "x" * 30000}, "announce": "playback_finished:1"})
        ws.send_json({"type": "stop"})
        ws.receive_json()
    assert live.state["screens"] == {} and live.texts == []


# ---- model to browser ----

def test_time_limit(live, monkeypatch):
    monkeypatch.setattr(settings, "assistant_max_session_seconds", 0.2)
    with TestClient(app).websocket_connect("/api/v1/assistant/live", headers=ORIGIN) as ws:
        _open(ws)
        assert ws.receive_json() == {"type": "ended", "reason": "time_limit"}


def test_events_ending_is_service_ended(live):
    live.scripted = [END]
    with TestClient(app).websocket_connect("/api/v1/assistant/live", headers=ORIGIN) as ws:
        _open(ws)
        ws.send_json({"type": "text", "text": "hello"})
        assert ws.receive_json() == {"type": "ended", "reason": "service_ended"}


def test_upstream_error_is_reported_without_the_key(live, caplog):
    live.fail = RuntimeError("boom test-key boom")
    with caplog.at_level("WARNING"):
        with TestClient(app).websocket_connect("/api/v1/assistant/live", headers=ORIGIN) as ws:
            _open(ws)
            message = ws.receive_json()
    assert message == {"type": "error", "code": "upstream", "message": "The voice guide stopped unexpectedly."}
    assert "test-key" not in caplog.text and "[redacted]" in caplog.text


def test_an_action_is_sent_before_the_audio_of_its_event(live):
    # The tool ran before this event arrived; its action must go out first, then the audio on the same event.
    live.scripted = [_event(audio=AUDIO, text="Over to Learn.", turn_complete=True)]
    original = live.send_text

    async def send_text(text):
        sink.put(live.session_id, {"action": "navigate", "page": "learn"})
        await original(text)

    live.send_text = send_text
    with TestClient(app).websocket_connect("/api/v1/assistant/live", headers=ORIGIN) as ws:
        _open(ws)
        ws.send_json({"type": "text", "text": "Learn please"})
        assert ws.receive_json() == {"type": "action", "action": "navigate", "page": "learn"}
        assert ws.receive_bytes() == AUDIO
        assert ws.receive_json() == {"type": "transcript", "role": "assistant", "text": "Over to Learn."}
        assert ws.receive_json() == {"type": "turn_complete"}
    assert live.state["page_title"] == PAGES["learn"]["title"]


def test_interrupted_comes_before_audio_and_transcripts_are_not_repeated(live):
    live.scripted = [
        _event(interrupted=True),
        _event(user_text="take me", finished=False),
        _event(user_text=" home", finished=False),
        _event(user_text="take me home", finished=True),  # the whole text again: not sent a second time
        _event(text="Going.", finished=False),
        _event(text="Going.", finished=True),
        _event(turn_complete=True),
    ]
    with TestClient(app).websocket_connect("/api/v1/assistant/live", headers=ORIGIN) as ws:
        _open(ws)
        ws.send_json({"type": "text", "text": "go"})
        assert ws.receive_json() == {"type": "interrupted"}
        assert ws.receive_json() == {"type": "transcript", "role": "user", "text": "take me"}
        assert ws.receive_json() == {"type": "transcript", "role": "user", "text": " home"}
        assert ws.receive_json() == {"type": "transcript", "role": "assistant", "text": "Going."}
        assert ws.receive_json() == {"type": "turn_complete"}


def test_a_single_final_user_transcript_is_sent_once(live):
    # Gemini 3 sends the user's words once, as a finished transcript with no chunks before it.
    live.scripted = [_event(user_text="hello there", finished=True), _event(turn_complete=True)]
    with TestClient(app).websocket_connect("/api/v1/assistant/live", headers=ORIGIN) as ws:
        _open(ws)
        ws.send_json({"type": "text", "text": "go"})
        assert ws.receive_json() == {"type": "transcript", "role": "user", "text": "hello there"}
        assert ws.receive_json() == {"type": "turn_complete"}


# ---- the instruction ----

def test_the_instruction_has_the_page_placeholder_and_no_other_braces():
    text = system_instruction("Earth Jukebox", "en", "home", page_label="{page_title}")
    assert re.findall(r"[{}]", text) == ["{", "}"]
    assert "{page_title}" in text
    assert "The user started on: Home" not in text


def test_the_default_instruction_names_the_page_by_its_title():
    assert "The user started on: Listen." in system_instruction("Earth Jukebox", "en", "listen")


# ---- bad input, limits and the health route (I05) ----

def _first_message(payload):
    with TestClient(app).websocket_connect(LIVE, headers=ORIGIN) as ws:
        ws.send_json(payload)
        return ws.receive_json()


@pytest.mark.parametrize("payload", [[], [1, 2], 5, "start", None])
def test_a_start_message_that_is_not_an_object_gives_bad_start(live, payload):
    assert _first_message(payload)["code"] == "bad_start"


@pytest.mark.parametrize("value", [["en"], {"a": 1}, 5, None, "xx"])
def test_a_language_or_page_of_the_wrong_kind_falls_back_to_the_defaults(monkeypatch, live, value):
    seen = []
    real = assistant_api.connect_adk

    def connect(language, page):
        seen.append((language, page))
        return real(language, page)

    monkeypatch.setattr(assistant_api, "connect_adk", connect)
    with TestClient(app).websocket_connect(LIVE, headers=ORIGIN) as ws:
        ws.send_json({"type": "start", "language": value, "page": value})
        assert ws.receive_json() == {"type": "ready"}
        ws.send_json({"type": "stop"})
        assert ws.receive_json()["type"] == "ended"
    assert seen == [("en", "home")]


def test_a_second_session_gets_busy_while_the_cap_is_full(live, monkeypatch):
    monkeypatch.setattr(settings, "assistant_max_sessions", 1)
    client = TestClient(app)
    with client.websocket_connect(LIVE, headers=ORIGIN) as first:
        first.send_json({"type": "start", "language": "en", "page": "home"})
        assert first.receive_json() == {"type": "ready"}
        with client.websocket_connect(LIVE, headers=ORIGIN) as second:
            assert second.receive_json()["code"] == "busy"
            from starlette.websockets import WebSocketDisconnect
            with pytest.raises(WebSocketDisconnect):
                second.receive_json()  # the socket is closed
        first.send_json({"type": "stop"})
        assert first.receive_json()["type"] == "ended"
    assert assistant_api._active == 0



def test_an_upstream_failure_gives_a_plain_error_with_no_traceback(monkeypatch, caplog):
    @contextlib.asynccontextmanager
    async def connect(language, page):
        raise RuntimeError("boom with secret-key inside")
        yield

    monkeypatch.setattr(settings, "gemini_api_key", SecretStr("secret-key"))
    monkeypatch.setattr(assistant_api, "connect_adk", connect)
    with caplog.at_level(logging.WARNING):
        with TestClient(app).websocket_connect(LIVE, headers=ORIGIN) as ws:
            ws.send_json({"type": "start", "language": "en", "page": "home"})
            message = ws.receive_json()
    assert message == {"type": "error", "code": "upstream", "message": "The voice guide stopped unexpectedly."}
    assert "secret-key" not in caplog.text
    assert "Traceback" not in message["message"]
    assert assistant_api._active == 0



def test_a_missing_origin_is_refused_in_production_and_allowed_in_development(live, monkeypatch):
    from starlette.websockets import WebSocketDisconnect
    monkeypatch.setattr(settings, "cors_origins", "https://earth-jukebox.vercel.app")
    with pytest.raises(WebSocketDisconnect) as refused:
        with TestClient(app).websocket_connect(LIVE) as ws:
            ws.receive_json()
    assert refused.value.code == 1008
    with TestClient(app).websocket_connect(LIVE, headers={"origin": "https://earth-jukebox.vercel.app"}) as ws:
        ws.send_json({"type": "start", "language": "en", "page": "home"})
        assert ws.receive_json() == {"type": "ready"}

    monkeypatch.setattr(settings, "cors_origins", "http://localhost:5173,http://127.0.0.1:5173")
    with TestClient(app).websocket_connect(LIVE) as ws:
        ws.send_json({"type": "start", "language": "en", "page": "home"})
        assert ws.receive_json() == {"type": "ready"}


def test_the_health_route_says_ok_and_whether_the_voice_guide_is_set_up():
    body = TestClient(app).get("/api/v1/health").json()
    assert body["status"] == "ok"
    assert isinstance(body["voice_guide"], bool)
