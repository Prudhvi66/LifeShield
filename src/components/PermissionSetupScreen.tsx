import React, { useState, useEffect, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import {
  permissionService,
  PermissionGroupKey,
} from "../services/permissionService";

interface PermissionSetupScreenProps {
  onComplete: () => void;
}

interface PermissionStep {
  key: PermissionGroupKey;
  icon: string;
  title: string;
  description: string;
}

const PERMISSION_STEPS: PermissionStep[] = [
  {
    key: "location",
    icon: "📍",
    title: "Location Access",
    description:
      "LifeShield uses your GPS location to share your position with emergency contacts during SOS alerts and to find nearby hospitals.",
  },
  {
    key: "phone",
    icon: "📞",
    title: "Phone Calls",
    description:
      "LifeShield needs to make phone calls to automatically contact your emergency contacts or emergency services (112/108) during an SOS.",
  },
  {
    key: "sms",
    icon: "💬",
    title: "SMS Messages",
    description:
      "LifeShield sends your GPS location and emergency message via text to your contacts when you trigger an SOS alert.",
  },
  {
    key: "notifications",
    icon: "🔔",
    title: "Notifications",
    description:
      "LifeShield uses notifications for medication reminders, fall-detection alerts, and emergency status updates.",
  },
  {
    key: "activityRecognition",
    icon: "🏃",
    title: "Physical Activity",
    description:
      "LifeShield monitors your physical activity to detect falls and provide background motion monitoring.",
  },
  {
    key: "bodySensors",
    icon: "❤️",
    title: "Body Sensors",
    description:
      "LifeShield reads heart rate and body temperature from connected wearable devices for health monitoring.",
  },
  {
    key: "healthConnect",
    icon: "🩺",
    title: "Health Connect",
    description:
      "LifeShield reads heart rate, steps, sleep, and oxygen saturation from Google Health Connect to provide health insights.",
  },
];

type ScreenState =
  | { phase: "checking" }
  | { phase: "explanation"; stepIndex: number }
  | { phase: "requesting"; stepIndex: number }
  | { phase: "denied"; stepIndex: number; canOpenSettings: boolean }
  | { phase: "complete" };

export const PermissionSetupScreen: React.FC<PermissionSetupScreenProps> = ({
  onComplete,
}) => {
  const [state, setState] = useState<ScreenState>({ phase: "checking" });
  const [results, setResults] = useState<
    Record<PermissionGroupKey, "granted" | "denied" | "skipped">
  >({} as any);

  const isNative =
    Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";

  // Filter steps to only those relevant on this device
  const [availableSteps, setAvailableSteps] = useState<PermissionStep[]>([]);

  // On mount: check which permissions exist and which are already granted
  const initSteps = useCallback(async () => {
    const steps: PermissionStep[] = [];
    for (const step of PERMISSION_STEPS) {
      try {
        const info = await permissionService.checkGroupStatus(step.key);
        if (info.status === "not_required") {
          // Skip permissions that don't exist on this Android version
          setResults((prev) => ({ ...prev, [step.key]: "granted" }));
          continue;
        }
        if (info.status === "granted") {
          setResults((prev) => ({ ...prev, [step.key]: "granted" }));
          continue;
        }
        steps.push(step);
      } catch {
        // If check fails, include the step anyway
        steps.push(step);
      }
    }
    setAvailableSteps(steps);
    if (steps.length === 0) {
      setState({ phase: "complete" });
    } else {
      setState({ phase: "explanation", stepIndex: 0 });
    }
  }, []);

  useEffect(() => {
    if (!isNative) {
      onComplete();
      return;
    }
    initSteps();
  }, [isNative, onComplete, initSteps]);

  // When phase becomes "complete", mark setup done and notify parent
  useEffect(() => {
    if (state.phase === "complete") {
      permissionService.markSetupComplete();
      onComplete();
    }
  }, [state.phase, onComplete]);

  const handleContinueToSystemDialog = async () => {
    if (state.phase !== "explanation") return;
    const step = availableSteps[state.stepIndex];
    if (!step) return;

    setState({ phase: "requesting", stepIndex: state.stepIndex });

    try {
      const granted = await permissionService.requestPermission(step.key);
      setResults((prev) => ({
        ...prev,
        [step.key]: granted ? "granted" : "denied",
      }));

      if (granted) {
        // Move to next step
        advanceToNext(state.stepIndex);
      } else {
        // Permission denied — check if we can open settings
        setState({
          phase: "denied",
          stepIndex: state.stepIndex,
          canOpenSettings: true,
        });
      }
    } catch (err) {
      console.warn("[PermissionSetup] Request error for", step.key, err);
      setResults((prev) => ({ ...prev, [step.key]: "denied" }));
      setState({
        phase: "denied",
        stepIndex: state.stepIndex,
        canOpenSettings: false,
      });
    }
  };

  const handleDeniedContinue = () => {
    if (state.phase !== "denied") return;
    advanceToNext(state.stepIndex);
  };

  const handleOpenSettings = async () => {
    await permissionService.openAppSettings();
  };

  const handleOpenHealthConnectSettings = async () => {
    await permissionService.openHealthConnectSettings();
  };

  const advanceToNext = (currentIndex: number) => {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= availableSteps.length) {
      setState({ phase: "complete" });
    } else {
      setState({ phase: "explanation", stepIndex: nextIndex });
    }
  };

  if (!isNative) return null;

  const stepIndex =
    state.phase === "explanation" || state.phase === "requesting" || state.phase === "denied"
      ? state.stepIndex
      : -1;

  const currentStep = stepIndex >= 0 ? availableSteps[stepIndex] : null;

  const grantedCount = Object.values(results).filter((v) => v === "granted").length;
  const totalSteps = availableSteps.length;
  const stepNumber = currentStep ? stepIndex + 1 : totalSteps;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background:
          "linear-gradient(160deg, #f5f3fc 0%, #eeecff 50%, #e8e4f8 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "20px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "#fff",
          borderRadius: "24px",
          boxShadow: "0 20px 60px rgba(100,80,160,0.15)",
          padding: "32px 24px",
          textAlign: "center",
        }}
      >
        {/* Checking phase */}
        {state.phase === "checking" && (
          <div style={{ padding: "20px 0", color: "#7c3aed", fontWeight: 600 }}>
            Checking permissions...
          </div>
        )}

        {/* Explanation phase — shows ONE permission with description + Continue */}
        {state.phase === "explanation" && currentStep && (
          <>
            <div
              style={{
                fontSize: "40px",
                marginBottom: "16px",
              }}
            >
              {currentStep.icon}
            </div>
            <h2
              style={{
                fontSize: "20px",
                fontWeight: 700,
                color: "#1e1b4b",
                margin: "0 0 10px",
              }}
            >
              {currentStep.title}
            </h2>
            <p
              style={{
                fontSize: "14px",
                color: "#6b7280",
                lineHeight: 1.6,
                margin: "0 0 24px",
              }}
            >
              {currentStep.description}
            </p>

            <button
              type="button"
              className="ls-btn-primary"
              style={{
                width: "100%",
                padding: "14px",
                fontSize: "15px",
                fontWeight: 700,
                borderRadius: "14px",
              }}
              onClick={handleContinueToSystemDialog}
            >
              Continue
            </button>

            <button
              type="button"
              className="ls-btn-secondary"
              style={{
                width: "100%",
                padding: "12px",
                fontSize: "13px",
                marginTop: "10px",
                borderRadius: "14px",
              }}
              onClick={() => advanceToNext(state.stepIndex)}
            >
              Skip
            </button>
          </>
        )}

        {/* Requesting phase — loading while system dialog is open */}
        {state.phase === "requesting" && currentStep && (
          <>
            <div
              style={{
                fontSize: "40px",
                marginBottom: "16px",
              }}
            >
              {currentStep.icon}
            </div>
            <h2
              style={{
                fontSize: "20px",
                fontWeight: 700,
                color: "#1e1b4b",
                margin: "0 0 10px",
              }}
            >
              {currentStep.title}
            </h2>
            <p
              style={{
                fontSize: "14px",
                color: "#7c3aed",
                lineHeight: 1.6,
                fontWeight: 600,
              }}
            >
              Waiting for your response...
            </p>
          </>
        )}

        {/* Denied phase — permission was denied */}
        {state.phase === "denied" && currentStep && (
          <>
            <div
              style={{
                fontSize: "40px",
                marginBottom: "16px",
              }}
            >
              {currentStep.icon}
            </div>
            <h2
              style={{
                fontSize: "20px",
                fontWeight: 700,
                color: "#1e1b4b",
                margin: "0 0 10px",
              }}
            >
              {currentStep.title}
            </h2>
            <p
              style={{
                fontSize: "14px",
                color: "#6b7280",
                lineHeight: 1.6,
                margin: "0 0 20px",
              }}
            >
              Permission was not granted. You can enable it later in Android
              Settings, or continue without it.
            </p>

            {state.canOpenSettings && (
              <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
                {currentStep.key === "healthConnect" ? (
                  <button
                    type="button"
                    className="ls-btn-primary"
                    style={{ flex: 1, padding: "12px", fontSize: "13px", borderRadius: "12px" }}
                    onClick={handleOpenHealthConnectSettings}
                  >
                    Open Health Connect
                  </button>
                ) : (
                  <button
                    type="button"
                    className="ls-btn-primary"
                    style={{ flex: 1, padding: "12px", fontSize: "13px", borderRadius: "12px" }}
                    onClick={handleOpenSettings}
                  >
                    Open Settings
                  </button>
                )}
              </div>
            )}

            <button
              type="button"
              className="ls-btn-secondary"
              style={{
                width: "100%",
                padding: "12px",
                fontSize: "13px",
                borderRadius: "14px",
              }}
              onClick={handleDeniedContinue}
            >
              Continue
            </button>
          </>
        )}

        {/* Progress indicator — shown during explanation/requesting/denied */}
        {(state.phase === "explanation" ||
          state.phase === "requesting" ||
          state.phase === "denied") &&
          totalSteps > 0 && (
            <div
              style={{
                marginTop: "20px",
                fontSize: "12px",
                color: "#9ca3af",
              }}
            >
              {stepNumber} of {totalSteps} — {grantedCount} granted
            </div>
          )}
      </div>
    </div>
  );
};
