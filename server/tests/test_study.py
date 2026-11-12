import csv
import io
import sqlite3

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr

from app.config import settings
from app.main import app
from app.study import db

TOKEN = "team-secret-token"
SESSION = {"participant": "blind_low_vision", "screenReader": True, "sawImages": False, "consent": True}
ANSWER = {"comparisonId": "jan-vs-jul", "answer": "b", "correct": True, "responseMs": 4200, "confidence": 4, "comment": "The second was higher."}


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "study_db_path", tmp_path / "study.db")
    monkeypatch.setattr(settings, "study_export_token", SecretStr(TOKEN))
    db._ready.clear()
    return TestClient(app)


def new_session(client, **overrides) -> str:
    response = client.post("/api/v1/tests", json={**SESSION, **overrides})
    assert response.status_code == 201, response.text
    return response.json()["id"]


def export(client, token=TOKEN):
    return client.get("/api/v1/tests/export.csv", headers={"X-Team-Token": token} if token is not None else {})


def rows(response):
    return list(csv.DictReader(io.StringIO(response.text)))


def test_creating_a_session_returns_an_id_and_stores_the_answers_given(client):
    session_id = new_session(client)
    assert len(session_id) == 32
    with sqlite3.connect(settings.study_db_path) as connection:
        stored = connection.execute("SELECT participant, screen_reader, saw_images, consent, started_at FROM test_sessions WHERE id = ?", (session_id,)).fetchone()
    assert stored[:4] == ("blind_low_vision", 1, 0, 1)
    assert stored[4].endswith("+00:00")


def test_two_sessions_get_different_ids(client):
    assert new_session(client) != new_session(client)


@pytest.mark.parametrize("body", [
    {**SESSION, "consent": False},
    {**SESSION, "participant": "robot"},
    {**SESSION, "screenReader": "maybe"},
    {**SESSION, "sawImages": "yes"},
    {**SESSION, "consent": "true"},
    {**SESSION, "screenReader": 1},
    {k: v for k, v in SESSION.items() if k != "consent"},
    {**SESSION, "name": "Ada"},
    {**SESSION, "email": "ada@example.com"},
])
def test_a_bad_session_is_rejected_and_nothing_is_stored(client, body):
    assert client.post("/api/v1/tests", json=body).status_code == 422
    assert export(client).text.strip().count("\n") == 0  # header only


def test_adding_responses(client):
    session_id = new_session(client)
    assert client.post(f"/api/v1/tests/{session_id}/responses", json=ANSWER).status_code == 204
    assert client.post(f"/api/v1/tests/{session_id}/responses", json={"comparisonId": "x", "answer": "same", "correct": False, "responseMs": 0}).status_code == 204
    with sqlite3.connect(settings.study_db_path) as connection:
        assert connection.execute("SELECT COUNT(*) FROM test_responses").fetchone() == (2,)


@pytest.mark.parametrize("change", [
    {"answer": "c"},
    {"correct": "yes"},
    {"correct": 1},
    {"responseMs": 12.5},
    {"confidence": 3.5},
    {"responseMs": -1},
    {"responseMs": 3_600_001},
    {"confidence": 0},
    {"confidence": 6},
    {"comparisonId": ""},
    {"comparisonId": "has space"},
    {"comparisonId": "a" * 101},
    {"comment": "x" * 501},
    {"ip": "1.2.3.4"},
])
def test_bad_response_values_are_rejected(client, change):
    session_id = new_session(client)
    assert client.post(f"/api/v1/tests/{session_id}/responses", json={**ANSWER, **change}).status_code == 422
    assert len(rows(export(client))) == 1  # the session, with no answers


def test_a_comment_of_exactly_500_characters_is_accepted(client):
    session_id = new_session(client)
    assert client.post(f"/api/v1/tests/{session_id}/responses", json={**ANSWER, "comment": "x" * 500}).status_code == 204


def test_missing_required_response_fields_are_rejected(client):
    session_id = new_session(client)
    for field in ("comparisonId", "answer", "correct", "responseMs"):
        body = {k: v for k, v in ANSWER.items() if k != field}
        assert client.post(f"/api/v1/tests/{session_id}/responses", json=body).status_code == 422, field


def test_a_response_for_an_unknown_session_is_not_found(client):
    assert client.post("/api/v1/tests/nope/responses", json=ANSWER).status_code == 404


def test_a_session_holds_at_most_50_answers(client):
    session_id = new_session(client)
    for _ in range(50):
        assert client.post(f"/api/v1/tests/{session_id}/responses", json=ANSWER).status_code == 204
    assert client.post(f"/api/v1/tests/{session_id}/responses", json=ANSWER).status_code == 409
    assert len(rows(export(client))) == 50
    other = new_session(client)
    assert client.post(f"/api/v1/tests/{other}/responses", json=ANSWER).status_code == 204


def test_export_needs_the_team_token(client):
    new_session(client)
    assert export(client, None).status_code == 403
    assert export(client, "wrong").status_code == 403
    assert export(client, "").status_code == 403
    assert export(client, TOKEN).status_code == 200


def test_export_is_off_when_no_token_is_configured(client, monkeypatch):
    monkeypatch.setattr(settings, "study_export_token", SecretStr(""))
    assert export(client, "").status_code == 403
    assert client.get("/api/v1/tests/export.csv").status_code == 403


def test_export_csv_contents(client):
    first = new_session(client)
    second = new_session(client, participant="sighted", screenReader=False, sawImages=True)
    client.post(f"/api/v1/tests/{first}/responses", json=ANSWER)
    client.post(f"/api/v1/tests/{first}/responses", json={"comparisonId": "x", "answer": "same", "correct": False, "responseMs": 900})
    response = export(client)
    assert response.headers["content-type"].startswith("text/csv")
    assert response.text.splitlines()[0] == ",".join(db.EXPORT_COLUMNS)
    data = {(r["session_id"], r["comparison_id"]): r for r in rows(response)}
    assert data[(first, "jan-vs-jul")] == {
        "session_id": first, "started_at": data[(first, "jan-vs-jul")]["started_at"], "participant": "blind_low_vision",
        "screen_reader": "1", "saw_images": "0", "comparison_id": "jan-vs-jul", "answer": "b", "correct": "1",
        "response_ms": "4200", "confidence": "4", "comment": "The second was higher.",
    }
    assert data[(first, "x")]["confidence"] == "" and data[(first, "x")]["comment"] == "" and data[(first, "x")]["correct"] == "0"
    assert data[(second, "")]["participant"] == "sighted" and data[(second, "")]["answer"] == ""
    assert len(data) == 3


def test_export_has_no_personal_columns(client):
    assert not {"name", "email", "ip", "ip_address"} & set(db.EXPORT_COLUMNS)


@pytest.mark.parametrize("comment", ["=HYPERLINK(\"http://evil\")", "+1", "-1", "@SUM(A1)"])
def test_export_neutralises_spreadsheet_formulas(client, comment):
    session_id = new_session(client)
    client.post(f"/api/v1/tests/{session_id}/responses", json={**ANSWER, "comment": comment})
    assert rows(export(client))[0]["comment"] == "'" + comment


def test_comments_with_commas_quotes_and_newlines_round_trip(client):
    session_id = new_session(client)
    comment = 'It said "high", then\nlow.'
    client.post(f"/api/v1/tests/{session_id}/responses", json={**ANSWER, "comment": comment})
    assert rows(export(client))[0]["comment"] == comment


def test_the_database_enforces_consent_and_valid_values_itself(client):
    new_session(client)
    with sqlite3.connect(settings.study_db_path) as connection:
        with pytest.raises(sqlite3.IntegrityError):
            connection.execute("INSERT INTO test_sessions VALUES ('x', 't', 'sighted', 0, 0, 0)")
        with pytest.raises(sqlite3.IntegrityError):
            connection.execute("INSERT INTO test_sessions VALUES ('x', 't', 'alien', 0, 0, 1)")


def test_the_server_allows_the_browser_to_post_from_the_site(client):
    response = client.options("/api/v1/tests", headers={"origin": "http://localhost:5173", "access-control-request-method": "POST", "access-control-request-headers": "content-type"})
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_a_new_session_beyond_the_cap_gets_503_and_stores_nothing(client, monkeypatch):
    monkeypatch.setattr(settings, "study_max_sessions", 2)
    new_session(client)
    new_session(client)
    response = client.post("/api/v1/tests", json=SESSION)
    assert response.status_code == 503
    assert "full" in response.json()["detail"]
    assert len(rows(export(client))) == 2
