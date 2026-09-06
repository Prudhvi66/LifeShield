"""
Authentication and User Access Routes.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import create_access_token, get_password_hash, require_current_user, verify_password
from ..database import get_db

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/register", response_model=schemas.TokenOut)
def register(payload: schemas.UserRegister, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.email == payload.email.lower()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists."
        )

    user = models.User(
        email=payload.email.lower(),
        hashed_password=get_password_hash(payload.password),
        full_name=payload.full_name,
        primary_language=payload.primary_language,
        age=payload.age,
        blood_group=payload.blood_group,
    )
    db.add(user)
    db.flush()

    # Create default user baseline
    baseline = models.UserBaseline(
        user_id=user.id,
        resting_heart_rate=70,
        normal_spo2=98,
        normal_body_temp=36.6,
        systolic_bp=120,
        diastolic_bp=80,
        daily_steps_goal=8000,
    )
    db.add(baseline)

    # Create default voice preferences
    voice_pref = models.VoicePreference(
        user_id=user.id,
        master_voice_enabled=True,
        voice_lang=payload.primary_language or "en",
        speech_rate=1.0
    )
    db.add(voice_pref)

    db.commit()
    db.refresh(user)

    token = create_access_token(data={"sub": user.id, "email": user.email})
    return schemas.TokenOut(access_token=token, token_type="bearer", user=user)


@router.post("/login", response_model=schemas.TokenOut)
def login(payload: schemas.UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == payload.email.lower()).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(status_code=400, detail="User account is deactivated.")

    token = create_access_token(data={"sub": user.id, "email": user.email})
    return schemas.TokenOut(access_token=token, token_type="bearer", user=user)


@router.get("/me", response_model=schemas.UserOut)
def get_me(current_user: models.User = Depends(require_current_user)):
    return current_user


@router.post("/change-password")
def change_password(
    payload: schemas.PasswordUpdate,
    current_user: models.User = Depends(require_current_user),
    db: Session = Depends(get_db)
):
    if not verify_password(payload.old_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password does not match.")
    current_user.hashed_password = get_password_hash(payload.new_password)
    db.commit()
    return {"status": "ok", "message": "Password updated successfully."}
