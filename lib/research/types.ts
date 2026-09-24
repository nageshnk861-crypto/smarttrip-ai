/**
 * lib/research/types.ts
 *
 * All normalized data structures for the SmartTrip travel research engine.
 * Every price carries full provenance: source, sourceType, retrievedAt.
 * No hardcoded prices anywhere — every amount comes from a provider or
 * a clearly-labelled estimate derived from real route/distance data.
 */

// ─── Provenance ───────────────────────────────────────────────────────────────

export type SourceType =
  | 'live'        // real-time API response
  | 'provider'    // provider data (may be slightly cached by the provider)
  | 'estimated'   // calculated from distance/route data, not a live quote
  | 'cached'      // our own short-lived cache of a previous live result
  | 'unavailable' // provider returned no data or is not configured
  | 'user';       // supplied directly by the user

export type DataSource = {
  /** Human-readable provider name, e.g. "Google Places", "OpenStreetMap". */
  name: string;
  sourceType: SourceType;
  /** ISO 8601 timestamp when this data was fetched. */
  retrievedAt: string;
  /** ISO 8601 timestamp after which the data should be considered stale. */
  expiresAt?: string;
  /** Direct URL to the source, if available. */
  url?: string;
};

// ─── Price ───────────────────────────────────────────────────────────────────

export type PriceRange = {
  min: number;
  max: number;
  /** ISO 4217, e.g. "INR", "USD", "EUR". */
  currency: string;
};

/** A single price (exact or central estimate). */
export type Price = {
  amount: number;
  currency: string;
};

export type PriceUnit =
  | 'per_person'
  | 'per_night'
  | 'per_day'
  | 'per_trip'
  | 'per_room'
  | 'per_vehicle'
  | 'per_hour'
  | 'flat'
  | 'unknown';

// ─── Cost item (line in the budget) ──────────────────────────────────────────

export type CostItem = {
  id: string;
  category:
    | 'accommodation'
    | 'food'
    | 'transport'
    | 'local_transport'
    | 'activity'
    | 'entry_fee'
    | 'tax'
    | 'fee'
    | 'buffer'
    | 'other';
  name: string;
  description?: string;
  priceRange: PriceRange;
  /** Selected / middle-estimate amount for this line. */
  selectedAmount: number;
  unit: PriceUnit;
  /** How many units are being purchased (e.g. 2 nights, 3 persons). */
  quantity: number;
  /** selectedAmount × quantity */
  lineTotal: number;
  source: DataSource;
  /** true when real provider data was used; false = estimate / fallback. */
  isLiveData: boolean;
};

// ─── Accommodation ────────────────────────────────────────────────────────────

export type HotelResult = {
  placeId: string;
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  starRating?: number;
  userRating?: number;
  ratingCount?: number;
  pricePerNight: PriceRange;
  roomType?: string;
  amenities?: string[];
  source: DataSource;
};

export type AccommodationResearch = {
  available: boolean;
  /** Provider returned real hotel results. */
  hasLiveData: boolean;
  results: HotelResult[];
  /** Aggregated price range across all results (for this tier). */
  priceRange: PriceRange;
  nights: number;
  tier: 'budget' | 'standard' | 'premium';
  source: DataSource;
};

// ─── Food ─────────────────────────────────────────────────────────────────────

export type RestaurantResult = {
  placeId: string;
  name: string;
  cuisine?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  priceLevel?: 1 | 2 | 3 | 4;   // Google price_level scale
  userRating?: number;
  ratingCount?: number;
  /** Estimated meal cost per person from provider data. */
  mealCostPerPerson?: PriceRange;
  source: DataSource;
};

export type FoodResearch = {
  available: boolean;
  hasLiveData: boolean;
  restaurants: RestaurantResult[];
  /** Estimated daily food cost per person based on provider data. */
  dailyCostPerPerson: PriceRange;
  tier: 'budget' | 'standard' | 'premium';
  source: DataSource;
};

// ─── Transport (intercity) ────────────────────────────────────────────────────

export type TransportMode =
  | 'bus'
  | 'train'
  | 'flight'
  | 'taxi'
  | 'self_drive'
  | 'metro'
  | 'auto'
  | 'bike_rental'
  | 'car_rental'
  | 'walking'
  | 'ferry'
  | 'cable_car';

export type TransportOption = {
  mode: TransportMode;
  operator?: string;
  /** Human-readable label, e.g. "AC Sleeper", "Economy Seat". */
  class?: string;
  departureName?: string;
  arrivalName?: string;
  durationMinutes?: number;
  distanceKm?: number;
  priceRange: PriceRange;
  /** true if availability was confirmed by provider. */
  availabilityConfirmed: boolean;
  source: DataSource;
};

export type TransportResearch = {
  origin: string;
  destination: string;
  options: TransportOption[];
  /** Cheapest option across all modes. */
  cheapestOption?: TransportOption;
  /** Fastest option. */
  fastestOption?: TransportOption;
  source: DataSource;
};

// ─── Local transport ──────────────────────────────────────────────────────────

export type LocalTransportOption = {
  mode: TransportMode;
  description: string;
  /** Estimated fare for a typical journey within the destination. */
  estimatedFare: PriceRange;
  available: boolean;
  source: DataSource;
};

export type LocalTransportResearch = {
  destination: string;
  options: LocalTransportOption[];
  /** Recommended daily local transport budget per person. */
  dailyEstimatePerPerson: PriceRange;
  source: DataSource;
};

// ─── Tourist places ───────────────────────────────────────────────────────────

export type TouristPlace = {
  placeId: string;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  distanceKm?: number;
  address?: string;
  description?: string;
  openingHours?: string;
  entryFee?: PriceRange;
  /** true if fee data came from a provider, false if unknown/unavailable. */
  hasFeeData: boolean;
  userRating?: number;
  ratingCount?: number;
  source: DataSource;
};

export type PlacesResearch = {
  destination: string;
  places: TouristPlace[];
  hasLiveData: boolean;
  source: DataSource;
};

// ─── Weather ──────────────────────────────────────────────────────────────────

export type WeatherForecastDay = {
  date: string;
  tempMinC: number;
  tempMaxC: number;
  description: string;
  icon: string;
  rainProbability?: number;
  windKph?: number;
};

export type WeatherResearch = {
  available: boolean;
  current?: {
    tempC: number;
    feelsLikeC: number;
    humidity: number;
    windKph: number;
    description: string;
    icon: string;
  };
  forecast: WeatherForecastDay[];
  source: DataSource;
};

// ─── Master research result ───────────────────────────────────────────────────

export type ResearchRequest = {
  origin: string;
  /** GPS latitude of the origin from browser geolocation (optional). */
  originLatitude?: number;
  /** GPS longitude of the origin from browser geolocation (optional). */
  originLongitude?: number;
  destination: string;
  latitude: number;
  longitude: number;
  /** Bounding box for region search [south, north, west, east]. */
  boundingBox?: [number, number, number, number];
  city?: string;
  state?: string;
  country?: string;
  travelers: number;
  days: number;
  startDate?: string;
  currency: string;
  interests: string[];
  preferences: {
    accommodation: 'budget' | 'standard' | 'premium';
    food: 'budget' | 'standard' | 'premium';
    transport: TransportMode[];
    localTransport: TransportMode[];
    activities: 'free' | 'budget' | 'standard' | 'premium';
  };
};

export type ResearchResult = {
  request: ResearchRequest;
  places: PlacesResearch;
  accommodation: AccommodationResearch;
  food: FoodResearch;
  intercityTransport: TransportResearch;
  localTransport: LocalTransportResearch;
  weather: WeatherResearch;
  /** ISO 8601 timestamp. */
  researchedAt: string;
  /** Overall data quality: true when at least one live provider responded. */
  hasAnyLiveData: boolean;
};

// ─── Computed budget ──────────────────────────────────────────────────────────

export type ResearchBudget = {
  accommodation: CostItem;
  food: CostItem;
  intercityTransport: CostItem;
  localTransport: CostItem;
  activities: CostItem;
  subtotal: number;
  buffer: CostItem;
  total: number;
  /** total / travelers */
  perPerson: number;
  /** total / days */
  perDay: number;
  /** total / travelers / days */
  perPersonPerDay: number;
  currency: string;
  /** Minimum possible cost from all provider data. */
  minimum: number;
  /** Maximum possible cost from all provider data. */
  maximum: number;
  /** How the total was calculated — shown to the user. */
  breakdown: string;
  remaining: number;
};
