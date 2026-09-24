/**
 * lib/research/providers/transport-estimator.ts
 *
 * Transport research provider.
 *
 * Distance/duration strategy (in priority order):
 *   1. OpenRouteService API  (if OPENROUTESERVICE_API_KEY is set)
 *      → driving-car profile for road distance + duration
 *   2. Haversine straight-line fallback  (always available, no key needed)
 *      → labelled "Estimated from straight-line distance" to be honest
 *
 * Fare calculation:
 *   All bus/train/taxi/flight fares are ESTIMATES derived from per-km rates.
 *   They are clearly labelled sourceType: "estimated".
 *   They are NOT live booking prices.
 *   Live booking APIs (Amadeus, RedBus, RailYatri, etc.) require separate
 *   paid integrations — when absent, the estimate is the only output.
 *
 * Local transport:
 *   Returns typical fare ranges per mode for a single journey within the city.
 *   Labelled "Estimated local transport cost" — not live fare data.
 *
 * Key never exposed to browser — all calls are server-side.
 */

import type {
  DataSource,
  LocalTransportOption,
  LocalTransportResearch,
  PriceRange,
  ResearchRequest,
  TransportOption,
  TransportResearch,
} from '../types';
import type {
  LocalTransportProvider,
  TransportProvider,
} from './interfaces';
import { NOMINATIM_BASE_URL, NOMINATIM_USER_AGENT } from '../../config';

// ─── Shared helpers ───────────────────────────────────────────────────────────

function nowIso() { return new Date().toISOString(); }
function expiresIn(m: number) { return new Date(Date.now() + m * 60_000).toISOString(); }

function estimatedSource(note: string): DataSource {
  return { name: note, sourceType: 'estimated', retrievedAt: nowIso(), expiresAt: expiresIn(120) };
}

function providerSource(name: string): DataSource {
  return { name, sourceType: 'provider', retrievedAt: nowIso(), expiresAt: expiresIn(60) };
}

// ─── Haversine (straight-line fallback) ──────────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return Math.round(6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// ─── Nominatim geocoding (free, no key) ──────────────────────────────────────

async function geocodeWithNominatim(
  place: string,
): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = new URL('/search', NOMINATIM_BASE_URL);
    url.searchParams.set('q', place);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('limit', '1');
    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': NOMINATIM_USER_AGENT },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (!data[0]) return null;
    return { lat: Number(data[0].lat), lng: Number(data[0].lon) };
  } catch {
    return null;
  }
}

// ─── OpenRouteService distance ────────────────────────────────────────────────
// https://api.heigit.org/openrouteservice/v2/directions/driving-car
// Requires OPENROUTESERVICE_API_KEY (free tier: 2000 req/day).

const ORS_BASE = 'https://api.heigit.org/openrouteservice/v2/directions/driving-car';

async function getDistanceFromORS(
  originLat: number, originLng: number,
  destLat: number, destLng: number,
  apiKey: string,
): Promise<{ distanceKm: number; durationMin: number } | null> {
  try {
    const url = `${ORS_BASE}?api_key=${apiKey}&start=${originLng},${originLat}&end=${destLng},${destLat}`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;

    // ORS GeoJSON FeatureCollection response
    const data = (await res.json()) as {
      features?: Array<{
        properties?: {
          summary?: { distance?: number; duration?: number };
        };
      }>;
    };
    const summary = data.features?.[0]?.properties?.summary;
    if (!summary) return null;

    return {
      distanceKm: Math.round((summary.distance ?? 0) / 1000),
      durationMin: Math.round((summary.duration ?? 0) / 60),
    };
  } catch {
    return null;
  }
}

// ─── Per-km fare estimation formulas ─────────────────────────────────────────
// These are ESTIMATES — not live booking prices.
// Rates reflect typical ranges; clearly labelled in provenance.

const PER_KM = {
  bus:    { min: 0.45, max: 1.2  },  // ₹/km, Non-AC to AC Sleeper
  train:  { min: 0.35, max: 1.5  },  // ₹/km, Sleeper to 2AC
  taxi:   { min: 10,   max: 16   },  // ₹/km, local taxi to ride-hailing
  flight: { baseMin: 1_500, baseMax: 3_000, perKmMin: 2.5, perKmMax: 7 },
} as const;

function estimateBus(km: number, currency: string): PriceRange {
  return { min: Math.round(km * PER_KM.bus.min), max: Math.round(km * PER_KM.bus.max), currency };
}
function estimateTrain(km: number, currency: string): PriceRange {
  return { min: Math.round(km * PER_KM.train.min), max: Math.round(km * PER_KM.train.max), currency };
}
function estimateTaxi(km: number, currency: string): PriceRange {
  return { min: Math.round(km * PER_KM.taxi.min), max: Math.round(km * PER_KM.taxi.max), currency };
}
function estimateFlight(km: number, currency: string): PriceRange | null {
  if (km < 300) return null;
  return {
    min: Math.round(PER_KM.flight.baseMin + km * PER_KM.flight.perKmMin),
    max: Math.round(PER_KM.flight.baseMax + km * PER_KM.flight.perKmMax),
    currency,
  };
}

// ─── Intercity transport provider ────────────────────────────────────────────

export class DistanceBasedTransportProvider implements TransportProvider {
  readonly name = 'Distance-based transport estimator';

  async search(req: ResearchRequest): Promise<TransportResearch> {
    const unavailable = (): TransportResearch => ({
      origin: req.origin,
      destination: req.destination,
      options: [],
      source: estimatedSource(
        `Cannot estimate transport — origin coordinates unavailable for "${req.origin}".`,
      ),
    });

    // Step 1: Get origin coordinates.
    // Prefer coordinates from browser geolocation (already in request) to avoid
    // an extra Nominatim geocode round-trip.
    let originLat: number;
    let originLng: number;

    if (
      req.originLatitude !== undefined &&
      req.originLongitude !== undefined &&
      Number.isFinite(req.originLatitude) &&
      Number.isFinite(req.originLongitude)
    ) {
      // GPS coordinates supplied by the browser — use directly
      originLat = req.originLatitude;
      originLng = req.originLongitude;
    } else {
      // Fall back to Nominatim geocode of the origin text
      const originCoords = await geocodeWithNominatim(req.origin);
      if (!originCoords) return unavailable();
      originLat = originCoords.lat;
      originLng = originCoords.lng;
    }

    // Step 2: Get road distance — try OpenRouteService first, fall back to haversine
    let distanceKm: number;
    let durationMin: number;
    let distanceSource: DataSource;

    const orsKey = process.env.OPENROUTESERVICE_API_KEY;
    if (orsKey) {
      const orsResult = await getDistanceFromORS(
        originLat, originLng,
        req.latitude, req.longitude,
        orsKey,
      );
      if (orsResult) {
        distanceKm = orsResult.distanceKm;
        durationMin = orsResult.durationMin;
        distanceSource = providerSource(
          `OpenRouteService (road distance: ${distanceKm} km, ~${durationMin} min driving)`,
        );
      } else {
        // ORS failed — fall back to haversine
        distanceKm = haversineKm(originLat, originLng, req.latitude, req.longitude);
        durationMin = Math.round((distanceKm / 60) * 60);
        distanceSource = estimatedSource(
          `OpenRouteService unavailable — estimated from straight-line distance (${distanceKm} km). Not a live booking price.`,
        );
      }
    } else {
      // No ORS key — use haversine
      distanceKm = haversineKm(originLat, originLng, req.latitude, req.longitude);
      durationMin = Math.round((distanceKm / 60) * 60);
      distanceSource = estimatedSource(
        `Estimated from straight-line distance (${distanceKm} km) between ${req.origin} and ${req.destination}. ` +
        'Set OPENROUTESERVICE_API_KEY for road-distance accuracy. Not a live booking price.',
      );
    }

    const options: TransportOption[] = [];

    // Bus estimate
    const busPrice = estimateBus(distanceKm, req.currency);
    if (busPrice.max > 0) {
      options.push({
        mode: 'bus',
        class: 'Non-AC to AC Sleeper (estimate)',
        departureName: req.origin,
        arrivalName: req.destination,
        durationMinutes: durationMin,
        distanceKm,
        priceRange: busPrice,
        availabilityConfirmed: false,
        source: {
          ...distanceSource,
          name: distanceSource.name + ` — bus fare estimate (₹${PER_KM.bus.min}–₹${PER_KM.bus.max}/km)`,
          sourceType: 'estimated',
        },
      });
    }

    // Train estimate
    const trainPrice = estimateTrain(distanceKm, req.currency);
    if (trainPrice.max > 0) {
      options.push({
        mode: 'train',
        class: 'Sleeper to 2AC (estimate)',
        departureName: req.origin,
        arrivalName: req.destination,
        durationMinutes: Math.round((distanceKm / 80) * 60),
        distanceKm,
        priceRange: trainPrice,
        availabilityConfirmed: false,
        source: {
          ...distanceSource,
          name: distanceSource.name + ` — train fare estimate (₹${PER_KM.train.min}–₹${PER_KM.train.max}/km)`,
          sourceType: 'estimated',
        },
      });
    }

    // Taxi estimate
    options.push({
      mode: 'taxi',
      class: 'Cab / Taxi (estimate)',
      departureName: req.origin,
      arrivalName: req.destination,
      durationMinutes: durationMin,
      distanceKm,
      priceRange: estimateTaxi(distanceKm, req.currency),
      availabilityConfirmed: false,
      source: {
        ...distanceSource,
        name: distanceSource.name + ` — taxi fare estimate (₹${PER_KM.taxi.min}–₹${PER_KM.taxi.max}/km)`,
        sourceType: 'estimated',
      },
    });

    // Flight estimate (only for longer routes)
    const flightPrice = estimateFlight(distanceKm, req.currency);
    if (flightPrice) {
      options.push({
        mode: 'flight',
        class: 'Economy (estimate)',
        departureName: req.origin,
        arrivalName: req.destination,
        durationMinutes: Math.round((distanceKm / 800) * 60 + 90),
        distanceKm,
        priceRange: flightPrice,
        availabilityConfirmed: false,
        source: {
          ...distanceSource,
          name: 'Flight fare estimate (base fare + per-km rate). Not a live airline price.',
          sourceType: 'estimated',
        },
      });
    }

    const cheapest = [...options].sort((a, b) => a.priceRange.min - b.priceRange.min)[0];
    const fastest = [...options].sort(
      (a, b) => (a.durationMinutes ?? 9999) - (b.durationMinutes ?? 9999),
    )[0];

    return {
      origin: req.origin,
      destination: req.destination,
      options,
      cheapestOption: cheapest,
      fastestOption: fastest,
      source: distanceSource,
    };
  }
}

// ─── Local transport provider ─────────────────────────────────────────────────

export class LocalTransportEstimator implements LocalTransportProvider {
  readonly name = 'Estimated local transport costs';

  async search(req: ResearchRequest): Promise<LocalTransportResearch> {
    const c = req.currency;
    const src = estimatedSource(
      'Estimated local transport costs based on typical urban fare structures. ' +
      'Not live transit data. Actual fares depend on distance and local rates.',
    );

    const options: LocalTransportOption[] = [
      {
        mode: 'metro',
        description: 'Metro / rapid transit (where available) — per single journey',
        estimatedFare: { min: 10, max: 60, currency: c },
        available: true,
        source: src,
      },
      {
        mode: 'bus',
        description: 'City bus — per single journey',
        estimatedFare: { min: 5, max: 30, currency: c },
        available: true,
        source: src,
      },
      {
        mode: 'auto',
        description: 'Auto-rickshaw — per short journey',
        estimatedFare: { min: 30, max: 150, currency: c },
        available: true,
        source: src,
      },
      {
        mode: 'taxi',
        description: 'Taxi / cab (app-based) — per medium journey',
        estimatedFare: { min: 80, max: 400, currency: c },
        available: true,
        source: src,
      },
      {
        mode: 'bike_rental',
        description: 'Bike rental — per day',
        estimatedFare: { min: 200, max: 600, currency: c },
        available: true,
        source: src,
      },
      {
        mode: 'walking',
        description: 'Walking — free',
        estimatedFare: { min: 0, max: 0, currency: c },
        available: true,
        source: { ...src, name: 'N/A' },
      },
    ];

    // Daily estimate per person: ~3 journeys/day at mid-range auto/cab
    const dailyMin = 30 * 3;  // 3 × min auto fare
    const dailyMax = 400 * 3; // 3 × max cab fare

    return {
      destination: req.destination,
      options,
      dailyEstimatePerPerson: { min: dailyMin, max: dailyMax, currency: c },
      source: src,
    };
  }
}
