// src/app/page.tsx

"use client";

import React, { useState, useEffect } from "react";
import { Header } from "../components/Header";
import { CalendarGrid } from "../components/CalendarGrid";
import { DetailExplorer } from "../components/DetailExplorer";
import { SettingsPanel, SettingsState } from "../components/SettingsPanel";
import { darkSkySites } from "../lib/darkSkySites";
import { calculateDailyMetrics, DailyAstroMetrics, LocationData } from "../lib/astroEngine";
import { fetchCloudForecast, WeatherDataMap } from "../lib/weatherService";
import { fetchIpLocation } from "../lib/locationService";
import { MapPin, Compass, AlertCircle, Sparkles, Plane } from "lucide-react";

export default function Home() {
  // 1. Core State
  const [location, setLocation] = useState({
    name: "Joshua Tree National Park",
    latitude: 34.00,
    longitude: -116.13,
    elevation: 820,
    bortle: 3,
  });

  const [settings, setSettings] = useState<SettingsState>({
    horizonThreshold: 10,
    bortleScale: 3, // synced with location.bortle initially
    focalLength: 14,
    cropFactor: 1.0,
  });

  const [selectedDate, setSelectedDate] = useState<string>("2026-06-08"); // default to local mock date
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [weatherOverlayActive, setWeatherOverlayActive] = useState<boolean>(false);
  const [weatherForecast, setWeatherForecast] = useState<WeatherDataMap | null>(null);
  const [loadingWeather, setLoadingWeather] = useState<boolean>(false);
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"calendar" | "explorer">("calendar");

  // Sync Bortle Scale when location preset changes
  const handleLocationChange = (newLoc: typeof location) => {
    setLocation(newLoc);
    setSettings((prev) => ({
      ...prev,
      bortleScale: newLoc.bortle,
    }));
  };

  // 2. Offline Detection
  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsOffline(!navigator.onLine);
      
      const goOnline = () => setIsOffline(false);
      const goOffline = () => {
        setIsOffline(true);
        setWeatherOverlayActive(false); // turn off weather overlay when offline
      };

      window.addEventListener("online", goOnline);
      window.addEventListener("offline", goOffline);

      return () => {
        window.removeEventListener("online", goOnline);
        window.removeEventListener("offline", goOffline);
      };
    }
  }, []);

  // 3. Auto-detect location via IP on mount
  useEffect(() => {
    const detectLocation = async () => {
      try {
        const ipLoc = await fetchIpLocation();
        setLocation(ipLoc);
        setSettings((prev) => ({
          ...prev,
          bortleScale: ipLoc.bortle,
        }));
      } catch (err) {
        console.warn("Could not auto-detect location on mount:", err);
      }
    };

    if (typeof window !== "undefined" && navigator.onLine) {
      detectLocation();
    }
  }, []);

  // 3. Fetch Weather Cloud Forecast
  useEffect(() => {
    const fetchWeather = async () => {
      if (!weatherOverlayActive || isOffline) return;
      
      setLoadingWeather(true);
      try {
        const forecast = await fetchCloudForecast(location.latitude, location.longitude);
        setWeatherForecast(forecast);
      } catch (err) {
        console.warn("Could not load weather forecast, falling back to math VQI:", err);
        setWeatherOverlayActive(false);
        alert("Failed to load live weather forecast. Falling back to offline astronomical calculations.");
      } finally {
        setLoadingWeather(false);
      }
    };

    fetchWeather();
  }, [weatherOverlayActive, location, isOffline]);

  // Compute selected day astro metrics
  const selectedDayMetrics: DailyAstroMetrics = calculateDailyMetrics(
    selectedDate,
    { latitude: location.latitude, longitude: location.longitude },
    {
      horizonThreshold: settings.horizonThreshold,
      bortleScale: settings.bortleScale,
    }
  );

  let finalSelectedMetrics = selectedDayMetrics;
  if (weatherOverlayActive && weatherForecast) {
    let updatedPeakVqi = 0;
    const updatedHourly = selectedDayMetrics.hourlyMetrics.map((hourMetric) => {
      // Find key matching: YYYY-MM-DDTHH:00
      const pad = (n: number) => String(n).padStart(2, "0");
      const d = new Date(hourMetric.time);
      const timeKey = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`;
      const cloudCover = weatherForecast[timeKey];
      
      let adjustedVqi = hourMetric.vqi;
      if (cloudCover !== undefined) {
        adjustedVqi = Math.round(hourMetric.vqi * Math.pow(1.0 - cloudCover, 2));
      }
      
      if (adjustedVqi > updatedPeakVqi) {
        updatedPeakVqi = adjustedVqi;
      }

      return { ...hourMetric, vqi: adjustedVqi };
    });

    const weatherVqiAt1AM = updatedHourly[13]?.vqi ?? 0;
    const baseWeatherVqi = 0.6 * weatherVqiAt1AM + 0.4 * updatedPeakVqi;
    const finalWeatherPeakVqi = Math.max(0, Math.min(100, Math.round(baseWeatherVqi * (selectedDayMetrics.vqiDurationFactor ?? 1.0))));

    finalSelectedMetrics = {
      ...selectedDayMetrics,
      peakVqiScore: finalWeatherPeakVqi,
      hourlyMetrics: updatedHourly,
    };
  }

  // Check if core rises
  const hasCoreRise = selectedDayMetrics.hourlyMetrics.some(
    (h) => h.coreAltitude >= settings.horizonThreshold
  );

  // Compute alternative travel suggestions if core never rises
  const getTravelSuggestions = () => {
    // Return presets that have core rise on the selected date
    return darkSkySites
      .filter((site) => {
        // Calculate metrics for this site
        const siteMetrics = calculateDailyMetrics(
          selectedDate,
          { latitude: site.latitude, longitude: site.longitude },
          { horizonThreshold: settings.horizonThreshold, bortleScale: site.bortle }
        );
        return siteMetrics.hourlyMetrics.some((h) => h.coreAltitude >= settings.horizonThreshold);
      })
      .slice(0, 3); // Pick top 3
  };

  const suggestions = !hasCoreRise ? getTravelSuggestions() : [];

  return (
    <main className="min-h-screen bg-[#0B0E14] text-[#F0F4F8] flex flex-col">
      {/* Header */}
      <Header
        currentLocation={location}
        onLocationChange={handleLocationChange}
        weatherOverlayActive={weatherOverlayActive}
        onWeatherOverlayToggle={setWeatherOverlayActive}
        onOpenSettings={() => setSettingsOpen(true)}
        isOffline={isOffline}
      />

      {/* Main Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-6 py-6 flex flex-col gap-6">
        
        {/* Offline Warning Banner */}
        {isOffline && (
          <div className="bg-red-950/20 border border-red-900/40 p-3 rounded-xl text-xs text-red-200 flex items-center gap-2 animate-pulse">
            <AlertCircle size={16} className="text-red-400 shrink-0" />
            <span>You are currently offline. Running in deterministic mode using local astronomical calculation engine.</span>
          </div>
        )}

        {/* Dashboard Tabs for mobile viewports */}
        <div className="flex md:hidden bg-[#161B22] p-1 border border-gray-800 rounded-lg">
          <button
            onClick={() => setActiveTab("calendar")}
            className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${
              activeTab === "calendar" ? "bg-black/40 text-white" : "text-gray-400"
            }`}
          >
            Monthly Grid
          </button>
          <button
            onClick={() => setActiveTab("explorer")}
            className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${
              activeTab === "explorer" ? "bg-black/40 text-white" : "text-gray-400"
            }`}
          >
            Night Explorer
          </button>
        </div>

        {/* Split Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column: Calendar Grid (7 columns on large screens) */}
          <div className={`lg:col-span-7 space-y-6 ${activeTab === "calendar" ? "block" : "hidden md:block"}`}>
            <CalendarGrid
              location={{ latitude: location.latitude, longitude: location.longitude }}
              horizonThreshold={settings.horizonThreshold}
              bortleScale={settings.bortleScale}
              selectedDate={selectedDate}
              onSelectDate={(d) => {
                setSelectedDate(d);
                setActiveTab("explorer"); // switch tab on mobile when clicking day
              }}
              weatherOverlayActive={weatherOverlayActive}
              weatherForecast={weatherForecast}
              loadingWeather={loadingWeather}
            />

            {/* Quick Astrophotography Tips */}
            <div className="bg-[#161B22] border border-gray-800 rounded-xl p-4 shadow-lg flex items-start gap-3">
              <Sparkles size={20} className="text-[#9D4EDD] shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-1">Milky Way Season Info</h4>
                <p className="text-xs text-[#8B949E] leading-relaxed">
                  The Milky Way Core is centered near Sagittarius. From mid-northern latitudes (e.g. CA), the Core visibility season runs from late February to October. The best viewing conditions occur around the <strong>New Moon</strong> when solar and lunar interference are zero.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Detail Explorer & Cheat Sheet (5 columns on large screens) */}
          <div className={`lg:col-span-5 space-y-6 ${activeTab === "explorer" ? "block" : "hidden md:block"}`}>
            
            {/* The Detailed Night Explorer Panel */}
            <DetailExplorer
              metrics={finalSelectedMetrics}
              location={{ latitude: location.latitude, longitude: location.longitude }}
              focalLength={settings.focalLength}
              cropFactor={settings.cropFactor}
              horizonThreshold={settings.horizonThreshold}
            />

            {/* Travel Suggestions Drawer (Only triggers when hasCoreRise is false) */}
            {!hasCoreRise && suggestions.length > 0 && (
              <div className="bg-[#161B22] border border-gray-800 rounded-xl p-5 shadow-xl space-y-4">
                <h3 className="text-sm font-extrabold text-white flex items-center gap-2 border-b border-gray-800 pb-3 mb-2">
                  <Plane size={18} className="text-[#9D4EDD]" /> Travel Suggestions
                </h3>
                <p className="text-xs text-[#8B949E] leading-relaxed">
                  Since the Galactic Core is invisible from your current coordinates on this date, here are some alternative destinations with visible cores tonight:
                </p>
                <div className="space-y-2.5">
                  {suggestions.map((site) => {
                    const siteMetrics = calculateDailyMetrics(
                      selectedDate,
                      { latitude: site.latitude, longitude: site.longitude },
                      { horizonThreshold: settings.horizonThreshold, bortleScale: site.bortle }
                    );

                    return (
                      <button
                        key={site.id}
                        onClick={() => handleLocationChange({
                          name: site.name,
                          latitude: site.latitude,
                          longitude: site.longitude,
                          elevation: site.elevation,
                          bortle: site.bortle
                        })}
                        className="w-full text-left bg-black/40 border border-gray-800/80 hover:border-[#9D4EDD] p-3 rounded-lg flex items-center justify-between group transition-all"
                      >
                        <div>
                          <div className="text-xs font-bold text-white group-hover:text-[#9D4EDD] transition-colors">{site.name}</div>
                          <div className="text-[10px] text-gray-500">{site.region} • Bortle Class {site.bortle}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-mono font-black text-[#2D6A4F]">VQI: {siteMetrics.peakVqiScore}</div>
                          <div className="text-[9px] text-gray-400">Tap to select</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Settings Overlay Drawer */}
      <SettingsPanel
        settings={settings}
        onChange={setSettings}
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </main>
  );
}
