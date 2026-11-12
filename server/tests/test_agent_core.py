"""G01: the ADK agent package. No key, no network: the model is FakeLlm, and keyed_model is built but never called."""
import asyncio
import subprocess
import sys
import typing
from pathlib import Path
from types import SimpleNamespace

import pytest
from google.adk.agents import LlmAgent
from google.adk.runners import InMemoryRunner
from google.genai import types
from pydantic import SecretStr, ValidationError

from app.agent import callbacks, models, tools
from app.agent.callbacks import guard_tool, log_tool
from app.agent.fake import FakeLlm, FunctionCallSpec, keyword_script, last_user_text, tool_then_text
from app.agent.sink import MAX_QUEUED_ACTIONS, ActionSink, sink
from app.agent.tools import AGENT_TOOLS, TOOL_NAMES
from app.assistant.knowledge import PAGE_IDS
from app.assistant.tools import PLAYBACK_COMMANDS, SessionState, run_tool
from app.config import Settings, settings

SERVER_DIR = Path(__file__).resolve().parents[1]


def _context(page="home", screens=None, session_id="s1"):
    """Stands in for ADK's ToolContext: the tools and callbacks read only `state` and `session.id`."""
    return SimpleNamespace(state={"page": page, "language": "en", "screens": screens or {}}, session=SimpleNamespace(id=session_id))


def _tool(name):
    return SimpleNamespace(name=name)


@pytest.fixture(autouse=True)
def _clean_sink():
    sink.close("s1")
    sink.open("s1")
    yield
    sink.close("s1")


# 1. Parity with run_tool: the ADK functions add nothing and drop nothing.

PARITY_CASES = [
    ("navigate_to", {"page": "listen"}),
    ("navigate_to", {"page": "moon"}),
    ("navigate_to", {"page": ""}),
    ("navigate_to", {"page": None}),
    ("navigate_to", {"page": 3}),
    ("explain_section", {"page": "compare"}),
    ("explain_section", {"page": "nowhere"}),
    ("control_playback", {"command": "pause"}),
    ("control_playback", {"command": "rewind"}),
    ("control_playback", {"command": None}),
    ("set_date", {"date": "2024-07-15"}),
    ("set_date", {"date": "2024-02-30"}),
    ("set_date", {"date": ""}),
    ("set_date", {"date": None}),
    ("set_date", {"date": 20240715}),
    ("get_screen_context", {}),
]


@pytest.mark.parametrize("page", ["home", "listen"])
@pytest.mark.parametrize(("name", "args"), PARITY_CASES)
def test_each_tool_returns_what_run_tool_returns(name, args, page):
    screens = {"player": {"date": "2024-07-15"}}
    expected = run_tool(name, args, SessionState(page=page, screens=screens))
    context = _context(page, screens)
    assert getattr(tools, name)(**args, tool_context=context) == expected.response
    assert sink.drain("s1") == ([expected.client_action] if expected.client_action else [])


def test_navigate_to_moves_the_session_to_the_new_page():
    context = _context("home")
    tools.navigate_to("listen", tool_context=context)
    assert context.state["page"] == "listen"
    assert tools.control_playback("play", tool_context=context) == {"ok": True, "command": "play"}


# 2. Enums: the static Literal lists are the server's lists, and ADK shows them to the model as enums.

def test_literal_lists_equal_the_page_and_command_lists():
    assert list(typing.get_args(tools.PageId)) == PAGE_IDS
    assert list(typing.get_args(tools.PlaybackCommand)) == PLAYBACK_COMMANDS


def test_generated_schemas_list_the_same_enums():
    schemas = {tool.name: tool._get_declaration().parameters_json_schema for tool in AGENT_TOOLS}
    assert schemas["navigate_to"]["properties"]["page"]["enum"] == PAGE_IDS
    assert schemas["explain_section"]["properties"]["page"]["enum"] == PAGE_IDS
    assert schemas["control_playback"]["properties"]["command"]["enum"] == PLAYBACK_COMMANDS
    assert TOOL_NAMES == {"navigate_to", "explain_section", "control_playback", "set_date", "get_screen_context"}
    # The model never sees the tool context.
    assert all("tool_context" not in str(schema) for schema in schemas.values())


# 3. Sink.

def test_sink_keeps_order_and_keeps_sessions_apart():
    s = ActionSink()
    s.open("a")
    s.open("b")
    assert s.put("a", {"n": 1}) and s.put("b", {"n": 2}) and s.put("a", {"n": 3})
    assert s.drain("a") == [{"n": 1}, {"n": 3}]
    assert s.drain("b") == [{"n": 2}]
    assert s.drain("a") == []


def test_sink_refuses_a_closed_session_and_never_raises():
    s = ActionSink()
    assert s.put("never-opened", {"n": 1}) is False
    s.open("a")
    s.close("a")
    assert s.put("a", {"n": 1}) is False
    assert s.drain("a") == []
    assert s.drain("unknown") == []


def test_full_sink_drops_the_new_action(caplog):
    s = ActionSink()
    s.open("a")
    for n in range(MAX_QUEUED_ACTIONS):
        assert s.put("a", {"action": "player", "n": n})
    assert s.put("a", {"action": "navigate", "page": "secret-text"}) is False
    assert [a["n"] for a in s.drain("a")] == list(range(MAX_QUEUED_ACTIONS))
    assert "navigate" in caplog.text and "secret-text" not in caplog.text


# 4. Callbacks.

def test_playback_is_refused_off_listen_and_allowed_on_it():
    for name, args in (("control_playback", {"command": "play"}), ("set_date", {"date": "2024-07-15"})):
        assert guard_tool(_tool(name), args, _context("home")) == {
            "error": "The player is on the Listen page. Use navigate_to to take the user there first."}
        assert guard_tool(_tool(name), args, _context("listen")) is None


def test_set_date_must_be_a_known_date_when_the_dates_are_known():
    facts = {"facts": {"knownDates": ["2024-01-15", "2024-07-15"]}}
    assert guard_tool(_tool("set_date"), {"date": "2024-03-01"}, _context("listen", facts)) == {"error": "That date is not in this data set."}
    assert guard_tool(_tool("set_date"), {"date": "2024-07-15"}, _context("listen", facts)) is None
    # No facts context yet (G06): run_tool's own date check is the only one.
    assert guard_tool(_tool("set_date"), {"date": "2024-03-01"}, _context("listen")) is None


def test_leaving_compare_is_refused_during_the_listening_test():
    testing = {"compare": {"testInProgress": True}}
    refused = {"error": "The listening test is in progress. Finish it before leaving the page."}
    assert guard_tool(_tool("navigate_to"), {"page": "home"}, _context("compare", testing)) == refused
    assert guard_tool(_tool("navigate_to"), {"page": "compare"}, _context("compare", testing)) is None
    assert guard_tool(_tool("navigate_to"), {"page": "home"}, _context("compare", {"compare": {"testInProgress": False}})) is None
    assert guard_tool(_tool("navigate_to"), {"page": "home"}, _context("compare")) is None


def test_an_unknown_tool_is_refused():
    assert guard_tool(_tool("delete_everything"), {}, _context("listen")) == {"error": "Unknown tool."}


def test_log_tool_logs_the_kind_only_and_changes_nothing(caplog):
    caplog.set_level("INFO", logger=callbacks.__name__)
    response = {"ok": True, "date": "2024-07-15"}
    assert log_tool(_tool("set_date"), {"date": "2024-07-15"}, _context("listen"), response) is None
    assert "player" in caplog.text and "2024-07-15" not in caplog.text
    assert log_tool(_tool("get_screen_context"), {}, _context(), {"current_page": {}}) is None


# 5. Runner round trip with the fake model.

async def _run_agent(model, page, text):
    agent = LlmAgent(name="guide", model=model, instruction="Help the user.", tools=AGENT_TOOLS,
                     before_tool_callback=guard_tool, after_tool_callback=log_tool)
    runner = InMemoryRunner(agent=agent, app_name="g01")
    session = await runner.session_service.create_session(app_name="g01", user_id="u", state={"page": page, "screens": {}})
    sink.open(session.id)
    final = ""
    try:
        message = types.Content(role="user", parts=[types.Part(text=text)])
        async for event in runner.run_async(user_id="u", session_id=session.id, new_message=message):
            if event.is_final_response() and event.content:
                final = "".join(part.text or "" for part in event.content.parts or [])
        return final, sink.drain(session.id)
    finally:
        sink.close(session.id)


def test_runner_round_trip_puts_the_checked_action_in_the_sink():
    model = FakeLlm(script=tool_then_text(FunctionCallSpec("control_playback", {"command": "pause"}), "Paused."))
    final, actions = asyncio.run(_run_agent(model, "listen", "pause it"))
    assert final == "Paused."
    assert actions == [{"action": "player", "command": "pause"}]
    assert len(model.calls) == 2


def test_runner_round_trip_refused_off_listen_produces_no_action():
    model = FakeLlm(script=tool_then_text(FunctionCallSpec("control_playback", {"command": "pause"}), "Go to Listen first."))
    final, actions = asyncio.run(_run_agent(model, "home", "pause it"))
    assert final == "Go to Listen first."
    assert actions == []


def test_fake_model_instances_do_not_share_calls():
    a, b = FakeLlm(script=lambda request: "a"), FakeLlm(script=lambda request: "b")
    a.calls.append("x")
    assert b.calls == []


def test_keyword_script_reads_the_newest_user_text():
    script = keyword_script([(r"\bpause\b", FunctionCallSpec("control_playback", {"command": "pause"})), (r"listen", "ok")], default="?")
    request = SimpleNamespace(contents=[types.Content(role="user", parts=[types.Part(text="go to listen")]),
                                        types.Content(role="user", parts=[types.Part(text="Pause please")])])
    assert last_user_text(request) == "Pause please"
    assert script(request) == FunctionCallSpec("control_playback", {"command": "pause"})
    assert script(SimpleNamespace(contents=[])) == "?"


# 6. Settings: off by default, and every variable is documented in .env.example.

AGENT_SETTINGS = ("agent_enabled", "agent_model", "agent_timeout_seconds", "agent_max_requests_per_minute", "assistant_engine")


def test_agent_settings_default_to_off_and_the_bridge(monkeypatch):
    for name in AGENT_SETTINGS:
        monkeypatch.delenv(name.upper(), raising=False)
    defaults = Settings(_env_file=None)
    assert defaults.agent_enabled is False
    assert defaults.assistant_engine == "bridge"
    assert defaults.agent_timeout_seconds == 2.5
    assert defaults.agent_max_requests_per_minute == 5


def test_assistant_engine_accepts_only_bridge_or_adk(monkeypatch):
    monkeypatch.setenv("ASSISTANT_ENGINE", "other")
    with pytest.raises(ValidationError):
        Settings(_env_file=None)


def test_every_agent_setting_is_in_env_example():
    example = (SERVER_DIR / ".env.example").read_text(encoding="utf-8")
    for name in AGENT_SETTINGS:
        assert f"{name.upper()}=" in example


# 6a. Keyed model: built without a call, its client uses the key from settings.

def test_keyed_model_uses_the_key_from_settings(monkeypatch):
    monkeypatch.setattr(settings, "gemini_api_key", SecretStr("test-key-not-real"))
    model = models.keyed_model("gemini-2.5-flash")
    assert model.model == "gemini-2.5-flash"
    client = model.api_client  # builds a google.genai.Client; no request is sent
    assert client._api_client.api_key == "test-key-not-real"
    assert client._api_client._http_options.api_version == settings.gemini_api_version


def test_keyed_model_with_no_key_builds_and_makes_no_call(monkeypatch):
    built = []
    monkeypatch.setattr(settings, "gemini_api_key", SecretStr(""))
    monkeypatch.setattr("google.genai.Client", lambda **kwargs: built.append(kwargs))
    models.keyed_model("gemini-2.5-flash")
    assert built == []


# 7. No route: the running server does not load the package.

def test_importing_the_server_loads_no_agent_module():
    code = "import sys, app.main; print(sorted(m for m in sys.modules if m.startswith('app.agent')))"
    result = subprocess.run([sys.executable, "-c", code], cwd=SERVER_DIR, capture_output=True, text=True, check=True)
    assert result.stdout.strip() == "[]"
