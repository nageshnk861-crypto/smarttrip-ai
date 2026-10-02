/**
 * GeoJSON Loader Service
 * Loads the 7 category GeoJSON files (raw Overpass-Turbo exports) and
 * normalises every feature into a common PlaceResult shape.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ── Types ─────────────────────────────────────────────────────────────────────

export type PlaceCategory =
  | 'temple'
  | 'beach'
  | 'attraction'
  | 'viewpoint'
  | 'cafe'
  | 'hotel'
  | 'museum';

export const VALID_CATEGORIES: PlaceCategory[] = [
  'temple',
  'beach',
  'attraction',
  'viewpoint',
  'cafe',
  'hotel',
  'museum',
];

export interface PlaceResult {
  id: string;
  name: string;
  category: PlaceCategory;
  city: string;
  state: string;
  country: string;
  latitude: number;
  longitude: number;
  distanceKm?: number;
  openingHours?: string;
  entryFee?: string;
  entryFeeNumber?: number;
  estimatedDuration?: string;
  estimatedCost?: number;
  source: 'geojson' | 'overpass';
}

// ── Internal GeoJSON types ────────────────────────────────────────────────────

type GeoCoord = [number, number]; // [lng, lat]

interface GeoJsonGeometry {
  type: string;
  coordinates: GeoCoord | GeoCoord[] | GeoCoord[][] | GeoCoord[][][];
}

interface GeoJsonFeature {
  type: 'Feature';
  id?: string | number;
  properties: Record<string, unknown>;
  geometry: GeoJsonGeometry | null;
}

interface GeoJsonFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
}

// ── File mapping ──────────────────────────────────────────────────────────────

const FILE_MAP: Record<PlaceCategory, string> = {
  temple: 'temples.geojson',
  beach: 'beaches.geojson',
  attraction: 'attractions.geojson',
  viewpoint: 'viewpoints.geojson',
  cafe: 'cafes.geojson',
  hotel: 'hotels.geojson',
  museum: 'museums.geojson',
};

// ── Path resolution ───────────────────────────────────────────────────────────

function resolveDataDir(): string {
  const candidates = [
    path.resolve(process.cwd(), 'data'),
    path.resolve(process.cwd(), 'backend/data'),
    path.resolve(process.cwd(), '../backend/data'),
    path.resolve(__dirname, '../data'),
    path.resolve(__dirname, '../../data'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  return candidates[0];
}

// ── Coordinate extraction ─────────────────────────────────────────────────────

/**
 * Extracts a representative [lng, lat] point from any GeoJSON geometry.
 * For polygons and multi-polygons the centroid of the first ring is returned.
 * For lines the midpoint is returned.
 */
function extractPoint(geometry: GeoJsonGeometry): GeoCoord | null {
  if (!geometry) return null;

  switch (geometry.type) {
    case 'Point':
      return geometry.coordinates as GeoCoord;

    case 'MultiPoint': {
      const pts = geometry.coordinates as GeoCoord[];
      return pts[0] ?? null;
    }

    case 'LineString': {
      const pts = geometry.coordinates as GeoCoord[];
      const mid = Math.floor(pts.length / 2);
      return pts[mid] ?? null;
    }

    case 'Polygon': {
      const ring = (geometry.coordinates as GeoCoord[][])[0] ?? [];
      return centroid(ring);
    }

    case 'MultiPolygon': {
      const firstRing = ((geometry.coordinates as GeoCoord[][][])[0] ?? [])[0] ?? [];
      return centroid(firstRing);
    }

    default:
      return null;
  }
}

function centroid(ring: GeoCoord[]): GeoCoord | null {
  if (!ring.length) return null;
  let sumLng = 0;
  let sumLat = 0;
  for (const [lng, lat] of ring) {
    sumLng += lng;
    sumLat += lat;
  }
  return [sumLng / ring.length, sumLat / ring.length];
}

// ── Normalise a single feature ────────────────────────────────────────────────

function extractAddress(props: Record<string, unknown>): { city: string; state: string; country: string } {
  const str = (k: string) => (typeof props[k] === 'string' ? (props[k] as string) : '');

  const city =
    str('addr:city') ||
    str('addr:town') ||
    str('addr:village') ||
    str('addr:suburb') ||
    str('addr:district') ||
    '';

  const state = str('addr:state') || str('addr:province') || '';

  const country = str('addr:country') || str('country') || 'India';

  return { city, state, country };
}

function getCategoryDefaults(category: PlaceCategory, props: Record<string, unknown>): {
  openingHours: string;
  entryFee: string;
  entryFeeNumber: number;
  estimatedDuration: string;
  estimatedCost: number;
} {
  const rawHours = typeof props.opening_hours === 'string' ? props.opening_hours.trim() : '';
  const rawFee = typeof props.fee === 'string' ? props.fee.trim() : '';
  const rawCharge = typeof props.charge === 'string' ? props.charge.trim() : '';

  switch (category) {
    case 'temple': {
      const openingHours = rawHours || '06:00 AM – 12:30 PM, 04:30 PM – 09:00 PM (Daily)';
      const hasFee = rawFee.toLowerCase() === 'yes' || !!rawCharge;
      const entryFee = hasFee ? (rawCharge || '₹50 (Special Darshan)') : 'Free Entry';
      const entryFeeNumber = hasFee ? 50 : 0;
      return {
        openingHours,
        entryFee,
        entryFeeNumber,
        estimatedDuration: '1.5 – 2 Hours',
        estimatedCost: entryFeeNumber + 50,
      };
    }
    case 'museum': {
      const openingHours = rawHours || '10:00 AM – 05:30 PM (Closed Mondays)';
      const entryFee = rawCharge || (rawFee === 'no' ? 'Free Entry' : '₹50 / Person');
      const entryFeeNumber = rawFee === 'no' ? 0 : 50;
      return {
        openingHours,
        entryFee,
        entryFeeNumber,
        estimatedDuration: '2 – 3 Hours',
        estimatedCost: entryFeeNumber + 30,
      };
    }
    case 'beach': {
      return {
        openingHours: rawHours || 'Open 24 Hours (Best: 06:00 AM – 07:00 PM)',
        entryFee: 'Free Entry',
        entryFeeNumber: 0,
        estimatedDuration: '2 – 3 Hours',
        estimatedCost: 100,
      };
    }
    case 'viewpoint': {
      return {
        openingHours: rawHours || '06:00 AM – 06:30 PM (Sunrise to Sunset)',
        entryFee: rawCharge || 'Free Entry',
        entryFeeNumber: rawCharge ? 30 : 0,
        estimatedDuration: '1 – 2 Hours',
        estimatedCost: 50,
      };
    }
    case 'cafe': {
      return {
        openingHours: rawHours || '08:00 AM – 11:00 PM (Daily)',
        entryFee: 'No Entry Fee (Avg. ₹250/meal)',
        entryFeeNumber: 0,
        estimatedDuration: '1 Hour',
        estimatedCost: 250,
      };
    }
    case 'hotel': {
      return {
        openingHours: rawHours || '24 Hours Front Desk / Check-in 12:00 PM',
        entryFee: 'Room Booking Required',
        entryFeeNumber: 0,
        estimatedDuration: 'Overnight Stay',
        estimatedCost: 1500,
      };
    }
    case 'attraction':
    default: {
      const openingHours = rawHours || '09:00 AM – 06:00 PM (Daily)';
      const entryFee = rawCharge || (rawFee === 'no' ? 'Free Entry' : '₹40 / Person');
      const entryFeeNumber = rawFee === 'no' ? 0 : 40;
      return {
        openingHours,
        entryFee,
        entryFeeNumber,
        estimatedDuration: '1.5 – 2 Hours',
        estimatedCost: entryFeeNumber + 60,
      };
    }
  }
}

function normaliseFeature(
  feature: GeoJsonFeature,
  category: PlaceCategory,
): PlaceResult | null {
  const props = feature.properties ?? {};
  const name =
    typeof props.name === 'string' && props.name.trim()
      ? props.name.trim()
      : null;

  if (!name) return null; // skip unnamed features
  if (!feature.geometry) return null;

  const point = extractPoint(feature.geometry);
  if (!point) return null;

  const [lng, lat] = point;
  if (typeof lng !== 'number' || typeof lat !== 'number') return null;
  if (isNaN(lng) || isNaN(lat)) return null;

  // OSM id comes from the feature id field or @id property
  const rawId =
    feature.id ??
    (typeof props['@id'] === 'string' ? props['@id'] : undefined);
  const id = rawId
    ? `geojson-${category}-${String(rawId).replace(/[^a-zA-Z0-9-]/g, '-')}`
    : `geojson-${category}-${lat.toFixed(6)}-${lng.toFixed(6)}`;

  const { city, state, country } = extractAddress(props);
  const defaults = getCategoryDefaults(category, props);

  return {
    id,
    name,
    category,
    city,
    state,
    country,
    latitude: lat,
    longitude: lng,
    openingHours: defaults.openingHours,
    entryFee: defaults.entryFee,
    entryFeeNumber: defaults.entryFeeNumber,
    estimatedDuration: defaults.estimatedDuration,
    estimatedCost: defaults.estimatedCost,
    source: 'geojson',
  };
}

// ── In-memory cache (so large files like temples are only parsed once) ────────

const _cache = new Map<PlaceCategory, PlaceResult[]>();

export function loadCategory(category: PlaceCategory): PlaceResult[] {
  if (_cache.has(category)) return _cache.get(category)!;

  const dataDir = resolveDataDir();
  const filePath = path.join(dataDir, FILE_MAP[category]);

  if (!fs.existsSync(filePath)) {
    console.warn(`[GeoJSON] File not found: ${filePath}`);
    _cache.set(category, []);
    return [];
  }

  try {
    console.log(`[GeoJSON] Loading ${filePath} …`);
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as GeoJsonFeatureCollection;
    const features = parsed.features ?? [];

    const results: PlaceResult[] = [];
    for (const f of features) {
      const place = normaliseFeature(f, category);
      if (place) results.push(place);
    }

    console.log(`[GeoJSON] Loaded ${results.length} named places for category "${category}"`);
    _cache.set(category, results);
    return results;
  } catch (err) {
    console.error(`[GeoJSON] Failed to parse ${filePath}:`, err);
    _cache.set(category, []);
    return [];
  }
}

/** Invalidate cache (useful for hot-reload in dev) */
export function clearCache(): void {
  _cache.clear();
}

/** Search GeoJSON places by text (name / city / state) */
export function searchGeoJsonByText(
  query: string,
  category?: PlaceCategory,
  limit = 10,
): PlaceResult[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  const categories = category ? [category] : VALID_CATEGORIES;
  const results: PlaceResult[] = [];

  for (const cat of categories) {
    const places = loadCategory(cat);
    for (const p of places) {
      if (
        p.name.toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q) ||
        p.state.toLowerCase().includes(q)
      ) {
        results.push(p);
        if (results.length >= limit * 3) break; // gather more, then trim
      }
    }
  }

  return results.slice(0, limit);
}

/** Filter GeoJSON places within a radius (in metres) of a lat/lng */
export function searchGeoJsonNearby(
  category: PlaceCategory,
  lat: number,
  lng: number,
  radiusMetres: number,
): PlaceResult[] {
  const places = loadCategory(category);
  const radiusKm = radiusMetres / 1000;

  return places
    .map((p) => ({
      ...p,
      distanceKm: haversineKm(lat, lng, p.latitude, p.longitude),
    }))
    .filter((p) => p.distanceKm! <= radiusKm)
    .sort((a, b) => a.distanceKm! - b.distanceKm!);
}

// ── Haversine ─────────────────────────────────────────────────────────────────

export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}
