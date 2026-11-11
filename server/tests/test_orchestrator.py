"""G08: the Jukebox orchestrator. No key, no network: the model is FakeLlm and the NASA tools are mocks."""
import asyncio
import json
from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from app.agent import orchestrator
from app.agent.fake import FakeLlm, FunctionCallSpec, last_user_text
from app.agent.orchestrator import (
    MAX_FRAMES,
    MAX_POINTS,
    MAX_REVISIONS,
    NO_DATA_FEEDBACK,
    REJECTED_WITHOUT_REASON,
    AgentOutputError,
    AudioPayload,
    VisionPayload,
    build_graph,
    fetch_nasa_gibs_images,
    fetch_nasa_power_data,
    route_after_critic,
    route_after_supervisor,
)

AUDIO = {"base_bpm": 90, "tracks": [{"instrument": "marimba", "pitch_range": [48, 72], "volume_curve": [0.2, 0.8, 0.5]}]}
VISION = {"descriptions": [{"timestamp_sec": 0.0, "alt_text": "The map is mostly pale.", "intensity_level": "low"}]}
APPROVE = {"is_approved": True, "feedback": ""}
REJECT = {"is_approved": False, "feedback": "Raise the volume where the text says high."}
QUERY = {"user_query": "How did Port Louis change in early July 2024?", "accessibility_profile": {"detail_level": "verbose"}}
RANGE = "2024-07-01/2024-07-05"


def _agent(request) -> str:
    """Which agent sent this request, read from its system instruction."""
    system = str(request.config.system_instruction)
    for name, marker in (("supervisor", "Jukebox Supervisor"), ("synthesizer", "Audio Engineer"),
                         ("vision", "Accessibility Describer"), ("critic", "Accessibility Auditor")):
        if marker in system:
            return name
    raise AssertionError("A request came from no known agent")


def _tool_results(request) -> int:
    return sum(1 for content in request.contents or [] for part in content.parts or [] if part.function_response)


def _model(verdicts, audio=AUDIO, vision=VISION, fetch=True):
    """A model that plays all four agents. `verdicts` are the critic's answers, in order; the last one repeats."""
    verdicts = list(verdicts)

    def script(request):
        agent = _agent(request)
        if agent == "supervisor":
            done = _tool_results(request)
            if fetch and done == 0:
                return FunctionCallSpec("fetch_nasa_power_data", {"location": "Port Louis", "date_range": RANGE})
            if fetch and done == 1:
                return FunctionCallSpec("fetch_nasa_gibs_images", {"location": "Port Louis", "date_range": RANGE})
            return "Done."
        if agent == "synthesizer":
            return audio
        if agent == "vision":
            return vision
        return verdicts.pop(0) if len(verdicts) > 1 else verdicts[0]

    return FakeLlm(script=script)


def _run(model, state=QUERY):
    return asyncio.run(build_graph(model).ainvoke(dict(state)))


def _calls(model, agent):
    return [request for request in model.calls if _agent(request) == agent]


def _context():
    """Stands in for ADK's ToolContext: the mock tools only write to `state`."""
    return SimpleNamespace(state={})


# 1. The graph


def test_an_approved_run_returns_both_payloads_and_no_feedback():
    model = _model([APPROVE])
    result = _run(model)
    assert result["critic_feedback"] == ""
    assert result["revision_count"] == 0
    assert result["audio_json_payload"] == AudioPayload.model_validate(AUDIO).model_dump()
    assert result["vision_text_payload"] == VisionPayload.model_validate(VISION).model_dump()
    assert len(result["nasa_numeric_data"][0]["values"]) == 5
    assert result["nasa_visual_data"][0] == "mock://gibs/port-louis/2024-07-01.png"
    assert len(result["nasa_visual_data"]) == 5
    assert [len(_calls(model, name)) for name in ("supervisor", "synthesizer", "vision", "critic")] == [3, 1, 1, 1]


def test_the_makers_get_the_data_and_the_profile():
    model = _model([APPROVE])
    result = _run(model)
    heard = json.loads(last_user_text(_calls(model, "synthesizer")[0]))
    seen = json.loads(last_user_text(_calls(model, "vision")[0]))
    assert heard == {"nasa_numeric_data": result["nasa_numeric_data"], "accessibility_profile": {"detail_level": "verbose"}}
    assert seen == {"nasa_visual_data": result["nasa_visual_data"], "accessibility_profile": {"detail_level": "verbose"}}
    audited = json.loads(last_user_text(_calls(model, "critic")[0]))
    assert audited["audio_payload"] == result["audio_json_payload"]
    assert audited["vision_payload"] == result["vision_text_payload"]


def test_a_critic_that_always_rejects_stops_at_the_cap_and_keeps_the_feedback():
    model = _model([REJECT])
    result = _run(model)
    assert result["revision_count"] == MAX_REVISIONS
    assert result["critic_feedback"] == REJECT["feedback"]
    assert result["audio_json_payload"]["base_bpm"] == 90
    assert result["vision_text_payload"]["descriptions"]
    assert [len(_calls(model, name)) for name in ("synthesizer", "vision", "critic")] == [MAX_REVISIONS + 1] * 3
    assert len(_calls(model, "supervisor")) == 3  # The data is fetched once, not once a round.


def test_one_rejection_redoes_both_payloads_with_the_feedback_then_approves():
    model = _model([REJECT, APPROVE])
    result = _run(model)
    assert result["revision_count"] == 1
    assert result["critic_feedback"] == ""
    for name in ("synthesizer", "vision"):
        first, second = (json.loads(last_user_text(request)) for request in _calls(model, name))
        assert "critic_feedback" not in first
        assert second["critic_feedback"] == REJECT["feedback"]
        assert second["previous_audio_payload"] == result["audio_json_payload"]
        assert second["previous_vision_payload"] == result["vision_text_payload"]


def test_a_rejection_with_no_reason_still_counts_as_rejected():
    result = _run(_model([{"is_approved": False, "feedback": "  "}, APPROVE]))
    assert result["revision_count"] == 1
    result = _run(_model([{"is_approved": False, "feedback": ""}]))
    assert result["revision_count"] == MAX_REVISIONS
    assert result["critic_feedback"] == REJECTED_WITHOUT_REASON


def test_approval_wins_over_stray_feedback():
    result = _run(_model([{"is_approved": True, "feedback": "Nice work."}]))
    assert result["critic_feedback"] == ""
    assert result["revision_count"] == 0


def test_a_supervisor_that_fetches_nothing_ends_the_run_without_calling_the_others():
    model = _model([APPROVE], fetch=False)
    result = _run(model)
    assert result["critic_feedback"] == NO_DATA_FEEDBACK
    assert result["audio_json_payload"] == {} and result["vision_text_payload"] == {}
    assert [len(_calls(model, name)) for name in ("synthesizer", "vision", "critic")] == [0, 0, 0]


@pytest.mark.parametrize(("audio", "vision"), [
    ("not json", VISION),
    ({"base_bpm": 90, "tracks": []}, VISION),
    (AUDIO, {"descriptions": [{"timestamp_sec": -1, "alt_text": "not json", "intensity_level": "low"}]}),
])
def test_an_answer_that_does_not_fit_its_schema_is_an_error_that_does_not_quote_it(audio, vision):
    with pytest.raises(AgentOutputError) as caught:
        _run(_model([APPROVE], audio=audio, vision=vision))
    assert "not json" not in str(caught.value)


def test_the_graph_builds_with_the_keyed_model_and_makes_no_call():
    assert build_graph() is not None


# 2. Routing


def test_routes():
    assert route_after_supervisor({"nasa_numeric_data": [1], "nasa_visual_data": ["a"]}) == ["synthesizer", "vision"]
    assert route_after_supervisor({"nasa_numeric_data": [1], "nasa_visual_data": []}) == ["finalize"]
    assert route_after_supervisor({}) == ["finalize"]
    assert route_after_critic({"critic_feedback": "", "revision_count": 0}) == "finalize"
    assert route_after_critic({"critic_feedback": "x", "revision_count": MAX_REVISIONS - 1}) == "prepare_revision"
    assert route_after_critic({"critic_feedback": "x", "revision_count": MAX_REVISIONS}) == "finalize"


# 3. The mock tools


def test_the_mock_tools_give_the_same_data_for_the_same_request():
    first, second = _context(), _context()
    assert fetch_nasa_power_data("Port Louis", RANGE, first) == fetch_nasa_power_data(" port  louis ", RANGE, second)
    assert first.state["nasa_numeric_data"][0]["values"] == second.state["nasa_numeric_data"][0]["values"]
    assert all(0.0 <= value <= 1.0 for value in first.state["nasa_numeric_data"][0]["values"])
    other = _context()
    fetch_nasa_power_data("Nairobi", RANGE, other)
    assert other.state["nasa_numeric_data"][0]["values"] != first.state["nasa_numeric_data"][0]["values"]


def test_the_mock_tools_cap_what_they_return():
    context = _context()
    assert fetch_nasa_power_data("Port Louis", "2020-01-01/2024-12-31", context)["points"] == MAX_POINTS
    assert fetch_nasa_gibs_images("Port Louis", "2020-01-01/2024-12-31", context)["frames"] == MAX_FRAMES
    assert len(context.state["nasa_visual_data"]) == MAX_FRAMES


@pytest.mark.parametrize(("location", "date_range"), [
    ("", RANGE),
    ("x" * 81, RANGE),
    (None, RANGE),
    ("Port Louis", "July 2024"),
    ("Port Louis", "2024-07-05/2024-07-01"),
    ("Port Louis", "2024-02-30/2024-03-01"),
    ("Port Louis", None),
])
@pytest.mark.parametrize("tool", [fetch_nasa_power_data, fetch_nasa_gibs_images])
def test_the_mock_tools_refuse_a_bad_request_and_store_nothing(tool, location, date_range):
    context = _context()
    assert "error" in tool(location, date_range, context)
    assert context.state == {}


# 4. The schemas


def test_the_audio_schema_refuses_values_a_synth_could_not_play():
    track = AUDIO["tracks"][0]
    for bad in ({"pitch_range": [72, 48]}, {"pitch_range": [48, 200]}, {"pitch_range": [60]}, {"volume_curve": [1.5]},
                {"volume_curve": []}, {"instrument": ""}):
        with pytest.raises(ValidationError):
            AudioPayload.model_validate({"base_bpm": 90, "tracks": [{**track, **bad}]})
    with pytest.raises(ValidationError):
        AudioPayload.model_validate({**AUDIO, "base_bpm": 0})


def test_the_agents_cannot_hand_over_to_each_other_and_only_the_supervisor_has_tools():
    agents = orchestrator.build_agents(_model([APPROVE]))
    assert [tool.name for tool in agents.supervisor.tools] == ["fetch_nasa_power_data", "fetch_nasa_gibs_images"]
    for agent in (agents.synthesizer, agents.vision, agents.critic):
        assert agent.tools == []
    for agent in (agents.supervisor, agents.synthesizer, agents.vision, agents.critic):
        assert agent.disallow_transfer_to_parent and agent.disallow_transfer_to_peers
