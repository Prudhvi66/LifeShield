"""
Transparent Multi-Factor Risk Assessment Engine for LifeShield.
Combines real vitals data, baseline deviations, and environmental hazards.
Strictly presents transparent scoring with medical disclaimers.
"""
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from . import models, schemas


def evaluate_risk(
    env_data: Dict[str, Any],
    vitals: Optional[models.HealthReading | schemas.HealthReadingCreate] = None,
    baseline: Optional[models.UserBaseline | schemas.BaselineUpdate] = None,
    active_fall_alert: bool = False,
    emergency_mode: bool = False,
) -> schemas.RiskOut:
    contributors: List[schemas.RiskContributorOut] = []
    recommended_actions: List[schemas.RecommendedActionOut] = []

    # 1. Environmental Heat Index
    heat_c = float(env_data.get("heat_index_c", 30.0))
    if heat_c >= 42.0:
        heat_score = 90
        heat_lvl = "High"
        heat_desc = f"Extreme heat stress ({heat_c}°C). Danger of heat exhaustion/stroke."
    elif heat_c >= 36.0:
        heat_score = 55
        heat_lvl = "Moderate"
        heat_desc = f"Elevated ambient temperature ({heat_c}°C). Increased cardiovascular strain."
    elif heat_c >= 30.0:
        heat_score = 25
        heat_lvl = "Low"
        heat_desc = f"Mild thermal conditions ({heat_c}°C)."
    else:
        heat_score = 10
        heat_lvl = "Normal"
        heat_desc = f"Optimal thermal comfort ({heat_c}°C)."

    contributors.append(schemas.RiskContributorOut(
        factor="Heat Stress Index",
        value=heat_score,
        level=heat_lvl,
        description=heat_desc
    ))

    # 2. Environmental Air Quality (AQI)
    aqi = int(env_data.get("aqi", 50))
    if aqi >= 200:
        aqi_score = 90
        aqi_lvl = "High"
        aqi_desc = f"Very high particulate pollution (AQI {aqi}). Hazardous for respiratory system."
    elif aqi >= 100:
        aqi_score = 55
        aqi_lvl = "Moderate"
        aqi_desc = f"Moderate air pollution (AQI {aqi}). Sensitive individuals should minimize outdoor activity."
    elif aqi >= 50:
        aqi_score = 25
        aqi_lvl = "Low"
        aqi_desc = f"Acceptable air quality (AQI {aqi})."
    else:
        aqi_score = 5
        aqi_lvl = "Good"
        aqi_desc = f"Clean air quality (AQI {aqi})."

    contributors.append(schemas.RiskContributorOut(
        factor="Air Quality Index",
        value=aqi_score,
        level=aqi_lvl,
        description=aqi_desc
    ))

    # 3. Vitals: Heart Rate (if available)
    resting_hr = baseline.resting_heart_rate if baseline else 70
    hr = vitals.heart_rate if vitals else None
    if hr is not None and hr > 0:
        hr_diff = abs(hr - resting_hr)
        if hr > 125 or hr < 45:
            hr_score = 80
            hr_lvl = "High"
            hr_desc = f"Significant heart rate anomaly ({hr} BPM vs baseline {resting_hr} BPM)."
        elif hr > 105 or hr_diff > 25:
            hr_score = 50
            hr_lvl = "Moderate"
            hr_desc = f"Elevated cardiac exertion ({hr} BPM vs baseline {resting_hr} BPM)."
        else:
            hr_score = 10
            hr_lvl = "Normal"
            hr_desc = f"Heart rate within personal baseline ({hr} BPM)."
        contributors.append(schemas.RiskContributorOut(
            factor="Cardiac Exertion",
            value=hr_score,
            level=hr_lvl,
            description=hr_desc
        ))
    else:
        contributors.append(schemas.RiskContributorOut(
            factor="Cardiac Exertion",
            value=0,
            level="Unavailable",
            description="Not available from connected device."
        ))

    # 4. Vitals: SpO2 Blood Oxygen (if available)
    spo2 = vitals.spo2 if vitals else None
    if spo2 is not None and spo2 > 0:
        if spo2 < 90:
            spo2_score = 95
            spo2_lvl = "High"
            spo2_desc = f"Critical hypoxemia level ({spo2}%). Immediate medical attention recommended."
        elif spo2 < 95:
            spo2_score = 60
            spo2_lvl = "Moderate"
            spo2_desc = f"Sub-optimal oxygen saturation ({spo2}%). Rest in well-ventilated area."
        else:
            spo2_score = 5
            spo2_lvl = "Normal"
            spo2_desc = f"Healthy blood oxygen saturation ({spo2}%)."
        contributors.append(schemas.RiskContributorOut(
            factor="Oxygen Saturation",
            value=spo2_score,
            level=spo2_lvl,
            description=spo2_desc
        ))
    else:
        contributors.append(schemas.RiskContributorOut(
            factor="Oxygen Saturation",
            value=0,
            level="Unavailable",
            description="Not available from connected device."
        ))

    # 5. Fall Alert / Emergency Penalties
    event_score = 0
    if emergency_mode:
        event_score = 100
        contributors.append(schemas.RiskContributorOut(
            factor="Emergency Mode",
            value=100,
            level="Emergency",
            description="Active user SOS emergency dispatch state."
        ))
    elif active_fall_alert:
        event_score = 85
        contributors.append(schemas.RiskContributorOut(
            factor="Fall Detection",
            value=85,
            level="High",
            description="Unconfirmed fall impact detected. Countdown active."
        ))

    # Weight Calculation
    valid_scores = [heat_score * 0.25, aqi_score * 0.25]
    if hr is not None and hr > 0:
        valid_scores.append(hr_score * 0.25)
    if spo2 is not None and spo2 > 0:
        valid_scores.append(spo2_score * 0.25)

    base_composite = sum(valid_scores) * (100.0 / (25 * len(valid_scores) if valid_scores else 1))
    total_score = max(int(base_composite), event_score)
    total_score = max(0, min(100, total_score))

    # Tier mapping
    if total_score >= 80 or emergency_mode:
        tier = "Emergency"
    elif total_score >= 55:
        tier = "Warning"
    elif total_score >= 30:
        tier = "Caution"
    else:
        tier = "Normal"

    # Action recommendations
    if heat_score >= 50:
        recommended_actions.append(schemas.RecommendedActionOut(
            category="Heat Stress",
            steps=[
                "Drink 500ml water or electrolytes immediately.",
                "Relocate to an air-conditioned or shaded room.",
                "Avoid intense physical exertion until ambient temperatures drop."
            ]
        ))
    if aqi_score >= 50:
        recommended_actions.append(schemas.RecommendedActionOut(
            category="Air Quality",
            steps=[
                "Keep windows closed and run an indoor HEPA air purifier if available.",
                "Wear an N95/FFP2 mask if stepping outdoors.",
                "Use prescribed inhaler as directed by your physician if you have asthma."
            ]
        ))
    if hr is not None and hr > 115:
        recommended_actions.append(schemas.RecommendedActionOut(
            category="Cardiovascular",
            steps=[
                "Sit down, relax, and practice slow deep diaphragmatic breathing.",
                "Re-check pulse after 5 minutes of stillness."
            ]
        ))
    if tier == "Emergency" or emergency_mode:
        recommended_actions.append(schemas.RecommendedActionOut(
            category="Emergency Safety Protocol",
            steps=[
                "Stay calm and keep your mobile device nearby.",
                "LifeShield has notified your designated emergency contacts.",
                "Contact local medical emergency dispatch (112 / 108 / 911) if in acute distress."
            ]
        ))
    elif not recommended_actions:
        recommended_actions.append(schemas.RecommendedActionOut(
            category="Routine Wellness",
            steps=[
                "Maintain your regular hydration and medication schedule.",
                "Continue standard daily physical activity and rest periods."
            ]
        ))

    return schemas.RiskOut(
        score=total_score,
        tier=tier,
        contributors=contributors,
        recommended_actions=recommended_actions,
        disclaimer="Risk indicator only — not a medical diagnosis.",
        calculated_at=datetime.now(timezone.utc)
    )
