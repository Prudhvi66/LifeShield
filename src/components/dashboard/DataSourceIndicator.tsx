import React from 'react';
import { DataSourceMode, DataSourceConnection } from '../../types/health';

interface DataSourceIndicatorProps {
  dataSource: DataSourceMode;
  connectionState: DataSourceConnection;
  lastSyncTime?: string;
  source?: string;
  compact?: boolean;
}

export const DataSourceIndicator: React.FC<DataSourceIndicatorProps> = ({
  dataSource,
  connectionState,
  lastSyncTime,
  source,
  compact = false,
}) => {
  const getStatusConfig = () => {
    switch (connectionState) {
      case 'CONNECTED_REAL_DATA':
        return {
          dotColor: 'bg-[#16A673]',
          pulse: true,
          label: 'LIVE DATA',
          sublabel: source === 'health_connect'
            ? 'Connected via Health Connect'
            : source === 'ble'
              ? 'Connected via Bluetooth'
              : source === 'manual'
                ? 'Manual Entry'
                : 'Connected',
          textColor: 'text-[#16A673]',
          bgColor: 'bg-emerald-50',
          borderColor: 'border-emerald-200',
        };
      case 'CONNECTED_NO_DATA':
        return {
          dotColor: 'bg-amber-500',
          pulse: false,
          label: 'NO REAL DATA',
          sublabel: 'Health Connect connected, but no readings available',
          textColor: 'text-amber-600',
          bgColor: 'bg-amber-50',
          borderColor: 'border-amber-200',
        };
      case 'NOT_CONNECTED_DEMO':
      default:
        return {
          dotColor: 'bg-slate-400',
          pulse: false,
          label: dataSource === 'demo' ? 'DEMO DATA' : 'NO WEARABLE',
          sublabel: dataSource === 'demo'
            ? 'Demo / No wearable connected'
            : 'No wearable connected',
          textColor: 'text-slate-600',
          bgColor: 'bg-slate-50',
          borderColor: 'border-slate-200',
        };
    }
  };

  const config = getStatusConfig();

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${config.bgColor} ${config.borderColor} ${config.textColor}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${config.dotColor} ${config.pulse ? 'animate-pulse' : ''}`} />
        {config.label}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-xl border ${config.bgColor} ${config.borderColor}`}>
      <span className={`w-2 h-2 rounded-full ${config.dotColor} ${config.pulse ? 'animate-pulse' : ''}`} />
      <div className="flex-1 min-w-0">
        <div className={`text-[11px] font-bold ${config.textColor}`}>
          {config.label}
        </div>
        <div className="text-[10px] text-slate-500 truncate">
          {config.sublabel}
        </div>
      </div>
      {lastSyncTime && (
        <div className="text-[10px] text-slate-400 font-mono whitespace-nowrap">
          Last synced: {lastSyncTime}
        </div>
      )}
    </div>
  );
};

export default DataSourceIndicator;
