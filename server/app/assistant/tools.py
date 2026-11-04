"""Function declarations for the voice guide and their server-side execution.

Every tool is navigational, read-only, or a playback control for the Listen page, so the model cannot be talked into
changing any data. The browser re-checks every action it receives.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date

from app.assistant.knowledge import PAGE_IDS, PAGES

PLAYBACK_COMMANDS = ["play", "pause", "stop", "replay", "next", "previous"]
_ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

_PAGE_PARAM = {"type": "string", "enum": PAGE_IDS, "description": "Page id: " + ", ".join(
    f"{pid} = {p['title']}" for pid, p in PAGES.items())}


def tools() -> list:
    from google.genai import types
    declarations = [
        types.FunctionDeclaration(
            name="navigate_to",
            description="Take the user to a page of the app.",
            parameters_json_schema={"type": "object", "properties": {"page": _PAGE_PARAM}, "required": ["page"]},
        ),
        types.FunctionDeclaration(
            name="explain_section",
            description="Get what a page is for and the exact steps to use it.",
            parameters_json_schema={"type": "object", "properties": {"page": _PAGE_PARAM}, "required": ["page"]},
        ),
        types.FunctionDeclaration(
            name="control_playback",
            description=("Control the sound player on the Listen page: play, pause, stop, replay the current date, "
                         "or go to the next or previous date. Only works while the user is on the Listen page."),
            parameters_json_schema={"type": "object", "properties": {
                "command": {"type": "string", "enum": PLAYBACK_COMMANDS}}, "required": ["command"]},
        ),
        types.FunctionDeclaration(
            name="set_date",
            description=("Jump the Listen page to one date of the visualization and play it. Give the date as "
                         "YYYY-MM-DD, taken from get_screen_context or what the user said. Only works on the Listen page."),
            parameters_json_schema={"type": "object", "properties": {
                "date": {"type": "string", "description": "A date written YYYY-MM-DD, for example 2024-07-15."}}, "required": ["date"]},
        ),
        types.FunctionDeclaration(
            name="get_screen_context",
            description=("What the user is doing right now: current page, plus the visualization, date and "
                         "description they have open."),
            parameters_json_schema={"type": "object", "properties": {}},
        ),
    ]
    return [types.Tool(function_declarations=declarations)]


@dataclass
class SessionState:
    page: str
    language: str = "en"
    screens: dict = field(default_factory=dict)


@dataclass
class ToolResult:
    response: dict
    client_action: dict | None = field(default=None)


def _is_real_date(value: str) -> bool:
    try:
        date.fromisoformat(value)
    except ValueError:
        return False
    return True


def run_tool(name: str, args: dict | None, state: SessionState) -> ToolResult:
    args = args or {}
    page = args.get("page")
    if name in ("navigate_to", "explain_section") and page not in PAGES:
        return ToolResult({"error": f"Unknown page. Valid pages: {', '.join(PAGE_IDS)}"})
    if name == "navigate_to":
        return ToolResult({"ok": True, "now_on": PAGES[page]["title"]}, {"action": "navigate", "page": page})
    if name == "explain_section":
        return ToolResult({"page": page, **PAGES[page]})
    if name in ("control_playback", "set_date"):
        # The player only exists on the Listen page, so say so instead of reporting a command that goes nowhere.
        if state.page != "listen":
            return ToolResult({"error": "The player is on the Listen page. Use navigate_to to take the user there first."})
        if name == "control_playback":
            command = args.get("command")
            if command not in PLAYBACK_COMMANDS:
                return ToolResult({"error": f"Unknown command. Valid commands: {', '.join(PLAYBACK_COMMANDS)}"})
            return ToolResult({"ok": True, "command": command}, {"action": "player", "command": command})
        day = args.get("date")
        if not isinstance(day, str) or not _ISO_DATE.match(day) or not _is_real_date(day):
            return ToolResult({"error": "The date must be written YYYY-MM-DD, for example 2024-07-15."})
        return ToolResult({"ok": True, "date": day}, {"action": "player", "command": {"setDate": day}})
    if name == "get_screen_context":
        screens = {key: value for key, value in state.screens.items() if value is not None}
        return ToolResult({
            "current_page": {"id": state.page, "title": PAGES.get(state.page, PAGES["home"])["title"]},
            **(screens or {"note": "Nothing is playing or open yet in this session."}),
        })
    return ToolResult({"error": f"Unknown tool {name}"})
