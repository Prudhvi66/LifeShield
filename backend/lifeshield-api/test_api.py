"""
Comprehensive API Integration Test Suite for LifeShield Backend.
Validates all endpoints using FastAPI TestClient.
"""
import time
from unittest.mock import patch, AsyncMock, MagicMock
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


# ---------------------------------------------------------------------------
# Pytest fixture: shared auth headers used by all downstream tests
# ---------------------------------------------------------------------------
@pytest.fixture(scope="session")
def auth_headers():
    """Register a fresh test user and return an Authorization header dict."""
    email = f"test_{int(time.time())}@lifeshield.io"
    password = "SecurePassword123!"

    reg_res = client.post("/api/auth/register", json={
        "email": email,
        "password": password,
        "full_name": "Dr. Prudhvi Kumar",
        "primary_language": "en",
        "age": 28,
        "blood_group": "O+",
    })
    assert reg_res.status_code == 200, f"Register failed: {reg_res.text}"
    token = reg_res.json()["access_token"]
    assert token, "No token returned on register"
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_system_status():
    print("\n[TEST 1] Testing / and /status ...")
    res1 = client.get("/")
    assert res1.status_code == 200, f"Failed root: {res1.text}"
    assert res1.json()["service"] == "LifeShield API"

    res2 = client.get("/status")
    assert res2.status_code == 200
    assert res2.json()["status"] == "ok"
    print("  -> Passed system status")


def test_auth_and_profile(auth_headers):
    print("\n[TEST 2] Testing User Registration, Login, & Profile ...")

    # Me
    me_res = client.get("/api/auth/me", headers=auth_headers)
    assert me_res.status_code == 200
    assert "@lifeshield.io" in me_res.json()["email"]

    # Baseline update
    base_res = client.put("/api/profile/baseline", json={
        "resting_heart_rate": 68,
        "normal_spo2": 99,
        "normal_body_temp": 36.5,
        "daily_steps_goal": 10000,
    }, headers=auth_headers)
    assert base_res.status_code == 200, f"Baseline update failed: {base_res.text}"
    assert base_res.json()["resting_heart_rate"] == 68

    # Voice preference update
    voice_res = client.put("/api/profile/voice", json={
        "master_voice_enabled": True,
        "voice_lang": "te",
        "speech_rate": 0.9,
    }, headers=auth_headers)
    assert voice_res.status_code == 200, f"Voice update failed: {voice_res.text}"
    assert voice_res.json()["voice_lang"] == "te"

    print("  -> Passed Auth and Profile workflows")


def test_health_vitals(auth_headers):
    print("\n[TEST 3] Testing Real Health Telemetry & Summary ...")
    # Ingest real reading
    ingest_res = client.post("/api/health/readings", json={
        "heart_rate": 74,
        "spo2": 98,
        "steps": 6420,
        "body_temperature": 36.6,
        "systolic_bp": 118,
        "diastolic_bp": 78,
        "source": "ble",
    }, headers=auth_headers)
    assert ingest_res.status_code == 200, f"Health ingest failed: {ingest_res.text}"
    assert ingest_res.json()["heart_rate"] == 74

    # Summary
    sum_res = client.get("/api/health/summary", headers=auth_headers)
    assert sum_res.status_code == 200
    data = sum_res.json()
    assert data["data_available"] is True
    assert data["latest"]["heart_rate"] == 74

    # Trends
    trends_res = client.get("/api/health/trends?hours=24", headers=auth_headers)
    assert trends_res.status_code == 200
    assert len(trends_res.json()) >= 1
    print("  -> Passed Health vitals telemetry and trend aggregation")


def test_reminders_and_logs(auth_headers):
    print("\n[TEST 4] Testing Reminders & Routine Taken/Skipped Logs ...")
    # Create reminder
    rem_res = client.post("/api/reminders", json={
        "title": "Metformin 500mg",
        "reminder_type": "medicine",
        "time": "08:30",
        "dosage": "1 tablet with breakfast",
        "repeat": "Daily",
        "voice_enabled": True,
        "language": "en",
    }, headers=auth_headers)
    assert rem_res.status_code == 200, f"Create reminder failed: {rem_res.text}"
    rem_id = rem_res.json()["id"]

    # Log Taken action
    log_res = client.post(f"/api/reminders/{rem_id}/log", json={
        "medicine_name": "Metformin 500mg",
        "scheduled_time": "08:30",
        "action": "Taken",
        "notes": "Taken on time",
    }, headers=auth_headers)
    assert log_res.status_code == 200, f"Reminder log failed: {log_res.text}"
    assert log_res.json()["action"] == "Taken"

    # History
    hist_res = client.get("/api/reminders/history", headers=auth_headers)
    assert hist_res.status_code == 200
    assert len(hist_res.json()) >= 1
    print("  -> Passed Reminders & Log audit trail")


def test_emergency_and_sos(auth_headers):
    print("\n[TEST 5] Testing Emergency Contacts & SOS Dispatch ...")
    # Create contact
    contact_res = client.post("/api/contacts", json={
        "name": "Emergency Caregiver",
        "phone": "+919876543210",
        "relation": "Spouse",
        "priority": 1,
        "auto_notify": True,
    }, headers=auth_headers)
    assert contact_res.status_code == 200, f"Create contact failed: {contact_res.text}"
    assert contact_res.json()["name"] == "Emergency Caregiver"

    # Trigger SOS
    sos_res = client.post("/api/sos", json={
        "lat": 17.3850,
        "lon": 78.4867,
        "address": "Gachibowli, Hyderabad",
        "risk_tier": "Emergency",
        "risk_score": 95,
        "contacts": [{"name": "Emergency Caregiver", "phone": "+919876543210"}],
    }, headers=auth_headers)
    assert sos_res.status_code == 200, f"SOS trigger failed: {sos_res.text}"
    sos_data = sos_res.json()
    assert sos_data["status"] in ("dispatched", "simulated")
    assert len(sos_data["contacts_notified"]) >= 1

    # Trigger Fall
    fall_res = client.post("/api/emergency/fall", json={
        "user_name": "Prudhvi",
        "lat": 17.3850,
        "lon": 78.4867,
        "acceleration_g": 3.75,
        "contacts": [{"name": "Emergency Caregiver", "phone": "+919876543210"}],
    }, headers=auth_headers)
    assert fall_res.status_code == 200, f"Fall trigger failed: {fall_res.text}"
    assert fall_res.json()["event_type"] == "fall_detected"
    print("  -> Passed Emergency Contacts, SOS dispatch, and Fall detection")


def test_environment_and_risk(auth_headers):
    print("\n[TEST 6] Testing Open-Meteo Environment & Multi-Factor Risk ...")
    # Live environment for Hyderabad
    env_res = client.get("/api/environment?region=Hyderabad")
    assert env_res.status_code == 200, f"Environment fetch failed: {env_res.text}"
    env_data = env_res.json()
    assert "temperature_c" in env_data
    assert "aqi" in env_data
    assert "advisories" in env_data

    # Multi-factor risk calculation
    risk_res = client.post("/api/risk/calculate", json={
        "lat": 17.3850,
        "lon": 78.4867,
        "region_name": "Hyderabad",
        "heart_rate": 78,
        "spo2": 98,
    }, headers=auth_headers)
    assert risk_res.status_code == 200, f"Risk calculate failed: {risk_res.text}"
    risk_data = risk_res.json()
    assert 0 <= risk_data["score"] <= 100
    assert risk_data["tier"] in ("Normal", "Caution", "Warning", "Emergency")
    assert len(risk_data["contributors"]) >= 2
    assert "Risk indicator only" in risk_data["disclaimer"]
    print(
        f"  -> Passed Environment (Temp: {env_data['temperature_c']}°C, "
        f"AQI: {env_data['aqi']}) & Risk (Score: {risk_data['score']}, "
        f"Tier: {risk_data['tier']})"
    )


def test_ai_assistant(auth_headers):
    print("\n[TEST 7] Testing Server-Side AI Assistant ...")
    ai_res = client.post("/api/ai/chat", json={
        "question": "What does my heart rate reading of 74 BPM mean?",
        "context": {"vitals": {"heartRate": 74, "spO2": 98}},
    }, headers=auth_headers)
    assert ai_res.status_code == 200, f"AI chat failed: {ai_res.text}"
    ai_data = ai_res.json()
    assert "reply" in ai_data
    assert len(ai_data["reply"]) > 10
    assert "disclaimer" in ai_data
    # Replace non-ascii for console printing
    safe_reply = ai_data["reply"][:80].encode("ascii", "replace").decode("ascii")
    print(f"  -> Passed AI response: '{safe_reply}...' (Source: {ai_data['source']})")


def test_ai_assistant_gemini_mocked_success(auth_headers):
    """Verifies that when Gemini API responds successfully, the reply and source 'gemini' are returned."""
    mock_chat = MagicMock()
    mock_response = MagicMock()
    mock_response.text = "Hello! I am LifeShield Companion. Your recorded heart rate of 74 BPM is within the normal resting range."
    mock_chat.send_message = AsyncMock(return_value=mock_response)

    mock_client = MagicMock()
    mock_client.aio.chats.create = MagicMock(return_value=mock_chat)

    with patch("app.ai_service.get_gemini_client", return_value=mock_client):
        ai_res = client.post("/api/ai/chat", json={
            "question": "Hello, what can you help me with?",
            "context": {"vitals": {"heartRate": 74, "spO2": 98}},
        }, headers=auth_headers)
        assert ai_res.status_code == 200, f"AI chat failed: {ai_res.text}"
        data = ai_res.json()
        assert data["source"] == "gemini"
        assert "LifeShield Companion" in data["reply"]
        assert "disclaimer" in data


def test_ai_assistant_openai_mocked_success(auth_headers):
    """Verifies that when Gemini is unavailable and OpenAI responds successfully, the reply and source 'openai' are returned."""
    mock_response = MagicMock()
    mock_response.output_text = "Hello! I am LifeShield Companion. Your recorded heart rate of 74 BPM is within the normal resting range."

    mock_client = MagicMock()
    mock_client.responses.create = AsyncMock(return_value=mock_response)

    with patch("app.ai_service.get_gemini_client", return_value=None), \
         patch("app.ai_service.get_openai_client", return_value=mock_client):
        ai_res = client.post("/api/ai/chat", json={
            "question": "Hello, what can you help me with?",
            "context": {"vitals": {"heartRate": 74, "spO2": 98}},
        }, headers=auth_headers)
        assert ai_res.status_code == 200, f"AI chat failed: {ai_res.text}"
        data = ai_res.json()
        assert data["source"] == "openai"
        assert "LifeShield Companion" in data["reply"]
        assert "disclaimer" in data


def test_ai_assistant_missing_key_clean_error(auth_headers):
    """Verifies that if neither Gemini nor OpenAI is configured, a clean error without secrets is returned."""
    with patch("app.ai_service.get_settings") as mock_settings:
        mock_settings.return_value.gemini_api_key = None
        mock_settings.return_value.openai_api_key = None
        ai_res = client.post("/api/ai/chat", json={
            "question": "What is my heart rate?",
        }, headers=auth_headers)
        assert ai_res.status_code == 200
        data = ai_res.json()
        assert data["source"] == "ai_not_configured"
        assert "not configured" in data["reply"]
        # Ensure no secrets or API keys are leaked
        assert "sk-" not in data["reply"]
        assert "AIza" not in data["reply"]


def test_ai_assistant_emergency_guidance(auth_headers):
    """Verifies that severe symptoms advise the user to seek emergency help or press SOS."""
    ai_res = client.post("/api/ai/chat", json={
        "question": "I have severe chest pain and can't breathe, is it an emergency?",
    }, headers=auth_headers)
    assert ai_res.status_code == 200
    data = ai_res.json()
    assert any(k in data["reply"] for k in ["SOS", "112", "emergency", "108"])



def test_timeline(auth_headers):
    print("\n[TEST 8] Testing Unified Activity Timeline ...")
    tl_res = client.get("/api/timeline", headers=auth_headers)
    assert tl_res.status_code == 200, f"Timeline failed: {tl_res.text}"
    events = tl_res.json()
    assert len(events) >= 1
    print(f"  -> Passed Timeline with {len(events)} real chronological events")


# ---------------------------------------------------------------------------
# Direct script execution (sequential, non-pytest)
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    print("==================================================")
    print("   STARTING LIFESHIELD FASTAPI ENDPOINT TESTS    ")
    print("==================================================")
    test_system_status()
    _headers = auth_headers()          # call fixture manually as a plain function
    test_auth_and_profile(_headers)
    test_health_vitals(_headers)
    test_reminders_and_logs(_headers)
    test_emergency_and_sos(_headers)
    test_environment_and_risk(_headers)
    test_ai_assistant(_headers)
    test_timeline(_headers)
    print("\n==================================================")
    print("   ALL 8 ENDPOINT TEST SUITES PASSED 100%!        ")
    print("==================================================")
