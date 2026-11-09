"""A fake model for tests. It is NOT a model: it proves the plumbing, not the quality, and never reaches the network."""
from __future__ import annotations

import asyncio
import json
import re
from dataclasses import dataclass, field
from typing import AsyncGenerator, Callable

from google.adk.models import BaseLlm, LlmRequest, LlmResponse
from google.genai import types
from pydantic import Field


@dataclass
class FunctionCallSpec:
    """A script's way of saying "call this tool with these arguments"."""

    name: str
    args: dict = field(default_factory=dict)


def last_user_text(llm_request: LlmRequest) -> str:
    """The text of the newest user turn in the request, or "" when there is none."""
    for content in reversed(llm_request.contents or []):
        if content.role == "user":
            text = "".join(part.text or "" for part in content.parts or [])
            if text:
                return text
    return ""


def _part(output: object) -> types.Part:
    if isinstance(output, FunctionCallSpec):
        return types.Part(function_call=types.FunctionCall(name=output.name, args=output.args))
    if isinstance(output, str):
        return types.Part(text=output)
    return types.Part(text=json.dumps(output))


class FakeLlm(BaseLlm):
    """Answers with whatever `script(request)` returns: a str (text), a dict (JSON text), a FunctionCallSpec (a tool call) or an
    Exception (raised). Every request is kept in `calls`, one list per instance."""

    model: str = "fake"
    script: Callable[[LlmRequest], object]
    delay: float = 0.0
    calls: list = Field(default_factory=list)

    async def generate_content_async(self, llm_request: LlmRequest, stream: bool = False) -> AsyncGenerator[LlmResponse, None]:
        self.calls.append(llm_request)
        if self.delay:
            await asyncio.sleep(self.delay)
        output = self.script(llm_request)
        if isinstance(output, Exception):
            raise output
        yield LlmResponse(content=types.Content(role="model", parts=[_part(output)]))


def keyword_script(rules: list[tuple[str, object]], default: object = "") -> Callable[[LlmRequest], object]:
    """rules: (regex, output) pairs, matched against the newest user text, case-insensitive. First hit wins; else `default`."""

    def run(llm_request: LlmRequest) -> object:
        text = last_user_text(llm_request)
        for pattern, output in rules:
            if re.search(pattern, text, re.I):
                return output
        return default

    return run


def tool_then_text(spec: FunctionCallSpec, text: str) -> Callable[[LlmRequest], object]:
    """Calls the tool on the first request and answers with the text on the next. ADK calls the model again after a tool runs."""
    calls = 0

    def run(llm_request: LlmRequest) -> object:
        nonlocal calls
        calls += 1
        return spec if calls == 1 else text

    return run
