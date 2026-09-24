/**
 * Worldwide destination regression tests.
 *
 * These tests verify that:
 *  1. The planner preserves any destination the user enters — it never
 *     substitutes Mysore, Coorg, or any other hardcoded fallback.
 *  2. The budget engine is deterministic and independent of destination name.
 *  3. The itinerary engine uses only the supplied verified places.
 *  4. Destinations spanning every continent and region type work correctly.
 *
 * Destination names here are TEST INPUTS only — they are NOT present in
 * production planner logic.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateBudget } from '../lib/planner/budget-engine.js';
import { buildItinerary } from '../lib/planner/itinerary-engine.js';
import { planTrip } from '../lib/planner/planner.js';
import { validateTripRequest } from '../lib/planner/validators.js';

// ─── Destinations under test ─────────────────────────────────────────────────
// These cover: Indian states, Indian cities, world capitals, European cities,
// Middle East, East Asia, South-East Asia, Americas, and Oceania.
const WORLDWIDE_DESTINATIONS = [
  // Indian regions / states
  'Kerala',
  'Rajasthan',
  'Goa',
  'Tamil Nadu',
  'Karnataka',
  'Uttarakhand',
  // Indian cities
  'Mysore',      // must remain Mysore — NOT replaced by anything else
  'Munnar',
  'Jaipur',
  'Bangalore',
  'Mumbai',
  'Chennai',
  'Hampi',
  'Coorg',
  // International cities
  'Paris',
  'London',
  'Dubai',
  'Tokyo',
  'New York',
  'Rome',
  'Sydney',
  // International regions
  'Bali',
  'Switzerland',
  'Tuscany',
];

// HARDCODED_FALLBACK_NAMES must never appear in output unless the user
// explicitly typed them as their destination.
const FORBIDDEN_SUBSTITUTIONS = ['Mysore', 'Coorg', 'Hampi', 'Goa', 'Jaipur'];

// ─── Test helpers ─────────────────────────────────────────────────────────────

function makeRequest(destination: string, overrides: Record<string, unknown> = {}) {
  return validateTripRequest({
    origin: 'Bangalore',
    destination,
    latitude: 12.97,
    longitude: 77.59,
    budget: 50_000,
    days: 5,
    travelers: 2,
    interests: ['Nature', 'History', 'Food'],
    travelStyle: 'Comfort',
    ...overrides,
  });
}

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('Worldwide destination — no hardcoded substitution', () => {
  it('preserves every destination exactly as entered', () => {
    for (const dest of WORLDWIDE_DESTINATIONS) {
      const req = makeRequest(dest);
      const plan = planTrip(req);
      assert.equal(
        plan.destination,
        dest,
        `Expected destination "${dest}" but got "${plan.destination}"`,
      );
    }
  });

  it('never replaces user destination with a hardcoded fallback', () => {
    // For destinations that are NOT in the forbidden list, the output must
    // never silently become one of those forbidden names.
    const nonForbidden = WORLDWIDE_DESTINATIONS.filter(
      (d) => !FORBIDDEN_SUBSTITUTIONS.includes(d),
    );
    for (const dest of nonForbidden) {
      const req = makeRequest(dest);
      const plan = planTrip(req);
      assert.ok(
        !FORBIDDEN_SUBSTITUTIONS.includes(plan.destination),
        `Destination "${dest}" was replaced with forbidden fallback "${plan.destination}"`,
      );
    }
  });

  it('returns Mysore when user explicitly selects Mysore', () => {
    const req = makeRequest('Mysore');
    assert.equal(planTrip(req).destination, 'Mysore');
  });

  it('returns Coorg when user explicitly selects Coorg', () => {
    const req = makeRequest('Coorg');
    assert.equal(planTrip(req).destination, 'Coorg');
  });

  it('returns Paris when user explicitly selects Paris', () => {
    const req = makeRequest('Paris');
    assert.equal(planTrip(req).destination, 'Paris');
  });

  it('returns Tokyo when user explicitly selects Tokyo', () => {
    const req = makeRequest('Tokyo');
    assert.equal(planTrip(req).destination, 'Tokyo');
  });

  it('returns London when user explicitly selects London', () => {
    const req = makeRequest('London');
    assert.equal(planTrip(req).destination, 'London');
  });

  it('returns Bali when user explicitly selects Bali', () => {
    const req = makeRequest('Bali');
    assert.equal(planTrip(req).destination, 'Bali');
  });

  it('returns Dubai when user explicitly selects Dubai', () => {
    const req = makeRequest('Dubai');
    assert.equal(planTrip(req).destination, 'Dubai');
  });
});

describe('Budget engine — deterministic and destination-independent', () => {
  it('produces identical totals for different destinations with the same parameters', () => {
    const base = { budget: 50_000, days: 5, travelers: 2, interests: ['Nature'], travelStyle: 'Budget' as const };
    const req1 = validateTripRequest({ origin: 'Bangalore', destination: 'Kerala', ...base, latitude: 10.85, longitude: 76.27 });
    const req2 = validateTripRequest({ origin: 'Bangalore', destination: 'Paris', ...base, latitude: 48.86, longitude: 2.35 });
    const req3 = validateTripRequest({ origin: 'Bangalore', destination: 'Tokyo', ...base, latitude: 35.68, longitude: 139.69 });

    const b1 = calculateBudget(req1, 1);
    const b2 = calculateBudget(req2, 1);
    const b3 = calculateBudget(req3, 1);

    assert.equal(b1.total, b2.total, 'Budget must be same for Paris vs Kerala (same params)');
    assert.equal(b1.total, b3.total, 'Budget must be same for Tokyo vs Kerala (same params)');
  });

  it('daily breakdown sums equal the overall total', () => {
    const req = makeRequest('New York');
    const budget = calculateBudget(req, 1);
    const dailySum = budget.daily.reduce((sum, d) => sum + d.total, 0);
    assert.equal(dailySum, budget.total, 'Daily total must equal overall total');
  });
});

describe('Itinerary engine — only uses supplied verified places', () => {
  it('uses supplied places for middle days', () => {
    const req = makeRequest('Paris');
    const places = ['Eiffel Tower stub', 'Louvre stub', 'Notre-Dame stub', 'Musee dOrsay stub'];
    const itinerary = buildItinerary(req, 'Paris', places);

    assert.equal(itinerary.length, req.days);

    // Day 1: arrival
    assert.ok(itinerary[0].activities.some((a) => a.includes('Paris')));
    // Middle days: only supplied places
    const middleDays = itinerary.slice(1, itinerary.length - 1);
    for (const day of middleDays) {
      for (const activity of day.activities) {
        assert.ok(
          activity.startsWith('Visit') ||
            activity.includes('No verified nearby places found') ||
            activity.includes('place data'),
          `Unexpected activity: "${activity}"`,
        );
        // Must not reference any hardcoded fallback destination
        assert.ok(
          !FORBIDDEN_SUBSTITUTIONS.some((f) => activity.includes(f)),
          `Hardcoded fallback found in activity: "${activity}"`,
        );
      }
    }
  });

  it('shows missing-data message when no places are supplied', () => {
    const req = makeRequest('Switzerland');
    const itinerary = buildItinerary(req, 'Switzerland', []);
    const middleDays = itinerary.slice(1, itinerary.length - 1);
    for (const day of middleDays) {
      assert.ok(
        day.activities.some(
          (a) =>
            a.includes('No verified nearby places found') ||
            a.includes('place data'),
        ),
        `Expected missing-data message but got: ${JSON.stringify(day.activities)}`,
      );
    }
  });

  it('departure day goes back to origin, not to a hardcoded city', () => {
    const req = makeRequest('Bali', { origin: 'Mumbai' });
    const itinerary = buildItinerary(req, 'Bali', []);
    const lastDay = itinerary[itinerary.length - 1];
    assert.ok(
      lastDay.activities.some((a) => a.includes('Mumbai') && a.includes('Bali')),
      `Last day must include both origin and destination, got: ${JSON.stringify(lastDay.activities)}`,
    );
  });
});

describe('Bounding-box support in validators', () => {
  it('accepts and preserves a valid bounding box', () => {
    const req = validateTripRequest({
      origin: 'Bangalore',
      destination: 'Kerala',
      latitude: 10.85,
      longitude: 76.27,
      boundingBox: [8.07, 12.77, 74.85, 77.42],
      budget: 20_000,
      days: 3,
      travelers: 2,
      interests: ['Nature'],
      travelStyle: 'Budget',
    });
    assert.deepEqual(req.boundingBox, [8.07, 12.77, 74.85, 77.42]);
  });

  it('ignores an invalid bounding box gracefully', () => {
    const req = validateTripRequest({
      origin: 'Bangalore',
      destination: 'Paris',
      latitude: 48.86,
      longitude: 2.35,
      boundingBox: [NaN, 'bad', true, null], // invalid — must be ignored
      budget: 30_000,
      days: 4,
      travelers: 1,
      interests: ['History'],
      travelStyle: 'Budget',
    });
    assert.equal(req.boundingBox, undefined);
  });
});
