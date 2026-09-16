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
    """Deterministic, domain-expert safety response engine for LifeShield supporting EN, HI, TE."""
    q = question.lower().strip()
    vitals = context.get("vitals", {}) if context else {}
    env = context.get("environment", {}) if context else {}
    lang = (context.get("language") or "en").lower() if context else "en"

    # Detect script language from question
    if any("\u0900" <= c <= "\u097F" for c in question):
        lang = "hi"
    elif any("\u0C00" <= c <= "\u0C7F" for c in question):
        lang = "te"

    hr = vitals.get("heartRate") or vitals.get("heart_rate")
    spo2 = vitals.get("spO2") or vitals.get("spo2")
    temp = vitals.get("bodyTemperature") or vitals.get("body_temperature")
    steps = vitals.get("stepsCount") or vitals.get("steps")

    # 1. Emergency / Acute distress
    if any(w in q for w in ["emergency", "sos", "heart attack", "stroke", "severe chest pain", "can't breathe", "आपातकाल", "अस्पताल", "అత్యవసరం"]):
        if lang == "hi":
            return (
                "🚨 यदि आप या आपके साथ कोई चिकित्सीय आपात स्थिति का सामना कर रहा है, तो तुरंत लाल लाइफ़शील्ड SOS बटन दबाएँ "
                "या स्थानीय आपातकालीन सेवाओं (112 / 108) पर कॉल करें।"
            )
        if lang == "te":
            return (
                "🚨 మీరు లేదా మీతో ఉన్నవారు అత్యవసర వైద్య పరిస్థితిలో ఉంటే, వెంటనే ఎరుపు లైఫ్‌షీల్డ్ SOS బటన్‌ను నొక్కండి "
                "లేదా అత్యవసర సేవలకు (112 / 108) కాల్ చేయండి."
            )
        return (
            "🚨 If you or someone with you is experiencing a medical emergency, acute chest pain, or severe breathing distress, "
            "press the red LifeShield SOS button immediately to alert your designated emergency contacts, or dial your local emergency services (112 / 108 / 911) without delay."
        )

    # 2. Heart rate
    if any(w in q for w in ["heart rate", "pulse", "bpm", "heartrate", "दिल", "हृदय", "గుండె"]):
        if hr is not None and hr > 0:
            if lang == "hi":
                return f"❤️ आपकी दर्ज की गई हृदय गति {hr} BPM है। सामान्य आराम की सीमा 60-100 BPM होती है।"
            if lang == "te":
                return f"❤️ మీ రికార్డ్ చేయబడిన గుండె వేగం {hr} BPM. సాధారణ విశ్రాంతి స్థాయి 60-100 BPM."
            status = "within a typical resting range (60-100 BPM)."
            if hr > 105:
                status = "elevated. If you have been resting, consider taking slow deep breaths, drinking water, and relaxing in a cool room."
            elif hr < 50:
                status = "on the lower side. This can be normal for athletic individuals, but monitor how you feel."
            return f"❤️ Your current recorded heart rate is {hr} BPM, which is {status}"
        if lang == "hi":
            return "❤️ हृदय गति मॉनिटरिंग: लाइव पल्स देखने के लिए हेल्थ टैब में ब्लूटूथ स्मार्टवॉच कनेक्ट करें।"
        if lang == "te":
            return "❤️ గుండె వేగం మోనిటరింగ్: లైవ్ పల్స్ చూడటానికి హెల్త్ ట్యాబ్‌లో బ్లూటూత్ స్మార్ట్‌వాచ్ కనెక్ట్ చేయండి."
        return "❤️ Heart rate monitoring: To view your live pulse, connect a standard Bluetooth Low Energy heart rate monitor or smartwatch in the Health tab."

    # 3. SpO2 Blood Oxygen
    if any(w in q for w in ["spo2", "oxygen", "blood oxygen", "saturation", "ऑक्सीजन", "ఆక్సిజన్"]):
        if spo2 is not None and spo2 > 0:
            if lang == "hi":
                return f"🫁 आपकी दर्ज ऑक्सीजन संतृप्ति (SpO₂) {spo2}% है। सामान्य स्तर 95% से 100% के बीच होता है।"
            if lang == "te":
                return f"🫁 మీ రికార్డ్ చేయబడిన ఆక్సిజన్ స్థాయి (SpO₂) {spo2}%. సాధారణ స్థాయి 95% నుండి 100% వరకు ఉంటుంది."
            return f"🫁 Your recorded blood oxygen saturation (SpO₂) is {spo2}%. Normal typical readings are between 95% and 100%."
        if lang == "hi":
            return "🫁 SpO₂ ऑक्सीजन: रक्त में ऑक्सीजन का स्तर मापने के लिए समर्थित ब्लूटूथ पल्स ऑक्सीमीटर कनेक्ट करें।"
        if lang == "te":
            return "🫁 SpO₂ ఆక్సిజన్: ఆక్సిజన్ స్థాయిలను పరిశీలించడానికి బ్లూటూత్ పల్స్ ఆక్సిమీటర్‌ను కనెక్ట్ చేయండి."
        return "🫁 SpO₂ Oxygen Saturation: Connect a compatible Bluetooth pulse oximeter or supported health sensor in the Health section to monitor your blood oxygen."

    # 4. Steps & Activity
    if any(w in q for w in ["step", "walking", "activity", "exercise", "कदम", "अడుగులు"]):
        if steps is not None:
            if lang == "hi":
                return f"👣 आपने आज {steps:,} कदम पूरे किए हैं। नियमित पैदल चलना स्वास्थ्य के लिए लाभदायक है।"
            if lang == "te":
                return f"👣 మీరు ఈరోజు {steps:,} అడుగులు నడిచారు. రోజూ నడవడం గుండె ఆరోగ్యానికి మంచిది."
            return f"👣 You have recorded {steps:,} steps today. Regular walking helps maintain cardiovascular resilience and metabolic health."
        if lang == "hi":
            return "👣 कदम और गतिविधि: स्टेप काउंटिंग कनेक्टेड फिटनेस वियरेबल्स और एंड्रॉइड हेल्थ कनेक्ट से सिंक होती है।"
        if lang == "te":
            return "👣 అడుగులు మరియు శ్రమ: స్టెప్ కౌంట్ హెల్త్ కనెక్ట్ మరియు స్మార్ట్‌వాచ్ ద్వారా సింక్ అవుతుంది."
        return "👣 Steps & Activity: Step counting syncs through connected fitness wearables and Android Health Connect."

    # 5. Extreme heat / heat stroke
    if any(w in q for w in ["heat", "hot", "sun", "heatstroke", "heat stroke", "dehydrat", "गर्मी", "लू", "వేడి"]):
        heat_info = ""
        if env:
            hi = env.get("heat_index") or env.get("heat_index_c")
            temp_c = env.get("temperature") or env.get("temperature_c")
            if hi:
                heat_info = f" The current heat index is {hi}°C."
            elif temp_c:
                heat_info = f" The current temperature is {temp_c}°C."

        if lang == "hi":
            return (
                f"🌡️ गर्मी से बचाव:{heat_info}\n"
                "• छाया में रहें और धूप से बचें\n"
                "• प्रति घंटे कम से कम 1 गिलास पानी पिएं\n"
                "• हल्के रंग के ढीले कपड़े पहनें\n"
                "• चक्कर आने, उल्टी, या सिरदर्द हो तो तुरंत ठंडी जगह पर जाएं\n"
                "• गर्मी का टूटना (heat stroke) गंभीर है — SOS दबाएं या 108 पर कॉल करें"
            )
        if lang == "te":
            return (
                f"🌡️ వేడి నుండి రక్షణ:{heat_info}\n"
                "• నీడలో ఉండండి మరియు ఎండ నుండి దూరంగా ఉండండి\n"
                "• గంటకు కనీసం 1 గ్లాస్ నీరు త్రాగండి\n"
                "• లేత రంగు వదులుగా ఉండే బట్టలు ధరించండి\n"
                "• తలతిప్పడం, వాంతులు, తలనొప్పి ఉంటే వెంటనే చల్లని చోటికి వెళ్ళండి\n"
                "• హీట్ స్ట్రోక్ తీవ్రమైనది — SOS నొక్కండి లేదా 108 కి కాల్ చేయండి"
            )
        return (
            f"🌡️ Heat safety guidance:{heat_info}\n"
            "• Stay in shade and avoid direct sun exposure\n"
            "• Drink at least 1 glass of water every hour\n"
            "• Wear light-colored, loose-fitting clothing\n"
            "• If you feel dizzy, nauseous, or have a headache, move to a cool area immediately\n"
            "• Heat stroke is a medical emergency — trigger the SOS button or call 108/112"
        )

    # 6. Dizziness / fainting
    if any(w in q for w in ["dizzy", "faint", "lightheaded", "vertigo", "चक्कर", "చుక్కలు"]):
        if lang == "hi":
            return (
                "😵 चक्कर आने पर:\n"
                "• तुरंत बैठ जाएं या लेट जाएं — गिरने से बचें\n"
                "• ठंडा पानी पिएं\n"
                "• सांस धीरे-धीरे लें\n"
                "• अगर चक्कर बार-बार आ रहा है या बेहोशी महसूस हो रही है, तो SOS दबाएं या डॉक्टर को दिखाएं\n"
                "• हृदय गति अधिक है या ऑक्सीजन कम है तो तुरंत मदद लें"
            )
        if lang == "te":
            return (
                "😵 తలతిప్పడం వస్తే:\n"
                "• వెంటనే కూర్చోండి లేదా పడుకోండి — పడిపోకుండా జాగ్రత్త వహించండి\n"
                "• చల్లని నీరు త్రాగండి\n"
                "• నెమ్మదిగా శ్వాస తీసుకోండి\n"
                "• తలతిప్పడం మళ్ళీ మళ్ళీ వస్తే లేదా మూర్ఛ వస్తే, SOS నొక్కండి లేదా వైద్యుడిని సంప్రదించండి\n"
                "• గుండె వేగం ఎక్కువగా ఉంటే లేదా ఆక్సిజన్ తక్కువగా ఉంటే వెంటనే సహాయం తీసుకోండి"
            )
        return (
            "😵 If you feel dizzy or lightheaded:\n"
            "• Sit or lie down immediately to prevent falling\n"
            "• Drink cool water\n"
            "• Breathe slowly and deeply\n"
            "• If dizziness recurs or you feel like fainting, trigger the SOS button or seek medical help\n"
            "• If your heart rate is elevated or SpO2 is low, get help immediately"
        )

    # 7. Temperature / fever
    if any(w in q for w in ["temperature", "fever", "temp", "body temp", "बुखार", "జ్వరం"]):
        if temp is not None and temp > 0:
            if lang == "hi":
                return f"🌡️ आपकी दर्ज शरीर का तापमान {temp}°C है। सामान्य सीमा 36.1°C से 37.2°C है।"
            if lang == "te":
                return f"🌡️ మీ రికార్డ్ చేయబడిన శరీర ఉష్ణోగ్రత {temp}°C. సాధారణ పరిధి 36.1°C నుండి 37.2°C."
            if temp > 38.0:
                return f"🌡️ Your recorded body temperature is {temp}°C, which is elevated. Stay hydrated, rest, and monitor your symptoms. If temperature exceeds 39°C or persists, seek medical attention."
            return f"🌡️ Your recorded body temperature is {temp}°C, which is within the normal range (36.1°C to 37.2°C)."
        if lang == "hi":
            return "🌡️ तापमान: शरीर का तापमान मापने के लिए समर्थित ब्लूटूथ थर्मामीटर कनेक्ट करें।"
        if lang == "te":
            return "🌡️ ఉష్ణోగ్రత: శరీర ఉష్ణోగ్రతను కొలవడానికి బ్లూటూత్ థర్మామీటర్ కనెక్ట్ చేయండి."
        return "🌡️ Temperature: Connect a compatible Bluetooth thermometer in the Health section to monitor your body temperature."

    # 8. BP / blood pressure
    if any(w in q for w in ["blood pressure", "bp", "hypertension", "ब्लड प्रेशर", "रक्तचाप", "బీపీ"]):
        return (
            "🩺 Blood pressure: Connect a compatible Bluetooth blood pressure monitor in the Health section to track your readings. "
            "Normal blood pressure is typically around 120/80 mmHg. "
            "If you experience sudden severe headache, chest pain, or vision changes, seek emergency help immediately."
        )

    # 9. Medicines / reminders
    if any(w in q for w in ["medicine", "medication", "drug", "pill", "tablet", "दवा", "మందు"]):
        return (
            "💊 Medicine reminders: Use the Reminders tab to set up medicine schedules with voice alerts. "
            "LifeShield can remind you in English, Hindi, or Telugu. "
            "Always follow your doctor's prescribed dosage — do not adjust medication without professional medical advice."
        )

    # General greeting & overview
    if lang == "hi":
        return (
            "🛡️ नमस्ते! मैं आपका लाइफ़शील्ड एआई साथी हूँ। मैं आपके स्वास्थ्य मेट्रिक्स, पर्यावरण स्थितियों, "
            "दवा की समय-सारणी और आपातकालीन सुरक्षा संकेतकों को समझने में मदद कर सकता हूँ। "
            "आप मुझसे हृदय गति, ऑक्सीजन, तापमान, कदम, गर्मी, चक्कर, ब्लड प्रेशर, दवाओं, या आपातकाल के बारे में पूछ सकते हैं।"
        )
    if lang == "te":
        return (
            "🛡️ నమస్తే! నేను మీ లైఫ్‌షీల్డ్ AI సహచరుడిని. మీ ఆరోగ్య సూచికలు, పర్యావరణ వివరాలు, "
            "మందుల సమయం మరియు అత్యవసర రక్షణ సమాచారాన్ని వివరించడంలో నేను మీకు సహాయపడగలను. "
            "మీరు గుండె వేగం, ఆక్సిజన్, ఉష్ణోగ్రత, అడుగులు, వేడి, తలతిప్పడం, బీపీ, మందులు లేదా అత్యవసరం గురించి అడగవచ్చు."
        )
    return (
        "🛡️ Hello! I am your LifeShield AI Companion. I can help explain your health metrics, environmental conditions, "
        "medicine schedules, emergency features, and safety risk indicators. "
        "You can ask me about heart rate, oxygen levels, temperature, steps, heat safety, dizziness, blood pressure, medicines, or emergencies. "
        "How may I assist you today?"
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
