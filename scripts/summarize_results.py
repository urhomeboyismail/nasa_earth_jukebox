"""Summarise the listening-test results (ticket T23).

Reads the CSV from `GET /api/v1/tests/export.csv` (docs/PLAN.md §5.5) and prints, for each comparison and overall,
how many answers were correct, the median response time and the average confidence, split by participant group.
Numbers are reported exactly, always with how many answers they come from, because our samples are small.

    python3 -I scripts/summarize_results.py scripts/fixtures/sample_results.csv
    .venv/bin/python -I scripts/summarize_results.py results.csv --chart results.png   # chart needs matplotlib
"""
from __future__ import annotations

import argparse
import csv
import statistics
import sys
from dataclasses import dataclass
from pathlib import Path

GROUP_LABELS = {"sighted": "Sighted", "blind_low_vision": "Blind or low vision", "not_said": "Prefer not to say"}
GROUP_ORDER = list(GROUP_LABELS)


@dataclass(frozen=True)
class Answer:
    session: str
    group: str
    comparison: str
    correct: bool
    response_ms: int
    confidence: int | None


@dataclass(frozen=True)
class Stats:
    answered: int
    correct: int
    median_ms: float | None
    mean_confidence: float | None
    confidence_count: int

    @property
    def percent(self) -> float | None:
        return 100 * self.correct / self.answered if self.answered else None


def read_answers(path: Path) -> tuple[list[Answer], int]:
    """The answers in the CSV, and how many sessions there were (including ones with no answers)."""
    answers: list[Answer] = []
    sessions: set[str] = set()
    with path.open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            sessions.add(row["session_id"])
            if not row["comparison_id"]:
                continue  # a session that has not answered anything yet
            answers.append(Answer(
                session=row["session_id"],
                group=row["participant"],
                comparison=row["comparison_id"],
                correct=row["correct"] == "1",
                response_ms=int(row["response_ms"]),
                confidence=int(row["confidence"]) if row["confidence"] else None,
            ))
    return answers, len(sessions)


def summarise(answers: list[Answer]) -> Stats:
    confidences = [a.confidence for a in answers if a.confidence is not None]
    return Stats(
        answered=len(answers),
        correct=sum(a.correct for a in answers),
        median_ms=statistics.median(a.response_ms for a in answers) if answers else None,
        mean_confidence=statistics.fmean(confidences) if confidences else None,
        confidence_count=len(confidences),
    )


def comparisons_in_order(answers: list[Answer]) -> list[str]:
    """In the order they were first answered, which is the fixed order the test uses."""
    return list(dict.fromkeys(a.comparison for a in answers))


def groups_present(answers: list[Answer]) -> list[str]:
    present = {a.group for a in answers}
    return [g for g in GROUP_ORDER if g in present] + sorted(present - set(GROUP_ORDER))


def describe(stats: Stats) -> str:
    """One line, e.g. '3 of 4 correct (75%), median 4.2 s, confidence 3.67 (1-5) from 3 of 4'."""
    if not stats.answered:
        return "no answers"
    correct = f"{stats.correct} of {stats.answered} correct ({stats.percent:.0f}%)"
    median = f"median {stats.median_ms / 1000:.1f} s"
    if stats.mean_confidence is None:
        confidence = "no confidence ratings"
    else:
        confidence = f"confidence {stats.mean_confidence:.2f} (1-5) from {stats.confidence_count} of {stats.answered}"
    return f"{correct}, {median}, {confidence}"


def plural(count: int, noun: str) -> str:
    return f"{count} {noun}" + ("" if count == 1 else "s")


def report(answers: list[Answer], session_count: int) -> str:
    lines = [f"Listening test: {plural(len(answers), 'answer')} from {plural(session_count, 'session')}.", ""]
    if not answers:
        return "\n".join(lines + ["No answers yet."])
    sessions_with_answers = len({a.session for a in answers})
    if sessions_with_answers < session_count:
        missing = session_count - sessions_with_answers
        lines.insert(1, f"({plural(missing, 'session')} {'has' if missing == 1 else 'have'} no answers.)")

    lines += ["Overall", f"  All groups: {describe(summarise(answers))}"]
    for group in groups_present(answers):
        lines.append(f"  {GROUP_LABELS.get(group, group)}: {describe(summarise([a for a in answers if a.group == group]))}")

    for comparison in comparisons_in_order(answers):
        here = [a for a in answers if a.comparison == comparison]
        lines += ["", comparison, f"  All groups: {describe(summarise(here))}"]
        for group in groups_present(here):
            lines.append(f"  {GROUP_LABELS.get(group, group)}: {describe(summarise([a for a in here if a.group == group]))}")

    lines += ["", "With samples this small, read these as what happened in our sessions, not as a measure of all listeners."]
    return "\n".join(lines)


def draw_chart(answers: list[Answer], path: Path) -> None:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    labels = comparisons_in_order(answers) + ["Overall"]
    groups = groups_present(answers)
    colours = ["#3b6ea5", "#d98c2b", "#6b8e4e", "#8a6bb1"]
    width = 0.8 / max(1, len(groups))

    fig, ax = plt.subplots(figsize=(9, 5), dpi=150)
    for g, group in enumerate(groups):
        for i, label in enumerate(labels):
            here = [a for a in answers if a.group == group and (label == "Overall" or a.comparison == label)]
            stats = summarise(here)
            if not stats.answered:
                continue
            x = i - 0.4 + width * (g + 0.5)
            ax.bar(x, stats.percent, width * 0.92, color=colours[g % len(colours)], label=GROUP_LABELS.get(group, group) if i == 0 else None)
            ax.text(x, stats.percent + 1.5, f"{stats.correct}/{stats.answered}", ha="center", va="bottom", fontsize=9)

    ax.set_xticks(range(len(labels)), [label.replace("-", " ") for label in labels])
    ax.set_ylim(0, 112)
    ax.set_yticks(range(0, 101, 20))
    ax.set_ylabel("Answers correct (%)")
    ax.set_title("Could listeners hear the change? Correct answers, by comparison and group")
    ax.legend(frameon=False, loc="upper center", ncols=len(groups), bbox_to_anchor=(0.5, -0.12))
    ax.spines[["top", "right"]].set_visible(False)
    fig.text(0.01, 0.01, "Labels show correct/answered. Small samples.", fontsize=8, color="#555")
    fig.tight_layout()
    fig.savefig(path)
    plt.close(fig)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("csv", type=Path, help="the results CSV from the study API's export")
    parser.add_argument("--chart", type=Path, metavar="PNG", help="also save a bar chart of correct answers to this file")
    args = parser.parse_args(argv)

    answers, session_count = read_answers(args.csv)
    print(report(answers, session_count))
    if args.chart:
        if not answers:
            print("No chart: there are no answers.", file=sys.stderr)
            return 1
        draw_chart(answers, args.chart)
        print(f"\nChart saved to {args.chart}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
