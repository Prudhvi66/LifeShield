"""
Emergency Fall Detection Automated Trigger Routes.
"""
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_user
from ..database import get_db
from ..telephony import TelephonyService, get_telephony_service
from .sos import _maps_link, _resolve_contacts

router = APIRouter(prefix="/api/emergency", tags=["Emergency Fall Detection"])


@router.post("/fall", response_model=schemas.SOSOut)
def trigger_fall_alert(
    payload: schemas.FallEventCreate,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user),
    telephony: TelephonyService = Depends(get_telephony_service)
):
    user_id = current_user.id if current_user else None
    user_name = payload.user_name or (current_user.full_name if current_user else "LifeShield User")
    contacts = _resolve_contacts(db, current_user, payload.device_id, payload.contacts)

    tier = payload.risk_tier or "Emergency"
    maps_link = _maps_link(payload.lat, payload.lon)

    voice_msg = telephony.settings.fall_voice_message.format(
        name=user_name,
        maps_link=maps_link
    )
    sms_msg = telephony.settings.fall_sms_message.format(
        name=user_name,
        maps_link=maps_link
    )

    sos_event = models.SOSEvent(
        user_id=user_id,
        device_id=payload.device_id,
        lat=payload.lat,
        lon=payload.lon,
        address=payload.address,
        tier_at_trigger=tier,
        risk_score=payload.risk_score or 90,
        event_type="fall_detected",
        status="pending",
        created_at=datetime.now(timezone.utc),
    )
    db.add(sos_event)
    db.commit()
    db.refresh(sos_event)

    results = []
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
        msg = f"Automatic fall alert dispatched to {len(contacts)} emergency contact(s)."
    elif telephony.live:
        sos_event.status = "failed"
        sos_event.error_message = "Fall alert telephony failed."
        msg = "Fall alert call attempts failed to reach carrier network."
    else:
        sos_event.status = "simulated"
        msg = (
            f"Fall detection alert recorded for {len(contacts)} contact(s). "
            f"Simulated telephony flow ran (Twilio credentials unconfigured)."
        )

    db.commit()
    db.refresh(sos_event)

    return schemas.SOSOut(
        id=sos_event.id,
        status=sos_event.status,
        message=msg,
        channel=sos_event.channel,
        event_type="fall_detected",
        created_at=sos_event.created_at,
        dispatched_at=sos_event.dispatched_at,
        contacts_notified=results,
        telephony_live=telephony.live,
    )
