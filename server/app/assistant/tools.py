"""Function declarations for the voice guide and their server-side execution.

Every tool is navigational or read-only, so the model cannot be talked into changing anything.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from app.assistant.knowledge import PAGE_IDS, PAGES

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


def run_tool(name: str, args: dict | None, state: SessionState) -> ToolResult:
    args = args or {}
    page = args.get("page")
    if name in ("navigate_to", "explain_section") and page not in PAGES:
        return ToolResult({"error": f"Unknown page. Valid pages: {', '.join(PAGE_IDS)}"})
    if name == "navigate_to":
        return ToolResult({"ok": True, "now_on": PAGES[page]["title"]}, {"action": "navigate", "page": page})
    if name == "explain_section":
        return ToolResult({"page": page, **PAGES[page]})
    if name == "get_screen_context":
        screens = {key: value for key, value in state.screens.items() if value is not None}
        return ToolResult({
            "current_page": {"id": state.page, "title": PAGES.get(state.page, PAGES["home"])["title"]},
            **(screens or {"note": "Nothing is playing or open yet in this session."}),
        })
    return ToolResult({"error": f"Unknown tool {name}"})
