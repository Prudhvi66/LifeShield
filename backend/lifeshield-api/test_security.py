"""
Phase 4 Security & Authorization Test Suite for LifeShield Backend.
Tests multi-tenant isolation, IDOR protection, authentication requirements,
and international phone number validation for Emergency Contacts and SOS History.
"""
import time
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def register_user(prefix: str):
    """Helper to register a unique user and return auth headers."""
    email = f"{prefix}_{int(time.time() * 1000)}@lifeshield-test.io"
    password = "TestSecurityPass123!"
    res = client.post("/api/auth/register", json={
        "email": email,
        "password": password,
        "full_name": f"{prefix.capitalize()} User",
        "primary_language": "en",
        "age": 30,
        "blood_group": "O+",
    })
    assert res.status_code == 200, f"Registration failed for {email}: {res.text}"
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# A. Authenticated user A creates contact
def test_user_a_creates_contact():
    headers_a = register_user("usera_create")
    res = client.post("/api/contacts", json={
        "name": "Contact of User A",
        "phone": "+91 98765 43210",
        "relation": "Caregiver",
        "priority": 1,
        "auto_notify": True,
    }, headers=headers_a)
    assert res.status_code == 200, f"Failed to create contact: {res.text}"
    data = res.json()
    assert data["name"] == "Contact of User A"
    assert data["phone"] == "+91 98765 43210"
    assert data["priority"] == 1


# B. User A can GET their own contact
def test_user_a_can_get_own_contact():
    headers_a = register_user("usera_get")
    create_res = client.post("/api/contacts", json={
        "name": "User A Private Contact",
        "phone": "+14155552671",
        "relation": "Doctor",
        "priority": 1,
    }, headers=headers_a)
    assert create_res.status_code == 200
    contact_id = create_res.json()["id"]

    list_res = client.get("/api/contacts", headers=headers_a)
    assert list_res.status_code == 200
    contact_ids = [c["id"] for c in list_res.json()]
    assert contact_id in contact_ids


# C. User B cannot GET User A's contact
def test_user_b_cannot_get_user_a_contact():
    headers_a = register_user("usera_isolate")
    headers_b = register_user("userb_isolate")

    create_res = client.post("/api/contacts", json={
        "name": "User A Secret Contact",
        "phone": "+44 20 7183 8750",
        "relation": "Spouse",
        "priority": 1,
    }, headers=headers_a)
    assert create_res.status_code == 200
    contact_id_a = create_res.json()["id"]

    # User B lists contacts - must NOT see User A's contact
    list_res_b = client.get("/api/contacts", headers=headers_b)
    assert list_res_b.status_code == 200
    b_contact_ids = [c["id"] for c in list_res_b.json()]
    assert contact_id_a not in b_contact_ids


# D. User B cannot UPDATE User A's contact
def test_user_b_cannot_update_user_a_contact():
    headers_a = register_user("usera_noupdate")
    headers_b = register_user("userb_noupdate")

    create_res = client.post("/api/contacts", json={
        "name": "Original Name",
        "phone": "+919876543210",
        "relation": "Family",
        "priority": 1,
    }, headers=headers_a)
    assert create_res.status_code == 200
    contact_id_a = create_res.json()["id"]

    # User B attempts to hijack User A's contact
    update_res = client.put(f"/api/contacts/{contact_id_a}", json={
        "name": "Hacked Name",
        "phone": "+19999999999",
    }, headers=headers_b)
    assert update_res.status_code in (404, 403), f"Expected 404/403, got {update_res.status_code}"

    # Verify User A's contact remained unchanged
    list_res_a = client.get("/api/contacts", headers=headers_a)
    assert list_res_a.status_code == 200
    contact_a = next(c for c in list_res_a.json() if c["id"] == contact_id_a)
    assert contact_a["name"] == "Original Name"


# E. User B cannot DELETE User A's contact
def test_user_b_cannot_delete_user_a_contact():
    headers_a = register_user("usera_nodelete")
    headers_b = register_user("userb_nodelete")

    create_res = client.post("/api/contacts", json={
        "name": "Undeletable by B",
        "phone": "+919876543210",
        "relation": "Family",
    }, headers=headers_a)
    assert create_res.status_code == 200
    contact_id_a = create_res.json()["id"]

    # User B attempts to delete User A's contact
    del_res = client.delete(f"/api/contacts/{contact_id_a}", headers=headers_b)
    assert del_res.status_code in (404, 403), f"Expected 404/403, got {del_res.status_code}"

    # Verify User A's contact still exists
    list_res_a = client.get("/api/contacts", headers=headers_a)
    assert list_res_a.status_code == 200
    b_contact_ids = [c["id"] for c in list_res_a.json()]
    assert contact_id_a in b_contact_ids


# F. Unauthenticated GET /api/contacts is rejected
def test_unauthenticated_get_contacts_rejected():
    res = client.get("/api/contacts")
    assert res.status_code == 401, f"Expected 401, got {res.status_code}"


# G. Unauthenticated GET /api/sos/history is rejected
def test_unauthenticated_get_sos_history_rejected():
    res = client.get("/api/sos/history")
    assert res.status_code == 401, f"Expected 401, got {res.status_code}"


# H. User A can see their own SOS history
def test_user_a_can_see_own_sos_history():
    headers_a = register_user("usera_sos")

    # Trigger SOS for User A
    sos_res = client.post("/api/sos", json={
        "lat": 17.3850,
        "lon": 78.4867,
        "address": "Hyderabad Emergency",
        "risk_tier": "Emergency",
        "risk_score": 98,
        "contacts": [{"name": "Caregiver A", "phone": "+919876543210"}],
    }, headers=headers_a)
    assert sos_res.status_code == 200
    sos_id = sos_res.json()["id"]

    # Get history for User A
    hist_res = client.get("/api/sos/history", headers=headers_a)
    assert hist_res.status_code == 200
    event_ids = [e["id"] for e in hist_res.json()]
    assert sos_id in event_ids


# I. User B cannot see User A's SOS history
def test_user_b_cannot_see_user_a_sos_history():
    headers_a = register_user("usera_sospriv")
    headers_b = register_user("userb_sospriv")

    sos_res = client.post("/api/sos", json={
        "lat": 17.3850,
        "lon": 78.4867,
        "address": "Hyderabad Confidential",
        "risk_tier": "Emergency",
        "risk_score": 99,
        "contacts": [{"name": "Caregiver Confidential", "phone": "+919876543210"}],
    }, headers=headers_a)
    assert sos_res.status_code == 200
    sos_id_a = sos_res.json()["id"]

    # User B requests SOS history
    hist_res_b = client.get("/api/sos/history", headers=headers_b)
    assert hist_res_b.status_code == 200
    b_event_ids = [e["id"] for e in hist_res_b.json()]
    assert sos_id_a not in b_event_ids

    # User B requests individual SOS detail of User A
    get_res_b = client.get(f"/api/sos/{sos_id_a}", headers=headers_b)
    assert get_res_b.status_code in (404, 403)


# J. Invalid phone number is rejected
@pytest.mark.parametrize("bad_phone", ["abc", "123", "", "   ", "random text", "12345", "phone1234567"])
def test_invalid_phone_rejected(bad_phone):
    headers = register_user("phone_invalid")
    res = client.post("/api/contacts", json={
        "name": "Invalid Phone Contact",
        "phone": bad_phone,
        "relation": "Family",
    }, headers=headers)
    assert res.status_code == 422, f"Expected 422 for phone '{bad_phone}', got {res.status_code}"


# K. Valid international phone number is accepted
@pytest.mark.parametrize("valid_phone", [
    "+91 98765 43210",
    "+919876543210",
    "+14155552671",
    "+1 (415) 555-2671",
    "+44 20 7183 8750",
    "+442071838750",
    "9876543210",
    "+61 2 9374 4000",
])
def test_valid_international_phone_accepted(valid_phone):
    headers = register_user("phone_valid")
    res = client.post("/api/contacts", json={
        "name": "Valid Phone Contact",
        "phone": valid_phone,
        "relation": "Friend",
    }, headers=headers)
    assert res.status_code == 200, f"Expected 200 for phone '{valid_phone}', got {res.status_code}: {res.text}"
    assert res.json()["phone"] == valid_phone.strip()
