// src/lib/db.ts

import { DailyAstroMetrics } from "./astroEngine";

const DB_NAME = "SeleneGalacticaDB";
const STORE_NAME = "ephemeris_cache";
const DB_VERSION = 1;

let dbInstance: IDBDatabase | null = null;

/**
 * Initializes the IndexedDB database
 */
const getDB = (): Promise<IDBDatabase> => {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    // Check if window is defined (for server-side rendering in Next.js)
    if (typeof window === "undefined") {
      reject(new Error("IndexedDB is only available in the browser"));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error("IndexedDB error:", request.error);
      reject(request.error);
    };

    request.onsuccess = (event) => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "cacheKey" });
      }
    };
  });
};

/**
 * Generates a unique cache key based on location, settings, and date
 */
export const getCacheKey = (
  lat: number,
  lon: number,
  bortle: number,
  horizon: number,
  dateStr: string
): string => {
  return `${lat.toFixed(2)}_${lon.toFixed(2)}_${bortle}_${horizon}_${dateStr}_v5`;
};

/**
 * Retrieves a cached DailyAstroMetrics record
 */
export const getCachedMetrics = async (
  cacheKey: string
): Promise<DailyAstroMetrics | null> => {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(cacheKey);

      request.onsuccess = () => {
        if (request.result) {
          resolve(request.result.metrics);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (err) {
    console.warn("Error reading from IndexedDB cache:", err);
    return null;
  }
};

/**
 * Stores a DailyAstroMetrics record in the cache
 */
export const cacheMetrics = async (
  cacheKey: string,
  metrics: DailyAstroMetrics
): Promise<void> => {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      
      const record = {
        cacheKey,
        metrics,
        timestamp: Date.now(),
      };

      const request = store.put(record);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (err) {
    console.warn("Error writing to IndexedDB cache:", err);
  }
};

/**
 * Clears the entire ephemeris cache
 */
export const clearCache = async (): Promise<void> => {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (err) {
    console.warn("Error clearing IndexedDB cache:", err);
  }
};
