/**
 * Central configuration module.
 * All environment-driven constants and application defaults live here.
 * No magic numbers or hardcoded strings should exist elsewhere in the codebase.
 */

// ─── AI / LLM ────────────────────────────────────────────────────────────────

export const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434';
export const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'llama3.2';
export const OLLAMA_SYSTEM_PROMPT =
  process.env.OLLAMA_SYSTEM_PROMPT ??
  'You are SmartTrip AI, an intelligent travel planning assistant. Give practical, concise and budget-aware travel advice.';
export const OLLAMA_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS ?? 30_000);

export const OPENAI_API_URL = process.env.OPENAI_API_URL ?? 'https://api.openai.com/v1/responses';
export const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4.1-mini';

// ─── Places / Maps ───────────────────────────────────────────────────────────

export const NOMINATIM_BASE_URL =
  process.env.NOMINATIM_BASE_URL ?? 'https://nominatim.openstreetmap.org';
export const NOMINATIM_TIMEOUT_MS = Number(process.env.NOMINATIM_TIMEOUT_MS ?? 8_000);
export const NOMINATIM_RESULT_LIMIT = Number(process.env.NOMINATIM_RESULT_LIMIT ?? 8);
export const NOMINATIM_USER_AGENT =
  process.env.NOMINATIM_USER_AGENT ?? 'SmartTrip AI/1.0 (place search)';

export const OVERPASS_BASE_URL =
  process.env.OVERPASS_BASE_URL ?? 'https://overpass-api.de/api/interpreter';
export const OVERPASS_TIMEOUT_MS = Number(process.env.OVERPASS_TIMEOUT_MS ?? 20_000);
export const OVERPASS_NEARBY_LIMIT = Number(process.env.OVERPASS_NEARBY_LIMIT ?? 30);
/** Radius clamped between these values (metres) for Overpass nearby queries. */
export const OVERPASS_RADIUS_MIN = Number(process.env.OVERPASS_RADIUS_MIN ?? 500);
export const OVERPASS_RADIUS_MAX = Number(process.env.OVERPASS_RADIUS_MAX ?? 20_000);

export const GOOGLE_PLACES_API_BASE = 'https://maps.googleapis.com/maps/api/place';

// ─── OpenRouteService (free routing, replaces Google Routes) ─────────────────

export const OPENROUTESERVICE_API_KEY =
  process.env.OPENROUTESERVICE_API_KEY ?? '';
export const OPENROUTESERVICE_BASE_URL =
  process.env.OPENROUTESERVICE_BASE_URL ??
  'https://api.heigit.org/openrouteservice/v2/directions/driving-car';

// ─── Weather ─────────────────────────────────────────────────────────────────

export const WEATHER_API_BASE_URL =
  process.env.WEATHER_API_BASE_URL ?? 'https://api.openweathermap.org/data/2.5/weather';
export const WEATHER_UNITS = (process.env.WEATHER_UNITS ?? 'metric') as 'metric' | 'imperial' | 'standard';
export const WEATHER_CACHE_REVALIDATE_SECONDS = Number(process.env.WEATHER_CACHE_REVALIDATE_SECONDS ?? 900);

// ─── Budget engine ────────────────────────────────────────────────────────────

/** ISO 4217 currency code used for all estimates. */
export const DEFAULT_CURRENCY = (process.env.DEFAULT_CURRENCY ?? 'INR') as string;

/** Base one-way transport cost in DEFAULT_CURRENCY units. */
export const BUDGET_BASE_TRANSPORT = Number(process.env.BUDGET_BASE_TRANSPORT ?? 1_200);
/** Base accommodation cost per night, per double-room, in DEFAULT_CURRENCY units. */
export const BUDGET_BASE_ACCOMMODATION = Number(process.env.BUDGET_BASE_ACCOMMODATION ?? 600);
/** Base food cost per day per traveler, in DEFAULT_CURRENCY units. */
export const BUDGET_BASE_FOOD = Number(process.env.BUDGET_BASE_FOOD ?? 350);
/** Base activities cost per day per traveler, in DEFAULT_CURRENCY units. */
export const BUDGET_BASE_ACTIVITIES = Number(process.env.BUDGET_BASE_ACTIVITIES ?? 200);
/** Base local transport cost per day per traveler, in DEFAULT_CURRENCY units. */
export const BUDGET_BASE_LOCAL_TRANSPORT = Number(process.env.BUDGET_BASE_LOCAL_TRANSPORT ?? 150);
/** Contingency buffer as a fraction of subtotal (0.08 = 8 %). */
export const BUDGET_BUFFER_RATE = Number(process.env.BUDGET_BUFFER_RATE ?? 0.08);

/** Travel-style cost multipliers. */
export const BUDGET_STYLE_MULTIPLIERS: Record<'Budget' | 'Comfort' | 'Premium', number> = {
  Budget: Number(process.env.BUDGET_MULTIPLIER_BUDGET ?? 1),
  Comfort: Number(process.env.BUDGET_MULTIPLIER_COMFORT ?? 1.35),
  Premium: Number(process.env.BUDGET_MULTIPLIER_PREMIUM ?? 1.8),
};

// ─── Validation / planner defaults ───────────────────────────────────────────

export const VALIDATION_MIN_BUDGET = Number(process.env.VALIDATION_MIN_BUDGET ?? 1_000);
export const VALIDATION_MAX_DAYS = Number(process.env.VALIDATION_MAX_DAYS ?? 30);
export const VALIDATION_MAX_TRAVELERS = Number(process.env.VALIDATION_MAX_TRAVELERS ?? 20);
export const DEFAULT_TRAVEL_STYLE = (process.env.DEFAULT_TRAVEL_STYLE ?? 'Budget') as 'Budget' | 'Comfort' | 'Premium';

export const ALL_INTEREST_OPTIONS: string[] = (
  process.env.INTEREST_OPTIONS
    ? process.env.INTEREST_OPTIONS.split(',').map((s) => s.trim()).filter(Boolean)
    : [
        'Beach', 'Cafe', 'Attraction', 'Viewpoint', 'Temple', 'Museum', 'Hotel',
        'Nature', 'History', 'Food', 'Adventure', 'Wildlife', 'Shopping', 'Relaxation',
      ]
);

// ─── UI defaults ──────────────────────────────────────────────────────────────

export const DEFAULT_STARTING_LOCATION = process.env.NEXT_PUBLIC_DEFAULT_ORIGIN ?? '';
export const DEFAULT_BUDGET_AMOUNT = Number(process.env.NEXT_PUBLIC_DEFAULT_BUDGET ?? 15_000);
export const DEFAULT_TRIP_DAYS = Number(process.env.NEXT_PUBLIC_DEFAULT_DAYS ?? 3);
export const DEFAULT_TRIP_TRAVELERS = Number(process.env.NEXT_PUBLIC_DEFAULT_TRAVELERS ?? 2);

// ─── App metadata ─────────────────────────────────────────────────────────────

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? 'SmartTrip AI';
export const APP_DESCRIPTION =
  process.env.NEXT_PUBLIC_APP_DESCRIPTION ??
  'Intelligent, constraint-first travel planning platform.';
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? '1.0.0';

// ─── Stripe ───────────────────────────────────────────────────────────────────

export const STRIPE_API_VERSION = '2024-06-20' as const;

// ─── Hotels ───────────────────────────────────────────────────────────────────

export const HOTELS_CACHE_REVALIDATE_SECONDS = Number(process.env.HOTELS_CACHE_REVALIDATE_SECONDS ?? 600);

// ─── Routing (Mapbox) ─────────────────────────────────────────────────────────

export const MAPBOX_DIRECTIONS_BASE_URL =
  process.env.MAPBOX_DIRECTIONS_BASE_URL ?? 'https://api.mapbox.com/directions/v5/mapbox/driving';

// ─── Middleware / auth ────────────────────────────────────────────────────────

export const PUBLIC_PATHS: string[] = (
  process.env.PUBLIC_PATHS
    ? process.env.PUBLIC_PATHS.split(',').map((s) => s.trim())
    : ['/', '/login', '/register', '/forgot-password', '/reset-password', '/explore', '/about']
);

export const PROTECTED_PATHS: string[] = (
  process.env.PROTECTED_PATHS
    ? process.env.PROTECTED_PATHS.split(',').map((s) => s.trim())
    : ['/dashboard', '/trips', '/saved', '/profile']
);
