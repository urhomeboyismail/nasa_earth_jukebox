"""G06: every context payload is checked, only valid ones are stored, and set_date refuses a date the data set does not have."""
import pytest

from app.assistant.context_schemas import CONTEXT_SCHEMAS, validate_context
from app.assistant.tools import SessionState, run_tool

ORIGIN = {"origin": "http://localhost:5173"}

PLAYER = {"visualization": "v", "date": "2024-07-15", "region": "r", "category": "hot", "playing": True}
COMPARE = {"frameA": "a", "frameB": "b", "answered": False, "revealed": False, "testInProgress": True}
FACTS = {"knownDates": ["2024-07-15", "2024-08-15"], "facts": [{"id": "F-dates", "kind": "data", "text": "There are 2 dates."}]}
EXPLORE = {"exploring": True, "value": 21.5, "position": 0.4, "here": "Warm, about 21 degrees."}
VALID = {"player": PLAYER, "compare": COMPARE, "facts": FACTS, "explore": EXPLORE}


def test_every_key_has_a_valid_example():
    assert set(VALID) == set(CONTEXT_SCHEMAS)


@pytest.mark.parametrize("key", sorted(VALID))
def test_a_valid_payload_is_kept(key):
    assert validate_context(key, VALID[key]) == (True, VALID[key])


def test_none_clears_a_screen():
    assert validate_context("player", None) == (True, None)


def test_compare_test_flag_defaults_to_false():
    valid, stored = validate_context("compare", {k: v for k, v in COMPARE.items() if k != "testInProgress"})
    assert valid and stored["testInProgress"] is False


def _without(payload, key):
    return {k: v for k, v in payload.items() if k != key}


@pytest.mark.parametrize("key,payload", [
    ("player", {**PLAYER, "extra": 1}),
    ("player", _without(PLAYER, "date")),
    ("player", {**PLAYER, "playing": "yes"}),
    ("compare", {**COMPARE, "revealed": None}),
    ("facts", {**FACTS, "knownDates": ["2024-7-1"]}),
    ("facts", {**FACTS, "facts": [{"id": "F", "kind": "data", "text": "x" * 401}]}),
    ("facts", {**FACTS, "facts": [{"id": f"F{i}", "kind": "data", "text": "x"} for i in range(11)]}),
    ("facts", {**FACTS, "facts": [{"id": "F", "kind": "guess", "text": "x"}]}),
    ("explore", {**EXPLORE, "position": 1.5}),
    ("explore", {**EXPLORE, "cells": [1, 2, 3]}),
    ("explore", {"exploring": "on"}),
])
def test_an_invalid_payload_is_dropped(key, payload):
    assert validate_context(key, payload) == (False, None)


def _event(key, data):
    return {"type": "context", "key": key, "data": data}


def test_update_context_stores_only_valid_payloads():
    import asyncio
    from types import SimpleNamespace

    from app.agent.voice import AdkBridge

    live = SimpleNamespace(state={"screens": {}})
    bridge, read = AdkBridge(None, live), lambda: live.state["screens"]

    async def run():
        await bridge.update_context(_event("facts", FACTS))
        await bridge.update_context(_event("facts", {**FACTS, "knownDates": ["not a date"]}))  # invalid: the old value stays
        await bridge.update_context(_event("explore", EXPLORE))
        await bridge.update_context(_event("music", {"preset": "major"}))  # a key with no schema
        await bridge.update_context(_event("explore", None))  # the screen went away

    asyncio.run(run())
    assert read() == {"facts": FACTS, "explore": None}


LISTEN = SessionState(page="listen", screens={"facts": FACTS, "explore": EXPLORE})


def test_get_screen_context_returns_facts_and_explorer_as_stored():
    context = run_tool("get_screen_context", None, LISTEN).response
    assert context["facts"] == FACTS and context["explore"] == EXPLORE
    assert "player" not in context and "compare" not in context


def test_set_date_refuses_a_date_the_data_set_does_not_have():
    result = run_tool("set_date", {"date": "2024-09-15"}, LISTEN)
    assert result.client_action is None and result.response == {"error": "That date is not in this data set."}


def test_set_date_accepts_a_known_date():
    result = run_tool("set_date", {"date": "2024-08-15"}, LISTEN)
    assert result.client_action == {"action": "player", "command": {"setDate": "2024-08-15"}}


def test_set_date_without_facts_behaves_as_before():
    result = run_tool("set_date", {"date": "2031-01-01"}, SessionState(page="listen"))
    assert result.client_action == {"action": "player", "command": {"setDate": "2031-01-01"}}
