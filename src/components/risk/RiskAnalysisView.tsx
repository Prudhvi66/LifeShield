import React from "react";
import {
  ShieldAlert,
  Thermometer,
  Wind,
  HeartPulse,
  Activity,
  AlertTriangle,
  Info,
  CheckCircle2,
  PhoneCall,
  RefreshCw,
} from "lucide-react";

interface RiskAnalysisViewProps {
  riskScore: number;
  riskTier: string;
  heartRate?: number | null;
  spo2?: number | null;
  temperature?: number | null;
  aqi?: number | null;
  heatIndex?: number | null;
  baselineRestingHr: number;
  baselineSpo2Floor: number;
  onNavigateToSafety: () => void;
  onRefresh: () => void;
}

export const RiskAnalysisView: React.FC<RiskAnalysisViewProps> = ({
  riskScore,
  riskTier,
  heartRate,
  spo2,
  temperature,
  aqi,
  heatIndex,
  baselineRestingHr,
  baselineSpo2Floor,
  onNavigateToSafety,
  onRefresh,
}) => {
  // Compute explainable risk contributors
  const contributors: Array<{
    factor: string;
    points: number;
    level: "Normal" | "Low" | "Moderate" | "High" | "Critical";
    description: string;
    icon: React.ReactNode;
  }> = [];

  // 1. Heat Index
  const heatVal = heatIndex ?? (temperature ? temperature + 3 : 30);
  if (heatVal >= 42) {
    contributors.push({
      factor: "Wet-Bulb Heat Index",
      points: 25,
      level: "Critical",
      description: `Severe thermal stress (${heatVal}°C). High danger of heat exhaustion/stroke.`,
      icon: <Thermometer className="w-5 h-5 text-red-400" />,
    });
  } else if (heatVal >= 36) {
    contributors.push({
      factor: "Wet-Bulb Heat Index",
      points: 15,
      level: "Moderate",
      description: `Elevated ambient temperature (${heatVal}°C). Increased cardiovascular strain.`,
      icon: <Thermometer className="w-5 h-5 text-amber-400" />,
    });
  } else {
    contributors.push({
      factor: "Wet-Bulb Heat Index",
      points: 4,
      level: "Normal",
      description: `Comfortable thermal conditions (${heatVal}°C). Low metabolic load.`,
      icon: <Thermometer className="w-5 h-5 text-emerald-400" />,
    });
  }

  // 2. Air Quality Index
  const aqiVal = aqi ?? 50;
  if (aqiVal >= 200) {
    contributors.push({
      factor: "Air Quality Index (AQI)",
      points: 25,
      level: "Critical",
      description: `Hazardous airborne particulates (AQI ${aqiVal}). Severe respiratory strain.`,
      icon: <Wind className="w-5 h-5 text-red-400" />,
    });
  } else if (aqiVal >= 100) {
    contributors.push({
      factor: "Air Quality Index (AQI)",
      points: 15,
      level: "Moderate",
      description: `Moderate particulate pollution (AQI ${aqiVal}). Sensitive groups take caution.`,
      icon: <Wind className="w-5 h-5 text-amber-400" />,
    });
  } else {
    contributors.push({
      factor: "Air Quality Index (AQI)",
      points: 3,
      level: "Normal",
      description: `Acceptable ambient air quality (AQI ${aqiVal}).`,
      icon: <Wind className="w-5 h-5 text-emerald-400" />,
    });
  }

  // 3. Cardiac Exertion
  if (heartRate && heartRate > 0) {
    const diff = heartRate - baselineRestingHr;
    if (heartRate > 125 || heartRate < 45) {
      contributors.push({
        factor: "Cardiac Telemetry (HR)",
        points: 25,
        level: "High",
        description: `Heart rate anomaly: ${heartRate} BPM (Baseline: ${baselineRestingHr} BPM).`,
        icon: <HeartPulse className="w-5 h-5 text-red-400" />,
      });
    } else if (diff > 25) {
      contributors.push({
        factor: "Cardiac Telemetry (HR)",
        points: 12,
        level: "Moderate",
        description: `Elevated heart rate: ${heartRate} BPM (+${diff} above baseline).`,
        icon: <HeartPulse className="w-5 h-5 text-amber-400" />,
      });
    } else {
      contributors.push({
        factor: "Cardiac Telemetry (HR)",
        points: 2,
        level: "Normal",
        description: `Heart rate within healthy baseline range (${heartRate} BPM).`,
        icon: <HeartPulse className="w-5 h-5 text-emerald-400" />,
      });
    }
  } else {
    contributors.push({
      factor: "Cardiac Telemetry (HR)",
      points: 0,
      level: "Low",
      description: "No real-time cardiac reading connected. Connect wearable for live telemetry.",
      icon: <HeartPulse className="w-5 h-5 text-slate-400" />,
    });
  }

  // 4. Blood Oxygen Saturation
  if (spo2 && spo2 > 0) {
    if (spo2 < baselineSpo2Floor - 3) {
      contributors.push({
        factor: "Oxygen Saturation (SpO2)",
        points: 30,
        level: "Critical",
        description: `Hypoxemia warning: ${spo2}% SpO2 (Baseline floor: ${baselineSpo2Floor}%).`,
        icon: <Activity className="w-5 h-5 text-red-400" />,
      });
    } else if (spo2 < baselineSpo2Floor) {
      contributors.push({
        factor: "Oxygen Saturation (SpO2)",
        points: 15,
        level: "Moderate",
        description: `Sub-optimal SpO2: ${spo2}% (Approaching personal floor ${baselineSpo2Floor}%).`,
        icon: <Activity className="w-5 h-5 text-amber-400" />,
      });
    } else {
      contributors.push({
        factor: "Oxygen Saturation (SpO2)",
        points: 1,
        level: "Normal",
        description: `Normal oxygenation: ${spo2}% SpO2.`,
        icon: <Activity className="w-5 h-5 text-emerald-400" />,
      });
    }
  } else {
    contributors.push({
      factor: "Oxygen Saturation (SpO2)",
      points: 0,
      level: "Low",
      description: "No pulse oximetry sensor active. Connect Bluetooth wearable to track.",
      icon: <Activity className="w-5 h-5 text-slate-400" />,
    });
  }

  // Generate actionable recommendations
  const recommendations: string[] = [];
  if (heatVal >= 36) {
    recommendations.push("Move to an air-conditioned or shaded environment and consume +250ml fluids every 30 minutes.");
  }
  if (aqiVal >= 100) {
    recommendations.push("Wear an N95 respirator mask if outdoors; keep windows closed to minimize particulate infiltration.");
  }
  if (heartRate && heartRate > baselineRestingHr + 20) {
    recommendations.push("Sit down, rest calmly for 10 minutes, and re-check pulse. Avoid strenuous physical activity.");
  }
  if (recommendations.length === 0) {
    recommendations.push("Maintain adequate hydration, regular posture breaks, and follow daily medication schedules.");
    recommendations.push("All vitals and environmental metrics are within safe operational limits.");
  }

  const getTierColor = (tier: string) => {
    switch (tier.toLowerCase()) {
      case "critical":
        return "#f43f5e";
      case "high":
        return "#f97316";
      case "moderate":
        return "#eab308";
      default:
        return "#10b981";
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn" style={{ textAlign: "left" }}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs font-bold text-sky-400 tracking-wider uppercase">ALGORITHMIC EXPLAINABILITY</div>
          <h1 className="text-2xl lg:text-3xl font-extrabold text-white">Transparent Risk Analysis</h1>
          <p className="text-slate-400 text-sm mt-1">
            Real-time composite calculation combining physiological vitals with meteorological hazards.
          </p>
        </div>
        <button
          type="button"
          className="ls-btn-secondary flex items-center gap-2"
          onClick={onRefresh}
        >
          <RefreshCw className="w-4 h-4" /> Recalculate
        </button>
      </div>

      {/* Main Score Breakdown Card */}
      <div
        className="p-6 rounded-2xl border"
        style={{
          background: "linear-gradient(135deg, rgba(15, 23, 42, 0.8) 0%, rgba(30, 41, 59, 0.7) 100%)",
          borderColor: "rgba(51, 65, 85, 0.6)",
        }}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          <div className="md:col-span-1 text-center border-b md:border-b-0 md:border-r border-slate-700/60 pb-6 md:pb-0 md:pr-6">
            <div className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">
              COMPOSITE RISK INDEX
            </div>
            <div
              className="text-6xl font-black my-2"
              style={{ color: getTierColor(riskTier) }}
            >
              {riskScore}
              <span className="text-2xl font-bold text-slate-500">/100</span>
            </div>
            <div
              className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide"
              style={{
                background: `${getTierColor(riskTier)}22`,
                color: getTierColor(riskTier),
                border: `1px solid ${getTierColor(riskTier)}55`,
              }}
            >
              {riskTier} Risk
            </div>
          </div>

          <div className="md:col-span-2 space-y-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-sky-400" /> Scoring Methodology
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              LifeShield calculates risk using a transparent multi-factor weighting formula:
              <br />
              <code>Risk = Heat_Stress(25%) + Air_Quality(25%) + Cardiac_Strain(25%) + Hypoxemia_Risk(25%)</code>.
              <br />
              Unlike opaque black-box systems, every point increase is mapped to a specific physiological or environmental deviation.
            </p>
            {riskScore >= 60 && (
              <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-red-300">
                  ⚠️ Elevated risk detected. Keep emergency tools ready.
                </span>
                <button
                  type="button"
                  className="ls-btn-danger text-xs py-1.5 px-3"
                  onClick={onNavigateToSafety}
                >
                  <PhoneCall className="w-3.5 h-3.5 inline mr-1" /> Open SOS Center
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Point Contributors Breakdown Table */}
      <div
        className="p-6 rounded-2xl border"
        style={{
          background: "rgba(15, 23, 42, 0.6)",
          borderColor: "rgba(51, 65, 85, 0.5)",
        }}
      >
        <h3 className="text-base font-bold text-white mb-4">
          Why is my score {riskScore}? (Points Breakdown)
        </h3>
        <div className="space-y-3">
          {contributors.map((c, i) => (
            <div
              key={i}
              className="p-4 rounded-xl flex items-center justify-between gap-4"
              style={{
                background: "rgba(30, 41, 59, 0.45)",
                border: "1px solid rgba(51, 65, 85, 0.4)",
              }}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-slate-800/80">{c.icon}</div>
                <div>
                  <div className="text-sm font-bold text-white">{c.factor}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{c.description}</div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-lg font-extrabold text-white">+{c.points}</span>
                <span className="text-xs text-slate-400 ml-1">pts</span>
                <div className="text-xs font-semibold text-slate-400">{c.level}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actionable Recommendations */}
      <div
        className="p-6 rounded-2xl border"
        style={{
          background: "rgba(15, 23, 42, 0.6)",
          borderColor: "rgba(51, 65, 85, 0.5)",
        }}
      >
        <h3 className="text-base font-bold text-white mb-3 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          Recommended Safety Actions
        </h3>
        <ul className="space-y-2">
          {recommendations.map((rec, i) => (
            <li
              key={i}
              className="text-xs text-slate-300 flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-800/40"
            >
              <span className="text-sky-400 font-bold">•</span>
              <span>{rec}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Disclaimer */}
      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-slate-300 flex items-start gap-3">
        <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <span>
          <strong>Clinical Notice:</strong> The LifeShield Risk Index is an informational safety metric and not
          a diagnostic medical assessment. It does not replace clinical testing or physician consultations.
        </span>
      </div>
    </div>
  );
};
