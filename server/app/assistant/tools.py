"""Server-side execution of the voice guide's tools (app/agent/tools.py wraps these for ADK).

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
#: Places on the sound map the guide can always point at (IX09): the nine thirds of the map. The browser has the same list (src/features/point/targets.ts).
COMPASS_PLACES = ["north-west", "north", "north-east", "west", "centre", "east", "south-west", "south", "south-east"]

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


def point_targets(state: SessionState) -> list[str]:
    """What the guide may point at now: the hot spots the sound map reported (their ids), then the compass places.
    The sound map's context has no hot spots until G06's schema carries them (board R-20261113-IX09-1); until then, only the compass places."""
    explore = state.screens.get("explore")
    spots = explore.get("hotspots") if isinstance(explore, dict) else None
    ids = [spot["id"] for spot in spots if isinstance(spot, dict) and isinstance(spot.get("id"), str)] if isinstance(spots, list) else []
    return [*ids, *COMPASS_PLACES]


def run_tool(name: str, args: dict | None, state: SessionState) -> ToolResult:
    args = args or {}
    page = args.get("page")
    if name in ("navigate_to", "explain_section") and page not in PAGES:
        return ToolResult({"error": f"Unknown page. Valid pages: {', '.join(PAGE_IDS)}"})
    if name == "navigate_to":
        return ToolResult({"ok": True, "now_on": PAGES[page]["title"]}, {"action": "navigate", "page": page})
    if name == "explain_section":
        return ToolResult({"page": page, **PAGES[page]})
    if name in ("control_playback", "set_date", "point_to"):
        # The player only exists on the Listen page, so say so instead of reporting a command that goes nowhere.
        if state.page != "listen":
            return ToolResult({"error": "The player is on the Listen page. Use navigate_to to take the user there first."})
        if name == "control_playback":
            command = args.get("command")
            if command not in PLAYBACK_COMMANDS:
                return ToolResult({"error": f"Unknown command. Valid commands: {', '.join(PLAYBACK_COMMANDS)}"})
            return ToolResult({"ok": True, "command": command}, {"action": "player", "command": command})
        if name == "point_to":
            # Read only: the target must be one the browser reported, or a compass place. The browser checks it again.
            target = args.get("target")
            valid = point_targets(state)
            if not isinstance(target, str) or target not in valid:
                return ToolResult({"error": f"Unknown target. Valid targets: {', '.join(valid)}"})
            return ToolResult({"ok": True, "target": target}, {"action": "point", "target": target})
        day = args.get("date")
        if not isinstance(day, str) or not _ISO_DATE.match(day) or not _is_real_date(day):
            return ToolResult({"error": "The date must be written YYYY-MM-DD, for example 2024-07-15."})
        # The Ask panel's list of dates, when the guide has it. Without it (another page, or an older browser) the browser checks the date.
        facts = state.screens.get("facts")
        known = facts.get("knownDates") if isinstance(facts, dict) else None
        if isinstance(known, list) and day not in known:
            return ToolResult({"error": "That date is not in this data set."})
        return ToolResult({"ok": True, "date": day}, {"action": "player", "command": {"setDate": day}})
    if name == "get_screen_context":
        screens = {key: value for key, value in state.screens.items() if value is not None}
        return ToolResult({
            "current_page": {"id": state.page, "title": PAGES.get(state.page, PAGES["home"])["title"]},
            **(screens or {"note": "Nothing is playing or open yet in this session."}),
        })
    return ToolResult({"error": f"Unknown tool {name}"})
