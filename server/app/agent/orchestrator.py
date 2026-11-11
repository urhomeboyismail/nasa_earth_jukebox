"""The Jukebox orchestrator (G08): a LangGraph that runs four Google ADK agents.

    START → supervisor → (synthesizer ∥ vision) → critic → END
                              ↑                      │ rejected, and revisions left
                              └── prepare_revision ──┘

The supervisor fetches the data with its tools. The synthesizer turns the numbers into sound parameters while the vision agent
turns the frames into time-coded text. The critic checks the two against each other and against the accessibility profile. A
rejected round redoes both, so they stay in step, at most MAX_REVISIONS times. After that the graph returns the last payloads
with `critic_feedback` still set, so the caller can tell they were not approved.

Exception to ADR-0005: The Vision Context Agent is permitted to generate raw user-facing sentences because dynamic alt-text
generation is a core accessibility requirement for screen readers, unlike standard UI copy.

Every run is billed, so two caps hold whatever the critic says: `route_after_critic` stops after MAX_REVISIONS, and the compiled
graph carries RECURSION_LIMIT, one step more than the longest allowed run takes. If the routing were ever wrong, LangGraph would
raise GraphRecursionError there, and that one extra step is `prepare_revision`, which calls no model. The longest run is a few supervisor calls
plus 3 calls a round for MAX_REVISIONS + 1 rounds.

The two NASA tools are mocks. The numbers are made up. The frames are three fixed, real NASA GIBS images, so the vision agent
has pixels to look at; they are the same three whatever place or dates are asked for. The vision node fetches them itself, only
over https and only from FRAME_HOSTS, and sends the bytes to the model.

Model output is untrusted. Each payload is checked against its Pydantic schema before it enters the graph state, and the fetched
data is put into the state by the tools, never copied from text the model wrote.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Annotated, Literal, Sequence, TypedDict, TypeVar
from urllib.parse import urlsplit

import httpx

from google.adk.agents import LlmAgent
from google.adk.models import BaseLlm
from google.adk.runners import InMemoryRunner
from google.adk.tools import FunctionTool, ToolContext
from google.genai import types
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel, Field, ValidationError, model_validator

from app.agent.models import keyed_model
from app.config import settings

MAX_REVISIONS = 3
#: The longest allowed run takes 3 steps (supervisor, the two makers together, critic) plus 3 for each revision
#: (prepare_revision, the two makers, critic). LangGraph needs the limit to be one above that. A run that tried to go on would
#: spend that last step on prepare_revision, which calls no model, and be stopped before the makers ran again.
RECURSION_LIMIT = 4 + 3 * MAX_REVISIONS
#: The mock numbers tool returns at most this many days of values.
MAX_POINTS = 62
MAX_LOCATION_CHARS = 80

APP_NAME = "jukebox_orchestrator"
USER_ID = "jukebox"
NUMERIC_KEY = "nasa_numeric_data"
VISUAL_KEY = "nasa_visual_data"

_GIBS_FRAME = (
    "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0"
    "&LAYERS=MODIS_Terra_CorrectedReflectance_TrueColor&FORMAT=image/jpeg&WIDTH=768&HEIGHT=384&CRS=EPSG:4326"
    "&BBOX=-90,-180,90,180&TIME={day}"
)
#: The mock frames: the whole Earth in true colour (MODIS Terra, from NASA GIBS) on three days of 2024.
MOCK_FRAME_URLS = tuple(_GIBS_FRAME.format(day=day) for day in ("2024-01-15", "2024-04-15", "2024-07-15"))
#: The only hosts the vision node will fetch a frame from, and what it will accept back.
FRAME_HOSTS = frozenset({"gibs.earthdata.nasa.gov"})
FRAME_TYPES = frozenset({"image/jpeg", "image/png"})
MAX_FRAME_BYTES = 2_000_000
FRAME_TIMEOUT_SECONDS = 15.0

NO_DATA_FEEDBACK = "No NASA data was fetched for this request, so no sound or description was made."
REJECTED_WITHOUT_REASON = "The auditor rejected the payloads without saying what to change."


class JukeboxState(TypedDict, total=False):
    """The state every node reads and writes. A caller gives `user_query` and `accessibility_profile`; the graph fills the rest."""

    user_query: str
    accessibility_profile: dict  # e.g. {"contrast": "high", "detail_level": "verbose"}
    nasa_visual_data: list  # Paths or URIs to visual frames
    nasa_numeric_data: list  # Raw time-series data arrays
    audio_json_payload: dict  # Generated MIDI/OSC parameters (an AudioPayload)
    vision_text_payload: dict  # Generated time-coded descriptive text (a VisionPayload)
    critic_feedback: str  # Instructions if the Critic rejects the payloads; "" means approved
    revision_count: int  # Completed revision rounds, at most MAX_REVISIONS


class AgentOutputError(RuntimeError):
    """An agent's final answer did not fit its schema. The message names the agent only, never what the model wrote."""


class FrameFetchError(RuntimeError):
    """A frame could not be fetched for the vision agent, or its address is not one the server may fetch."""


# --- Schemas the agents must answer in --------------------------------------------------------------------------------


class AudioTrack(BaseModel):
    instrument: str = Field(min_length=1)
    pitch_range: list[Annotated[int, Field(ge=0, le=127)]] = Field(
        min_length=2, max_length=2, description="Lowest and highest MIDI note, in that order."
    )
    volume_curve: list[Annotated[float, Field(ge=0.0, le=1.0)]] = Field(
        min_length=1, description="Loudness over time, each value from 0 (silent) to 1 (full)."
    )

    @model_validator(mode="after")
    def _low_note_first(self) -> AudioTrack:
        if self.pitch_range[0] > self.pitch_range[1]:
            raise ValueError("pitch_range must be lowest note first")
        return self


class AudioPayload(BaseModel):
    base_bpm: int = Field(ge=20, le=300)
    tracks: list[AudioTrack] = Field(min_length=1)


class VisionDescription(BaseModel):
    timestamp_sec: float = Field(ge=0.0)
    alt_text: str = Field(min_length=1)
    intensity_level: Literal["low", "medium", "high"]


class VisionPayload(BaseModel):
    descriptions: list[VisionDescription] = Field(min_length=1)


class CriticEvaluation(BaseModel):
    is_approved: bool
    feedback: str = Field(default="", description="Leave empty if approved.")


Schema = TypeVar("Schema", bound=BaseModel)


# --- Mock NASA tools ----------------------------------------------------------------------------------------------------


def _days(date_range: str) -> list[date] | None:
    """The days of a "YYYY-MM-DD/YYYY-MM-DD" range, first to last, or None if it is not one."""
    try:
        start_text, end_text = date_range.split("/")
        start, end = date.fromisoformat(start_text.strip()), date.fromisoformat(end_text.strip())
    except ValueError:
        return None
    if end < start:
        return None
    return [start + timedelta(days=offset) for offset in range((end - start).days + 1)]


def _checked(location: str, date_range: str) -> tuple[str, list[date]] | dict:
    """The cleaned location and the days asked for, or the error dict to hand back to the model."""
    place = " ".join(location.split()) if isinstance(location, str) else ""
    if not place or len(place) > MAX_LOCATION_CHARS:
        return {"error": "Give the location as a short place name."}
    days = _days(date_range) if isinstance(date_range, str) else None
    if days is None:
        return {"error": "Give the date range as YYYY-MM-DD/YYYY-MM-DD, first day then last day."}
    return place, days


def _mock_value(place: str, day: date) -> float:
    """A value from 0 to 1 that depends only on the place and the day, so the same request always gives the same data."""
    digest = hashlib.sha256(f"{place.lower()}|{day.isoformat()}".encode()).digest()
    return round(int.from_bytes(digest[:4], "big") / 0xFFFFFFFF, 4)


def fetch_nasa_power_data(location: str, date_range: str, tool_context: ToolContext) -> dict:
    """Fetch the daily numbers for a place and a time period. Give date_range as YYYY-MM-DD/YYYY-MM-DD, first day then last day.
    The data goes straight into the graph state as nasa_numeric_data; this returns only how much was fetched."""
    checked = _checked(location, date_range)
    if isinstance(checked, dict):
        return checked
    place, days = checked
    days = days[:MAX_POINTS]
    series = {
        "mock": True,
        "location": place,
        "parameter": "mock_value",
        "dates": [day.isoformat() for day in days],
        "values": [_mock_value(place, day) for day in days],
    }
    tool_context.state[NUMERIC_KEY] = [series]
    return {"ok": True, "points": len(days), "first": series["dates"][0], "last": series["dates"][-1]}


def fetch_nasa_gibs_images(location: str, date_range: str, tool_context: ToolContext) -> dict:
    """Fetch the image frames for a place and a time period. Give date_range as YYYY-MM-DD/YYYY-MM-DD, first day then last day.
    The frame addresses go straight into the graph state as nasa_visual_data; this returns only how many were fetched."""
    checked = _checked(location, date_range)
    if isinstance(checked, dict):
        return checked
    # A mock: the same three real frames whatever was asked for.
    tool_context.state[VISUAL_KEY] = list(MOCK_FRAME_URLS)
    return {"ok": True, "frames": len(MOCK_FRAME_URLS)}


SUPERVISOR_TOOLS = [FunctionTool(fetch_nasa_power_data), FunctionTool(fetch_nasa_gibs_images)]


# --- The four agents ----------------------------------------------------------------------------------------------------

SUPERVISOR_INSTRUCTION = (
    "You are the Jukebox Supervisor. Use your tools to fetch the data required to answer the user's query. Once fetched, "
    "output the data directly into the graph state as nasa_numeric_data and nasa_visual_data."
)
SYNTHESIZER_INSTRUCTION = (
    "You are the Audio Engineer. Map the nasa_numeric_data to the AudioPayload schema. Read the accessibility_profile to "
    "determine the sonic contrast (e.g., higher volume curves for low-vision users). If critic_feedback is present, you MUST "
    "adjust your previous parameters to fix the stated issues."
)
VISION_INSTRUCTION = (
    "You are the Accessibility Describer. Analyze the nasa_visual_data. Output a VisionPayload of time-coded descriptions. "
    "Ensure the verbosity matches the accessibility_profile. If critic_feedback is present, adjust your text to better "
    "synchronize with the audio intent."
)
CRITIC_INSTRUCTION = (
    "You are the Accessibility Auditor. Review the Audio Payload and Vision Payload. Does the sonic contrast match the text's "
    "intensity? Does it follow the user's accessibility_profile? If perfectly synced and compliant, set is_approved to True. "
    "If not, set it to False and write explicitly what the Synthesizer and Vision agents need to change in the feedback field."
)


@dataclass(frozen=True)
class JukeboxAgents:
    supervisor: LlmAgent
    synthesizer: LlmAgent
    vision: LlmAgent
    critic: LlmAgent


def build_agents(model: BaseLlm | None = None) -> JukeboxAgents:
    """The four agents on one model. The default is the keyed Gemini model, which builds no client until it is first called."""
    llm = model or keyed_model(settings.orchestrator_model)
    alone = {"disallow_transfer_to_parent": True, "disallow_transfer_to_peers": True}
    return JukeboxAgents(
        supervisor=LlmAgent(
            name="supervisor",
            model=llm,
            description="Works out the place and the time period, and fetches the data.",
            instruction=SUPERVISOR_INSTRUCTION,
            tools=SUPERVISOR_TOOLS,
            **alone,
        ),
        synthesizer=LlmAgent(
            name="synthesizer",
            model=llm,
            description="Turns the numbers into sound parameters.",
            instruction=SYNTHESIZER_INSTRUCTION,
            output_schema=AudioPayload,
            **alone,
        ),
        vision=LlmAgent(
            name="vision",
            model=llm,
            description="Turns the frames into time-coded text for a screen reader.",
            instruction=VISION_INSTRUCTION,
            output_schema=VisionPayload,
            **alone,
        ),
        critic=LlmAgent(
            name="critic",
            model=llm,
            description="Checks the sound and the text against each other and against the accessibility profile.",
            instruction=CRITIC_INSTRUCTION,
            output_schema=CriticEvaluation,
            **alone,
        ),
    )


# --- Running one agent ----------------------------------------------------------------------------------------------------


async def _fetch_frame(client: httpx.AsyncClient, uri: str) -> types.Part:
    """One frame as image bytes for the model. Refuses any address that is not https on an allowed host, before any request."""
    address = urlsplit(uri) if isinstance(uri, str) else None
    if address is None or address.scheme != "https" or address.hostname not in FRAME_HOSTS:
        raise FrameFetchError("A frame address is not one the server may fetch.")
    try:
        response = await client.get(uri)
    except httpx.HTTPError as error:
        raise FrameFetchError("A frame could not be fetched.") from error
    kind = response.headers.get("content-type", "").split(";")[0].strip().lower()
    if response.status_code != 200 or kind not in FRAME_TYPES or len(response.content) > MAX_FRAME_BYTES:
        raise FrameFetchError("A frame did not come back as a usable image.")
    return types.Part.from_bytes(data=response.content, mime_type=kind)


async def _frame_parts(uris: Sequence[str]) -> list[types.Part]:
    """Every frame, in order. One that fails fails the run: text for fewer frames than the sound covers would be out of step."""
    async with httpx.AsyncClient(timeout=FRAME_TIMEOUT_SECONDS, follow_redirects=False) as client:
        return list(await asyncio.gather(*(_fetch_frame(client, uri) for uri in uris)))


async def _run_agent(agent: LlmAgent, text: str, images: Sequence[types.Part] = ()) -> tuple[str, dict]:
    """One turn of one agent in a fresh session. Returns its final text and the session state its tools left behind."""
    runner = InMemoryRunner(agent=agent, app_name=APP_NAME)
    session = await runner.session_service.create_session(app_name=APP_NAME, user_id=USER_ID)
    message = types.Content(role="user", parts=[types.Part(text=text), *images])
    final = ""
    async for event in runner.run_async(user_id=USER_ID, session_id=session.id, new_message=message):
        if event.is_final_response() and event.content:
            final = "".join(part.text or "" for part in event.content.parts or [])
    stored = await runner.session_service.get_session(app_name=APP_NAME, user_id=USER_ID, session_id=session.id)
    return final, dict(stored.state) if stored else {}


async def _run_structured(
    agent: LlmAgent, payload: dict, schema: type[Schema], images: Sequence[types.Part] = ()
) -> Schema:
    """Run an agent on a JSON message, with any images after it, and check its answer against the schema."""
    final, _ = await _run_agent(agent, json.dumps(payload, default=str), images)
    try:
        return schema.model_validate_json(final)
    except ValidationError as error:
        raise AgentOutputError(f"The {agent.name} agent's answer did not fit {schema.__name__}.") from error


# --- The graph ----------------------------------------------------------------------------------------------------------


def route_after_supervisor(state: JukeboxState) -> list[str]:
    if state.get("nasa_numeric_data") and state.get("nasa_visual_data"):
        return ["synthesizer", "vision"]  # Fan out: sound and text are made in parallel from the same data.
    return [END]  # Nothing to work from; critic_feedback says so.


def route_after_critic(state: JukeboxState) -> str:
    if not state.get("critic_feedback"):
        return END  # Approved.
    if state.get("revision_count", 0) >= MAX_REVISIONS:
        return END  # Out of revisions: the last payloads go back with the feedback still set.
    return "prepare_revision"


def build_graph(model: BaseLlm | None = None):
    """Compile the graph, capped at RECURSION_LIMIT steps. Run it with
    `await graph.ainvoke({"user_query": ..., "accessibility_profile": ...})`."""
    agents = build_agents(model)

    async def supervisor(state: JukeboxState) -> dict:
        _, fetched = await _run_agent(agents.supervisor, state.get("user_query", ""))
        numeric, visual = fetched.get(NUMERIC_KEY) or [], fetched.get(VISUAL_KEY) or []
        return {
            "nasa_numeric_data": numeric,
            "nasa_visual_data": visual,
            "audio_json_payload": {},
            "vision_text_payload": {},
            "critic_feedback": "" if numeric and visual else NO_DATA_FEEDBACK,
            "revision_count": 0,
        }

    def _revision_context(state: JukeboxState) -> dict:
        """What both makers need on a rejected round: the feedback and what each of them made last time."""
        if not state.get("critic_feedback"):
            return {}
        return {
            "critic_feedback": state["critic_feedback"],
            "previous_audio_payload": state.get("audio_json_payload", {}),
            "previous_vision_payload": state.get("vision_text_payload", {}),
        }

    async def synthesizer(state: JukeboxState) -> dict:
        message = {
            "nasa_numeric_data": state.get("nasa_numeric_data", []),
            "accessibility_profile": state.get("accessibility_profile", {}),
            **_revision_context(state),
        }
        payload = await _run_structured(agents.synthesizer, message, AudioPayload)
        return {"audio_json_payload": payload.model_dump()}

    async def vision(state: JukeboxState) -> dict:
        message = {
            "nasa_visual_data": state.get("nasa_visual_data", []),
            "accessibility_profile": state.get("accessibility_profile", {}),
            **_revision_context(state),
        }
        # The frames follow the message as images, in the order nasa_visual_data lists them.
        images = await _frame_parts(message["nasa_visual_data"])
        payload = await _run_structured(agents.vision, message, VisionPayload, images)
        return {"vision_text_payload": payload.model_dump()}

    async def critic(state: JukeboxState) -> dict:
        message = {
            "audio_payload": state.get("audio_json_payload", {}),
            "vision_payload": state.get("vision_text_payload", {}),
            "accessibility_profile": state.get("accessibility_profile", {}),
        }
        evaluation = await _run_structured(agents.critic, message, CriticEvaluation)
        if evaluation.is_approved:
            return {"critic_feedback": ""}
        return {"critic_feedback": evaluation.feedback.strip() or REJECTED_WITHOUT_REASON}

    def prepare_revision(state: JukeboxState) -> dict:
        return {"revision_count": state.get("revision_count", 0) + 1}

    graph = StateGraph(JukeboxState)
    graph.add_node("supervisor", supervisor)
    graph.add_node("synthesizer", synthesizer)
    graph.add_node("vision", vision)
    graph.add_node("critic", critic)
    graph.add_node("prepare_revision", prepare_revision)

    graph.add_edge(START, "supervisor")
    graph.add_conditional_edges("supervisor", route_after_supervisor, ["synthesizer", "vision", END])
    # Fan in: the critic runs once, after both have finished.
    graph.add_edge(["synthesizer", "vision"], "critic")
    graph.add_conditional_edges("critic", route_after_critic, [END, "prepare_revision"])
    # A rejected round redoes both payloads, each reading critic_feedback.
    graph.add_edge("prepare_revision", "synthesizer")
    graph.add_edge("prepare_revision", "vision")
    # The hard cap on a run, whatever the routes above do. See RECURSION_LIMIT.
    return graph.compile().with_config({"recursion_limit": RECURSION_LIMIT})
