import type { BoundingBox, DailyBudget, DayPlan, NearbyPlace } from '../planner/types';

/**
 * Body accepted by POST /api/plan-trip.
 * All fields are optional here because the client may send a raw `prompt`
 * instead of (or in addition to) explicit fields.
 */
export interface PlanTripRequestBody {
  prompt?: unknown;
  origin?: string;
  /** Detected GPS latitude of the origin (from browser geolocation). */
  originLatitude?: number;
  /** Detected GPS longitude of the origin (from browser geolocation). */
  originLongitude?: number;
  destination?: string;
  latitude?: number;
  longitude?: number;
  /** Bounding box [south, north, west, east] for region/country destinations. */
  boundingBox?: BoundingBox;
  /** OSM type hint ('node' | 'way' | 'relation'). */
  osmType?: string;
  city?: string;
  state?: string;
  country?: string;
  countryCode?: string;
  budget?: number;
  days?: number;
  travelers?: number;
  interests?: string[];
  travelStyle?: string;
}

export interface PlanTripResponseData {
  destination: string;
  coordinates?: { latitude: number; longitude: number };
  city?: string;
  state?: string;
  country?: string;
  totalCost: number;
  budget: number;
  remaining: number;
  budgetUsagePercentage: number;
  currency: string;
  transport: number;
  accommodation: number;
  food: number;
  activities: number;
  localTransport: number;
  buffer: number;
  dailyBudget: DailyBudget[];
  days: DayPlan[];
  candidates: unknown[];
  nearbyPlaces: NearbyPlace[];
  optimization: string;
  isDemo: boolean;
  source: string;
  agent: unknown;
}

export interface PlanTripSuccessResponse {
  data: PlanTripResponseData;
}
