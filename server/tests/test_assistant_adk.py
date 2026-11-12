"""The voice guide on ADK (G04): a fake live session replaces `connect_adk`, and the browser must see the same messages as from the
Gemini Live bridge (compare tests/test_assistant.py). No network and no key are used."""
import asyncio
import contextlib
import re
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr

from app.agent.callbacks import PLAYER_TOOLS
from app.agent.limits import MAX_AUDIO_FRAME_BYTES
from app.agent.sink import sink
from app.api import assistant as assistant_api
from app.assistant.knowledge import PAGES, system_instruction
from app.assistant.tools import SessionState, run_tool
from app.config import settings
from app.main import app

ORIGIN = {"origin": "http://localhost:5173"}
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
    monkeypatch.setattr(settings, "assistant_engine", "adk")
    monkeypatch.setattr(assistant_api, "connect_adk", connect)
    return session


def _open(ws, page="home"):
    ws.send_json({"type": "start", "language": "en", "page": page})
    assert ws.receive_json() == {"type": "ready"}


# ---- parity with the bridge ----

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
        ws.send_json({"type": "context", "key": "player", "data": {"date": "2026-01-01"}, "announce": "playback_finished:1"})
        ws.send_json({"type": "context", "key": "player", "data": {"date": "2026-01-02"}, "announce": "playback_finished:1"})
        ws.send_json({"type": "context", "key": "bogus", "data": {"x": 1}, "announce": "playback_finished:1"})
        ws.send_json({"type": "stop"})
        ws.receive_json()
    assert len(live.texts) == 1 and "get_screen_context" in live.texts[0]
    assert live.state["screens"] == {"player": {"date": "2026-01-02"}}


def test_not_configured_without_key(monkeypatch):
    monkeypatch.setattr(settings, "gemini_api_key", SecretStr(""))
    monkeypatch.setattr(settings, "assistant_engine", "adk")
    with TestClient(app).websocket_connect("/api/v1/assistant/live", headers=ORIGIN) as ws:
        assert ws.receive_json()["code"] == "not_configured"


def test_foreign_origin_rejected(live):
    from starlette.websockets import WebSocketDisconnect
    with pytest.raises(WebSocketDisconnect):
        with TestClient(app).websocket_connect("/api/v1/assistant/live", headers={"origin": "https://evil.example"}) as ws:
            ws.receive_json()


def test_busy_when_full(live, monkeypatch):
    monkeypatch.setattr(settings, "assistant_max_sessions", 1)
    monkeypatch.setattr(assistant_api, "_active", 1)
    with TestClient(app).websocket_connect("/api/v1/assistant/live", headers=ORIGIN) as ws:
        assert ws.receive_json()["code"] == "busy"


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
        ws.send_json({"type": "page", "page": "compare"})
        ws.send_json({"type": "stop"})
        assert ws.receive_json()["type"] == "ended"
    assert live.state["page"] == "compare" and live.state["page_title"] == PAGES["compare"]["title"]


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


def test_the_bridge_instruction_is_unchanged_by_the_new_argument():
    assert "The user started on: Listen." in system_instruction("Earth Jukebox", "en", "listen")
