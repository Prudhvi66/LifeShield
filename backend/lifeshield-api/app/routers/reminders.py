"""
Reminders and Routine Management Routes (Medicine, Water, Meals, Activities).
Strictly enforces: Only remind user-entered schedules; never prescribe medication or dosage.
"""
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_user
from ..database import get_db

router = APIRouter(prefix="/api/reminders", tags=["Reminders & Routine"])


@router.post("", response_model=schemas.ReminderOut)
def create_reminder(
    payload: schemas.ReminderCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    user_id = current_user.id if current_user else None

    reminder = models.Reminder(
        user_id=user_id,
        title=payload.title,
        reminder_type=payload.reminder_type,
        time=payload.time,
        dosage=payload.dosage,
        repeat=payload.repeat,
        voice_enabled=payload.voice_enabled,
        language=payload.language,
        is_active=payload.is_active,
        created_at=datetime.now(timezone.utc),
    )
    db.add(reminder)
    db.commit()
    db.refresh(reminder)
    return reminder


@router.get("", response_model=List[schemas.ReminderOut])
def list_reminders(
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user)
):
    query = db.query(models.Reminder)
    if current_user:
        query = query.filter((models.Reminder.user_id == current_user.id) | (models.Reminder.user_id.is_(None)))
    return query.order_by(models.Reminder.time.asc()).all()


@router.put("/{reminder_id}", response_model=schemas.ReminderOut)
def update_reminder(
    reminder_id: str,
    payload: schemas.ReminderUpdate,
    db: Session = Depends(get_db)
):
    reminder = db.get(models.Reminder, reminder_id)
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")

    for field, val in payload.model_dump(exclude_unset=True).items():
        setattr(reminder, field, val)

    db.commit()
    db.refresh(reminder)
    return reminder


@router.delete("/{reminder_id}")
def delete_reminder(reminder_id: str, db: Session = Depends(get_db)):
    reminder = db.get(models.Reminder, reminder_id)
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")
    db.delete(reminder)
    db.commit()
    return {"status": "ok", "message": "Reminder deleted."}


@router.post("/{reminder_id}/log", response_model=schemas.ReminderLogOut)
def log_reminder_action(
    reminder_id: str,
    payload: schemas.ReminderLogCreate,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user)
):
    user_id = current_user.id if current_user else None

    log_entry = models.ReminderLog(
        reminder_id=reminder_id,
        user_id=user_id,
        medicine_name=payload.medicine_name,
        scheduled_time=payload.scheduled_time,
        action=payload.action,
        timestamp=datetime.now(timezone.utc),
        notes=payload.notes,
    )
    db.add(log_entry)
    db.commit()
    db.refresh(log_entry)
    return log_entry


@router.get("/history", response_model=List[schemas.ReminderLogOut])
def get_reminder_history(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user)
):
    query = db.query(models.ReminderLog)
    if current_user:
        query = query.filter((models.ReminderLog.user_id == current_user.id) | (models.ReminderLog.user_id.is_(None)))
    return query.order_by(models.ReminderLog.timestamp.desc()).limit(limit).all()
