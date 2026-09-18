"""
Pydantic Schemas for LifeShield API validation.
"""
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field, field_validator


# --- Auth & User ---
class UserRegister(BaseModel):
    email: str
    password: str = Field(min_length=6)
    full_name: str = Field(min_length=1)
    primary_language: str = "en"
    age: Optional[int] = 32
    blood_group: Optional[str] = "O+"


class UserLogin(BaseModel):
    email: str
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


class PasswordUpdate(BaseModel):
    old_password: str
    new_password: str = Field(min_length=6)


class BaselineUpdate(BaseModel):
    resting_heart_rate: Optional[int] = 70
    normal_spo2: Optional[int] = 98
    normal_body_temp: Optional[float] = 36.6
    systolic_bp: Optional[int] = 120
    diastolic_bp: Optional[int] = 80
    daily_steps_goal: Optional[int] = 8000
    medical_conditions: Optional[str] = None
    allergies: Optional[str] = None


class BaselineOut(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    resting_heart_rate: int
    normal_spo2: int
    normal_body_temp: float
    systolic_bp: int
    diastolic_bp: int
    daily_steps_goal: int
    medical_conditions: Optional[str] = None
    allergies: Optional[str] = None
    updated_at: datetime


class UserOut(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    email: str
    full_name: str
    primary_language: str
    age: Optional[int] = None
    blood_group: Optional[str] = None
    is_active: bool
    created_at: datetime
    baseline: Optional[BaselineOut] = None


# --- Devices ---
class DeviceCreate(BaseModel):
    device_name: str = "Bluetooth BLE Wearable"
    device_type: str = "smartwatch"
    manufacturer: Optional[str] = None
    battery_level: Optional[int] = None


class DeviceOut(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    user_id: Optional[str] = None
    device_name: str
    device_type: str
    manufacturer: Optional[str] = None
    battery_level: Optional[int] = None
    is_connected: bool
    last_seen: Optional[datetime] = None
    created_at: datetime


# --- Health & Vitals ---
class HealthReadingCreate(BaseModel):
    device_id: Optional[str] = None
    heart_rate: Optional[int] = None
    spo2: Optional[int] = None
    steps: Optional[int] = None
    sleep_hours: Optional[float] = None
    body_temperature: Optional[float] = None
    systolic_bp: Optional[int] = None
    diastolic_bp: Optional[int] = None
    hydration_index: Optional[float] = None
    activity_level: Optional[str] = None
    source: str = "ble"  # ble | health_connect | manual
    raw_data: Optional[Dict[str, Any]] = None


class HealthReadingOut(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    user_id: Optional[str] = None
    device_id: Optional[str] = None
    timestamp: datetime
    heart_rate: Optional[int] = None
    spo2: Optional[int] = None
    steps: Optional[int] = None
    sleep_hours: Optional[float] = None
    body_temperature: Optional[float] = None
    systolic_bp: Optional[int] = None
    diastolic_bp: Optional[int] = None
    hydration_index: Optional[float] = None
    activity_level: Optional[str] = None
    source: str


class TrendPointOut(BaseModel):
    timestamp: str
    heart_rate: Optional[int] = None
    spo2: Optional[int] = None
    steps: Optional[int] = None
    body_temperature: Optional[float] = None


class HealthSummaryOut(BaseModel):
    latest: Optional[HealthReadingOut] = None
    averages_24h: Dict[str, Any]
    total_steps_today: int
    data_available: bool
    status_message: str


# --- Reminders ---
class ReminderCreate(BaseModel):
    title: str
    reminder_type: str = "medicine"  # medicine | water | meal | activity
    time: str  # HH:MM
    dosage: Optional[str] = None
    repeat: str = "Daily"
    voice_enabled: bool = True
    language: str = "en"
    is_active: bool = True


class ReminderUpdate(BaseModel):
    title: Optional[str] = None
    reminder_type: Optional[str] = None
    time: Optional[str] = None
    dosage: Optional[str] = None
    repeat: Optional[str] = None
    voice_enabled: Optional[bool] = None
    language: Optional[str] = None
    is_active: Optional[bool] = None


class ReminderLogCreate(BaseModel):
    medicine_name: str
    scheduled_time: str
    action: Literal["Taken", "Skipped"]
    notes: Optional[str] = None


class ReminderLogOut(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    reminder_id: Optional[str] = None
    user_id: Optional[str] = None
    medicine_name: str
    scheduled_time: str
    action: str
    timestamp: datetime
    notes: Optional[str] = None


class ReminderOut(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    user_id: Optional[str] = None
    title: str
    reminder_type: str
    time: str
    dosage: Optional[str] = None
    repeat: str
    voice_enabled: bool
    language: str
    is_active: bool
    created_at: datetime


import re


def validate_phone_number(v: str) -> str:
    """
    Validate phone number against E.164 and international standard formatting.
    Accepts: +91 98765 43210, +14155552671, +442071838750, 9876543210 (7-15 digits).
    Rejects: abc, 123, empty strings, random text.
    """
    if not v or not isinstance(v, str):
        raise ValueError("Phone number must not be empty.")
    v_clean = v.strip()
    if not v_clean:
        raise ValueError("Phone number must not be empty.")

    normalized = re.sub(r'[\s\-\(\)\.]', '', v_clean)
    if not re.match(r'^\+?[1-9]\d{6,14}$', normalized):
        raise ValueError(
            "Invalid phone number format. Must be a valid national or international phone number (e.g. +91 98765 43210, +14155552671) with 7 to 15 digits."
        )
    return v_clean


# --- Emergency Contacts ---
class EmergencyContactCreate(BaseModel):
    name: str = Field(min_length=1)
    phone: str
    relation: Optional[str] = "Family"
    priority: int = 1
    auto_notify: bool = True
    device_id: Optional[str] = None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        return validate_phone_number(v)

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Contact name must not be empty.")
        return v.strip()


class EmergencyContactUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    relation: Optional[str] = None
    priority: Optional[int] = None
    auto_notify: Optional[bool] = None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            return validate_phone_number(v)
        return v

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            if not v.strip():
                raise ValueError("Contact name must not be empty.")
            return v.strip()
        return v


class EmergencyContactOut(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    user_id: Optional[str] = None
    device_id: Optional[str] = None
    name: str
    phone: str
    relation: Optional[str] = None
    priority: int
    auto_notify: bool
    created_at: datetime


# --- SOS & Fall Detection ---
class ContactDispatchResult(BaseModel):
    model_config = {"from_attributes": True}

    name: str
    phone: str
    call: Dict[str, Any]
    sms: Dict[str, Any]



class SOSCreate(BaseModel):
    device_id: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    location_accuracy: Optional[float] = None
    location_timestamp: Optional[str] = None
    address: Optional[str] = None
    risk_tier: Optional[str] = "Emergency"
    risk_score: Optional[int] = None
    contacts: List[Dict[str, str]] = []
    emergency_message: Optional[str] = None


class FallEventCreate(BaseModel):
    device_id: Optional[str] = None
    user_name: Optional[str] = "LifeShield User"
    lat: Optional[float] = None
    lon: Optional[float] = None
    address: Optional[str] = None
    risk_tier: Optional[str] = "Emergency"
    risk_score: Optional[int] = None
    detected_at: Optional[datetime] = None
    acceleration_g: Optional[float] = None
    contacts: List[Dict[str, str]] = []


class SOSOut(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    status: str
    message: str
    channel: Optional[str] = None
    event_type: str = "manual_sos"
    created_at: datetime
    dispatched_at: Optional[datetime] = None
    contacts_notified: List[ContactDispatchResult] = []
    telephony_live: bool
    lat: Optional[float] = None
    lon: Optional[float] = None
    location_accuracy: Optional[float] = None
    location_timestamp: Optional[datetime] = None
    cancelled: bool = False
    emergency_service_number: Optional[str] = None
    emergency_service_status: Optional[str] = None
    sms_delivery_status: Optional[str] = None
    call_status: Optional[str] = None
    error_message: Optional[str] = None


# --- Hazards & Environment ---
class HazardOut(BaseModel):
    value: float
    level: str
    source: str
    timestamp: datetime


class DisasterAlertOut(BaseModel):
    id: str
    title: str
    severity: str  # Warning | Alert | Watch | Info
    category: str
    issued_at: str
    description: str
    region: str


class EnvironmentOut(BaseModel):
    region_name: str
    latitude: float
    longitude: float
    temperature_c: float
    humidity_percent: int
    heat_index_c: float
    uv_index: float
    aqi: int
    aqi_level: str
    pm2_5: float
    pm10: float
    weather_condition: str
    wind_speed_kmh: float
    flood_risk_level: str
    source: str
    timestamp: datetime
    advisories: List[DisasterAlertOut] = []


# --- Risk Assessment ---
class RiskContributorOut(BaseModel):
    factor: str
    value: float
    level: str
    description: str


class RecommendedActionOut(BaseModel):
    category: str
    steps: List[str]


class RiskOut(BaseModel):
    score: int
    tier: str  # Normal | Caution | Warning | Emergency
    contributors: List[RiskContributorOut]
    recommended_actions: List[RecommendedActionOut]
    disclaimer: str = "Risk indicator only — not a medical diagnosis."
    calculated_at: datetime


class RiskCalculateIn(BaseModel):
    lat: Optional[float] = None
    lon: Optional[float] = None
    region_name: Optional[str] = None
    heart_rate: Optional[int] = None
    spo2: Optional[int] = None
    body_temperature: Optional[float] = None
    active_fall_alert: bool = False
    emergency_mode: bool = False


# --- Voice Preferences ---
class VoicePreferenceIn(BaseModel):
    master_voice_enabled: bool = True
    voice_lang: str = "en"
    speech_rate: float = 1.0
    selected_voice_name: Optional[str] = None


class VoicePreferenceOut(BaseModel):
    model_config = {"from_attributes": True}

    master_voice_enabled: bool
    voice_lang: str
    speech_rate: float
    selected_voice_name: Optional[str] = None
    updated_at: datetime



# --- AI Assistant ---
class AIChatRequest(BaseModel):
    question: str
    context: Optional[Dict[str, Any]] = None


class AIChatResponse(BaseModel):
    reply: str
    source: str  # gemini | openai | anthropic | clinical_safety_engine
    timestamp: datetime
    disclaimer: str = "LifeShield AI provides general health and safety information only and does not provide medical diagnoses or prescriptions."


# --- Timeline ---
class TimelineEventOut(BaseModel):
    id: str
    type: str  # vitals | reminder | emergency | fall | hazard
    title: str
    description: str
    timestamp: datetime
    severity: str  # info | success | warning | emergency


# --- Emergency Dispatch Preferences ---
class EmergencyDispatchPreferenceCreate(BaseModel):
    auto_call_police: bool = False
    auto_call_ambulance: bool = False
    police_number: str = "100"
    ambulance_number: str = "108"
    unified_emergency_number: str = "112"
    country: str = "IN"


class EmergencyDispatchPreferenceUpdate(BaseModel):
    auto_call_police: Optional[bool] = None
    auto_call_ambulance: Optional[bool] = None
    police_number: Optional[str] = None
    ambulance_number: Optional[str] = None
    unified_emergency_number: Optional[str] = None
    country: Optional[str] = None


class EmergencyDispatchPreferenceOut(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    user_id: str
    auto_call_police: bool
    auto_call_ambulance: bool
    police_number: str
    ambulance_number: str
    unified_emergency_number: str
    country: str
    updated_at: datetime
