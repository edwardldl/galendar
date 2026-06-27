// src/lib/locationService.ts

export interface LocationData {
  name: string;
  latitude: number;
  longitude: number;
  elevation: number;
  bortle: number;
}

/**
 * Fetches the general location of the user based on their IP address.
 * Attempts to query multiple free, CORS-enabled HTTPS IP Geolocation APIs.
 */
export const fetchIpLocation = async (): Promise<LocationData> => {
  // 1. Try ipwho.is (Free up to 10k requests/month, supports HTTPS and CORS)
  try {
    const response = await fetch("https://ipwho.is/");
    if (response.ok) {
      const data = await response.json();
      if (data.success && typeof data.latitude === "number" && typeof data.longitude === "number") {
        const city = data.city || "";
        const region = data.region || data.country || "";
        const name = city ? `${city}, ${region} (IP)` : "Current Location (IP)";
        return {
          name,
          latitude: Number(data.latitude.toFixed(4)),
          longitude: Number(data.longitude.toFixed(4)),
          elevation: 10, // Default elevation
          bortle: 5,     // Default estimate for suburban IP
        };
      }
    }
  } catch (error) {
    console.warn("Failed to fetch location from ipwho.is, trying fallback:", error);
  }

  // 2. Try freeipapi.com as fallback (Free, supports HTTPS and CORS)
  try {
    const response = await fetch("https://freeipapi.com/api/json");
    if (response.ok) {
      const data = await response.json();
      if (typeof data.latitude === "number" && typeof data.longitude === "number") {
        const city = data.cityName || "";
        const region = data.regionName || data.countryName || "";
        const name = city ? `${city}, ${region} (IP)` : "Current Location (IP)";
        return {
          name,
          latitude: Number(data.latitude.toFixed(4)),
          longitude: Number(data.longitude.toFixed(4)),
          elevation: 10,
          bortle: 5,
        };
      }
    }
  } catch (error) {
    console.error("All IP Geolocation APIs failed:", error);
  }

  throw new Error("Unable to retrieve IP-based location");
};
