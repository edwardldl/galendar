// src/components/CalendarGrid.tsx

import React, { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Cloud, Info } from "lucide-react";
import { calculateDailyMetrics, DailyAstroMetrics, LocationData } from "../lib/astroEngine";
import { cacheMetrics, getCachedMetrics, getCacheKey } from "../lib/db";
import { WeatherDataMap, getWeatherTimeKey } from "../lib/weatherService";

interface CalendarGridProps {
  location: LocationData;
  horizonThreshold: number;
  bortleScale: number;
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (dateStr: string) => void;
  weatherOverlayActive: boolean;
  weatherForecast: WeatherDataMap | null;
  loadingWeather: boolean;
}

// Render Moon Phase SVG dynamically
export const MoonPhaseIcon: React.FC<{ illumination: number; phaseAngle: number; size?: number }> = ({
  illumination,
  phaseAngle,
  size = 18,
}) => {
  const r = 8; // base radius
  const c = 10; // center coordinate

  // If new moon, return dark circle
  if (illumination < 0.05) {
    return (
      <svg width={size} height={size} viewBox="0 0 20 20" className="text-gray-600">
        <circle cx={c} cy={c} r={r} fill="currentColor" opacity="0.3" />
      </svg>
    );
  }

  // If full moon, return bright circle
  if (illumination > 0.95) {
    return (
      <svg width={size} height={size} viewBox="0 0 20 20" className="text-amber-100 drop-shadow-[0_0_4px_rgba(254,243,199,0.6)]">
        <circle cx={c} cy={c} r={r} fill="currentColor" />
      </svg>
    );
  }

  // Draw the terminator mathematically
  const isWaxing = phaseAngle < 180;
  const sweep = isWaxing ? 1 : 0;
  
  // Calculate horizontal radius for terminator ellipse
  // scale is between -1 (crescent) and 1 (gibbous)
  const scale = 2 * illumination - 1;
  const rx = Math.abs(scale) * r;
  
  // Choose terminator direction
  const pathD = isWaxing
    ? `M ${c} ${c - r} 
       A ${r} ${r} 0 0 1 ${c} ${c + r} 
       A ${rx} ${r} 0 0 ${scale < 0 ? 0 : 1} ${c} ${c - r}`
    : `M ${c} ${c - r} 
       A ${r} ${r} 0 0 0 ${c} ${c + r} 
       A ${rx} ${r} 0 0 ${scale < 0 ? 1 : 0} ${c} ${c - r}`;

  return (
    <svg width={size} height={size} viewBox="0 0 20 20" className="text-amber-100">
      {/* Background circle representing the shadowed moon */}
      <circle cx={c} cy={c} r={r} fill="#21262D" />
      {/* Foreground path representing the lit portion */}
      <path d={pathD} fill="currentColor" />
    </svg>
  );
};

// Milky Way Arch Vector Component
interface MilkyWayArchProps {
  angle: number;
  size?: number;
  className?: string;
}

const MilkyWayArch: React.FC<MilkyWayArchProps> = ({ angle, size = 28, className = "" }) => {
  const cx = 14;
  const cy = 10;
  const color = "text-[#9D4EDD]"; // Galactic Lavender

  // A gentle curve representing the Milky Way plane.
  // Rotated by -angle degrees so it rises relative to the ground.
  const pathD = "M 4 10 Q 14 7 24 10";

  return (
    <svg viewBox="0 0 28 20" className={`${color} ${className}`} style={{ opacity: 0.8 }}>
      <path
        d={pathD}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        transform={`rotate(${-angle}, ${cx}, ${cy})`}
      />
    </svg>
  );
};

export const CalendarGrid: React.FC<CalendarGridProps> = ({
  location,
  horizonThreshold,
  bortleScale,
  selectedDate,
  onSelectDate,
  weatherOverlayActive,
  weatherForecast,
  loadingWeather,
}) => {
  const [currentYear, setCurrentYear] = useState<number>(2026);
  const [currentMonth, setCurrentMonth] = useState<number>(6); // Default June
  const [monthlyMetrics, setMonthlyMetrics] = useState<DailyAstroMetrics[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Sync currentYear and currentMonth with selectedDate initially
  useEffect(() => {
    if (selectedDate) {
      const [y, m] = selectedDate.split("-").map(Number);
      setCurrentYear(y);
      setCurrentMonth(m);
    }
  }, [selectedDate]);

  // Compute daily metrics for the entire month
  useEffect(() => {
    const fetchMonthData = async () => {
      setLoading(true);
      const metricsArray: DailyAstroMetrics[] = [];
      const numDays = new Date(currentYear, currentMonth, 0).getDate();

      for (let day = 1; day <= numDays; day++) {
        const dateStr = `${currentYear}-${String(currentMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const cacheKey = getCacheKey(location.latitude, location.longitude, bortleScale, horizonThreshold, dateStr);
        
        let dailyData = await getCachedMetrics(cacheKey);
        
        if (!dailyData) {
          dailyData = calculateDailyMetrics(dateStr, location, {
            horizonThreshold,
            bortleScale,
          });
          await cacheMetrics(cacheKey, dailyData);
        }

        // Apply weather modifier if active and forecast is available
        if (weatherOverlayActive && weatherForecast) {
          let updatedPeakVqi = 0;
          const updatedHourly = dailyData.hourlyMetrics.map((hourMetric) => {
            const timeKey = getWeatherTimeKey(new Date(hourMetric.time));
            const cloudCover = weatherForecast[timeKey];
            
            // Apply formula: R-VQI = A-VQI * (1 - C_clouds)^2
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
          const finalWeatherPeakVqi = Math.max(0, Math.min(100, Math.round(baseWeatherVqi * (dailyData.vqiDurationFactor ?? 1.0))));

          // Create a new modified object
          dailyData = {
            ...dailyData,
            peakVqiScore: finalWeatherPeakVqi,
            hourlyMetrics: updatedHourly,
          };
        }

        metricsArray.push(dailyData);
      }
      setMonthlyMetrics(metricsArray);
      setLoading(false);
    };

    fetchMonthData();
  }, [currentYear, currentMonth, location, horizonThreshold, bortleScale, weatherOverlayActive, weatherForecast]);

  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  // Get week days starting offset
  const firstDayIndex = new Date(currentYear, currentMonth - 1, 1).getDay();
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  
  // Create blank placeholders for days of previous month
  const blanks = Array(firstDayIndex).fill(null);
  const monthDays = monthlyMetrics;
  const gridCells = [...blanks, ...monthDays];

  // Helper to color class for VQI
  const getVqiColorClass = (vqi: number) => {
    if (vqi >= 65) return "border-[#2D6A4F] shadow-[inset_0_0_10px_rgba(45,106,79,0.3)] bg-gradient-to-t from-[#2D6A4F]/10 to-transparent"; // Excellent
    if (vqi >= 40) return "border-[#40916C] shadow-[inset_0_0_6px_rgba(64,145,108,0.2)]"; // Good
    if (vqi >= 15) return "border-[#D0873F]/60 shadow-[inset_0_0_6px_rgba(208,135,63,0.1)]"; // Fair
    return "border-[#21262D]/60"; // Poor
  };


  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  return (
    <div className="bg-[#161B22] border border-gray-800 rounded-xl p-5 shadow-xl">
      {/* Calendar Header Navigation */}
      <div className="flex items-center justify-between border-b border-gray-800 pb-4 mb-4">
        <h2 className="text-lg font-extrabold text-white tracking-wide flex items-center gap-2">
          {monthNames[currentMonth - 1]} {currentYear}
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={handlePrevMonth}
            className="p-1.5 hover:bg-black/30 text-gray-400 hover:text-white rounded border border-gray-800 transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={handleNextMonth}
            className="p-1.5 hover:bg-black/30 text-gray-400 hover:text-white rounded border border-gray-800 transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Weather Load State Indicator */}
      {weatherOverlayActive && (
        <div className="text-xs flex items-center justify-between bg-black/30 border border-gray-800 rounded px-3 py-1.5 mb-4 text-[#9D4EDD]">
          <span className="flex items-center gap-1.5">
            <Cloud size={14} /> 
            {loadingWeather ? "Refreshing live cloud forecast..." : "Live Weather Forecast Overlay Active"}
          </span>
          <span className="text-[10px] text-gray-500 font-mono">10-Day Horizon</span>
        </div>
      )}

      {/* Week Day Header */}
      <div className="grid grid-cols-7 gap-1 text-center mb-1">
        {dayNames.map((name) => (
          <div key={name} className="text-xs font-bold text-gray-500 py-1 uppercase tracking-wider">
            {name}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center text-sm text-gray-400">
          <div className="w-8 h-8 rounded-full border-2 border-t-[#9D4EDD] border-r-[#9D4EDD] border-gray-800 animate-spin mb-3"></div>
          Calculating celestial trajectories...
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {gridCells.map((cell, idx) => {
            if (cell === null) {
              return <div key={`blank-${idx}`} className="aspect-square bg-transparent"></div>;
            }

            const dayNum = idx - firstDayIndex + 1;
            const dateStr = `${currentYear}-${String(currentMonth).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
            const isSelected = selectedDate === dateStr;

            // Compute peak VQI for the day
            const vqi = cell.peakVqiScore;

            // Check if weather is available for this date
            // (Open-Meteo provides 10 days out, which is roughly today + 9 days)
            const today = new Date();
            today.setHours(0,0,0,0);
            const cellDate = new Date(currentYear, currentMonth - 1, dayNum);
            const diffTime = cellDate.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            const hasWeather = weatherOverlayActive && diffDays >= 0 && diffDays < 10;
            const isPastWeatherLimit = weatherOverlayActive && (diffDays < 0 || diffDays >= 10);

            return (
              <button
                key={dateStr}
                onClick={() => onSelectDate(dateStr)}
                className={`relative aspect-square border rounded-lg p-1.5 flex flex-col justify-between items-center transition-all ${getVqiColorClass(
                  vqi
                )} ${
                  isSelected
                    ? "border-[#9D4EDD] ring-1 ring-[#9D4EDD] scale-[1.03] z-10"
                    : "hover:border-gray-600 hover:scale-[1.01]"
                }`}
              >
                {/* Day Number */}
                <span className={`text-xs font-bold ${isSelected ? "text-[#9D4EDD]" : "text-gray-300"}`}>
                  {dayNum}
                </span>

                {/* Merged Milky Way Angle & Arch Indicator */}
                <div className="relative w-11 h-6 flex items-center justify-center" title="Milky Way tilt and ground angle at 12:00 AM">
                  <MilkyWayArch angle={cell.galacticPlaneAngleAtMidnight} className="absolute inset-0 w-full h-full" />
                  <span className="relative text-[11px] font-black text-gray-100 font-mono tracking-tighter z-10 mt-1 select-none">
                    {cell.galacticPlaneAngleAtMidnight}°
                  </span>
                </div>

                {/* Bottom Row: Moon Phase and Weather Badge */}
                <div className="flex items-center justify-between w-full mt-1 px-0.5">
                  {/* Moon icon */}
                  <MoonPhaseIcon illumination={cell.moonPhasePct} phaseAngle={cell.hourlyMetrics[12]?.moonIllumination !== undefined ? cell.hourlyMetrics[12].moonIllumination * 360 : 0} size={11} />
                  
                  {/* Weather/Offline Indicator */}
                  {hasWeather ? (
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" title="Live weather overlay active"></div>
                  ) : isPastWeatherLimit ? (
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-700" title="Outside 10-day forecast window. Showing math-only."></div>
                  ) : null}
                </div>

                {/* Micro VQI indicator text for High/Exc nights */}
                {vqi >= 65 && (
                  <span className="absolute bottom-0 text-[7px] text-[#2D6A4F] font-bold uppercase tracking-wider scale-75 opacity-70">
                    EXC
                  </span>
                )}
                {vqi >= 40 && vqi < 65 && (
                  <span className="absolute bottom-0 text-[7px] text-[#40916C] font-bold uppercase tracking-wider scale-75 opacity-70">
                    GOOD
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-gray-800 flex flex-wrap gap-x-4 gap-y-2 justify-center text-[10px] text-gray-400">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-[#2D6A4F]"></div> Excellent VQI (65+)
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-[#40916C]"></div> Good VQI (40-64)
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-[#D0873F]"></div> Fair VQI (15-39)
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-gray-600"></div> Poor VQI (&lt;15)
        </div>
      </div>
    </div>
  );
};
