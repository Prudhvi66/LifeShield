import React, { useState } from "react";
import {
  Bell,
  AlertTriangle,
  AlertOctagon,
  CloudSun,
  HeartPulse,
  Watch,
  ShieldCheck,
  CheckCircle2,
  Check,
} from "lucide-react";

export interface SystemAlertItem {
  id: string;
  type: "health" | "environment" | "fall" | "emergency" | "device" | "system";
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  recommendedAction: string;
  timestamp: string;
  isRead: boolean;
}

interface AlertsViewProps {
  environmentAdvisories?: Array<{ id: string; title: string; severity: string; description: string; category?: string }>;
}

export const AlertsView: React.FC<AlertsViewProps> = ({ environmentAdvisories = [] }) => {
  // Built-in initial alerts derived from live environment and security status
  const [alerts, setAlerts] = useState<SystemAlertItem[]>(() => {
    const list: SystemAlertItem[] = [
      {
        id: "sys-1",
        type: "system",
        severity: "info",
        title: "LifeShield Core Security Active",
        description: "Local database tables initialized and JWT authentication active.",
        recommendedAction: "Verify your emergency contacts are up to date.",
        timestamp: "Today, 11:30 AM",
        isRead: false,
      },
      {
        id: "dev-1",
        type: "device",
        severity: "info",
        title: "Bluetooth LE Standby",
        description: "Standard GATT pulse oximeter discovery ready.",
        recommendedAction: "Pair your smartwatch via the Wearables tab to begin streaming.",
        timestamp: "Today, 11:20 AM",
        isRead: false,
      },
    ];

    // Merge in any active live Open-Meteo environmental advisories
    environmentAdvisories.forEach((adv, i) => {
      list.unshift({
        id: adv.id || `env-${i}`,
        type: "environment",
        severity: adv.severity.toLowerCase() === "warning" ? "warning" : "info",
        title: adv.title,
        description: adv.description,
        recommendedAction: "Limit prolonged direct outdoor exposure; stay hydrated.",
        timestamp: "Live Feed",
        isRead: false,
      });
    });

    return list;
  });

  const [activeFilter, setActiveFilter] = useState<string>("all");

  const markAsRead = (id: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, isRead: true } : a))
    );
  };

  const markAllAsRead = () => {
    setAlerts((prev) => prev.map((a) => ({ ...a, isRead: true })));
  };

  const filtered = alerts.filter((a) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "unread") return !a.isRead;
    return a.type === activeFilter;
  });

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case "critical":
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40">CRITICAL</span>;
      case "warning":
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40">WARNING</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-sky-500/20 text-sky-400 border border-sky-500/40">INFORMATIONAL</span>;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "health":
        return <HeartPulse className="w-5 h-5 text-rose-400" />;
      case "environment":
        return <CloudSun className="w-5 h-5 text-sky-400" />;
      case "fall":
      case "emergency":
        return <AlertOctagon className="w-5 h-5 text-red-400" />;
      case "device":
        return <Watch className="w-5 h-5 text-indigo-400" />;
      default:
        return <ShieldCheck className="w-5 h-5 text-emerald-400" />;
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn" style={{ textAlign: "left" }}>
      {/* Header & Mark all as read */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs font-bold text-sky-400 tracking-wider uppercase">NOTIFICATIONS & INCIDENTS</div>
          <h1 className="text-2xl lg:text-3xl font-extrabold text-white">Alerts & Safety Advisories</h1>
          <p className="text-slate-400 text-sm mt-1">
            Real-time feed of atmospheric hazards, physiological threshold events, and system notices.
          </p>
        </div>

        <button
          type="button"
          className="ls-btn-secondary flex items-center gap-1.5 text-xs"
          onClick={markAllAsRead}
        >
          <Check className="w-3.5 h-3.5" /> Mark All as Read
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
        {[
          { id: "all", label: "All Alerts" },
          { id: "unread", label: "Unread" },
          { id: "environment", label: "Atmospheric" },
          { id: "health", label: "Clinical" },
          { id: "emergency", label: "Emergency & Fall" },
          { id: "device", label: "Wearable & System" },
        ].map((f) => (
          <button
            key={f.id}
            type="button"
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeFilter === f.id
                ? "bg-sky-500 text-white"
                : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
            }`}
            onClick={() => setActiveFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Alerts List */}
      <div className="space-y-3">
        {filtered.length > 0 ? (
          filtered.map((alert) => (
            <div
              key={alert.id}
              className={`p-5 rounded-2xl border transition-all ${
                alert.isRead
                  ? "bg-slate-900/40 border-slate-800/80 opacity-75"
                  : "bg-slate-900/80 border-slate-700 shadow-sm"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="p-2.5 rounded-xl bg-slate-800/90 shrink-0 mt-0.5">
                    {getTypeIcon(alert.type)}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-white">{alert.title}</h3>
                      {getSeverityBadge(alert.severity)}
                      {!alert.isRead && (
                        <span className="w-2 h-2 rounded-full bg-sky-400" title="Unread" />
                      )}
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">{alert.description}</p>
                    <div className="text-xs text-sky-300 bg-sky-950/40 border border-sky-900/50 p-2 rounded-lg mt-2 inline-block">
                      <strong>Recommended Action:</strong> {alert.recommendedAction}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className="text-[11px] text-slate-500">{alert.timestamp}</span>
                  {!alert.isRead && (
                    <button
                      type="button"
                      className="text-xs text-slate-400 hover:text-white underline"
                      onClick={() => markAsRead(alert.id)}
                    >
                      Mark read
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="py-12 text-center text-slate-400 space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
            <div className="font-semibold text-slate-300">You're All Caught Up</div>
            <p className="text-xs max-w-sm mx-auto">
              No active warnings or advisories found in this filter category.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
