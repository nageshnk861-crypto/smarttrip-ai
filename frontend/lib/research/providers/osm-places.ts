/**
 * lib/research/providers/osm-places.ts
 *
 * OpenStreetMap / Overpass providers for:
 *   - Tourist places (attractions, museums, viewpoints, parks, natural features)
 *   - Food (restaurants, cafes, fast food — name + cuisine tag only, no prices)
 *   - Accommodation (hotels, hostels, guesthouses — name + type only, no booking prices)
 *
 * IMPORTANT DESIGN DECISIONS:
 * - OSM does NOT provide live hotel booking prices.
 *   pricePerNight is always null/unavailable from this provider.
 * - OSM does NOT provide menu-level food pricing.
 *   mealCostPerPerson is always null/unavailable from this provider.
 * - These facts are communicated clearly in the returned data so the UI
 *   can show "Booking price unavailable from this free data source."
 *
 * All data is public OpenStreetMap data under ODbL 1.0.
 * Attribution: © OpenStreetMap contributors.
 */

import type {
  AccommodationResearch,
  DataSource,
  FoodResearch,
  HotelResult,
  PlacesResearch,
  ResearchRequest,
  RestaurantResult,
  TouristPlace,
} from '../types';
import type {
  HotelProvider,
  FoodProvider,
  TouristPlacesProvider,
} from './interfaces';
import {
  NOMINATIM_USER_AGENT,
  OVERPASS_BASE_URL,
  OVERPASS_TIMEOUT_MS,
  OVERPASS_NEARBY_LIMIT,
} from '../../config';

// ─── Shared helpers ───────────────────────────────────────────────────────────

const OVERPASS_MIRRORS = [
  OVERPASS_BASE_URL,
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

function nowIso() { return new Date().toISOString(); }
function expiresIn(m: number) { return new Date(Date.now() + m * 60_000).toISOString(); }

function osmSource(live: boolean): DataSource {
  return {
    name: 'OpenStreetMap / Overpass (© OpenStreetMap contributors, ODbL 1.0)',
    sourceType: live ? 'provider' : 'unavailable' as import('../types').SourceType,
    retrievedAt: nowIso(),
    expiresAt: expiresIn(live ? 60 : 0),
    url: 'https://www.openstreetmap.org',
  };
}

function unavailableSource(reason: string): DataSource {
  return {
    name: reason,
    sourceType: 'unavailable' as import('../types').SourceType,
    retrievedAt: nowIso(),
  };
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
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

// ─── Overpass query builder ───────────────────────────────────────────────────

type OverpassElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

type OverpassResponse = { elements?: OverpassElement[] };

/**
 * Builds a bounding-box or radius Overpass query for specific tag groups.
 * Uses bounding-box search when a bbox is provided and is "large" (region/country).
 */
function buildOverpassQuery(
  lat: number,
  lng: number,
  tagFilters: string[],
  options: {
    radius?: number;
    boundingBox?: [number, number, number, number];
    timeoutSec?: number;
  },
): string {
  const timeout = options.timeoutSec ?? 20;

  // Use bounding box when available and the area is large (> 30 km wide)
  const useBbox =
    options.boundingBox !== undefined &&
    (() => {
      const [s, , w, e] = options.boundingBox!;
      const widthKm = haversineKm(s, w, s, e);
      return widthKm > 30;
    })();

  const lines: string[] = [];

  if (useBbox) {
    const [south, north, west, east] = options.boundingBox!;
    const bbox = `${south},${west},${north},${east}`;
    for (const tag of tagFilters) {
      lines.push(`  node(${bbox})${tag};`);
      lines.push(`  way(${bbox})${tag};`);
      lines.push(`  relation(${bbox})${tag};`);
    }
  } else {
    const r = Math.min(Math.max(options.radius ?? 10_000, 500), 50_000);
    for (const tag of tagFilters) {
      lines.push(`  node(around:${r},${lat},${lng})${tag};`);
      lines.push(`  way(around:${r},${lat},${lng})${tag};`);
    }
  }

  return `[out:json][timeout:${timeout}];\n(\n${lines.join('\n')}\n);\nout center tags;`;
}

async function runOverpassQuery(query: string): Promise<OverpassResponse> {
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
      if (!res.ok) { lastErr = `Mirror ${mirror} → HTTP ${res.status}`; continue; }
      return (await res.json()) as OverpassResponse;
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err);
    }
  }
  throw new Error(`Overpass unavailable: ${lastErr}`);
}

// ─── OSM Tourist Places provider ─────────────────────────────────────────────

export class OsmTouristPlacesProvider implements TouristPlacesProvider {
  readonly name = 'OpenStreetMap (tourist places)';

  async search(req: ResearchRequest): Promise<PlacesResearch> {
    const unavailable = (): PlacesResearch => ({
      destination: req.destination,
      places: [],
      hasLiveData: false,
      source: unavailableSource('Overpass API unavailable'),
    });

    const tagFilters = [
      '[tourism~"attraction|museum|viewpoint|gallery|hotel|hostel|guest_house|theme_park|zoo|aquarium|artwork"]',
      '[historic]',
      '[natural~"waterfall|peak|beach|cave_entrance|cliff|bay|hot_spring"]',
      '[leisure~"park|nature_reserve|garden"]',
      '[amenity~"restaurant|cafe|place_of_worship|theatre|arts_centre|cinema"]',
    ];

    // Add interest-specific tags
    if (req.interests.includes('Wildlife')) {
      tagFilters.push('[leisure~"zoo|wildlife_hide"]');
    }
    if (req.interests.includes('Temples') || req.interests.includes('Spiritual')) {
      tagFilters.push('[religion]');
    }

    const query = buildOverpassQuery(req.latitude, req.longitude, tagFilters, {
      radius: 15_000,
      boundingBox: req.boundingBox,
      timeoutSec: 20,
    });

    try {
      const data = await runOverpassQuery(query);
      const source = osmSource(true);
      const seen = new Set<string>();

      const places: TouristPlace[] = (data.elements ?? [])
        .flatMap((el): TouristPlace[] => {
          const lat = el.lat ?? el.center?.lat;
          const lng = el.lon ?? el.center?.lon;
          const tags = el.tags ?? {};
          if (lat === undefined || lng === undefined || !tags.name) return [];

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
            latitude: lat,
            longitude: lng,
            address: address || undefined,
            openingHours: tags.opening_hours,
            distanceKm: haversineKm(req.latitude, req.longitude, lat, lng),
            // OSM rarely has entry fee data — do not fabricate one
            entryFee: null,
            entryFeeSource: tags.fee === 'yes' && tags.charge ? 'provider' : 'unknown',
            hasFeeData: !!(tags.fee === 'yes' && tags.charge),
            source,
          }];
        })
        .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))
        .slice(0, OVERPASS_NEARBY_LIMIT);

      return {
        destination: req.destination,
        places,
        hasLiveData: places.length > 0,
        source,
      };
    } catch {
      return unavailable();
    }
  }
}

// ─── OSM Hotel / Accommodation provider ──────────────────────────────────────

export class OsmHotelProvider implements HotelProvider {
  readonly name = 'OpenStreetMap (accommodation)';

  async search(req: ResearchRequest): Promise<AccommodationResearch> {
    const tier = req.preferences.accommodation;

    const unavailable = (): AccommodationResearch => ({
      available: false,
      hasLiveData: false,
      results: [],
      priceRange: { min: 0, max: 0, currency: req.currency },
      availability: 'price_unavailable',
      nights: req.days,
      tier,
      source: unavailableSource('Overpass API unavailable'),
    });

    // Tag filters for accommodation types
    const tierTagMap: Record<string, string[]> = {
      budget: [
        '[tourism~"hostel|camp_site|caravan_site|guest_house|apartment"]',
        '[amenity~"hostel|guesthouse"]',
      ],
      standard: [
        '[tourism~"hotel|guest_house|motel|apartment"]',
        '[amenity~"hotel"]',
      ],
      premium: [
        '[tourism~"hotel|resort|boutique_hotel"]',
        '[stars]',
      ],
    };
    const tagFilters = tierTagMap[tier] ?? tierTagMap.standard;

    const query = buildOverpassQuery(req.latitude, req.longitude, tagFilters, {
      radius: 10_000,
      boundingBox: req.boundingBox,
      timeoutSec: 15,
    });

    try {
      const data = await runOverpassQuery(query);
      const source = osmSource(true);
      const seen = new Set<string>();

      const results: HotelResult[] = (data.elements ?? [])
        .flatMap((el): HotelResult[] => {
          const lat = el.lat ?? el.center?.lat;
          const lng = el.lon ?? el.center?.lon;
          const tags = el.tags ?? {};
          if (!tags.name) return [];

          const id = `osm-${el.type}-${el.id}`;
          if (seen.has(id)) return [];
          seen.add(id);

          const address = [
            tags['addr:street'],
            tags['addr:housenumber'],
            tags['addr:city'] ?? tags['addr:town'],
            tags['addr:postcode'],
          ].filter(Boolean).join(', ');

          return [{
            placeId: id,
            name: tags.name,
            address: address || tags['addr:full'] || undefined,
            latitude: lat,
            longitude: lng,
            starRating: tags.stars ? Number(tags.stars) : undefined,
            roomType: tags.tourism ?? tags.amenity,
            // OSM does NOT provide booking prices.
            // pricePerNight and price are null with availability = 'price_unavailable'.
            pricePerNight: null,
            price: null,
            availability: 'price_unavailable',
            amenities: [
              tags.internet_access === 'wlan' ? 'WiFi' : undefined,
              tags.swimming_pool === 'yes' ? 'Swimming pool' : undefined,
              tags.parking === 'yes' ? 'Parking' : undefined,
              tags.air_conditioning === 'yes' ? 'Air conditioning' : undefined,
              tags.restaurant === 'yes' ? 'Restaurant' : undefined,
            ].filter((a): a is string => !!a),
            source: {
              ...source,
              name: source.name + ' — booking price unavailable from OSM',
            },
          }];
        })
        .slice(0, 10);

      return {
        available: results.length > 0,
        hasLiveData: results.length > 0,
        results,
        // priceRange is 0/0 because OSM has no pricing — budget engine will track as estimated
        priceRange: { min: 0, max: 0, currency: req.currency },
        availability: 'price_unavailable',
        nights: req.days,
        tier,
        source,
      };
    } catch {
      return unavailable();
    }
  }
}

// ─── OSM Food / Restaurant provider ──────────────────────────────────────────

export class OsmFoodProvider implements FoodProvider {
  readonly name = 'OpenStreetMap (restaurants & cafes)';

  async search(req: ResearchRequest): Promise<FoodResearch> {
    const tier = req.preferences.food;

    const unavailable = (): FoodResearch => ({
      available: false,
      hasLiveData: false,
      restaurants: [],
      dailyCostPerPerson: { min: 0, max: 0, currency: req.currency },
      tier,
      source: unavailableSource('Overpass API unavailable'),
    });

    const tagFilters = [
      '[amenity~"restaurant|cafe|fast_food|food_court|bar"]',
      '[shop~"bakery|deli|pastry"]',
    ];

    const query = buildOverpassQuery(req.latitude, req.longitude, tagFilters, {
      radius: 5_000,
      boundingBox: undefined, // food search always uses radius (local scope)
      timeoutSec: 15,
    });

    try {
      const data = await runOverpassQuery(query);
      const source = osmSource(true);
      const seen = new Set<string>();

      const restaurants: RestaurantResult[] = (data.elements ?? [])
        .flatMap((el): RestaurantResult[] => {
          const lat = el.lat ?? el.center?.lat;
          const lng = el.lon ?? el.center?.lon;
          const tags = el.tags ?? {};
          if (!tags.name) return [];

          const id = `osm-${el.type}-${el.id}`;
          if (seen.has(id)) return [];
          seen.add(id);

          const address = [
            tags['addr:street'],
            tags['addr:city'] ?? tags['addr:town'],
          ].filter(Boolean).join(', ');

          return [{
            placeId: id,
            name: tags.name,
            cuisine: tags.cuisine?.replace(/_/g, ' '),
            address: address || undefined,
            latitude: lat,
            longitude: lng,
            // OSM does NOT provide menu prices.
            // priceLevel is undefined; mealCostPerPerson and price are null.
            // The UI shows "Price unavailable" rather than inventing a cost.
            priceLevel: undefined,
            mealCostPerPerson: null,
            price: null,
            source: {
              ...source,
              name: source.name + ' — menu price unavailable from OSM',
            },
          }];
        })
        .slice(0, 15);

      return {
        available: restaurants.length > 0,
        hasLiveData: restaurants.length > 0,
        restaurants,
        // dailyCostPerPerson is 0/0 because OSM has no food pricing.
        dailyCostPerPerson: { min: 0, max: 0, currency: req.currency },
        tier,
        source,
      };
    } catch {
      return unavailable();
    }
  }
}
