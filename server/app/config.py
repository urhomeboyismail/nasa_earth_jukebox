from pathlib import Path

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
    assistant_max_session_seconds: int = Field(default=600, gt=0)
    assistant_max_sessions: int = Field(default=4, gt=0)

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
