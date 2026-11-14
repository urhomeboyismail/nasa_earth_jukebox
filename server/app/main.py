import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.agent import agent_ready
from app.api.agent import router as agent_router
from app.api.assistant import router as assistant_router
from app.api.jukebox import router as jukebox_router
from app.config import settings
from app.study.api import router as study_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(name)s | %(message)s")

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
    expose_headers=["Retry-After"],  # So the site, on another origin, can say how long to wait after a 429.
)


@app.get("/api/v1/health")
def health() -> dict:
    return {"status": "ok", "voice_guide": bool(settings.gemini_api_key.get_secret_value()), "agent": agent_ready()}


app.include_router(assistant_router)
app.include_router(study_router)
app.include_router(jukebox_router)
app.include_router(agent_router)
