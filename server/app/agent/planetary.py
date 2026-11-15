"""Echo fetches live data from Microsoft Planetary Computer (G11): one question in, a reply, a theme and an AudioPayload out.

One ADK agent with three tools. The model only chooses tool arguments: which app data set answers the question, which
Planetary Computer collection, area and dates to fetch, or which point and hours of weather to fetch from Meteomatics (WX01,
app/agent/weather.py). The tools check those arguments and put what they fetched into the
session state. The reply is a template filled from the fetched numbers, never text the model wrote (ADR-0005), and the
sound is built from the numbers with no model call.

Reading values goes through the Planetary Computer data API (titiler) over httpx, so the server needs no rasterio or xarray.
shortcut: only collections with metadata values or COG assets are listed (no era5-pds, which is Zarr, and no nasadem, which
has no time series); add a reader that opens Zarr with xarray when a data set needs one.

Manual check against the live API, with no model: `.venv/bin/python -m app.agent.planetary`.
"""
from __future__ import annotations

import asyncio
import logging
import json
import urllib.parse
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timezone
from functools import lru_cache
from itertools import pairwise
from typing import Awaitable, Callable

import httpx
from google.adk.agents import LlmAgent, RunConfig
from google.adk.models import BaseLlm
from google.adk.runners import InMemoryRunner
from google.adk.tools import FunctionTool, ToolContext
from google.genai import types

from app.agent import weather
from app.agent.orchestrator import AudioPayload, _spread
from app.config import settings

logger = logging.getLogger(__name__)

STAC_URL = "https://planetarycomputer.microsoft.com/api/stac/v1"
DATA_URL = "https://planetarycomputer.microsoft.com/api/data/v1"
STATISTICS_URL = f"{DATA_URL}/item/statistics"
APP_NAME = "mascot"
USER_ID = "anonymous"
SERIES_KEY = "pc_series"
LOCAL_KEY = "local_dataset_id"
ERROR_KEY = "pc_error"
#: "off" when no Meteomatics login is set, "down" when Meteomatics refused or did not answer.
WEATHER_ERROR_KEY = "weather_error"
WEATHER_SOURCE = "meteomatics-t_2m"
IMAGES_KEY = "pc_images"

#: The most values a series keeps (and so the most statistics calls one request makes), spread from the first day to the last.
MAX_POINTS = 31
MAX_ITEMS = 500
MAX_DAYS = 366
#: The largest area, in degrees on each side: a country or a sea, not a continent.
MAX_SPAN_DEGREES = 10.0
#: Model calls one request may make: pick the tool, maybe correct its arguments once, then finish.
MAX_LLM_CALLS = 4
PARALLEL_READS = 8
READ_TIMEOUT_SECONDS = 15.0
#: Pictures of the area (G12): at most one a day, spread over the period. The browser downloads them, not the server.
MAX_IMAGES = 6
#: Sentinel-2 only: the cloudiest scene a picture may come from, in %.
MAX_IMAGE_CLOUD = 30
#: The least share of the picture area a Sentinel-2 scene must cover to be shown.
MIN_IMAGE_COVER = 0.5
#: Sentinel-2 only: the largest picture, in degrees each way. 10 m pixels: a bigger area is slow and blurs to nothing at 512 px.
MAX_IMAGE_SPAN_DEGREES = 0.5
IMAGE_WIDTH = 512

Point = tuple[date, float]
Reader = Callable[[list, list[float]], Awaitable[list[Point]]]


def _day(item) -> date:
    """An item's day. Daily collections like OISST give only start_datetime."""
    return (item.datetime or item.common_metadata.start_datetime).date()


async def _cloud_cover(items: list, bbox: list[float]) -> list[Point]:
    """Sentinel-2's cloud cover, from each scene's metadata: the mean over the scenes of each day."""
    days: dict[date, list[float]] = defaultdict(list)
    for item in items:
        cover = item.properties.get("eo:cloud_cover")
        if isinstance(cover, (int, float)):
            days[_day(item)].append(float(cover))
    points = [(day, sum(values) / len(values)) for day, values in sorted(days.items())]
    return _spread(points, MAX_POINTS)


def _feature(bbox: list[float]) -> dict:
    west, south, east, north = bbox
    ring = [[west, south], [east, south], [east, north], [west, north], [west, south]]
    return {"type": "Feature", "properties": {}, "geometry": {"type": "Polygon", "coordinates": [ring]}}


async def _sst_mean(items: list, bbox: list[float]) -> list[Point]:
    """OISST's daily sea surface temperature: the mean over the area, from the data API's statistics, scaled to °C."""
    days = _spread(sorted(items, key=_day), MAX_POINTS)
    key = settings.pc_sdk_subscription_key.get_secret_value()
    headers = {"Ocp-Apim-Subscription-Key": key} if key else {}
    gate = asyncio.Semaphore(PARALLEL_READS)

    async def one(client: httpx.AsyncClient, item) -> Point | None:
        band = (item.assets["sst"].extra_fields.get("raster:bands") or [{}])[0]
        async with gate:
            response = await client.post(
                STATISTICS_URL,
                params={"collection": item.collection_id, "item": item.id, "assets": "sst"},
                json=_feature(bbox),
                headers=headers,
            )
        response.raise_for_status()
        stats = response.json()["properties"]["statistics"].get("sst_b1") or {}
        if not stats.get("valid_pixels") or stats.get("mean") is None:
            return None  # all land, or all masked
        return _day(item), stats["mean"] * band.get("scale", 1) + band.get("offset", 0)

    async with httpx.AsyncClient(timeout=READ_TIMEOUT_SECONDS) as client:
        points = await asyncio.gather(*(one(client, item) for item in days))
    return [point for point in points if point]


#: The OISST ramp: (°C, rgb) anchors, interpolated. Fixed, so a colour always means the same temperature.
SST_ANCHORS = [(-2, (49, 54, 149)), (7, (116, 173, 209)), (16, (255, 255, 191)), (26, (244, 109, 67)), (35, (165, 0, 38))]


def _ramp(value: float) -> list[int]:
    for (low, start), (high, end) in pairwise(SST_ANCHORS):
        if value <= high:
            t = (value - low) / (high - low)
            return [round(a + t * (b - a)) for a, b in zip(start, end, strict=True)]
    return list(SST_ANCHORS[-1][1])


def sst_bands() -> tuple[list, list[dict]]:
    """One band per degree from -2 to 35 °C, coloured at its centre: the data API's interval colormap (raw int16, scale
    0.01) and the legend's stops. Built together so they cannot drift. Kept short: a long colormap gets 414 URI Too Long."""
    colormap, stops = [], []
    for degree in range(-2, 35):
        rgb = _ramp(degree + 0.5)
        colormap.append([[degree * 100, (degree + 1) * 100], [*rgb, 255]])
        stops.append({"value": degree + 0.5, "rgb": rgb})
    return colormap, stops


def _whole_area(bbox: list[float]) -> list[float]:
    return bbox


def _centre(bbox: list[float]) -> list[float]:
    """The bbox's centre, at most MAX_IMAGE_SPAN_DEGREES each way."""
    west, south, east, north = bbox
    x, y = (west + east) / 2, (south + north) / 2
    half_x, half_y = min(east - west, MAX_IMAGE_SPAN_DEGREES) / 2, min(north - south, MAX_IMAGE_SPAN_DEGREES) / 2
    return [round(x - half_x, 4), round(y - half_y, 4), round(x + half_x, 4), round(y + half_y, 4)]


def _one_a_day(items: list, area: list[float] | None = None) -> list:
    """One item a day, in date order: of several on one day, the last one given."""
    by_day = {_day(item): item for item in items}
    return [by_day[day] for day in sorted(by_day)]


def _overlap(item, area: list[float]) -> float:
    """The share of the picture area inside the scene's footprint, 0 to 1. A scene with no bbox is taken on trust."""
    box = getattr(item, "bbox", None)
    if not box:
        return 1.0
    west, south, east, north = area
    width = max(0.0, min(box[2], east) - max(box[0], west))
    height = max(0.0, min(box[3], north) - max(box[1], south))
    return width * height / ((east - west) * (north - south))


def _clearest_a_day(items: list, area: list[float]) -> list:
    """Sentinel-2: each day's scene that covers most of the picture area (at least MIN_IMAGE_COVER), then the least cloudy, of those
    at or under MAX_IMAGE_CLOUD. The area often crosses a tile edge; the part outside the tile comes back transparent, which the
    browser does not read, so a partly covered picture is shown with an empty strip and is not heard as dark ground."""
    clear = [
        item for item in items
        if isinstance(cover := item.properties.get("eo:cloud_cover"), (int, float)) and cover <= MAX_IMAGE_CLOUD
        and _overlap(item, area) >= MIN_IMAGE_COVER
    ]
    # Best last, so it wins: most of the area, then least cloud.
    return _one_a_day(sorted(clear, key=lambda item: (_overlap(item, area), -item.properties["eo:cloud_cover"])))


Area = Callable[[list[float]], list[float]]
Choose = Callable[[list, list[float]], list]


@dataclass(frozen=True)
class Collection:
    label: str  # what the reply calls the values, e.g. "days of sea surface temperature"
    metric: str
    unit: str
    theme: str
    read: Reader | None = None  # None for a source with its own tool (weather)
    render: dict[str, str] | None = None  # the data API's query for a picture, besides the item and the size (None: no pictures)
    legend: dict | None = None  # what a picture's colours mean, for the browser
    area: Area | None = None  # the picture's area, from the checked bbox
    choose: Choose | None = None  # the items worth a picture, at most one a day, in date order


_SST_COLORMAP, _SST_STOPS = sst_bands()

#: The only collections the model may ask for. (OISST, not the WHOI collection: its `sst` asset is a COG the data API reads.)
COLLECTIONS: dict[str, Collection] = {
    "sentinel-2-l2a": Collection(
        "days of Sentinel-2 scenes", "Cloud cover", "%", "atmosphere", _cloud_cover,
        {"assets": "visual"}, {"kind": "picture"}, _centre, _clearest_a_day,
    ),
    "noaa-cdr-sea-surface-temperature-optimum-interpolation": Collection(
        "days of sea surface temperature", "Sea surface temperature", " °C", "ocean", _sst_mean,
        {"assets": "sst", "nodata": "-999", "colormap": json.dumps(_SST_COLORMAP, separators=(",", ":"))},
        {"kind": "data", "unit": "°C", "stops": _SST_STOPS}, _whole_area, _one_a_day,
    ),
}
#: The labels for every series the reply may describe. Separate from COLLECTIONS, so the model cannot ask Planetary Computer for weather.
SOURCES: dict[str, Collection] = {
    **COLLECTIONS,
    WEATHER_SOURCE: Collection("hours of air temperature", "Air temperature", " °C", "atmosphere"),
}


def image_url(collection: str, item_id: str, area: list[float]) -> str:
    """A PNG of exactly this area from one STAC item. `item/bbox`, not `item/crop`: crop 404s for Sentinel-2."""
    west, south, east, north = area
    height = min(1024, max(64, round(IMAGE_WIDTH * (north - south) / (east - west))))
    query = {"collection": collection, "item": item_id, **COLLECTIONS[collection].render, "width": IMAGE_WIDTH, "height": height}
    return f"{DATA_URL}/item/bbox/{west:g},{south:g},{east:g},{north:g}.png?" + urllib.parse.urlencode(query)


def images_of(collection: str, items: list, bbox: list[float]) -> dict:
    """Up to MAX_IMAGES pictures, spread over the period, with their legend and area. No network: only URLs."""
    spec = COLLECTIONS[collection]
    area = spec.area(bbox)
    chosen = _spread(spec.choose(items, area), MAX_IMAGES)
    images = [{"date": _day(item).isoformat(), "url": image_url(collection, item.id, area)} for item in chosen]
    return {"images": images, "legend": spec.legend, "area": area}


@lru_cache(maxsize=1)
def pc_client():
    """The STAC client, signing asset URLs. Imported here so a server with the route off never loads it."""
    import planetary_computer
    import pystac_client

    key = settings.pc_sdk_subscription_key.get_secret_value()
    if key:
        planetary_computer.set_subscription_key(key)
    return pystac_client.Client.open(STAC_URL, modifier=planetary_computer.sign_inplace)


def search_items(collection: str, bbox: list[float], first: date, last: date) -> list:
    """Blocking: run it in a thread."""
    search = pc_client().search(
        collections=[collection], bbox=bbox, datetime=f"{first.isoformat()}/{last.isoformat()}", max_items=MAX_ITEMS
    )
    return list(search.items())


def checked_args(collection: object, bbox: object, datetime_range: object) -> tuple[list[float], date, date] | dict:
    """The area and the first and last day, or the error dict to hand back to the model."""
    if collection not in COLLECTIONS:
        return {"error": f"collection must be one of: {', '.join(COLLECTIONS)}."}
    if (
        not isinstance(bbox, list)
        or len(bbox) != 4
        or not all(isinstance(value, (int, float)) and not isinstance(value, bool) for value in bbox)
    ):
        return {"error": "bbox must be four numbers: west, south, east, north, in degrees."}
    west, south, east, north = (float(value) for value in bbox)
    if not (-180 <= west < east <= 180 and -90 <= south < north <= 90):
        return {"error": "bbox must be west, south, east, north, with west < east and south < north, inside the globe."}
    if east - west > MAX_SPAN_DEGREES or north - south > MAX_SPAN_DEGREES:
        return {"error": f"bbox may span at most {MAX_SPAN_DEGREES:g} degrees each way. Pick a smaller area."}
    try:
        first, last = (date.fromisoformat(part.strip()) for part in str(datetime_range).split("/"))
    except ValueError:
        return {"error": "datetime_range must be YYYY-MM-DD/YYYY-MM-DD, first day then last day."}
    if last < first or (last - first).days >= MAX_DAYS:
        return {"error": f"datetime_range must run forwards and cover at most {MAX_DAYS} days."}
    return [west, south, east, north], first, last


def normalized(values: list[float]) -> list[float]:
    """0 to 1 from the lowest value to the highest. A flat series is 0.5 throughout."""
    low, high = min(values), max(values)
    return [0.5 if high == low else (value - low) / (high - low) for value in values]


def series_of(collection: str, points: list[Point]) -> dict:
    values = [round(value, 2) for _, value in points]
    return {
        "collection": collection,
        "dates": [day.isoformat() for day, _ in points],
        "values": values,
        "normalized": normalized(values) if values else [],
    }


async def fetch_planetary_computer_data(
    collection: str, bbox: list[float], datetime_range: str, tool_context: ToolContext
) -> dict:
    """Fetch a time series from Microsoft Planetary Computer.

    collection: "noaa-cdr-sea-surface-temperature-optimum-interpolation" for sea surface temperature, or "sentinel-2-l2a" for
    cloud cover. bbox: [west, south, east, north] in degrees around the place asked about, at most 10 degrees each way.
    datetime_range: "YYYY-MM-DD/YYYY-MM-DD", first day then last day, at most a year.
    The series goes straight into the session state; this returns only how much was found."""
    checked = checked_args(collection, bbox, datetime_range)
    if isinstance(checked, dict):
        return checked
    area, first, last = checked
    try:
        items = await asyncio.to_thread(search_items, collection, area, first, last)
        points = await COLLECTIONS[collection].read(items, area) if items else []
    except Exception:  # noqa: BLE001 - the network, the STAC API or the data API
        tool_context.state[ERROR_KEY] = True
        return {"error": "Planetary Computer did not answer. Do not try again."}
    tool_context.state[SERIES_KEY] = series_of(collection, points)
    try:
        tool_context.state[IMAGES_KEY] = images_of(collection, items, area)
    except Exception:  # noqa: BLE001 - an odd item: the pictures never cost the answer
        pass
    return {"ok": True, "points": len(points)}


async def fetch_weather(latitude: float, longitude: float, start: str, hours: int, tool_context: ToolContext) -> dict:
    """Fetch hourly air temperature 2 m above the ground at one place, from Meteomatics.

    latitude, longitude: the place asked about, in decimal degrees. start: the first hour, "YYYY-MM-DDTHH:00:00Z" in UTC.
    hours: how many hours from start, 1 to 168 (24 for one day).
    The series goes straight into the session state; this returns only how much was found."""
    checked = weather.checked_args(latitude, longitude, start, hours)
    if isinstance(checked, dict):
        return checked
    if not weather.configured():
        tool_context.state[WEATHER_ERROR_KEY] = "off"
        return {"error": "Weather is not set up on this server. Do not try again."}
    try:
        points = await weather.hourly_temperature(*checked)
    except Exception as error:  # noqa: BLE001 - the network, a refusal (bad login, plan limits) or an unexpected body
        status = error.response.status_code if isinstance(error, httpx.HTTPStatusError) else type(error).__name__
        logger.warning("Meteomatics failed: %s", status)  # Never the URL: it holds the place asked about.
        tool_context.state[WEATHER_ERROR_KEY] = "down"
        return {"error": "Meteomatics did not answer. Do not try again."}
    tool_context.state[SERIES_KEY] = series_of(WEATHER_SOURCE, points)
    return {"ok": True, "points": len(points)}


def search_local_datasets(dataset_id: str, tool_context: ToolContext) -> dict:
    """Choose one of the app's own data sets, listed in your instructions, when it answers the question. Give its id."""
    if dataset_id not in {entry["id"] for entry in tool_context.state.get("catalog") or []}:
        return {"error": "That id is not in the list. Fetch from Planetary Computer instead."}
    tool_context.state[LOCAL_KEY] = dataset_id
    return {"ok": True}


#: pitch_range for each audio_preference: a narrow range is gentle, a wide one is bold.
PITCH_RANGES = {"gentle": [60, 72], "normal": [52, 76], "bold": [40, 88]}


def build_audio(series: dict, preference: str) -> dict:
    """One marimba track: pitch and loudness follow the value. Never silent, because 0 is a rest in the player."""
    curve = [round(0.15 + 0.85 * value, 4) for value in series["normalized"]]
    payload = {"base_bpm": 100, "tracks": [{"instrument": "marimba", "pitch_range": PITCH_RANGES[preference], "volume_curve": curve}]}
    return AudioPayload.model_validate(payload).model_dump()


def _when(iso: str) -> str:
    """A day ("14 November 2026"), or an hour when the value has a time ("14 November 2026 at 13:00 UTC")."""
    moment = datetime.fromisoformat(iso)
    day = f"{moment.day} {moment:%B %Y}"
    return f"{day} at {moment:%H:%M} UTC" if "T" in iso else day


HELP_REPLY = (
    "I can fetch the weather from Meteomatics, or sea surface temperature or Sentinel-2 cloud cover from Planetary "
    "Computer. Try 'the weather in Port Louis today', 'sea surface temperature around Mauritius in June 2026' or "
    "'cloud cover over Madagascar in October 2026'."
)
ERROR_REPLY = "Planetary Computer did not answer just now. Try again in a minute."
WEATHER_REPLIES = {
    "off": "Weather is not set up on this server yet, so I can't fetch it.",
    "down": "The weather service did not answer just now. Try again in a minute.",
}


def answer_for(state: dict, preference: str, catalog: list[dict]) -> dict:
    """The route's answer, built from what the tools left in the state. No model text reaches it."""
    series = state.get(SERIES_KEY)
    local = next((entry for entry in catalog if entry["id"] == state.get(LOCAL_KEY)), None)
    answer = {
        "mascot_reply": HELP_REPLY, "dataset_theme": "default", "sonification_json": None, "local_dataset_id": None, "series": None,
        "images": [], "image_legend": None, "image_area": None,
    }
    if series and series["values"]:
        spec = SOURCES[series["collection"]]
        values, dates = series["values"], series["dates"]
        top = values.index(max(values))
        span = _when(dates[0]) if len(dates) == 1 else f"{_when(dates[0])} and {_when(dates[-1])}"
        answer["mascot_reply"] = (
            f"I found {len(values)} {spec.label} between {span}. {spec.metric} went from {min(values):g}{spec.unit} to "
            f"{max(values):g}{spec.unit}, highest on {_when(dates[top])}. Press Play to hear it."
        )
        answer["dataset_theme"] = spec.theme
        answer["sonification_json"] = build_audio(series, preference)
        # One value per step of the sound, so the table's row i is the note i (build_audio keeps the order).
        answer["series"] = {"metric": spec.metric, "unit": spec.unit.strip(), "times": dates, "values": values}
        pictures = state.get(IMAGES_KEY) or {}
        if pictures.get("images"):
            count = len(pictures["images"])
            answer["mascot_reply"] += f" I also have {count} picture{'' if count == 1 else 's'} of the area."
            answer["images"], answer["image_legend"], answer["image_area"] = pictures["images"], pictures["legend"], pictures["area"]
    elif local:
        answer["mascot_reply"] = f"I already have '{local['title']}' in the app. Open it to hear it."
        answer["local_dataset_id"] = local["id"]
    elif series:
        spec = SOURCES[series["collection"]]
        answer["mascot_reply"] = f"I found no {spec.label} there in those dates. Try a longer date range or a bigger area."
        answer["dataset_theme"] = spec.theme
    elif state.get(ERROR_KEY):
        answer["mascot_reply"] = ERROR_REPLY
    elif state.get(WEATHER_ERROR_KEY) in WEATHER_REPLIES:
        answer["mascot_reply"] = WEATHER_REPLIES[state[WEATHER_ERROR_KEY]]
    return answer


def _instruction(ctx) -> str:
    """Built from this request's state. A callable instruction is not templated, so braces in titles are safe."""
    catalog = "\n".join(f"{entry['id']}: {entry['title']}" for entry in ctx.state.get("catalog") or []) or "(none)"
    return (
        "You find Earth data for a listener. Call exactly one tool, once, then answer with the single word done.\n"
        "If one of the app's own data sets below answers the question, call search_local_datasets with its id.\n"
        "For the weather or the air temperature at a place, call fetch_weather with the place's latitude and longitude, "
        "the first hour in UTC, and the number of hours (24 for a day, at most 168); if no time is given, the next 24 hours "
        f"from now. It is now {datetime.now(timezone.utc):%Y-%m-%dT%H:00:00Z}.\n"
        "Otherwise call fetch_planetary_computer_data. Sea or ocean temperature: "
        "noaa-cdr-sea-surface-temperature-optimum-interpolation. Clouds or satellite scenes: sentinel-2-l2a. "
        "For bbox, give [west, south, east, north] in degrees around the place named, at most 10 degrees each way. "
        "For dates, use the period asked for; if none is given, the last 30 days. "
        f"Today is {date.today().isoformat()}; data from the last few days may not exist yet.\n"
        "If a tool returns an error about its arguments, fix them and call it once more.\n\n"
        f"APP DATA SETS\n{catalog}\n"
    )


def build_finder(model: BaseLlm) -> LlmAgent:
    return LlmAgent(
        name="finder",
        model=model,
        description="Chooses where Echo's data comes from. Writes no answer text.",
        instruction=_instruction,
        tools=[FunctionTool(search_local_datasets), FunctionTool(fetch_planetary_computer_data), FunctionTool(fetch_weather)],
        disallow_transfer_to_parent=True,
        disallow_transfer_to_peers=True,
        include_contents="none",
    )


class MascotService:
    """One runner for the whole server. The catalog arrives with each call and lives only in that call's session."""

    def __init__(self, model: BaseLlm) -> None:
        self.runner = InMemoryRunner(agent=build_finder(model), app_name=APP_NAME)

    async def query(self, prompt: str, preference: str, catalog: list[dict]) -> dict:
        sessions = self.runner.session_service
        session = await sessions.create_session(app_name=APP_NAME, user_id=USER_ID, state={"catalog": catalog})
        try:
            message = types.Content(role="user", parts=[types.Part(text=prompt)])
            config = RunConfig(max_llm_calls=MAX_LLM_CALLS)
            async for _ in self.runner.run_async(user_id=USER_ID, session_id=session.id, new_message=message, run_config=config):
                pass  # The model's text is never used.
            stored = await sessions.get_session(app_name=APP_NAME, user_id=USER_ID, session_id=session.id)
        finally:
            await sessions.delete_session(app_name=APP_NAME, user_id=USER_ID, session_id=session.id)
        return answer_for(dict(stored.state) if stored else {}, preference, catalog)


if __name__ == "__main__":
    async def _check() -> None:
        for collection, area, first, last in (
            ("noaa-cdr-sea-surface-temperature-optimum-interpolation", [57, -21, 58.5, -19.5], date(2026, 6, 1), date(2026, 6, 30)),
            ("sentinel-2-l2a", [46, -19, 47, -18], date(2026, 10, 1), date(2026, 10, 31)),
        ):
            items = await asyncio.to_thread(search_items, collection, area, first, last)
            points = await COLLECTIONS[collection].read(items, area)
            state = {SERIES_KEY: series_of(collection, points), IMAGES_KEY: images_of(collection, items, area)}
            answer = answer_for(state, "normal", [])
            shown = {**answer, "sonification_json": bool(answer["sonification_json"]), "image_legend": bool(answer["image_legend"])}
            print(json.dumps(shown, indent=2))

    asyncio.run(_check())
