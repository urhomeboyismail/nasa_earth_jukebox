"""The voice guide's five tools as ADK function tools.

Each one wraps `run_tool` (app/assistant/tools.py), which stays the one place that checks page names, playback commands and
dates: the functions here only read the session state, call it, and pass on what it returns. ADK builds each tool's schema from
the Python signature, so a `Literal[...]` argument becomes an enum the model sees. The lists are written out because a `Literal`
must be static; test_agent_core.py checks they equal PAGE_IDS and PLAYBACK_COMMANDS.
"""
from __future__ import annotations

from typing import Literal

from google.adk.tools import FunctionTool, ToolContext

from app.agent.sink import sink
from app.assistant.tools import SessionState, run_tool

PageId = Literal["home", "learn", "listen", "compare", "about"]
PlaybackCommand = Literal["play", "pause", "stop", "replay", "next", "previous"]


def _session_state(tool_context: ToolContext) -> SessionState:
    """The browser's state as run_tool reads it. Session state holds plain values only: page, language and screens."""
    state = tool_context.state
    return SessionState(page=state.get("page", "home"), language=state.get("language", "en"), screens=state.get("screens") or {})


def _run(name: str, args: dict, tool_context: ToolContext) -> dict:
    result = run_tool(name, args, _session_state(tool_context))
    if result.client_action:
        sink.put(tool_context.session.id, result.client_action)
        if result.client_action.get("action") == "navigate":
            # As the bridge does (app/api/assistant.py): later tools in this session see the new page.
            tool_context.state["page"] = result.client_action["page"]
    return result.response


def navigate_to(page: PageId, tool_context: ToolContext) -> dict:
    """Take the user to a page of the app."""
    return _run("navigate_to", {"page": page}, tool_context)


def explain_section(page: PageId, tool_context: ToolContext) -> dict:
    """Get what a page is for and the exact steps to use it."""
    return _run("explain_section", {"page": page}, tool_context)


def control_playback(command: PlaybackCommand, tool_context: ToolContext) -> dict:
    """Control the sound player on the Listen page: play, pause, stop, replay the current date, or go to the next or previous
    date. Only works while the user is on the Listen page."""
    return _run("control_playback", {"command": command}, tool_context)


def set_date(date: str, tool_context: ToolContext) -> dict:
    """Jump the Listen page to one date of the visualization and play it. Give the date as YYYY-MM-DD (for example 2024-07-15),
    taken from get_screen_context or what the user said. Only works on the Listen page."""
    return _run("set_date", {"date": date}, tool_context)


def get_screen_context(tool_context: ToolContext) -> dict:
    """What the user is doing right now: current page, plus the visualization, date and description they have open."""
    return _run("get_screen_context", {}, tool_context)


#: The only tools the agent has. Each one's action, if any, has passed run_tool before it reaches the sink.
AGENT_TOOLS = [FunctionTool(fn) for fn in (navigate_to, explain_section, control_playback, set_date, get_screen_context)]
TOOL_NAMES = frozenset(tool.name for tool in AGENT_TOOLS)
