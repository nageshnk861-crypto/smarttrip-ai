/**
 * lib/research/travel-research.ts
 *
 * Central travel research orchestrator.
 *
 * Free-first provider architecture:
 *   Places       → OpenStreetMap / Overpass  (no API key)
 *   Accommodation→ OpenStreetMap / Overpass  (no API key, no booking prices)
 *   Food         → OpenStreetMap / Overpass  (no API key, no menu prices)
 *   Transport    → OpenRouteService (optional key) + Nominatim + haversine fallback
 *   Local        → Structured fare estimates, clearly labelled
 *   Weather      → Open-Meteo                (no API key)
 *
 * Every result carries provenance (source, sourceType, retrievedAt).
 * No hardcoded prices. Unavailable data is returned as structured
 * "unavailable" — never as fake values.
 */

import type { ResearchRequest, ResearchResult } from './types';
import type {
  HotelProvider,
  FoodProvider,
  TransportProvider,
  LocalTransportProvider,
  TouristPlacesProvider,
  WeatherProvider,
} from './providers/interfaces';
import {
  OsmTouristPlacesProvider,
  OsmHotelProvider,
  OsmFoodProvider,
} from './providers/osm-places';
import {
  DistanceBasedTransportProvider,
  LocalTransportEstimator,
} from './providers/transport-estimator';
import { OpenMeteoProvider } from './providers/weather';

// ─── Provider factory ─────────────────────────────────────────────────────────

function makeProviders(): {
  hotel: HotelProvider;
  food: FoodProvider;
  transport: TransportProvider;
  localTransport: LocalTransportProvider;
  places: TouristPlacesProvider;
  weather: WeatherProvider;
} {
  return {
    hotel: new OsmHotelProvider(),
    food: new OsmFoodProvider(),
    transport: new DistanceBasedTransportProvider(),
    localTransport: new LocalTransportEstimator(),
    places: new OsmTouristPlacesProvider(),
    weather: new OpenMeteoProvider(),
  };
}

// ─── Main orchestrator ────────────────────────────────────────────────────────

/**
 * Researches all aspects of a trip simultaneously.
 * Each provider runs in parallel — a single failure never aborts the rest.
 * Every returned item carries provenance (source, sourceType, retrievedAt).
 */
export async function researchTrip(request: ResearchRequest): Promise<ResearchResult> {
  const providers = makeProviders();

  const [
    placesResult,
    accommodationResult,
    foodResult,
    transportResult,
    localTransportResult,
    weatherResult,
  ] = await Promise.allSettled([
    providers.places.search(request),
    providers.hotel.search(request),
    providers.food.search(request),
    providers.transport.search(request),
    providers.localTransport.search(request),
    providers.weather.search(request),
  ]);

  const now = new Date().toISOString();
  const fallbackSource = { name: 'provider-error', sourceType: 'unavailable' as const, retrievedAt: now };

  const places =
    placesResult.status === 'fulfilled'
      ? placesResult.value
      : {
          destination: request.destination,
          places: [],
          hasLiveData: false,
          source: fallbackSource,
        };

  const accommodation =
    accommodationResult.status === 'fulfilled'
      ? accommodationResult.value
      : {
          available: false,
          hasLiveData: false,
          results: [],
          priceRange: { min: 0, max: 0, currency: request.currency },
          nights: request.days,
          tier: request.preferences.accommodation,
          source: fallbackSource,
        };

  const food =
    foodResult.status === 'fulfilled'
      ? foodResult.value
      : {
          available: false,
          hasLiveData: false,
          restaurants: [],
          dailyCostPerPerson: { min: 0, max: 0, currency: request.currency },
          tier: request.preferences.food,
          source: fallbackSource,
        };

  const intercityTransport =
    transportResult.status === 'fulfilled'
      ? transportResult.value
      : {
          origin: request.origin,
          destination: request.destination,
          options: [],
          source: fallbackSource,
        };

  const localTransport =
    localTransportResult.status === 'fulfilled'
      ? localTransportResult.value
      : {
          destination: request.destination,
          options: [],
          dailyEstimatePerPerson: { min: 0, max: 0, currency: request.currency },
          source: fallbackSource,
        };

  const weather =
    weatherResult.status === 'fulfilled'
      ? weatherResult.value
      : {
          available: false,
          forecast: [],
          source: fallbackSource,
        };

  const hasAnyLiveData =
    places.hasLiveData ||
    accommodation.hasLiveData ||
    food.hasLiveData ||
    weather.available;

  return {
    request,
    places,
    accommodation,
    food,
    intercityTransport,
    localTransport,
    weather,
    researchedAt: now,
    hasAnyLiveData,
  };
}
