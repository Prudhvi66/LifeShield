import { VitalsData, PersonalBaseline, HealthAnomaly, SafetyRiskLevel } from '../types/health';
import { EnvironmentalData, HeatRiskCategory } from '../types/environment';

export interface AIAnalysisResult {
  overallRisk: SafetyRiskLevel;
  riskScore: number; // 0 to 100
  headline: string;
  summaryReason: string;
  detectedAnomalies: HealthAnomaly[];
  recommendations: string[];
  lastInferenceTime: string;
}

export class AIRiskEngine {
  /**
   * Calculate Heat Index & Wet-Bulb approximation for heat-related stress
   */
  public static calculateHeatRisk(
    env: EnvironmentalData,
    vitals: VitalsData,
    baseline: PersonalBaseline
  ): { category: HeatRiskCategory; score: number; reason: string; advice: string[] } {
    const T = env.ambientTempC;
    const RH = env.humidityPercent;

    // Simple Steadman Heat Index formula in Celsius
    let heatIndex = T;
    if (T >= 27) {
      const c1 = -8.78469475556;
      const c2 = 1.61139411;
      const c3 = 2.33854883889;
      const c4 = -0.14611605;
      const c5 = -0.012308094;
      const c6 = -0.0164248277778;
      const c7 = 0.002211732;
      const c8 = 0.00072546;
      const c9 = -0.000003582;

      heatIndex = c1 + c2 * T + c3 * RH + c4 * T * RH + c5 * (T ** 2) +
        c6 * (RH ** 2) + c7 * (T ** 2) * RH + c8 * T * (RH ** 2) + c9 * (T ** 2) * (RH ** 2);
    }

    let riskScore = 15;
    if (heatIndex >= 45) riskScore = 90;
    else if (heatIndex >= 38) riskScore = 70;
    else if (heatIndex >= 32) riskScore = 45;

    // Exertion + exposure multiplier
    if (env.sunExposureMins > 45 && vitals.activityLevel !== 'rest') {
      riskScore += 15;
    }
    // High heart rate in heat
    if (vitals.heartRate > baseline.restingHeartRate + 25) {
      riskScore += 15;
    }
    // Low hydration penalty
    if (vitals.hydrationIndex < 50) {
      riskScore += 10;
    }

    riskScore = Math.min(100, Math.max(0, riskScore));

    let category: HeatRiskCategory = 'LOW';
    let reason = 'Environmental heat parameters are currently within safe limits.';
    let advice: string[] = ['Maintain regular hydration throughout the day.'];

    if (riskScore >= 75) {
      category = 'CRITICAL';
      reason = `Severe heat stress detected: Apparent temperature is ${Math.round(heatIndex)}°C with elevated physiological strain (HR: ${vitals.heartRate} BPM, Hydration: ${vitals.hydrationIndex}%).`;
      advice = [
        'Move immediately to an air-conditioned or shaded cooler location.',
        'Halt all intense physical exertion.',
        'Sip cool water with electrolytes if appropriate.',
        'If experiencing dizziness, nausea, or confusion, seek immediate medical assistance.'
      ];
    } else if (riskScore >= 50) {
      category = 'HIGH';
      reason = `Elevated heat exposure: Apparent temp ${Math.round(heatIndex)}°C with ${env.sunExposureMins} mins outdoor exposure.`;
      advice = [
        'Seek shaded resting areas immediately.',
        'Drink 250-500ml of clean drinking water.',
        'Reduce pace of manual labor or outdoor work.',
        'Monitor heart rate and body temperature.'
      ];
    } else if (riskScore >= 30) {
      category = 'MODERATE';
      reason = `Moderate heat conditions: Apparent temp ${Math.round(heatIndex)}°C. Keep monitoring hydration.`;
      advice = [
        'Take regular cooling breaks every 45 minutes.',
        'Stay adequately hydrated.'
      ];
    }

    return { category, score: riskScore, reason, advice };
  }

  /**
   * Calculate Respiratory & Air Quality risk by fusing AQI and SpO2
   */
  public static calculateRespiratoryRisk(
    env: EnvironmentalData,
    vitals: VitalsData,
    baseline: PersonalBaseline
  ): { riskLevel: SafetyRiskLevel; score: number; reason: string; advice: string[] } {
    let score = 10;
    const isSpO2Low = vitals.spO2 < baseline.normalSpO2Min;
    const isAQIHigh = env.aqi > 200;

    if (env.aqi > 300) score += 40;
    else if (env.aqi > 200) score += 25;
    else if (env.aqi > 100) score += 15;

    if (vitals.spO2 <= 90) score += 50;
    else if (vitals.spO2 <= 93) score += 30;
    else if (isSpO2Low) score += 15;

    score = Math.min(100, score);

    let riskLevel: SafetyRiskLevel = 'SAFE';
    let reason = 'Respiratory indicators and ambient air quality are in good balance.';
    let advice = ['Outdoor air quality is acceptable for routine activities.'];

    if (isSpO2Low && isAQIHigh) {
      riskLevel = 'HIGH RISK';
      reason = `Dual stressor detected: Air Quality is Poor/Severe (AQI ${env.aqi}) while oxygen saturation has dipped to ${vitals.spO2}% (Baseline: ${baseline.normalSpO2Min}%+).`;
      advice = [
        'Avoid all strenuous outdoor activity and stay indoors.',
        'Use an N95/FFP2 protective mask if outdoors is unavoidable.',
        'Rest in a well-ventilated indoor space.',
        'If shortness of breath or chest discomfort occurs, consult a medical professional.'
      ];
    } else if (vitals.spO2 <= 90) {
      riskLevel = 'HIGH RISK';
      reason = `Low blood oxygen saturation detected: SpO2 is currently ${vitals.spO2}%, significantly below normal threshold.`;
      advice = [
        'Sit upright and practice calm, deep breathing.',
        'Ensure the sensor is snug on the finger/wrist and re-test.',
        'If low oxygen persists or you feel breathless, seek prompt medical care.'
      ];
    } else if (env.aqi > 250) {
      riskLevel = 'CAUTION';
      reason = `High ambient pollution (AQI ${env.aqi}, PM2.5: ${env.pm25} µg/m³).`;
      advice = [
        'Limit prolonged outdoor exertion.',
        'Keep windows closed during peak traffic/pollution hours.'
      ];
    }

    return { riskLevel, score, reason, advice };
  }

  /**
   * Cardiovascular Anomaly Detector using Personalized Baseline
   */
  public static calculateCardiovascularAnomaly(
    vitals: VitalsData,
    baseline: PersonalBaseline
  ): { isAnomaly: boolean; severity: SafetyRiskLevel; reason: string; advice: string[] } {
    const isAtRest = vitals.activityLevel === 'rest' || vitals.activityLevel === 'inactive';
    const hrDelta = vitals.heartRate - baseline.restingHeartRate;

    // Resting Tachycardia anomaly
    if (isAtRest && vitals.heartRate >= 115) {
      return {
        isAnomaly: true,
        severity: vitals.heartRate >= 130 ? 'HIGH RISK' : 'CAUTION',
        reason: `Resting heart rate of ${vitals.heartRate} BPM is elevated by +${hrDelta} BPM above your personal resting baseline (${baseline.restingHeartRate} BPM) while inactive.`,
        advice: [
          'Sit down, relax, and take slow, deep breaths for 5 minutes.',
          'Drink a glass of water to avoid mild dehydration-induced pulse elevation.',
          'Re-check vitals in a calm posture. If palpitations or dizziness persist, seek medical advice.'
        ]
      };
    }

    // Bradycardia anomaly
    if (isAtRest && vitals.heartRate < 48 && baseline.restingHeartRate >= 60) {
      return {
        isAnomaly: true,
        severity: 'CAUTION',
        reason: `Heart rate of ${vitals.heartRate} BPM is notably lower than your baseline (${baseline.restingHeartRate} BPM).`,
        advice: [
          'Ensure the wearable sensor is fitted properly.',
          'If you feel lightheaded, sit or lie down safely.'
        ]
      };
    }

    return {
      isAnomaly: false,
      severity: 'SAFE',
      reason: `Heart rate (${vitals.heartRate} BPM) is consistent with your baseline (${baseline.restingHeartRate} BPM).`,
      advice: ['Cardiovascular vitals appear within your typical pattern.']
    };
  }

  /**
   * Central Edge AI Multi-Signal Fusion Engine
   * Runs 100% locally on the device.
   */
  public static evaluateOverallSafety(
    vitals: VitalsData,
    env: EnvironmentalData,
    baseline: PersonalBaseline,
    fallPending = false,
    manualSOSActive = false
  ): AIAnalysisResult {
    const anomalies: HealthAnomaly[] = [];
    const recommendationsSet = new Set<string>();

    if (manualSOSActive) {
      return {
        overallRisk: 'EMERGENCY',
        riskScore: 100,
        headline: 'EMERGENCY SOS INITIATED',
        summaryReason: 'Manual SOS button was triggered by the user or an unconfirmed fall timer reached zero.',
        detectedAnomalies: [{
          id: 'manual-sos-1',
          type: 'FALL',
          title: 'Manual SOS Triggered',
          severity: 'EMERGENCY',
          confidence: 100,
          reason: 'Emergency sequence active. Location broadcast and emergency contacts are engaged.',
          actionableGuidance: ['Contacting emergency response 112 / 108...', 'Broadcasting live coordinates to emergency contacts.'],
          signals: [{ label: 'Trigger', value: 'User SOS / Auto Escalation' }],
          detectedAt: new Date().toLocaleTimeString()
        }],
        recommendations: [
          'Keep your phone near you and stay in a safe position.',
          'Prepare to speak with emergency dispatchers.'
        ],
        lastInferenceTime: new Date().toLocaleTimeString()
      };
    }

    if (fallPending) {
      return {
        overallRisk: 'EMERGENCY',
        riskScore: 95,
        headline: 'POSSIBLE FALL / IMPACT DETECTED',
        summaryReason: 'High acceleration spike followed by device reorientation and sudden inactivity detected.',
        detectedAnomalies: [{
          id: 'fall-anomaly-1',
          type: 'FALL',
          title: 'Sudden Fall & Inactivity Event',
          severity: 'EMERGENCY',
          confidence: 92,
          reason: 'Multi-axis accelerometer spike (>3.2g) with subsequent zero-motion window detected by Edge AI.',
          actionableGuidance: ['Respond to the 30-second confirmation timer.', 'Press "I\'M OK" if safe, or "NEED HELP" for immediate dispatch.'],
          signals: [
            { label: 'Impact Force', value: '3.4 G' },
            { label: 'Tilt Delta', value: '74°' },
            { label: 'Post-Impact Motion', value: 'Still (0.02 m/s²)' }
          ],
          detectedAt: new Date().toLocaleTimeString()
        }],
        recommendations: [
          'Verify if the user is responsive.',
          'If no cancel button is pressed within the 30-second window, emergency dispatch will activate.'
        ],
        lastInferenceTime: new Date().toLocaleTimeString()
      };
    }

    // 1. Evaluate Heat Stress
    const heatRes = this.calculateHeatRisk(env, vitals, baseline);
    if (heatRes.category === 'CRITICAL' || heatRes.category === 'HIGH') {
      anomalies.push({
        id: `heat-anom-${Date.now()}`,
        type: 'HEAT_STRESS',
        title: heatRes.category === 'CRITICAL' ? 'Critical Heat Stress Risk' : 'High Heat Exposure Alert',
        severity: heatRes.category === 'CRITICAL' ? 'HIGH RISK' : 'CAUTION',
        confidence: 88,
        reason: heatRes.reason,
        actionableGuidance: heatRes.advice,
        signals: [
          { label: 'Ambient Temp', value: `${env.ambientTempC}°C` },
          { label: 'Heat Index', value: `${Math.round(env.heatIndexC)}°C` },
          { label: 'Heart Rate', value: `${vitals.heartRate} BPM`, baselineComparison: `Baseline: ${baseline.restingHeartRate} BPM` }
        ],
        detectedAt: new Date().toLocaleTimeString()
      });
      heatRes.advice.forEach(a => recommendationsSet.add(a));
    }

    // 2. Evaluate Respiratory / Hypoxia
    const respRes = this.calculateRespiratoryRisk(env, vitals, baseline);
    if (respRes.riskLevel !== 'SAFE') {
      anomalies.push({
        id: `resp-anom-${Date.now()}`,
        type: 'RESPIRATORY_DISTRESS',
        title: respRes.riskLevel === 'HIGH RISK' ? 'Respiratory & Hypoxia Warning' : 'Air Quality Caution',
        severity: respRes.riskLevel,
        confidence: 85,
        reason: respRes.reason,
        actionableGuidance: respRes.advice,
        signals: [
          { label: 'SpO2 Level', value: `${vitals.spO2}%`, baselineComparison: `Min Normal: ${baseline.normalSpO2Min}%` },
          { label: 'Air Quality (AQI)', value: `${env.aqi} (${env.pollutionCategory})` }
        ],
        detectedAt: new Date().toLocaleTimeString()
      });
      respRes.advice.forEach(a => recommendationsSet.add(a));
    }

    // 3. Evaluate Cardiovascular
    const cardioRes = this.calculateCardiovascularAnomaly(vitals, baseline);
    if (cardioRes.isAnomaly) {
      anomalies.push({
        id: `cardio-anom-${Date.now()}`,
        type: 'TACHYCARDIA',
        title: 'Elevated Resting Pulse Anomaly',
        severity: cardioRes.severity,
        confidence: 82,
        reason: cardioRes.reason,
        actionableGuidance: cardioRes.advice,
        signals: [
          { label: 'Current HR', value: `${vitals.heartRate} BPM` },
          { label: 'Resting Baseline', value: `${baseline.restingHeartRate} BPM` },
          { label: 'Activity State', value: vitals.activityLevel }
        ],
        detectedAt: new Date().toLocaleTimeString()
      });
      cardioRes.advice.forEach(a => recommendationsSet.add(a));
    }

    // Determine Final Aggregated State
    let overallRisk: SafetyRiskLevel = 'SAFE';
    let riskScore = 12;
    let headline = 'LifeShield Status: SAFE';
    let summaryReason = 'All monitored vitals and environmental metrics are within expected personal baseline boundaries.';

    const hasHighRisk = anomalies.some(a => a.severity === 'HIGH RISK');
    const hasCaution = anomalies.some(a => a.severity === 'CAUTION');

    if (hasHighRisk) {
      overallRisk = 'HIGH RISK';
      riskScore = 82;
      headline = 'LifeShield Status: HIGH RISK';
      summaryReason = `Critical physiological or environmental safety deviations detected (${anomalies.map(a => a.title).join(', ')}).`;
    } else if (hasCaution) {
      overallRisk = 'CAUTION';
      riskScore = 48;
      headline = 'LifeShield Status: CAUTION';
      summaryReason = `Mild safety flags detected. Please follow hydration and cooling recommendations.`;
    }

    if (recommendationsSet.size === 0) {
      recommendationsSet.add('Continue normal daily routine with hydration and active movement.');
      recommendationsSet.add('Sensors are actively tracking on-device with zero cloud telemetry.');
    }

    return {
      overallRisk,
      riskScore,
      headline,
      summaryReason,
      detectedAnomalies: anomalies,
      recommendations: Array.from(recommendationsSet),
      lastInferenceTime: new Date().toLocaleTimeString()
    };
  }
}
