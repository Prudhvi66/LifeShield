import React from 'react';
import { SafetyScoreHero } from './SafetyScoreHero';
import { QuickActionButtons } from './QuickActionButtons';
import { VitalsCardGrid } from './VitalsCardGrid';
import { EnvironmentCard } from './EnvironmentCard';
import { ActiveAlertsCard } from './ActiveAlertsCard';

export const HomeDashboard: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* 1. Main Hero: Circular LifeShield Safety Score + Dimension Breakdown + AI Insights */}
      <SafetyScoreHero />

      {/* 2. Accessible Quick Action Buttons (Restrained SOS, Check-in, Beacon, Directory) */}
      <QuickActionButtons />

      {/* 3. Live Physiological Telemetry Grid (6 Health Cards with micro sparklines) */}
      <VitalsCardGrid />

      {/* 4. Dedicated Environmental Safety Card & Active Disaster / Anomaly Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <EnvironmentCard />
        <ActiveAlertsCard />
      </div>
    </div>
  );
};
