/**
 * Overpass / OpenStreetMap Provider
 * Fetches tourist attractions, accommodations, and restaurants.
 */

import type {
  DataSource,
  HotelResult,
  RestaurantResult,
  TouristPlace,
} from '../models/types.js';
import {
  VALID_CATEGORIES,
  searchGeoJsonNearby,
  type PlaceResult,
  type PlaceCategory,
} from './geojson.js';

const NOMINATIM_USER_AGENT = process.env.NOMINATIM_USER_AGENT || 'SmartTrip AI/1.0';
const OVERPASS_TIMEOUT_MS = Number(process.env.OVERPASS_TIMEOUT_MS || 7000);
const OVERPASS_BASE_URL = process.env.OVERPASS_BASE_URL || 'https://overpass-api.de/api/interpreter';

const OVERPASS_MIRRORS = [
  OVERPASS_BASE_URL,
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

function nowIso(): string {
  return new Date().toISOString();
}

function expiresIn(m: number): string {
  return new Date(Date.now() + m * 60_000).toISOString();
}

function osmSource(live: boolean): DataSource {
  return {
    name: 'OpenStreetMap / Overpass (© OpenStreetMap contributors, ODbL 1.0)',
    sourceType: live ? 'provider' : 'unavailable',
    retrievedAt: nowIso(),
    expiresAt: expiresIn(live ? 60 : 0),
    url: 'https://www.openstreetmap.org',
  };
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return Math.round(6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

async function runOverpassQuery(query: string): Promise<{ elements?: OverpassElement[] }> {
  let lastErr = 'All Overpass mirrors failed.';
  for (const mirror of OVERPASS_MIRRORS) {
    try {
      const res = await fetch(mirror, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': NOMINATIM_USER_AGENT,
        },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(OVERPASS_TIMEOUT_MS),
      });
      if (!res.ok) {
        lastErr = `Mirror ${mirror} → HTTP ${res.status}`;
        continue;
      }
      return (await res.json()) as { elements?: OverpassElement[] };
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err);
    }
  }
  throw new Error(`Overpass unavailable: ${lastErr}`);
}

export async function searchAttractions(
  lat: number,
  lng: number,
  radiusMeters: number = 15000,
  interests: string[] = [],
): Promise<TouristPlace[]> {
  const tagFilters = [
    '[tourism~"attraction|museum|viewpoint|gallery|theme_park|zoo|aquarium|artwork"]',
    '[historic]',
    '[natural~"waterfall|peak|beach|cave_entrance|cliff|bay|hot_spring"]',
    '[leisure~"park|nature_reserve|garden"]',
  ];

  if (interests.includes('Wildlife')) {
    tagFilters.push('[leisure~"zoo|wildlife_hide"]');
  }
  if (interests.includes('Temples') || interests.includes('Spiritual')) {
    tagFilters.push('[religion]');
  }

  const lines: string[] = [];
  const r = Math.min(Math.max(radiusMeters, 500), 50000);
  for (const tag of tagFilters) {
    lines.push(`  node(around:${r},${lat},${lng})${tag};`);
    lines.push(`  way(around:${r},${lat},${lng})${tag};`);
  }

  const query = `[out:json][timeout:20];\n(\n${lines.join('\n')}\n);\nout center tags;`;

  try {
    const data = await runOverpassQuery(query);
    const source = osmSource(true);
    const seen = new Set<string>();

    return (data.elements ?? [])
      .flatMap((el): TouristPlace[] => {
        const pLat = el.lat ?? el.center?.lat;
        const pLng = el.lon ?? el.center?.lon;
        const tags = el.tags ?? {};
        if (pLat === undefined || pLng === undefined || !tags.name) return [];

        const id = `osm-${el.type}-${el.id}`;
        if (seen.has(id)) return [];
        seen.add(id);

        const category =
          tags.tourism ?? tags.historic ?? tags.leisure ??
          tags.natural ?? tags.amenity ?? 'place';

        const address = [
          tags['addr:street'],
          tags['addr:city'] ?? tags['addr:town'] ?? tags['addr:village'],
        ].filter(Boolean).join(', ');

        return [{
          placeId: id,
          name: tags.name,
          category,
          latitude: pLat,
          longitude: pLng,
          address: address || undefined,
          openingHours: tags.opening_hours,
          distanceKm: haversineKm(lat, lng, pLat, pLng),
          entryFee: tags.fee === 'no' ? 0 : tags.charge ? Number(tags.charge.replace(/[^0-9.]/g, '')) || null : null,
          entryFeeSource: tags.fee === 'yes' && tags.charge ? 'provider' : 'unknown',
          hasFeeData: !!(tags.fee === 'yes' && tags.charge),
          source,
        }];
      })
      .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))
      .slice(0, 30);
  } catch (error) {
    console.error('Overpass attractions error:', error);
    return [];
  }
}

export async function searchHotels(
  lat: number,
  lng: number,
  radiusMeters: number = 10000,
): Promise<HotelResult[]> {
  const query = `[out:json][timeout:15];\n(\n  node(around:${radiusMeters},${lat},${lng})[tourism~"hotel|guest_house|hostel|resort"];\n  way(around:${radiusMeters},${lat},${lng})[tourism~"hotel|guest_house|hostel|resort"];\n);\nout center tags;`;

  try {
    const data = await runOverpassQuery(query);
    const source = osmSource(true);
    const seen = new Set<string>();

    return (data.elements ?? [])
      .flatMap((el): HotelResult[] => {
        const pLat = el.lat ?? el.center?.lat;
        const pLng = el.lon ?? el.center?.lon;
        const tags = el.tags ?? {};
        if (!tags.name || pLat === undefined || pLng === undefined) return [];

        const id = `osm-${el.type}-${el.id}`;
        if (seen.has(id)) return [];
        seen.add(id);

        const address = [
          tags['addr:street'],
          tags['addr:housenumber'],
          tags['addr:city'] ?? tags['addr:town'],
        ].filter(Boolean).join(', ');

        return [{
          placeId: id,
          name: tags.name,
          address: address || undefined,
          latitude: pLat,
          longitude: pLng,
          starRating: tags.stars ? Number(tags.stars) : undefined,
          roomType: tags.tourism ?? 'hotel',
          pricePerNight: null,
          price: null,
          availability: 'price_unavailable',
          amenities: [
            tags.internet_access === 'wlan' ? 'WiFi' : undefined,
            tags.swimming_pool === 'yes' ? 'Swimming pool' : undefined,
            tags.parking === 'yes' ? 'Parking' : undefined,
            tags.air_conditioning === 'yes' ? 'AC' : undefined,
            tags.restaurant === 'yes' ? 'Restaurant' : undefined,
          ].filter((a): a is string => !!a),
          source,
        }];
      })
      .slice(0, 20);
  } catch (error) {
    console.error('Overpass hotels error:', error);
    return [];
  }
}

export async function searchRestaurants(
  lat: number,
  lng: number,
  radiusMeters: number = 5000,
): Promise<RestaurantResult[]> {
  const query = `[out:json][timeout:15];\n(\n  node(around:${radiusMeters},${lat},${lng})[amenity~"restaurant|cafe|fast_food"];\n  way(around:${radiusMeters},${lat},${lng})[amenity~"restaurant|cafe|fast_food"];\n);\nout center tags;`;

  try {
    const data = await runOverpassQuery(query);
    const source = osmSource(true);
    const seen = new Set<string>();

    return (data.elements ?? [])
      .flatMap((el): RestaurantResult[] => {
        const pLat = el.lat ?? el.center?.lat;
        const pLng = el.lon ?? el.center?.lon;
        const tags = el.tags ?? {};
        if (!tags.name || pLat === undefined || pLng === undefined) return [];

        const id = `osm-${el.type}-${el.id}`;
        if (seen.has(id)) return [];
        seen.add(id);

        return [{
          placeId: id,
          name: tags.name,
          cuisine: tags.cuisine?.replace(/_/g, ' '),
          latitude: pLat,
          longitude: pLng,
          priceLevel: undefined,
          mealCostPerPerson: null,
          price: null,
          source,
        }];
      })
      .slice(0, 20);
  } catch (error) {
    console.error('Overpass restaurants error:', error);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════
// Category-specific Overpass search functions → return PlaceResult[]
// ═══════════════════════════════════════════════════════════════════

/**
 * Generic helper: run an Overpass query and normalise results to PlaceResult[]
 */
async function overpassToPlaceResults(
  category: PlaceCategory,
  query: string,
  refLat: number,
  refLng: number,
): Promise<PlaceResult[]> {
  const data = await runOverpassQuery(query);
  const seen = new Set<string>();

  const results: PlaceResult[] = [];
  for (const el of data.elements ?? []) {
    const pLat = el.lat ?? el.center?.lat;
    const pLng = el.lon ?? el.center?.lon;
    const tags = el.tags ?? {};
    if (!tags.name || pLat === undefined || pLng === undefined) continue;

    const id = `overpass-${category}-${el.type}-${el.id}`;
    if (seen.has(id)) continue;
    seen.add(id);

    const city =
      tags['addr:city'] ??
      tags['addr:town'] ??
      tags['addr:village'] ??
      tags['addr:district'] ??
      '';
    const state = tags['addr:state'] ?? tags['addr:province'] ?? '';
    const country = tags['addr:country'] ?? 'India';

    results.push({
      id,
      name: tags.name,
      category,
      city,
      state,
      country,
      latitude: pLat,
      longitude: pLng,
      distanceKm: haversineKm(refLat, refLng, pLat, pLng),
      source: 'overpass',
    });
  }

  return results.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
}

export async function searchTemples(
  lat: number,
  lng: number,
  radiusMeters = 10000,
): Promise<PlaceResult[]> {
  const r = Math.min(Math.max(radiusMeters, 500), 50000);
  const query = `[out:json][timeout:20];
(
  node(around:${r},${lat},${lng})["amenity"="place_of_worship"]["religion"="hindu"];
  way(around:${r},${lat},${lng})["amenity"="place_of_worship"]["religion"="hindu"];
  relation(around:${r},${lat},${lng})["amenity"="place_of_worship"]["religion"="hindu"];
);
out center tags;`;
  return overpassToPlaceResults('temple', query, lat, lng);
}

export async function searchBeaches(
  lat: number,
  lng: number,
  radiusMeters = 20000,
): Promise<PlaceResult[]> {
  const r = Math.min(Math.max(radiusMeters, 500), 100000);
  const query = `[out:json][timeout:20];
(
  node(around:${r},${lat},${lng})["natural"="beach"];
  way(around:${r},${lat},${lng})["natural"="beach"];
  relation(around:${r},${lat},${lng})["natural"="beach"];
);
out center tags;`;
  return overpassToPlaceResults('beach', query, lat, lng);
}

export async function searchAttractionsByCategory(
  lat: number,
  lng: number,
  radiusMeters = 15000,
): Promise<PlaceResult[]> {
  const r = Math.min(Math.max(radiusMeters, 500), 50000);
  const query = `[out:json][timeout:20];
(
  node(around:${r},${lat},${lng})["tourism"="attraction"];
  way(around:${r},${lat},${lng})["tourism"="attraction"];
  relation(around:${r},${lat},${lng})["tourism"="attraction"];
);
out center tags;`;
  return overpassToPlaceResults('attraction', query, lat, lng);
}

export async function searchViewpoints(
  lat: number,
  lng: number,
  radiusMeters = 15000,
): Promise<PlaceResult[]> {
  const r = Math.min(Math.max(radiusMeters, 500), 50000);
  const query = `[out:json][timeout:20];
(
  node(around:${r},${lat},${lng})["tourism"="viewpoint"];
  way(around:${r},${lat},${lng})["tourism"="viewpoint"];
  relation(around:${r},${lat},${lng})["tourism"="viewpoint"];
);
out center tags;`;
  return overpassToPlaceResults('viewpoint', query, lat, lng);
}

export async function searchCafes(
  lat: number,
  lng: number,
  radiusMeters = 5000,
): Promise<PlaceResult[]> {
  const r = Math.min(Math.max(radiusMeters, 500), 50000);
  const query = `[out:json][timeout:20];
(
  node(around:${r},${lat},${lng})["amenity"="cafe"];
  way(around:${r},${lat},${lng})["amenity"="cafe"];
);
out center tags;`;
  return overpassToPlaceResults('cafe', query, lat, lng);
}

export async function searchHotelsByCategory(
  lat: number,
  lng: number,
  radiusMeters = 10000,
): Promise<PlaceResult[]> {
  const r = Math.min(Math.max(radiusMeters, 500), 50000);
  const query = `[out:json][timeout:20];
(
  node(around:${r},${lat},${lng})["tourism"="hotel"];
  way(around:${r},${lat},${lng})["tourism"="hotel"];
  relation(around:${r},${lat},${lng})["tourism"="hotel"];
);
out center tags;`;
  return overpassToPlaceResults('hotel', query, lat, lng);
}

export async function searchMuseums(
  lat: number,
  lng: number,
  radiusMeters = 15000,
): Promise<PlaceResult[]> {
  const r = Math.min(Math.max(radiusMeters, 500), 50000);
  const query = `[out:json][timeout:20];
(
  node(around:${r},${lat},${lng})["tourism"="museum"];
  way(around:${r},${lat},${lng})["tourism"="museum"];
  relation(around:${r},${lat},${lng})["tourism"="museum"];
);
out center tags;`;
  return overpassToPlaceResults('museum', query, lat, lng);
}

// ── Overpass Category Dispatcher & Unified Places Fetcher ────────────────────

export async function runOverpassForCategory(
  category: PlaceCategory,
  lat: number,
  lng: number,
  radius: number,
): Promise<PlaceResult[]> {
  const timeout = new Promise<PlaceResult[]>((_, reject) =>
    setTimeout(() => reject(new Error('Overpass timeout')), OVERPASS_TIMEOUT_MS + 5000),
  );

  const search = (() => {
    switch (category) {
      case 'temple':     return searchTemples(lat, lng, radius);
      case 'beach':      return searchBeaches(lat, lng, radius);
      case 'attraction': return searchAttractionsByCategory(lat, lng, radius);
      case 'viewpoint':  return searchViewpoints(lat, lng, radius);
      case 'cafe':       return searchCafes(lat, lng, radius);
      case 'hotel':      return searchHotelsByCategory(lat, lng, radius);
      case 'museum':     return searchMuseums(lat, lng, radius);
    }
  })();

  return Promise.race([search, timeout]);
}

export function deduplicate(
  overpassResults: PlaceResult[],
  geojsonResults: PlaceResult[],
): PlaceResult[] {
  const combined: PlaceResult[] = [];
  const seen = new Set<string>();

  const normKey = (name: string, lat: number, lng: number) =>
    `${name.toLowerCase().replace(/\s+/g, '')}|${lat.toFixed(3)}|${lng.toFixed(3)}`;

  for (const p of [...overpassResults, ...geojsonResults]) {
    const key = normKey(p.name, p.latitude, p.longitude);
    if (!seen.has(key)) {
      seen.add(key);
      combined.push(p);
    }
  }

  return combined;
}

export async function fetchPlacesForCategory(
  category: PlaceCategory,
  lat: number,
  lng: number,
  radiusMeters = 15000,
): Promise<{ places: PlaceResult[]; overpassUsed: boolean }> {
  // 1. GeoJSON results (instant local files)
  const geojsonResults = searchGeoJsonNearby(category, lat, lng, radiusMeters);

  // 2. Overpass results (with timeout & mirror fallback)
  let overpassResults: PlaceResult[] = [];
  let overpassUsed = false;
  try {
    overpassResults = await runOverpassForCategory(category, lat, lng, radiusMeters);
    overpassUsed = true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[Attractions] Overpass failed for category "${category}": ${msg}. Using GeoJSON fallback.`);
  }

  // 3. Combine + deduplicate
  const combined = deduplicate(overpassResults, geojsonResults);

  // 4. Ensure distanceKm is set and sort nearest first
  const sorted = combined
    .map((p) => ({
      ...p,
      distanceKm: p.distanceKm ?? haversineKm(lat, lng, p.latitude, p.longitude),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm);

  return { places: sorted, overpassUsed };
}

export function mapInterestsToCategories(interests: string[]): PlaceCategory[] {
  if (!interests || interests.length === 0) {
    return ['attraction', 'viewpoint', 'cafe', 'temple', 'museum', 'beach'];
  }

  const categorySet = new Set<PlaceCategory>();
  for (const raw of interests) {
    const item = raw.toLowerCase().trim();
    if (VALID_CATEGORIES.includes(item as PlaceCategory)) {
      categorySet.add(item as PlaceCategory);
      continue;
    }
    if (item.includes('beach')) categorySet.add('beach');
    else if (item.includes('temple') || item.includes('spiritual')) categorySet.add('temple');
    else if (item.includes('cafe') || item.includes('food') || item.includes('restaurant')) categorySet.add('cafe');
    else if (item.includes('view') || item.includes('scenic') || item.includes('mountain')) categorySet.add('viewpoint');
    else if (item.includes('museum') || item.includes('history') || item.includes('culture') || item.includes('heritage')) categorySet.add('museum');
    else if (item.includes('hotel') || item.includes('stay') || item.includes('resort')) categorySet.add('hotel');
    else if (item.includes('attraction') || item.includes('nature') || item.includes('adventure') || item.includes('wildlife')) categorySet.add('attraction');
  }

  if (categorySet.size === 0) {
    return ['attraction', 'viewpoint', 'cafe', 'temple', 'museum', 'beach'];
  }

  return Array.from(categorySet);
}

export async function fetchPlacesForInterests(
  interests: string[],
  lat: number,
  lng: number,
  radiusMeters = 25000,
): Promise<{ places: PlaceResult[]; byCategory: Record<string, PlaceResult[]> }> {
  const categories = mapInterestsToCategories(interests);
  const byCategory: Record<string, PlaceResult[]> = {};
  const allPlaces: PlaceResult[] = [];

  const categoryPromises = categories.map(async (cat) => {
    try {
      const { places } = await fetchPlacesForCategory(cat, lat, lng, radiusMeters);
      return { cat, places };
    } catch (err) {
      console.warn(`Failed to fetch places for category ${cat}:`, err);
      return { cat, places: [] };
    }
  });

  const results = await Promise.all(categoryPromises);
  for (const { cat, places } of results) {
    byCategory[cat] = places;
    allPlaces.push(...places);
  }

  const uniquePlaces: PlaceResult[] = [];
  const seenIds = new Set<string>();
  for (const p of allPlaces) {
    if (!seenIds.has(p.id)) {
      seenIds.add(p.id);
      uniquePlaces.push(p);
    }
  }

  return {
    places: uniquePlaces.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0)),
    byCategory,
  };
}
