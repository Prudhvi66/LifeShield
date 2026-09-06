"""
Health Vitals Telemetry, Trends, and Baseline Ingestion Routes.
"""
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_user
from ..database import get_db

router = APIRouter(prefix="/api/health", tags=["Health & Vitals"])


@router.post("/readings", response_model=schemas.HealthReadingOut)
def ingest_health_reading(
    payload: schemas.HealthReadingCreate,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user)
):
    user_id = current_user.id if current_user else None

    reading = models.HealthReading(
        user_id=user_id,
        device_id=payload.device_id,
        timestamp=datetime.now(timezone.utc),
        heart_rate=payload.heart_rate,
        spo2=payload.spo2,
        steps=payload.steps,
        sleep_hours=payload.sleep_hours,
        body_temperature=payload.body_temperature,
        systolic_bp=payload.systolic_bp,
        diastolic_bp=payload.diastolic_bp,
        hydration_index=payload.hydration_index,
        activity_level=payload.activity_level,
        source=payload.source,
        raw_data=payload.raw_data,
    )
    db.add(reading)
    db.commit()
    db.refresh(reading)
    return reading


@router.get("/readings", response_model=List[schemas.HealthReadingOut])
def list_health_readings(
    limit: int = Query(default=50, le=200),
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user)
):
    query = db.query(models.HealthReading)
    if current_user:
        query = query.filter((models.HealthReading.user_id == current_user.id) | (models.HealthReading.user_id.is_(None)))

    readings = query.order_by(models.HealthReading.timestamp.desc()).limit(limit).all()
    return readings


@router.get("/summary", response_model=schemas.HealthSummaryOut)
def get_health_summary(
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user)
):
    query = db.query(models.HealthReading)
    if current_user:
        query = query.filter((models.HealthReading.user_id == current_user.id) | (models.HealthReading.user_id.is_(None)))

    latest = query.order_by(models.HealthReading.timestamp.desc()).first()

    since_24h = datetime.now(timezone.utc) - timedelta(hours=24)
    past_24h_readings = query.filter(models.HealthReading.timestamp >= since_24h).all()

    hr_list = [r.heart_rate for r in past_24h_readings if r.heart_rate]
    spo2_list = [r.spo2 for r in past_24h_readings if r.spo2]
    temp_list = [r.body_temperature for r in past_24h_readings if r.body_temperature]
    steps_total = sum([r.steps for r in past_24h_readings if r.steps])

    has_data = latest is not None
    msg = "Real vitals stream active." if has_data else "Not available from connected device. Pair Bluetooth or sync Health Connect."

    return schemas.HealthSummaryOut(
        latest=latest,
        averages_24h={
            "avg_heart_rate": round(sum(hr_list) / len(hr_list), 1) if hr_list else None,
            "min_heart_rate": min(hr_list) if hr_list else None,
            "max_heart_rate": max(hr_list) if hr_list else None,
            "avg_spo2": round(sum(spo2_list) / len(spo2_list), 1) if spo2_list else None,
            "avg_body_temp": round(sum(temp_list) / len(temp_list), 1) if temp_list else None,
            "sample_count": len(past_24h_readings),
        },
        total_steps_today=steps_total if steps_total else (latest.steps if latest and latest.steps else 0),
        data_available=has_data,
        status_message=msg,
    )


@router.get("/trends", response_model=List[schemas.TrendPointOut])
def get_health_trends(
    hours: int = Query(default=24, le=168),
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user)
):
    query = db.query(models.HealthReading)
    if current_user:
        query = query.filter((models.HealthReading.user_id == current_user.id) | (models.HealthReading.user_id.is_(None)))

    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    readings = query.filter(models.HealthReading.timestamp >= since).order_by(models.HealthReading.timestamp.asc()).all()

    trend_points: List[schemas.TrendPointOut] = []
    for r in readings:
        trend_points.append(schemas.TrendPointOut(
            timestamp=r.timestamp.strftime("%H:%M"),
            heart_rate=r.heart_rate,
            spo2=r.spo2,
            steps=r.steps,
            body_temperature=r.body_temperature,
        ))
    return trend_points
