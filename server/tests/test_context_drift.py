"""G06: the browser's list of context keys and the server's list must be the same, as the pages list is (test_assistant.py)."""
import re
from pathlib import Path

from app.agent.limits import CONTEXT_KEYS
from app.assistant.context_schemas import CONTEXT_SCHEMAS

CONTEXT_TS = Path(__file__).resolve().parents[2] / "src" / "assistant" / "context.ts"


def _browser_keys() -> set[str]:
    source = CONTEXT_TS.read_text(encoding="utf-8")
    union = re.search(r"export type ContextKey\s*=\s*([^;\n]+)", source)
    assert union, "src/assistant/context.ts no longer declares `export type ContextKey = ...`"
    return set(re.findall(r'"([a-zA-Z]+)"', union.group(1)))


def test_context_keys_match_the_browser():
    assert _browser_keys() == set(CONTEXT_SCHEMAS) == set(CONTEXT_KEYS)
