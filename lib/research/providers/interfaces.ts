/**
 * lib/research/providers/interfaces.ts
 *
 * Provider interfaces for the SmartTrip research engine.
 * Each provider is independently replaceable without changing the planner logic.
 */

import type {
  AccommodationResearch,
  FoodResearch,
  LocalTransportResearch,
  PlacesResearch,
  ResearchRequest,
  TransportResearch,
  WeatherResearch,
} from '../types';

// ─── Accommodation ────────────────────────────────────────────────────────────

export interface HotelProvider {
  readonly name: string;
  search(request: ResearchRequest): Promise<AccommodationResearch>;
}

// ─── Food ─────────────────────────────────────────────────────────────────────

export interface FoodProvider {
  readonly name: string;
  search(request: ResearchRequest): Promise<FoodResearch>;
}

// ─── Intercity transport ──────────────────────────────────────────────────────

export interface TransportProvider {
  readonly name: string;
  search(request: ResearchRequest): Promise<TransportResearch>;
}

// ─── Local transport ──────────────────────────────────────────────────────────

export interface LocalTransportProvider {
  readonly name: string;
  search(request: ResearchRequest): Promise<LocalTransportResearch>;
}

// ─── Tourist places ───────────────────────────────────────────────────────────

export interface TouristPlacesProvider {
  readonly name: string;
  search(request: ResearchRequest): Promise<PlacesResearch>;
}

// ─── Weather ──────────────────────────────────────────────────────────────────

export interface WeatherProvider {
  readonly name: string;
  search(request: ResearchRequest): Promise<WeatherResearch>;
}
