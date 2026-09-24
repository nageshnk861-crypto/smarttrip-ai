export type TravelStyle = 'Budget' | 'Comfort' | 'Premium';

/** Geographic bounding box [south, north, west, east] in decimal degrees. */
export type BoundingBox = [number, number, number, number];

export type TripRequest = {
  origin: string;
  /** GPS latitude of the origin from browser geolocation (optional). */
  originLatitude?: number;
  /** GPS longitude of the origin from browser geolocation (optional). */
  originLongitude?: number;
  destination?: string;
  latitude?: number;
  longitude?: number;
  /** Bounding box of the selected destination [south, north, west, east]. */
  boundingBox?: BoundingBox;
  /** Raw OSM type: 'node' | 'way' | 'relation' — used to choose area vs radius search. */
  osmType?: string;
  city?: string;
  state?: string;
  country?: string;
  budget: number;
  days: number;
  travelers: number;
  interests: string[];
  travelStyle: TravelStyle;
};

export type BudgetBreakdown = {
  transport: number;
  accommodation: number;
  food: number;
  activities: number;
  localTransport: number;
  buffer: number;
  total: number;
  remaining: number;
  /** ISO 4217 currency code, e.g. 'INR', 'USD', 'EUR'. */
  currency: string;
  daily: DailyBudget[];
};

export type DailyBudget = {
  day: number;
  transport: number;
  accommodation: number;
  food: number;
  localTransport: number;
  activities: number;
  buffer: number;
  total: number;
};

export type DayPlan = {
  day: number;
  title: string;
  activities: string[];
  places?: string[];
  estimatedCost?: number;
};

export type WeatherInfo = {
  description: string;
  tempC: number;
  feelsLikeC: number;
  humidity: number;
  windKph: number;
  icon: string;
};

export type TripPlan = {
  destination: string;
  budget: BudgetBreakdown;
  days: DayPlan[];
  candidates: DestinationCandidate[];
  nearbyPlaces: NearbyPlace[];
  weather?: WeatherInfo | null;
  optimization: string;
  isDemo: boolean;
  source: string;
};

export type NearbyPlace = {
  place_id: string;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  distance?: number;
  address?: string;
  source?: string;
};

export type DestinationCandidate = {
  name: string;
  budgetTotal: number;
  remainingBudget: number;
  interestScore: number;
  feasible: boolean;
};

export type PlannerError = {
  code: 'NO_FEASIBLE_PLAN';
  message: string;
  adjustments: string[];
};
