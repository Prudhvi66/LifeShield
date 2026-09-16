"""
SOS and Emergency Dispatch Routes.
Handles SOS trigger, cancellation, history, and per-contact dispatch status.
"""
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import require_current_user
from ..database import get_db
from ..telephony import TelephonyService, get_telephony_service

router = APIRouter(prefix="/api/sos", tags=["SOS Dispatch"])


def _maps_link(lat: Optional[float], lon: Optional[float]) -> str:
    if lat is None or lon is None:
        return "Location coordinates unavailable"
    return f"https://www.google.com/maps?q={lat},{lon}"


def _resolve_contacts(
    db: Session,
    user: Optional[models.User],
    device_id: Optional[str],
    inline_contacts: List[dict]
) -> List[dict]:
    query = db.query(models.EmergencyContact)
    if user:
        stored = query.filter(models.EmergencyContact.user_id == user.id).order_by(
            models.EmergencyContact.priority.asc()
        ).all()
        if stored:
            return [{"name": c.name, "phone": c.phone, "priority": c.priority} for c in stored if c.auto_notify]

    if device_id:
        stored = query.filter(models.EmergencyContact.device_id == device_id).all()
        if stored:
            return [{"name": c.name, "phone": c.phone, "priority": c.priority} for c in stored if c.auto_notify]

    if inline_contacts:
        return inline_contacts

    return []


def _build_sos_out(event: models.SOSEvent, telephony: TelephonyService) -> schemas.SOSOut:
    contacts_notified = [schemas.ContactDispatchResult(**c) for c in (event.contacts_notified or [])]
    return schemas.SOSOut(
        id=event.id,
        status=event.status,
        message=event.error_message or f"SOS Event ({event.event_type}).",
        channel=event.channel,
        event_type=event.event_type or "manual_sos",
        created_at=event.created_at,
        dispatched_at=event.dispatched_at,
        contacts_notified=contacts_notified,
        telephony_live=telephony.live,
        lat=event.lat,
        lon=event.lon,
        location_accuracy=event.location_accuracy,
        location_timestamp=event.location_timestamp,
        cancelled=event.cancelled,
        emergency_service_number=event.emergency_service_number,
        emergency_service_status=event.emergency_service_status,
        sms_delivery_status=event.sms_delivery_status,
        call_status=event.call_status,
        error_message=event.error_message,
    )


@router.post("", response_model=schemas.SOSOut)
def trigger_sos(
    payload: schemas.SOSCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_current_user),
    telephony: TelephonyService = Depends(get_telephony_service)
):
    user_id = current_user.id
    user_name = current_user.full_name
    contacts = _resolve_contacts(db, current_user, payload.device_id, payload.contacts)

    tier = payload.risk_tier or "Emergency"
    maps_link = _maps_link(payload.lat, payload.lon)

    # Parse location timestamp if provided
    loc_ts = None
    if payload.location_timestamp:
        try:
            loc_ts = datetime.fromisoformat(payload.location_timestamp.replace("Z", "+00:00"))
        except Exception:
            loc_ts = datetime.now(timezone.utc)

    # Use the emergency message from frontend if provided, otherwise build one
    sms_msg = payload.emergency_message or telephony.settings.sos_sms_message.format(
        name=user_name,
        tier=tier,
        maps_link=maps_link
    )
    voice_msg = telephony.settings.sos_voice_message.format(
        tier=tier,
        maps_link=maps_link
    )

    sos_event = models.SOSEvent(
        user_id=user_id,
        device_id=payload.device_id,
        lat=payload.lat,
        lon=payload.lon,
        location_accuracy=payload.location_accuracy,
        location_timestamp=loc_ts or datetime.now(timezone.utc),
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
    any_sms_dispatched = False
    any_call_dispatched = False
    overall_sms_status = "no_contacts"
    overall_call_status = "no_contacts"

    if not contacts:
        overall_sms_status = "no_contacts"
        overall_call_status = "no_contacts"
    else:
        sms_statuses = []
        call_statuses = []

        for contact in contacts:
            call_res = telephony.place_call(contact["phone"], voice_msg)
            sms_res = telephony.send_sms(contact["phone"], sms_msg)

            if call_res.status == "dispatched":
                any_call_dispatched = True
            if sms_res.status == "dispatched":
                any_sms_dispatched = True

            call_statuses.append(call_res.status)
            sms_statuses.append(sms_res.status)

            results.append(
                schemas.ContactDispatchResult(
                    name=contact["name"],
                    phone=contact["phone"],
                    call=call_res.__dict__,
                    sms=sms_res.__dict__,
                )
            )

        # Determine overall statuses
        if any_call_dispatched:
            overall_call_status = "dispatched"
        elif telephony.live:
            overall_call_status = "failed"
        else:
            overall_call_status = "simulated"

        if any_sms_dispatched:
            overall_sms_status = "dispatched"
        elif telephony.live:
            overall_sms_status = "failed"
        else:
            overall_sms_status = "simulated"

    sos_event.dispatched_at = datetime.now(timezone.utc)
    sos_event.channel = "call+sms"
    sos_event.contacts_notified = [r.model_dump() for r in results]
    sos_event.sms_delivery_status = overall_sms_status
    sos_event.call_status = overall_call_status

    # Determine overall status
    if any_dispatched := (any_sms_dispatched or any_call_dispatched):
        sos_event.status = "dispatched"
        msg = f"Live alert dispatched to {len(contacts)} emergency contact(s)."
    elif telephony.live:
        sos_event.status = "failed"
        sos_event.error_message = "Telephony attempts failed to reach carrier network."
        msg = "Emergency call attempts failed to reach carrier network."
    else:
        sos_event.status = "simulated"
        if not contacts:
            msg = (
                "SOS event recorded. No emergency contacts are configured. "
                "SMS/Call service is NOT CONFIGURED (Twilio not set). "
                "No contacts were notified."
            )
        else:
            msg = (
                f"Emergency SOS recorded for {len(contacts)} contact(s). "
                f"SMS service is NOT CONFIGURED (Twilio not set). "
                f"Contacts were not actually called or messaged via a telephony provider."
            )

    sos_event.error_message = msg
    db.commit()
    db.refresh(sos_event)

    return _build_sos_out(sos_event, telephony)


@router.post("/cancel", response_model=schemas.SOSOut)
def cancel_sos(
    payload: schemas.SOSCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_current_user),
    telephony: TelephonyService = Depends(get_telephony_service)
):
    """Record a cancelled SOS event."""
    user_id = current_user.id

    sos_event = models.SOSEvent(
        user_id=user_id,
        device_id=payload.device_id,
        lat=payload.lat,
        lon=payload.lon,
        location_accuracy=payload.location_accuracy,
        location_timestamp=datetime.now(timezone.utc),
        address=payload.address,
        tier_at_trigger="Cancelled",
        risk_score=0,
        event_type="manual_sos",
        status="cancelled",
        cancelled=True,
        created_at=datetime.now(timezone.utc),
        dispatched_at=datetime.now(timezone.utc),
        error_message="SOS cancelled by user during countdown. No contacts were notified.",
    )
    db.add(sos_event)
    db.commit()
    db.refresh(sos_event)

    return _build_sos_out(sos_event, telephony)


@router.get("/history", response_model=List[schemas.SOSOut])
def list_sos_history(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_current_user),
    telephony: TelephonyService = Depends(get_telephony_service)
):
    events = db.query(models.SOSEvent).filter(
        models.SOSEvent.user_id == current_user.id
    ).order_by(models.SOSEvent.created_at.desc()).limit(50).all()

    return [_build_sos_out(e, telephony) for e in events]


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
    return _build_sos_out(event, telephony)
