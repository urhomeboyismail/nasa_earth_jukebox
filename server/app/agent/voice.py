"""The voice guide on ADK's `Runner.run_live` (G04). The browser sees exactly the messages the Gemini Live bridge sends
(protocol: app/api/assistant.py), so the front end does not change.

`LiveSession` is the seam. `connect_adk` is the real one and wraps `run_live`; tests replace it with a fake that yields
scripted events. `AdkBridge` turns browser messages into calls on a `LiveSession`, and its events into browser messages.

Nothing here logs user text or the API key. Model output is untrusted: the only actions that reach the browser are the ones the
tools put in the sink after `run_tool` checked them (app/agent/tools.py).
"""
from __future__ import annotations

import asyncio
import json
import uuid
import warnings
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator, Protocol

from fastapi import WebSocket

from app.assistant.context_schemas import validate_context
from app.agent.limits import ANNOUNCE_GAP_SECONDS, CONTEXT_KEYS, MAX_AUDIO_FRAME_BYTES, MAX_CONTEXT_BYTES, MAX_TEXT_CHARS
from app.agent.sink import sink
from app.assistant.knowledge import PAGES, event_prompt, system_instruction
from app.config import settings

APP_NAME = "earth-jukebox-voice"
USER_ID = "listener"
#: ADK fills this from session state when it builds the instruction (see Result in docs/tickets/G04-voice-on-adk.md).
PAGE_PLACEHOLDER = "{page_title}"


class LiveSession(Protocol):
    session_id: str
    #: The ADK session's state. The route updates `page`, `page_title` and `screens`; the tools read them.
    state: dict

    def events(self) -> AsyncIterator[Any]: ...          # what run_live yields
    async def send_audio(self, pcm: bytes) -> None: ...  # 16 kHz PCM16, one frame
    async def send_text(self, text: str) -> None: ...
    async def audio_end(self) -> None: ...
    def close(self) -> None: ...


class _AdkLiveSession:
    """A `LiveSession` over a real ADK runner and live request queue."""

    def __init__(self, runner: Any, session: Any, queue: Any, run_config: Any) -> None:
        self._runner, self._session, self._queue, self._run_config = runner, session, queue, run_config
        self.session_id: str = session.id
        # The same dict the tools read through tool_context.state, because the session object itself is passed to run_live.
        self.state: dict = session.state

    async def events(self) -> AsyncIterator[Any]:
        with warnings.catch_warnings():
            # `session=` is deprecated, but it is the only way to hand run_live the session whose state the route also updates.
            warnings.simplefilter("ignore", DeprecationWarning)
            stream = self._runner.run_live(session=self._session, live_request_queue=self._queue, run_config=self._run_config)
        async for event in stream:
            yield event

    async def send_audio(self, pcm: bytes) -> None:
        from google.genai import types
        self._queue.send_realtime(types.Blob(data=pcm, mime_type="audio/pcm;rate=16000"))

    async def send_text(self, text: str) -> None:
        from google.genai import types
        self._queue.send_content(types.Content(role="user", parts=[types.Part(text=text)]))

    async def audio_end(self) -> None:
        self._queue.send_audio_stream_end()

    def close(self) -> None:
        self._queue.close()


@asynccontextmanager
async def connect_adk(language: str, page: str) -> AsyncIterator[LiveSession]:
    """Open an ADK live session for one browser connection. Replaced in tests."""
    from google.adk.agents import LlmAgent
    from google.adk.agents.live_request_queue import LiveRequestQueue
    from google.adk.agents.run_config import RunConfig, StreamingMode
    from google.adk.runners import Runner
    from google.adk.sessions import InMemorySessionService
    from google.genai import types

    from app.agent.callbacks import guard_tool, log_tool
    from app.agent.models import keyed_model
    from app.agent.tools import AGENT_TOOLS

    agent = LlmAgent(
        name="voice_guide",
        model=keyed_model(settings.gemini_live_model),
        instruction=system_instruction(settings.app_name, language, page, page_label=PAGE_PLACEHOLDER),
        tools=list(AGENT_TOOLS),
        before_tool_callback=guard_tool,
        after_tool_callback=log_tool,
    )
    service = InMemorySessionService()
    runner = Runner(app_name=APP_NAME, agent=agent, session_service=service)
    session_id = uuid.uuid4().hex
    session = await service.create_session(
        app_name=APP_NAME, user_id=USER_ID, session_id=session_id,
        state={"page": page, "page_title": PAGES[page]["title"], "language": language, "screens": {}},
    )
    run_config = RunConfig(
        streaming_mode=StreamingMode.BIDI,
        response_modalities=[types.Modality.AUDIO],
        input_audio_transcription=types.AudioTranscriptionConfig(),
        output_audio_transcription=types.AudioTranscriptionConfig(),
    )
    queue = LiveRequestQueue()
    sink.open(session_id)
    live = _AdkLiveSession(runner, session, queue, run_config)
    try:
        yield live
    finally:
        live.close()
        sink.close(session_id)
        try:
            await service.delete_session(app_name=APP_NAME, user_id=USER_ID, session_id=session_id)
        except Exception:  # the session is in memory and goes away with the connection anyway
            pass


class AdkBridge:
    """Browser messages to a `LiveSession`, and its events back to the browser, in the bridge's protocol."""

    def __init__(self, ws: WebSocket, live: LiveSession) -> None:
        self.ws = ws
        self.live = live
        self.last_announce = 0.0
        # Per role: did a chunk of this turn's transcript already go out? Gemini sends chunks and then the whole text again.
        self._chunked = {"user": False, "assistant": False}

    # ---- browser to model ----

    async def update_context(self, event: dict) -> None:
        key = event.get("key")
        if key not in CONTEXT_KEYS:
            return
        data = event.get("data")
        if data is not None and len(json.dumps(data)) > MAX_CONTEXT_BYTES:
            return
        valid, data = validate_context(key, data)
        if not valid:
            return
        screens = self.live.state.get("screens")
        self.live.state["screens"] = {**(screens if isinstance(screens, dict) else {}), key: data}
        announce = event.get("announce")
        prompt = event_prompt(announce.split(":", 1)[0]) if isinstance(announce, str) else None
        now = asyncio.get_running_loop().time()
        if prompt and now - self.last_announce >= ANNOUNCE_GAP_SECONDS:
            self.last_announce = now
            await self.live.send_text(prompt)

    async def browser_to_adk(self) -> None:
        while True:
            message = await self.ws.receive()
            if message["type"] == "websocket.disconnect":
                return
            data = message.get("bytes")
            if data is not None:
                if 0 < len(data) <= MAX_AUDIO_FRAME_BYTES:
                    await self.live.send_audio(data)
                continue
            try:
                event = json.loads(message.get("text") or "")
            except ValueError:
                continue
            kind = event.get("type") if isinstance(event, dict) else None
            if kind == "page" and event.get("page") in PAGES:
                self.live.state["page"] = event["page"]
                self.live.state["page_title"] = PAGES[event["page"]]["title"]
            elif kind == "context":
                await self.update_context(event)
            elif kind == "text" and isinstance(event.get("text"), str) and event["text"].strip():
                await self.live.send_text(event["text"][:MAX_TEXT_CHARS])
            elif kind == "mic_off":
                await self.live.audio_end()
            elif kind == "stop":
                return

    # ---- model to browser ----

    async def _transcript(self, role: str, transcription: Any) -> None:
        text = getattr(transcription, "text", None)
        if not text:
            return
        if getattr(transcription, "finished", False):
            # The whole text again, after the chunks. Send it only when no chunk went out (Gemini 3 sends the user's words once).
            already, self._chunked[role] = self._chunked[role], False
            if already:
                return
        else:
            self._chunked[role] = True
        await self.ws.send_json({"type": "transcript", "role": role, "text": text})

    async def adk_to_browser(self) -> None:
        async for event in self.live.events():
            # A tool runs between its function-call and function-response events, so its action may only show up on a later
            # event: drain after every event, and before this event's audio.
            for action in sink.drain(self.live.session_id):
                if action.get("action") == "navigate" and action.get("page") in PAGES:
                    self.live.state["page"] = action["page"]
                    self.live.state["page_title"] = PAGES[action["page"]]["title"]
                await self.ws.send_json({"type": "action", **action})
            if getattr(event, "interrupted", None):
                await self.ws.send_json({"type": "interrupted"})
            content = getattr(event, "content", None)
            for part in (getattr(content, "parts", None) or []):
                blob = getattr(part, "inline_data", None)
                if blob is not None and getattr(blob, "data", None):
                    await self.ws.send_bytes(blob.data)
            await self._transcript("user", getattr(event, "input_transcription", None))
            await self._transcript("assistant", getattr(event, "output_transcription", None))
            if getattr(event, "turn_complete", None):
                self._chunked = {"user": False, "assistant": False}
                await self.ws.send_json({"type": "turn_complete"})
        # The events ended (ADK reconnects on a go-away itself, so a stream that ends is the end of the service).
