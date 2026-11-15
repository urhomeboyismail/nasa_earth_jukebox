"""What each browser screen may tell the voice guide about itself (ticket G06).

Every context key the browser publishes (`src/assistant/context.ts`, `ContextKey`) has one model here. The server keeps a payload only when
it fits its model, and drops it otherwise (logged at DEBUG with the key alone, never the content). `CONTEXT_SCHEMAS` is also the list of
accepted keys; `tests/test_context_drift.py` fails when it and the browser's list differ.
"""
from __future__ import annotations

import logging
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, ValidationError

logger = logging.getLogger(__name__)

IsoDate = Annotated[str, StringConstraints(pattern=r"^\d{4}-\d{2}-\d{2}$")]


class _Context(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class PlayerContext(_Context):
    visualization: str = Field(max_length=80)
    date: str = Field(max_length=40)
    region: str = Field(max_length=80)
    category: str = Field(max_length=40)
    playing: bool
    changeStep: str | None = Field(default=None, max_length=40)


class FactModel(_Context):
    id: str = Field(max_length=20)
    kind: Literal["data", "text"]
    text: str = Field(max_length=400)


class FactsContext(_Context):
    """The Ask panel's facts for the open data set: the only source of numbers about the data."""

    knownDates: list[IsoDate] = Field(max_length=400)
    facts: list[FactModel] = Field(max_length=10)


class ExploreContext(_Context):
    """The sound map, as the explorer publishes it (JB07): whether it is on, the value under the cursor and where it sits across the legend
    (0 to 1), and the last "What's here?" sentence. Never the grid or a list of values."""

    exploring: bool
    value: float | None = None
    position: float | None = Field(default=None, ge=0, le=1)
    here: str = Field(default="", max_length=600)


CONTEXT_SCHEMAS: dict[str, type[BaseModel]] = {
    "player": PlayerContext,
    "facts": FactsContext,
    "explore": ExploreContext,
}


def validate_context(key: str, data: object) -> tuple[bool, dict | None]:
    """`(True, payload as it is stored)`, or `(False, None)` when the payload does not fit the key's model.
    `None` (the screen went away) is kept as it is."""
    if data is None:
        return True, None
    try:
        return True, CONTEXT_SCHEMAS[key].model_validate(data).model_dump(exclude_none=True)
    except ValidationError:
        logger.debug("Dropped an invalid %s context", key)
        return False, None
