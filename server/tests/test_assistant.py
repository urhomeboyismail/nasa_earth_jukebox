import asyncio
import contextlib
import re
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr

from app.api import assistant as assistant_api
from app.assistant.knowledge import PAGE_IDS
from app.assistant.tools import SessionState, run_tool, tools
from app.config import settings
from app.main import app

ORIGIN = {"origin": "http://localhost:5173"}
REPO_ROOT = Path(__file__).resolve().parents[2]


def _msg(tool_call=None, server_content=None):
    return SimpleNamespace(tool_call=tool_call, server_content=server_content, go_away=None)


def _content(**fields):
    base = dict(interrupted=False, model_turn=None, input_transcription=None, output_transcription=None, turn_complete=False)
    return SimpleNamespace(**{**base, **fields})


class FakeSession:
    """Stands in for a Gemini Live session: a text turn asking to go somewhere triggers navigate_to."""

    def __init__(self):
        self.tool_responses = []
        self.audio_frames = 0
        self.texts = []
        self.queue = None

    def _q(self):
        if self.queue is None:
            self.queue = asyncio.Queue()
        return self.queue

    async def send_realtime_input(self, audio=None, text=None, audio_stream_end=None):
        if audio is not None:
            self.audio_frames += 1
        if text:
            self.texts.append(text)
        if text and not text.startswith("[App update"):
            call = SimpleNamespace(id="c1", name="navigate_to", args={"page": "listen"})
            await self._q().put(_msg(tool_call=SimpleNamespace(function_calls=[call])))

    async def send_tool_response(self, function_responses):
        self.tool_responses.extend(function_responses)
        part = SimpleNamespace(inline_data=SimpleNamespace(data=b"\x01\x00" * 10))
        await self._q().put(_msg(server_content=_content(model_turn=SimpleNamespace(parts=[part]),
                                                         output_transcription=SimpleNamespace(text="Here you are."))))
        await self._q().put(_msg(server_content=_content(turn_complete=True)))

    async def receive(self):
        while True:
            msg = await self._q().get()
            yield msg
            if msg.server_content and msg.server_content.turn_complete:
                return


@pytest.fixture
def fake_session(monkeypatch):
    session = FakeSession()

    @contextlib.asynccontextmanager
    async def connect(language, page):
        yield session

    monkeypatch.setattr(settings, "gemini_api_key", SecretStr("test-key"))
    monkeypatch.setattr(assistant_api, "connect_live", connect)
    return session


def test_navigation_round_trip(fake_session):
    with TestClient(app).websocket_connect("/api/v1/assistant/live", headers=ORIGIN) as ws:
        ws.send_json({"type": "start", "language": "en", "page": "home"})
        assert ws.receive_json() == {"type": "ready"}
        ws.send_bytes(b"\x00\x00" * 800)
        ws.send_json({"type": "text", "text": "Take me to the player"})
        assert ws.receive_json() == {"type": "action", "action": "navigate", "page": "listen"}
        assert ws.receive_bytes() == b"\x01\x00" * 10
        assert ws.receive_json() == {"type": "transcript", "role": "assistant", "text": "Here you are."}
        assert ws.receive_json() == {"type": "turn_complete"}
        ws.send_json({"type": "stop"})
        assert ws.receive_json()["type"] == "ended"
    assert fake_session.audio_frames == 1
    assert fake_session.tool_responses[0].response == {"ok": True, "now_on": "Listen"}


def test_not_configured_without_key(monkeypatch):
    monkeypatch.setattr(settings, "gemini_api_key", SecretStr(""))
    with TestClient(app).websocket_connect("/api/v1/assistant/live", headers=ORIGIN) as ws:
        assert ws.receive_json()["code"] == "not_configured"


def test_foreign_origin_rejected(fake_session):
    from starlette.websockets import WebSocketDisconnect
    with pytest.raises(WebSocketDisconnect):
        with TestClient(app).websocket_connect("/api/v1/assistant/live", headers={"origin": "https://evil.example"}) as ws:
            ws.receive_json()


def test_tools_only_navigate_or_read():
    home = SessionState(page="home")
    assert run_tool("navigate_to", {"page": "compare"}, home).client_action == {"action": "navigate", "page": "compare"}
    assert "error" in run_tool("navigate_to", {"page": "admin"}, home).response
    assert run_tool("explain_section", {"page": "learn"}, home).client_action is None
    assert "error" in run_tool("delete_data", {}, home).response


def test_screen_context():
    state = SessionState(page="listen", screens={"player": {"date": "2026-01-01"}, "compare": None})
    context = run_tool("get_screen_context", {}, state).response
    assert context["current_page"]["id"] == "listen"
    assert context["player"] == {"date": "2026-01-01"} and "compare" not in context


def test_player_context_prompts_feedback(fake_session):
    with TestClient(app).websocket_connect("/api/v1/assistant/live", headers=ORIGIN) as ws:
        ws.send_json({"type": "start", "language": "en", "page": "listen"})
        assert ws.receive_json() == {"type": "ready"}
        ws.send_json({"type": "context", "key": "player", "data": {"date": "2026-01-01"}, "announce": "playback_finished:1"})
        ws.send_json({"type": "context", "key": "bogus", "data": {"x": 1}, "announce": "playback_finished:1"})
        ws.send_json({"type": "stop"})
        ws.receive_json()
    assert len(fake_session.texts) == 1 and "get_screen_context" in fake_session.texts[0]


def test_tool_declarations_build():
    names = [d.name for d in tools()[0].function_declarations]
    assert names == ["navigate_to", "explain_section", "get_screen_context"]


def test_pages_match_frontend():
    source = (REPO_ROOT / "src" / "pages.ts").read_text(encoding="utf-8")
    assert re.findall(r'id: "([a-z]+)"', source) == PAGE_IDS
