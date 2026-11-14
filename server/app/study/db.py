"""SQLite storage for the listening test. Plain `sqlite3`, one short-lived connection per call."""
from __future__ import annotations

import sqlite3
import threading
import uuid
from contextlib import closing, contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator

from app.config import settings

SCHEMA = """
CREATE TABLE IF NOT EXISTS test_sessions (
    id TEXT PRIMARY KEY,
    started_at TEXT NOT NULL,
    participant TEXT NOT NULL CHECK (participant IN ('sighted', 'blind_low_vision', 'not_said')),
    screen_reader INTEGER NOT NULL,
    saw_images INTEGER NOT NULL,
    consent INTEGER NOT NULL CHECK (consent = 1)
);
CREATE TABLE IF NOT EXISTS test_responses (
    id INTEGER PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES test_sessions(id),
    comparison_id TEXT NOT NULL,
    answer TEXT NOT NULL CHECK (answer IN ('a', 'b', 'same')),
    correct INTEGER NOT NULL,
    response_ms INTEGER NOT NULL,
    confidence INTEGER CHECK (confidence BETWEEN 1 AND 5),
    comment TEXT
);
CREATE INDEX IF NOT EXISTS test_responses_session ON test_responses(session_id);
"""

EXPORT_COLUMNS = (
    "session_id", "started_at", "participant", "screen_reader", "saw_images",
    "comparison_id", "answer", "correct", "response_ms", "confidence", "comment",
)

_ready: set[Path] = set()
_ready_lock = threading.Lock()


class SessionNotFound(Exception):
    pass


class SessionFull(Exception):
    pass


class TooManySessions(Exception):
    pass


@contextmanager
def connect() -> Iterator[sqlite3.Connection]:
    """Opens the configured database, creating the file and tables the first time. Commits on success."""
    path = Path(settings.study_db_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with closing(sqlite3.connect(path, timeout=10)) as connection:
        connection.execute("PRAGMA foreign_keys = ON")
        with _ready_lock:
            if path not in _ready:
                connection.executescript(SCHEMA)
                _ready.add(path)
        with connection:
            yield connection


def create_session(participant: str, screen_reader: bool, saw_images: bool) -> str:
    session_id = uuid.uuid4().hex
    started_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    with connect() as db:
        # Take the write lock first, so two new sessions arriving together cannot both pass the limit check.
        db.execute("BEGIN IMMEDIATE")
        (count,) = db.execute("SELECT COUNT(*) FROM test_sessions").fetchone()
        if count >= settings.study_max_sessions:
            raise TooManySessions()
        db.execute(
            "INSERT INTO test_sessions (id, started_at, participant, screen_reader, saw_images, consent) VALUES (?, ?, ?, ?, ?, 1)",
            (session_id, started_at, participant, int(screen_reader), int(saw_images)),
        )
    return session_id


def add_response(
    session_id: str, comparison_id: str, answer: str, correct: bool, response_ms: int,
    confidence: int | None, comment: str | None,
) -> None:
    with connect() as db:
        # Take the write lock first, so two answers arriving together cannot both pass the limit check.
        db.execute("BEGIN IMMEDIATE")
        if db.execute("SELECT 1 FROM test_sessions WHERE id = ?", (session_id,)).fetchone() is None:
            raise SessionNotFound(session_id)
        (count,) = db.execute("SELECT COUNT(*) FROM test_responses WHERE session_id = ?", (session_id,)).fetchone()
        if count >= settings.study_max_responses:
            raise SessionFull(session_id)
        db.execute(
            "INSERT INTO test_responses (session_id, comparison_id, answer, correct, response_ms, confidence, comment) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (session_id, comparison_id, answer, int(correct), response_ms, confidence, comment),
        )


def delete_session(session_id: str) -> None:
    """Deletes the session and every answer in it, when the participant withdraws."""
    with connect() as db:
        db.execute("DELETE FROM test_responses WHERE session_id = ?", (session_id,))
        if db.execute("DELETE FROM test_sessions WHERE id = ?", (session_id,)).rowcount == 0:
            raise SessionNotFound(session_id)


def export_rows() -> list[tuple]:
    """One row per answer, in the order given. Sessions with no answers are included with empty answer columns."""
    with connect() as db:
        return db.execute(
            """
            SELECT s.id, s.started_at, s.participant, s.screen_reader, s.saw_images,
                   r.comparison_id, r.answer, r.correct, r.response_ms, r.confidence, r.comment
            FROM test_sessions s LEFT JOIN test_responses r ON r.session_id = s.id
            ORDER BY s.started_at, s.id, r.id
            """
        ).fetchall()
