"""
User Profile, Baseline, and Voice Preferences Routes.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import require_current_user
from ..database import get_db

router = APIRouter(prefix="/api/profile", tags=["User Profile"])


@router.get("", response_model=schemas.UserOut)
def get_profile(current_user: models.User = Depends(require_current_user)):
    return current_user


@router.put("", response_model=schemas.UserOut)
def update_profile(
    payload: schemas.UserRegister,
    current_user: models.User = Depends(require_current_user),
    db: Session = Depends(get_db)
):
    current_user.full_name = payload.full_name
    current_user.primary_language = payload.primary_language
    current_user.age = payload.age
    current_user.blood_group = payload.blood_group
    db.commit()
    db.refresh(current_user)
    return current_user


@router.get("/baseline", response_model=schemas.BaselineOut)
def get_baseline(
    current_user: models.User = Depends(require_current_user),
    db: Session = Depends(get_db)
):
    baseline = db.query(models.UserBaseline).filter(models.UserBaseline.user_id == current_user.id).first()
    if not baseline:
        baseline = models.UserBaseline(user_id=current_user.id)
        db.add(baseline)
        db.commit()
        db.refresh(baseline)
    return baseline


@router.put("/baseline", response_model=schemas.BaselineOut)
def update_baseline(
    payload: schemas.BaselineUpdate,
    current_user: models.User = Depends(require_current_user),
    db: Session = Depends(get_db)
):
    baseline = db.query(models.UserBaseline).filter(models.UserBaseline.user_id == current_user.id).first()
    if not baseline:
        baseline = models.UserBaseline(user_id=current_user.id)
        db.add(baseline)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(baseline, field, value)

    db.commit()
    db.refresh(baseline)
    return baseline


@router.get("/voice", response_model=schemas.VoicePreferenceOut)
def get_voice_preferences(
    current_user: models.User = Depends(require_current_user),
    db: Session = Depends(get_db)
):
    pref = db.query(models.VoicePreference).filter(models.VoicePreference.user_id == current_user.id).first()
    if not pref:
        pref = models.VoicePreference(user_id=current_user.id)
        db.add(pref)
        db.commit()
        db.refresh(pref)
    return pref


@router.put("/voice", response_model=schemas.VoicePreferenceOut)
def update_voice_preferences(
    payload: schemas.VoicePreferenceIn,
    current_user: models.User = Depends(require_current_user),
    db: Session = Depends(get_db)
):
    pref = db.query(models.VoicePreference).filter(models.VoicePreference.user_id == current_user.id).first()
    if not pref:
        pref = models.VoicePreference(user_id=current_user.id)
        db.add(pref)

    pref.master_voice_enabled = payload.master_voice_enabled
    pref.voice_lang = payload.voice_lang
    pref.speech_rate = payload.speech_rate
    pref.selected_voice_name = payload.selected_voice_name

    db.commit()
    db.refresh(pref)
    return pref
