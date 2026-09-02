import MedicationReminder from "./src/MedicationReminder";
import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { AppLayout } from './components/layout/AppLayout';
import { FallAlertModal } from './components/common/FallAlertModal';
import { DemoControlPanel } from './components/demo/DemoControlPanel';
import { HomeDashboard } from './components/dashboard/HomeDashboard';
import { HealthDashboard } from './components/health/HealthDashboard';
import { EnvironmentDashboard } from './components/environment/EnvironmentDashboard';
import { EmergencyCenter } from './components/emergency/EmergencyCenter';
import { LiveEmergencyView } from './components/emergency/LiveEmergencyView';
import { ProfileSettings } from './components/profile/ProfileSettings';
import { PrivacyCenter } from './components/privacy/PrivacyCenter';

const MainContent: React.FC = () => {
  const { activeTab, emergencyModeActive } = useApp();

  const renderTabContent = () => {
    if (emergencyModeActive) {
      return <LiveEmergencyView />;
    }

    switch (activeTab) {
      case 'home':
        return <HomeDashboard />;
      case 'health':
        return (
          <>
            <HealthDashboard />
            <MedicationReminder />
          </>
        );
      case 'environment':
        return <EnvironmentDashboard />;
      case 'emergency':
        return <EmergencyCenter />;
      case 'profile':
        return <ProfileSettings />;
      case 'privacy':
        return <PrivacyCenter />;
      default:
        return <HomeDashboard />;
    }
  };

  return (
    <AppLayout>
      {/* Active Tab View */}
      {renderTabContent()}

      {/* Full-Screen 30s Fall Countdown & Siren Modal */}
      <FallAlertModal />

      {/* Floating Presentation & Simulation Toolbar */}
      <DemoControlPanel />
    </AppLayout>
  );
};

export function App() {
  return (
    <AppProvider>
      <MainContent />
    </AppProvider>
  );
}

export default App;
