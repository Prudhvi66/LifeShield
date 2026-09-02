import { AlertTriangle, CheckCircle2, ChevronRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const ActiveAlertsCard: React.FC = () => {
  const { aiAnalysis, disasterAlerts, setActiveTab } = useApp();

  const anomalies = aiAnalysis.detectedAnomalies;
  const hasDisasters = disasterAlerts.length > 0;

  if (anomalies.length === 0 && !hasDisasters) {
    return (
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg flex items-center gap-4">
        <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-400">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white">No Active Safety Anomaly Alerts</h3>
          <p className="text-xs text-slate-400">
            AI health monitoring is continuously tracking motion, cardiac signals, and environmental hazards locally on-device.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          Active Health & Safety Flags ({anomalies.length + disasterAlerts.length})
        </h3>
        <button
          onClick={() => setActiveTab('environment')}
          className="text-xs text-sky-400 hover:text-sky-300 font-semibold flex items-center gap-1"
        >
          View All <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="space-y-2">
        {/* On-Device AI Detected Anomalies */}
        {anomalies.map((anom) => (
          <div
            key={anom.id}
            className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              anom.severity === 'EMERGENCY' || anom.severity === 'HIGH RISK'
                ? 'bg-red-950/40 border-red-500/50'
                : 'bg-amber-950/30 border-amber-500/40'
            }`}
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                    anom.severity === 'EMERGENCY' || anom.severity === 'HIGH RISK'
                      ? 'bg-red-500/20 text-red-300'
                      : 'bg-amber-500/20 text-amber-300'
                  }`}
                >
                  {anom.severity}
                </span>
                <h4 className="text-sm font-bold text-white">{anom.title}</h4>
                <span className="text-[11px] text-slate-400">({anom.confidence}% AI confidence)</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">{anom.reason}</p>
            </div>

            <div className="shrink-0 flex items-center gap-2">
              <span className="text-[11px] text-slate-400 font-mono">{anom.detectedAt}</span>
            </div>
          </div>
        ))}

        {/* Official NDMA / IMD Hazard Alerts */}
        {disasterAlerts.slice(0, 1).map((alert) => (
          <div
            key={alert.id}
            className="p-3.5 rounded-xl bg-orange-950/30 border border-orange-500/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-orange-500/20 text-orange-300 border border-orange-500/40">
                  {alert.agency} Official Alert
                </span>
                <h4 className="text-sm font-bold text-white">{alert.headline}</h4>
              </div>
              <p className="text-xs text-slate-300">{alert.affectedRegion}</p>
            </div>
            <button
              onClick={() => setActiveTab('environment')}
              className="text-xs bg-orange-600 hover:bg-orange-500 text-white font-bold px-3 py-1.5 rounded-lg shrink-0"
            >
              Advisory
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
