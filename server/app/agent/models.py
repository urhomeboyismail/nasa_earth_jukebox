"""The real model, with the server's key.

ADK's `Gemini` has no API-key field and otherwise builds its client from environment variables. The key must come from
settings and never go into os.environ, so it is passed through `client_kwargs`, which ADK 2.13 applies to every client it
builds: the request client and the Live client (`google/adk/models/google_llm.py`, `api_client` and `_live_api_client`).
Overriding `api_client` instead, as first planned, would pin one client to the model and break when a second event loop uses
it (ADK's own docstring warns of this). No client is built, and nothing reaches the network, until the model is first called.
"""
from __future__ import annotations

from google.adk.models import BaseLlm, Gemini
from google.genai import types

from app.config import settings


def keyed_model(name: str) -> BaseLlm:
    """A Gemini model that uses `settings.gemini_api_key` and `settings.gemini_api_version`. G02 and G04 use this."""
    return Gemini(
        model=name,
        client_kwargs={
            "api_key": settings.gemini_api_key.get_secret_value(),
            "http_options": types.HttpOptions(api_version=settings.gemini_api_version),
        },
    )
