"""
LifeShield FastAPI Application Main Entry Point.
Production-grade personal health, environmental risk, and safety API.
"""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .database import init_db
from .routers import (
    ai,
    auth,
    contacts,
    devices,
    emergency,
    environment,
    health,
    profile,
    reminders,
    risk,
    sos,
    timeline,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("lifeshield")
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing LifeShield Database tables...")
    init_db()
    logger.info("LifeShield Database initialization complete.")
    yield
    logger.info("LifeShield API shutdown.")


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description=(
        "LifeShield Real Application Backend: Environmental hazard intelligence, "
        "transparent multi-factor risk scoring, emergency contacts management, "
        "SOS & fall detection dispatch (with live Twilio voice/SMS support), "
        "medicine routine reminders with voice TTS settings, and server-side AI companion."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", tags=["Health & Status"])
def root():
    return {
        "service": settings.app_name,
        "status": "online",
        "environment": settings.environment,
        "version": "1.0.0"
    }


@app.get("/status", tags=["Health & Status"])
def get_status():
    return {
        "status": "ok",
        "database": "connected",
        "telephony_live": settings.telephony_configured,
        "environment": settings.environment,
    }


@app.get("/health", tags=["Health & Status"])
def health_check():
    """Simple health probe endpoint — used by load balancers, Docker and Android dev checks."""
    return {
        "status": "ok",
        "service": "lifeshield-api",
        "version": "1.0.0",
        "docs": "/docs",
    }


# Include Routers
app.include_router(auth.router)
app.include_router(profile.router)
app.include_router(health.router)
app.include_router(devices.router)
app.include_router(reminders.router)
app.include_router(contacts.router)
app.include_router(sos.router)
app.include_router(emergency.router)
app.include_router(environment.router)
app.include_router(risk.router)
app.include_router(ai.router)
app.include_router(timeline.router)


# Log full route table on import (visible in --reload output)
def _log_routes() -> None:
    rows = []
    for route in app.routes:
        if hasattr(route, "routes"):          # APIRouter mounted as a sub-application
            for sub in route.routes:
                methods = ",".join(sorted(getattr(sub, "methods", []) or []))
                rows.append(f"  {methods:12} {route.prefix + getattr(sub, 'path', ''):45} [{getattr(sub, 'name', '')}]")
        elif hasattr(route, "methods") and route.methods:
            methods = ",".join(sorted(route.methods))
            rows.append(f"  {methods:12} {getattr(route, 'path', ''):45} [{getattr(route, 'name', '')}]")
    if rows:
        logger.info("Registered routes:\n" + "\n".join(rows))


_log_routes()
