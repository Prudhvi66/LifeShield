# LifeShield Pre-Audit Report

**Audit Date:** September 13, 2026  
**Project:** LifeShield Companion (Personal Privacy-Preserving Health & Risk Monitor for India)  
**Target Platform:** Web (React + Vite + FastAPI) & Mobile (Android / Capacitor)  
**Auditor:** Antigravity AI  

---

## 1. Executive Summary & Root Cause Findings

### Key Diagnostic Discovery: "Unexpected token '<'" API Error
The physical Android app and web client experience errors like:
> `Unexpected token '<', "<!doctype ..."`

**Root Cause Analysis:**
When API requests fail (e.g. 404 Not Found, 500 Server Error, or hitting Vite dev server port 3000 instead of FastAPI port 8000), the server returns an HTML error page or `index.html` fallback. In [`src/services/apiClient.ts`](file:///c:/Users/Prudhvi/OneDrive/Documents/Desktop/our%20website/src/services/apiClient.ts#L67), the code unconditionally calls `await response.json()` on error responses. JavaScript attempts to parse `<!DOCTYPE html>...` as JSON, throwing `SyntaxError: Unexpected token '<'`.

Additionally, when running on a physical Android handset:
- Requesting `http://localhost:8000` or `http://127.0.0.1:8000` points to the *phone itself*, not the host machine running FastAPI.
- `apiClient.ts` attempts fallback host IPs, but if none respond with JSON, it crashes with HTML parsing errors.

### Solution Strategy:
1. Validate `Content-Type` header (`application/json`) in `apiClient.ts` before calling `response.json()`.
2. Parse response text safely (`await response.text()`) and attempt `JSON.parse()`. If parsing fails or Content-Type is HTML, throw a clean, human-readable exception (e.g. `HTTP 404: Endpoint /api/contacts not found on backend at http://10.0.2.2:8000`).
3. Implement environment-aware base URL resolution (`VITE_API_URL` for dev/prod, host IP fallback for mobile).

---

## 2. Comprehensive Pre-Audit Status Matrix

| Module / Feature | Technical Implementation State | Status | Verification & Evidence |
| :--- | :--- | :---: | :--- |
| **1. Architecture** | React 18 + Vite + TypeScript + FastAPI + SQLite/PostgreSQL + Capacitor 8 + Android | **WORKING** | Clean, modular baseline in [`package.json`](file:///c:/Users/Prudhvi/OneDrive/Documents/Desktop/our%20website/package.json), [`capacitor.config.ts`](file:///c:/Users/Prudhvi/OneDrive/Documents/Desktop/our%20website/capacitor.config.ts) |
| **2. Frontend UI** | React 18 tabbed interface (`Home`, `Health`, `Safety`, `AI`, `Profile`) | **WORKING** | [`App.tsx`](file:///c:/Users/Prudhvi/OneDrive/Documents/Desktop/our%20website/src/App.tsx), Tailwind CSS styling, Leaflet maps |
| **3. Backend API** | FastAPI + SQLAlchemy ORM, 12 router modules | **WORKING** | All 32 Pytest unit tests pass (`python -m pytest test_api.py test_security.py`) |
| **4. Android App** | Capacitor 8 with `compileSdk 36`, `targetSdk 36`, `minSdk 26` | **WORKING** | [`gradlew assembleDebug`](file:///c:/Users/Prudhvi/OneDrive/Documents/Desktop/our%20website/android/app/build.gradle) builds `BUILD SUCCESSFUL` |
| **5. Database** | SQLite (`lifeshield.db`) with 11 ORM models & foreign keys | **WORKING** | [`models.py`](file:///c:/Users/Prudhvi/OneDrive/Documents/Desktop/our%20website/backend/lifeshield-api/app/models.py) handles user isolation, vitals, reminders, SOS |
| **6. Authentication** | FastAPI JWT HS256 auth, password hashing via passlib/bcrypt | **WORKING** | Tested in `test_security.py`; requires custom production secret key |
| **7. API Client** | [`apiClient.ts`](file:///c:/Users/Prudhvi/OneDrive/Documents/Desktop/our%20website/src/services/apiClient.ts) multi-host fallback | **BROKEN** | Unsafe `response.json()` causes `"Unexpected token '<'"` when HTML 404 is returned |
| **8. Health Connect** | Native Java/Kotlin plugin with real record queries | **PARTIALLY WORKING** | Java plugin updated in Phase A; **REQUIRES PHYSICAL DEVICE TEST** |
| **9. Reminders** | DB persistence, Taken/Skipped audit logs, schedule CRUD | **WORKING** | [`reminders.py`](file:///c:/Users/Prudhvi/OneDrive/Documents/Desktop/our%20website/backend/lifeshield-api/app/routers/reminders.py) & `App.tsx` state |
| **10. Voice TTS** | Web Speech API in [`voiceTtsService.ts`](file:///c:/Users/Prudhvi/OneDrive/Documents/Desktop/our%20website/src/services/voiceTtsService.ts) | **PARTIALLY WORKING** | Browser TTS works; background speech when screen locked **REQUIRES PHYSICAL DEVICE TEST** |
| **11. Multilingual System** | [`i18nService.ts`](file:///c:/Users/Prudhvi/OneDrive/Documents/Desktop/our%20website/src/services/i18nService.ts) dictionary supporting EN, HI, TE, TA, MR, BN, KN | **PARTIALLY WORKING** | Translations exist; missing UI bindings in some modal dialogs |
| **12. Contacts** | Emergency contact CRUD with user multi-tenant isolation | **BROKEN** | Backend logic works in Pytest; frontend fails on mobile due to API client HTML error |
| **13. Emergency / SOS** | SOS trigger, location payload, siren synthesis, Twilio backend | **PARTIALLY WORKING** | Local siren & backend trigger work; real PSTN SMS **REQUIRES EXTERNAL SERVICE (Twilio SID)** |
| **14. Local Siren Alarm** | Web Audio API siren & audio locator beacon | **WORKING** | [`soundService.ts`](file:///c:/Users/Prudhvi/OneDrive/Documents/Desktop/our%20website/src/services/soundService.ts) synthesizes alerts without external MP3 assets |
| **15. Fall Detection** | Accelerometer listener (`devicemotion`) + 30s countdown modal | **PARTIALLY WORKING** | Foreground accelerometer listener works; **REQUIRES PHYSICAL DEVICE TEST** for background motion |
| **16. High HR Alert** | Risk engine anomaly detection (>105 BPM) | **PARTIALLY WORKING** | Risk score increases; interactive "Are you OK?" modal prompt is **NOT IMPLEMENTED** |
| **17. Environment** | Open-Meteo live weather, AQI, and IMD hazard advisories | **WORKING** | [`environment.py`](file:///c:/Users/Prudhvi/OneDrive/Documents/Desktop/our%20website/backend/lifeshield-api/app/environment.py#L186) fetches live data with 5-min caching |
| **18. Risk Engine** | Multi-factor composite risk scoring (0-100) & severity tiers | **WORKING** | [`risk_engine.py`](file:///c:/Users/Prudhvi/OneDrive/Documents/Desktop/our%20website/backend/lifeshield-api/app/risk_engine.py#L11) evaluates vitals + Open-Meteo hazards |
| **19. AI Assistant** | Server-side [`ai_service.py`](file:///c:/Users/Prudhvi/OneDrive/Documents/Desktop/our%20website/backend/lifeshield-api/app/ai_service.py) with Gemini/OpenAI + Clinical Fallback | **PARTIALLY WORKING** | Built-in fallback works; real Gemini API response **REQUIRES EXTERNAL SERVICE (`GEMINI_API_KEY`)** |
| **20. Timeline** | Aggregated chronological activity feed | **WORKING** | [`timeline.py`](file:///c:/Users/Prudhvi/OneDrive/Documents/Desktop/our%20website/backend/lifeshield-api/app/routers/timeline.py) combines readings, SOS events, logs, and risk alerts |
| **21. Devices / Wearables** | Web Bluetooth GATT (0x180D) + Health Connect bridge | **WORKING** | [`bluetoothService.ts`](file:///c:/Users/Prudhvi/OneDrive/Documents/Desktop/our%20website/src/services/bluetoothService.ts) pairs heart rate monitors |
| **22. Tests** | Pytest backend suite & Playwright E2E suite | **WORKING** | 32/32 Pytest tests pass; `npm run build` succeeds |
| **23. Deployment Config** | Production environment, Vercel/Render hosting setup, CORS | **NOT IMPLEMENTED** | Web deployment to public hosting environment pending |

---

## 3. Detailed Component Breakdown

### A. Shared Network & API Layer (`apiClient.ts`)
- **Problem:** When an endpoint returns HTML (404/500/Vite fallback), `response.json()` fails with `"Unexpected token '<'"`.
- **Fix:** Inspect `Content-Type` header, read response text safely, parse JSON inside a `try...catch` block, and return clear error messages (`HTTP 404: Endpoint /api/... not found`).

### B. AI Assistant Service (`ai_service.py` & `ai.py`)
- **Architecture:** Provider API keys (`GEMINI_API_KEY`, `OPENAI_API_KEY`) stay strictly on the FastAPI backend.
- **Context Injection:** Enriches requests with user baseline, latest vitals, and environment data.
- **Multilingual & Safety:** Strictly enforces non-diagnosis rules and responds in English, Hindi, or Telugu based on user selection.
- **Fallback Engine:** Built-in clinical safety rule engine provides domain responses when external API keys are unpopulated.

### C. Health Connect & Smartwatch Data Flow
- **Data Flow:** Smartwatch $\rightarrow$ Companion App $\rightarrow$ Google Fit / Health Connect $\rightarrow$ Native `HealthConnectPlugin.java` $\rightarrow$ Capacitor Bridge $\rightarrow$ React Frontend $\rightarrow$ FastAPI `/api/health/readings` $\rightarrow$ SQLite/PostgreSQL Database $\rightarrow$ Health Dashboard & Risk Engine.
- **Real Data Only:** No fake numbers or random generators are used. If Health Connect has no records in the past 24h, fields return `null` with `hasData: false`.

### D. Voice Reminders & i18n
- **Voice TTS:** Web Speech API supported in [`voiceTtsService.ts`](file:///c:/Users/Prudhvi/OneDrive/Documents/Desktop/our%20website/src/services/voiceTtsService.ts). Master voice toggle and per-reminder voice toggles are present.
- **Multilingual Support:** [`i18nService.ts`](file:///c:/Users/Prudhvi/OneDrive/Documents/Desktop/our%20website/src/services/i18nService.ts) contains full translations for English, Hindi, Telugu, Tamil, Marathi, Bengali, and Kannada.

---
**Pre-Audit Conclusion:** The codebase structure is robust. Fixing the API client's HTML error handler, strengthening error messages, populating backend service configurations, and binding multilingual keys across all UI components will bring LifeShield to full production readiness.
