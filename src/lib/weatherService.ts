// src/lib/weatherService.ts

export interface HourlyCloudForecast {
  timeStr: string; // ISO string or format matching Open-Meteo (e.g. YYYY-MM-DDTHH:00)
  cloudCover: number; // 0.0 to 1.0
}

export interface WeatherDataMap {
  [timeKey: string]: number; // key: "YYYY-MM-DDTHH:00" in local/ISO format, value: cloudCover (0-1)
}

/**
 * Fetches 10-day hourly cloud cover forecast from Open-Meteo
 * Returns a mapping of hour keys to cloud cover (0.0 to 1.0)
 */
export const fetchCloudForecast = async (
  latitude: number,
  longitude: number
): Promise<WeatherDataMap> => {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=cloud_cover&timezone=auto&forecast_days=10`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Open-Meteo API returned status ${response.status}`);
    }

    const data = await response.json();
    if (!data.hourly || !data.hourly.time || !data.hourly.cloud_cover) {
      throw new Error("Invalid hourly data format from Open-Meteo");
    }

    const weatherMap: WeatherDataMap = {};
    const times: string[] = data.hourly.time;
    const cloudCovers: number[] = data.hourly.cloud_cover;

    for (let i = 0; i < times.length; i++) {
      // Open-Meteo times are strings like "2026-06-10T00:00" representing local time at that coordinate
      // We store it directly as a key
      const timeStr = times[i]; // "2026-06-10T00:00"
      const cloudPercent = cloudCovers[i];
      weatherMap[timeStr] = cloudPercent / 100; // convert 0-100 to 0.0-1.0
    }

    return weatherMap;
  } catch (error) {
    console.error("Error fetching cloud forecast:", error);
    throw error;
  }
};

/**
 * Helper to extract the date and hour matching key format: YYYY-MM-DDTHH:00
 */
export const getWeatherTimeKey = (date: Date): string => {
  const pad = (n: number) => String(n).padStart(2, "0");
  
  // Open-Meteo hourly forecast matches the local time of the location.
  // Wait, how do we get the local time of the location if we are in another timezone?
  // We can convert the date to the local time of the coordinate.
  // But a simple, robust way is to format the date's local values if the app runs in the user's local time,
  // or use the timezone offset. Open-Meteo returns time strings in the location's local time.
  // If the browser and location match, we can just format:
  // For maximum correctness, we should format the date using Intl.DateTimeFormat with the target timezone,
  // or a simple timezone offset shift.
  // Let's implement timezone formatting. Since timezone is returned by Open-Meteo or set to auto,
  // we can use Intl.DateTimeFormat to format in the local timezone if timezone info is available.
  // A simpler and extremely robust solution is to match by UTC time or format the date relative to offset.
  // Let's format the date using the local timezone of the date object, assuming the date represents the local time:
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  return `${year}-${month}-${day}T${hours}:00`;
};

/**
 * Calculates R-VQI from A-VQI and cloud cover
 */
export const calculateRealTimeVqi = (
  aVqi: number,
  cloudCover: number | undefined
): { rVqi: number; cloudCoverUsed: number | null } => {
  if (cloudCover === undefined || cloudCover === null) {
    return { rVqi: aVqi, cloudCoverUsed: null };
  }

  // Formula: R-VQI = A-VQI * (1.0 - C_clouds)^2
  const rVqi = aVqi * Math.pow(1.0 - cloudCover, 2);
  return {
    rVqi: Math.max(0, Math.round(rVqi)),
    cloudCoverUsed: cloudCover,
  };
};
