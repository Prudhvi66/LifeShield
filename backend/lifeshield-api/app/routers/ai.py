"""
Server-Side AI Health and Safety Companion Routes.
"""
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models, schemas
from ..ai_service import generate_ai_response
from ..auth import require_current_user
from ..database import get_db

router = APIRouter(prefix="/api/ai", tags=["AI Assistant"])


@router.post("/chat", response_model=schemas.AIChatResponse)
async def chat_with_ai(
    payload: schemas.AIChatRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_current_user)
):
    # Enrich context with user's baseline, latest vitals, risk assessment, and reminders if available
    context = payload.context or {}
    if current_user:
        context.setdefault("user", {
            "name": current_user.full_name,
            "primary_language": current_user.primary_language,
            "age": current_user.age,
            "blood_group": current_user.blood_group,
        })
        if current_user.baseline and "baseline" not in context:
            context["baseline"] = {
                "resting_heart_rate": current_user.baseline.resting_heart_rate,
                "normal_spo2": current_user.baseline.normal_spo2,
                "normal_body_temp": current_user.baseline.normal_body_temp,
                "systolic_bp": current_user.baseline.systolic_bp,
                "diastolic_bp": current_user.baseline.diastolic_bp,
                "daily_steps_goal": current_user.baseline.daily_steps_goal,
                "medical_conditions": current_user.baseline.medical_conditions,
                "allergies": current_user.baseline.allergies,
            }
        latest_reading = (
            db.query(models.HealthReading)
            .filter(models.HealthReading.user_id == current_user.id)
            .order_by(models.HealthReading.timestamp.desc())
            .first()
        )
        if latest_reading and "vitals" not in context:
            context["vitals"] = {
                "heartRate": latest_reading.heart_rate,
                "spO2": latest_reading.spo2,
                "bodyTemperature": latest_reading.body_temperature,
                "steps": latest_reading.steps,
                "sleepHours": latest_reading.sleep_hours,
                "systolicBp": latest_reading.systolic_bp,
                "diastolicBp": latest_reading.diastolic_bp,
                "hydrationIndex": latest_reading.hydration_index,
                "activityLevel": latest_reading.activity_level,
                "source": latest_reading.source,
                "is_demo_or_simulated": latest_reading.source in ["demo", "simulated"],
            }

        # Multi-factor Risk context
        if "risk" not in context:
            latest_risk = (
                db.query(models.RiskTierEvent)
                .filter(models.RiskTierEvent.user_id == current_user.id)
                .order_by(models.RiskTierEvent.created_at.desc())
                .first()
            )
            if latest_risk:
                context["risk"] = {
                    "tier": latest_risk.tier,
                    "score": latest_risk.score,
                    "contributors": latest_risk.contributors,
                }

        # Active Reminders context
        if "reminders" not in context:
            active_reminders = (
                db.query(models.Reminder)
                .filter(models.Reminder.user_id == current_user.id, models.Reminder.is_active == True)
                .all()
            )
            if active_reminders:
                context["reminders"] = [
                    {
                        "title": r.title,
                        "type": r.reminder_type,
                        "time": r.time,
                        "dosage": r.dosage,
                    }
                    for r in active_reminders
                ]

        # Environmental snapshot fallback if not supplied by client
        if "environment" not in context:
            latest_hazard = (
                db.query(models.HazardSnapshot)
                .order_by(models.HazardSnapshot.fetched_at.desc())
                .first()
            )
            if latest_hazard:
                context["environment"] = {
                    "heatIndex": latest_hazard.heat_index_c,
                    "aqi": latest_hazard.aqi,
                    "floodRisk": latest_hazard.flood_risk,
                }

    reply, source = await generate_ai_response(payload.question, context)

    return schemas.AIChatResponse(
        reply=reply,
        source=source,
        timestamp=datetime.now(timezone.utc),
        disclaimer="LifeShield AI provides general health and safety information only and does not provide medical diagnoses or prescriptions."
    )
