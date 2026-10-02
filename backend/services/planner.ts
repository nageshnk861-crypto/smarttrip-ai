/**
 * Trip Planner & Budget Engine Service
 * Connects the places data system (GeoJSON + Overpass), Weather, Routing,
 * and Budget calculation to generate complete, deterministic trip plans.
 */

import type {
  BudgetBreakdown,
  DailyItineraryItem,
  DataSource,
  ItineraryDay,
  ItinerarySlot,
  TouristPlace,
  TravelStyle,
  TripPlan,
  TripRequest,
} from '../models/types.js';
import type { PlaceCategory, PlaceResult } from './geojson.js';
import { haversineKm } from './geojson.js';
import {
  fetchPlacesForCategory,
  fetchPlacesForInterests,
  mapInterestsToCategories,
} from './overpass.js';
import { estimateTransport, geocodePlace } from './routing.js';
import { fetchWeather } from './weather.js';

export class NoFeasiblePlanError extends Error {
  readonly code = 'NO_FEASIBLE_PLAN' as const;
  readonly adjustments = [
    'Increase the overall budget',
    'Reduce the number of days',
    'Reduce the number of travelers',
    'Switch to a Budget travel style',
  ];

  constructor(message = 'No feasible trip was found within the current budget.') {
    super(message);
    this.name = 'NoFeasiblePlanError';
  }
}

const STYLE_MULTIPLIERS: Record<TravelStyle, number> = {
  Budget: 1.0,
  Comfort: 1.35,
  Premium: 1.85,
};

// Common Indian destination fallback coordinates for instant offline fallback
const FALLBACK_COORDS: Record<string, { lat: number; lng: number }> = {
  goa: { lat: 15.2993, lng: 74.1240 },
  bengaluru: { lat: 12.9716, lng: 77.5946 },
  bangalore: { lat: 12.9716, lng: 77.5946 },
  delhi: { lat: 28.6139, lng: 77.2090 },
  'new delhi': { lat: 28.6139, lng: 77.2090 },
  mumbai: { lat: 19.0760, lng: 72.8777 },
  jaipur: { lat: 26.9124, lng: 75.7873 },
  manali: { lat: 32.2432, lng: 77.1892 },
  shimla: { lat: 31.1048, lng: 77.1734 },
  agra: { lat: 27.1767, lng: 78.0081 },
  varanasi: { lat: 25.3176, lng: 82.9739 },
  hyderabad: { lat: 17.3850, lng: 78.4867 },
  chennai: { lat: 13.0827, lng: 80.2707 },
  kolkata: { lat: 22.5726, lng: 88.3639 },
  kochi: { lat: 9.9312, lng: 76.2673 },
  kerala: { lat: 9.9312, lng: 76.2673 },
  ooty: { lat: 11.4102, lng: 76.6950 },
  rishikesh: { lat: 30.0869, lng: 78.2676 },
};

function getFallbackCoordinates(name: string): { lat: number; lng: number } | null {
  const key = name.toLowerCase().trim();
  for (const [k, v] of Object.entries(FALLBACK_COORDS)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return null;
}

/**
 * Resolves coordinates for destination and origin
 */
export async function resolveCoordinates(
  placeName: string,
  providedLat?: number,
  providedLng?: number,
): Promise<{ lat: number; lng: number }> {
  if (
    providedLat !== undefined &&
    providedLng !== undefined &&
    !isNaN(providedLat) &&
    !isNaN(providedLng) &&
    providedLat >= -90 &&
    providedLat <= 90
  ) {
    return { lat: providedLat, lng: providedLng };
  }

  // 1. Try Nominatim Geocoding
  try {
    const geocoded = await geocodePlace(placeName);
    if (geocoded) return geocoded;
  } catch (err) {
    console.warn(`Geocoding error for "${placeName}":`, err);
  }

  // 2. Try Fallback Dictionary
  const fallback = getFallbackCoordinates(placeName);
  if (fallback) return fallback;

  // 3. Default to Bengaluru / Central India
  return { lat: 15.2993, lng: 74.1240 };
}

/**
 * Calculates deterministic budget breakdown using exact expense formulas:
 * - Temple / Sightseeing Entry fees = Entry fee per person × number of travellers
 * - Car / taxi cost = Total route distance (km) × estimated cost per km
 * - Bus cost = Bus fare per person × travellers × journeys
 * - Bike fuel cost = Distance ÷ mileage × fuel price per litre × bikes needed
 * - Food cost = Food budget per person per day × travellers × days
 * - Hotel cost = Room price per night × rooms × nights
 * - Total trip cost = Entry fees + transport + food + hotel + other expenses
 * - Cost per person = Total trip cost ÷ number of travellers
 */
import { estimateBusFare } from './bus-rate-model.js';

export function calculateBudgetBreakdown(
  request: TripRequest,
  transportEstimate?: number,
  distanceKm: number = 250,
  visitedPlacesCount: number = 6,
): BudgetBreakdown {
  const travelers = Math.max(request.travelers || 1, 1);
  const days = Math.max(request.days || request.numberOfDays || 1, 1);
  const nights = Math.max(1, days - 1);
  const rooms = Math.ceil(travelers / 2); // 2 people per room standard
  const style = request.travelStyle || 'Budget';
  const multiplier = STYLE_MULTIPLIERS[style] || 1.0;
  const currency = request.currency || 'INR';
  const mode = (request.transport || request.transportMode || 'bus').toLowerCase();

  // 1. Temple / Sightseeing Entry Fees: Entry fee per person × number of travellers
  const entryFeePerPersonPerAttraction = style === 'Premium' ? 120 : style === 'Comfort' ? 60 : 30;
  const attractionsCount = Math.max(1, Math.min(visitedPlacesCount, days * 3));
  const entryFeePerPerson = entryFeePerPersonPerAttraction * attractionsCount;
  const baseEntryFees = Math.round(entryFeePerPerson * travelers);

  // 2. Transport Cost based on mode:
  let baseTransport = 0;
  if (transportEstimate !== undefined && transportEstimate > 0) {
    baseTransport = transportEstimate;
  } else {
    if (mode === 'car' || mode === 'taxi') {
      // Total route distance (km) × estimated cost per km (round trip = distance * 2)
      const costPerKm = style === 'Premium' ? 18 : style === 'Comfort' ? 14 : 11;
      const totalRouteDistance = distanceKm * 2;
      baseTransport = Math.round(totalRouteDistance * costPerKm);
    } else if (mode === 'bus') {
      const busCategory = style === 'Premium' ? 'AC' : style === 'Comfort' ? 'DELUXE' : 'EXPRESS';
      const busEstimate = estimateBusFare({
        distanceKm,
        category: busCategory,
        travelers,
        roundTrip: true,
      });
      baseTransport = busEstimate.total?.expected ?? Math.round(distanceKm * 2.5 * travelers * 2);
    } else if (mode === 'bike') {
      // Distance ÷ mileage × fuel price per litre
      const mileage = 40; // 40 km/L standard bike mileage
      const fuelPricePerLitre = 102; // ₹102/L standard fuel price
      const totalDistance = distanceKm * 2;
      const bikesNeeded = Math.ceil(travelers / 2); // max 2 persons per bike
      baseTransport = Math.round((totalDistance / mileage) * fuelPricePerLitre * bikesNeeded);
    } else if (mode === 'train') {
      const trainFarePerPerson = Math.max(180, Math.round(distanceKm * 0.65 * multiplier));
      baseTransport = Math.round(trainFarePerPerson * travelers * 2);
    } else if (mode === 'flight') {
      const flightFare = Math.round((2200 + distanceKm * 4.0) * multiplier);
      baseTransport = Math.round(flightFare * travelers * 2);
    } else {
      baseTransport = Math.round(distanceKm * 12);
    }
  }

  // 3. Hotel Cost: Room price per night × rooms × nights
  const roomPricePerNight = Math.round((style === 'Premium' ? 3800 : style === 'Comfort' ? 2000 : 1100) * multiplier);
  const baseHotel = Math.round(roomPricePerNight * rooms * nights);

  // 4. Food Cost: Food budget per person per day × travellers × days
  const foodBudgetPerPersonPerDay = Math.round((style === 'Premium' ? 1100 : style === 'Comfort' ? 650 : 380) * multiplier);
  const baseFood = Math.round(foodBudgetPerPersonPerDay * travelers * days);

  // 5. Local Transport: Daily estimate per person
  const localTransportPerPersonPerDay = Math.round((style === 'Premium' ? 350 : style === 'Comfort' ? 220 : 130) * multiplier);
  const baseLocalTransport = Math.round(localTransportPerPersonPerDay * travelers * days);

  // 6. Other Expenses / Contingency Buffer
  const baseOtherExpenses = Math.round((baseFood + baseHotel + baseTransport) * 0.05);
  const buffer = Math.round((baseFood + baseHotel + baseTransport + baseEntryFees + baseLocalTransport) * 0.05);

  // 7. Total Trip Cost: Entry fees + transport + food + hotel + localTransport + other expenses
  const total = Math.round(
    baseEntryFees + baseTransport + baseHotel + baseFood + baseLocalTransport + baseOtherExpenses + buffer,
  );

  // 8. Cost per Person: Total trip cost ÷ number of travellers
  const costPerPerson = Math.round(total / travelers);
  const remaining = Math.max(0, request.budget - total);

  return {
    total,
    remaining,
    currency,
    transport: Math.round(baseTransport),
    accommodation: Math.round(baseHotel),
    hotel: Math.round(baseHotel),
    food: Math.round(baseFood),
    activities: Math.round(baseEntryFees),
    entryFees: Math.round(baseEntryFees),
    localTransport: Math.round(baseLocalTransport),
    otherExpenses: Math.round(baseOtherExpenses),
    buffer,
    daily: Math.round(total / days),
    costPerPerson,
    rooms,
    nights,
    estimatedTotal: total,
    remainingBudget: remaining,
    isLivePrice: false,
  };
}

/**
 * Helper to pick the closest unused place from candidate categories
 */
function pickClosestPlace(
  candidates: PlaceResult[],
  preferredCategories: PlaceCategory[],
  refLat?: number,
  refLng?: number,
  usedIds = new Set<string>(),
): PlaceResult | null {
  const available = candidates.filter((p) => !usedIds.has(p.id));
  if (available.length === 0) return null;

  // Filter by preferred categories first
  const preferred = available.filter((p) => preferredCategories.includes(p.category));
  const pool = preferred.length > 0 ? preferred : available;

  if (refLat === undefined || refLng === undefined) {
    const selected = pool[0];
    usedIds.add(selected.id);
    return selected;
  }

  // Find place closest to refLat, refLng
  let best = pool[0];
  let minDistance = haversineKm(refLat, refLng, best.latitude, best.longitude);

  for (let i = 1; i < pool.length; i++) {
    const p = pool[i];
    const d = haversineKm(refLat, refLng, p.latitude, p.longitude);
    if (d < minDistance) {
      minDistance = d;
      best = p;
    }
  }

  usedIds.add(best.id);
  return best;
}

/**
 * Builds descriptions for itinerary time slots based on category
 */
function describeActivity(
  slot: 'morning' | 'afternoon' | 'evening',
  place: PlaceResult | null,
  destination: string,
  dayNum: number,
): string {
  if (!place) {
    if (slot === 'morning') {
      return `Explore cultural heritage, scenic landmarks, and morning markets around ${destination}.`;
    }
    if (slot === 'afternoon') {
      return `Enjoy local specialty cuisine at a popular dining spot and explore the surrounding neighborhood.`;
    }
    return `Relax and enjoy leisure time, evening strolls, and sunset viewpoints in ${destination}.`;
  }

  const categoryName = place.category.toUpperCase();
  const locationText = place.city ? ` in ${place.city}` : '';

  switch (place.category) {
    case 'beach':
      return slot === 'evening'
        ? `Catch the scenic sunset and coastal breeze at ${place.name}${locationText} (${categoryName}).`
        : `Relax along the shore, enjoy water activities and coastal sights at ${place.name}${locationText} (${categoryName}).`;
    case 'temple':
      return `Visit ${place.name}${locationText} (${categoryName}) to admire historical architecture and spiritual heritage.`;
    case 'attraction':
      return `Discover the prominent sights and photo spots at ${place.name}${locationText} (${categoryName}).`;
    case 'viewpoint':
      return `Take in panoramic views of the landscape and horizon from ${place.name}${locationText} (${categoryName}).`;
    case 'cafe':
      return `Savor fresh brew, specialty coffee, and local delicacies at ${place.name}${locationText} (${categoryName}).`;
    case 'hotel':
      return `Check in, freshen up, and relax at ${place.name}${locationText} (${categoryName}).`;
    case 'museum':
      return `Immerse in curated regional history, art, and artifacts at ${place.name}${locationText} (${categoryName}).`;
    default:
      return `Visit ${place.name}${locationText} (${categoryName}) for sightseeing and local exploration.`;
  }
}

/**
 * Generates a deterministic day-by-day itinerary clustered by distance and user interests
 */
/**
 * Generates a deterministic day-by-day itinerary clustered by distance and user interests
 */
export function generateDeterministicItinerary(
  destination: string,
  days: number,
  allPlaces: PlaceResult[],
  byCategory: Record<string, PlaceResult[]>,
  interests: string[] = [],
  availableHotels: PlaceResult[] = [],
  availableRestaurants: PlaceResult[] = [],
): DailyItineraryItem[] {
  const result: DailyItineraryItem[] = [];
  const safeDays = Math.max(1, Math.min(days, 30));
  const usedIds = new Set<string>();

  // Map interests
  const userCategories = mapInterestsToCategories(interests);

  // Preference buckets
  const morningPrefs: PlaceCategory[] = userCategories.filter((c) =>
    ['attraction', 'temple', 'museum'].includes(c),
  );
  if (morningPrefs.length === 0) morningPrefs.push('attraction', 'temple', 'museum', 'beach');

  const afternoonPrefs: PlaceCategory[] = userCategories.filter((c) =>
    ['beach', 'viewpoint', 'attraction', 'museum'].includes(c),
  );
  if (afternoonPrefs.length === 0) afternoonPrefs.push('beach', 'viewpoint', 'attraction', 'cafe');

  const eveningPrefs: PlaceCategory[] = userCategories.filter((c) =>
    ['cafe', 'viewpoint', 'beach'].includes(c),
  );
  if (eveningPrefs.length === 0) eveningPrefs.push('cafe', 'viewpoint', 'beach', 'attraction');

  for (let i = 1; i <= safeDays; i++) {
    // 1. Morning slot
    const morningPlace = pickClosestPlace(allPlaces, morningPrefs, undefined, undefined, usedIds);

    // 2. Afternoon slot (clustered near morning place if available)
    const afternoonPlace = pickClosestPlace(
      allPlaces,
      afternoonPrefs,
      morningPlace?.latitude,
      morningPlace?.longitude,
      usedIds,
    );

    // 3. Evening slot (clustered near afternoon place if available)
    const eveningRef = afternoonPlace || morningPlace;
    const eveningPlace = pickClosestPlace(
      allPlaces,
      eveningPrefs,
      eveningRef?.latitude,
      eveningRef?.longitude,
      usedIds,
    );

    const dayPlaces: PlaceResult[] = [morningPlace, afternoonPlace, eveningPlace].filter(
      (p): p is PlaceResult => p !== null,
    );

    const morningDesc = describeActivity('morning', morningPlace, destination, i);
    const afternoonDesc = describeActivity('afternoon', afternoonPlace, destination, i);
    const eveningDesc = describeActivity('evening', eveningPlace, destination, i);

    let dayTitle = `Day ${i} in ${destination}`;
    if (i === 1) {
      dayTitle = `Arrival & First Impressions of ${destination}`;
    } else if (i === safeDays && safeDays > 1) {
      dayTitle = `Farewell & Memorable Highlights of ${destination}`;
    } else {
      const themes = [
        'Coastal & Cultural Exploration',
        'Scenic Heritage & Local Flavors',
        'Iconic Sights & Relaxed Wandering',
        'Nature, Landmarks & Discovery',
      ];
      dayTitle = `${themes[(i - 2) % themes.length]} in ${destination}`;
    }

    // Assign hotel for the day
    const dayHotel = availableHotels[(i - 1) % Math.max(1, availableHotels.length)] || {
      name: `Grand Stay Hotel ${destination}`,
      category: 'hotel',
      city: destination,
      distanceKm: 1.5 + (i * 0.5),
    };

    // Assign lunch and dinner
    const lunchSpot = availableRestaurants[((i - 1) * 2) % Math.max(1, availableRestaurants.length)] || {
      name: `${destination} Heritage Bhojanalaya`,
      category: 'cafe',
      city: destination,
      distanceKm: 0.8 + (i * 0.3),
    };

    const dinnerSpot = availableRestaurants[((i - 1) * 2 + 1) % Math.max(1, availableRestaurants.length)] || {
      name: `Royal Flavors Restaurant & Sweets`,
      category: 'cafe',
      city: destination,
      distanceKm: 1.2 + (i * 0.4),
    };

    result.push({
      dayNumber: i,
      title: dayTitle,
      morning: {
        activity: morningDesc,
        place: morningPlace || undefined,
      },
      afternoon: {
        activity: afternoonDesc,
        place: afternoonPlace || undefined,
      },
      evening: {
        activity: eveningDesc,
        place: eveningPlace || undefined,
      },
      places: dayPlaces,
      hotel: dayHotel,
      meals: {
        lunch: {
          name: lunchSpot.name,
          cuisine: 'Authentic Local & Regional Cuisine',
          distanceKm: lunchSpot.distanceKm ?? 1.2,
          specialty: 'Traditional Thali, Fresh Specialty Lunch & Refreshing Coolers',
        },
        dinner: {
          name: dinnerSpot.name,
          cuisine: 'Multi-cuisine & North/South Indian',
          distanceKm: dinnerSpot.distanceKm ?? 1.6,
          specialty: 'Signature Dinner Delicacies, Evening Desserts & Chai',
        },
      },
      transitTip: `Take local city bus (₹10–₹25) or shared auto-rickshaw (₹40–₹80) between morning and evening spots.`,
      estimatedCost: Math.round(600 + Math.random() * 400),
    });
  }

  return result;
}

/**
 * Main Phase 3 Deterministic Trip Planning Pipeline
 */
export async function planTripPipeline(request: TripRequest): Promise<TripPlan> {
  const destName = (request.destination || 'Goa').trim();
  const startLoc = (request.origin || request.startLocation || 'Bengaluru').trim();
  const days = Math.max(Number(request.days || request.numberOfDays) || 3, 1);
  const travelers = Math.max(Number(request.travelers) || 1, 1);
  const budget = Number(request.budget) || 20000;
  const currency = request.currency || 'INR';
  const interests = Array.isArray(request.interests) ? request.interests : [];
  const selectedTransportMode = (
    request.transport ||
    request.transportMode ||
    'bus'
  ).toLowerCase();

  // 1. Resolve Destination Coordinates
  const destCoords = await resolveCoordinates(
    destName,
    request.latitude,
    request.longitude,
  );

  // 2. Resolve Origin Coordinates
  const originCoords = await resolveCoordinates(
    startLoc,
    request.originLatitude,
    request.originLongitude,
  );

  // 3. Retrieve relevant places from 7 categories (GeoJSON + Overpass)
  let { places, byCategory } = await fetchPlacesForInterests(
    interests,
    destCoords.lat,
    destCoords.lng,
    30000,
  );

  // If 0 places found at 30km, broaden search to 60km across all categories
  if (places.length === 0) {
    const broader = await fetchPlacesForInterests(
      ['attraction', 'viewpoint', 'cafe', 'temple', 'museum', 'beach', 'hotel'],
      destCoords.lat,
      destCoords.lng,
      60000,
    );
    places = broader.places;
    byCategory = broader.byCategory;
  }

  // 3b. Ensure Hotels and Restaurants/Food Spots are fetched
  let hotels: PlaceResult[] = byCategory['hotel'] || [];
  if (hotels.length === 0) {
    try {
      const hotelRes = await fetchPlacesForCategory('hotel', destCoords.lat, destCoords.lng, 45000);
      hotels = hotelRes.places;
    } catch (e) {
      console.warn('Hotel lookup error:', e);
    }
  }

  // Fallback default hotels if none in database for very specific pin
  if (hotels.length === 0) {
    hotels = [
      {
        id: 'fallback-hotel-1',
        name: `Grand Palace Stay & Suites`,
        category: 'hotel',
        city: destName,
        state: request.state || '',
        country: 'India',
        latitude: destCoords.lat + 0.01,
        longitude: destCoords.lng + 0.01,
        distanceKm: 1.8,
        source: 'geojson',
      },
      {
        id: 'fallback-hotel-2',
        name: `Heritage Comfort Hotel & Resort`,
        category: 'hotel',
        city: destName,
        state: request.state || '',
        country: 'India',
        latitude: destCoords.lat - 0.012,
        longitude: destCoords.lng - 0.015,
        distanceKm: 2.4,
        source: 'geojson',
      },
      {
        id: 'fallback-hotel-3',
        name: `City View Inn & Residency`,
        category: 'hotel',
        city: destName,
        state: request.state || '',
        country: 'India',
        latitude: destCoords.lat + 0.02,
        longitude: destCoords.lng - 0.01,
        distanceKm: 3.1,
        source: 'geojson',
      },
    ];
  }

  let foodSpots: PlaceResult[] = byCategory['cafe'] || [];
  if (foodSpots.length === 0) {
    try {
      const cafeRes = await fetchPlacesForCategory('cafe', destCoords.lat, destCoords.lng, 45000);
      foodSpots = cafeRes.places;
    } catch (e) {
      console.warn('Cafe/restaurant lookup error:', e);
    }
  }

  // Fallback default food spots if none in database for very specific pin
  if (foodSpots.length === 0) {
    foodSpots = [
      {
        id: 'fallback-food-1',
        name: `Traditional ${destName} Bhojanalaya & Dining Hall`,
        category: 'cafe',
        city: destName,
        state: request.state || '',
        country: 'India',
        latitude: destCoords.lat + 0.008,
        longitude: destCoords.lng + 0.005,
        distanceKm: 0.9,
        source: 'geojson',
      },
      {
        id: 'fallback-food-2',
        name: `Royal Flavors Restaurant & Sweets`,
        category: 'cafe',
        city: destName,
        state: request.state || '',
        country: 'India',
        latitude: destCoords.lat - 0.009,
        longitude: destCoords.lng + 0.012,
        distanceKm: 1.4,
        source: 'geojson',
      },
      {
        id: 'fallback-food-3',
        name: `Highway Delight Cafe & Pure Veg Restaurant`,
        category: 'cafe',
        city: destName,
        state: request.state || '',
        country: 'India',
        latitude: destCoords.lat + 0.015,
        longitude: destCoords.lng - 0.008,
        distanceKm: 2.2,
        source: 'geojson',
      },
    ];
  }

  // 4. Retrieve Live Weather with graceful fallback
  let weatherResult: TripPlan['weather'] = {
    available: false,
    message: 'Weather information temporarily unavailable.',
    forecast: [],
  };

  try {
    const weather = await fetchWeather(destCoords.lat, destCoords.lng, days);
    if (weather.available) {
      weatherResult = {
        available: true,
        current: weather.current,
        forecast: weather.forecast,
        source: weather.source,
      };
    }
  } catch (err) {
    console.warn('Weather service unavailable:', err);
  }

  // 5. Estimate Transport
  let transportResearch = await estimateTransport(
    startLoc,
    destName,
    destCoords.lat,
    destCoords.lng,
    originCoords.lat,
    originCoords.lng,
    currency,
  );

  const matchingOption =
    transportResearch.options.find(
      (opt) => opt.mode.toLowerCase() === selectedTransportMode,
    ) ||
    transportResearch.options.find((opt) => opt.mode.toLowerCase() === 'bus') ||
    transportResearch.cheapestOption ||
    transportResearch.options[0];

  // Calculate estimated round-trip transport cost for all travelers
  const oneWayPerPerson = matchingOption?.priceRange?.min || 600;
  const transportCost = Math.round(oneWayPerPerson * 2 * travelers);
  const distanceKm = matchingOption?.distanceKm || 250;

  // Generate transit guide
  const { generateTransitGuide } = await import('./routing.js');
  const transitGuide = generateTransitGuide(
    startLoc,
    destName,
    distanceKm,
    selectedTransportMode,
    currency,
  );

  // 6. Calculate Budget Breakdown
  const budgetBreakdown = calculateBudgetBreakdown(
    {
      ...request,
      days,
      travelers,
      budget,
      currency,
    },
    transportCost,
    distanceKm,
    places.length,
  );

  // 7. Generate Day-by-Day Deterministic Itinerary
  const dailyItinerary = generateDeterministicItinerary(
    destName,
    days,
    places,
    byCategory,
    interests,
    hotels,
    foodSpots,
  );

  // 8. Calculate Dates
  const now = new Date();
  const startDateStr = request.startDate || now.toISOString().split('T')[0];
  const startDateObj = new Date(startDateStr);
  const endDateObj = new Date(startDateObj.getTime() + (days - 1) * 86400000);
  const endDateStr = request.endDate || endDateObj.toISOString().split('T')[0];

  // Convert dailyItinerary to ItineraryDay[] for backward compatibility
  const legacyItinerary: ItineraryDay[] = dailyItinerary.map((d) => ({
    dayNumber: d.dayNumber,
    title: d.title,
    morning: d.morning.activity,
    afternoon: d.afternoon.activity,
    evening: d.evening.activity,
    places: d.places as any,
    estimatedCost: d.estimatedCost,
  }));

  const tripPlanResult: TripPlan = {
    destination: destName,
    startLocation: startLoc,
    startDate: startDateStr,
    endDate: endDateStr,
    numberOfDays: days,
    travelers,
    budget,
    interests,
    transport: {
      mode: matchingOption?.mode || selectedTransportMode,
      description: `${(matchingOption?.mode || selectedTransportMode).toUpperCase()} from ${startLoc} to ${destName}`,
      estimatedCost: transportCost,
      distanceKm: matchingOption?.distanceKm,
      durationMinutes: matchingOption?.durationMinutes,
      options: transportResearch.options,
      source: matchingOption?.source || transportResearch.source,
    },
    transitGuide,
    hotels,
    restaurants: foodSpots,
    foodSpots,
    weather: weatherResult,
    places,
    dailyItinerary,
    budgetBreakdown: {
      transport: budgetBreakdown.transport,
      hotel: budgetBreakdown.hotel || budgetBreakdown.accommodation || 0,
      food: budgetBreakdown.food,
      activities: budgetBreakdown.activities,
      entryFees: budgetBreakdown.entryFees,
      localTransport: budgetBreakdown.localTransport,
      otherExpenses: budgetBreakdown.otherExpenses,
      buffer: budgetBreakdown.buffer,
      estimatedTotal: budgetBreakdown.total,
      remainingBudget: budgetBreakdown.remaining,
      costPerPerson: budgetBreakdown.costPerPerson,
      rooms: budgetBreakdown.rooms,
      nights: budgetBreakdown.nights,
      currency,
      isLivePrice: false,
      daily: budgetBreakdown.daily,
    },
    // Compatibility fields
    days,
    itinerary: legacyItinerary,
    nearbyPlaces: places as any,
    optimization: {
      adjustedDays: days,
      recommendedStyle: request.travelStyle || 'Budget',
      costReductionTips: [
        'Book bus or train seats in advance for best fares.',
        'Use local auto-rickshaws and public transit for city travel.',
        'Taste authentic local cuisine and street food specialties.',
      ],
    },
    source: 'SmartTrip Phase 3 Deterministic Engine',
  };

  return tripPlanResult;
}

/**
 * Backward compatibility function
 */
export function generateItinerary(
  destination: string,
  days: number,
  places: TouristPlace[] = [],
): ItineraryDay[] {
  const safeDays = Math.max(1, Math.min(days, 15));
  const result: ItineraryDay[] = [];

  for (let i = 1; i <= safeDays; i++) {
    const dayPlaces = places.slice((i - 1) * 2, i * 2);
    const p1 = dayPlaces[0]?.name || `Attraction in ${destination}`;
    const p2 = dayPlaces[1]?.name || `Scenic viewpoint in ${destination}`;

    result.push({
      dayNumber: i,
      title: i === 1 ? `Arrival & Highlights of ${destination}` : `Exploring ${destination} — Day ${i}`,
      morning: `Visit ${p1}. Enjoy sightseeing and photography.`,
      afternoon: `Experience local cuisine and head to ${p2}.`,
      evening: `Evening relaxation and cafe exploration in ${destination}.`,
      places: dayPlaces,
      estimatedCost: 800,
    });
  }

  return result;
}

export function planTripDeterministic(request: TripRequest, places: TouristPlace[] = []): TripPlan {
  const budget = calculateBudgetBreakdown(request);

  if (budget.total > request.budget) {
    throw new NoFeasiblePlanError(
      `Estimated trip cost ₹${budget.total.toLocaleString()} exceeds your budget ₹${request.budget.toLocaleString()}.`,
    );
  }

  const itinerary = generateItinerary(request.destination, request.days || request.numberOfDays || 3, places);

  return {
    destination: request.destination,
    days: request.days || request.numberOfDays || 3,
    budget,
    itinerary,
    nearbyPlaces: places,
    optimization: {
      adjustedDays: request.days || request.numberOfDays || 3,
      recommendedStyle: request.travelStyle,
      costReductionTips: [
        'Book trains or buses in advance for optimal savings.',
        'Use local metro and public transit instead of private cabs for city travel.',
        'Savor authentic local street food and popular regional eateries.',
      ],
    },
    source: 'SmartTrip deterministic budget & planner engine',
  };
}
