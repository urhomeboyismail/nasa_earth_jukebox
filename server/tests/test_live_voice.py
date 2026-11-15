"""G13: the voice guide's show_live_data. No key, no network: fake STAC items, and a stand-in ToolContext."""
import asyncio
from datetime import datetime, timezone
from types import SimpleNamespace

import httpx
import pytest

from app.agent import planetary
from app.agent import tools as agent_tools
from app.agent.callbacks import guard_tool
from app.agent.sink import sink
from app.api import mascot as mascot_api
from app.config import settings

S2 = "sentinel-2-l2a"
ARGS = {"collection": S2, "bbox": [46, -19, 47, -18], "datetime_range": "2026-10-01/2026-10-31"}
SESSION = "live-s1"


def _scene(day: int, cover: float):
    when = datetime(2026, 10, day, tzinfo=timezone.utc)
    return SimpleNamespace(id=f"S2-{day}-{cover:g}", datetime=when, properties={"eo:cloud_cover": cover})


def _context():
    return SimpleNamespace(state={"page": "home", "language": "en", "screens": {}}, session=SimpleNamespace(id=SESSION))


def _show(context, **changes):
    return asyncio.run(agent_tools.show_live_data(**{**ARGS, **changes}, tool_context=context))


@pytest.fixture(autouse=True)
def open_sink(monkeypatch):
    monkeypatch.setattr(settings, "mascot_runs_per_minute", 100)
    mascot_api._bucket.cache_clear()
    monkeypatch.setattr(planetary, "search_items", lambda *args: pytest.fail("no search expected"))
    sink.open(SESSION)
    yield
    sink.close(SESSION)
    mascot_api._bucket.cache_clear()


def test_the_tool_is_declared_only_when_the_mascot_is_on(monkeypatch):
    monkeypatch.setattr(settings, "mascot_enabled", False)
    assert [tool.name for tool in agent_tools.agent_tools()] == [tool.name for tool in agent_tools.AGENT_TOOLS]
    assert guard_tool(agent_tools.LIVE_TOOL, ARGS, _context()) == {"error": "Unknown tool."}
    monkeypatch.setattr(settings, "mascot_enabled", True)
    assert [tool.name for tool in agent_tools.agent_tools()][-1] == "show_live_data"
    assert guard_tool(agent_tools.LIVE_TOOL, ARGS, _context()) is None


def test_the_model_sees_the_collections_and_not_the_context():
    declaration = agent_tools.LIVE_TOOL._get_declaration()
    assert all(name in declaration.description for name in planetary.COLLECTIONS)
    assert "tool_context" not in str(declaration.parameters_json_schema)


@pytest.mark.parametrize("changes", [{"collection": "era5-pds"}, {"bbox": [0, 0, 20, 1]}, {"datetime_range": "June"}])
def test_bad_arguments_are_errors_the_model_can_fix(changes):
    context = _context()
    assert "error" in _show(context, **changes)
    assert sink.drain(SESSION) == [] and agent_tools.LIVE_CALLS_KEY not in context.state


def test_one_live_data_action_equal_to_answer_for_and_only_the_reply_for_the_model(monkeypatch):
    items = [_scene(1, 10.0), _scene(2, 90.0)]
    monkeypatch.setattr(planetary, "search_items", lambda *args: items)
    result = _show(_context())
    area = [46.0, -19.0, 47.0, -18.0]
    expected = planetary.answer_for(
        {planetary.SERIES_KEY: planetary.series_of(S2, [(datetime(2026, 10, 1).date(), 10.0), (datetime(2026, 10, 2).date(), 90.0)]),
         planetary.IMAGES_KEY: planetary.images_of(S2, items, area)},
        "normal", [],
    )
    assert sink.drain(SESSION) == [{"action": "live_data", **expected}]
    assert expected["images"] and expected["series"]["values"] == [10.0, 90.0]
    assert result == {"say": expected["mascot_reply"]}


def test_the_cap_for_each_session(monkeypatch):
    calls = []
    monkeypatch.setattr(planetary, "search_items", lambda *args: calls.append(args) or [])
    context = _context()
    results = [_show(context) for _ in range(agent_tools.MAX_LIVE_CALLS + 1)]
    assert len(calls) == agent_tools.MAX_LIVE_CALLS
    assert "say" in results[0] and "error" in results[-1]


def test_the_mascot_rate_limit_counts_voice_calls(monkeypatch):
    monkeypatch.setattr(settings, "mascot_runs_per_minute", 1)
    mascot_api._bucket.cache_clear()
    monkeypatch.setattr(planetary, "search_items", lambda *args: [])
    assert "say" in _show(_context())
    assert "error" in _show(_context())  # a new session, but the server's bucket is empty


def test_planetary_computer_failure_is_the_error_sentence_and_no_action(monkeypatch, caplog):
    def down(*args):
        raise httpx.ConnectError("no route to 46,-19")

    monkeypatch.setattr(planetary, "search_items", down)
    assert _show(_context()) == {"error": "Planetary Computer did not answer. Tell the user, and do not try again."}
    assert sink.drain(SESSION) == []
    assert "ConnectError" in caplog.text and "46" not in caplog.text


def test_nothing_found_says_so_and_sends_no_action(monkeypatch):
    monkeypatch.setattr(planetary, "search_items", lambda *args: [])
    result = _show(_context())
    assert result["say"].startswith("I found no days of Sentinel-2 scenes")
    assert sink.drain(SESSION) == []


def test_the_live_line_follows_the_rules_it_relaxes():
    from app.assistant.knowledge import system_instruction

    instruction = system_instruction("Earth Jukebox", "en", "home", page_label="{page_title}") + agent_tools.LIVE_INSTRUCTION
    assert instruction.index("Never invent temperatures") < instruction.index("show_live_data")
