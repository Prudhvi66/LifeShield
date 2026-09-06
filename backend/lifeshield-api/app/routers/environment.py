"""
Environmental Hazards and Weather Intelligence Routes.
"""
from typing import List, Optional
from fastapi import APIRouter, Query

from .. import schemas
from ..environment import fetch_live_environment

router = APIRouter(prefix="/api/environment", tags=["Environment & Hazards"])


@router.get("", response_model=schemas.EnvironmentOut)
async def get_environment(
    lat: Optional[float] = Query(default=None),
    lon: Optional[float] = Query(default=None),
    region: Optional[str] = Query(default=None),
):
    data = await fetch_live_environment(lat=lat, lon=lon, city_or_region=region)
    return data


@router.get("/alerts", response_model=List[schemas.DisasterAlertOut])
async def get_alerts(
    lat: Optional[float] = Query(default=None),
    lon: Optional[float] = Query(default=None),
    region: Optional[str] = Query(default=None),
):
    data = await fetch_live_environment(lat=lat, lon=lon, city_or_region=region)
    return data.get("advisories", [])
