"""G08: the Jukebox orchestrator. No key, no network: the model is FakeLlm and the NASA tools are mocks."""
import asyncio
import json
from datetime import date, timedelta
from types import SimpleNamespace

import httpx
import pytest
from google.genai import types
from langgraph.errors import GraphRecursionError
from langgraph.graph import END
from pydantic import ValidationError

from app.agent import orchestrator
from app.agent.fake import FakeLlm, FunctionCallSpec, last_user_text
from app.agent.orchestrator import (
    FRAME_HOSTS,
    FRAME_COUNT,
    MAX_POINTS,
    MAX_REVISIONS,
    RECURSION_LIMIT,
    NO_DATA_FEEDBACK,
    REJECTED_WITHOUT_REASON,
    AgentOutputError,
    FrameFetchError,
    AudioPayload,
    VisionPayload,
    build_graph,
    fetch_nasa_gibs_images,
    fetch_nasa_power_data,
    frame_url,
    route_after_critic,
    route_after_supervisor,
)

AUDIO = {"base_bpm": 90, "tracks": [{"instrument": "marimba", "pitch_range": [48, 72], "volume_curve": [0.2, 0.8, 0.5]}]}
VISION = {"descriptions": [{"timestamp_sec": 0.0, "alt_text": "The map is mostly pale.", "intensity_level": "low"}]}
APPROVE = {"is_approved": True, "feedback": ""}
REJECT = {"is_approved": False, "feedback": "Raise the volume where the text says high."}
QUERY = {"user_query": "How did Port Louis change in early July 2024?", "accessibility_profile": {"detail_level": "verbose"}}
RANGE = "2024-07-01/2024-07-05"
FRAMES = [frame_url(date(2024, 7, day)) for day in (1, 3, 5)]  # The first, middle and last day of RANGE.


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


@pytest.fixture(autouse=True)
def _no_network(monkeypatch):
    """The vision node fetches its frames. Here each one is a few fake bytes, and the addresses asked for are kept."""
    asked = []

    async def frames(uris):
        asked.append(list(uris))
        return [types.Part.from_bytes(data=b"frame", mime_type="image/jpeg") for _ in uris]

    monkeypatch.setattr(orchestrator, "_frame_parts", frames)
    return asked


# 1. The graph


def test_an_approved_run_returns_both_payloads_and_no_feedback():
    model = _model([APPROVE])
    result = _run(model)
    assert result["critic_feedback"] == ""
    assert result["revision_count"] == 0
    assert result["audio_json_payload"] == AudioPayload.model_validate(AUDIO).model_dump()
    assert result["vision_text_payload"] == VisionPayload.model_validate(VISION).model_dump()
    assert len(result["nasa_numeric_data"][0]["values"]) == 5
    assert result["nasa_visual_data"] == FRAMES
    assert [len(_calls(model, name)) for name in ("supervisor", "synthesizer", "vision", "critic")] == [3, 1, 1, 1]


def test_the_makers_get_the_data_and_the_profile(_no_network):
    model = _model([APPROVE])
    result = _run(model)
    heard = json.loads(last_user_text(_calls(model, "synthesizer")[0]))
    seen = json.loads(last_user_text(_calls(model, "vision")[0]))
    assert heard == {"nasa_numeric_data": result["nasa_numeric_data"], "accessibility_profile": {"detail_level": "verbose"}}
    assert seen == {"nasa_visual_data": result["nasa_visual_data"], "accessibility_profile": {"detail_level": "verbose"}}
    images = [part.inline_data for part in _calls(model, "vision")[0].contents[-1].parts if part.inline_data]
    assert [image.mime_type for image in images] == ["image/jpeg"] * 3  # The describer gets the pixels, not only addresses.
    assert _no_network == [FRAMES]
    audited = json.loads(last_user_text(_calls(model, "critic")[0]))
    assert audited["audio_payload"] == result["audio_json_payload"]
    assert audited["audio_stats"] == [{"instrument": "marimba", "volume_min": 0.2, "volume_max": 0.8, "volume_curve_delta": 0.6,
                                       "pitch_span_semitones": 24}]
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


def test_the_compiled_graph_carries_the_step_cap():
    assert RECURSION_LIMIT == 4 + 3 * MAX_REVISIONS
    assert build_graph(_model([APPROVE])).config["recursion_limit"] == RECURSION_LIMIT


def test_a_critic_loop_that_never_ends_is_cut_off_by_the_step_cap(monkeypatch):
    monkeypatch.setattr(orchestrator, "route_after_critic", lambda state: "prepare_revision")
    model = _model([REJECT])
    with pytest.raises(GraphRecursionError):
        _run(model)
    # Not one model call past what the longest allowed run makes.
    assert [len(_calls(model, name)) for name in ("synthesizer", "vision", "critic")] == [MAX_REVISIONS + 1] * 3


def test_the_graph_builds_with_the_keyed_model_and_makes_no_call():
    assert build_graph() is not None


# 2. Routing


def test_routes():
    assert route_after_supervisor({"nasa_numeric_data": [1], "nasa_visual_data": ["a"]}) == ["synthesizer", "vision"]
    assert route_after_supervisor({"nasa_numeric_data": [1], "nasa_visual_data": []}) == [END]
    assert route_after_supervisor({}) == [END]
    assert route_after_critic({"critic_feedback": "", "revision_count": 0}) == END
    assert route_after_critic({"critic_feedback": "x", "revision_count": MAX_REVISIONS - 1}) == "prepare_revision"
    assert route_after_critic({"critic_feedback": "x", "revision_count": MAX_REVISIONS}) == END


# 3. The mock tools


def test_the_mock_tools_give_the_same_data_for_the_same_request():
    first, second = _context(), _context()
    assert fetch_nasa_power_data("Port Louis", RANGE, first) == fetch_nasa_power_data(" port  louis ", RANGE, second)
    assert first.state["nasa_numeric_data"][0]["values"] == second.state["nasa_numeric_data"][0]["values"]
    assert all(0.0 <= value <= 1.0 for value in first.state["nasa_numeric_data"][0]["values"])
    other = _context()
    fetch_nasa_power_data("Nairobi", RANGE, other)
    assert other.state["nasa_numeric_data"][0]["values"] != first.state["nasa_numeric_data"][0]["values"]


def test_the_same_range_gives_numbers_and_frames_that_cover_the_same_period():
    for date_range, first, last in (("2024-01-01/2024-07-31", "2024-01-01", "2024-07-31"), ("2020-01-01/2024-12-31", "2020-01-01", "2024-12-31"),
                                    (RANGE, "2024-07-01", "2024-07-05"), ("2024-07-01/2024-07-01", "2024-07-01", "2024-07-01")):
        context = _context()
        numbers = fetch_nasa_power_data("Global", date_range, context)
        frames = fetch_nasa_gibs_images("Global", date_range, context)
        assert (numbers["first"], numbers["last"]) == (frames["first"], frames["last"]) == (first, last)
        dates = context.state["nasa_numeric_data"][0]["dates"]
        assert (dates[0], dates[-1]) == (first, last) and dates == sorted(set(dates))
        assert context.state["nasa_visual_data"][0] == frame_url(date.fromisoformat(first))
        assert context.state["nasa_visual_data"][-1] == frame_url(date.fromisoformat(last))


def test_the_mock_tools_cap_what_they_return():
    context = _context()
    assert fetch_nasa_power_data("Port Louis", "2020-01-01/2024-12-31", context)["points"] == MAX_POINTS
    assert fetch_nasa_gibs_images("Port Louis", "2020-01-01/2024-12-31", context)["frames"] == FRAME_COUNT
    assert fetch_nasa_gibs_images("Port Louis", "2024-07-01/2024-07-02", context)["frames"] == 2


def test_the_mock_frames_are_real_addresses_on_an_allowed_host():
    context = _context()
    assert fetch_nasa_gibs_images("Port Louis", RANGE, context) == {"ok": True, "frames": 3, "first": "2024-07-01", "last": "2024-07-05"}
    assert context.state["nasa_visual_data"] == FRAMES
    assert all(httpx.URL(url).scheme == "https" and httpx.URL(url).host in FRAME_HOSTS for url in FRAMES)
    assert "TIME=2024-07-03" in FRAMES[1]


@pytest.mark.parametrize("date_range", [
    "1999-12-01/2000-03-01",
    f"2024-01-01/{date.today().isoformat()}",
    f"{(date.today() + timedelta(days=1)).isoformat()}/{(date.today() + timedelta(days=9)).isoformat()}",
])
def test_no_frames_for_days_the_satellite_has_no_image_of(date_range):
    context = _context()
    assert "error" in fetch_nasa_gibs_images("Global", date_range, context)
    assert context.state == {}


def test_the_prompts_carry_the_agreed_rules():
    assert "default to a 'Global' context" in orchestrator.SUPERVISOR_INSTRUCTION
    assert "cover the exact same time period" in orchestrator.SUPERVISOR_INSTRUCTION
    assert "Do not rubber-stamp approvals" in orchestrator.CRITIC_INSTRUCTION
    assert "volume_curve delta must not exceed 0.3" in orchestrator.CRITIC_INSTRUCTION


def _fetch(uri, handler):
    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            return await orchestrator._fetch_frame(client, uri)

    return asyncio.run(run())


def test_a_frame_comes_back_as_image_bytes():
    part = _fetch(FRAMES[0], lambda request: httpx.Response(200, content=b"jpeg", headers={"content-type": "image/jpeg"}))
    assert part.inline_data.data == b"jpeg" and part.inline_data.mime_type == "image/jpeg"


def test_a_dropped_connection_is_tried_once_more_and_no_more():
    seen = []

    def flaky(request):
        seen.append(request.url)
        if len(seen) == 1:
            raise httpx.ConnectError("dropped")
        return httpx.Response(200, content=b"jpeg", headers={"content-type": "image/jpeg"})

    assert _fetch(FRAMES[0], flaky).inline_data.data == b"jpeg"
    assert len(seen) == 2

    def down(request):
        seen.append(request.url)
        raise httpx.ConnectError("dropped")

    with pytest.raises(FrameFetchError):
        _fetch(FRAMES[0], down)
    assert len(seen) == 2 + orchestrator.FRAME_ATTEMPTS


@pytest.mark.parametrize("uri", [
    "http://gibs.earthdata.nasa.gov/a.jpg",
    "https://example.com/a.jpg",
    "https://gibs.earthdata.nasa.gov.example.com/a.jpg",
    "https://169.254.169.254/latest/meta-data",
    "file:///etc/passwd",
    "mock://gibs/a.png",
    None,
])
def test_an_address_off_the_list_is_refused_before_any_request(uri):
    def handler(request):
        raise AssertionError("A request was made")

    with pytest.raises(FrameFetchError):
        _fetch(uri, handler)


@pytest.mark.parametrize("response", [
    httpx.Response(404, content=b"", headers={"content-type": "image/jpeg"}),
    httpx.Response(200, content=b"<html>", headers={"content-type": "text/html"}),
    httpx.Response(302, headers={"location": "https://example.com/a.jpg"}),
    httpx.Response(200, content=b"x" * (orchestrator.MAX_FRAME_BYTES + 1), headers={"content-type": "image/png"}),
])
def test_a_frame_that_is_not_a_usable_image_is_an_error(response):
    with pytest.raises(FrameFetchError):
        _fetch(FRAMES[0], lambda request: response)


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
