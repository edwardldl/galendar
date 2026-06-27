// src/components/DetailExplorer.tsx

import React, { useState, useEffect } from "react";
import { Compass, Moon, Sun, Star, Info, Camera, Zap, Sunrise, Sunset } from "lucide-react";
import { DailyAstroMetrics, LocationData } from "../lib/astroEngine";
import { MoonPhaseIcon } from "./CalendarGrid";

interface DetailExplorerProps {
  metrics: DailyAstroMetrics;
  location: LocationData;
  focalLength: number;
  cropFactor: number;
  horizonThreshold: number;
}

// Helper to convert azimuth to compass heading
const getCompassDirection = (azimuth: number): string => {
  const directions = [
    { label: "N", min: 337.5, max: 360 },
    { label: "N", min: 0, max: 22.5 },
    { label: "NE", min: 22.5, max: 67.5 },
    { label: "E", min: 67.5, max: 112.5 },
    { label: "SE", min: 112.5, max: 157.5 },
    { label: "S", min: 157.5, max: 202.5 },
    { label: "SW", min: 202.5, max: 247.5 },
    { label: "W", min: 247.5, max: 292.5 },
    { label: "NW", min: 292.5, max: 337.5 },
  ];

  const match = directions.find((d) => {
    if (d.max === 360) {
      return azimuth >= d.min || azimuth < d.max;
    }
    return azimuth >= d.min && azimuth < d.max;
  });

  return match ? match.label : "S";
};

// Helper to interpolate angles correctly via shortest path
const interpolateAngle = (a: number, b: number, t: number): number => {
  let diff = b - a;
  // Normalize difference to [-180, 180)
  diff = ((diff + 180) % 360) - 180;
  if (diff < -180) diff += 360;
  return (a + t * diff + 360) % 360;
};

export const DetailExplorer: React.FC<DetailExplorerProps> = ({
  metrics,
  location,
  focalLength,
  cropFactor,
  horizonThreshold,
}) => {
  // Timeline hourly index (0 to 12 representing 6:00 PM to 6:00 AM)
  const [scrubIndex, setScrubIndex] = useState<number>(6); // Default to midnight (12:00 AM, index 6)

  // Reset index to astronomical twilight start when date or location/metrics changes
  useEffect(() => {
    if (metrics.astroDarkStart) {
      const [year, month, day] = metrics.date.split("-").map(Number);
      const local6PM = new Date(year, month - 1, day, 18, 0, 0);
      const diffMs = metrics.astroDarkStart.getTime() - local6PM.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      
      // Clamp index between 0 and 12
      const clampedIndex = Math.max(0, Math.min(12, diffHours));
      setScrubIndex(clampedIndex);
    } else {
      // Default to midnight (index 6) if no astronomical darkness exists
      setScrubIndex(6);
    }
  }, [metrics.date, metrics.astroDarkStart]);

  const hourlyData = metrics.hourlyMetrics.slice(6, 19); // Array of 13 hours from 18:00 to 06:00

  // Calculate interpolated values for continuous time slider
  const lowerIndex = Math.floor(scrubIndex);
  const upperIndex = Math.min(12, Math.ceil(scrubIndex));
  const t = scrubIndex - lowerIndex;

  const lower = hourlyData[lowerIndex];
  const upper = hourlyData[upperIndex];

  if (!lower || !upper) {
    return <div className="text-gray-400 text-sm">No data available for selected day.</div>;
  }

  const selectedHourData = {
    time: new Date(lower.time.getTime() + t * (upper.time.getTime() - lower.time.getTime())),
    vqi: Math.round(lower.vqi + t * (upper.vqi - lower.vqi)),
    coreAltitude: lower.coreAltitude + t * (upper.coreAltitude - lower.coreAltitude),
    coreAzimuth: interpolateAngle(lower.coreAzimuth, upper.coreAzimuth, t),
    sunAltitude: lower.sunAltitude + t * (upper.sunAltitude - lower.sunAltitude),
    moonAltitude: lower.moonAltitude + t * (upper.moonAltitude - lower.moonAltitude),
    moonAzimuth: interpolateAngle(lower.moonAzimuth ?? 90, upper.moonAzimuth ?? 90, t),
    moonIllumination: lower.moonIllumination + t * (upper.moonIllumination - lower.moonIllumination),
  };

  // Format local hour label continuously
  const getHourLabel = (index: number): string => {
    const totalMinutes = 18 * 60 + Math.round(index * 60);
    const hr = Math.floor(totalMinutes / 60) % 24;
    const min = totalMinutes % 60;
    const ampm = hr >= 12 ? "PM" : "AM";
    const displayHr = hr % 12 === 0 ? 12 : hr % 12;
    const displayMin = String(min).padStart(2, "0");
    return `${displayHr}:${displayMin} ${ampm}`;
  };

  // Math for 500 Rule
  const maxExposure = Math.round(500 / (focalLength * cropFactor));

  // Find Peak VQI Hour details
  const peakMetric = hourlyData.reduce((prev, current) => (prev.vqi > current.vqi ? prev : current), hourlyData[0]);
  const peakTime = new Date(peakMetric.time);
  const peakHourStr = peakTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  // Format Date label
  const formattedSelectedDate = new Date(metrics.date).toLocaleDateString([], {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Calculate SVG dimensions for Altitude Transit Curve
  const svgWidth = 500;
  const svgHeight = 120;
  const padding = 15;

  const getX = (index: number) => padding + (index / 12) * (svgWidth - 2 * padding);
  const getY = (alt: number) => {
    // Map altitude -60 to 90 degrees to SVG height
    const minAlt = -60;
    const maxAlt = 90;
    const percentage = (alt - minAlt) / (maxAlt - minAlt);
    return svgHeight - padding - percentage * (svgHeight - 2 * padding);
  };

  // Build SVG path points
  const sunPoints = hourlyData.map((d, i) => `${getX(i)},${getY(d.sunAltitude)}`).join(" ");
  const moonPoints = hourlyData.map((d, i) => `${getX(i)},${getY(d.moonAltitude)}`).join(" ");
  const corePoints = hourlyData.map((d, i) => `${getX(i)},${getY(d.coreAltitude)}`).join(" ");

  // Compass plot coordinates
  // Outer radius of dial
  const rOuter = 70;
  const cCenter = 85;
  const getCompassCoords = (azimuth: number, elevation: number) => {
    if (elevation < 0) return { x: -999, y: -999 }; // below horizon
    // Radius shrinks as elevation goes up to 90° (center)
    const r = ((90 - elevation) / 90) * rOuter;
    const angleRad = degToRad(azimuth - 90);
    return {
      x: cCenter + Math.cos(angleRad) * r,
      y: cCenter + Math.sin(angleRad) * r,
    };
  };

  const degToRad = (d: number) => (d * Math.PI) / 180;

  const coreCoords = getCompassCoords(selectedHourData.coreAzimuth, selectedHourData.coreAltitude);
  const moonCoords = getCompassCoords(selectedHourData.moonAzimuth ?? 90, selectedHourData.moonAltitude);

  // Format dark window string
  const formatTime = (d: Date | null) => {
    if (!d) return "None";
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Determine if viewing is possible
  const hasAstroDark = metrics.astroDarkStart !== null;
  const hasCoreRise = metrics.hourlyMetrics.some((h) => h.coreAltitude >= horizonThreshold);

  return (
    <div className="bg-[#161B22] border border-gray-800 rounded-xl p-5 shadow-xl space-y-6 text-[#F0F4F8]">
      {/* Selected Day Info */}
      <div className="border-b border-gray-800 pb-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Selected Date</span>
            <h3 className="text-base font-extrabold text-white">{formattedSelectedDate}</h3>
          </div>
          <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-lg border border-gray-800">
            <span className="text-xs text-gray-400">Peak VQI Score:</span>
            <span className={`text-sm font-black ${
              metrics.peakVqiScore >= 65 ? "text-[#2D6A4F] drop-shadow-[0_0_8px_rgba(45,106,79,0.4)]" :
              metrics.peakVqiScore >= 40 ? "text-[#40916C]" :
              metrics.peakVqiScore >= 15 ? "text-[#D0873F]" : "text-gray-500"
            }`}>
              {metrics.peakVqiScore}
            </span>
          </div>
        </div>
      </div>

      {/* Extreme Latitude Handling */}
      {!hasAstroDark && (
        <div className="bg-amber-950/20 border border-amber-900/40 p-3.5 rounded-lg text-xs text-amber-200 flex items-start gap-2.5">
          <Info size={16} className="shrink-0 mt-0.5" />
          <div>
            <strong className="block font-bold mb-0.5">Polar Twilight Warning: No Astronomical Darkness</strong>
            The sun does not dip lower than 18° below the horizon at this latitude during summer. A-VQI calculations have been adapted for twilight; use high-sensitivity camera sensors.
          </div>
        </div>
      )}

      {!hasCoreRise && (
        <div className="bg-red-950/20 border border-red-900/40 p-3.5 rounded-lg text-xs text-red-200 flex items-start gap-2.5">
          <Info size={16} className="shrink-0 mt-0.5" />
          <div>
            <strong className="block font-bold mb-0.5">Core Below Horizon</strong>
            The Galactic Core never rises above {horizonThreshold}° at this latitude. Observation is physically impossible from this location on this date. Travel closer to the equator.
          </div>
        </div>
      )}

      {/* Dark Window Bracket Callout */}
      {hasCoreRise && (
        <div className="bg-[#0B0E14] border border-gray-800 rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Recommended Observation Window</div>
            {metrics.bestViewingStart && metrics.bestViewingEnd ? (
              <div className="text-base font-extrabold text-[#9D4EDD]">
                {formatTime(metrics.bestViewingStart)} to {formatTime(metrics.bestViewingEnd)}
                <span className="text-xs text-gray-400 font-normal ml-2">
                  (Duration: {Math.round((metrics.bestViewingEnd.getTime() - metrics.bestViewingStart.getTime()) / 60000 / 60 * 10) / 10} hrs)
                </span>
              </div>
            ) : (
              <div className="text-sm font-bold text-gray-500">No optimal dark window available tonight.</div>
            )}
          </div>
          <div className="text-left md:text-right text-xs">
            <div className="text-gray-400">Sun Astro Darkness: <span className="text-white font-mono">{formatTime(metrics.astroDarkStart)} - {formatTime(metrics.astroDarkEnd)}</span></div>
            <div className="text-gray-400">Moon Phase: <span className="text-white font-mono">{Math.round(metrics.moonPhasePct * 100)}% ({metrics.moonPhaseName})</span></div>
          </div>
        </div>
      )}

      {/* Solar & Lunar Times */}
      <div className="bg-[#0B0E14]/60 backdrop-blur-md border border-gray-800 rounded-xl p-4 space-y-3">
        <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Solar & Lunar Transitions</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Sunset */}
          <div className="bg-[#161B22]/80 border border-gray-800/85 rounded-lg p-3 flex flex-col items-center justify-center text-center hover:border-orange-500/30 transition-all hover:scale-[1.02]">
            <Sunset className="text-orange-400 w-5 h-5 mb-1.5 drop-shadow-[0_0_8px_rgba(249,115,22,0.4)]" />
            <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Sunset</span>
            <span className="text-xs font-extrabold text-white mt-1">
              {formatTime(metrics.sunset)}
            </span>
          </div>

          {/* Moonrise */}
          <div className="bg-[#161B22]/80 border border-gray-800/85 rounded-lg p-3 flex flex-col items-center justify-center text-center hover:border-[#9D4EDD]/30 transition-all hover:scale-[1.02]">
            <div className="relative">
              <Moon className="text-[#a0c4ff] w-5 h-5 mb-1.5 drop-shadow-[0_0_8px_rgba(160,196,255,0.4)]" />
              <span className="absolute -top-1 -right-2 text-[9px] font-bold text-emerald-400">↑</span>
            </div>
            <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Moonrise</span>
            <span className="text-xs font-extrabold text-white mt-1">
              {formatTime(metrics.moonRise)}
            </span>
          </div>

          {/* Moonset */}
          <div className="bg-[#161B22]/80 border border-gray-800/85 rounded-lg p-3 flex flex-col items-center justify-center text-center hover:border-[#9D4EDD]/30 transition-all hover:scale-[1.02]">
            <div className="relative">
              <Moon className="text-[#a0c4ff] w-5 h-5 mb-1.5 drop-shadow-[0_0_8px_rgba(160,196,255,0.4)]" />
              <span className="absolute -top-1 -right-2 text-[9px] font-bold text-rose-400">↓</span>
            </div>
            <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Moonset</span>
            <span className="text-xs font-extrabold text-white mt-1">
              {formatTime(metrics.moonSet)}
            </span>
          </div>

          {/* Sunrise */}
          <div className="bg-[#161B22]/80 border border-gray-800/85 rounded-lg p-3 flex flex-col items-center justify-center text-center hover:border-yellow-500/30 transition-all hover:scale-[1.02]">
            <Sunrise className="text-yellow-400 w-5 h-5 mb-1.5 drop-shadow-[0_0_8px_rgba(234,179,8,0.4)]" />
            <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Sunrise</span>
            <span className="text-xs font-extrabold text-white mt-1">
              {formatTime(metrics.sunrise)}
            </span>
          </div>
        </div>
      </div>

      {/* Interactive Timeline Graph and Slider */}
      <div className="space-y-3">
        <div className="flex justify-between items-center text-xs text-gray-500 font-bold px-1">
          <span>6:00 PM</span>
          <span className="text-gray-400 font-bold bg-[#21262D]/60 px-2 py-0.5 rounded">
            Selected Hour: {getHourLabel(scrubIndex)}
          </span>
          <span>6:00 AM</span>
        </div>

        {/* The SVG Transit Curves */}
        <div className="relative bg-black/40 border border-gray-850 rounded-lg p-2 overflow-hidden h-36">
          {/* Grid lines */}
          <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
            {/* Horizon (0°) line */}
            <line x1="0" y1={getY(0)} x2={svgWidth} y2={getY(0)} stroke="rgba(156, 163, 175, 0.4)" strokeDasharray="3,3" />
            {/* Usable Horizon threshold */}
            <line x1="0" y1={getY(horizonThreshold)} x2={svgWidth} y2={getY(horizonThreshold)} stroke="#9D4EDD" strokeWidth="0.8" strokeDasharray="2,4" opacity="0.6" />
            {/* Astronomical twilight (-18°) */}
            <line x1="0" y1={getY(-18)} x2={svgWidth} y2={getY(-18)} stroke="#e11d48" strokeWidth="0.8" strokeDasharray="2,4" opacity="0.4" />

            {/* Transit curves */}
            <polyline fill="none" stroke="#eab308" strokeWidth="1.5" points={moonPoints} opacity="0.65" /> {/* Moon */}
            <polyline fill="none" stroke="#f97316" strokeWidth="1.5" points={sunPoints} opacity="0.4" /> {/* Sun */}
            <polyline fill="none" stroke="#9D4EDD" strokeWidth="2.5" points={corePoints} className="drop-shadow-[0_0_4px_rgba(157,78,221,0.5)]" /> {/* Core */}

            {/* Highlight Selected Hour vertical indicator line */}
            <line 
              x1={getX(scrubIndex)} 
              y1="0" 
              x2={getX(scrubIndex)} 
              y2={svgHeight} 
              stroke="#F0F4F8" 
              strokeWidth="1.5" 
              opacity="0.8" 
            />
          </svg>
        </div>

        {/* Interactive Scrub Range Input */}
        <div className="px-1">
          <input
            type="range"
            min="0"
            max="12"
            step="0.01"
            value={scrubIndex}
            onChange={(e) => setScrubIndex(Number(e.target.value))}
            className="w-full h-2.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-[#9D4EDD]"
          />
        </div>
      </div>

      {/* Dual Panel: Compass Dial & Astrophotography Cheat Sheet */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
        {/* Left Side: Compass Dial */}
        <div className="bg-[#0B0E14] border border-gray-850 rounded-xl p-4 flex flex-col items-center justify-center">
          <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2 self-start">Live Sky Alignment</div>
          
          <div className="relative w-44 h-44 border border-gray-800 rounded-full flex items-center justify-center bg-radial-gradient">
            {/* Outer Compass Cardinal Marks */}
            <span className="absolute top-1 text-[10px] font-bold text-gray-500">N</span>
            <span className="absolute right-1.5 text-[10px] font-bold text-gray-500">E</span>
            <span className="absolute bottom-1 text-[10px] font-bold text-gray-500">S</span>
            <span className="absolute left-1.5 text-[10px] font-bold text-gray-500">W</span>

            {/* Altitude Concentric Circles (30°, 60°) */}
            <div className="absolute w-[93px] h-[93px] border border-gray-900 rounded-full"></div>
            <div className="absolute w-[46px] h-[46px] border border-gray-900 rounded-full"></div>

            {/* Core Position Indicator (glowing lavender dot) */}
            {selectedHourData.coreAltitude >= 0 ? (
              <div 
                className="absolute w-3.5 h-3.5 bg-[#9D4EDD] rounded-full flex items-center justify-center shadow-[0_0_12px_rgba(157,78,221,0.9)] animate-pulse transition-all duration-300"
                style={{
                  left: `${coreCoords.x - 7}px`,
                  top: `${coreCoords.y - 7}px`
                }}
                title={`Milky Way Core: Azimuth ${selectedHourData.coreAzimuth.toFixed(1)}°, Alt ${selectedHourData.coreAltitude.toFixed(1)}°`}
              >
                <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
              </div>
            ) : (
              <div className="absolute text-[10px] text-gray-600 font-medium">Core below horizon</div>
            )}

            {/* Moon Position Indicator (soft yellow dot, if above horizon) */}
            {selectedHourData.moonAltitude >= 0 && moonCoords.x !== -999 && (
              <div 
                className="absolute w-3.5 h-3.5 bg-amber-100 rounded-full flex items-center justify-center shadow-[0_0_8px_rgba(253,251,243,0.7)] transition-all duration-300"
                style={{
                  left: `${moonCoords.x - 7}px`,
                  top: `${moonCoords.y - 7}px`
                }}
                title={`Moon: Azimuth ${Math.round(selectedHourData.moonAzimuth ?? 90)}°, Alt ${selectedHourData.moonAltitude.toFixed(1)}°`}
              >
                <div className="w-1 h-1 bg-gray-800 rounded-full"></div>
              </div>
            )}
          </div>
          <div className="mt-2 text-center text-xs text-gray-400">
            {selectedHourData.coreAltitude >= 0 ? (
              <>
                Core Heading: <span className="text-white font-bold">{getCompassDirection(selectedHourData.coreAzimuth)} ({Math.round(selectedHourData.coreAzimuth)}°)</span> at <span className="text-white font-bold">{Math.round(selectedHourData.coreAltitude)}°</span> altitude
              </>
            ) : (
              "Milky Way Core is not visible at this time."
            )}
          </div>
        </div>

        {/* Right Side: Astrophotography Cheat Sheet */}
        <div className="bg-[#0B0E14] border border-gray-850 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Camera size={12} className="text-[#9D4EDD]" /> Camera Setup cheat sheet
            </div>

            <div className="space-y-3">
              {/* Pointing angle advice */}
              <div className="bg-black/30 p-2.5 rounded border border-gray-800/50">
                <div className="text-[10px] text-gray-400 uppercase font-semibold">Lens Aim Direction</div>
                {selectedHourData.coreAltitude >= horizonThreshold ? (
                  <div className="text-sm font-bold text-white mt-0.5">
                    Aim <span className="text-[#9D4EDD]">{getCompassDirection(selectedHourData.coreAzimuth)}</span> (Azimuth {Math.round(selectedHourData.coreAzimuth)}°) at {Math.round(selectedHourData.coreAltitude)}° elevation
                  </div>
                ) : (
                  <div className="text-sm font-bold text-gray-500 mt-0.5">
                    Core below horizon limit ({horizonThreshold}°)
                  </div>
                )}
              </div>

              {/* Recommended Exposure */}
              <div className="bg-black/30 p-2.5 rounded border border-gray-800/50">
                <div className="text-[10px] text-gray-400 uppercase font-semibold">Recommended Exposure (500 Rule)</div>
                <div className="text-sm font-bold text-white mt-0.5 flex items-center gap-1.5">
                  <Zap size={14} className="text-amber-400" /> {maxExposure} seconds
                  <span className="text-xs text-gray-400 font-normal">
                    (at f/2.8 or wider, ISO 3200-6400)
                  </span>
                </div>
              </div>

              {/* Focal Length settings display */}
              <div className="flex justify-between text-[11px] text-gray-500 px-1 pt-1">
                <span>Lens: {focalLength}mm</span>
                <span>Sensor: {cropFactor === 1.0 ? "Full Frame (1.0x)" : `${cropFactor}x Crop`}</span>
              </div>
            </div>
          </div>

          <div className="text-[10px] text-gray-500 leading-relaxed border-t border-gray-800/60 pt-2 mt-4">
            <strong>Pro Tip:</strong> Focus manually on a bright star using camera live view before capturing. Shoot in RAW format to capture the maximum dynamic range of the Core.
          </div>
        </div>
      </div>
    </div>
  );
};
