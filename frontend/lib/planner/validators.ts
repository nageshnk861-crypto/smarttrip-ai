import {
  ALL_INTEREST_OPTIONS,
  DEFAULT_TRAVEL_STYLE,
  VALIDATION_MIN_BUDGET,
  VALIDATION_MAX_DAYS,
  VALIDATION_MAX_TRAVELERS,
} from '../config';
import type { BoundingBox, TripRequest, TravelStyle } from './types';

const travelStyles: TravelStyle[] = ['Budget', 'Comfort', 'Premium'];

export { ALL_INTEREST_OPTIONS as interestOptions };

export function parseTripPrompt(prompt: string): Record<string, unknown> {
  const normalized = prompt.trim();
  const budgetMatch = normalized.match(
    /(?:₹|rs\.?|inr|budget\s*(?:is|of|:)?)\s*([\d,]+)/i,
  );
  const daysMatch = normalized.match(/(\d+)\s*[- ]?days?/i);
  const travelersMatch = normalized.match(
    /(?:for|with)\s+(\d+)\s*(?:people|persons|travelers|travellers|adults)?/i,
  );
  const originMatch = normalized.match(
    /(?:starting\s+)?from\s+([a-z][a-z ]*?)(?=,|\.|\s+for\s+|\s+with\s+|\s+budget|$)/i,
  );
  const destinationMatch = normalized.match(
    /\bto\s+([a-z][a-z ]*?)(?=,|\.|\s+for\s+|\s+with\s+|\s+budget|$)/i,
  );
  const interests = ALL_INTEREST_OPTIONS.filter((interest) =>
    normalized.toLowerCase().includes(interest.toLowerCase()),
  );

  return {
    origin: originMatch?.[1]?.trim(),
    destination: destinationMatch?.[1]?.trim(),
    budget: budgetMatch ? Number(budgetMatch[1].replace(/,/g, '')) : undefined,
    days: daysMatch ? Number(daysMatch[1]) : undefined,
    travelers: travelersMatch ? Number(travelersMatch[1]) : undefined,
    interests: interests.length ? interests : undefined,
    travelStyle: DEFAULT_TRAVEL_STYLE,
  };
}

export function validateTripRequest(input: unknown): TripRequest {
  if (!input || typeof input !== 'object') throw new Error('Trip request is required.');
  const v = input as Record<string, unknown>;

  const origin = typeof v.origin === 'string' ? v.origin.trim() : '';
  const destination =
    typeof v.destination === 'string' ? v.destination.trim() : undefined;

  const originLatitude =
    typeof v.originLatitude === 'number' && Number.isFinite(v.originLatitude)
      ? v.originLatitude
      : undefined;
  const originLongitude =
    typeof v.originLongitude === 'number' && Number.isFinite(v.originLongitude)
      ? v.originLongitude
      : undefined;

  const latitude =
    typeof v.latitude === 'number' && Number.isFinite(v.latitude)
      ? v.latitude
      : undefined;
  const longitude =
    typeof v.longitude === 'number' && Number.isFinite(v.longitude)
      ? v.longitude
      : undefined;

  // Accept bounding box as [s,n,w,e] array or as individual numbers.
  let boundingBox: BoundingBox | undefined;
  if (Array.isArray(v.boundingBox) && v.boundingBox.length === 4) {
    const parts = v.boundingBox.map(Number);
    if (parts.every(Number.isFinite)) {
      boundingBox = parts as BoundingBox;
    }
  }

  const osmType = typeof v.osmType === 'string' ? v.osmType : undefined;
  const city = typeof v.city === 'string' ? v.city.trim() : undefined;
  const state = typeof v.state === 'string' ? v.state.trim() : undefined;
  const country = typeof v.country === 'string' ? v.country.trim() : undefined;

  const budget = Number(v.budget);
  const days = Number(v.days);
  const travelers = Number(v.travelers);

  const interests = Array.isArray(v.interests)
    ? (v.interests as unknown[]).filter((i): i is string => typeof i === 'string')
    : [];

  const travelStyle = v.travelStyle as TravelStyle;

  if (!origin) throw new Error('Starting location is required.');
  if (!Number.isFinite(budget) || budget < VALIDATION_MIN_BUDGET)
    throw new Error(`Budget must be at least ${VALIDATION_MIN_BUDGET}.`);
  if (!Number.isInteger(days) || days < 1 || days > VALIDATION_MAX_DAYS)
    throw new Error(`Duration must be between 1 and ${VALIDATION_MAX_DAYS} days.`);
  if (
    !Number.isInteger(travelers) ||
    travelers < 1 ||
    travelers > VALIDATION_MAX_TRAVELERS
  )
    throw new Error(`Travelers must be between 1 and ${VALIDATION_MAX_TRAVELERS}.`);
  if (!interests.length) throw new Error('Select at least one interest.');
  if (!travelStyles.includes(travelStyle))
    throw new Error('Choose a valid travel style: Budget, Comfort, or Premium.');

  return {
    origin,
    destination: destination || undefined,
    originLatitude,
    originLongitude,
    latitude,
    longitude,
    boundingBox,
    osmType,
    city: city || undefined,
    state: state || undefined,
    country: country || undefined,
    budget,
    days,
    travelers,
    interests,
    travelStyle,
  };
}
