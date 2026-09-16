/**
 * BackendConnectionTest — Diagnostic component (TEMPORARY).
 * Calls the real /health endpoint via the existing apiClient.
 * Does NOT display tokens, passwords, or API keys.
 * Safe to remove once connectivity is verified.
 */
import React, { useState } from "react";
import { Wifi, WifiOff, Loader2, Activity } from "lucide-react";
import { apiClient } from "../../services/apiClient";

type TestStatus = "idle" | "testing" | "connected" | "failed";

interface TestResult {
  status: TestStatus;
  apiBaseUrl: string;
  endpoint: string;
  responseData?: { status: string; service: string; version: string };
  errorMessage?: string;
}

export const BackendConnectionTest: React.FC = () => {
  const [result, setResult] = useState<TestResult>({
    status: "idle",
    apiBaseUrl: apiClient.getBaseUrl(),
    endpoint: "/health",
  });

  const runTest = async () => {
    setResult({
      status: "testing",
      apiBaseUrl: apiClient.getBaseUrl(),
      endpoint: "/health",
    });

    try {
      const data = await apiClient.checkHealth();
      setResult({
        status: "connected",
        apiBaseUrl: apiClient.getBaseUrl(),
        endpoint: "/health",
        responseData: data,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Unknown error occurred.";
      setResult({
        status: "failed",
        apiBaseUrl: apiClient.getBaseUrl(),
        endpoint: "/health",
        errorMessage: message,
      });
    }
  };

  const { status, apiBaseUrl, endpoint, responseData, errorMessage } = result;

  const statusColor =
    status === "connected"
      ? "#22c55e"
      : status === "failed"
      ? "#ef4444"
      : status === "testing"
      ? "#f59e0b"
      : "#64748b";

  const statusLabel =
    status === "connected"
      ? "CONNECTED"
      : status === "failed"
      ? "NOT CONNECTED"
      : status === "testing"
      ? "TESTING..."
      : "NOT TESTED";

  return (
    <div
      className="p-4 rounded-2xl border space-y-3"
      style={{
        background: "rgba(15, 23, 42, 0.7)",
        borderColor: statusColor + "55",
      }}
    >
      <div className="flex items-center gap-2">
        <div
          className="p-2 rounded-xl"
          style={{ background: statusColor + "22", color: statusColor }}
        >
          <Activity className="w-4 h-4" />
        </div>
        <div>
          <div className="text-xs font-bold text-white">
            Backend Connection Test
          </div>
          <div className="text-[11px] font-semibold" style={{ color: statusColor }}>
            {statusLabel}
          </div>
        </div>
      </div>

      <div
        className="space-y-1.5 text-[11px] font-mono pt-2 border-t"
        style={{ borderColor: "rgba(51,65,85,0.5)" }}
      >
        <div className="flex gap-2">
          <span className="text-slate-500 w-28 flex-shrink-0">API Base URL:</span>
          <span className="text-slate-200 break-all">{apiBaseUrl}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-slate-500 w-28 flex-shrink-0">Endpoint:</span>
          <span className="text-slate-200">{endpoint}</span>
        </div>

        {status === "connected" && responseData && (
          <>
            <div className="flex gap-2">
              <span className="text-slate-500 w-28 flex-shrink-0">Service:</span>
              <span className="text-green-400">{responseData.service}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-slate-500 w-28 flex-shrink-0">Version:</span>
              <span className="text-green-400">{responseData.version}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-slate-500 w-28 flex-shrink-0">Health:</span>
              <span className="text-green-400">{responseData.status}</span>
            </div>
          </>
        )}

        {status === "failed" && errorMessage && (
          <div
            className="mt-1 p-2 rounded-lg text-[11px] text-red-300 break-all"
            style={{ background: "rgba(239,68,68,0.1)" }}
          >
            {errorMessage}
          </div>
        )}
      </div>

      <button
        id="backend-connection-test-btn"
        type="button"
        disabled={status === "testing"}
        onClick={runTest}
        className="w-full py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all"
        style={{
          background:
            status === "testing"
              ? "rgba(100,116,139,0.2)"
              : "rgba(14,165,233,0.15)",
          color: status === "testing" ? "#94a3b8" : "#38bdf8",
          border: `1px solid ${
            status === "testing"
              ? "rgba(100,116,139,0.3)"
              : "rgba(14,165,233,0.3)"
          }`,
          cursor: status === "testing" ? "not-allowed" : "pointer",
        }}
      >
        {status === "testing" ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Testing connection...
          </>
        ) : status === "connected" ? (
          <>
            <Wifi className="w-3.5 h-3.5" />
            Re-test Connection
          </>
        ) : status === "failed" ? (
          <>
            <WifiOff className="w-3.5 h-3.5" />
            Retry Connection
          </>
        ) : (
          <>
            <Wifi className="w-3.5 h-3.5" />
            Test Backend Connection
          </>
        )}
      </button>

      <p className="text-[10px] text-slate-600 text-center">
        Diagnostic only — remove before production release
      </p>
    </div>
  );
};
