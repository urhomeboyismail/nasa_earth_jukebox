#!/usr/bin/env python3
"""The authoring routine for EIC material (EIC04): stage it in Consumption/, turn it into public/data/<id>/, then empty Consumption/.

    npm run new-translation -- "<Category>/<Source>/<Item_ID>"   # makes Consumption/<...>/ and its ingest.json
    npm run parse-nasa [-- <folder>]                             # every staged item with an .mp4 -> public/data/<id>/
    npm run clean-consumption                                    # empties Consumption/, keeping its README.md

`parse` runs scripts/eic_ingest.py (as a library) with the flags in the item's ingest.json, then turns the item's .vtt captions
into the manifest's story chapters. See docs/DATASET-PLAYBOOK.md and docs/data-sources.md, 'Captions from .vtt (EIC04)'.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import math
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONSUMPTION = ROOT / "Consumption"
DATA = ROOT / "public" / "data"
README = "README.md"
CAPTION_PREFIX = "caption-"
TITLE_WORDS = 6
SEGMENT = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.-]*")
TIME = re.compile(r"(?:(\d+):)?(\d{2}):(\d{2})\.(\d{3})")
TODO = "TODO"
# The eic_ingest flags a video needs; ingest.json may add any other eic_ingest flag (true for a switch like "force").
TEMPLATE_ARGS = {"start-date": TODO, "step-days": TODO, "legend-min": TODO, "legend-max": TODO}


class ConsumeError(Exception):
    pass


# ---------------------------------------------------------------------------------------------------------------------
# new


def new_item(path_text: str, root: Path = CONSUMPTION) -> Path:
    parts = path_text.strip("/").split("/")
    if len(parts) != 3 or not all(SEGMENT.fullmatch(p) for p in parts):
        raise ConsumeError(f"{path_text!r}: give <Category>/<Source>/<Item_ID>, each part letters, digits, '.', '_' or '-'")
    folder = root.joinpath(*parts)
    item_id = re.sub(r"[^a-z0-9]+", "-", parts[2].lower()).strip("-")
    ingest = folder / "ingest.json"
    if ingest.exists():
        raise ConsumeError(f"{ingest} already exists")
    folder.mkdir(parents=True, exist_ok=True)
    ingest.write_text(json.dumps({"id": item_id, "args": TEMPLATE_ARGS}, indent=2) + "\n")
    return folder


# ---------------------------------------------------------------------------------------------------------------------
# .vtt captions


@dataclass(frozen=True)
class Cue:
    start: float
    end: float
    text: str


def seconds(text: str, where: str) -> float:
    m = TIME.fullmatch(text.strip())
    if not m:
        raise ConsumeError(f"{where}: {text.strip()!r} is not a time like 00:01:02.500")
    h, mnt, s, ms = (int(g) if g else 0 for g in m.groups())
    return h * 3600 + mnt * 60 + s + ms / 1000


def parse_vtt(text: str) -> list[Cue]:
    """The cues of a WebVTT file, in file order. Cue settings after the end time, cue ids, tags, NOTE and STYLE blocks are dropped."""
    blocks = re.split(r"\n\s*\n", text.replace("\r\n", "\n").replace("﻿", "").strip())
    if not blocks[0].startswith("WEBVTT"):
        raise ConsumeError("the captions file does not start with WEBVTT")
    cues = []
    for block in blocks[1:]:
        lines = block.split("\n")
        timing = next((i for i, line in enumerate(lines) if "-->" in line), None)
        if timing is None:  # NOTE, STYLE, REGION
            continue
        start_text, end_text = lines[timing].split("-->", 1)
        where = f"cue {len(cues) + 1}"
        words = " ".join(re.sub(r"<[^>]+>", "", line).strip() for line in lines[timing + 1:]).strip()
        if words:
            end_time = end_text.split()[0] if end_text.split() else ""
            cues.append(Cue(seconds(start_text, where), seconds(end_time, where), words))
    return cues


def check_cues(cues: list[Cue], duration: float) -> None:
    for n, cue in enumerate(cues, start=1):
        if cue.start >= cue.end:
            raise ConsumeError(f"cue {n} ({cue.text[:40]!r}): it starts at {cue.start:g} s, not before its end at {cue.end:g} s")
        if cue.end > duration + 0.001:
            raise ConsumeError(f"cue {n} ({cue.text[:40]!r}): it ends at {cue.end:g} s, after the video ends at {duration:g} s")
        if n > 1 and cue.start < cues[n - 2].end:
            raise ConsumeError(f"cue {n} ({cue.text[:40]!r}): it starts at {cue.start:g} s, before cue {n - 1} ends at {cues[n - 2].end:g} s")


def frame_at(t: float, manifest: dict) -> str:
    """The id of the latest dated frame at or before second t of the video (video frame floor(t x fps) on the video's date grid)."""
    video = manifest["video"]
    day = dt.date.fromisoformat(video["firstFrameDate"]) + dt.timedelta(days=math.floor(t * video["fps"]) * video["frameStepDays"])
    frames = sorted(manifest["frames"], key=lambda f: f["date"])
    before = [f for f in frames if dt.date.fromisoformat(f["date"]) <= day]
    return (before[-1] if before else frames[0])["id"]


def caption_chapters(cues: list[Cue], manifest: dict) -> list[dict]:
    # shortcut: one chapter per cue; merge short cues into sentences if the Learn view gets too busy.
    # A cue's end is exclusive, so its last frame is the one shown just before it ends.
    return [{"id": f"{CAPTION_PREFIX}{n}", "title": " ".join(cue.text.split()[:TITLE_WORDS]), "text": cue.text,
             "fromFrame": frame_at(cue.start, manifest), "toFrame": frame_at(max(cue.start, cue.end - 1e-6), manifest)}
            for n, cue in enumerate(cues, start=1)]


def add_captions(manifest: dict, cues: list[Cue]) -> dict:
    """The manifest with its caption- chapters replaced by these cues; hand-written chapters are kept, in front."""
    kept = [c for c in manifest.get("story", []) if not c["id"].startswith(CAPTION_PREFIX)]
    story = kept + caption_chapters(cues, manifest)
    return {**manifest, "story": story} if story else manifest


def video_seconds(path: Path) -> float:
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                         capture_output=True, text=True, check=False)
    try:
        return float(out.stdout.strip())
    except ValueError:
        raise ConsumeError(f"ffprobe could not read the length of {path}: {out.stderr.strip()}") from None


# ---------------------------------------------------------------------------------------------------------------------
# parse


def ingest_argv(folder: Path, video: Path, out_root: Path) -> tuple[str, list[str]]:
    path = folder / "ingest.json"
    if not path.is_file():
        raise ConsumeError(f"{folder}: no ingest.json. Make the folder with npm run new-translation")
    config = json.loads(path.read_text())
    args = config.get("args", {})
    todo = (["id"] if config.get("id") in (None, "", TODO) else []) + [k for k, v in args.items() if v == TODO]
    if todo:
        raise ConsumeError(f"{path}: fill in {', '.join(todo)} (see scripts/eic_ingest.py --help)")
    argv = ["--id", config["id"], "--video", str(video), "--out", str(out_root / config["id"])]
    for key, value in args.items():
        if key in ("id", "video", "frames", "out"):
            raise ConsumeError(f"{path}: {key!r} is set by consume.py, take it out of args")
        if value is True:
            argv.append(f"--{key}")
        elif value is not False:
            argv += [f"--{key}", str(value)]
    return config["id"], argv


def only(folder: Path, pattern: str) -> Path | None:
    found = sorted(folder.glob(pattern))
    if len(found) > 1:
        raise ConsumeError(f"{folder}: more than one {pattern} file; keep one")
    return found[0] if found else None


def parse_item(folder: Path, out_root: Path = DATA) -> str:
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import eic_ingest  # noqa: PLC0415 (needs NumPy and Pillow, so it is only loaded when parsing)

    video = only(folder, "*.mp4")
    if video is None:
        raise ConsumeError(f"{folder}: no .mp4")
    item_id, argv = ingest_argv(folder, video, out_root)
    vtt = only(folder, "*.vtt")
    cues = parse_vtt(vtt.read_text(encoding="utf-8")) if vtt else []
    if cues:  # checked before anything is written
        check_cues(cues, video_seconds(video))
    if eic_ingest.main(argv) != 0:
        raise ConsumeError(f"{folder}: eic_ingest.py stopped (its message is above)")
    if vtt and cues:
        manifest_path = out_root / item_id / "manifest.json"
        manifest = add_captions(json.loads(manifest_path.read_text()), cues)
        manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
        print(f"Captions: {len(cues)} cues from {vtt.name} -> story chapters {CAPTION_PREFIX}1 to {CAPTION_PREFIX}{len(cues)}.")
    return item_id


def staged(start: Path) -> list[Path]:
    return sorted({p.parent for p in start.rglob("*.mp4")})


# ---------------------------------------------------------------------------------------------------------------------
# clean


def clean(root: Path = CONSUMPTION, repo: Path = ROOT) -> int:
    """Empty root except its README.md. Returns how many entries were removed."""
    if not root.exists():
        return 0
    if root.is_symlink() or not root.resolve().is_relative_to(repo.resolve()):
        raise ConsumeError(f"{root} is a link or outside the repository; empty it by hand")
    removed = 0
    for child in root.iterdir():
        if child.name == README:
            continue
        if child.is_dir() and not child.is_symlink():
            shutil.rmtree(child)
        else:
            child.unlink()
        removed += 1
    return removed


# ---------------------------------------------------------------------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="consume.py", description="Stage EIC material in Consumption/ and turn it into public/data/<id>/.")
    sub = p.add_subparsers(dest="command", required=True)
    sub.add_parser("new", help="make Consumption/<Category>/<Source>/<Item_ID>/ and its ingest.json").add_argument("path")
    sub.add_parser("parse", help="turn staged items into public/data/<id>/").add_argument("folder", nargs="?", type=Path)
    sub.add_parser("clean", help="empty Consumption/, keeping its README.md")
    args = p.parse_args(argv)
    try:
        if args.command == "new":
            folder = new_item(args.path)
            print(f"Made {folder.relative_to(ROOT)}/. Put the .mp4 (and its .vtt captions) there, fill in ingest.json, "
                  "then run npm run parse-nasa. Rehearse first with a rehearsal- id (docs/DATASET-PLAYBOOK.md §2).")
        elif args.command == "parse":
            start = args.folder or CONSUMPTION
            items = staged(start)
            if not items:
                raise ConsumeError(f"no .mp4 found under {start}")
            for folder in items:
                item_id = parse_item(folder)
                print(f"\nWrote public/data/{item_id}/. Next: fill its TODOs, add it to index.json, npm run view, "
                      f"open #listen?data={item_id}, then npm run check.")
        else:
            print(f"Removed {clean()} item(s) from Consumption/.")
    except ConsumeError as error:
        print(f"consume.py: error: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
