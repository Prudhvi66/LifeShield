import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { LocationService, MedicalCenterPoint } from '../../services/locationService';

interface InteractiveMapProps {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  addressDescription?: string;
  isEmergencyMode?: boolean;
}

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  latitude,
  longitude,
  accuracyMeters,
  addressDescription,
  isEmergencyMode = false,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Fix default Leaflet icon assets
    delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    });

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [latitude, longitude],
        zoom: 15,
        zoomControl: true,
        attributionControl: false
      });

      // CartoDB Dark Matter tiles for modern dark UI
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd',
      }).addTo(map);

      const markersGroup = L.layerGroup().addTo(map);
      markersGroupRef.current = markersGroup;
      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;
    const group = markersGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();
    map.setView([latitude, longitude], 15);

    // 1. User Position Circle & Marker
    const userMarkerIcon = L.divIcon({
      className: 'custom-user-pin',
      html: `<div style="
        width: 22px;
        height: 22px;
        background-color: ${isEmergencyMode ? '#ef4444' : '#0284c7'};
        border: 3px solid #ffffff;
        border-radius: 50%;
        box-shadow: 0 0 12px ${isEmergencyMode ? '#ef4444' : '#0284c7'};
        animation: pulse 1.5s infinite;
      "></div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11]
    });

    const userMarker = L.marker([latitude, longitude], { icon: userMarkerIcon })
      .bindPopup(`<strong>Your Location</strong><br/>${addressDescription || 'Current GPS Pin'}<br/>±${Math.round(accuracyMeters)}m accuracy`)
      .openPopup();

    const accuracyCircle = L.circle([latitude, longitude], {
      radius: Math.max(accuracyMeters, 40),
      color: isEmergencyMode ? '#ef4444' : '#38bdf8',
      fillColor: isEmergencyMode ? '#ef4444' : '#38bdf8',
      fillOpacity: 0.15,
      weight: 1.5
    });

    group.addLayer(accuracyCircle);
    group.addLayer(userMarker);

    // 2. Nearby Indian Medical & Ambulance Centers
    const centers: MedicalCenterPoint[] = LocationService.getNearbyMedicalCenters(latitude, longitude);
    centers.forEach((c) => {
      const hospIcon = L.divIcon({
        className: 'custom-hosp-pin',
        html: `<div style="
          background-color: #15803d;
          color: white;
          padding: 3px 6px;
          border-radius: 6px;
          font-size: 10px;
          font-weight: bold;
          border: 1px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          white-space: nowrap;
        ">🏥 ${c.name.split(' ')[0]}</div>`,
        iconAnchor: [30, 15]
      });

      const hospMarker = L.marker([c.latitude, c.longitude], { icon: hospIcon })
        .bindPopup(`<strong>${c.name}</strong><br/>Type: ${c.type}<br/>Distance: ${c.distanceKm} km<br/>Helpline: ${c.phone}`);

      group.addLayer(hospMarker);
    });

    return () => {
      // Map cleanup if component unmounts
    };
  }, [latitude, longitude, accuracyMeters, addressDescription, isEmergencyMode]);

  return (
    <div className="relative w-full h-64 sm:h-80 rounded-2xl overflow-hidden border border-slate-800 shadow-inner z-0">
      <div ref={mapContainerRef} className="w-full h-full" />
      
      {/* Map Overlay Badge */}
      <div className="absolute top-3 right-3 z-[1000] bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700 text-[11px] font-mono text-slate-200 flex items-center gap-2 shadow-lg">
        <span className={`w-2 h-2 rounded-full ${isEmergencyMode ? 'bg-red-500 animate-ping' : 'bg-emerald-400'}`} />
        <span>Live GPS: {latitude.toFixed(4)}, {longitude.toFixed(4)}</span>
      </div>
    </div>
  );
};
