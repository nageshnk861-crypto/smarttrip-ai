/**
 * Backend Data Models & Type Definitions
 */

export type TravelStyle = 'Budget' | 'Comfort' | 'Premium';

export type SourceType = 'provider' | 'live' | 'estimated' | 'demo' | 'unavailable' | 'unknown';

export interface DataSource {
  name: string;
  sourceType: SourceType;
  confidence?: 'high' | 'medium' | 'low';
  retrievedAt: string;
  expiresAt?: string;
  url?: string;
}

export interface PriceRange {
  min: number;
  max: number;
  currency: string;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface TripRequest {
  origin: string;
  startLocation?: string;
  destination: string;
  days: number;
  numberOfDays?: number;
  budget: number;
  travelers: number;
  travelStyle: TravelStyle;
  interests: string[];
  transport?: string;
  transportMode?: string;
  startDate?: string;
  endDate?: string;
  currency?: string;
  latitude?: number;
  longitude?: number;
  originLatitude?: number;
  originLongitude?: number;
  city?: string;
  state?: string;
  country?: string;
  boundingBox?: [number, number, number, number];
}

export interface TouristPlace {
  placeId: string;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  address?: string;
  openingHours?: string;
  distanceKm?: number;
  entryFee?: number | null;
  entryFeeSource?: 'provider' | 'estimated' | 'unknown';
  hasFeeData?: boolean;
  source: DataSource;
}

export interface HotelResult {
  placeId: string;
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
  starRating?: number;
  roomType?: string;
  pricePerNight?: number | null;
  price?: number | null;
  availability: 'available' | 'limited' | 'price_unavailable';
  amenities?: string[];
  source: DataSource;
}

export interface RestaurantResult {
  placeId: string;
  name: string;
  cuisine?: string;
  address?: string;
  latitude: number;
  longitude: number;
  priceLevel?: number;
  mealCostPerPerson?: number | null;
  price?: number | null;
  source: DataSource;
}

export interface WeatherForecastDay {
  date: string;
  tempMaxC: number;
  tempMinC: number;
  description: string;
  icon: string;
  rainProbability?: number;
  windKph?: number;
}

export interface WeatherResearch {
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
}

export interface TransportOption {
  mode: 'bus' | 'train' | 'taxi' | 'flight' | 'car';
  class: string;
  departureName: string;
  arrivalName: string;
  durationMinutes?: number;
  distanceKm?: number;
  priceRange: PriceRange;
  availabilityConfirmed: boolean;
  source: DataSource;
}

export interface TransportResearch {
  origin: string;
  destination: string;
  options: TransportOption[];
  cheapestOption?: TransportOption;
  fastestOption?: TransportOption;
  source: DataSource;
}

export interface LocalTransportOption {
  mode: 'metro' | 'bus' | 'auto' | 'taxi' | 'bike_rental' | 'walking';
  description: string;
  estimatedFare: PriceRange;
  available: boolean;
  source: DataSource;
}

export interface LocalTransportResearch {
  destination: string;
  options: LocalTransportOption[];
  dailyEstimatePerPerson: PriceRange;
  source: DataSource;
}

export interface BudgetBreakdown {
  total: number;
  remaining: number;
  currency: string;
  transport: number;
  accommodation?: number;
  hotel?: number;
  food: number;
  activities: number;
  entryFees?: number;
  localTransport: number;
  otherExpenses?: number;
  buffer: number;
  daily: number;
  costPerPerson?: number;
  rooms?: number;
  nights?: number;
  estimatedTotal?: number;
  remainingBudget?: number;
  isLivePrice?: boolean;
}

export interface ItinerarySlot {
  activity: string;
  place?: TouristPlace | any;
}

export interface ItineraryDay {
  dayNumber: number;
  title: string;
  theme?: string;
  morning: string | ItinerarySlot;
  afternoon: string | ItinerarySlot;
  evening: string | ItinerarySlot;
  meals?: {
    breakfast?: string;
    lunch?: string;
    dinner?: string;
  };
  places: TouristPlace[] | any[];
  estimatedCost: number;
}

export interface TransitScheduleItem {
  mode: 'bus' | 'train' | 'flight' | 'taxi' | 'car';
  name: string;
  operator?: string;
  departureTimes: string[];
  frequency: string;
  duration: string;
  estimatedFare: string;
  boardingPoint: string;
  droppingPoint: string;
  type?: string;
}

export interface TransitStationInfo {
  name: string;
  type: 'bus_station' | 'railway_station' | 'airport' | 'taxi_stand';
  distanceKm: number;
  city?: string;
  address?: string;
}

export interface TransitGuide {
  selectedMode: string;
  summary: string;
  originStation?: string;
  destinationStation?: string;
  nearestBusStand?: TransitStationInfo;
  nearestRailwayStation?: TransitStationInfo;
  schedules: TransitScheduleItem[];
  howToTravelSteps: string[];
  localTransitTips: string[];
}

export interface DailyItineraryItem {
  dayNumber: number;
  title: string;
  theme?: string;
  morning: ItinerarySlot;
  afternoon: ItinerarySlot;
  evening: ItinerarySlot;
  places: any[];
  hotel?: any;
  meals?: {
    lunch?: { name: string; cuisine?: string; distanceKm?: number; specialty?: string };
    dinner?: { name: string; cuisine?: string; distanceKm?: number; specialty?: string };
  };
  transitTip?: string;
  estimatedCost: number;
}

export interface TripPlan {
  destination: string;
  startLocation?: string;
  startDate?: string;
  endDate?: string;
  numberOfDays?: number;
  travelers?: number;
  budget: BudgetBreakdown | number;
  interests?: string[];
  transport?: {
    mode?: string;
    description?: string;
    estimatedCost?: number;
    distanceKm?: number;
    durationMinutes?: number;
    options?: TransportOption[];
    source?: DataSource;
  };
  weather?: {
    available: boolean;
    message?: string;
    current?: {
      tempC: number;
      feelsLikeC: number;
      humidity: number;
      windKph: number;
      description: string;
      icon: string;
    };
    forecast: WeatherForecastDay[];
    source?: DataSource;
  };
  places?: any[];
  hotels?: any[];
  restaurants?: any[];
  foodSpots?: any[];
  transitGuide?: TransitGuide;
  dailyItinerary?: DailyItineraryItem[];
  budgetBreakdown?: {
    transport: number;
    hotel: number;
    food: number;
    activities: number;
    entryFees?: number;
    localTransport: number;
    otherExpenses?: number;
    buffer: number;
    estimatedTotal: number;
    remainingBudget: number;
    costPerPerson?: number;
    rooms?: number;
    nights?: number;
    currency: string;
    isLivePrice: boolean;
    daily: number;
  };
  days?: number;
  itinerary?: ItineraryDay[];
  isDemo?: boolean;
  source?: string;
  candidates?: string[];
  nearbyPlaces?: TouristPlace[] | any[];
  optimization?: {
    adjustedDays?: number;
    recommendedStyle?: TravelStyle;
    costReductionTips?: string[];
  };
  agent?: {
    summary?: string;
    weatherAdvice?: string;
    packingAdvice?: string[];
  };
}

export interface SavedTripRecord {
  id: string;
  user_id?: string;
  destination_name: string;
  origin: string;
  days: number;
  travelers: number;
  budget: number;
  travel_style: string;
  status: string;
  created_at: string;
  plan_data?: TripPlan;
}
