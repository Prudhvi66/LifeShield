/**
 * LifeShield API Client.
 * Handles authenticated network communication with the FastAPI backend.
 * Configured via VITE_API_URL environment variable (default: http://localhost:8000).
 */

const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/+$/, '');
let activeBaseUrl = BASE_URL;
const TOKEN_KEY = 'lifeshield_auth_token';

class ApiClient {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem(TOKEN_KEY);
  }

  public getToken(): string | null {
    return this.token;
  }

  public setToken(token: string) {
    this.token = token;
    localStorage.setItem(TOKEN_KEY, token);
  }

  public clearToken() {
    this.token = null;
    localStorage.removeItem(TOKEN_KEY);
  }

  public getBaseUrl(): string {
    return activeBaseUrl;
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

    // Try current activeBaseUrl first
    const urlsToTry = [activeBaseUrl];
    let lastError: any = null;
    
    for (const baseUrl of urlsToTry) {
      const url = `${baseUrl}${ep}`;
      try {
        const response = await fetch(url, {
          ...options,
          headers,
        });

        if (!response.ok) {
          let errorDetail = `HTTP ${response.status}: ${response.statusText}`;
          try {
            const errJson = await response.json();
            if (errJson && errJson.detail) {
              errorDetail = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
            }
          } catch {
            // ignore non-json error responses
          }
          throw new Error(errorDetail);
        }

        // Successfully reached backend, remember working base URL
        if (activeBaseUrl !== baseUrl) {
          activeBaseUrl = baseUrl;
          console.log(`[LifeShield API] Connected via ${activeBaseUrl}`);
        }

        return (await response.json()) as T;
      } catch (err: any) {
        lastError = err;
        // If it's a network failure (Failed to fetch), try next candidate
        if (err.message && (err.message.includes('Failed to fetch') || err.message.includes('NetworkError'))) {
          continue;
        }
        // If server responded with an actual HTTP error code (e.g. 401, 404, 422), do not retry other servers
        throw err;
      }
    }

    console.warn(`[LifeShield API Error] ${options.method || 'GET'} ${endpoint}:`, lastError?.message);
    throw lastError || new Error('Backend unreachable across all endpoints');
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
      address?: string;
      risk_tier?: string;
      risk_score?: number;
      contacts?: Array<{ name: string; phone: string }>;
    }) =>
      this.request<any>('/api/sos', {
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
    get: (params?: { lat?: number; lon?: number; region?: string }) => {
      const query = new URLSearchParams();
      if (params?.lat !== undefined) query.set('lat', String(params.lat));
      if (params?.lon !== undefined) query.set('lon', String(params.lon));
      if (params?.region) query.set('region', params.region);
      const qs = query.toString();
      return this.request<any>(`/api/environment${qs ? '?' + qs : ''}`);
    },
    getAlerts: (params?: { lat?: number; lon?: number; region?: string }) => {
      const query = new URLSearchParams();
      if (params?.lat !== undefined) query.set('lat', String(params.lat));
      if (params?.lon !== undefined) query.set('lon', String(params.lon));
      if (params?.region) query.set('region', params.region);
      const qs = query.toString();
      return this.request<any[]>(`/api/environment/alerts${qs ? '?' + qs : ''}`);
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
    chat: (question: string, context?: any) =>
      this.request<{ reply: string; source: string; timestamp: string; disclaimer: string }>('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ question, context }),
      }),
  };

  // --- Timeline ---
  public timeline = {
    get: (limit = 50) => this.request<any[]>(`/api/timeline?limit=${limit}`),
  };
}

export const apiClient = new ApiClient();
