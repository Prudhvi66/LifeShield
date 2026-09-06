"""
SOS and Emergency Dispatch Routes.
"""
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_user, require_current_user
from ..database import get_db
from ..telephony import TelephonyService, get_telephony_service

router = APIRouter(prefix="/api/sos", tags=["SOS Dispatch"])


def _maps_link(lat: Optional[float], lon: Optional[float]) -> str:
    if lat is None or lon is None:
        return "Location coordinates unavailable"
    return f"https://maps.google.com/?q={lat},{lon}"


def _resolve_contacts(
    db: Session,
    user: Optional[models.User],
    device_id: Optional[str],
    inline_contacts: List[dict]
) -> List[dict]:
    query = db.query(models.EmergencyContact)
    if user:
        stored = query.filter(models.EmergencyContact.user_id == user.id).all()
        if stored:
            return [{"name": c.name, "phone": c.phone} for c in stored if c.auto_notify]

    if device_id:
        stored = query.filter(models.EmergencyContact.device_id == device_id).all()
        if stored:
            return [{"name": c.name, "phone": c.phone} for c in stored if c.auto_notify]

    if inline_contacts:
        return inline_contacts

    return []


@router.post("", response_model=schemas.SOSOut)
def trigger_sos(
    payload: schemas.SOSCreate,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user),
    telephony: TelephonyService = Depends(get_telephony_service)
):
    user_id = current_user.id if current_user else None
    user_name = current_user.full_name if current_user else "LifeShield User"
    contacts = _resolve_contacts(db, current_user, payload.device_id, payload.contacts)

    tier = payload.risk_tier or "Emergency"
    maps_link = _maps_link(payload.lat, payload.lon)

    voice_msg = telephony.settings.sos_voice_message.format(
        tier=tier,
        maps_link=maps_link
    )
    sms_msg = telephony.settings.sos_sms_message.format(
        name=user_name,
        tier=tier,
        maps_link=maps_link
    )

    sos_event = models.SOSEvent(
        user_id=user_id,
        device_id=payload.device_id,
        lat=payload.lat,
        lon=payload.lon,
        address=payload.address,
        tier_at_trigger=tier,
        risk_score=payload.risk_score or 100,
        event_type="manual_sos",
        status="pending",
        created_at=datetime.now(timezone.utc),
    )
    db.add(sos_event)
    db.commit()
    db.refresh(sos_event)

    results: List[schemas.ContactDispatchResult] = []
    any_dispatched = False

    for contact in contacts:
        call_res = telephony.place_call(contact["phone"], voice_msg)
        sms_res = telephony.send_sms(contact["phone"], sms_msg)
        if call_res.status == "dispatched" or sms_res.status == "dispatched":
            any_dispatched = True

        results.append(
            schemas.ContactDispatchResult(
                name=contact["name"],
                phone=contact["phone"],
                call=call_res.__dict__,
                sms=sms_res.__dict__,
            )
        )

    sos_event.dispatched_at = datetime.now(timezone.utc)
    sos_event.channel = "call+sms"
    sos_event.contacts_notified = [r.model_dump() for r in results]

    if any_dispatched:
        sos_event.status = "dispatched"
        msg = f"Live alert dispatched to {len(contacts)} emergency contact(s)."
    elif telephony.live:
        sos_event.status = "failed"
        sos_event.error_message = "Telephony attempts failed."
        msg = "Emergency call attempts failed to reach carrier network."
    else:
        sos_event.status = "simulated"
        msg = (
            f"Emergency SOS recorded for {len(contacts)} contact(s). "
            f"Telephony running in transparent simulation mode (Twilio credentials unconfigured)."
        )

    db.commit()
    db.refresh(sos_event)

    return schemas.SOSOut(
        id=sos_event.id,
        status=sos_event.status,
        message=msg,
        channel=sos_event.channel,
        event_type=sos_event.event_type,
        created_at=sos_event.created_at,
        dispatched_at=sos_event.dispatched_at,
        contacts_notified=results,
        telephony_live=telephony.live,
    )


@router.get("/history", response_model=List[schemas.SOSOut])
def list_sos_history(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_current_user),
    telephony: TelephonyService = Depends(get_telephony_service)
):
    events = db.query(models.SOSEvent).filter(
        models.SOSEvent.user_id == current_user.id
    ).order_by(models.SOSEvent.created_at.desc()).limit(50).all()

    out: List[schemas.SOSOut] = []
    for e in events:
        contacts_notified = [schemas.ContactDispatchResult(**c) for c in (e.contacts_notified or [])]
        out.append(schemas.SOSOut(
            id=e.id,
            status=e.status,
            message=e.error_message or f"SOS Event ({e.event_type}).",
            channel=e.channel,
            event_type=e.event_type or "manual_sos",
            created_at=e.created_at,
            dispatched_at=e.dispatched_at,
            contacts_notified=contacts_notified,
            telephony_live=telephony.live,
        ))
    return out


@router.get("/{sos_id}", response_model=schemas.SOSOut)
def get_sos(
    sos_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_current_user),
    telephony: TelephonyService = Depends(get_telephony_service)
):
    event = db.query(models.SOSEvent).filter(
        models.SOSEvent.id == sos_id,
        models.SOSEvent.user_id == current_user.id
    ).first()
    if not event:
        raise HTTPException(status_code=404, detail="SOS event not found")
    contacts_notified = [schemas.ContactDispatchResult(**c) for c in (event.contacts_notified or [])]
    return schemas.SOSOut(
        id=event.id,
        status=event.status,
        message=event.error_message or "SOS record.",
        channel=event.channel,
        event_type=event.event_type or "manual_sos",
        created_at=event.created_at,
        dispatched_at=event.dispatched_at,
        contacts_notified=contacts_notified,
        telephony_live=telephony.live,
    )
