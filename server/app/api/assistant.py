"""Voice guide: a WebSocket bridge between the browser and the Gemini Live API.

Ported from the FinAssist voice assistant. The API key never leaves the server. Browser protocol:

    client -> server  text   {"type":"start","language":"en","page":"home"}   (first message)
                      binary 16 kHz mono PCM16 microphone audio
                      text   {"type":"page","page":...} | {"type":"text","text":...} | {"type":"mic_off"}
                             | {"type":"context","key":...,"data":...,"announce":...}
    server -> client  text   {"type":"ready"} | {"type":"transcript","role":"user"|"assistant","text":...}
                             {"type":"action","action":"navigate","page":...}
                             {"type":"interrupted"} | {"type":"turn_complete"} | {"type":"ended","reason":...}
                             {"type":"error","code":...,"message":...}
                      binary 24 kHz mono PCM16 speech
"""
from __future__ import annotations

import asyncio
import contextlib
import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.assistant.knowledge import LANGUAGE_NAMES, PAGES, event_prompt, system_instruction
from app.assistant.tools import SessionState, run_tool, tools
from app.config import settings

router = APIRouter(prefix="/api/v1/assistant", tags=["assistant"])
logger = logging.getLogger(__name__)

MAX_AUDIO_FRAME_BYTES = 64 * 1024
MAX_TEXT_CHARS = 2000
MAX_CONTEXT_BYTES = 24 * 1024
CONTEXT_KEYS = {"player", "compare"}
ANNOUNCE_GAP_SECONDS = 4.0
_active = 0


def live_config(language: str, page: str):
    from google.genai import types
    return types.LiveConnectConfig(
        response_modalities=[types.Modality.AUDIO],
        system_instruction=system_instruction(settings.app_name, language, page),
        tools=tools(),
        input_audio_transcription=types.AudioTranscriptionConfig(),
        output_audio_transcription=types.AudioTranscriptionConfig(),
    )


def connect_live(language: str, page: str):
    """Async context manager yielding a Gemini Live session. Replaced in tests."""
    from google import genai
    from google.genai import types
    client = genai.Client(api_key=settings.gemini_api_key.get_secret_value(),
                          http_options=types.HttpOptions(api_version=settings.gemini_api_version))
    return client.aio.live.connect(model=settings.gemini_live_model, config=live_config(language, page))


class _Bridge:
    def __init__(self, ws: WebSocket, session, state: SessionState):
        self.ws = ws
        self.session = session
        self.state = state
        self.last_announce = 0.0

    async def update_context(self, event: dict) -> None:
        key = event.get("key")
        if key not in CONTEXT_KEYS:
            return
        data = event.get("data")
        if data is not None and len(json.dumps(data)) > MAX_CONTEXT_BYTES:
            return
        self.state.screens[key] = data
        announce = event.get("announce")
        prompt = event_prompt(announce.split(":", 1)[0]) if isinstance(announce, str) else None
        now = asyncio.get_running_loop().time()
        if prompt and now - self.last_announce >= ANNOUNCE_GAP_SECONDS:
            self.last_announce = now
            await self.session.send_realtime_input(text=prompt)

    async def browser_to_gemini(self) -> None:
        from google.genai import types
        while True:
            message = await self.ws.receive()
            if message["type"] == "websocket.disconnect":
                return
            data = message.get("bytes")
            if data is not None:
                if 0 < len(data) <= MAX_AUDIO_FRAME_BYTES:
                    await self.session.send_realtime_input(audio=types.Blob(data=data, mime_type="audio/pcm;rate=16000"))
                continue
            try:
                event = json.loads(message.get("text") or "")
            except ValueError:
                continue
            kind = event.get("type") if isinstance(event, dict) else None
            if kind == "page" and event.get("page") in PAGES:
                self.state.page = event["page"]
            elif kind == "context":
                await self.update_context(event)
            elif kind == "text" and isinstance(event.get("text"), str) and event["text"].strip():
                await self.session.send_realtime_input(text=event["text"][:MAX_TEXT_CHARS])
            elif kind == "mic_off":
                await self.session.send_realtime_input(audio_stream_end=True)
            elif kind == "stop":
                return

    async def gemini_to_browser(self) -> None:
        from google.genai import types
        while True:
            async for msg in self.session.receive():
                if msg.tool_call:
                    responses = []
                    for call in msg.tool_call.function_calls or []:
                        result = run_tool(call.name, call.args, self.state)
                        if result.client_action:
                            if result.client_action.get("action") == "navigate":
                                self.state.page = result.client_action["page"]
                            await self.ws.send_json({"type": "action", **result.client_action})
                        responses.append(types.FunctionResponse(id=call.id, name=call.name, response=result.response))
                    await self.session.send_tool_response(function_responses=responses)
                content = msg.server_content
                if content:
                    if content.interrupted:
                        await self.ws.send_json({"type": "interrupted"})
                    if content.model_turn:
                        for part in content.model_turn.parts or []:
                            if part.inline_data and part.inline_data.data:
                                await self.ws.send_bytes(part.inline_data.data)
                    if content.input_transcription and content.input_transcription.text:
                        await self.ws.send_json({"type": "transcript", "role": "user", "text": content.input_transcription.text})
                    if content.output_transcription and content.output_transcription.text:
                        await self.ws.send_json({"type": "transcript", "role": "assistant", "text": content.output_transcription.text})
                    if content.turn_complete:
                        await self.ws.send_json({"type": "turn_complete"})
                if msg.go_away:
                    return


def _scrub(text: str) -> str:
    """Remove the API key from text before it is logged."""
    key = settings.gemini_api_key.get_secret_value()
    return text.replace(key, "[redacted]") if key else text


async def _close(ws: WebSocket, payload: dict) -> None:
    with contextlib.suppress(Exception):
        await ws.send_json(payload)
        await ws.close()


@router.websocket("/live")
async def assistant_live(ws: WebSocket) -> None:
    global _active
    origin = ws.headers.get("origin")
    if origin and origin not in settings.cors_origin_list:
        await ws.close(code=1008)
        return
    await ws.accept()

    if not settings.gemini_api_key.get_secret_value():
        await _close(ws, {"type": "error", "code": "not_configured", "message": "The voice guide is not set up on this server."})
        return
    if _active >= settings.assistant_max_sessions:
        await _close(ws, {"type": "error", "code": "busy", "message": "The voice guide is busy. Try again in a minute."})
        return

    try:
        start = await asyncio.wait_for(ws.receive_json(), timeout=10)
    except (asyncio.TimeoutError, ValueError, WebSocketDisconnect):
        await _close(ws, {"type": "error", "code": "bad_start", "message": "The voice guide could not start."})
        return
    language = start.get("language") if start.get("language") in LANGUAGE_NAMES else "en"
    page = start.get("page") if start.get("page") in PAGES else "home"

    _active += 1
    reason = "closed"
    try:
        async with connect_live(language, page) as session:
            bridge = _Bridge(ws, session, SessionState(page=page, language=language))
            await ws.send_json({"type": "ready"})
            tasks = {
                asyncio.create_task(bridge.browser_to_gemini(), name="browser"),
                asyncio.create_task(bridge.gemini_to_browser(), name="gemini"),
            }
            done, pending = await asyncio.wait(tasks, timeout=settings.assistant_max_session_seconds,
                                               return_when=asyncio.FIRST_COMPLETED)
            for task in pending:
                task.cancel()
            for task in pending:
                with contextlib.suppress(asyncio.CancelledError, Exception):
                    await task
            if not done:
                reason = "time_limit"
            for task in done:
                if task.exception() and not isinstance(task.exception(), WebSocketDisconnect):
                    raise task.exception()
                if task.get_name() == "gemini":
                    reason = "service_ended"
    except WebSocketDisconnect:
        return
    except Exception as exc:
        # One readable line for Render's logs: class and message, with the API key scrubbed out.
        logger.warning("voice assistant session failed: %s: %s", type(exc).__name__, _scrub(str(exc)))
        logger.debug("voice assistant traceback", exc_info=True)
        await _close(ws, {"type": "error", "code": "upstream", "message": "The voice guide stopped unexpectedly."})
        return
    finally:
        _active -= 1
    await _close(ws, {"type": "ended", "reason": reason})
