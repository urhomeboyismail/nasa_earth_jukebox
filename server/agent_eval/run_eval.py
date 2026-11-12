#!/usr/bin/env python3
"""Agent eval (G07). Measures the Ask agent against the offline matcher; writes report.md (generated, never edited by hand).

    cd server && .venv/bin/python -I agent_eval/run_eval.py [--timeout S] [--pace S]

The offline matcher is the real src/features/ask/ask.ts, run through `npx --no-install tsx` (or node_modules/.bin/tsx, or the
file in TSX_BIN). If tsx is missing that part is NOT RUN. The agent part needs a key (GEMINI_API_KEY) and is NOT RUN without
one. A result that timed out, failed or was unavailable is "not measured": never a pass and never a fail (see score.py).
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE.parent))

from agent_eval import score  # noqa: E402

SCRIPT = ROOT / "scripts" / "agent-eval" / "static-ask.ts"
NO_TSX = "tsx is not available (no `npx --no-install tsx`)"


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def find_tsx() -> list[str] | None:
    """The command that runs tsx without installing anything, or None."""
    if os.environ.get("TSX_BIN"):
        return [os.environ["TSX_BIN"]]
    for name in ("tsx.cmd", "tsx"):
        local = ROOT / "node_modules" / ".bin" / name
        if local.exists():
            return [str(local)]
    npx = shutil.which("npx")
    if npx:
        probe = subprocess.run([npx, "--no-install", "tsx", "--version"], capture_output=True, text=True, cwd=ROOT)
        if probe.returncode == 0:
            return [npx, "--no-install", "tsx"]
    return None


def static_results(questions_path: Path, tsx: list[str]) -> dict[str, dict]:
    done = subprocess.run([*tsx, str(SCRIPT), str(questions_path)], capture_output=True, text=True, cwd=ROOT, check=True)
    raw = json.loads(done.stdout)
    return {i: {"status": "static", "fact_ids": r["factIds"], "answer": r["answer"]} for i, r in raw.items()}


def _unavailable(error: Exception) -> bool:
    return any(code in str(error) for code in ("503", "429", "UNAVAILABLE", "RESOURCE_EXHAUSTED"))


def agent_results(questions: dict, facts: dict, timeout: float, pace: float) -> dict[str, dict] | None:
    from app.config import settings

    if not settings.gemini_api_key.get_secret_value():
        return None
    from app.agent.ask import AskService
    from app.agent.models import keyed_model

    service = AskService(keyed_model(settings.agent_model))
    out: dict[str, dict] = {}

    async def run():
        for n, q in enumerate(questions["real"] + questions["adversarial"]):
            if n and pace:
                await asyncio.sleep(pace)  # stay under a per-minute quota
            try:
                chosen = await asyncio.wait_for(service.select(q["text"], facts["facts"], facts["dates"]), timeout=timeout)
            except asyncio.TimeoutError:
                out[q["id"]] = {"status": "timeout", "fact_ids": []}
            except Exception as error:  # noqa: BLE001 - whatever the model or the runner raised
                out[q["id"]] = {"status": "unavailable" if _unavailable(error) else "error", "fact_ids": []}
            else:
                # Like POST /agent/ask: a low or no confidence answer chooses nothing.
                confident = chosen["confidence"] in ("high", "medium")
                out[q["id"]] = {"status": "ok", "fact_ids": chosen["fact_ids"] if confident else []}

    asyncio.run(run())
    return out


def _section(title: str, rows: list[dict] | None, why: str) -> list[str]:
    if rows is None:
        return [f"### {title}", "", f"**NOT RUN: {why}**", ""]
    s = score.summary(rows)
    lines = [
        f"### {title}", "",
        f"- **{s['passed']} passed, {s['failed']} failed, not measured: {s['not_measured']}** (of {s['total']})",
        f"- real: {s['real']['passed']} of {s['real']['total']} passed (not measured: {s['real']['not_measured']})",
        f"- adversarial: {s['adversarial']['passed']} of {s['adversarial']['total']} passed (not measured: {s['adversarial']['not_measured']})",
        f"- open wording: {s['open']['passed']} of {s['open']['total']} passed (not measured: {s['open']['not_measured']})", "",
    ]
    fails = [r for r in rows if r["verdict"] == score.FAIL]
    lines.append("Failures:" if fails else "Failures: none.")
    lines += [f"- {r['id']} ({r['kind']}{', open wording' if r['open'] else ''}) \"{r['text']}\": got {r['got']}, wanted {r['expected']}" for r in fails]
    lines.append("")
    return lines


def _pair(part: dict) -> list[str]:
    out = _section("Offline matcher (src/features/ask/ask.ts)", part["static"], NO_TSX)
    out += _section("Agent", part["agent"], "no API key")
    if part["agent"] is not None:
        out += [f"Answers that hit the time limit: {part['timeouts']} of {part['agent_total']}.", ""]
    return out


def render_report(timeout: float, dev: dict, heldout: dict, verdict: str | None, heldout_reason: str | None) -> str:
    """Deterministic: the same inputs give the same text (no timestamps)."""
    out = [
        "# Agent eval report (generated by server/agent_eval/run_eval.py; do not edit by hand)", "",
        f"Time limit per answer: {timeout} s. Results with status timeout, error or unavailable are **not measured**: never a pass, never a fail.", "",
        "## Dev set (fixture; written by the agent, so it is optimistic)", "",
    ]
    out += _pair(dev)
    out += ["## Held-out set (written by a person, before any agent result)", ""]
    out += [f"**NOT RUN: {heldout_reason}.**", ""] if heldout_reason else _pair(heldout)
    out += [
        "## Kill rule", "",
        f"On the held-out open-wording questions the agent must pass at least {score.KILL_MARGIN} more than the offline matcher, "
        f"and at least {int(score.MIN_MEASURED * 100)}% of the held-out questions must be measured.", "",
        f"**Verdict: {verdict}**" if verdict else f"No verdict: the held-out part was not run ({heldout_reason}).", "",
    ]
    return "\n".join(out)


def evaluate(timeout: float, pace: float, dev_path: Path, heldout_path: Path) -> tuple[str, str | None]:
    facts = load(HERE / "facts.json")
    tsx = find_tsx()

    def one(path: Path) -> dict:
        questions = load(path)
        static = score.judge_all(questions, static_results(path, tsx), facts["facts"]) if tsx else None
        raw = agent_results(questions, facts, timeout, pace)
        agent = score.judge_all(questions, raw, facts["facts"]) if raw is not None else None
        return {"static": static, "agent": agent, "timeouts": sum(1 for r in (raw or {}).values() if r["status"] == "timeout"),
                "agent_total": len(raw or {})}

    dev = one(dev_path)
    held = load(heldout_path) if heldout_path.exists() else None
    reason = score.check_heldout(held)
    if reason:
        return render_report(timeout, dev, {}, None, reason), None
    held_result = one(heldout_path)
    verdict = score.kill_rule(held_result["static"], held_result["agent"])
    return render_report(timeout, dev, held_result, verdict, None), verdict


def main() -> None:
    from app.config import settings

    parser = argparse.ArgumentParser()
    parser.add_argument("--timeout", type=float, default=settings.agent_timeout_seconds, help="seconds per answer (default: the app's)")
    parser.add_argument("--pace", type=float, default=0.0, help="seconds to wait between questions (quota)")
    args = parser.parse_args()
    report, _ = evaluate(args.timeout, args.pace, HERE / "questions" / "dev.json", HERE / "questions" / "heldout.json")
    (HERE / "report.md").write_text(report, encoding="utf-8", newline="\n")
    print(report)


if __name__ == "__main__":
    main()
