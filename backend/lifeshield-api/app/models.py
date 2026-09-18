"""
SQLAlchemy ORM Models for LifeShield.
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    JSON,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .database import Base


def new_id() -> str:
    return uuid.uuid4().hex


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    email: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String, nullable=False)
    full_name: Mapped[str] = mapped_column(String, nullable=False, default="LifeShield User")
    age: Mapped[int | None] = mapped_column(Integer, nullable=True, default=32)
    blood_group: Mapped[str | None] = mapped_column(String, nullable=True, default="O+")
    primary_language: Mapped[str] = mapped_column(String, default="en")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    # Relationships
    baseline: Mapped["UserBaseline"] = relationship(back_populates="user", uselist=False, cascade="all, delete-orphan")
    devices: Mapped[list["Device"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    health_readings: Mapped[list["HealthReading"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    reminders: Mapped[list["Reminder"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    reminder_logs: Mapped[list["ReminderLog"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    emergency_contacts: Mapped[list["EmergencyContact"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    sos_events: Mapped[list["SOSEvent"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    voice_preferences: Mapped["VoicePreference"] = relationship(back_populates="user", uselist=False, cascade="all, delete-orphan")
    dispatch_preferences: Mapped["EmergencyDispatchPreference"] = relationship(back_populates="user", uselist=False, cascade="all, delete-orphan")


class UserBaseline(Base):
    __tablename__ = "user_baselines"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), unique=True, nullable=False)
    resting_heart_rate: Mapped[int] = mapped_column(Integer, default=70)
    normal_spo2: Mapped[int] = mapped_column(Integer, default=98)
    normal_body_temp: Mapped[float] = mapped_column(Float, default=36.6)
    systolic_bp: Mapped[int] = mapped_column(Integer, default=120)
    diastolic_bp: Mapped[int] = mapped_column(Integer, default=80)
    daily_steps_goal: Mapped[int] = mapped_column(Integer, default=8000)
    medical_conditions: Mapped[str | None] = mapped_column(Text, nullable=True)
    allergies: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    user: Mapped["User"] = relationship(back_populates="baseline")


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    user_id: Mapped[str | None] = mapped_column(String, ForeignKey("users.id"), nullable=True)
    device_name: Mapped[str] = mapped_column(String, default="Bluetooth BLE Wearable")
    device_type: Mapped[str] = mapped_column(String, default="smartwatch")  # smartwatch | fitness_band | pulse_oximeter | phone
    manufacturer: Mapped[str | None] = mapped_column(String, nullable=True)
    battery_level: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_connected: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    last_seen: Mapped[datetime | None] = mapped_column(DateTime, default=utcnow)
    last_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    last_lon: Mapped[float | None] = mapped_column(Float, nullable=True)

    user: Mapped["User"] = relationship(back_populates="devices")
    contacts: Mapped[list["EmergencyContact"]] = relationship(back_populates="device", cascade="all, delete-orphan", order_by="EmergencyContact.priority")
    sos_events: Mapped[list["SOSEvent"]] = relationship(back_populates="device", cascade="all, delete-orphan")
    risk_events: Mapped[list["RiskTierEvent"]] = relationship(back_populates="device", cascade="all, delete-orphan")


class HealthReading(Base):
    __tablename__ = "health_readings"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    user_id: Mapped[str | None] = mapped_column(String, ForeignKey("users.id"), nullable=True)
    device_id: Mapped[str | None] = mapped_column(String, ForeignKey("devices.id"), nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
    heart_rate: Mapped[int | None] = mapped_column(Integer, nullable=True)
    spo2: Mapped[int | None] = mapped_column(Integer, nullable=True)
    steps: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sleep_hours: Mapped[float | None] = mapped_column(Float, nullable=True)
    body_temperature: Mapped[float | None] = mapped_column(Float, nullable=True)
    systolic_bp: Mapped[int | None] = mapped_column(Integer, nullable=True)
    diastolic_bp: Mapped[int | None] = mapped_column(Integer, nullable=True)
    hydration_index: Mapped[float | None] = mapped_column(Float, nullable=True)
    activity_level: Mapped[str | None] = mapped_column(String, nullable=True)
    source: Mapped[str] = mapped_column(String, default="manual")  # ble | health_connect | manual
    raw_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    user: Mapped["User"] = relationship(back_populates="health_readings")


class Reminder(Base):
    __tablename__ = "reminders"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    user_id: Mapped[str | None] = mapped_column(String, ForeignKey("users.id"), nullable=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    reminder_type: Mapped[str] = mapped_column(String, default="medicine")  # medicine | water | meal | activity
    time: Mapped[str] = mapped_column(String, nullable=False)  # HH:MM
    dosage: Mapped[str | None] = mapped_column(String, nullable=True)
    repeat: Mapped[str] = mapped_column(String, default="Daily")  # Daily | Once | Weekly
    voice_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    language: Mapped[str] = mapped_column(String, default="en")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    user: Mapped["User"] = relationship(back_populates="reminders")
    logs: Mapped[list["ReminderLog"]] = relationship(back_populates="reminder", cascade="all, delete-orphan")


class ReminderLog(Base):
    __tablename__ = "reminder_logs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    reminder_id: Mapped[str | None] = mapped_column(String, ForeignKey("reminders.id"), nullable=True)
    user_id: Mapped[str | None] = mapped_column(String, ForeignKey("users.id"), nullable=True)
    medicine_name: Mapped[str] = mapped_column(String, nullable=False)
    scheduled_time: Mapped[str] = mapped_column(String, nullable=False)
    action: Mapped[str] = mapped_column(String, nullable=False)  # Taken | Skipped
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    notes: Mapped[str | None] = mapped_column(String, nullable=True)

    user: Mapped["User"] = relationship(back_populates="reminder_logs")
    reminder: Mapped["Reminder"] = relationship(back_populates="logs")


class EmergencyContact(Base):
    __tablename__ = "emergency_contacts"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    user_id: Mapped[str | None] = mapped_column(String, ForeignKey("users.id"), nullable=True)
    device_id: Mapped[str | None] = mapped_column(String, ForeignKey("devices.id"), nullable=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    phone: Mapped[str] = mapped_column(String, nullable=False)
    relation: Mapped[str | None] = mapped_column(String, nullable=True, default="Family")
    priority: Mapped[int] = mapped_column(Integer, default=1)
    auto_notify: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    user: Mapped["User"] = relationship(back_populates="emergency_contacts")
    device: Mapped["Device"] = relationship(back_populates="contacts")


class SOSEvent(Base):
    __tablename__ = "sos_events"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    user_id: Mapped[str | None] = mapped_column(String, ForeignKey("users.id"), nullable=True)
    device_id: Mapped[str | None] = mapped_column(String, ForeignKey("devices.id"), nullable=True)
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lon: Mapped[float | None] = mapped_column(Float, nullable=True)
    location_accuracy: Mapped[float | None] = mapped_column(Float, nullable=True)
    location_timestamp: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    address: Mapped[str | None] = mapped_column(String, nullable=True)
    tier_at_trigger: Mapped[str | None] = mapped_column(String, nullable=True)
    risk_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String, default="pending")
    channel: Mapped[str | None] = mapped_column(String, nullable=True)
    event_type: Mapped[str] = mapped_column(String, default="manual_sos")
    cancelled: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    dispatched_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    contacts_notified: Mapped[list | None] = mapped_column(JSON, nullable=True)
    emergency_service_number: Mapped[str | None] = mapped_column(String, nullable=True)
    emergency_service_status: Mapped[str | None] = mapped_column(String, nullable=True)
    sms_delivery_status: Mapped[str | None] = mapped_column(String, nullable=True)
    call_status: Mapped[str | None] = mapped_column(String, nullable=True)
    error_message: Mapped[str | None] = mapped_column(String, nullable=True)

    user: Mapped["User"] = relationship(back_populates="sos_events")
    device: Mapped["Device"] = relationship(back_populates="sos_events")


class HazardSnapshot(Base):
    __tablename__ = "hazard_snapshots"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    grid_key: Mapped[str] = mapped_column(String, nullable=False, index=True)
    heat_index_c: Mapped[float | None] = mapped_column(Float, nullable=True)
    aqi: Mapped[float | None] = mapped_column(Float, nullable=True)
    flood_risk: Mapped[float | None] = mapped_column(Float, nullable=True)
    raw: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    fetched_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class RiskTierEvent(Base):
    __tablename__ = "risk_tier_events"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    user_id: Mapped[str | None] = mapped_column(String, ForeignKey("users.id"), nullable=True)
    device_id: Mapped[str | None] = mapped_column(String, ForeignKey("devices.id"), nullable=True)
    tier: Mapped[str] = mapped_column(String, nullable=False)
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    contributors: Mapped[dict | list | None] = mapped_column(JSON, nullable=True)
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lon: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    device: Mapped["Device"] = relationship(back_populates="risk_events")


class VoicePreference(Base):
    __tablename__ = "voice_preferences"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), unique=True, nullable=False)
    master_voice_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    voice_lang: Mapped[str] = mapped_column(String, default="en")
    speech_rate: Mapped[float] = mapped_column(Float, default=1.0)
    selected_voice_name: Mapped[str | None] = mapped_column(String, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    user: Mapped["User"] = relationship(back_populates="voice_preferences")


class EmergencyDispatchPreference(Base):
    __tablename__ = "emergency_dispatch_preferences"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), unique=True, nullable=False)
    auto_call_police: Mapped[bool] = mapped_column(Boolean, default=False)
    auto_call_ambulance: Mapped[bool] = mapped_column(Boolean, default=False)
    police_number: Mapped[str] = mapped_column(String, default="100")
    ambulance_number: Mapped[str] = mapped_column(String, default="108")
    unified_emergency_number: Mapped[str] = mapped_column(String, default="112")
    country: Mapped[str] = mapped_column(String, default="IN")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    user: Mapped["User"] = relationship(back_populates="dispatch_preferences")
