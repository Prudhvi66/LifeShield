"""
Wearable and Mobile Device Management Routes.
"""
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_user
from ..database import get_db

router = APIRouter(prefix="/api/devices", tags=["Devices & Wearables"])


@router.post("", response_model=schemas.DeviceOut)
def register_device(
    payload: schemas.DeviceCreate,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user)
):
    user_id = current_user.id if current_user else None

    device = models.Device(
        user_id=user_id,
        device_name=payload.device_name,
        device_type=payload.device_type,
        manufacturer=payload.manufacturer,
        battery_level=payload.battery_level,
        is_connected=True,
        last_seen=datetime.now(timezone.utc),
    )
    db.add(device)
    db.commit()
    db.refresh(device)
    return device


@router.get("", response_model=List[schemas.DeviceOut])
def list_devices(
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user)
):
    query = db.query(models.Device)
    if current_user:
        query = query.filter((models.Device.user_id == current_user.id) | (models.Device.user_id.is_(None)))
    return query.order_by(models.Device.created_at.desc()).all()


@router.get("/{device_id}", response_model=schemas.DeviceOut)
def get_device(device_id: str, db: Session = Depends(get_db)):
    device = db.get(models.Device, device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    return device


@router.delete("/{device_id}")
def delete_device(device_id: str, db: Session = Depends(get_db)):
    device = db.get(models.Device, device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    db.delete(device)
    db.commit()
    return {"status": "ok", "message": f"Device {device_id} removed."}
