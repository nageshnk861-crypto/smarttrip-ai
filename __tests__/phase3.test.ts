import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateBudget } from '../lib/planner/budget-engine.js';
import { buildItinerary } from '../lib/planner/itinerary-engine.js';
import { planTrip } from '../lib/planner/planner.js';
import { validateTripRequest } from '../lib/planner/validators.js';

describe('Dynamic destination planning', () => {
  it('preserves each selected destination instead of ranking static candidates', () => {
    for (const destination of ['Kerala', 'Munnar', 'Goa', 'Jaipur', 'Bangalore']) {
      const request = validateTripRequest({
        origin: 'Bangalore',
        destination,
        latitude: 12.9,
        longitude: 77.6,
        budget: 15000,
        days: 3,
        travelers: 2,
        interests: ['Nature'],
        travelStyle: 'Budget',
      });

      assert.equal(planTrip(request).destination, destination);
    }
  });

  it('keeps deterministic budget calculations independent of destination names', () => {
    const request = validateTripRequest({
      origin: 'Bangalore',
      destination: 'Kerala',
      budget: 15000,
      days: 3,
      travelers: 2,
      interests: ['Nature', 'Food'],
      travelStyle: 'Budget',
    });

    const first = calculateBudget(request, 1);
    const second = calculateBudget(request, 1);
    assert.equal(first.total, second.total);
    assert.equal(first.remaining, second.remaining);
    assert.equal(first.daily.length, 3);
  });

  it('generates itinerary activities only from supplied verified places', () => {
    const request = validateTripRequest({
      origin: 'Bangalore',
      destination: 'Munnar',
      budget: 15000,
      days: 3,
      travelers: 2,
      interests: ['Nature'],
      travelStyle: 'Budget',
    });

    const itinerary = buildItinerary(request, 'Munnar', ['Verified Place A', 'Verified Place B']);
    assert.equal(itinerary.length, 3);
    assert.ok(itinerary[1].activities.includes('Visit Verified Place A'));
    assert.ok(!itinerary.flatMap((day) => day.activities).some((activity) => /Mysore|Coorg|Hampi|Goa|Jaipur/.test(activity)));
  });
});
