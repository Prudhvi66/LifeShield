/**
 * LifeShield API Client.
 * Handles authenticated network communication with the FastAPI backend.
 * Configured via VITE_API_URL environment variable (default: http://localhost:8000).
 */

const CUSTOM_URL_KEY = 'lifeshield_custom_api_url';
const ENV_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/+$/, '');
const STORED_CUSTOM_URL = localStorage.getItem(CUSTOM_URL_KEY);
let activeBaseUrl = (STORED_CUSTOM_URL || ENV_URL).replace(/\/+$/, '');
const TOKEN_KEY = 'lifeshield_auth_token';
const USER_KEY = 'lifeshield_user';

// Allow additional fallback URLs to be configured via environment variable
const FALLBACK_URLS_KEY = 'lifeshield_fallback_urls';
let additionalFallbackUrls: string[] = [];
try {
  const stored = localStorage.getItem(FALLBACK_URLS_KEY);
  if (stored) additionalFallbackUrls = JSON.parse(stored);
} catch {
  // ignore parse errors
}

export function isJwtExpired(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (!payload || !payload.exp) return false;
    // Expired if current epoch is past payload.exp (with 15s leeway)
    return Math.floor(Date.now() / 1000) >= payload.exp - 15;
  } catch {
    return false;
  }
}

const REGION_COORDINATES: Record<string, { lat: number; lon: number; name: string }> = {
  hyderabad: { lat: 17.3850, lon: 78.4867, name: 'Hyderabad' },
  delhi: { lat: 28.6139, lon: 77.2090, name: 'Delhi' },
  mumbai: { lat: 19.0760, lon: 72.8777, name: 'Mumbai' },
  bengaluru: { lat: 12.9716, lon: 77.5946, name: 'Bengaluru' },
  chennai: { lat: 13.0827, lon: 80.2707, name: 'Chennai' },
  kolkata: { lat: 22.5726, lon: 88.3639, name: 'Kolkata' },
  visakhapatnam: { lat: 17.6868, lon: 83.2185, name: 'Visakhapatnam' },
  vijayawada: { lat: 16.5062, lon: 80.6480, name: 'Vijayawada' },
  pune: { lat: 18.5204, lon: 73.8567, name: 'Pune' },
};

function getWeatherCondition(code: number): string {
  if (code === 0) return 'Clear sky';
  if (code <= 3) return 'Partly cloudy';
  if (code <= 48) return 'Foggy';
  if (code <= 55) return 'Drizzle';
  if (code <= 65) return 'Rain';
  if (code <= 75) return 'Snow';
  if (code <= 82) return 'Rain showers';
  if (code >= 95) return 'Thunderstorm';
  return 'Clear';
}

function getAqiLevel(aqi: number): string {
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Unhealthy for Sensitive Groups';
  if (aqi <= 200) return 'Unhealthy';
  if (aqi <= 300) return 'Very Unhealthy';
  return 'Hazardous';
}

async function fetchLiveOpenMeteoFallback(lat?: number, lon?: number, region?: string): Promise<any> {
  const normKey = (region || 'Hyderabad').toLowerCase().trim();
  const matched = REGION_COORDINATES[normKey] || REGION_COORDINATES['hyderabad'];
  const targetLat = lat ?? matched.lat;
  const targetLon = lon ?? matched.lon;
  const regionName = region || matched.name;

  try {
    const [weatherRes, aqiRes] = await Promise.all([
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${targetLat}&longitude=${targetLon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,uv_index`),
      fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${targetLat}&longitude=${targetLon}&current=us_aqi,pm2_5,pm10`),
    ]);

    const weatherData = weatherRes.ok ? await weatherRes.json() : null;
    const aqiData = aqiRes.ok ? await aqiRes.json() : null;

    const currentW = weatherData?.current || {};
    const currentA = aqiData?.current || {};

    const temp = currentW.temperature_2m ?? 30.0;
    const humidity = currentW.relative_humidity_2m ?? 50.0;
    const heatIndex = currentW.apparent_temperature ?? temp;
    const windSpeed = currentW.wind_speed_10m ?? 12.0;
    const uvIndex = currentW.uv_index ?? 5.0;
    const weatherCode = currentW.weather_code ?? 0;
    const aqi = currentA.us_aqi ?? 75;
    const pm25 = currentA.pm2_5 ?? 22.0;
    const pm10 = currentA.pm10 ?? 45.0;

    const weatherCondition = getWeatherCondition(weatherCode);
    const aqiLevel = getAqiLevel(aqi);

    const advisories: any[] = [];
    if (heatIndex >= 38) {
      advisories.push({
        id: `heat-${Date.now()}`,
        category: 'heat',
        title: 'High Heat Index Warning',
        description: `Ambient heat index has reached ${Math.round(heatIndex)}°C. Stay hydrated and limit outdoor exertion.`,
        agency: 'Open-Meteo Live / IMD',
        severity: 'warning',
      });
    }
    if (aqi > 100) {
      advisories.push({
        id: `aqi-${Date.now()}`,
        category: 'air_quality',
        title: `Air Quality Advisory (${aqiLevel})`,
        description: `AQI measured at ${Math.round(aqi)}. Sensitive individuals and elderly should take precautions outdoors.`,
        agency: 'Open-Meteo Live / CPCB',
        severity: 'advisory',
      });
    }

    return {
      region_name: regionName,
      temperature_c: Math.round(temp * 10) / 10,
      humidity_percent: Math.round(humidity),
      weather_condition: weatherCondition,
      heat_index_c: Math.round(heatIndex * 10) / 10,
      aqi: Math.round(aqi),
      aqi_level: aqiLevel,
      pm2_5: Math.round(pm25 * 10) / 10,
      pm10: Math.round(pm10 * 10) / 10,
      wind_speed_kmh: Math.round(windSpeed * 10) / 10,
      uv_index: Math.round(uvIndex * 10) / 10,
      flood_risk_level: 'LOW',
      advisories,
      source: 'Open-Meteo Sensor Live Feed',
    };
  } catch (directErr) {
    console.warn('[LifeShield Environment] Direct Open-Meteo fallback failed:', directErr);
    throw directErr;
  }
}

class ApiClient {
  private token: string | null = null;
  private onAuthFailure: (() => void) | null = null;

  constructor() {
    this.token = localStorage.getItem(TOKEN_KEY);
    if (this.token && isJwtExpired(this.token)) {
      console.warn('[LifeShield Auth] Stored token has expired — clearing on initialization');
      this.clearToken('stored_token_expired');
    }
  }

  /**
   * Register a callback that fires when the token is invalid (401).
   * Used by App.tsx to clear user state without circular imports.
   */
  public setAuthFailureHandler(handler: (() => void) | null) {
    this.onAuthFailure = handler;
  }

  public getToken(): string | null {
    return this.token;
  }

  public setToken(token: string) {
    this.token = token;
    localStorage.setItem(TOKEN_KEY, token);
  }

  public clearToken(reason: string = 'explicit') {
    console.log(`[LifeShield Auth] Session invalidated (reason: ${reason})`);
    this.token = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  // --- User persistence (survives app restarts) ---
  public getStoredUser(): any | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  public setStoredUser(user: any | null) {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_KEY);
    }
  }

  public getBaseUrl(): string {
    return activeBaseUrl;
  }

  public setCustomApiUrl(url: string) {
    const cleaned = url.trim().replace(/\/+$/, '');
    if (cleaned) {
      localStorage.setItem(CUSTOM_URL_KEY, cleaned);
      activeBaseUrl = cleaned;
    } else {
      localStorage.removeItem(CUSTOM_URL_KEY);
      activeBaseUrl = ENV_URL;
    }
  }

  public addFallbackUrl(url: string) {
    const cleaned = url.trim().replace(/\/+$/, '');
    if (cleaned && !additionalFallbackUrls.includes(cleaned)) {
      additionalFallbackUrls.push(cleaned);
      localStorage.setItem(FALLBACK_URLS_KEY, JSON.stringify(additionalFallbackUrls));
    }
  }

  public clearFallbackUrls() {
    additionalFallbackUrls = [];
    localStorage.removeItem(FALLBACK_URLS_KEY);
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const ep = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const storedCustom = localStorage.getItem(CUSTOM_URL_KEY);

    // For AI endpoints, prevent duplicate fan-out across multiple URLs if activeBaseUrl is already known
    const candidateUrls = (ep.startsWith('/api/ai') && activeBaseUrl)
      ? [activeBaseUrl]
      : [
          storedCustom,
          activeBaseUrl,
          ENV_URL,
          ...additionalFallbackUrls,
          'http://localhost:8000',
          'http://127.0.0.1:8000',
        ];

    const urlsToTry = Array.from(new Set(candidateUrls.filter(Boolean) as string[])).map(u => u.replace(/\/+$/, ''));
    let lastError: any = null;
    
    for (const baseUrl of urlsToTry) {
      const url = `${baseUrl}${ep}`;
      const reqTimeout = ep.startsWith('/api/ai') ? 30000 : 6000;
      const controller = new AbortController();
      if (options.signal) {
        if (options.signal.aborted) {
          controller.abort();
        } else {
          options.signal.addEventListener('abort', () => controller.abort(), { once: true });
        }
      }
      const timeoutId = setTimeout(() => controller.abort(), reqTimeout);

      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
          headers,
        });

        clearTimeout(timeoutId);

        const rawText = await response.text();

        let parsedJson: any = null;
        let isJson = false;
        if (rawText && rawText.trim()) {
          try {
            parsedJson = JSON.parse(rawText);
            isJson = true;
          } catch {
            isJson = false;
          }
        }

        if (!response.ok) {
          let errorDetail = `HTTP ${response.status}: ${response.statusText}`;
          if (isJson && parsedJson && parsedJson.detail) {
            errorDetail = typeof parsedJson.detail === 'string' ? parsedJson.detail : JSON.stringify(parsedJson.detail);
          } else if (rawText && (rawText.includes('<!DOCTYPE') || rawText.includes('<html'))) {
            errorDetail = `Server returned HTTP ${response.status} HTML response. FastAPI backend may be offline or misconfigured at ${baseUrl}.`;
          } else if (rawText) {
            errorDetail = `HTTP ${response.status}: ${rawText.slice(0, 150)}`;
          }

          // 401 on an authenticated request: only invalidate the session if the token
          // is genuinely expired or if the core /api/auth/me verification fails.
          // Do not wipe sessions for harmless secondary endpoint hiccups.
          if (response.status === 401 && this.token && !ep.includes('/api/auth/login') && !ep.includes('/api/auth/register')) {
            const tokenExpired = isJwtExpired(this.token);
            const isAuthMe = ep.includes('/api/auth/me');

            if (isAuthMe || tokenExpired) {
              const reason = tokenExpired ? 'token_expired_claims' : 'auth_me_rejected';
              console.warn(`[LifeShield Auth] 401 Unauthorized on ${ep} (reason: ${reason}) — clearing invalid session`);
              this.clearToken(reason);
              if (this.onAuthFailure) {
                this.onAuthFailure();
              }
            } else {
              console.warn(`[LifeShield Auth] 401 on secondary endpoint ${ep}, but token exp is valid. Preserving session.`);
            }
          }

          const httpError: any = new Error(errorDetail);
          httpError.status = response.status;
          httpError.statusText = response.statusText;
          httpError.detail = (parsedJson && parsedJson.detail) ? parsedJson.detail : errorDetail;
          throw httpError;
        }

        // If status is 200 OK but response is HTML (e.g. Vite SPA fallback index.html), this is NOT the FastAPI backend
        if (!isJson) {
          throw new Error(`Invalid API response from ${url}: expected JSON but received HTML or plain text.`);
        }

        // Successfully reached backend and parsed valid JSON
        if (activeBaseUrl !== baseUrl) {
          activeBaseUrl = baseUrl;
          console.log(`[LifeShield API] Connected via ${activeBaseUrl}`);
        }

        return parsedJson as T;
      } catch (err: any) {
        clearTimeout(timeoutId);
        lastError = err;
        // For AI endpoints, do not retry other candidate URLs on network/abort failure to avoid duplicate requests
        if (ep.startsWith('/api/ai')) {
          throw err;
        }

        // If network failure, timeout, or hitting non-backend HTML server, try next URL candidate
        if (err.name === 'AbortError' || (err.message && (
          err.message.includes('Failed to fetch') ||
          err.message.includes('NetworkError') ||
          err.message.includes('expected JSON but received HTML') ||
          err.message.includes('aborted')
        ))) {
          continue;
        }
        // If server responded with an actual HTTP error code (e.g. 401, 404, 422), do not retry other servers
        throw err;
      }
    }

    console.warn(`[LifeShield API Error] ${options.method || 'GET'} ${ep}:`, lastError?.message);
    throw lastError || new Error('LifeShield backend unreachable. Please ensure FastAPI backend is running on port 8000.');
  }

  /**
   * Probes public backend /health endpoint without requiring authentication.
   */
  public async checkHealth(): Promise<{ status: string; service: string; version: string }> {
    return this.request<{ status: string; service: string; version: string }>('/health');
  }

  // --- Authentication & User ---
  public auth = {
    register: (payload: { email: string; password: string; full_name: string; primary_language?: string; age?: number; blood_group?: string }) =>
      this.request<{ access_token: string; token_type: string; user: any }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    login: (payload: { email: string; password: string }) =>
      this.request<{ access_token: string; token_type: string; user: any }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    getMe: () => this.request<any>('/api/auth/me'),
    changePassword: (payload: { old_password: string; new_password: string }) =>
      this.request<any>('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  };

  // --- Profile & Baseline ---
  public profile = {
    get: () => this.request<any>('/api/profile'),
    update: (payload: any) =>
      this.request<any>('/api/profile', {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    getBaseline: () => this.request<any>('/api/profile/baseline'),
    updateBaseline: (payload: any) =>
      this.request<any>('/api/profile/baseline', {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    getVoicePreferences: () => this.request<any>('/api/profile/voice'),
    updateVoicePreferences: (payload: any) =>
      this.request<any>('/api/profile/voice', {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
  };

  // --- Health Telemetry ---
  public health = {
    ingestReading: (payload: {
      device_id?: string;
      heart_rate?: number;
      spo2?: number;
      steps?: number;
      sleep_hours?: number;
      body_temperature?: number;
      systolic_bp?: number;
      diastolic_bp?: number;
      hydration_index?: number;
      activity_level?: string;
      source?: string;
      raw_data?: any;
    }) =>
      this.request<any>('/api/health/readings', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    getReadings: (limit = 50) => this.request<any[]>(`/api/health/readings?limit=${limit}`),
    getSummary: () => this.request<any>('/api/health/summary'),
    getTrends: (hours = 24) => this.request<any[]>(`/api/health/trends?hours=${hours}`),
  };

  // --- Devices & Wearables ---
  public devices = {
    register: (payload: { device_name: string; device_type?: string; manufacturer?: string; battery_level?: number }) =>
      this.request<any>('/api/devices', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    list: () => this.request<any[]>('/api/devices'),
    delete: (deviceId: string) =>
      this.request<any>(`/api/devices/${deviceId}`, {
        method: 'DELETE',
      }),
  };

  // --- Reminders & Routine ---
  public reminders = {
    create: (payload: {
      title: string;
      reminder_type?: string;
      time: string;
      dosage?: string;
      repeat?: string;
      voice_enabled?: boolean;
      language?: string;
      is_active?: boolean;
    }) =>
      this.request<any>('/api/reminders', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    list: () => this.request<any[]>('/api/reminders'),
    update: (id: string, payload: any) =>
      this.request<any>(`/api/reminders/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    delete: (id: string) =>
      this.request<any>(`/api/reminders/${id}`, {
        method: 'DELETE',
      }),
    logAction: (id: string, payload: { medicine_name: string; scheduled_time: string; action: 'Taken' | 'Skipped'; notes?: string }) =>
      this.request<any>(`/api/reminders/${id}/log`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    getHistory: (limit = 50) => this.request<any[]>(`/api/reminders/history?limit=${limit}`),
  };

  // --- Emergency Contacts ---
  public contacts = {
    create: (payload: { name: string; phone: string; relation?: string; priority?: number; auto_notify?: boolean; device_id?: string }) =>
      this.request<any>('/api/contacts', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    list: () => this.request<any[]>('/api/contacts'),
    update: (id: string, payload: any) =>
      this.request<any>(`/api/contacts/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    delete: (id: string) =>
      this.request<any>(`/api/contacts/${id}`, {
        method: 'DELETE',
      }),
  };

  // --- SOS & Emergency ---
  public sos = {
    trigger: (payload: {
      device_id?: string;
      lat?: number;
      lon?: number;
      location_accuracy?: number;
      location_timestamp?: string;
      address?: string;
      risk_tier?: string;
      risk_score?: number;
      contacts?: Array<{ name: string; phone: string }>;
      emergency_message?: string;
    }) =>
      this.request<any>('/api/sos', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    cancel: (payload: {
      device_id?: string;
      lat?: number;
      lon?: number;
      location_accuracy?: number;
      location_timestamp?: string;
    }) =>
      this.request<any>('/api/sos/cancel', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    triggerFall: (payload: {
      device_id?: string;
      user_name?: string;
      lat?: number;
      lon?: number;
      address?: string;
      risk_tier?: string;
      risk_score?: number;
      detected_at?: string;
      acceleration_g?: number;
      contacts?: Array<{ name: string; phone: string }>;
    }) =>
      this.request<any>('/api/emergency/fall', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    getHistory: () => this.request<any[]>('/api/sos/history'),
  };

  // --- Environment & Weather ---
  public environment = {
    get: async (params?: { lat?: number; lon?: number; region?: string }) => {
      const query = new URLSearchParams();
      if (params?.lat !== undefined) query.set('lat', String(params.lat));
      if (params?.lon !== undefined) query.set('lon', String(params.lon));
      if (params?.region) query.set('region', params.region);
      const qs = query.toString();
      try {
        return await this.request<any>(`/api/environment${qs ? '?' + qs : ''}`);
      } catch (backendErr: any) {
        console.info('[LifeShield Environment] FastAPI backend unreachable or errored, fetching live Open-Meteo feed directly:', backendErr?.message);
        return await fetchLiveOpenMeteoFallback(params?.lat, params?.lon, params?.region);
      }
    },
    getAlerts: async (params?: { lat?: number; lon?: number; region?: string }) => {
      const query = new URLSearchParams();
      if (params?.lat !== undefined) query.set('lat', String(params.lat));
      if (params?.lon !== undefined) query.set('lon', String(params.lon));
      if (params?.region) query.set('region', params.region);
      const qs = query.toString();
      try {
        return await this.request<any[]>(`/api/environment/alerts${qs ? '?' + qs : ''}`);
      } catch {
        const envData = await fetchLiveOpenMeteoFallback(params?.lat, params?.lon, params?.region).catch(() => null);
        return envData?.advisories || [];
      }
    },
  };

  // --- Risk Engine ---
  public risk = {
    calculate: (payload: {
      lat?: number;
      lon?: number;
      region_name?: string;
      heart_rate?: number;
      spo2?: number;
      body_temperature?: number;
      active_fall_alert?: boolean;
      emergency_mode?: boolean;
    }) =>
      this.request<any>('/api/risk/calculate', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    get: (params?: { lat?: number; lon?: number; region?: string; device_id?: string }) => {
      const query = new URLSearchParams();
      if (params?.lat !== undefined) query.set('lat', String(params.lat));
      if (params?.lon !== undefined) query.set('lon', String(params.lon));
      if (params?.region) query.set('region', params.region);
      if (params?.device_id) query.set('device_id', params.device_id);
      const qs = query.toString();
      return this.request<any>(`/api/risk${qs ? '?' + qs : ''}`);
    },
    getHistory: () => this.request<any[]>('/api/risk/history'),
  };

  // --- AI Assistant ---
  public ai = {
    chat: (questionOrPayload: string | { question?: string; message?: string; context?: any }, contextParam?: any) => {
      let question = '';
      let context = contextParam;

      if (typeof questionOrPayload === 'string') {
        question = questionOrPayload;
      } else if (questionOrPayload && typeof questionOrPayload === 'object') {
        question = questionOrPayload.question || questionOrPayload.message || '';
        if (questionOrPayload.context && !context) {
          context = questionOrPayload.context;
        }
      }

      // Explicitly construct request payload with "question" field (FastAPI AIChatRequest requirement)
      const bodyPayload: { question: string; context?: any } = {
        question: question.trim(),
      };
      if (context !== undefined) {
        bodyPayload.context = context;
      }

      return this.request<{ reply: string; source: string; timestamp: string; disclaimer: string }>('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify(bodyPayload),
      });
    },
  };

  // --- Timeline ---
  public timeline = {
    get: (limit = 50) => this.request<any[]>(`/api/timeline?limit=${limit}`),
  };

  // --- Emergency Dispatch Preferences ---
  public dispatch = {
    get: () => this.request<{
      id: string;
      user_id: string;
      auto_call_police: boolean;
      auto_call_ambulance: boolean;
      police_number: string;
      ambulance_number: string;
      unified_emergency_number: string;
      country: string;
      updated_at: string;
    }>('/api/dispatch'),
    update: (payload: {
      auto_call_police?: boolean;
      auto_call_ambulance?: boolean;
      police_number?: string;
      ambulance_number?: string;
      unified_emergency_number?: string;
      country?: string;
    }) =>
      this.request<any>('/api/dispatch', {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
  };
}

export const apiClient = new ApiClient();
