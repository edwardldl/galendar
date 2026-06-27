// src/lib/astroEngine.ts

import * as Astronomy from "astronomy-engine";

export interface AstroCoordinates {
  altitude: number; // in degrees
  azimuth: number;  // in degrees, 0 = North, 90 = East, etc.
  ra?: number;      // Right Ascension in degrees
  dec?: number;     // Declination in degrees
}

export interface AstroState {
  sun: AstroCoordinates;
  moon: AstroCoordinates & {
    illumination: number; // 0.0 to 1.0
    phaseName: string;    // "New Moon", "Waxing Crescent", etc.
    phaseAngle: number;   // 0 to 360 degrees
  };
  galacticCore: AstroCoordinates;
  moonCoreSeparation: number; // in degrees
  isAstroDark: boolean;
  isCoreVisible: boolean;
  vqi: number; // A-VQI score (0 to 100)
}

export interface LocationData {
  latitude: number;
  longitude: number;
  elevation?: number; // in meters (optional)
  bortle?: number;    // 1 to 9 (optional)
}

export interface AstroEngineOptions {
  horizonThreshold?: number; // default 10 degrees
  bortleScale?: number;     // 1 (excellent) to 9 (inner-city)
}

// Convert degrees to radians
const degToRad = (deg: number): number => (deg * Math.PI) / 180;
// Convert radians to degrees
const radToDeg = (rad: number): number => (rad * 180) / Math.PI;

// Normalize angle in degrees to [0, 360)
const normalize360 = (angle: number): number => {
  let normalized = angle % 360;
  if (normalized < 0) {
    normalized += 360;
  }
  return normalized;
};

/**
 * Get Moon Phase Name from illumination fraction and elongation angle
 */
const getMoonPhaseName = (illumination: number, phaseAngle: number): string => {
  const normalizedD = normalize360(phaseAngle);
  if (illumination < 0.02) return "New Moon";
  if (illumination > 0.98) return "Full Moon";
  
  if (normalizedD > 0 && normalizedD < 90) {
    return illumination > 0.48 && illumination < 0.52 ? "First Quarter" : "Waxing Crescent";
  }
  if (normalizedD >= 90 && normalizedD < 180) {
    return "Waxing Gibbous";
  }
  if (normalizedD >= 180 && normalizedD < 270) {
    return "Waning Gibbous";
  }
  // normalizedD between 270 and 360
  return illumination > 0.48 && illumination < 0.52 ? "Third Quarter" : "Waning Crescent";
};

/**
 * Main Calculation function for a single hourly timestamp
 */
export const calculateAstroState = (
  date: Date,
  location: LocationData,
  options: AstroEngineOptions = {}
): AstroState => {
  const { latitude, longitude, elevation = 0 } = location;
  const horizonThreshold = options.horizonThreshold ?? 10;

  const time = Astronomy.MakeTime(date);
  const observer = new Astronomy.Observer(latitude, longitude, elevation);

  // 1. Sun Position
  const sunEquator = Astronomy.Equator(Astronomy.Body.Sun, time, observer, true, true);
  const sunHorizontal = Astronomy.Horizon(time, observer, sunEquator.ra, sunEquator.dec, 'normal');
  const isAstroDark = sunHorizontal.altitude < -12;

  // 2. Moon Position
  const moonEquator = Astronomy.Equator(Astronomy.Body.Moon, time, observer, true, true);
  const moonHorizontal = Astronomy.Horizon(time, observer, moonEquator.ra, moonEquator.dec, 'normal');
  const moonIllum = Astronomy.Illumination(Astronomy.Body.Moon, time);
  const phaseAngle = Astronomy.MoonPhase(time);
  const phaseName = getMoonPhaseName(moonIllum.phase_fraction, phaseAngle);

  // 3. Galactic Core Position (Sagittarius A*)
  const gcRa = 17.7611222; // Right Ascension in hours
  const gcDec = -29.007806; // Declination in degrees
  const gcHorizontal = Astronomy.Horizon(time, observer, gcRa, gcDec, 'normal');
  const isCoreVisible = gcHorizontal.altitude >= horizonThreshold;

  // 4. Moon-Core Separation (Angular separation)
  const gcDecRad = degToRad(gcDec);
  const gcRaRad = degToRad(gcRa * 15);
  const moonDecRad = degToRad(moonEquator.dec);
  const moonRaRad = degToRad(moonEquator.ra * 15);
  const cosTheta = Math.sin(gcDecRad) * Math.sin(moonDecRad) + Math.cos(gcDecRad) * Math.cos(moonDecRad) * Math.cos(gcRaRad - moonRaRad);
  const moonCoreSeparation = radToDeg(Math.acos(Math.max(-1, Math.min(1, cosTheta))));

  // 5. Scoring Calculations (VQI)
  let vqi = 0;
  if (isAstroDark && isCoreVisible) {
    let moonPenalty = 0;
    if (moonHorizontal.altitude > 0) {
      moonPenalty = moonIllum.phase_fraction * (1.0 - 0.7 * (moonCoreSeparation / 180));
    }
    moonPenalty = Math.max(0, Math.min(1.0, moonPenalty));

    // Solar Twilight Penalty (progressive penalty between -12° and -18°)
    let solarPenalty = 0;
    if (sunHorizontal.altitude >= -18) {
      solarPenalty = (sunHorizontal.altitude - (-18)) / 6; // 0 at -18°, 1 at -12°
      solarPenalty = Math.max(0, Math.min(1.0, solarPenalty));
    }

    // Calculate VQI (only Sun and Moon)
    vqi = 100 * (1.0 - moonPenalty) * (1.0 - solarPenalty);
    vqi = Math.max(0, Math.min(100, Math.round(vqi)));
  }

  return {
    sun: {
      altitude: sunHorizontal.altitude,
      azimuth: sunHorizontal.azimuth,
      ra: sunEquator.ra * 15,
      dec: sunEquator.dec,
    },
    moon: {
      altitude: moonHorizontal.altitude,
      azimuth: moonHorizontal.azimuth,
      ra: moonEquator.ra * 15,
      dec: moonEquator.dec,
      illumination: moonIllum.phase_fraction,
      phaseName,
      phaseAngle,
    },
    galacticCore: {
      altitude: gcHorizontal.altitude,
      azimuth: gcHorizontal.azimuth,
      ra: gcRa * 15,
      dec: gcDec,
    },
    moonCoreSeparation,
    isAstroDark,
    isCoreVisible,
    vqi,
  };
};

export interface DailyAstroMetrics {
  date: string; // YYYY-MM-DD
  sunrise: Date | null;
  sunset: Date | null;
  astroDarkStart: Date | null;
  astroDarkEnd: Date | null;
  moonRise: Date | null;
  moonSet: Date | null;
  moonPhasePct: number;
  moonPhaseName: string;
  peakVqiScore: number;
  bestViewingStart: Date | null;
  bestViewingEnd: Date | null;
  galacticPlaneAngleAtMidnight: number;
  hourlyMetrics: Array<{
    time: Date;
    vqi: number;
    coreAltitude: number;
    coreAzimuth: number;
    sunAltitude: number;
    moonAltitude: number;
    moonAzimuth: number;
    moonIllumination: number;
  }>;
  vqiDurationFactor?: number;
}

/**
 * Calculates the angle between the Galactic Plane and the horizon at a given date/time
 */
export const calculateGalacticPlaneAngle = (
  date: Date,
  location: LocationData
): number => {
  const { latitude, longitude, elevation = 0 } = location;
  const time = Astronomy.MakeTime(date);
  const observer = new Astronomy.Observer(latitude, longitude, elevation);

  // Galactic North Pole coordinates (J2000)
  const gnpRa = 192.85948 / 15; // convert to hours
  const gnpDec = 27.12825;

  const gnpHor = Astronomy.Horizon(time, observer, gnpRa, gnpDec, 'normal');
  const planeAngle = 90 - Math.abs(gnpHor.altitude);
  return Math.round(planeAngle);
};

export const calculateDailyMetrics = (
  dateStr: string, // YYYY-MM-DD
  location: LocationData,
  options: AstroEngineOptions = {}
): DailyAstroMetrics => {
  const [year, month, day] = dateStr.split("-").map(Number);
  const localNoon = new Date(year, month - 1, day, 12, 0, 0);

  const hourlyMetrics = [];
  let maxHourlyVqi = 0;
  let bestViewingStart: Date | null = null;
  let bestViewingEnd: Date | null = null;
  
  let astroDarkStart: Date | null = null;
  let astroDarkEnd: Date | null = null;

  // Let's check 25 hourly points from 12:00 PM to 12:00 PM next day
  for (let i = 0; i <= 24; i++) {
    const checkTime = new Date(localNoon.getTime() + i * 3600 * 1000);
    const state = calculateAstroState(checkTime, location, options);
    
    hourlyMetrics.push({
      time: checkTime,
      vqi: state.vqi,
      coreAltitude: state.galacticCore.altitude,
      coreAzimuth: state.galacticCore.azimuth,
      sunAltitude: state.sun.altitude,
      moonAltitude: state.moon.altitude,
      moonAzimuth: state.moon.azimuth,
      moonIllumination: state.moon.illumination,
    });

    if (state.vqi > maxHourlyVqi) {
      maxHourlyVqi = state.vqi;
    }
  }

  // To find precise Astro Dark start/end and Moon rise/set, let's scan at 10-minute resolution
  let lastSunAlt = 0;
  let lastMoonAlt = 0;
  let moonRise: Date | null = null;
  let moonSet: Date | null = null;
  let sunrise: Date | null = null;
  let sunset: Date | null = null;
  
  // We'll sample 24 hours at 10-minute steps (144 steps)
  for (let step = 0; step <= 144; step++) {
    const time = new Date(localNoon.getTime() + step * 10 * 60 * 1000);
    const state = calculateAstroState(time, location, options);

    // Track astro dark boundaries (astronomical darkness Sun < -18°)
    if (state.sun.altitude < -18) {
      if (!astroDarkStart) astroDarkStart = time;
      astroDarkEnd = time;
    }

    // Track best viewing window (VQI > 15 is considered "viewable" or when VQI > 0)
    if (state.vqi > 0 && state.vqi >= Math.max(10, maxHourlyVqi * 0.4)) {
      if (!bestViewingStart) bestViewingStart = time;
      bestViewingEnd = time;
    }

    // Simple rise/set detection based on horizon crossing
    if (step > 0) {
      // Sun rise/set detection
      if (lastSunAlt > 0 && state.sun.altitude <= 0 && !sunset) {
        sunset = time;
      }
      if (lastSunAlt <= 0 && state.sun.altitude > 0 && !sunrise) {
        sunrise = time;
      }

      // Moon rise/set detection
      if (lastMoonAlt <= 0 && state.moon.altitude > 0 && !moonRise) {
        moonRise = time;
      }
      if (lastMoonAlt > 0 && state.moon.altitude <= 0 && !moonSet) {
        moonSet = time;
      }
    }
    lastSunAlt = state.sun.altitude;
    lastMoonAlt = state.moon.altitude;
  }

  // Calculate duration factor based on length of best viewing window
  let durationFactor = 1.0;
  if (bestViewingStart && bestViewingEnd) {
    const duration = (bestViewingEnd.getTime() - bestViewingStart.getTime()) / (1000 * 60 * 60);
    if (duration >= 3.0) {
      durationFactor = 1.0;
    } else if (duration >= 1.5) {
      durationFactor = 0.6 + 0.4 * (duration - 1.5) / 1.5;
    } else if (duration >= 0.5) {
      durationFactor = 0.2 + 0.4 * (duration - 0.5) / 1.0;
    } else {
      durationFactor = 0.0;
    }
  } else {
    durationFactor = 0.0;
  }

  // Get moon phase metrics from mid-night (12:00 AM)
  const midnight = new Date(localNoon.getTime() + 12 * 3600 * 1000);
  const midnightState = calculateAstroState(midnight, location, options);
  const gpAngle = calculateGalacticPlaneAngle(midnight, location);

  // Weight the daily VQI score to prioritize 1:00 AM (index 13 of hourlyMetrics)
  const vqiAt1AM = hourlyMetrics[13]?.vqi ?? 0;
  const baseDailyVqi = 0.6 * vqiAt1AM + 0.4 * maxHourlyVqi;
  const peakVqiScore = Math.max(0, Math.min(100, Math.round(baseDailyVqi * durationFactor)));

  return {
    date: dateStr,
    sunrise,
    sunset,
    astroDarkStart,
    astroDarkEnd,
    moonRise,
    moonSet,
    moonPhasePct: midnightState.moon.illumination,
    moonPhaseName: midnightState.moon.phaseName,
    peakVqiScore,
    bestViewingStart,
    bestViewingEnd,
    galacticPlaneAngleAtMidnight: gpAngle,
    hourlyMetrics,
    vqiDurationFactor: durationFactor,
  };
};
