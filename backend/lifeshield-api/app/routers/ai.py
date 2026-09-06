"""
Server-Side AI Health and Safety Companion Routes.
"""
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models, schemas
from ..ai_service import generate_ai_response
from ..auth import get_current_user
from ..database import get_db

router = APIRouter(prefix="/api/ai", tags=["AI Assistant"])


@router.post("/chat", response_model=schemas.AIChatResponse)
async def chat_with_ai(
    payload: schemas.AIChatRequest,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user)
):
    # Enrich context with user's baseline and latest vitals if available
    context = payload.context or {}
    if current_user:
        if current_user.baseline:
            context["baseline"] = {
                "resting_heart_rate": current_user.baseline.resting_heart_rate,
                "normal_spo2": current_user.baseline.normal_spo2,
                "medical_conditions": current_user.baseline.medical_conditions,
                "allergies": current_user.baseline.allergies,
            }
        latest_reading = db.query(models.HealthReading).filter(models.HealthReading.user_id == current_user.id).order_by(models.HealthReading.timestamp.desc()).first()
        if latest_reading and "vitals" not in context:
            context["vitals"] = {
                "heartRate": latest_reading.heart_rate,
                "spO2": latest_reading.spo2,
                "bodyTemperature": latest_reading.body_temperature,
                "steps": latest_reading.steps,
            }

    reply, source = await generate_ai_response(payload.question, context)

    return schemas.AIChatResponse(
        reply=reply,
        source=source,
        timestamp=datetime.now(timezone.utc),
        disclaimer="LifeShield AI provides general health and safety information only and does not provide medical diagnoses or prescriptions."
    )
