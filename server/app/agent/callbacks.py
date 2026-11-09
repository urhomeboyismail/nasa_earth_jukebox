"""Safety callbacks for the agent's tools. Model output is untrusted, so these refuse a call before it runs.

`guard_tool` is the before_tool_callback: it returns an error dict to skip the tool, or None to let it run. `run_tool` still checks
every argument; these add the rules that depend on what the browser shows. `log_tool` is the after_tool_callback and only logs.
"""
from __future__ import annotations

import logging
from typing import Any

from google.adk.tools import BaseTool, ToolContext

from app.agent.tools import TOOL_NAMES

logger = logging.getLogger(__name__)

PLAYER_TOOLS = frozenset({"control_playback", "set_date"})
ACTION_KINDS = {"navigate_to": "navigate", "control_playback": "player", "set_date": "player"}


def _screen(state: Any, name: str) -> dict:
    screens = state.get("screens")
    screen = screens.get(name) if isinstance(screens, dict) else None
    return screen if isinstance(screen, dict) else {}


def guard_tool(tool: BaseTool, args: dict[str, Any], tool_context: ToolContext) -> dict | None:
    """Refuse a tool call the browser could not carry out. None lets the tool run."""
    if tool.name not in TOOL_NAMES:
        return {"error": "Unknown tool."}
    state = tool_context.state
    page = state.get("page")
    if tool.name in PLAYER_TOOLS and page != "listen":
        return {"error": "The player is on the Listen page. Use navigate_to to take the user there first."}
    if tool.name == "set_date":
        # G06 adds the facts context. Until a data set's dates are known, run_tool's date check is the only one.
        known = _screen(state, "facts").get("knownDates")
        if isinstance(known, list) and args.get("date") not in known:
            return {"error": "That date is not in this data set."}
    if tool.name == "navigate_to" and page == "compare" and _screen(state, "compare").get("testInProgress") is True:
        if args.get("page") != "compare":
            return {"error": "The listening test is in progress. Finish it before leaving the page."}
    return None


def log_tool(tool: BaseTool, args: dict[str, Any], tool_context: ToolContext, tool_response: dict) -> None:
    """Log the kind of action a tool produced, for the server's log only. Never the arguments or user text. Returns None, so
    the response is unchanged."""
    kind = ACTION_KINDS.get(tool.name)
    if kind and isinstance(tool_response, dict) and tool_response.get("ok") is True:
        logger.info("Agent tool %s produced a %s action", tool.name, kind)
    return None
