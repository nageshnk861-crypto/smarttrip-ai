import {
  NOMINATIM_BASE_URL,
  NOMINATIM_TIMEOUT_MS,
  NOMINATIM_RESULT_LIMIT,
  NOMINATIM_USER_AGENT,
  OVERPASS_BASE_URL,
  OVERPASS_TIMEOUT_MS,
  OVERPASS_NEARBY_LIMIT,
  OVERPASS_RADIUS_MIN,
  OVERPASS_RADIUS_MAX,
  GOOGLE_PLACES_API_BASE,
} from '../config';
import type { BoundingBox } from '../planner/types';

// ─── Shared types ────────────────────────────────────────────────────────────

export type PlacePrediction = {
  place_id: string;
  description: string;
  name?: string;
  displayName?: string;
  latitude?: number;
  longitude?: number;
  city?: string;
  state?: string;
  country?: string;
  countryCode?: string;
  type?: string;
  /** Raw OSM type: 'node' | 'way' | 'relation'. Used to decide area vs radius search. */
  osmType?: string;
  /** Geographic bounding box [south, north, west, east]. Present for regions/countries. */
  boundingBox?: BoundingBox;
  structured_formatting?: {
    main_text?: string;
    secondary_text?: string;
  };
};

export type PlaceDetails = {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry?: {
    location?: {
      lat?: number;
      lng?: number;
    };
  };
  city?: string;
  state?: string;
  country?: string;
  countryCode?: string;
  osmType?: string;
  boundingBox?: BoundingBox;
};

export type PlaceSuggestion = {
  place_id: string;
  description: string;
  name?: string;
  category?: string;
  latitude?: number;
  longitude?: number;
  distance?: number;
  address?: string;
  source?: string;
  structured_formatting?: {
    main_text?: string;
    secondary_text?: string;
  };
  matched_substrings?: Array<{ length: number; offset: number }>;
};

export type GoogleNearbyResult = {
  place_id: string;
  name: string;
  vicinity?: string;
  geometry?: { location?: { lat?: number; lng?: number } };
  rating?: number;
  user_ratings_total?: number;
  types?: string[];
};

export type GoogleNearbyResponse = {
  status?: string;
  results?: GoogleNearbyResult[];
  error_message?: string;
};

export interface PlacesProvider {
  readonly name: 'google' | 'nominatim';
  autocomplete(input: string): Promise<PlacePrediction[]>;
  details(placeId: string): Promise<PlaceDetails | null>;
  nearby(
    lat: number,
    lng: number,
    options?: NearbyOptions,
  ): Promise<PlaceSuggestion[]>;
}

/** Options for the nearby() call — allows region/country bounding-box search. */
export type NearbyOptions = {
  /** Search radius in metres (used for city/point destinations). Default 5000. */
  radius?: number;
  /** Interest keywords used to filter OSM tags (e.g. ['Nature', 'History']). */
  interests?: string[];
  /**
   * Bounding box [south, north, west, east] of the destination.
   * When present, an area-based Overpass query is used instead of radius.
   */
  boundingBox?: BoundingBox;
  /** Raw OSM type from Nominatim ('node' | 'way' | 'relation'). */
  osmType?: string;
};

// ─── Interest → OSM tag mapping ──────────────────────────────────────────────

/**
 * Maps user-facing interest keywords to Overpass tag filters.
 * Each entry produces one or more `[tag=value]` / `[tag~"..."]` clauses.
 * No destination names are hardcoded here — this is purely tag logic.
 */
const INTEREST_TAG_GROUPS: Record<string, string[]> = {
  Nature:        ['[tourism=viewpoint]', '[natural~"peak|volcano|waterfall|bay|cave_entrance|cliff"]', '[leisure=nature_reserve]'],
  Beaches:       ['[natural=beach]', '[leisure=beach_resort]'],
  Mountains:     ['[natural~"peak|ridge|cliff|valley"]', '[tourism=viewpoint]'],
  History:       ['[historic~"castle|palace|monument|memorial|ruins|archaeological_site|fort|battlefield"]', '[tourism=museum]'],
  Culture:       ['[tourism~"museum|gallery|artwork"]', '[amenity~"theatre|cinema|arts_centre"]', '[historic=building]'],
  Temples:       ['[amenity=place_of_worship]', '[historic~"temple|monastery|shrine"]'],
  Wildlife:      ['[leisure~"zoo|wildlife_hide|nature_reserve"]', '[tourism=zoo]'],
  Adventure:     ['[leisure~"climbing|water_park|slipway"]', '[sport~"climbing|paragliding|rafting|surfing"]'],
  Food:          ['[amenity~"restaurant|cafe|marketplace|food_court"]', '[tourism=restaurant]'],
  Shopping:      ['[shop~"mall|market|department_store"]', '[tourism=shopping_mall]'],
  Photography:   ['[tourism~"viewpoint|attraction|artwork"]', '[natural~"peak|waterfall|beach"]'],
  Architecture:  ['[historic~"building|castle|palace|cathedral|mosque|church"]', '[tourism~"attraction|museum"]'],
  Nightlife:     ['[amenity~"bar|nightclub|pub|casino"]'],
  Wellness:      ['[leisure~"spa|swimming_pool|sports_centre"]', '[amenity~"spa|sauna"]'],
  Relaxation:    ['[tourism~"resort|hotel|viewpoint"]', '[leisure~"beach_resort|spa|park"]'],
  Museums:       ['[tourism=museum]', '[historic~"museum|gallery"]'],
  Parks:         ['[leisure~"park|garden|nature_reserve"]', '[tourism=park]'],
};

/** Default tag groups used when no interests are specified. */
const DEFAULT_TAG_GROUPS = [
  '[tourism~"attraction|museum|viewpoint|gallery|theme_park|zoo|aquarium"]',
  '[historic~"castle|palace|monument|ruins|archaeological_site"]',
  '[natural~"peak|beach|waterfall"]',
  '[leisure=park]',
  '[amenity~"museum|place_of_worship"]',
];

function buildTagClauses(interests: string[]): string[] {
  if (!interests.length) return DEFAULT_TAG_GROUPS;
  const clauses = new Set<string>();
  for (const interest of interests) {
    const groups = INTEREST_TAG_GROUPS[interest];
    if (groups) groups.forEach((g) => clauses.add(g));
  }
  // Always include basic attractions as a safety net
  clauses.add('[tourism~"attraction|viewpoint"]');
  return [...clauses];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function distanceInKilometres(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
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

type NominatimResult = {
  place_id: number;
  osm_type: string;
  osm_id: number;
  display_name: string;
  lat: string;
  lon: string;
  name?: string;
  address?: Record<string, string>;
  boundingbox?: [string, string, string, string]; // [south, north, west, east]
};

type OverpassElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

type OverpassResponse = { elements?: OverpassElement[] };

function mapNominatimResult(place: NominatimResult): PlacePrediction {
  const address = place.address ?? {};
  const city = address.city ?? address.town ?? address.village ?? address.municipality;
  const state = address.state ?? address.state_district;
  const country = address.country;
  const countryCode = address.country_code?.toUpperCase();
  const secondaryText = [city, state, country].filter(Boolean).join(', ');

  // Parse Nominatim bounding box: [south, north, west, east] as strings
  let boundingBox: BoundingBox | undefined;
  if (place.boundingbox?.length === 4) {
    const [s, n, w, e] = place.boundingbox.map(Number);
    if ([s, n, w, e].every(Number.isFinite)) {
      boundingBox = [s, n, w, e];
    }
  }

  return {
    place_id: `nominatim-${place.osm_type}-${place.osm_id}`,
    description: place.display_name,
    name: place.name ?? place.display_name.split(',')[0],
    displayName: place.display_name,
    latitude: Number(place.lat),
    longitude: Number(place.lon),
    city,
    state,
    country,
    countryCode,
    osmType: place.osm_type,
    boundingBox,
    type:
      address.amenity ?? address.tourism ?? address.historic ??
      address.leisure ?? place.osm_type,
    structured_formatting: {
      main_text: place.name ?? place.display_name.split(',')[0],
      secondary_text: secondaryText || place.display_name,
    },
  };
}

/**
 * Decides whether a destination bounding box is "large" (region/country)
 * requiring an area-based search vs a small city/point needing radius search.
 * Threshold: ~50 km in either dimension.
 */
function isLargeRegion(bbox: BoundingBox): boolean {
  const [south, north, west, east] = bbox;
  const heightKm = distanceInKilometres(south, west, north, west);
  const widthKm = distanceInKilometres(south, west, south, east);
  return heightKm > 50 || widthKm > 50;
}

/**
 * Builds an Overpass QL query for either:
 *  - radius search (city/point): `node(around:R,lat,lng)[tag];`
 *  - bounding-box search (region): `node(south,west,north,east)[tag];`
 */
function buildOverpassQuery(
  lat: number,
  lng: number,
  tagClauses: string[],
  options: { radius?: number; boundingBox?: BoundingBox },
): string {
  const useBbox =
    options.boundingBox !== undefined && isLargeRegion(options.boundingBox);

  const lines: string[] = [];

  if (useBbox) {
    const [south, north, west, east] = options.boundingBox!;
    const bboxStr = `${south},${west},${north},${east}`;
    for (const tag of tagClauses) {
      // node + way + relation with center output
      lines.push(`  node(${bboxStr})${tag};`);
      lines.push(`  way(${bboxStr})${tag};`);
      lines.push(`  relation(${bboxStr})${tag};`);
    }
  } else {
    const r = Math.min(
      Math.max(options.radius ?? 5_000, OVERPASS_RADIUS_MIN),
      OVERPASS_RADIUS_MAX,
    );
    for (const tag of tagClauses) {
      lines.push(`  node(around:${r},${lat},${lng})${tag};`);
      lines.push(`  way(around:${r},${lat},${lng})${tag};`);
    }
  }

  // OSM timeout: 25 s for bbox queries (more data), 10 s for radius
  const timeout = useBbox ? 25 : 10;
  return `[out:json][timeout:${timeout}];\n(\n${lines.join('\n')}\n);\nout center tags;`;
}

// ─── Overpass mirrors ─────────────────────────────────────────────────────────

const OVERPASS_MIRRORS = [
  OVERPASS_BASE_URL,
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

async function runOverpassQuery(query: string): Promise<OverpassResponse> {
  let lastError: string = 'All Overpass mirrors failed.';

  for (const mirror of OVERPASS_MIRRORS) {
    try {
      const response = await fetch(mirror, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': NOMINATIM_USER_AGENT,
        },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(OVERPASS_TIMEOUT_MS),
      });
      if (!response.ok) {
        lastError = `Mirror ${mirror} responded with ${response.status}.`;
        continue;
      }
      return (await response.json()) as OverpassResponse;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      // Try next mirror.
    }
  }

  throw new Error(`Overpass unavailable: ${lastError}`);
}

function parseOverpassElements(
  elements: OverpassElement[],
  centerLat: number,
  centerLng: number,
): PlaceSuggestion[] {
  const seen = new Set<string>();

  return elements
    .flatMap((el): PlaceSuggestion[] => {
      const lat = el.lat ?? el.center?.lat;
      const lng = el.lon ?? el.center?.lon;
      const tags = el.tags ?? {};
      if (lat === undefined || lng === undefined || !tags.name) return [];

      const id = `overpass-${el.type}-${el.id}`;
      if (seen.has(id)) return [];
      seen.add(id);

      const category =
        tags.tourism ?? tags.historic ?? tags.leisure ??
        tags.natural ?? tags.amenity ?? tags.sport ?? 'place';

      const address = [
        tags['addr:street'],
        tags['addr:city'] ?? tags['addr:town'] ?? tags['addr:village'],
        tags['addr:country'],
      ]
        .filter(Boolean)
        .join(', ');

      return [
        {
          place_id: id,
          description: tags.name,
          name: tags.name,
          category,
          latitude: lat,
          longitude: lng,
          distance: distanceInKilometres(centerLat, centerLng, lat, lng),
          address: address || undefined,
          source: 'OpenStreetMap',
          structured_formatting: {
            main_text: tags.name,
            secondary_text: category,
          },
        },
      ];
    })
    .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity))
    .slice(0, OVERPASS_NEARBY_LIMIT);
}

// ─── NominatimProvider ───────────────────────────────────────────────────────

class NominatimProvider implements PlacesProvider {
  readonly name = 'nominatim' as const;

  private async request<T>(path: string, params: Record<string, string>): Promise<T> {
    const url = new URL(path, NOMINATIM_BASE_URL);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const response = await fetch(url, {
      headers: { 'User-Agent': NOMINATIM_USER_AGENT },
      signal: AbortSignal.timeout(NOMINATIM_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Nominatim request failed with ${response.status}.`);
    return response.json() as Promise<T>;
  }

  async autocomplete(input: string): Promise<PlacePrediction[]> {
    const results = await this.request<NominatimResult[]>('/search', {
      q: input.trim(),
      format: 'jsonv2',
      addressdetails: '1',
      limit: String(NOMINATIM_RESULT_LIMIT),
      'accept-language': 'en',
    });
    return results
      .filter((p) => Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lon)))
      .map(mapNominatimResult);
  }

  async details(placeId: string): Promise<PlaceDetails | null> {
    const match = placeId.match(/^nominatim-([^-]+)-(\d+)$/);
    if (!match) return null;
    const [, osmType, osmId] = match;
    const results = await this.request<NominatimResult[]>('/lookup', {
      osm_ids: `${osmType[0].toUpperCase()}${osmId}`,
      format: 'jsonv2',
      addressdetails: '1',
    });
    const place = results[0];
    if (!place) return null;
    const mapped = mapNominatimResult(place);
    return {
      place_id: mapped.place_id,
      name: mapped.name ?? mapped.description,
      formatted_address: mapped.displayName ?? mapped.description,
      geometry: { location: { lat: mapped.latitude, lng: mapped.longitude } },
      city: mapped.city,
      state: mapped.state,
      country: mapped.country,
      countryCode: mapped.countryCode,
      osmType: mapped.osmType,
      boundingBox: mapped.boundingBox,
    };
  }

  async nearby(
    lat: number,
    lng: number,
    options: NearbyOptions = {},
  ): Promise<PlaceSuggestion[]> {
    const interests = options.interests ?? [];
    const tagClauses = buildTagClauses(interests);
    const query = buildOverpassQuery(lat, lng, tagClauses, {
      radius: options.radius,
      boundingBox: options.boundingBox,
    });

    try {
      const data = await runOverpassQuery(query);
      return parseOverpassElements(data.elements ?? [], lat, lng);
    } catch {
      // All mirrors failed — return empty list so the plan can still proceed.
      return [];
    }
  }
}

// ─── GooglePlacesProvider ────────────────────────────────────────────────────

class GooglePlacesProvider implements PlacesProvider {
  readonly name = 'google' as const;

  constructor(private readonly apiKey: string) {}

  async autocomplete(input: string): Promise<PlacePrediction[]> {
    const url = new URL(`${GOOGLE_PLACES_API_BASE}/autocomplete/json`);
    url.searchParams.set('input', input);
    url.searchParams.set('key', this.apiKey);
    const response = await fetch(url, {
      signal: AbortSignal.timeout(NOMINATIM_TIMEOUT_MS),
    });
    const data = (await response.json()) as {
      status?: string;
      predictions?: PlacePrediction[];
      error_message?: string;
    };
    if (!response.ok || data.status !== 'OK') {
      throw new Error(data.error_message ?? 'Google Places autocomplete failed.');
    }
    return data.predictions ?? [];
  }

  async details(placeId: string): Promise<PlaceDetails | null> {
    const url = new URL(`${GOOGLE_PLACES_API_BASE}/details/json`);
    url.searchParams.set('place_id', placeId);
    url.searchParams.set('key', this.apiKey);
    url.searchParams.set('fields', 'formatted_address,geometry,name,address_components');
    const response = await fetch(url, {
      signal: AbortSignal.timeout(NOMINATIM_TIMEOUT_MS),
    });
    const data = (await response.json()) as {
      status?: string;
      result?: PlaceDetails & {
        address_components?: Array<{ long_name: string; types: string[] }>;
      };
      error_message?: string;
    };
    if (!response.ok || data.status !== 'OK') {
      throw new Error(data.error_message ?? 'Google Places details failed.');
    }
    if (!data.result) return null;
    const comps = data.result.address_components ?? [];
    return {
      ...data.result,
      city: comps.find((c) => c.types.includes('locality'))?.long_name,
      state: comps.find((c) => c.types.includes('administrative_area_level_1'))?.long_name,
      country: comps.find((c) => c.types.includes('country'))?.long_name,
      countryCode: comps.find((c) => c.types.includes('country'))?.long_name,
    };
  }

  async nearby(
    lat: number,
    lng: number,
    options: NearbyOptions = {},
  ): Promise<PlaceSuggestion[]> {
    const radius = Math.min(options.radius ?? 5_000, 50_000); // Google max 50 km
    const url = new URL(`${GOOGLE_PLACES_API_BASE}/nearbysearch/json`);
    url.searchParams.set('location', `${lat},${lng}`);
    url.searchParams.set('radius', radius.toString());
    // Map first interest to a Google type where possible
    const type = this.interestToGoogleType(options.interests?.[0]);
    if (type) url.searchParams.set('type', type);
    url.searchParams.set('key', this.apiKey);

    const response = await fetch(url, {
      signal: AbortSignal.timeout(NOMINATIM_TIMEOUT_MS),
    });
    const data = (await response.json()) as GoogleNearbyResponse;
    if (!response.ok || (data.status !== 'OK' && data.status !== 'ZERO_RESULTS')) {
      throw new Error(data.error_message ?? 'Google Places nearby search failed.');
    }
    return (data.results ?? []).map((place) => ({
      place_id: place.place_id,
      description: place.name,
      name: place.name,
      category: place.types?.[0] ?? 'place',
      latitude: place.geometry?.location?.lat,
      longitude: place.geometry?.location?.lng,
      address: place.vicinity,
      source: 'Google Places',
      structured_formatting: { main_text: place.name, secondary_text: place.vicinity },
    }));
  }

  private interestToGoogleType(interest?: string): string | undefined {
    const map: Record<string, string> = {
      History: 'museum',
      Culture: 'museum',
      Museums: 'museum',
      Food: 'restaurant',
      Shopping: 'shopping_mall',
      Temples: 'place_of_worship',
      Wildlife: 'zoo',
      Parks: 'park',
    };
    return interest ? map[interest] : undefined;
  }
}

// ─── FallbackPlacesProvider ──────────────────────────────────────────────────

class FallbackPlacesProvider implements PlacesProvider {
  readonly name = 'google' as const;

  constructor(
    private readonly primary: PlacesProvider,
    private readonly fallback: PlacesProvider,
  ) {}

  async autocomplete(input: string) {
    try {
      return await this.primary.autocomplete(input);
    } catch {
      return this.fallback.autocomplete(input);
    }
  }

  async details(placeId: string) {
    try {
      const result = await this.primary.details(placeId);
      return result ?? this.fallback.details(placeId);
    } catch {
      return this.fallback.details(placeId);
    }
  }

  async nearby(lat: number, lng: number, options: NearbyOptions = {}) {
    try {
      return await this.primary.nearby(lat, lng, options);
    } catch {
      return this.fallback.nearby(lat, lng, options);
    }
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function getPlacesProvider(): PlacesProvider {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return new NominatimProvider();
  return new FallbackPlacesProvider(
    new GooglePlacesProvider(apiKey),
    new NominatimProvider(),
  );
}
