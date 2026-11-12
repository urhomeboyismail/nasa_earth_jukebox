from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

SERVER_DIR = Path(__file__).resolve().parents[1]
REPOSITORY_DIR = SERVER_DIR.parent


class Settings(BaseSettings):
    """Configuration, loaded from environment variables and `.env`.

    A server-local `.env` overrides the repository root one; real env vars win both.
    """

    model_config = SettingsConfigDict(
        env_file=(REPOSITORY_DIR / ".env", SERVER_DIR / ".env"),
        env_file_encoding="utf-8",
        env_ignore_empty=True,
        extra="ignore",
    )

    app_name: str = "Earth Jukebox"
    environment: str = "development"

    # Comma-separated list of explicit allowed origins. The voice guide WebSocket checks it too.
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # No default value. Left unset, the server starts and the voice guide reports it is not set up.
    gemini_api_key: SecretStr = SecretStr("")
    # Voice guide (Gemini Live). Live audio is billed per minute and the app has no accounts,
    # so sessions are capped in length and number.
    gemini_live_model: str = "gemini-3.8-live"
    # The google-genai SDK defaults to "v1", which has no Live endpoint for this model (the handshake
    # returns HTTP 404). Live models are served on "v1beta", so pin it instead of trusting the default.
    gemini_api_version: str = "v1beta"
    assistant_max_session_seconds: int = Field(default=600, gt=0)
    assistant_max_sessions: int = Field(default=4, gt=0)
    # The Jukebox orchestrator's four agents (app/agent/orchestrator.py). Text and images in, JSON out, so not a Live model.
    # This one completed every live run on 11 Nov 2026, when gemini-flash-latest answered 503 or hung all evening.
    orchestrator_model: str = "gemini-3.5-flash-lite"
    # Its route, POST /api/v1/jukebox/generate. Every run is billed (up to about 15 model calls) and there are no accounts, so
    # it is off unless switched on, limited to a few runs a minute for the whole server, and each run has a time limit.
    jukebox_enabled: bool = False
    jukebox_runs_per_minute: int = Field(default=4, gt=0)
    jukebox_timeout_seconds: float = Field(default=120, gt=0)

    # Google ADK agent (G01 to G05). Nothing calls the model while agent_enabled is false.
    agent_enabled: bool = False
    agent_model: str = "gemini-2.5-flash"  # [unverified] confirm the id with a real key (G07)
    # Seconds one agent request may take before it gives up.
    agent_timeout_seconds: float = Field(default=2.5, gt=0)
    agent_max_requests_per_minute: int = Field(default=5, gt=0)  # one token bucket for the whole server
    # Which engine runs the voice guide: the old Gemini Live bridge or the ADK agent.
    assistant_engine: Literal["bridge", "adk"] = "bridge"  # G05 changes the default to "adk"

    # Listening-test results (src/features/test, docs/PLAN.md §5.5). On Render the file needs a persistent
    # disk to survive restarts; without one, download the CSV after every session.
    study_db_path: Path = SERVER_DIR / "study.db"
    # Sent as the X-Team-Token header to download the CSV. Left unset, the export is switched off.
    study_export_token: SecretStr = SecretStr("")
    study_max_responses: int = Field(default=50, gt=0)

    @field_validator("cors_origins")
    @classmethod
    def _no_wildcard_origin(cls, value: str) -> str:
        if "*" in [origin.strip() for origin in value.split(",")]:
            raise ValueError("CORS_ORIGINS must list explicit origins; a wildcard is not allowed")
        return value

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
