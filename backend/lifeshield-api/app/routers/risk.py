"""
Multi-Factor Safety & Health Risk Assessment Routes.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_user
from ..database import get_db
from ..environment import fetch_live_environment
from ..risk_engine import evaluate_risk

router = APIRouter(prefix="/api/risk", tags=["Risk Assessment"])


@router.post("/calculate", response_model=schemas.RiskOut)
async def calculate_risk(
    payload: schemas.RiskCalculateIn,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user)
):
    env_data = await fetch_live_environment(lat=payload.lat, lon=payload.lon, city_or_region=payload.region_name)
    baseline = current_user.baseline if current_user and current_user.baseline else None

    vitals_reading = None
    if payload.heart_rate or payload.spo2 or payload.body_temperature:
        vitals_reading = schemas.HealthReadingCreate(
            heart_rate=payload.heart_rate,
            spo2=payload.spo2,
            body_temperature=payload.body_temperature
        )

    risk_out = evaluate_risk(
        env_data=env_data,
        vitals=vitals_reading,
        baseline=baseline,
        active_fall_alert=payload.active_fall_alert,
        emergency_mode=payload.emergency_mode,
    )

    # Record risk event if user or coordinates are tracked
    if current_user:
        event = models.RiskTierEvent(
            user_id=current_user.id,
            tier=risk_out.tier,
            score=risk_out.score,
            contributors=[c.model_dump() for c in risk_out.contributors],
            lat=payload.lat,
            lon=payload.lon,
        )
        db.add(event)
        db.commit()

    return risk_out


@router.get("", response_model=schemas.RiskOut)
async def get_risk(
    lat: Optional[float] = Query(default=None),
    lon: Optional[float] = Query(default=None),
    region: Optional[str] = Query(default=None),
    device_id: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user)
):
    env_data = await fetch_live_environment(lat=lat, lon=lon, city_or_region=region)
    baseline = current_user.baseline if current_user and current_user.baseline else None

    # Get latest vitals for user if available
    latest_reading = None
    if current_user:
        latest_reading = db.query(models.HealthReading).filter(models.HealthReading.user_id == current_user.id).order_by(models.HealthReading.timestamp.desc()).first()

    risk_out = evaluate_risk(
        env_data=env_data,
        vitals=latest_reading,
        baseline=baseline,
    )
    return risk_out


@router.get("/history", response_model=List[schemas.RiskOut])
def get_risk_history(
    limit: int = 30,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user)
):
    query = db.query(models.RiskTierEvent)
    if current_user:
        query = query.filter((models.RiskTierEvent.user_id == current_user.id) | (models.RiskTierEvent.user_id.is_(None)))

    events = query.order_by(models.RiskTierEvent.created_at.desc()).limit(limit).all()
    results: List[schemas.RiskOut] = []
    for e in events:
        results.append(schemas.RiskOut(
            score=e.score,
            tier=e.tier,
            contributors=[schemas.RiskContributorOut(**c) for c in (e.contributors or [])],
            recommended_actions=[],
            disclaimer="Risk indicator only — not a medical diagnosis.",
            calculated_at=e.created_at,
        ))
    return results
