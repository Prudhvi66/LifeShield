import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  CloudSun,
  Wind,
  ShieldAlert,
  Compass,
  Phone,
  CheckCircle,
  BookOpen,
  Waves,
  Tornado,
  CloudRain,
  Sun,
  Info,
  Pencil,
  Search,
  X,
  MapPin
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

const SAMPLE_CITIES = [
  'Gachibowli, Hyderabad, Telangana',
  'Banjara Hills, Hyderabad, Telangana',
  'Mumbai, Maharashtra',
  'Andheri, Mumbai, Maharashtra',
  'Delhi, NCT of Delhi',
  'Connaught Place, Delhi',
  'Bengaluru, Karnataka',
  'Whitefield, Bengaluru, Karnataka',
  'Chennai, Tamil Nadu',
  'Kolkata, West Bengal',
  'Pune, Maharashtra',
  'Ahmedabad, Gujarat',
  'Jaipur, Rajasthan',
  'Lucknow, Uttar Pradesh',
  'Bhopal, Madhya Pradesh',
  'Chandigarh, Punjab',
  'Visakhapatnam, Andhra Pradesh',
  'Kochi, Kerala',
];

export const EnvironmentDashboard: React.FC = () => {
  const { environment, disasterAlerts } = useApp();

  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const displayRegion = selectedRegion ?? environment.locationName;

  const filteredCities = SAMPLE_CITIES.filter((city) =>
    city.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openModal = useCallback(() => {
    setSearchQuery('');
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setSearchQuery('');
  }, []);

  const handleSelectCity = useCallback((city: string) => {
    setSelectedRegion(city);
    closeModal();
  }, [closeModal]);

  // Focus search input when modal opens
  useEffect(() => {
    if (modalOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [modalOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalOpen, closeModal]);

  const disasterCards = [
    {
      id: 'heatwave',
      title: 'HEAT WAVE (लू)',
      icon: <Sun className="w-6 h-6 text-amber-400" />,
      risk: environment.heatRiskLevel,
      riskColor: environment.heatRiskLevel === 'CRITICAL' ? 'bg-red-500/20 text-red-300 border-red-500/40' : environment.heatRiskLevel === 'HIGH' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
      condition: `Apparent Heat Index ${Math.round(environment.heatIndexC)}°C • Wet-Bulb ${environment.wetBulbTempC}°C`,
      recommendation: 'Reduce outdoor activity during peak heat (11am-4pm) and monitor hydration continuously.',
      actions: [
        'Drink ORS, lemon water, and buttermilk at regular intervals.',
        'Wear loose, light-colored cotton clothing and cover head outdoors.',
        'Halt strenuous physical manual labor in unshaded zones.'
      ]
    },
    {
      id: 'pollution',
      title: 'AIR POLLUTION (AQI)',
      icon: <Wind className="w-6 h-6 text-purple-400" />,
      risk: environment.pollutionCategory === 'SEVERE' || environment.pollutionCategory === 'VERY POOR' ? 'HIGH' : 'MODERATE',
      riskColor: environment.aqi > 200 ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
      condition: `CPCB AQI ${environment.aqi} • PM2.5: ${environment.pm25} µg/m³ • PM10: ${environment.pm10} µg/m³`,
      recommendation: 'Sensitive individuals, elderly, and children should remain indoors and use certified N95 masks when commuting.',
      actions: [
        'Avoid morning and late evening outdoor jogging or workouts.',
        'Keep inhalers and bronchodilators within reach if asthmatic.',
        'Run indoor air filtration or maintain sealed ventilation during peak smog.'
      ]
    },
    {
      id: 'cyclone',
      title: 'CYCLONE & STORM SURGE',
      icon: <Tornado className="w-6 h-6 text-sky-400" />,
      risk: 'MODERATE',
      riskColor: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
      condition: 'Coastal Storm Advisory • Wind Gusts 65-75 km/h in Bay of Bengal',
      recommendation: 'Keep emergency supplies, battery lamps, and mobile power banks charged. Follow local SDMA alerts.',
      actions: [
        'Do not venture into open coastal areas or under unstable trees.',
        'Secure loose tin sheets, antenna cables, and outdoor signage.',
        'Identify nearest government multi-purpose cyclone shelter.'
      ]
    },
    {
      id: 'flood',
      title: 'URBAN FLOOD & INUNDATION',
      icon: <Waves className="w-6 h-6 text-cyan-400" />,
      risk: 'LOW',
      riskColor: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
      condition: 'Normal Drainage • Water Reservoirs Operating at Standard Level',
      recommendation: 'Stay alert during continuous heavy downpours. Never attempt to wade or drive across submerged causeways.',
      actions: [
        'Keep essential documents and medicines in waterproof pouches.',
        'Boil drinking water to prevent waterborne gastroenteritis infections.',
        'Disconnect primary electrical power mains if ground floor is flooded.'
      ]
    },
    {
      id: 'rain',
      title: 'EXTREME WEATHER & LIGHTNING',
      icon: <CloudRain className="w-6 h-6 text-indigo-400" />,
      risk: 'LOW',
      riskColor: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
      condition: 'No active thunderstorm lightning warning for this quadrant',
      recommendation: 'Seek immediate shelter inside a sturdy building or vehicle during thunderstorm lightning strikes.',
      actions: [
        'Stay away from tall isolated trees, open metal fences, and water bodies.',
        'Unplug sensitive electronic equipment during thunderstorm activity.'
      ]
    }
  ];

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <span className="p-2 rounded-2xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <CloudSun className="w-7 h-7" />
            </span>
            🌍 Disaster & Environment Center
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Official hazard advisories from NDMA & IMD combined with real-time on-device environmental sensors.
          </p>
        </div>

        {/* Clickable Region Card */}
        <button
          onClick={openModal}
          className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-sky-500/50 px-4 py-2 rounded-2xl text-xs text-slate-300 transition-all group cursor-pointer"
          title="Click to change region"
        >
          <Compass className="w-4 h-4 text-sky-400 shrink-0" />
          <span>Region: <strong className="text-white">{displayRegion}</strong></span>
          <Pencil className="w-3 h-3 text-slate-500 group-hover:text-sky-400 ml-1 transition-colors" />
        </button>
      </div>

      {/* ===== Change Region Modal ===== */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <MapPin className="w-4 h-4 text-sky-400" />
                Change Region
              </div>
              <button
                onClick={closeModal}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search Input */}
            <div className="px-4 py-3 border-b border-slate-800">
              <div className="flex items-center gap-2 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 focus-within:border-sky-500/70 transition-colors">
                <Search className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search city…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent text-xs text-white placeholder-slate-500 outline-none"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="text-slate-500 hover:text-white transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* City List */}
            <ul className="overflow-y-auto max-h-64 py-2 divide-y divide-slate-800/60">
              {filteredCities.length > 0 ? filteredCities.map((city) => (
                <li key={city}>
                  <button
                    onClick={() => handleSelectCity(city)}
                    className={`w-full flex items-center gap-2.5 px-5 py-2.5 text-left text-xs transition-colors ${
                      displayRegion === city
                        ? 'bg-sky-600/20 text-sky-300 font-bold'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <MapPin className="w-3 h-3 shrink-0 text-slate-500" />
                    {city}
                    {displayRegion === city && (
                      <span className="ml-auto text-[10px] font-bold text-sky-400 bg-sky-500/15 px-2 py-0.5 rounded-full border border-sky-500/30">
                        Active
                      </span>
                    )}
                  </button>
                </li>
              )) : (
                <li className="px-5 py-4 text-xs text-slate-500 text-center">No cities match your search.</li>
              )}
            </ul>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-slate-800 text-[10px] text-slate-500">
              Selecting a region updates local hazard context for this session.
            </div>
          </div>
        </div>
      )}


      {/* Demo Warning Notice */}
      <div className="p-3 bg-purple-950/40 border border-purple-500/30 rounded-2xl text-xs text-purple-300 flex items-center gap-2">
        <Info className="w-4 h-4 text-purple-400 shrink-0" />
        <span>
          <strong>Hackathon Notice:</strong> Disaster feeds and weather indices include simulated emergency scenarios labeled for demonstration purposes.
        </span>
      </div>

      {/* Official Disaster Alerts Feed */}
      {disasterAlerts.map((alert) => (
        <div
          key={alert.id}
          className={`p-6 rounded-3xl border-2 ${
            alert.severity === 'RED_WARNING'
              ? 'bg-gradient-to-r from-red-950/60 via-slate-900 to-red-950/60 border-red-500/80 shadow-2xl shadow-red-950/50'
              : 'bg-gradient-to-r from-amber-950/60 via-slate-900 to-amber-950/60 border-amber-500/80'
          }`}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div className="flex items-start gap-4">
              <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-700 shrink-0">
                <ShieldAlert className={`w-8 h-8 ${alert.severity === 'RED_WARNING' ? 'text-red-500 animate-pulse' : 'text-amber-400'}`} />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-500/20 text-red-300 border border-red-500/40">
                    {alert.agency} OFFICIAL DISASTER ADVISORY
                  </span>
                  <span className="text-xs text-slate-400">({alert.effectiveUntil})</span>
                </div>
                <h3 className="text-lg font-bold text-white leading-snug">
                  {alert.headline}
                </h3>
                <p className="text-xs text-slate-300">
                  <strong className="text-slate-200">Affected Territory:</strong> {alert.affectedRegion}
                </p>
              </div>
            </div>

            <a
              href={`tel:${alert.helpline.split(' ')[0]}`}
              className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-md transition-colors shrink-0"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Helpline: {alert.helpline}</span>
            </a>
          </div>

          <div className="pt-3 border-t border-slate-800/80">
            <span className="text-xs font-bold text-slate-300 block mb-2">Mandatory Safety Protocols:</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {alert.instructions.map((inst, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs text-slate-300 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{inst}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}

      {/* 5 Hazard Safety Cards Grid (Heat Wave, Air Pollution, Flood, Cyclone, Extreme Weather) */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-sky-400" />
          Hazard Assessment & Action Checklists
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {disasterCards.map((card) => (
            <div
              key={card.id}
              className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-3xl p-5 shadow-xl flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-2xl bg-slate-950 border border-slate-800">
                      {card.icon}
                    </div>
                    <h4 className="text-sm font-black text-white">{card.title}</h4>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${card.riskColor}`}>
                    {card.risk} RISK
                  </span>
                </div>

                <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800/80 text-xs">
                  <span className="text-slate-400 text-[10px] uppercase font-bold block mb-0.5">Condition</span>
                  <p className="text-slate-200 font-medium">{card.condition}</p>
                </div>

                <div className="text-xs text-slate-300 space-y-1.5">
                  <strong className="text-sky-400 block text-[11px]">Recommended Action:</strong>
                  <p className="leading-relaxed">{card.recommendation}</p>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800/80 space-y-1 text-[11px] text-slate-400">
                {card.actions.map((act, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <span className="text-emerald-400 font-bold">•</span>
                    <span>{act}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
