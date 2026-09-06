"""
Emergency Contacts Management Routes.
Strictly requires authenticated user and enforces ownership isolation.
"""
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import require_current_user
from ..database import get_db

router = APIRouter(prefix="/api/contacts", tags=["Emergency Contacts"])


@router.post("", response_model=schemas.EmergencyContactOut)
def create_contact(
    payload: schemas.EmergencyContactCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_current_user)
):
    contact = models.EmergencyContact(
        user_id=current_user.id,
        device_id=payload.device_id,
        name=payload.name,
        phone=payload.phone,
        relation=payload.relation,
        priority=payload.priority,
        auto_notify=payload.auto_notify,
        created_at=datetime.now(timezone.utc),
    )
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return contact


@router.get("", response_model=List[schemas.EmergencyContactOut])
def list_contacts(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_current_user)
):
    return db.query(models.EmergencyContact).filter(
        models.EmergencyContact.user_id == current_user.id
    ).order_by(models.EmergencyContact.priority.asc(), models.EmergencyContact.created_at.asc()).all()


@router.put("/{contact_id}", response_model=schemas.EmergencyContactOut)
def update_contact(
    contact_id: str,
    payload: schemas.EmergencyContactUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_current_user)
):
    contact = db.query(models.EmergencyContact).filter(
        models.EmergencyContact.id == contact_id,
        models.EmergencyContact.user_id == current_user.id
    ).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Emergency contact not found")

    for field, val in payload.model_dump(exclude_unset=True).items():
        setattr(contact, field, val)

    db.commit()
    db.refresh(contact)
    return contact


@router.delete("/{contact_id}")
def delete_contact(
    contact_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_current_user)
):
    contact = db.query(models.EmergencyContact).filter(
        models.EmergencyContact.id == contact_id,
        models.EmergencyContact.user_id == current_user.id
    ).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Emergency contact not found")
    db.delete(contact)
    db.commit()
    return {"status": "ok", "message": "Contact deleted."}
