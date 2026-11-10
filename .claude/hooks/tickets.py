#!/usr/bin/env python3
"""Ticket claim check for many agents working from docs/TICKETS.md (rules: .claude/rules/tickets.md).

The claim table that counts is the one on origin/main, because a claim that is not pushed is invisible to the other agents. So every
mode fetches origin/main first and reads docs/TICKETS.md from there, never from the working copy.

    tickets.py status   SessionStart / UserPromptSubmit hook: tells the agent what is claimed, what is free and which ticket to take next.
    tickets.py guard    PreToolUse hook on Bash: refuses to create a <feature|fix|chore>/<ID>-... branch for a ticket that is not
                        `claimed` on origin/main yet. Claim first (status row, `chore: claim <ID>`, push), then branch.

If origin cannot be reached the hook says so and lets the work go on (a warning, never a block). Agent letters are not limited to A and B.
"""
from __future__ import annotations

import json
import re
import subprocess
import sys

TABLE = "docs/TICKETS.md"
REMOTE_REF = "origin/main"
SHOWN = 8  # claimable tickets listed


def git(*args: str, timeout: int = 15) -> tuple[int, str]:
    try:
        done = subprocess.run(["git", *args], capture_output=True, text=True, timeout=timeout)
    except (OSError, subprocess.TimeoutExpired) as error:
        return 1, str(error)
    return done.returncode, done.stdout if done.returncode == 0 else done.stderr


def read_table() -> tuple[list[dict], str | None]:
    """The ticket rows on origin/main, and a warning when they could not be read fresh."""
    warning = None
    code, out = git("fetch", "--quiet", "origin", "main", timeout=20)
    if code != 0:
        warning = f"could not fetch origin ({out.strip().splitlines()[-1] if out.strip() else 'no answer'}); using the last origin/main this machine saw"
    code, text = git("show", f"{REMOTE_REF}:{TABLE}")
    if code != 0:
        return [], f"could not read {TABLE} from {REMOTE_REF}: {text.strip()}"
    return parse(text), warning


def parse(text: str) -> list[dict]:
    rows = []
    for line in text.splitlines():
        match = re.match(r"\|\s*\[([^\]]+)\]\([^)]*\)\s*\|(.*)\|\s*$", line)
        if not match:
            continue
        cells = [c.strip() for c in match.group(2).split("|")]
        if len(cells) < 6:
            continue
        # cells: title, size, who, needs, hotspots, status
        title, _size, who, needs, hotspots, status = cells[-6:]
        rows.append({
            "id": match.group(1),
            "title": title,
            "who": who,
            "needs": [] if needs in ("—", "-", "") else [n.strip() for n in needs.split(",")],
            "hotspots": [] if hotspots in ("—", "-", "") else [h.strip() for h in hotspots.split(",")],
            "status": status,
        })
    return rows


def kind(row: dict) -> str:
    return row["status"].split(":")[0].strip().lower()


def claimable(rows: list[dict]) -> tuple[list[dict], dict[str, str]]:
    """Open tickets an agent may take now, in queue order, and why each skipped open one cannot be taken (protocol: docs/TICKETS.md)."""
    done = {r["id"] for r in rows if kind(r) == "done"}
    held = {}  # hotspot -> the ticket that holds it
    for r in rows:
        if kind(r) == "claimed":
            for h in r["hotspots"]:
                held.setdefault(h, r["id"])
    free, skipped = [], {}
    for r in rows:
        if kind(r) != "open":
            continue
        if r["who"].startswith("👤"):
            skipped[r["id"]] = "a person's ticket"
        elif (waiting := [n for n in r["needs"] if n not in done]):
            skipped[r["id"]] = "needs " + ", ".join(waiting)
        elif (clash := [f"{h} (held by {held[h]})" for h in r["hotspots"] if h in held]):
            skipped[r["id"]] = "hotspot " + ", ".join(clash)
        else:
            free.append(r)
    return free, skipped


def status_text(rows: list[dict], warning: str | None) -> str:
    free, skipped = claimable(rows)
    claimed = [r for r in rows if kind(r) == "claimed"]
    ready = [r for r in rows if kind(r) == "ready"]
    open_rows = [r for r in rows if kind(r) == "open"]
    lines = [f"TICKET CHECK (docs/TICKETS.md on {REMOTE_REF}, fetched just now). {len(rows)} tickets: {len(open_rows)} open, {len(claimed)} claimed, {len(ready)} ready to merge, "
             f"{sum(kind(r) == 'done' for r in rows)} done."]
    if warning:
        lines.append(f"WARNING: {warning}.")
    lines.append("Claimed right now (never take these; their hotspots are held): " + ("; ".join(f"{r['id']} [{r['status'].split(':', 1)[1].strip()}] hotspots: {', '.join(r['hotspots']) or 'none'}" for r in claimed) or "none") + ".")
    if ready:
        lines.append("Ready, waiting for a person to merge: " + ", ".join(f"{r['id']}" for r in ready) + ".")
    if free:
        lines.append(f"UNCLAIMED and takeable now (queue order, so take the FIRST one; the first {min(SHOWN, len(free))} of {len(free)}): " + "; ".join(f"{r['id']} ({r['who']}, hotspots: {', '.join(r['hotspots']) or 'none'})" for r in free[:SHOWN]) + ".")
    else:
        lines.append("Nothing is unclaimed and takeable right now. Do not start a ticket; tell the user.")
    blocked_open = [f"{i}: {why}" for i, why in list(skipped.items())[:6]]
    if blocked_open:
        lines.append("Open but not takeable: " + "; ".join(blocked_open) + ".")
    lines.append("To take one: set its Status to `claimed: <your letter>, <date>` in docs/TICKETS.md on main, commit `chore: claim <ID>`, `git pull --rebase`, then `git push origin main` AT ONCE. "
                 "If the push is rejected, pull, run this check again and pick another. A branch `feature/<ID>-...` is refused until the claim is on origin/main.")
    return "\n".join(lines)


def known_ids(rows: list[dict]) -> list[str]:
    return sorted((r["id"] for r in rows), key=len, reverse=True)  # longest first, so AU-UI wins over A


def branch_creations(command: str) -> list[str]:
    """Branch names a Bash command creates: git checkout -b / -B, git switch -c / -C, git branch <name>, git worktree add ... -b <name>."""
    names = []
    for part in re.split(r"&&|\|\||;|\n", command):
        part = part.strip()
        # Only a segment that starts with git creates a branch; the same words inside echo, grep or a commit message do not.
        for pattern in (r"git\s+(?:-C\s+\S+\s+)?(?:checkout\s+-[bB]|switch\s+-[cC])\s+(\S+)", r"git\s+(?:-C\s+\S+\s+)?worktree\s+add\b.*?\s-[bB]\s+(\S+)", r"git\s+(?:-C\s+\S+\s+)?branch\s+(?!-)(\S+)"):
            m = re.match(pattern, part)
            if m:
                names.append(m.group(1).strip("'\""))
    return names


def guard(command: str) -> int:
    names = [n for n in branch_creations(command) if re.match(r"(feature|fix|chore)/", n)]
    if not names:
        return 0
    rows, warning = read_table()
    if not rows:
        print(f"Ticket check skipped: {warning}", file=sys.stderr)
        return 0
    ids = known_ids(rows)
    by_id = {r["id"]: r for r in rows}
    for name in names:
        rest = name.split("/", 1)[1]
        ticket = next((i for i in ids if rest == i or rest.startswith(i + "-")), None)
        if ticket is None:
            continue  # not a ticket branch (chore/rules-and-decisions, fix/voice-guide...)
        row = by_id[ticket]
        if kind(row) == "claimed":
            continue
        free, _ = claimable(rows)
        fix = (f"{ticket} is already built; pick an unclaimed ticket. " if kind(row) in ("done", "ready")
               else f"Claim it first (Status -> `claimed: <your letter>, <date>` on main, commit `chore: claim {ticket}`, push), or pick an unclaimed ticket. ")
        print(f"BLOCKED: branch {name} is for ticket {ticket}, but {ticket} is `{row['status']}` on {REMOTE_REF}, not claimed. {fix}"
              f"Unclaimed and takeable now: {', '.join(r['id'] for r in free[:SHOWN]) or 'none'}." + (f" ({warning})" if warning else ""), file=sys.stderr)
        return 2
    return 0


def main() -> int:
    mode = sys.argv[1] if len(sys.argv) > 1 else "status"
    try:
        payload = json.load(sys.stdin) if not sys.stdin.isatty() else {}
    except json.JSONDecodeError:
        payload = {}
    if mode == "guard":
        return guard(((payload.get("tool_input") or {}).get("command")) or "")
    # status: SessionStart always; UserPromptSubmit only when the prompt is about tickets, so ordinary questions do not wait for a fetch.
    event = payload.get("hook_event_name") or "SessionStart"
    if event == "UserPromptSubmit" and not re.search(r"ticket|claim|\bnext\b.*\b(task|one)\b|queue|SN\d\d|IX\d\d|EIC\d\d|\b[GVIS]\d\d\b", payload.get("prompt") or "", re.I):
        return 0
    rows, warning = read_table()
    text = status_text(rows, warning) if rows else f"TICKET CHECK failed: {warning}. Do not claim a ticket until `git fetch origin main` works."
    print(json.dumps({"hookSpecificOutput": {"hookEventName": event, "additionalContext": text}}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
