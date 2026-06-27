// src/components/Header.tsx

import React, { useState } from "react";
import { Compass, Settings, CloudSun, MapPin, Navigation, ChevronDown, Check } from "lucide-react";
import { darkSkySites, DarkSkySite } from "../lib/darkSkySites";
import { fetchIpLocation } from "../lib/locationService";

interface HeaderProps {
  currentLocation: {
    name: string;
    latitude: number;
    longitude: number;
    elevation: number;
    bortle: number;
  };
  onLocationChange: (loc: {
    name: string;
    latitude: number;
    longitude: number;
    elevation: number;
    bortle: number;
  }) => void;
  weatherOverlayActive: boolean;
  onWeatherOverlayToggle: (active: boolean) => void;
  onOpenSettings: () => void;
  isOffline: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentLocation,
  onLocationChange,
  weatherOverlayActive,
  onWeatherOverlayToggle,
  onOpenSettings,
  isOffline,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [customLat, setCustomLat] = useState("");
  const [customLon, setCustomLon] = useState("");
  const [customName, setCustomName] = useState("");

  const handleSelectPreset = (site: DarkSkySite) => {
    onLocationChange({
      name: site.name,
      latitude: site.latitude,
      longitude: site.longitude,
      elevation: site.elevation,
      bortle: site.bortle,
    });
    setDropdownOpen(false);
  };

  const handleUseGPS = () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }


    navigator.geolocation.getCurrentPosition(
      (position) => {
        onLocationChange({
          name: "Current Location (GPS)",
          latitude: Number(position.coords.latitude.toFixed(4)),
          longitude: Number(position.coords.longitude.toFixed(4)),
          elevation: 10,
          bortle: 5,
        });
        setDropdownOpen(false);
      },
      async (error) => {
        if (error.code === 1 || error.code === error.PERMISSION_DENIED) {
          try {
            const ipLoc = await fetchIpLocation();
            onLocationChange(ipLoc);
            setDropdownOpen(false);
          } catch (ipError) {
            alert("Location permission denied and IP geolocation failed.");
          }
        } else {
          alert("Failed to retrieve location: " + error.message);
        }
      }
    );
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const lat = parseFloat(customLat);
    const lon = parseFloat(customLon);
    
    if (isNaN(lat) || lat < -90 || lat > 90) {
      alert("Please enter a valid latitude (-90 to 90)");
      return;
    }
    if (isNaN(lon) || lon < -180 || lon > 180) {
      alert("Please enter a valid longitude (-180 to 180)");
      return;
    }

    onLocationChange({
      name: customName.trim() || `Custom (${lat.toFixed(2)}°, ${lon.toFixed(2)}°)`,
      latitude: lat,
      longitude: lon,
      elevation: 5,
      bortle: 5, // Default average
    });

    setCustomLat("");
    setCustomLon("");
    setCustomName("");
    setDropdownOpen(false);
  };

  return (
    <header className="border-b border-gray-800 bg-[#0B0E14] sticky top-0 z-40 px-6 py-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Logo and title */}
        <div className="flex items-center gap-3">
          <div className="bg-[#9D4EDD] p-2 rounded-lg text-black animate-pulse shadow-[0_0_15px_rgba(157,78,221,0.5)]">
            <Compass size={24} className="stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-wider text-white">
              GALENDAR
            </h1>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest">
              Milky Way Core Planner
            </p>
          </div>
        </div>

        {/* Dashboard Controls */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Location Dropdown Selector */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 bg-[#161B22] border border-gray-800 rounded-lg px-4 py-2 text-sm text-[#F0F4F8] hover:border-[#9D4EDD] transition-all"
            >
              <MapPin size={16} className="text-[#9D4EDD]" />
              <div className="text-left">
                <div className="font-semibold text-xs leading-none text-gray-400">Observer Location</div>
                <div className="text-white font-bold max-w-[150px] truncate">{currentLocation.name}</div>
              </div>
              <ChevronDown size={14} className="text-gray-400 ml-1" />
            </button>

            {dropdownOpen && (
              <div className="absolute left-0 md:left-auto md:right-0 mt-2 w-72 bg-[#161B22] border border-gray-800 rounded-xl shadow-2xl p-4 z-50">
                <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Preset Dark Sky Sites</div>
                <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                  <button
                    onClick={handleUseGPS}
                    className="w-full text-left flex items-center justify-between text-xs px-2.5 py-1.5 rounded hover:bg-black/30 text-[#9D4EDD] transition-colors"
                  >
                    <span className="flex items-center gap-1.5"><Navigation size={12} /> Use GPS Location</span>
                  </button>

                  {darkSkySites.map((site) => (
                    <button
                      key={site.id}
                      onClick={() => handleSelectPreset(site)}
                      className="w-full text-left flex items-center justify-between text-xs px-2.5 py-1.5 rounded hover:bg-black/30 text-gray-300 transition-colors"
                    >
                      <span className="truncate">{site.name}</span>
                      {currentLocation.name === site.name && <Check size={12} className="text-[#9D4EDD]" />}
                    </button>
                  ))}
                </div>

                <div className="border-t border-gray-800 my-3 pt-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Custom Coordinates</div>
                  <form onSubmit={handleCustomSubmit} className="space-y-2">
                    <input
                      type="text"
                      placeholder="Name (Optional)"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      className="w-full bg-black/40 border border-gray-800 rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-[#9D4EDD]"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        step="any"
                        placeholder="Latitude (°N)"
                        value={customLat}
                        onChange={(e) => setCustomLat(e.target.value)}
                        required
                        className="w-full bg-black/40 border border-gray-800 rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-[#9D4EDD]"
                      />
                      <input
                        type="number"
                        step="any"
                        placeholder="Longitude (°E)"
                        value={customLon}
                        onChange={(e) => setCustomLon(e.target.value)}
                        required
                        className="w-full bg-black/40 border border-gray-800 rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-[#9D4EDD]"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full bg-[#9D4EDD] hover:bg-[#8A3FD2] text-black font-bold text-xs py-1.5 rounded transition-colors"
                    >
                      Save Coordinates
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>

          {/* Coordinate Telemetry Badge */}
          <div className="hidden lg:flex items-center gap-4 text-xs text-gray-400 bg-black/30 border border-gray-850 px-4 py-2 rounded-lg font-mono">
            <div>LAT: <span className="text-white font-bold">{currentLocation.latitude}°</span></div>
            <div>LON: <span className="text-white font-bold">{currentLocation.longitude}°</span></div>
            <div>ELEV: <span className="text-white font-bold">{currentLocation.elevation}m</span></div>
            <div>BORTLE: <span className="text-white font-bold">Class {currentLocation.bortle}</span></div>
          </div>

          {/* Weather Layer Switch */}
          <div className="flex items-center bg-[#161B22] border border-gray-800 rounded-lg p-1">
            <button
              onClick={() => onWeatherOverlayToggle(false)}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                !weatherOverlayActive
                  ? "bg-black/40 text-white shadow-inner"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Math (A-VQI)
            </button>
            <button
              disabled={isOffline}
              onClick={() => onWeatherOverlayToggle(true)}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
                isOffline ? "opacity-50 cursor-not-allowed" : ""
              } ${
                weatherOverlayActive
                  ? "bg-[#9D4EDD] text-black shadow-[0_0_10px_rgba(157,78,221,0.4)]"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <CloudSun size={12} />
              Weather (R-VQI)
            </button>
          </div>

          {/* Settings Trigger */}
          <button
            onClick={onOpenSettings}
            className="p-2.5 bg-[#161B22] border border-gray-800 rounded-lg text-gray-400 hover:text-white hover:border-[#9D4EDD] transition-all"
            title="Astro Settings"
          >
            <Settings size={18} />
          </button>
        </div>
      </div>
    </header>
  );
};
