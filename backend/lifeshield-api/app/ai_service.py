"""
Server-side AI Assistant Service for LifeShield.
Supports Gemini, OpenAI, or an intelligent clinical-safety reasoning fallback.
Strictly enforces medical non-diagnosis and non-prescription rules.
"""
from __future__ import annotations
import logging
from typing import Any, Dict, Optional
import httpx
from .config import get_settings

logger = logging.getLogger("lifeshield.ai")
settings = get_settings()

SYSTEM_SAFETY_PROMPT = """
You are LifeShield AI, a helpful health, environmental, and emergency companion.
Your role is to explain health metrics, environmental risks, medicine reminder schedules, and emergency features clearly and empathetically.

STRICT CLINICAL SAFETY RULES:
1. You MUST NOT diagnose illnesses, syndromes, or medical conditions.
2. You MUST NOT prescribe or adjust medications or dosages.
3. You MUST NOT pretend to be a licensed physician or replace professional clinical care.
4. You MUST NOT invent fake health readings or medical facts.
5. If the user mentions severe chest pain, sudden numbness, difficulty breathing, or an emergency, immediately instruct them to trigger the SOS button or dial emergency services (112/108/911).
6. Always maintain a calm, empowering, and helpful tone.
"""


def _clinical_safety_fallback(question: str, context: Optional[Dict[str, Any]] = None) -> str:
    """Deterministic, domain-expert safety response engine for LifeShield."""
    q = question.lower().strip()
    vitals = context.get("vitals", {}) if context else {}
    env = context.get("environment", {}) if context else {}

    hr = vitals.get("heartRate") or vitals.get("heart_rate")
    spo2 = vitals.get("spO2") or vitals.get("spo2")
    temp = vitals.get("bodyTemperature") or vitals.get("body_temperature")
    sys_bp = vitals.get("bloodPressureSys") or vitals.get("systolic_bp")
    dia_bp = vitals.get("bloodPressureDia") or vitals.get("diastolic_bp")
    steps = vitals.get("stepsCount") or vitals.get("steps")

    # 1. Emergency / Acute distress
    if any(w in q for w in ["emergency", "sos", "heart attack", "stroke", "severe chest pain", "can't breathe"]):
        return (
            "🚨 If you or someone with you is experiencing a medical emergency, acute chest pain, or severe breathing distress, "
            "press the red LifeShield SOS button immediately to alert your designated emergency contacts, or dial your local emergency services (112 / 108 / 911) without delay."
        )

    # 2. Heart rate
    if any(w in q for w in ["heart rate", "pulse", "bpm", "heartrate"]):
        if hr is not None and hr > 0:
            status = "within a typical resting range (60-100 BPM)."
            if hr > 105:
                status = "elevated. If you have been resting, consider taking slow deep breaths, drinking water, and relaxing in a cool room."
            elif hr < 50:
                status = "on the lower side. This can be normal for athletic individuals, but monitor how you feel."
            return f"❤️ Your current recorded heart rate is {hr} BPM, which is {status}"
        return "❤️ Heart rate monitoring: To view your live pulse, connect a standard Bluetooth Low Energy heart rate monitor or smartwatch in the Health tab."

    # 3. SpO2 Blood Oxygen
    if any(w in q for w in ["spo2", "oxygen", "blood oxygen", "saturation"]):
        if spo2 is not None and spo2 > 0:
            return f"🫁 Your recorded blood oxygen saturation (SpO₂) is {spo2}%. Normal typical readings are between 95% and 100%."
        return "🫁 SpO₂ Oxygen Saturation: Connect a compatible Bluetooth pulse oximeter or supported health sensor in the Health section to monitor your blood oxygen."

    # 4. Temperature
    if any(w in q for w in ["temp", "temperature", "fever"]):
        if temp is not None and temp > 0:
            return f"🌡️ Your recorded body temperature is {temp}°C. Typical oral/core baseline is around 36.5°C–37.5°C."
        return "🌡️ Temperature: You can manually log temperature readings or sync from supported wearable sensors in the Health tab."

    # 5. Blood Pressure
    if any(w in q for w in ["blood pressure", "bp", "hypertension"]):
        if sys_bp and dia_bp:
            return f"🩺 Your recorded blood pressure is {sys_bp}/{dia_bp} mmHg. Standard resting baseline guidance is around 120/80 mmHg."
        return "🩺 Blood Pressure: LifeShield allows you to log systolic and diastolic readings in your Health profile to track historical baselines."

    # 6. Steps & Activity
    if any(w in q for w in ["step", "walking", "activity", "exercise"]):
        if steps is not None:
            return f"👣 You have recorded {steps:,} steps today. Regular walking helps maintain cardiovascular resilience and metabolic health."
        return "👣 Steps & Activity: Step counting syncs through connected fitness wearables and Android Health Connect."

    # 7. Environment & Weather / AQI
    if any(w in q for w in ["weather", "aqi", "air quality", "heat", "pollution", "environment"]):
        region = env.get("region_name") or env.get("regionName") or "your area"
        aqi_val = env.get("aqi", 65)
        temp_c = env.get("temperature_c") or env.get("temperature") or 30.0
        return (
            f"🌤️ Environmental summary for {region}: Current ambient temperature is {temp_c}°C with an Air Quality Index of {aqi_val}. "
            f"LifeShield continuously monitors meteorological stressors to protect your well-being."
        )

    # 8. Reminders & Medicines
    if any(w in q for w in ["medicine", "medication", "dose", "tablet", "reminder", "water"]):
        return (
            "💊 Medicine & Hydration Reminders: LifeShield lets you schedule your personal medication and water intake with multi-lingual voice alerts (English, Telugu, Hindi). "
            "Open the Health / Medication tab to manage your schedule."
        )

    # 9. Fall detection
    if any(w in q for w in ["fall", "fell", "fall detection"]):
        return (
            "🧍 Fall Detection: LifeShield utilizes your device motion sensors to detect sudden impact spikes followed by stillness. "
            "A 30-second countdown with an audible siren gives you time to cancel if you are safe before dispatching emergency contacts."
        )

    # General greeting & overview
    return (
        "🛡️ Hello! I am your LifeShield AI Companion. I can help explain your health metrics, environmental conditions, "
        "medicine schedules, emergency features, and safety risk indicators. How may I assist you today?"
    )


async def generate_ai_response(
    question: str,
    context: Optional[Dict[str, Any]] = None
) -> tuple[str, str]:
    """
    Attempts to query Gemini/OpenAI if configured, otherwise utilizes
    the built-in clinical safety domain reasoning engine.
    """
    # 1. Try Gemini if API key is present
    if settings.gemini_api_key:
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={settings.gemini_api_key}"
                prompt_text = (
                    f"{SYSTEM_SAFETY_PROMPT}\n\n"
                    f"User Context:\n{context}\n\n"
                    f"User Question: {question}"
                )
                payload = {
                    "contents": [{"parts": [{"text": prompt_text}]}]
                }
                res = await client.post(url, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        reply = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                        if reply:
                            return reply.strip(), "gemini"
        except Exception as exc:
            logger.warning("Gemini API call failed: %s. Falling back to safety engine.", exc)

    # 2. Try OpenAI if API key is present
    if settings.openai_api_key:
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                url = "https://api.openai.com/v1/chat/completions"
                headers = {"Authorization": f"Bearer {settings.openai_api_key}"}
                payload = {
                    "model": "gpt-4o-mini",
                    "messages": [
                        {"role": "system", "content": SYSTEM_SAFETY_PROMPT},
                        {"role": "user", "content": f"Context: {context}\n\nQuestion: {question}"}
                    ],
                    "temperature": 0.4
                }
                res = await client.post(url, json=payload, headers=headers)
                if res.status_code == 200:
                    data = res.json()
                    reply = data["choices"][0]["message"]["content"]
                    return reply.strip(), "openai"
        except Exception as exc:
            logger.warning("OpenAI API call failed: %s. Falling back to safety engine.", exc)

    # 3. Built-in Clinical Safety Reasoning Engine
    reply = _clinical_safety_fallback(question, context)
    return reply, "clinical_safety_engine"
