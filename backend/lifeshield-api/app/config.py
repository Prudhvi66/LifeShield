"""
LifeShield Application Configuration.
Reads settings from environment variables or .env file.
"""
from functools import lru_cache
from pathlib import Path
from typing import List, Optional
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent
CANONICAL_SQLITE_PATH = (BACKEND_DIR / "lifeshield.db").as_posix()
CANONICAL_ENV_PATH = (BACKEND_DIR / ".env").as_posix()


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(CANONICAL_ENV_PATH, ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # General
    app_name: str = "LifeShield API"
    environment: str = Field(default="development")
    cors_origins: List[str] = Field(default_factory=lambda: ["*"])

    # Database: Supports PostgreSQL (e.g. postgresql://user:pass@localhost:5432/db) or SQLite fallback
    database_url: str = Field(default=f"sqlite:///{CANONICAL_SQLITE_PATH}")

    @field_validator("database_url", mode="before")
    @classmethod
    def canonicalize_database_url(cls, v: str) -> str:
        if isinstance(v, str) and v.startswith("sqlite:///."):
            rel_part = v.replace("sqlite:///.", "").lstrip("/\\")
            abs_path = (BACKEND_DIR / rel_part).as_posix()
            return f"sqlite:///{abs_path}"
        return v

    # Security & JWT
    jwt_secret_key: str = Field(default="lifeshield_super_secure_jwt_secret_key_2026_change_in_production")
    jwt_algorithm: str = Field(default="HS256")
    access_token_expire_minutes: int = Field(default=10080)  # 7 days

    # Telephony Provider (Twilio)
    twilio_account_sid: Optional[str] = Field(default=None)
    twilio_auth_token: Optional[str] = Field(default=None)
    twilio_from_number: Optional[str] = Field(default=None)

    # Telephony Message Templates
    sos_voice_message: str = Field(
        default=(
            "This is an automated emergency alert from LifeShield. "
            "The user who listed you as an emergency contact has triggered "
            "an SOS alert at risk level {tier}. Please check on them immediately. "
            "Location: {maps_link}."
        )
    )
    sos_sms_message: str = Field(
        default=(
            "LifeShield SOS Alert: {name} triggered an emergency SOS (Risk Tier: {tier}). "
            "Last known location: {maps_link}. Please check on them or call emergency services."
        )
    )
    fall_voice_message: str = Field(
        default=(
            "This is an automated fall alert from LifeShield. "
            "{name} may have experienced a fall and did not respond to the on-screen safety check. "
            "Location: {maps_link}. Please check on them immediately."
        )
    )
    fall_sms_message: str = Field(
        default=(
            "LifeShield Fall Alert: {name} had an unconfirmed fall detected and timed out on the safety check. "
            "Location: {maps_link}. Please check on them immediately."
        )
    )

    # AI API Keys & Configuration
    gemini_api_key: Optional[str] = Field(default=None)
    gemini_model: str = Field(default="gemini-3.6-flash")
    openai_api_key: Optional[str] = Field(default=None)
    openai_model: str = Field(default="gpt-4o-mini")
    openweather_api_key: Optional[str] = Field(default=None)

    # Emergency Service Number (configurable, default 112)
    emergency_service_number: str = Field(default="112")

    @property
    def telephony_configured(self) -> bool:
        return bool(self.twilio_account_sid and self.twilio_auth_token and self.twilio_from_number)


@lru_cache
def get_settings() -> Settings:
    return Settings()
