import React from 'react';
import { SafetyScoreHero } from './SafetyScoreHero';
import { QuickActionButtons } from './QuickActionButtons';
import { VitalsCardGrid } from './VitalsCardGrid';
import { EnvironmentCard } from './EnvironmentCard';
import { ActiveAlertsCard } from './ActiveAlertsCard';
import { DailyRoutine } from '../routine/DailyRoutine';

export const HomeDashboard: React.FC = () => {
  return (
    <div className="space-y-6">

      {/* 1. LifeShield Safety Score + AI Insights */}
      <SafetyScoreHero />

      {/* 2. Quick Actions */}
      <QuickActionButtons />

      {/* 3. Daily Routine Reminder */}
      <DailyRoutine />

      {/* 4. Live Health & Vital Telemetry */}
      <VitalsCardGrid />

      {/* 5. Environment & Active Safety Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <EnvironmentCard />
        <ActiveAlertsCard />
      </div>

    </div>
  );
};

export default HomeDashboard;