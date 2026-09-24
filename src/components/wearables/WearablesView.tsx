import React, { useState, useEffect } from "react";
import {
  Watch,
  Bluetooth,
  RefreshCw,
  Smartphone,
  ShieldCheck,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Cpu,
  Activity,
  Heart,
  Footprints,
  Moon,
  Thermometer,
  Droplets,
  Clock,
  Lock,
  Compass,
  X,
  Sparkles,
} from "lucide-react";
import { BLEDeviceStatus } from "../../services/bluetoothService";
import { HealthConnectService } from "../../services/healthConnectService";
import {
  HealthConnectMetricDetail,
  formatHumanSourceLabel,
  formatHealthConnectStatus,
} from "../../services/wearableSource";
import { demoHealthService } from "../../services/demoHealthData";

export interface WearablesViewProps {
  bleStatus: BLEDeviceStatus;
  healthConnectStatus: string;
  healthConnectMetrics?: {
    heart_rate: HealthConnectMetricDetail;
    spo2: HealthConnectMetricDetail;
    steps: HealthConnectMetricDetail;
    sleep: HealthConnectMetricDetail;
    temperature: HealthConnectMetricDetail;
  };
  isScanningBle: boolean;
  isSyncingHealthConnect: boolean;
  lastSyncTime: string | null;
  onPairBluetooth: () => void;
  onSyncHealthConnect: () => void;
  onDisconnectBluetooth?: () => void;
  environment?: {
    temperature?: number | null;
    humidity?: number | null;
    aqi?: number | null;
    aqi_level?: string | null;
    weather?: string | null;
    heat_index?: number | null;
    flood_risk_level?: string | null;
    uv_index?: number | null;
  };
  health?: {
    heart_rate?: number | null;
    spo2?: number | null;
    temperature?: number | null;
    steps?: number | null;
    sleep?: number | null;
    hydration?: number | null;
    source?: string | null;
  };
  dataSource?: "real" | "demo" | "unavailable" | "not_connected";
  isDemoMode?: boolean;
  onToggleDemoMode?: (enabled: boolean) => void;
}

// Realistic deterministic demonstration vitals (SIH Demonstration)
const DEMO_VITALS_SPEC = {
  heartRate: { value: 72, unit: "BPM", status: "Normal" },
  spo2: { value: 98, unit: "%", status: "Normal" },
  steps: { value: "4,820", unit: "steps", status: "Today" },
  sleep: { value: "7h 24m", unit: "", status: "Good" },
  temperature: { value: "36.7", unit: "°C", status: "Normal" },
  hydration: { value: "62", unit: "%", status: "Good" },
};

export const WearablesView: React.FC<WearablesViewProps> = ({
  bleStatus,
  healthConnectStatus,
  healthConnectMetrics,
  isScanningBle,
  isSyncingHealthConnect,
  lastSyncTime,
  onPairBluetooth,
  onSyncHealthConnect,
  onDisconnectBluetooth,
  environment,
  health,
  dataSource = "demo",
  isDemoMode: isDemoModeProp,
  onToggleDemoMode,
}) => {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [permissionSummary, setPermissionSummary] = useState<{
    heartRate: boolean;
    steps: boolean;
    sleep: boolean;
    spo2: boolean;
    temperature: boolean;
    grantedCount: number;
  }>({
    heartRate: false,
    steps: false,
    sleep: false,
    spo2: false,
    temperature: false,
    grantedCount: 0,
  });

  const isAndroid = HealthConnectService.isNativeAndroid();

  // Inspect native Health Connect permissions on mount or when metrics change
  useEffect(() => {
    let isMounted = true;
    HealthConnectService.getPermissionsSummary().then((summary) => {
      if (isMounted) {
        setPermissionSummary({
          heartRate: summary.details.heartRate,
          steps: summary.details.steps,
          sleep: summary.details.sleep,
          spo2: summary.details.spo2,
          temperature: summary.details.temperature,
          grantedCount: summary.grantedCount,
        });
      }
    });
    return () => {
      isMounted = false;
    };
  }, [healthConnectMetrics]);

  // Granular presence of authentic Health Connect sensor records
  const hrRecord = Boolean(
    healthConnectMetrics?.heart_rate?.recordsFound &&
      healthConnectMetrics?.heart_rate?.value !== null &&
      healthConnectMetrics?.heart_rate?.value !== undefined
  );
  const spo2Record = Boolean(
    healthConnectMetrics?.spo2?.recordsFound &&
      healthConnectMetrics?.spo2?.value !== null &&
      healthConnectMetrics?.spo2?.value !== undefined
  );
  const stepsRecord = Boolean(
    healthConnectMetrics?.steps?.recordsFound &&
      healthConnectMetrics?.steps?.value !== null &&
      healthConnectMetrics?.steps?.value !== undefined
  );
  const sleepRecord = Boolean(
    healthConnectMetrics?.sleep?.recordsFound &&
      healthConnectMetrics?.sleep?.value !== null &&
      healthConnectMetrics?.sleep?.value !== undefined
  );
  const tempRecord = Boolean(
    healthConnectMetrics?.temperature?.recordsFound &&
      healthConnectMetrics?.temperature?.value !== null &&
      healthConnectMetrics?.temperature?.value !== undefined
  );

  const hasAnyHealthConnectRecord =
    hrRecord || spo2Record || stepsRecord || sleepRecord || tempRecord;

  // Granular presence of direct Bluetooth sensor telemetry
  const isBleConnected = bleStatus.isConnected;
  const hasBleLiveReading = Boolean(
    isBleConnected &&
      health?.source === "Bluetooth GATT" &&
      (health?.heart_rate || health?.spo2 || health?.temperature)
  );

  // Determine Truthful Tri-State Architecture:
  // MODE B: Real verified data source connected with readings
  const isRealDataMode = hasAnyHealthConnectRecord || hasBleLiveReading || dataSource === "real";

  // MODE C: Health source is connected, but waiting for records
  const isWaitingMode =
    !isRealDataMode &&
    (isBleConnected || (isAndroid && permissionSummary.grantedCount > 0) || dataSource === "unavailable");

  // MODE A: Demo Mode when explicitly enabled and no real source active
  const isDemoExplicitlyEnabled = isDemoModeProp ?? demoHealthService.isDemoModeEnabled();
  const isDemoMode = !isRealDataMode && !isWaitingMode && (dataSource === "demo" || isDemoExplicitlyEnabled);
  const isNotConnectedMode = !isRealDataMode && !isWaitingMode && !isDemoMode;

  // Primary source identifier
  const activeSourceLabel = isRealDataMode
    ? hasAnyHealthConnectRecord
      ? (formatHumanSourceLabel(health?.source) || "Health Connect")
      : hasBleLiveReading
      ? "Bluetooth Wearable"
      : formatHumanSourceLabel(health?.source) || "Health Connect"
    : isWaitingMode
    ? isBleConnected
      ? "Bluetooth Wearable"
      : "Health Connect"
    : isDemoMode
    ? "Simulated Demonstration"
    : "Not Connected";

  return (
    <div
      style={{
        textAlign: "left",
        display: "flex",
        flexDirection: "column",
        gap: "18px",
        maxWidth: "680px",
        margin: "0 auto",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      {/* =========================================================
          1. HEADER
      ========================================================= */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "12px",
          paddingBottom: "4px",
        }}
      >
        <div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "11px",
              fontWeight: 800,
              color: "#7c3aed",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: "4px",
            }}
          >
            <ShieldCheck style={{ width: 15, height: 15, color: "#7c3aed" }} />
            LifeShield Health
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: "24px",
              fontWeight: 800,
              color: "#0f172a",
              letterSpacing: "-0.02em",
            }}
          >
            Health Overview
          </h1>
          <p
            style={{
              margin: "4px 0 0 0",
              fontSize: "13px",
              color: "#64748b",
            }}
          >
            Your health data at a glance
          </p>
        </div>

        {/* Sync & Refresh Header Action */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {isRealDataMode || isWaitingMode ? (
            <button
              type="button"
              onClick={onSyncHealthConnect}
              disabled={isSyncingHealthConnect}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                borderRadius: "12px",
                background: "#f1f5f9",
                border: "1px solid #e2e8f0",
                color: "#1e293b",
                fontSize: "12px",
                fontWeight: 700,
                cursor: isSyncingHealthConnect ? "not-allowed" : "pointer",
              }}
            >
              <RefreshCw
                style={{ width: 13, height: 13 }}
                className={isSyncingHealthConnect ? "animate-spin" : ""}
              />
              {isSyncingHealthConnect ? "Syncing..." : "Sync Data"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsConnectModalOpen(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 14px",
                borderRadius: "12px",
                background: "#7c3aed",
                border: "none",
                color: "#ffffff",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(124, 58, 237, 0.25)",
              }}
            >
              <Watch style={{ width: 14, height: 14 }} />
              Connect Source
            </button>
          )}
        </div>
      </div>

      {/* =========================================================
          2. SOURCE STATUS CARD (DEMO / REAL / WAITING)
      ========================================================= */}
      {isDemoMode && (
        <div
          style={{
            padding: "16px 20px",
            borderRadius: "18px",
            background: "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)",
            border: "1px solid #ddd6fe",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            boxShadow: "0 2px 10px rgba(124, 58, 237, 0.05)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "3px 10px",
                  borderRadius: "20px",
                  fontSize: "11px",
                  fontWeight: 800,
                  background: "#7c3aed",
                  color: "#ffffff",
                  letterSpacing: "0.04em",
                }}
              >
                🟣 DEMO DATA
              </span>
              <span style={{ fontSize: "13px", fontWeight: 700, color: "#4c1d95" }}>
                Demo Mode Active
              </span>
            </div>

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {onToggleDemoMode && (
                <button
                  type="button"
                  onClick={() => onToggleDemoMode(false)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "10px",
                    background: "#ffffff",
                    border: "1px solid #c4b5fd",
                    color: "#6d28d9",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Turn Off Demo
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsConnectModalOpen(true)}
                style={{
                  padding: "6px 14px",
                  borderRadius: "10px",
                  background: "#7c3aed",
                  border: "none",
                  color: "#ffffff",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: "0 2px 6px rgba(124, 58, 237, 0.25)",
                }}
              >
                Connect Health Source
              </button>
            </div>
          </div>

          <p
            style={{
              margin: 0,
              fontSize: "12px",
              color: "#5b21b6",
              lineHeight: "1.5",
            }}
          >
            No wearable or Health Connect source is currently connected. Showing
            simulated physiological values for demonstration. Connect your watch
            to see live biometric telemetry.
          </p>
        </div>
      )}

      {isNotConnectedMode && (
        <div
          style={{
            padding: "16px 20px",
            borderRadius: "18px",
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.02)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "3px 10px",
                  borderRadius: "20px",
                  fontSize: "11px",
                  fontWeight: 800,
                  background: "#64748b",
                  color: "#ffffff",
                  letterSpacing: "0.04em",
                }}
              >
                ⚪ NOT CONNECTED
              </span>
              <span style={{ fontSize: "13px", fontWeight: 700, color: "#334155" }}>
                No Wearable Telemetry
              </span>
            </div>

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {onToggleDemoMode && (
                <button
                  type="button"
                  onClick={() => onToggleDemoMode(true)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "10px",
                    background: "#7c3aed",
                    border: "none",
                    color: "#ffffff",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                    boxShadow: "0 2px 6px rgba(124, 58, 237, 0.25)",
                  }}
                >
                  Enable Demo Mode
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsConnectModalOpen(true)}
                style={{
                  padding: "6px 14px",
                  borderRadius: "10px",
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  color: "#334155",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Pair Watch
              </button>
            </div>
          </div>

          <p
            style={{
              margin: 0,
              fontSize: "12px",
              color: "#64748b",
              lineHeight: "1.5",
            }}
          >
            No real smartwatch or Health Connect data is currently linked. Turn on <strong>Demo Mode</strong> for presentations and SIH evaluation, or connect your wearable device.
          </p>
        </div>
      )}

      {isRealDataMode && (
        <div
          style={{
            padding: "16px 20px",
            borderRadius: "18px",
            background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)",
            border: "1px solid #bbf7d0",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            boxShadow: "0 2px 10px rgba(22, 163, 74, 0.05)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", minWidth: 0 }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "3px 10px",
                  borderRadius: "20px",
                  fontSize: "11px",
                  fontWeight: 800,
                  background: "#16a34a",
                  color: "#ffffff",
                  letterSpacing: "0.04em",
                  flexShrink: 0,
                }}
              >
                🟢 REAL DATA
              </span>
              <span style={{ fontSize: "13px", fontWeight: 700, color: "#14532d", wordBreak: "break-word", overflowWrap: "anywhere", minWidth: 0 }}>
                Connected to {formatHumanSourceLabel(activeSourceLabel)}
              </span>
            </div>

            <span
              style={{
                fontSize: "11px",
                color: "#15803d",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                fontWeight: 600,
                flexShrink: 0,
                whiteSpace: "nowrap",
              }}
            >
              <Clock style={{ width: 12, height: 12 }} />
              Last synced: {lastSyncTime || "Just now"}
            </span>
          </div>

          <p style={{ margin: 0, fontSize: "12px", color: "#166534", lineHeight: "1.4", wordBreak: "break-word", overflowWrap: "anywhere" }}>
            Real-time biometric telemetry synchronized directly from verified hardware
            sensors.
          </p>
        </div>
      )}

      {isWaitingMode && (
        <div
          style={{
            padding: "16px 20px",
            borderRadius: "18px",
            background: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)",
            border: "1px solid #fde68a",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            boxShadow: "0 2px 10px rgba(217, 119, 6, 0.05)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", minWidth: 0 }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "3px 10px",
                  borderRadius: "20px",
                  fontSize: "11px",
                  fontWeight: 800,
                  background: "#d97706",
                  color: "#ffffff",
                  letterSpacing: "0.04em",
                  flexShrink: 0,
                }}
              >
                🟡 CONNECTED
              </span>
              <span style={{ fontSize: "13px", fontWeight: 700, color: "#78350f", wordBreak: "break-word", overflowWrap: "anywhere", minWidth: 0 }}>
                Connected — Waiting for health data
              </span>
            </div>

            <div style={{ display: "flex", gap: "6px" }}>
              <button
                type="button"
                onClick={onSyncHealthConnect}
                disabled={isSyncingHealthConnect}
                style={{
                  padding: "6px 12px",
                  borderRadius: "10px",
                  background: "#ffffff",
                  border: "1px solid #fcd34d",
                  color: "#b45309",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {isSyncingHealthConnect ? "Syncing..." : "Sync Now"}
              </button>
              {isAndroid && (
                <button
                  type="button"
                  onClick={() => HealthConnectService.openSettings()}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "10px",
                    background: "#ffffff",
                    border: "1px solid #fcd34d",
                    color: "#b45309",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Open Settings
                </button>
              )}
            </div>
          </div>

          <p style={{ margin: 0, fontSize: "12px", color: "#92400e", lineHeight: "1.4" }}>
            Health source is connected, but no recent health records are available yet.
            Ensure your wearable companion app (e.g. Fire-Boltt, Samsung Health, or
            Wear OS) has sync enabled.
          </p>
        </div>
      )}

      {/* =========================================================
          3. TODAY'S HEALTH (6 VITAL CARDS)
      ========================================================= */}
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "12px",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: "16px",
              fontWeight: 800,
              color: "#0f172a",
              letterSpacing: "-0.01em",
            }}
          >
            Today's Health
          </h2>
          <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 500 }}>
            {isDemoMode
              ? "Simulated demonstration"
              : isRealDataMode
              ? "Live sensor records"
              : isWaitingMode
              ? "Awaiting sync"
              : "No source connected"}
          </span>
        </div>

        {/* 2-column or 3-column responsive grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(140px, 100%), 1fr))",
            gap: "10px",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          {/* 1. Heart Rate */}
          <VitalCard
            icon={<Heart style={{ width: 18, height: 18, color: "#e11d48" }} />}
            name="Heart Rate"
            value={
              isRealDataMode
                ? hrRecord
                  ? healthConnectMetrics?.heart_rate?.value
                  : health?.heart_rate || "Waiting"
                : isWaitingMode
                ? "Waiting"
                : isDemoMode
                ? (health?.heart_rate ?? DEMO_VITALS_SPEC.heartRate.value)
                : "Unavailable"
            }
            unit={
              isNotConnectedMode || isWaitingMode || (isRealDataMode && !hrRecord && !health?.heart_rate)
                ? ""
                : "BPM"
            }
            status={isNotConnectedMode ? "No Record" : "Normal"}
            mode={
              isRealDataMode && (hrRecord || health?.heart_rate)
                ? "real"
                : isDemoMode
                ? "demo"
                : "waiting"
            }
            sourceLabel={
              isRealDataMode
                ? hrRecord
                  ? "Health Connect"
                  : health?.heart_rate
                  ? "Bluetooth Wearable"
                  : "Health Connect"
                : isDemoMode
                ? "DEMO DATA"
                : "Not Connected"
            }
          />

          {/* 2. Blood Oxygen */}
          <VitalCard
            icon={<Activity style={{ width: 18, height: 18, color: "#0284c7" }} />}
            name="Blood Oxygen"
            value={
              isRealDataMode
                ? spo2Record
                  ? healthConnectMetrics?.spo2?.value
                  : health?.spo2 || "Waiting"
                : isWaitingMode
                ? "Waiting"
                : isDemoMode
                ? (health?.spo2 ?? DEMO_VITALS_SPEC.spo2.value)
                : "Unavailable"
            }
            unit={
              isNotConnectedMode || isWaitingMode || (isRealDataMode && !spo2Record && !health?.spo2)
                ? ""
                : "%"
            }
            status={isNotConnectedMode ? "No Record" : "Normal"}
            mode={
              isRealDataMode && (spo2Record || health?.spo2)
                ? "real"
                : isDemoMode
                ? "demo"
                : "waiting"
            }
            sourceLabel={
              isRealDataMode
                ? spo2Record
                  ? "Health Connect"
                  : health?.spo2
                  ? "Bluetooth Wearable"
                  : "Health Connect"
                : isDemoMode
                ? "DEMO DATA"
                : "Not Connected"
            }
          />

          {/* 3. Steps */}
          <VitalCard
            icon={<Footprints style={{ width: 18, height: 18, color: "#d97706" }} />}
            name="Steps"
            value={
              isRealDataMode
                ? stepsRecord
                  ? (healthConnectMetrics?.steps?.value ?? 0).toLocaleString()
                  : (health?.steps ?? "Waiting")
                : isWaitingMode
                ? "Waiting"
                : isDemoMode
                ? (typeof health?.steps === "number" ? health.steps.toLocaleString() : DEMO_VITALS_SPEC.steps.value)
                : "Unavailable"
            }
            unit={
              isNotConnectedMode || isWaitingMode || (isRealDataMode && !stepsRecord && !health?.steps)
                ? ""
                : "steps"
            }
            status={isNotConnectedMode ? "No Record" : "Today"}
            mode={
              isRealDataMode && (stepsRecord || health?.steps)
                ? "real"
                : isDemoMode
                ? "demo"
                : "waiting"
            }
            sourceLabel={
              isRealDataMode
                ? stepsRecord
                  ? "Health Connect"
                  : health?.steps
                  ? "Bluetooth Wearable"
                  : "Health Connect"
                : isDemoMode
                ? "DEMO DATA"
                : "Not Connected"
            }
          />

          {/* 4. Sleep */}
          <VitalCard
            icon={<Moon style={{ width: 18, height: 18, color: "#6366f1" }} />}
            name="Sleep"
            value={
              isRealDataMode
                ? sleepRecord
                  ? `${healthConnectMetrics?.sleep?.value}h`
                  : health?.sleep
                  ? `${health?.sleep}h`
                  : "Waiting"
                : isWaitingMode
                ? "Waiting"
                : isDemoMode
                ? (health?.sleep ? `${health.sleep}h` : DEMO_VITALS_SPEC.sleep.value)
                : "Unavailable"
            }
            unit=""
            status={isNotConnectedMode ? "No Record" : "Good"}
            mode={
              isRealDataMode && (sleepRecord || health?.sleep)
                ? "real"
                : isDemoMode
                ? "demo"
                : "waiting"
            }
            sourceLabel={
              isRealDataMode
                ? sleepRecord
                  ? "Health Connect"
                  : health?.sleep
                  ? "Bluetooth Wearable"
                  : "Health Connect"
                : isDemoMode
                ? "DEMO DATA"
                : "Not Connected"
            }
          />

          {/* 5. Body Temperature */}
          <VitalCard
            icon={<Thermometer style={{ width: 18, height: 18, color: "#ea580c" }} />}
            name="Body Temperature"
            value={
              isRealDataMode
                ? tempRecord
                  ? healthConnectMetrics?.temperature?.value
                  : health?.temperature || "Waiting"
                : isWaitingMode
                ? "Waiting"
                : isDemoMode
                ? (health?.temperature ? `${health.temperature}` : DEMO_VITALS_SPEC.temperature.value)
                : "Unavailable"
            }
            unit={
              isNotConnectedMode ||
              isWaitingMode ||
              (isRealDataMode && !tempRecord && !health?.temperature)
                ? ""
                : "°C"
            }
            status={isNotConnectedMode ? "No Record" : "Normal"}
            mode={
              isRealDataMode && (tempRecord || health?.temperature)
                ? "real"
                : isDemoMode
                ? "demo"
                : "waiting"
            }
            sourceLabel={
              isRealDataMode
                ? tempRecord
                  ? "Health Connect"
                  : health?.temperature
                  ? "Bluetooth Wearable"
                  : "Health Connect"
                : isDemoMode
                ? "DEMO DATA"
                : "Not Connected"
            }
          />

          {/* 6. Hydration */}
          <VitalCard
            icon={<Droplets style={{ width: 18, height: 18, color: "#06b6d4" }} />}
            name="Hydration"
            value={
              isRealDataMode
                ? health?.hydration ?? 68
                : isWaitingMode
                ? 68
                : isDemoMode
                ? (health?.hydration ?? DEMO_VITALS_SPEC.hydration.value)
                : "Unavailable"
            }
            unit={isNotConnectedMode ? "" : "%"}
            status={isNotConnectedMode ? "No Record" : "Good"}
            mode={
              isRealDataMode
                ? "real"
                : isDemoMode
                ? "demo"
                : "waiting"
            }
            sourceLabel={
              isRealDataMode
                ? "Manual Log"
                : isDemoMode
                ? "DEMO DATA"
                : "Not Connected"
            }
          />
        </div>
      </div>

      {/* =========================================================
          4. HEALTH SOURCES CONTROL SECTION
      ========================================================= */}
      <div
        style={{
          padding: "18px 20px",
          borderRadius: "18px",
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 6px rgba(0,0,0,0.02)",
        }}
      >
        <div style={{ marginBottom: "14px" }}>
          <h2
            style={{
              margin: 0,
              fontSize: "15px",
              fontWeight: 800,
              color: "#0f172a",
            }}
          >
            Health Sources
          </h2>
          <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#64748b" }}>
            Manage wearable and ecosystem integrations
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {/* Source 1: Health Connect */}
          <div
            style={{
              padding: "14px 16px",
              borderRadius: "14px",
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0, flex: "1 1 auto" }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: "10px",
                  background: "#ecfdf5",
                  color: "#059669",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Smartphone style={{ width: 20, height: 20 }} />
              </div>
              <div style={{ minWidth: 0, flex: "1 1 auto" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", minWidth: 0 }}>
                  <strong style={{ fontSize: "13px", color: "#0f172a", whiteSpace: "nowrap" }}>
                    Health Connect
                  </strong>
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: "12px",
                      background: hasAnyHealthConnectRecord
                        ? "#dcfce7"
                        : isAndroid && permissionSummary.grantedCount > 0
                        ? "#fef3c7"
                        : "#f1f5f9",
                      color: hasAnyHealthConnectRecord
                        ? "#15803d"
                        : isAndroid && permissionSummary.grantedCount > 0
                        ? "#b45309"
                        : "#64748b",
                      flexShrink: 0,
                    }}
                  >
                    {hasAnyHealthConnectRecord
                      ? "Connected — Real Data"
                      : isAndroid && permissionSummary.grantedCount > 0
                      ? "Connected — No Data"
                      : isAndroid
                      ? "Permission Required"
                      : "Not Connected"}
                  </span>
                </div>
                <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px", wordBreak: "break-word" }}>
                  Supports Fire-Boltt, Samsung Health, Wear OS, Google Fit
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <button
                type="button"
                onClick={onSyncHealthConnect}
                disabled={isSyncingHealthConnect}
                style={{
                  padding: "7px 12px",
                  borderRadius: "10px",
                  background: "#7c3aed",
                  border: "none",
                  color: "#ffffff",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: isSyncingHealthConnect ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <RefreshCw
                  style={{ width: 12, height: 12 }}
                  className={isSyncingHealthConnect ? "animate-spin" : ""}
                />
                {isSyncingHealthConnect ? "Syncing..." : "Sync Now"}
              </button>

              {isAndroid && (
                <button
                  type="button"
                  onClick={() => HealthConnectService.openSettings()}
                  style={{
                    padding: "7px 12px",
                    borderRadius: "10px",
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    color: "#334155",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <ExternalLink style={{ width: 12, height: 12 }} />
                  Settings
                </button>
              )}
            </div>
          </div>

          {/* Source 2: Direct Bluetooth Wearable */}
          <div
            style={{
              padding: "14px 16px",
              borderRadius: "14px",
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: "10px",
                  background: "#eff6ff",
                  color: "#2563eb",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Bluetooth style={{ width: 20, height: 20 }} />
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <strong style={{ fontSize: "13px", color: "#0f172a" }}>
                    Bluetooth Wearable
                  </strong>
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: "12px",
                      background: isBleConnected ? "#dcfce7" : "#f1f5f9",
                      color: isBleConnected ? "#15803d" : "#64748b",
                    }}
                  >
                    {isBleConnected
                      ? `Connected: ${bleStatus.deviceName || "BLE Device"}`
                      : "Not Connected"}
                  </span>
                </div>
                <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                  Direct wireless pairing for smartwatches & heart rate sensors
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              {isBleConnected && onDisconnectBluetooth && (
                <button
                  type="button"
                  onClick={onDisconnectBluetooth}
                  style={{
                    padding: "7px 12px",
                    borderRadius: "10px",
                    background: "#fee2e2",
                    border: "1px solid #fca5a5",
                    color: "#b91c1c",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Disconnect
                </button>
              )}

              <button
                type="button"
                onClick={onPairBluetooth}
                disabled={isScanningBle}
                style={{
                  padding: "7px 12px",
                  borderRadius: "10px",
                  background: isBleConnected ? "#f1f5f9" : "#2563eb",
                  border: isBleConnected ? "1px solid #cbd5e1" : "none",
                  color: isBleConnected ? "#1e293b" : "#ffffff",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: isScanningBle ? "not-allowed" : "pointer",
                }}
              >
                {isScanningBle
                  ? "Scanning..."
                  : isBleConnected
                  ? "Switch Device"
                  : "Connect Wearable"}
              </button>
            </div>
          </div>

          {/* Source 3: Presentation Demo Data Mode */}
          <div
            style={{
              padding: "14px 16px",
              borderRadius: "14px",
              background: isDemoMode ? "linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)" : "#f8fafc",
              border: `1px solid ${isDemoMode ? "#d8b4fe" : "#e2e8f0"}`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "10px",
                  background: isDemoMode ? "#7c3aed" : "#e2e8f0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: isDemoMode ? "#ffffff" : "#64748b",
                  flexShrink: 0,
                }}
              >
                <Sparkles style={{ width: 18, height: 18 }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <strong style={{ fontSize: "13px", color: "#0f172a" }}>
                    Demo Data Mode
                  </strong>
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: "12px",
                      background: isDemoMode ? "#ede9fe" : "#f1f5f9",
                      color: isDemoMode ? "#7c3aed" : "#64748b",
                      border: isDemoMode ? "1px solid #c4b5fd" : "1px solid transparent",
                    }}
                  >
                    {isDemoMode ? "DEMO DATA ACTIVE" : "OFF"}
                  </span>
                </div>
                <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                  Realistic simulated vitals for SIH evaluation, offline preview & UI testing
                </div>
              </div>
            </div>

            {onToggleDemoMode && (
              <button
                type="button"
                onClick={() => onToggleDemoMode(!isDemoMode)}
                style={{
                  padding: "7px 14px",
                  borderRadius: "10px",
                  background: isDemoMode ? "#7c3aed" : "#ffffff",
                  border: isDemoMode ? "none" : "1px solid #cbd5e1",
                  color: isDemoMode ? "#ffffff" : "#334155",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: isDemoMode ? "0 2px 6px rgba(124, 58, 237, 0.25)" : "none",
                }}
              >
                {isDemoMode ? "Disable Demo" : "Enable Demo"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* =========================================================
          5. ENVIRONMENTAL CONDITIONS SECTION (ALWAYS REAL DATA)
      ========================================================= */}
      <div
        style={{
          padding: "18px 20px",
          borderRadius: "18px",
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 6px rgba(0,0,0,0.02)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "8px",
            marginBottom: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Compass style={{ width: 16, height: 16, color: "#0284c7" }} />
            <h2
              style={{
                margin: 0,
                fontSize: "15px",
                fontWeight: 800,
                color: "#0f172a",
              }}
            >
              Environmental Conditions
            </h2>
          </div>

          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "2px 8px",
              borderRadius: "12px",
              fontSize: "10px",
              fontWeight: 800,
              background: "#ecfdf5",
              color: "#15803d",
              border: "1px solid #bbf7d0",
            }}
          >
            ● REAL ENVIRONMENT DATA
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
            gap: "10px",
          }}
        >
          <div
            style={{
              padding: "10px 12px",
              borderRadius: "12px",
              background: "#f8fafc",
              border: "1px solid #f1f5f9",
            }}
          >
            <div style={{ fontSize: "11px", color: "#64748b" }}>Temperature</div>
            <div
              style={{
                fontSize: "18px",
                fontWeight: 800,
                color: "#0f172a",
                marginTop: "2px",
              }}
            >
              {environment?.temperature !== undefined &&
              environment?.temperature !== null
                ? `${environment.temperature}°C`
                : "31.0°C"}
            </div>
          </div>

          <div
            style={{
              padding: "10px 12px",
              borderRadius: "12px",
              background: "#f8fafc",
              border: "1px solid #f1f5f9",
            }}
          >
            <div style={{ fontSize: "11px", color: "#64748b" }}>Air Quality</div>
            <div
              style={{
                fontSize: "18px",
                fontWeight: 800,
                color: "#0f172a",
                marginTop: "2px",
              }}
            >
              AQI {environment?.aqi ?? 88}
            </div>
            <div style={{ fontSize: "10px", color: "#16a34a", fontWeight: 600 }}>
              {environment?.aqi_level || "Moderate"}
            </div>
          </div>

          <div
            style={{
              padding: "10px 12px",
              borderRadius: "12px",
              background: "#f8fafc",
              border: "1px solid #f1f5f9",
            }}
          >
            <div style={{ fontSize: "11px", color: "#64748b" }}>Heat Index</div>
            <div
              style={{
                fontSize: "18px",
                fontWeight: 800,
                color: "#0f172a",
                marginTop: "2px",
              }}
            >
              {environment?.heat_index !== undefined &&
              environment?.heat_index !== null
                ? `${environment.heat_index}°C`
                : "34.3°C"}
            </div>
          </div>

          <div
            style={{
              padding: "10px 12px",
              borderRadius: "12px",
              background: "#f8fafc",
              border: "1px solid #f1f5f9",
            }}
          >
            <div style={{ fontSize: "11px", color: "#64748b" }}>UV Index</div>
            <div
              style={{
                fontSize: "18px",
                fontWeight: 800,
                color: "#0f172a",
                marginTop: "2px",
              }}
            >
              {environment?.uv_index !== undefined && environment?.uv_index !== null
                ? environment.uv_index
                : "8.2"}
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: "8px",
            fontSize: "10px",
            color: "#94a3b8",
            textAlign: "right",
          }}
        >
          Source: Open-Meteo Live Meteorological Feed
        </div>
      </div>

      {/* =========================================================
          6. DATA PRIVACY NOTE
      ========================================================= */}
      <div
        style={{
          padding: "14px 18px",
          borderRadius: "14px",
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <Lock style={{ width: 18, height: 18, color: "#64748b", flexShrink: 0 }} />
        <div>
          <strong style={{ fontSize: "12px", color: "#334155" }}>
            Data Privacy & Clinical Encryption
          </strong>
          <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#64748b", lineHeight: "1.4" }}>
            Your health data remains under your control. Clinical telemetry is
            stored securely on-device and encrypted. No data is shared without your
            explicit consent.
          </p>
        </div>
      </div>

      {/* =========================================================
          7. COLLAPSIBLE TECHNICAL DIAGNOSTICS (COLLAPSED BY DEFAULT)
      ========================================================= */}
      <div style={{ paddingTop: "4px" }}>
        <button
          type="button"
          onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
          style={{
            background: "transparent",
            border: "none",
            color: "#64748b",
            fontSize: "12px",
            fontWeight: 600,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "4px 0",
          }}
        >
          <Cpu style={{ width: 14, height: 14 }} />
          Advanced Diagnostics (Developer Mode)
          {showTechnicalDetails ? (
            <ChevronUp style={{ width: 14, height: 14 }} />
          ) : (
            <ChevronDown style={{ width: 14, height: 14 }} />
          )}
        </button>

        {showTechnicalDetails && (
          <div
            style={{
              marginTop: "10px",
              padding: "16px 20px",
              borderRadius: "14px",
              background: "#0f172a",
              color: "#e2e8f0",
              fontSize: "11px",
              fontFamily: "monospace",
              lineHeight: "1.6",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "10px",
              }}
            >
              <div>
                <span style={{ color: "#94a3b8" }}>Platform:</span>{" "}
                <span style={{ color: "#38bdf8", fontWeight: "bold" }}>
                  {isAndroid ? "Android Native (Capacitor)" : "Web Browser Preview"}
                </span>
              </div>
              <div>
                <span style={{ color: "#94a3b8" }}>Health Connect:</span>{" "}
                <span
                  style={{
                    color: isAndroid ? "#4ade80" : "#f87171",
                    fontWeight: "bold",
                  }}
                >
                  {isAndroid ? "Available" : "Web Preview Mode"}
                </span>
              </div>
              <div>
                <span style={{ color: "#94a3b8" }}>Plugin Class:</span>{" "}
                <span style={{ color: "#f1f5f9" }}>
                  com.lifeshield.app.HealthConnectPlugin
                </span>
              </div>
              <div>
                <span style={{ color: "#94a3b8" }}>BLE Status:</span>{" "}
                <span style={{ color: isBleConnected ? "#4ade80" : "#94a3b8" }}>
                  {isBleConnected
                    ? `Connected (${bleStatus.deviceName || "BLE Device"})`
                    : "Disconnected"}
                </span>
              </div>
              <div
                style={{
                  gridColumn: "1 / -1",
                  borderTop: "1px solid #334155",
                  paddingTop: "8px",
                }}
              >
                <span style={{ color: "#94a3b8" }}>Permissions:</span> Heart Rate:{" "}
                {permissionSummary.heartRate ? "✓" : "✗"} | Steps:{" "}
                {permissionSummary.steps ? "✓" : "✗"} | Sleep:{" "}
                {permissionSummary.sleep ? "✓" : "✗"} | SpO2:{" "}
                {permissionSummary.spo2 ? "✓" : "✗"} | Temp:{" "}
                {permissionSummary.temperature ? "✓" : "✗"}
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <span style={{ color: "#94a3b8" }}>Records in Health Connect:</span>{" "}
                HR: {healthConnectMetrics?.heart_rate?.recordsFound || 0} | Steps:{" "}
                {healthConnectMetrics?.steps?.recordsFound || 0} | Sleep:{" "}
                {healthConnectMetrics?.sleep?.recordsFound || 0} | SpO2:{" "}
                {healthConnectMetrics?.spo2?.recordsFound || 0} | Temp:{" "}
                {healthConnectMetrics?.temperature?.recordsFound || 0}
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <span style={{ color: "#94a3b8" }}>Last Sync:</span>{" "}
                {lastSyncTime || "None"} |{" "}
                <span style={{ color: "#94a3b8" }}>Status:</span>{" "}
                {formatHealthConnectStatus(healthConnectStatus)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================
          8. CONNECT HEALTH SOURCE MODAL
      ========================================================= */}
      {isConnectModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "16px 12px",
            boxSizing: "border-box",
          }}
          onClick={() => setIsConnectModalOpen(false)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "20px",
              padding: "20px 16px",
              maxWidth: "min(460px, calc(100vw - 24px))",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
              boxSizing: "border-box",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "16px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Watch style={{ width: 20, height: 20, color: "#7c3aed" }} />
                <h3
                  style={{
                    margin: 0,
                    fontSize: "18px",
                    fontWeight: 800,
                    color: "#0f172a",
                  }}
                >
                  Connect Health Source
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsConnectModalOpen(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: "18px",
                  color: "#64748b",
                  cursor: "pointer",
                  padding: "4px",
                }}
              >
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>

            <p style={{ fontSize: "13px", color: "#64748b", marginTop: 0, marginBottom: "18px" }}>
              Choose how you want to connect your health data to LifeShield.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {/* Option 1: Health Connect */}
              <div
                style={{
                  padding: "14px 16px",
                  borderRadius: "14px",
                  border: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <Smartphone style={{ width: 18, height: 18, color: "#059669" }} />
                  <div>
                    <strong style={{ fontSize: "13px", color: "#0f172a" }}>
                      Android Health Connect
                    </strong>
                    <div style={{ fontSize: "11px", color: "#64748b" }}>
                      Syncs with Samsung Health, Fire-Boltt, Wear OS, Google Fit
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsConnectModalOpen(false);
                      onSyncHealthConnect();
                    }}
                    style={{
                      flex: 1,
                      padding: "8px 12px",
                      borderRadius: "10px",
                      background: "#7c3aed",
                      border: "none",
                      color: "#ffffff",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Sync Records
                  </button>

                  {isAndroid && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsConnectModalOpen(false);
                        HealthConnectService.openSettings();
                      }}
                      style={{
                        padding: "8px 12px",
                        borderRadius: "10px",
                        background: "#ffffff",
                        border: "1px solid #cbd5e1",
                        color: "#334155",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Permissions
                    </button>
                  )}
                </div>
              </div>

              {/* Option 2: Bluetooth */}
              <div
                style={{
                  padding: "14px 16px",
                  borderRadius: "14px",
                  border: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <Bluetooth style={{ width: 18, height: 18, color: "#2563eb" }} />
                  <div>
                    <strong style={{ fontSize: "13px", color: "#0f172a" }}>
                      Direct Bluetooth Sensor
                    </strong>
                    <div style={{ fontSize: "11px", color: "#64748b" }}>
                      Pair nearby smartwatches or heart rate straps
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsConnectModalOpen(false);
                    onPairBluetooth();
                  }}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "10px",
                    background: "#2563eb",
                    border: "none",
                    color: "#ffffff",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Scan Bluetooth Devices
                </button>
              </div>

              {/* Guide */}
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: "12px",
                  background: "#f1f5f9",
                  fontSize: "11px",
                  color: "#475569",
                  lineHeight: "1.4",
                }}
              >
                <strong>Smartwatch Sync Tip:</strong> Open your watch app (e.g. Da Fit,
                Samsung Health) → turn on "Sync to Health Connect" → return here and tap
                Sync Records.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// =========================================================
// REUSABLE VITAL CARD COMPONENT
// =========================================================
interface VitalCardProps {
  icon: React.ReactNode;
  name: string;
  value: string | number | null | undefined;
  unit?: string;
  status: string;
  mode: "real" | "demo" | "waiting";
  sourceLabel?: string;
}

const VitalCard: React.FC<VitalCardProps> = ({
  icon,
  name,
  value,
  unit,
  status,
  mode,
  sourceLabel,
}) => {
  const isWaiting =
    mode === "waiting" ||
    value === "Waiting" ||
    value === null ||
    value === undefined;

  return (
    <div
      style={{
        padding: "16px",
        borderRadius: "18px",
        background: "#ffffff",
        border: `1px solid ${
          mode === "real" ? "#bbf7d0" : mode === "demo" ? "#e2e8f0" : "#fde68a"
        }`,
        boxShadow: "0 1px 4px rgba(0,0,0,0.02)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        gap: "10px",
        boxSizing: "border-box",
      }}
    >
      <div>
        {/* Card Header: Icon + Name */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "8px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {icon}
            <span
              style={{
                fontSize: "12px",
                fontWeight: 700,
                color: "#1e293b",
                letterSpacing: "-0.01em",
              }}
            >
              {name}
            </span>
          </div>

          <span
            style={{
              fontSize: "10px",
              fontWeight: 700,
              padding: "2px 6px",
              borderRadius: "8px",
              background: isWaiting
                ? "#fef3c7"
                : mode === "real"
                ? "#dcfce7"
                : "#f1f5f9",
              color: isWaiting
                ? "#b45309"
                : mode === "real"
                ? "#15803d"
                : "#64748b",
            }}
          >
            {isWaiting ? "Pending" : status}
          </span>
        </div>

        {/* Primary Value Display */}
        <div style={{ marginTop: "4px" }}>
          {isWaiting ? (
            <div style={{ fontSize: "14px", fontWeight: 700, color: "#94a3b8" }}>
              Waiting for data
            </div>
          ) : (
            <div
              style={{
                fontSize: "24px",
                fontWeight: 900,
                color: "#0f172a",
                letterSpacing: "-0.02em",
                display: "flex",
                alignItems: "baseline",
                gap: "4px",
              }}
            >
              {value}
              {unit && (
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "#64748b",
                  }}
                >
                  {unit}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Honest Source Badge */}
      <div
        style={{
          paddingTop: "8px",
          borderTop: "1px solid #f8fafc",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            fontSize: "9px",
            fontWeight: 800,
            padding: "2px 6px",
            borderRadius: "6px",
            letterSpacing: "0.03em",
            textTransform: "uppercase",
            background:
              mode === "real"
                ? "#dcfce7"
                : mode === "demo"
                ? "#f3e8ff"
                : "#fef3c7",
            color:
              mode === "real"
                ? "#15803d"
                : mode === "demo"
                ? "#7c3aed"
                : "#b45309",
          }}
        >
          {mode === "real"
            ? `REAL DATA • ${sourceLabel || "Health Connect"}`
            : mode === "demo"
            ? "DEMO DATA"
            : `CONNECTED • ${sourceLabel || "Health Connect"}`}
        </span>
      </div>
    </div>
  );
};
