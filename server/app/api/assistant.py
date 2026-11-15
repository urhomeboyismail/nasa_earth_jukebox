"""Voice guide: a WebSocket route between the browser and the Gemini Live API, run by Google ADK (app/agent/voice.py).

The API key never leaves the server. Browser protocol:

    client -> server  text   {"type":"start","language":"en","page":"home"}   (first message, a JSON object)
                      binary 16 kHz mono PCM16 microphone audio (frames over MAX_AUDIO_FRAME_BYTES are dropped)
                      text   {"type":"page","page":...} | {"type":"text","text":...} | {"type":"mic_off"}
                             | {"type":"context","key":"player"|"facts"|"explore","data":...,"announce":...} | {"type":"stop"}
    server -> client  text   {"type":"ready"} | {"type":"transcript","role":"user"|"assistant","text":...}
                             {"type":"action","action":"navigate","page":...}
                             {"type":"action","action":"player","command":...}   (only allow-listed commands)
                             {"type":"interrupted"} | {"type":"turn_complete"}
                             {"type":"ended","reason":"closed"|"service_ended"|"time_limit"}
                             {"type":"error","code":"not_configured"|"busy"|"bad_start"|"upstream","message":...}
                      binary 24 kHz mono PCM16 speech

Origin rule: a browser always sends `Origin` on a WebSocket. When CORS_ORIGINS lists any non-local origin
(production), a connection with no `Origin`, or a foreign one, is refused with code 1008. When every allowed
origin is local (development and tests), a missing `Origin` is allowed so tools such as curl still work.
"""
from __future__ import annotations

import asyncio
import contextlib
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.assistant.knowledge import LANGUAGE_NAMES, PAGES
from app.config import settings

router = APIRouter(prefix="/api/v1/assistant", tags=["assistant"])
logger = logging.getLogger(__name__)

_active = 0


def __getattr__(name: str):
    """The shared limits stay readable here (`assistant.MAX_TEXT_CHARS` and so on), loaded from app/agent/limits.py on first use."""
    if name in {"MAX_AUDIO_FRAME_BYTES", "MAX_TEXT_CHARS", "MAX_CONTEXT_BYTES", "CONTEXT_KEYS", "ANNOUNCE_GAP_SECONDS"}:
        from app.agent import limits
        return getattr(limits, name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


def connect_adk(language: str, page: str):
    """Async context manager yielding an ADK live session. Replaced in tests. Imported on first use, so a server that never opens a
    voice session never loads ADK (tests/test_jukebox_api.py and test_agent_core.py check this)."""
    from app.agent.voice import connect_adk as real
    return real(language, page)


def _scrub(text: str) -> str:
    """Remove the API key from text before it is logged."""
    key = settings.gemini_api_key.get_secret_value()
    return text.replace(key, "[redacted]") if key else text


async def _close(ws: WebSocket, payload: dict) -> None:
    with contextlib.suppress(Exception):
        await ws.send_json(payload)
        await ws.close()


async def _wait(tasks: set[asyncio.Task]) -> str:
    """Run the two pumps until one ends or the time limit passes. Returns the `ended` reason; raises what a pump raised."""
    reason = "closed"
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
    return reason


async def _run_adk(ws: WebSocket, language: str, page: str) -> str:
    """The voice guide through ADK's `run_live`. The browser messages are built in app/agent/voice.py."""
    from app.agent.voice import AdkBridge
    async with connect_adk(language, page) as live:
        bridge = AdkBridge(ws, live)
        await ws.send_json({"type": "ready"})
        return await _wait({
            asyncio.create_task(bridge.browser_to_adk(), name="browser"),
            asyncio.create_task(bridge.adk_to_browser(), name="gemini"),
        })


@router.websocket("/live")
async def assistant_live(ws: WebSocket) -> None:
    global _active
    origin = ws.headers.get("origin")
    if (origin or settings.origin_required) and origin not in settings.cors_origin_list:
        logger.warning("voice assistant refused origin %r; allowed: %s (set CORS_ORIGINS to add it)", origin, settings.cors_origins)
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
    if not isinstance(start, dict):
        await _close(ws, {"type": "error", "code": "bad_start", "message": "The voice guide could not start."})
        return
    # A list or dict is unhashable, so check the type before the `in` test.
    language, page = start.get("language"), start.get("page")
    language = language if isinstance(language, str) and language in LANGUAGE_NAMES else "en"
    page = page if isinstance(page, str) and page in PAGES else "home"

    _active += 1
    try:
        reason = await _run_adk(ws, language, page)
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
