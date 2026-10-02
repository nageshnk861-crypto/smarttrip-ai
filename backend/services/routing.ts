/**
 * Routing & Transport Estimation Service
 */

import type {
  DataSource,
  LocalTransportOption,
  LocalTransportResearch,
  PriceRange,
  TransportOption,
  TransportResearch,
} from '../models/types.js';

const NOMINATIM_BASE_URL = process.env.NOMINATIM_BASE_URL || 'https://nominatim.openstreetmap.org';
const NOMINATIM_USER_AGENT = process.env.NOMINATIM_USER_AGENT || 'SmartTrip AI/1.0';
const OPENROUTESERVICE_BASE = 'https://api.heigit.org/openrouteservice/v2/directions/driving-car';

function nowIso(): string {
  return new Date().toISOString();
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
  return Math.round(6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export async function geocodePlace(place: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = new URL('/search', NOMINATIM_BASE_URL);
    url.searchParams.set('q', place);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('limit', '1');
    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': NOMINATIM_USER_AGENT },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (!data[0]) return null;
    return { lat: Number(data[0].lat), lng: Number(data[0].lon) };
  } catch {
    return null;
  }
}

import { estimateBusFare } from './bus-rate-model.js';

const PER_KM = {
  bus: { min: 1.50, max: 3.50 }, // Express/Deluxe planning rate ₹1.50-₹3.50/km
  train: { min: 0.35, max: 1.5 },
  taxi: { min: 10, max: 16 },
  flight: { baseMin: 1500, baseMax: 3000, perKmMin: 2.5, perKmMax: 7 },
};

export async function getRoadDistance(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
): Promise<{ distanceKm: number; durationMin: number; isRoad: boolean }> {
  const orsKey = process.env.OPENROUTESERVICE_API_KEY;
  if (orsKey) {
    try {
      const url = `${OPENROUTESERVICE_BASE}?api_key=${orsKey}&start=${originLng},${originLat}&end=${destLng},${destLat}`;
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(9000),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          features?: Array<{ properties?: { summary?: { distance?: number; duration?: number } } }>;
        };
        const summary = data.features?.[0]?.properties?.summary;
        if (summary?.distance) {
          return {
            distanceKm: Math.round(summary.distance / 1000),
            durationMin: Math.round((summary.duration ?? 0) / 60),
            isRoad: true,
          };
        }
      }
    } catch {
      // Fall through to haversine
    }
  }

  const hDist = Math.max(haversineKm(originLat, originLng, destLat, destLng), 10);
  return {
    distanceKm: hDist,
    durationMin: Math.round((hDist / 60) * 60),
    isRoad: false,
  };
}

export async function estimateTransport(
  origin: string,
  destination: string,
  destLat: number,
  destLng: number,
  originLat?: number,
  originLng?: number,
  currency: string = 'INR',
): Promise<TransportResearch> {
  let oLat = originLat;
  let oLng = originLng;

  if (oLat === undefined || oLng === undefined) {
    const coords = await geocodePlace(origin);
    if (coords) {
      oLat = coords.lat;
      oLng = coords.lng;
    } else {
      oLat = destLat - 2;
      oLng = destLng - 2;
    }
  }

  const roadResult = await getRoadDistance(oLat, oLng, destLat, destLng);
  const distanceKm = roadResult.distanceKm;
  const durationMin = roadResult.durationMin;

  const source: DataSource = {
    name: roadResult.isRoad
      ? `OpenRouteService (road distance: ${distanceKm} km, ~${durationMin} min driving)`
      : `SmartTrip Distance Estimator (${distanceKm} km straight-line distance)`,
    sourceType: 'estimated',
    confidence: roadResult.isRoad ? 'high' : 'medium',
    retrievedAt: nowIso(),
  };

  const busFareObj = estimateBusFare({
    distanceKm,
    category: 'EXPRESS',
    travelers: 1,
    roundTrip: false,
  });

  const busPriceRange: PriceRange = {
    min: busFareObj.oneWay?.low || Math.round(distanceKm * 1.5),
    max: busFareObj.oneWay?.high || Math.round(distanceKm * 3.5),
    currency,
  };

  const options: TransportOption[] = [
    {
      mode: 'train',
      class: 'Sleeper to 2AC (estimate)',
      departureName: origin,
      arrivalName: destination,
      durationMinutes: Math.round((distanceKm / 80) * 60),
      distanceKm,
      priceRange: {
        min: Math.round(distanceKm * PER_KM.train.min),
        max: Math.round(distanceKm * PER_KM.train.max),
        currency,
      },
      availabilityConfirmed: false,
      source,
    },
    {
      mode: 'bus',
      class: 'Express / Deluxe Planning Estimate (₹1.50–₹3.50/km)',
      departureName: origin,
      arrivalName: destination,
      durationMinutes: durationMin,
      distanceKm,
      priceRange: busPriceRange,
      availabilityConfirmed: false,
      source: {
        ...source,
        name: 'SmartTrip bus planning-rate model (Express ₹1.50–₹3.50/km, expected ₹2.50/km)',
        sourceType: 'estimated',
      },
    },
    {
      mode: 'taxi',
      class: 'Cab / Private Taxi (estimate)',
      departureName: origin,
      arrivalName: destination,
      durationMinutes: durationMin,
      distanceKm,
      priceRange: {
        min: Math.round(distanceKm * PER_KM.taxi.min),
        max: Math.round(distanceKm * PER_KM.taxi.max),
        currency,
      },
      availabilityConfirmed: false,
      source,
    },
  ];

  if (distanceKm > 300) {
    options.push({
      mode: 'flight',
      class: 'Economy (estimate)',
      departureName: origin,
      arrivalName: destination,
      durationMinutes: Math.round((distanceKm / 800) * 60 + 90),
      distanceKm,
      priceRange: {
        min: Math.round(PER_KM.flight.baseMin + distanceKm * PER_KM.flight.perKmMin),
        max: Math.round(PER_KM.flight.baseMax + distanceKm * PER_KM.flight.perKmMax),
        currency,
      },
      availabilityConfirmed: false,
      source,
    });
  }

  const cheapest = [...options].sort((a, b) => a.priceRange.min - b.priceRange.min)[0];
  const fastest = [...options].sort((a, b) => (a.durationMinutes ?? 9999) - (b.durationMinutes ?? 9999))[0];

  return {
    origin,
    destination,
    options,
    cheapestOption: cheapest,
    fastestOption: fastest,
    source,
  };
}

export function estimateLocalTransport(destination: string, currency: string = 'INR'): LocalTransportResearch {
  const source: DataSource = {
    name: 'Estimated local city transit',
    sourceType: 'estimated',
    retrievedAt: nowIso(),
  };

  const options: LocalTransportOption[] = [
    {
      mode: 'metro',
      description: 'Metro / rapid transit — per single journey',
      estimatedFare: { min: 10, max: 60, currency },
      available: true,
      source,
    },
    {
      mode: 'auto',
      description: 'Auto-rickshaw — per short trip',
      estimatedFare: { min: 30, max: 150, currency },
      available: true,
      source,
    },
    {
      mode: 'taxi',
      description: 'Cab / Ride-hail — per trip',
      estimatedFare: { min: 80, max: 400, currency },
      available: true,
      source,
    },
    {
      mode: 'walking',
      description: 'Walking — free',
      estimatedFare: { min: 0, max: 0, currency },
      available: true,
      source,
    },
  ];

  return {
    destination,
    options,
    dailyEstimatePerPerson: { min: 90, max: 600, currency },
    source,
  };
}

export function generateTransitGuide(
  origin: string,
  destination: string,
  distanceKm: number,
  selectedMode: string = 'bus',
  currency: string = 'INR',
): import('../models/types.js').TransitGuide {
  const safeDist = Math.max(15, Math.round(distanceKm));
  const busDurationHours = Math.max(1, Math.round(safeDist / 50));
  const trainDurationHours = Math.max(1, Math.round(safeDist / 70));

  const busEstimate = estimateBusFare({
    distanceKm: safeDist,
    category: 'EXPRESS',
    travelers: 1,
    roundTrip: false,
  });

  const busFareMin = busEstimate.oneWay?.low || Math.round(safeDist * 1.5);
  const busFareExpected = busEstimate.oneWay?.expected || Math.round(safeDist * 2.5);
  const busFareMax = busEstimate.oneWay?.high || Math.round(safeDist * 3.5);

  const trainFareMin = Math.max(90, Math.round(safeDist * 0.45));
  const trainFareMax = Math.max(220, Math.round(safeDist * 1.35));

  const isKarnatakaRoute =
    /bengaluru|bangalore|mysuru|mysore|hampi|badami|coorg|hubballi|hubli|belagavi|belgaum|mangalore|mangaluru|udupi|gokarna|kalaburagi|gulbarga/i.test(
      `${origin} ${destination}`,
    );

  const primaryOperator = isKarnatakaRoute
    ? 'KSRTC / NWKRTC / KKRTC State Transport & Intercity Private Coaches'
    : 'State Road Transport (STC) & Intercity Private Sleeper Coaches';

  const schedules: import('../models/types.js').TransitScheduleItem[] = [
    {
      mode: 'bus',
      name: `${origin} → ${destination} Express & AC Sleeper Buses`,
      operator: primaryOperator,
      departureTimes: [
        '06:00 AM (Morning Express)',
        '08:30 AM (Semi-Deluxe)',
        '11:15 AM (Regular Express)',
        '02:00 PM (Afternoon AC)',
        '05:30 PM (Evening Fast)',
        '08:30 PM (AC Sleeper)',
        '09:45 PM (Multi-Axle Volvo)',
        '11:00 PM (Night Sleeper)',
      ],
      frequency: 'Every 30–45 minutes during peak hours; hourly night sleeper buses',
      duration: `~${busDurationHours} hours (${safeDist} km)`,
      estimatedFare: `₹${busFareMin.toLocaleString()} – ₹${busFareMax.toLocaleString()} / seat (Expected ₹${busFareExpected.toLocaleString()})`,
      boardingPoint: `${origin} Central Bus Station (ISBT / Main Depot)`,
      droppingPoint: `${destination} Central Bus Stand / Main Depot`,
      type: 'Ordinary / Express / Deluxe / AC Sleeper',
    },
    {
      mode: 'train',
      name: `${origin} ⇄ ${destination} Express & Superfast Rail`,
      operator: 'Indian Railways (IRCTC)',
      departureTimes: [
        '06:15 AM (Morning Superfast)',
        '10:30 AM (Intercity Express)',
        '02:15 PM (Jan Shatabdi)',
        '06:45 PM (Evening Express)',
        '10:20 PM (Overnight Mail / Sleeper)',
      ],
      frequency: '4–6 scheduled direct express trains daily',
      duration: `~${trainDurationHours} hours (${safeDist} km)`,
      estimatedFare: `₹${trainFareMin.toLocaleString()} (2S/General) · ₹${Math.round(trainFareMin * 1.8)} (Sleeper) · ₹${trainFareMax.toLocaleString()} (3AC)`,
      boardingPoint: `${origin} Railway Junction / Main Station`,
      droppingPoint: `${destination} Railway Station (Junction)`,
      type: '2S, Sleeper, 3AC, 2AC & Chair Car',
    },
    {
      mode: 'taxi',
      name: `Private Taxi / Cab / Outstation Car`,
      operator: 'Pre-paid Cabs, Ola Outstation, Uber Intercity & Local Travel Agencies',
      departureTimes: ['On-Demand 24/7 Departure at your preferred time'],
      frequency: 'Instant booking available anytime',
      duration: `~${Math.max(1, Math.round(safeDist / 60))} hours door-to-door`,
      estimatedFare: `₹${Math.round(safeDist * 11).toLocaleString()} – ₹${Math.round(safeDist * 16).toLocaleString()} total`,
      boardingPoint: `Doorstep Pickup at ${origin}`,
      droppingPoint: `Direct Hotel / Attraction Drop at ${destination}`,
      type: 'Sedan (Dzire/Etios) / SUV (Ertiga/Innova)',
    },
  ];

  return {
    selectedMode,
    summary: `${selectedMode.toUpperCase()} is convenient for ${origin} to ${destination} (~${safeDist} km). Planning rate: ₹1.50–₹3.50/km (Expected ₹2.50/km).`,
    originStation: `${origin} Central Transit Station`,
    destinationStation: `${destination} Central Bus & Rail Hub`,
    nearestBusStand: {
      name: `${destination} Central Bus Station (${isKarnatakaRoute ? 'KSRTC/NWKRTC Depot' : 'State Roadways Depot'})`,
      type: 'bus_station',
      distanceKm: 2.1,
      city: destination,
      address: `Station Road, Central ${destination}`,
    },
    nearestRailwayStation: {
      name: `${destination} Railway Junction`,
      type: 'railway_station',
      distanceKm: 3.4,
      city: destination,
      address: `Railway Colony Road, ${destination}`,
    },
    schedules,
    howToTravelSteps: [
      `1. Board from ${origin} Central Bus Stand or Railway Junction. Morning slots (06:00 AM – 09:00 AM) or night sleeper buses (09:00 PM – 11:00 PM) are most recommended.`,
      `2. Travel along the route (${safeDist} km, ~${busDurationHours} hours journey). Express coaches make scheduled meal stops along highway restaurants.`,
      `3. Arrive at ${destination} Central Bus Stand or ${destination} Railway Station.`,
      `4. Take a local pre-paid auto-rickshaw (₹40–₹100) or local connecting city bus (₹10–₹25) right outside the terminal gate to reach your hotel or first attraction.`,
    ],
    localTransitTips: [
      `Auto-rickshaws and battery e-rickshaws are available 24/7 right outside ${destination} bus stand & railway station.`,
      `Local municipal / state city buses connect all major temples, viewpoints, and markets every 15–20 minutes.`,
      `App-based cabs (Uber/Ola) and shared tempo transit are available for sightseeing day trips.`,
    ],
  };
}

