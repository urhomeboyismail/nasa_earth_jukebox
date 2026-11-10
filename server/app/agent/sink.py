"""Checked client actions waiting for one browser session.

A tool that produces a client action (go to a page, a player command) puts it here, keyed by the ADK session id. The route that
owns the browser connection (G02, G04) drains it and sends each action on. It is not kept in session state, because session state
must stay serialisable.
"""
from __future__ import annotations

import asyncio
import logging

logger = logging.getLogger(__name__)

#: Actions waiting for one session. A model that calls tools faster than the browser takes them loses the newest, not the oldest.
MAX_QUEUED_ACTIONS = 16


class ActionSink:
    """Checked client actions waiting for one browser session. Keyed by the ADK session id.
    It is not kept in session state, because session state must stay serialisable."""

    def __init__(self) -> None:
        self._queues: dict[str, asyncio.Queue[dict]] = {}

    def open(self, session_id: str) -> None:
        """Start taking actions for this session. Opening a session that is already open keeps what it holds."""
        self._queues.setdefault(session_id, asyncio.Queue(maxsize=MAX_QUEUED_ACTIONS))

    def put(self, session_id: str, action: dict) -> bool:
        """Queue one action. False if the session is not open or its queue is full; never raises."""
        queue = self._queues.get(session_id)
        if queue is None:
            return False
        try:
            queue.put_nowait(action)
        except asyncio.QueueFull:
            # The kind only: an action can carry a date or a page, never user text, but log no more than needed.
            logger.warning("Action sink full for a session; dropped a %s action", action.get("action", "unknown"))
            return False
        return True

    def drain(self, session_id: str) -> list[dict]:
        """Everything queued for this session, oldest first. Never blocks; an unknown session gives []."""
        queue = self._queues.get(session_id)
        actions: list[dict] = []
        while queue is not None and not queue.empty():
            actions.append(queue.get_nowait())
        return actions

    def close(self, session_id: str) -> None:
        """Stop taking actions for this session and forget what it held."""
        self._queues.pop(session_id, None)


sink = ActionSink()
