"""Limits shared by the two voice-guide engines (the Gemini Live bridge and the ADK path), so there is one copy."""
from __future__ import annotations

MAX_AUDIO_FRAME_BYTES = 64 * 1024
MAX_TEXT_CHARS = 2000
MAX_CONTEXT_BYTES = 24 * 1024
CONTEXT_KEYS = {"player", "compare"}
ANNOUNCE_GAP_SECONDS = 4.0
