import React from "react";
import {
  Shield,
  Activity,
  CloudSun,
  Watch,
  Bot,
  AlertTriangle,
  PhoneCall,
  Users,
  CheckCircle2,
  ArrowRight,
  HeartPulse,
  Wind,
  Flame,
  Zap,
  Info,
  ExternalLink,
} from "lucide-react";

interface LandingPageProps {
  onGetStarted: () => void;
  onExploreDashboard: () => void;
  onEmergencyProtection: () => void;
  onOpenDisclaimer: () => void;
  onOpenPrivacy: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onGetStarted,
  onExploreDashboard,
  onEmergencyProtection,
  onOpenDisclaimer,
  onOpenPrivacy,
}) => {
  return (
    <div className="landing-page-container">
      {/* 1. HERO SECTION */}
      <section className="landing-hero">
        <div className="landing-hero-badge">
          <span className="badge-pulse" />
          <span>Clinical Safety • Disaster Resilience • Health AI</span>
        </div>

        <h1 className="landing-hero-title">
          Life<span className="text-gradient">Shield</span>
        </h1>

        <p className="landing-hero-subtitle">
          Intelligent personal health awareness, live environmental hazard monitoring,
          and rapid emergency dispatch — combined into one unified platform.
        </p>

        <div className="landing-hero-actions">
          <button
            type="button"
            className="landing-btn landing-btn-primary"
            onClick={onGetStarted}
            id="landing-btn-get-started"
          >
            Get Started <ArrowRight className="w-4 h-4 ml-1 inline" />
          </button>
          <button
            type="button"
            className="landing-btn landing-btn-secondary"
            onClick={onExploreDashboard}
            id="landing-btn-explore"
          >
            Explore Dashboard
          </button>
          <button
            type="button"
            className="landing-btn landing-btn-emergency"
            onClick={onEmergencyProtection}
            id="landing-btn-emergency"
          >
            <PhoneCall className="w-4 h-4 mr-1 inline" /> Emergency Protection
          </button>
        </div>

        {/* Hero Visual Preview */}
        <div className="landing-preview-card">
          <div className="preview-card-header">
            <div className="preview-dots">
              <span className="dot red" />
              <span className="dot yellow" />
              <span className="dot green" />
            </div>
            <div className="preview-title">LifeShield Telemetry Console</div>
            <span className="preview-badge">Live System</span>
          </div>
          <div className="preview-grid">
            <div className="preview-item">
              <div className="preview-item-label">Cardiac Telemetry</div>
              <div className="preview-item-value">72 <small>BPM</small></div>
              <div className="preview-item-status text-emerald-400">● Baseline Normal</div>
            </div>
            <div className="preview-item">
              <div className="preview-item-label">Air Quality (AQI)</div>
              <div className="preview-item-value">58 <small>AQI</small></div>
              <div className="preview-item-status text-sky-400">● Open-Meteo Live</div>
            </div>
            <div className="preview-item">
              <div className="preview-item-label">Composite Risk</div>
              <div className="preview-item-value">12 <small>/100</small></div>
              <div className="preview-item-status text-emerald-400">● Low Clinical Risk</div>
            </div>
            <div className="preview-item">
              <div className="preview-item-label">SOS Dispatch</div>
              <div className="preview-item-value">Armed</div>
              <div className="preview-item-status text-amber-400">● Priority Contacts Ready</div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. WHAT IS LIFESHIELD? */}
      <section className="landing-section">
        <div className="section-tag">OVERVIEW</div>
        <h2 className="section-title">What is LifeShield?</h2>
        <p className="section-description">
          LifeShield is an open, proactive health and environmental awareness system. It bridges
          wearables, Android Health Connect, and local meteorological hazards with real-time risk
          analysis to keep individuals and families safe during heatwaves, pollution spikes, and emergencies.
        </p>
      </section>

      {/* 3. KEY FEATURES (8 CARDS) */}
      <section className="landing-section">
        <div className="section-tag">CAPABILITIES</div>
        <h2 className="section-title">Key Features</h2>
        <div className="landing-features-grid">
          {/* Card 1 */}
          <div className="landing-feature-card">
            <div className="feature-icon bg-rose-500/15 text-rose-400">
              <HeartPulse className="w-6 h-6" />
            </div>
            <h3>Health Monitoring</h3>
            <p>
              Track continuous heart rate, SpO2 blood oxygen, resting baseline deviations,
              and physical activity metrics with full transparency.
            </p>
          </div>

          {/* Card 2 */}
          <div className="landing-feature-card">
            <div className="feature-icon bg-sky-500/15 text-sky-400">
              <CloudSun className="w-6 h-6" />
            </div>
            <h3>Environmental Risk</h3>
            <p>
              Real-time atmospheric hazards from Open-Meteo including PM2.5, PM10, wet-bulb heat index,
              and localized UV advisories.
            </p>
          </div>

          {/* Card 3 */}
          <div className="landing-feature-card">
            <div className="feature-icon bg-indigo-500/15 text-indigo-400">
              <Watch className="w-6 h-6" />
            </div>
            <h3>Smartwatch Integration</h3>
            <p>
              Bluetooth LE standard GATT connectivity alongside native Android Health Connect
              support for synchronizing wearable telemetry.
            </p>
          </div>

          {/* Card 4 */}
          <div className="landing-feature-card">
            <div className="feature-icon bg-violet-500/15 text-violet-400">
              <Bot className="w-6 h-6" />
            </div>
            <h3>AI Health Companion</h3>
            <p>
              Context-aware intelligence providing explainable answers regarding air quality,
              hydration needs, and personal clinical baselines.
            </p>
          </div>

          {/* Card 5 */}
          <div className="landing-feature-card">
            <div className="feature-icon bg-amber-500/15 text-amber-400">
              <Zap className="w-6 h-6" />
            </div>
            <h3>Fall Detection</h3>
            <p>
              High-G impact detection architecture with a 30-second audio siren and cancellation
              window prior to automated emergency escalation.
            </p>
          </div>

          {/* Card 6 */}
          <div className="landing-feature-card">
            <div className="feature-icon bg-red-500/15 text-red-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3>Emergency SOS</h3>
            <p>
              One-touch SOS with 10-second countdown, GPS coordinate transmission, and Twilio-powered
              voice calls and SMS alerts to priority contacts.
            </p>
          </div>

          {/* Card 7 */}
          <div className="landing-feature-card">
            <div className="feature-icon bg-teal-500/15 text-teal-400">
              <Users className="w-6 h-6" />
            </div>
            <h3>Emergency Contacts</h3>
            <p>
              Manage verified emergency contacts with priority tiers (1, 2, 3), automated dispatch
              preferences, and instant direct dial.
            </p>
          </div>

          {/* Card 8 */}
          <div className="landing-feature-card">
            <div className="feature-icon bg-emerald-500/15 text-emerald-400">
              <Activity className="w-6 h-6" />
            </div>
            <h3>Risk Analysis Engine</h3>
            <p>
              Transparent, explainable 0–100 composite score highlighting exactly why risk is elevated
              (e.g., +18 Heat, +12 AQI, +8 Activity).
            </p>
          </div>
        </div>
      </section>

      {/* 4. HOW IT WORKS FLOW */}
      <section className="landing-section">
        <div className="section-tag">PIPELINE</div>
        <h2 className="section-title">How LifeShield Works</h2>
        <div className="landing-flow-container">
          <div className="landing-flow-step">
            <div className="flow-step-number">01</div>
            <h4>Health & Environmental Data</h4>
            <p>Wearables, Health Connect, and Open-Meteo stream live vital and atmospheric telemetry.</p>
          </div>
          <div className="flow-arrow">→</div>
          <div className="landing-flow-step">
            <div className="flow-step-number">02</div>
            <h4>Transparent Risk Engine</h4>
            <p>Mathematical scoring compares vitals against personal baselines and outdoor weather risks.</p>
          </div>
          <div className="flow-arrow">→</div>
          <div className="landing-flow-step">
            <div className="flow-step-number">03</div>
            <h4>Personalized Guidance</h4>
            <p>Actionable safety protocols, voice reminders, and AI advice inform your daily routine.</p>
          </div>
          <div className="flow-arrow">→</div>
          <div className="landing-flow-step">
            <div className="flow-step-number">04</div>
            <h4>Emergency Protection</h4>
            <p>Automatic fall detection and manual SOS notify priority contacts and display nearby medical centers.</p>
          </div>
        </div>
      </section>

      {/* 5. WHY LIFESHIELD? */}
      <section className="landing-section">
        <div className="section-tag">THE PROBLEM WE SOLVE</div>
        <h2 className="section-title">Why LifeShield?</h2>
        <div className="landing-why-grid">
          <div className="landing-why-card">
            <h4>Traditional Health Apps</h4>
            <ul className="why-list cross">
              <li>Isolate fitness data without environmental context</li>
              <li>Fail to warn when heat or pollution aggravates cardiac strain</li>
              <li>Lack integrated emergency sirens and fall dispatch workflows</li>
              <li>Frequently present opaque, unexplainable health scores</li>
            </ul>
          </div>
          <div className="landing-why-card highlight">
            <h4>The LifeShield Advantage</h4>
            <ul className="why-list check">
              <li>Unifies personal vital telemetry with outdoor atmospheric hazards</li>
              <li>Transparent risk engine explains every point (+18 Heat, +12 AQI)</li>
              <li>Built-in emergency countdowns, sirens, and multi-channel dispatch</li>
              <li>100% strict adherence to safety disclaimers with zero fake diagnoses</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 6. MANDATORY CLINICAL SAFETY NOTICE */}
      <section className="landing-safety-notice">
        <div className="flex items-start gap-4">
          <Info className="w-6 h-6 text-amber-400 shrink-0 mt-1" />
          <div>
            <h3 className="text-amber-300 font-bold text-base mb-1">Clinical Safety & Medical Disclaimer</h3>
            <p className="text-slate-300 text-sm leading-relaxed">
              LifeShield is a personal health awareness, environmental hazard monitoring, and emergency protection
              platform. <strong>It is NOT a medical diagnosis system or a substitute for professional medical care,
              clinical examination, or emergency services.</strong> If you or someone around you is experiencing
              a life-threatening medical emergency, call your regional emergency number (such as 112, 911, or 108) immediately.
            </p>
          </div>
        </div>
      </section>

      {/* 7. FOOTER */}
      <footer className="landing-footer">
        <div className="landing-footer-grid">
          <div className="footer-col">
            <div className="footer-brand">
              <span className="brand-icon">♥</span>
              <span className="brand-name">LifeShield</span>
            </div>
            <p className="footer-bio">
              Empowering personal safety and disaster resilience through transparent health telemetry and edge AI.
            </p>
          </div>

          <div className="footer-col">
            <h5>Navigation</h5>
            <ul>
              <li><button type="button" onClick={onExploreDashboard}>Dashboard</button></li>
              <li><button type="button" onClick={onEmergencyProtection}>Emergency Center</button></li>
              <li><button type="button" onClick={onGetStarted}>Account Access</button></li>
            </ul>
          </div>

          <div className="footer-col">
            <h5>Technology</h5>
            <ul>
              <li><a href="https://open-meteo.com" target="_blank" rel="noreferrer">Open-Meteo Weather</a></li>
              <li><a href="https://developer.android.com/health-and-fitness/guides/health-connect" target="_blank" rel="noreferrer">Android Health Connect</a></li>
              <li><a href="https://www.twilio.com" target="_blank" rel="noreferrer">Twilio Telephony</a></li>
            </ul>
          </div>

          <div className="footer-col">
            <h5>Trust & Legal</h5>
            <ul>
              <li><button type="button" onClick={onOpenDisclaimer}>Medical Disclaimer</button></li>
              <li><button type="button" onClick={onOpenPrivacy}>Privacy Policy</button></li>
              <li><button type="button" onClick={onOpenDisclaimer}>Terms of Service</button></li>
            </ul>
          </div>
        </div>

        <div className="landing-footer-bottom">
          <div>© {new Date().getFullYear()} LifeShield Platform. All rights reserved.</div>
          <div className="footer-source-note">Strictly for health awareness & safety coordination.</div>
        </div>
      </footer>
    </div>
  );
};
