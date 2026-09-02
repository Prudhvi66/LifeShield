# LifeShield – AI-Powered Personal Health & Disaster Safety Companion

> **"Your Health. Your Safety. Always Protected."**

LifeShield is a privacy-first, offline-capable AI health & safety companion designed for India. It continuously monitors physiological vitals (heart rate, SpO2, body temperature, hydration, fatigue) and environmental conditions (heat index, wet-bulb temperature, AQI particulate levels) using smartphone/wearable sensors and runs on-device Edge AI to detect anomalies before they become critical emergencies.

---

## 🌟 Key Features

1. **Continuous Health Monitoring & Telemetry**:
   - Live Canvas ECG waveform animation with pulse frequency variation.
   - Real-time SpO2 oxygen saturation bar and hypoxia detector.
   - Core body temperature tracking with hyperthermia warnings.
   - Continuous hydration index and rest fatigue recovery tracking.

2. **Personalized Health Baseline**:
   - Rather than relying on generic population statistics, Edge AI learns your normal resting heart rate, SpO2 floor, temperature, and activity patterns over time.
   - Calculates personalized deviations (Z-score anomaly detection) to detect issues early.

3. **Multi-Signal Fall Detection Pipeline & Confirmation Workflow**:
   - 3-stage validation pipeline: acceleration spike ($> 3.0g$), angular orientation tilt ($> 60^\circ$), and subsequent inactivity/stillness window.
   - **Critical confirmation workflow**: Triggers a full-screen alert with a **30-second circular countdown timer**, loud synthesized Web Audio siren, and vibration.
   - If the user presses `[ I'M OK ]`, the alert is safely cancelled and logged locally.
   - If the user presses `[ NEED HELP ]` or does not respond before the timer expires, the app automatically transitions to **Emergency Mode**.

4. **India Emergency Response System**:
   - Pre-configured official emergency numbers for India:
     - **112** – Unified National Emergency Response Support System (ERSS)
     - **108** – Emergency Medical Service & Ambulance (EMRI)
     - **100** – Police Control Room
     - **101** – Fire & Rescue
     - **1070** – National Disaster Management Authority (NDMA)
   - One-tap calling with safety confirmation modals.
   - Interactive Leaflet OpenStreetMap showing live user location, accuracy radius, and nearest medical centers.
   - Auto-generated emergency dispatch messages with live GPS coordinates, Google Maps pin, and real-time vitals snapshot.
   - 1-click **SMS** (`sms:?body=...`) and **WhatsApp** (`wa.me/?text=...`) sharing links.

5. **Heat Wave Protection & Wet-Bulb Monitoring**:
   - Calculates apparent Heat Index (Steadman formula) and estimated Wet-Bulb temperature.
   - Dynamic heat risk categories: `LOW`, `MODERATE`, `HIGH`, and `CRITICAL`.
   - Actionable guidelines for outdoor workers, hydration reminders, and cooling breaks.

6. **Air Pollution & Respiratory Safety**:
   - Real-time AQI breakdown (PM2.5, PM10) based on CPCB standards.
   - Correlates high pollution with SpO2 drops to flag respiratory hypoxia risks.

7. **NDMA / IMD Disaster Safety Section**:
   - Displays official warnings for Heat Waves (Red Alert), Cyclones, Floods, and Severe Air Quality with actionable SOP safety guides.

8. **100% On-Device / Offline Edge AI**:
   - All AI inference and biometric processing runs locally on the device.
   - Full functionality during internet outages, natural disasters, and rural network congestion.
   - Zero advertising SDKs, zero telemetry trackers.
   - One-click encrypted JSON health data export and secure data purge.

9. **Multi-Language Accessibility for India**:
   - Supports **English, Hindi (हिंदी), Telugu (తెలుగు), Tamil (தமிழ்), Marathi (मराठी), Bengali (বাংলা), and Kannada (ಕನ್ನಡ)**.

10. **Interactive Demo & Simulation Suite**:
    - Floating hackathon testbench with single-click preset triggers:
      - `Simulate Fall & 30s Countdown`
      - `Simulate Heat Stress (44°C)`
      - `Simulate Low SpO2 Hypoxia (87%)`
      - `Simulate Resting Tachycardia (138 BPM)`
      - `Simulate IMD / NDMA Disaster Red Alert`
      - `Run Full Demo Flow` (Heat Stress → Fall → 30s Countdown → Auto 112 Dispatch)

---

## 🛠️ Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS (with accessible high-contrast dark theme and animations)
- **Icons**: Lucide React
- **Interactive Maps**: Leaflet.js + OpenStreetMap / CartoDB tiles
- **Audio & Haptics**: Web Audio API synthesizer (offline emergency sirens, SOS Morse code beacon, countdown beeps)
- **State Management**: React Context API with LocalStorage / IndexedDB caching
- **PWA**: Service Worker & Web App Manifest for offline installation

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or pnpm

### Installation & Running

```bash
# 1. Install dependencies
npm install

# 2. Start Vite development server
npm run dev

# 3. Build for production
npm run build
```

Open your browser at `http://localhost:3000` to interact with LifeShield.

---

## 📱 Hardware & Permission Notes

| Feature | Browser / Prototype Mode | Mobile Hardware / Native App Mode |
|---|---|---|
| **Fall Detection** | Simulated via Demo Toolbar & motion sensor event listeners | `DeviceMotionEvent` (Accelerometer & Gyroscope) |
| **Emergency Sirens** | Web Audio API synthesizer | System audio & high-decibel speaker output |
| **Geolocation** | Browser Geolocation API + Indian City reference | High-precision GPS receiver |
| **Emergency Dialing** | `tel:` URI intent link | OS Telephony / Dialer app integration |
| **SMS / WhatsApp** | `sms:` & `wa.me` intent links | Native background SMS API (when permitted) |
| **Health Telemetry** | Simulated realistic dynamic stream + scenario presets | BLE / Companion Smartwatch SDK |

---

## ⚖️ Safety & Medical Disclaimer

> **LifeShield is an assistive safety and monitoring companion tool. It does not provide medical diagnoses or replace professional healthcare consultations, medical examinations, or official emergency services.**
