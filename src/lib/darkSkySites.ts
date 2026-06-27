// src/lib/darkSkySites.ts

export interface DarkSkySite {
  id: string;
  name: string;
  region: string;
  latitude: number;
  longitude: number;
  elevation: number; // in meters
  bortle: number;    // Bortle scale 1-9
  description: string;
}

export const darkSkySites: DarkSkySite[] = [
  {
    id: "joshua-tree",
    name: "Joshua Tree National Park",
    region: "California, USA",
    latitude: 34.00,
    longitude: -116.13,
    elevation: 820,
    bortle: 3,
    description: "Excellent dark sky site close to Los Angeles. Good western/southern horizon visibility.",
  },
  {
    id: "cherry-springs",
    name: "Cherry Springs State Park",
    region: "Pennsylvania, USA",
    latitude: 41.66,
    longitude: -77.82,
    elevation: 700,
    bortle: 2,
    description: "Famous East Coast dark sky destination. Shielded from major city light domes.",
  },
  {
    id: "mauna-kea",
    name: "Mauna Kea Observatory",
    region: "Hawaii, USA",
    latitude: 19.82,
    longitude: -155.47,
    elevation: 4207,
    bortle: 1,
    description: "World-class astronomy location. High altitude minimizes atmospheric distortion.",
  },
  {
    id: "death-valley",
    name: "Death Valley (Badwater Basin)",
    region: "California, USA",
    latitude: 36.25,
    longitude: -116.82,
    elevation: -86,
    bortle: 1,
    description: "Extremely dry atmosphere and remote desert location. Unrivaled dark sky view.",
  },
  {
    id: "atacama",
    name: "Atacama Desert (ESO Paranal)",
    region: "Antofagasta, Chile",
    latitude: -24.62,
    longitude: -70.40,
    elevation: 2635,
    bortle: 1,
    description: "One of the driest places on Earth. Galactic Core reaches zenith (directly overhead).",
  },
  {
    id: "aoraki-mount-cook",
    name: "Aoraki Mount Cook Observatory",
    region: "South Island, New Zealand",
    latitude: -43.73,
    longitude: 170.10,
    elevation: 760,
    bortle: 1,
    description: "International Dark Sky Reserve. Outstanding southern hemisphere Milky Way viewing.",
  },
  {
    id: "reykjavik",
    name: "Reykjavik (Polar Extreme Test)",
    region: "Iceland",
    latitude: 64.15,
    longitude: -21.94,
    elevation: 15,
    bortle: 5,
    description: "High northern latitude. Experience midnight sun with zero astronomical darkness in summer.",
  },
  {
    id: "longyearbyen",
    name: "Longyearbyen (No Core Test)",
    region: "Svalbard, Norway",
    latitude: 78.22,
    longitude: 15.64,
    elevation: 30,
    bortle: 3,
    description: "Extreme Arctic location. The Galactic Core never rises above the horizon.",
  }
];
