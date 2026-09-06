"""
Unified Chronological Activity Timeline Routes.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_user
from ..database import get_db

router = APIRouter(prefix="/api/timeline", tags=["Timeline"])


@router.get("", response_model=List[schemas.TimelineEventOut])
def get_timeline(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user)
):
    events: List[schemas.TimelineEventOut] = []

    user_id = current_user.id if current_user else None

    # 1. SOS Events
    sos_q = db.query(models.SOSEvent)
    if user_id:
        sos_q = sos_q.filter(models.SOSEvent.user_id == user_id)
    for s in sos_q.order_by(models.SOSEvent.created_at.desc()).limit(15).all():
        events.append(schemas.TimelineEventOut(
            id=f"sos-{s.id}",
            type="sos",
            title=f"Emergency Alert: {s.event_type.replace('_', ' ').title()}",
            description=f"Status: {s.status.title()} — Risk Tier: {s.tier_at_trigger or 'Emergency'}",
            timestamp=s.created_at,
            severity="emergency" if s.status in ("dispatched", "simulated") else "warning"
        ))

    # 2. Medication / Reminder Logs
    rem_q = db.query(models.ReminderLog)
    if user_id:
        rem_q = rem_q.filter(models.ReminderLog.user_id == user_id)
    for r in rem_q.order_by(models.ReminderLog.timestamp.desc()).limit(20).all():
        events.append(schemas.TimelineEventOut(
            id=f"rem-{r.id}",
            type="reminder",
            title=f"Routine: {r.medicine_name}",
            description=f"Marked as {r.action} (Scheduled: {r.scheduled_time})",
            timestamp=r.timestamp,
            severity="success" if r.action == "Taken" else "warning"
        ))

    # 3. Health Readings
    read_q = db.query(models.HealthReading)
    if user_id:
        read_q = read_q.filter(models.HealthReading.user_id == user_id)
    for h in read_q.order_by(models.HealthReading.timestamp.desc()).limit(15).all():
        details = []
        if h.heart_rate:
            details.append(f"{h.heart_rate} BPM")
        if h.spo2:
            details.append(f"SpO2 {h.spo2}%")
        if h.body_temperature:
            details.append(f"{h.body_temperature}°C")
        if h.steps:
            details.append(f"{h.steps:,} steps")

        desc_str = ", ".join(details) if details else "Vitals telemetry synced."
        events.append(schemas.TimelineEventOut(
            id=f"health-{h.id}",
            type="vitals",
            title=f"Health Sync ({h.source.upper()})",
            description=desc_str,
            timestamp=h.timestamp,
            severity="info"
        ))

    # Sort descending by timestamp
    events.sort(key=lambda x: x.timestamp, reverse=True)
    return events[:limit]
