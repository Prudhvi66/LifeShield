"""
Emergency Dispatch Preferences Routes.
Manages user's automatic calling preferences for Police, Ambulance, and Primary Contact.
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import require_current_user
from ..database import get_db

router = APIRouter(prefix="/api/dispatch", tags=["Emergency Dispatch Preferences"])


@router.get("", response_model=schemas.EmergencyDispatchPreferenceOut)
def get_dispatch_preferences(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_current_user)
):
    pref = db.query(models.EmergencyDispatchPreference).filter(
        models.EmergencyDispatchPreference.user_id == current_user.id
    ).first()

    if not pref:
        pref = models.EmergencyDispatchPreference(
            user_id=current_user.id,
            auto_call_police=False,
            auto_call_ambulance=False,
            police_number="100",
            ambulance_number="108",
            unified_emergency_number="112",
            country="IN",
            created_at=datetime.now(timezone.utc),
        )
        db.add(pref)
        db.commit()
        db.refresh(pref)

    return pref


@router.put("", response_model=schemas.EmergencyDispatchPreferenceOut)
def update_dispatch_preferences(
    payload: schemas.EmergencyDispatchPreferenceUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_current_user)
):
    pref = db.query(models.EmergencyDispatchPreference).filter(
        models.EmergencyDispatchPreference.user_id == current_user.id
    ).first()

    if not pref:
        pref = models.EmergencyDispatchPreference(
            user_id=current_user.id,
            auto_call_police=False,
            auto_call_ambulance=False,
            police_number="100",
            ambulance_number="108",
            unified_emergency_number="112",
            country="IN",
            created_at=datetime.now(timezone.utc),
        )
        db.add(pref)

    for field, val in payload.model_dump(exclude_unset=True).items():
        setattr(pref, field, val)

    db.commit()
    db.refresh(pref)
    return pref
