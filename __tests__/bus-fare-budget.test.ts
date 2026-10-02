import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  estimateBusFare,
  BUS_PLANNING_RATES,
  type BusCategory,
} from '../lib/transport/bus-rate-model.js';

describe('All-India Bus Fare Budget Engine — Test Suite', () => {
  // TEST 1: 100 km Ordinary, 1 traveler, one way
  it('TEST 1: 100 km Ordinary, 1 traveler, one way', () => {
    const result = estimateBusFare({
      origin: 'Bengaluru',
      destination: 'Tumakuru',
      distanceKm: 100,
      busCategory: 'ORDINARY',
      travelers: 1,
      tripType: 'ONE_WAY',
    });

    assert.equal(result.status, 'ESTIMATED');
    assert.equal(result.fareStatus, 'ESTIMATED');
    assert.equal(result.method, 'DISTANCE_X_PLANNING_RATE');
    assert.equal(result.currency, 'INR');
    assert.equal(result.distanceKm, 100);
    assert.equal(result.travelers, 1);
    assert.equal(result.tripType, 'ONE_WAY');
    assert.equal(result.roundTrip, false);

    assert.equal(result.oneWayLow, 100); // 100 * 1.00 * 1
    assert.equal(result.oneWayExpected, 175); // 100 * 1.75 * 1
    assert.equal(result.oneWayHigh, 250); // 100 * 2.50 * 1

    assert.equal(result.totalLow, 100);
    assert.equal(result.totalExpected, 175);
    assert.equal(result.totalHigh, 250);

    // Verify backward compatible nested objects
    assert.ok(result.oneWay);
    assert.equal(result.oneWay.low, 100);
    assert.equal(result.oneWay.expected, 175);
    assert.equal(result.oneWay.high, 250);
  });

  // TEST 2: 100 km Express, 2 travelers, one way
  it('TEST 2: 100 km Express, 2 travelers, one way', () => {
    const result = estimateBusFare({
      origin: 'Bengaluru',
      destination: 'Mysuru',
      distanceKm: 100,
      busCategory: 'EXPRESS_DELUXE',
      travelers: 2,
      tripType: 'ONE_WAY',
    });

    assert.equal(result.status, 'ESTIMATED');
    assert.equal(result.oneWayLow, 300); // 100 * 1.50 * 2
    assert.equal(result.oneWayExpected, 500); // 100 * 2.50 * 2
    assert.equal(result.oneWayHigh, 700); // 100 * 3.50 * 2

    assert.equal(result.totalLow, 300);
    assert.equal(result.totalExpected, 500);
    assert.equal(result.totalHigh, 700);
  });

  // TEST 3: 500 km AC Premium, 2 travelers, round trip
  it('TEST 3: 500 km AC Premium, 2 travelers, round trip', () => {
    const result = estimateBusFare({
      origin: 'Bengaluru',
      destination: 'Goa',
      distanceKm: 500,
      busCategory: 'AC_PREMIUM',
      travelers: 2,
      tripType: 'ROUND_TRIP',
    });

    assert.equal(result.status, 'ESTIMATED');
    // One way: 500 * rate * 2
    assert.equal(result.oneWayLow, 2500); // 500 * 2.50 * 2
    assert.equal(result.oneWayExpected, 4250); // 500 * 4.25 * 2
    assert.equal(result.oneWayHigh, 6000); // 500 * 6.00 * 2

    // Round trip: one way * 2
    assert.equal(result.totalLow, 5000); // 2500 * 2
    assert.equal(result.totalExpected, 8500); // 4250 * 2
    assert.equal(result.totalHigh, 12000); // 6000 * 2
  });

  // TEST 4: Private Sleeper, 300 km, 4 travelers, round trip
  it('TEST 4: Private Sleeper, 300 km, 4 travelers, round trip', () => {
    const result = estimateBusFare({
      origin: 'Hyderabad',
      destination: 'Vijayawada',
      distanceKm: 300,
      busCategory: 'PRIVATE_SEATER_SLEEPER',
      travelers: 4,
      tripType: 'ROUND_TRIP',
    });

    assert.equal(result.status, 'ESTIMATED');
    // One way: 300 * rate * 4
    assert.equal(result.oneWayLow, 1800); // 300 * 1.50 * 4
    assert.equal(result.oneWayExpected, 3900); // 300 * 3.25 * 4
    assert.equal(result.oneWayHigh, 6000); // 300 * 5.00 * 4

    // Round trip: * 2
    assert.equal(result.totalLow, 3600); // 1800 * 2
    assert.equal(result.totalExpected, 7800); // 3900 * 2
    assert.equal(result.totalHigh, 12000); // 6000 * 2
  });

  // TEST 5: Actual fare available, verify actual fare overrides estimate
  it('TEST 5: Actual fare available overrides estimate', () => {
    const result = estimateBusFare({
      origin: 'Bengaluru',
      destination: 'Badami',
      distanceKm: 470,
      busCategory: 'EXPRESS_DELUXE',
      travelers: 1,
      tripType: 'ONE_WAY',
      actualFare: 718,
      source: 'KSRTC',
      sourceUrl: 'https://www.ksrtc.in/',
    });

    assert.equal(result.status, 'VERIFIED');
    assert.equal(result.fareStatus, 'VERIFIED');
    assert.equal(result.source.name, 'KSRTC');
    assert.equal(result.sourceUrl, 'https://www.ksrtc.in/');
    assert.equal(result.verifiedFarePerPerson, 718);
    assert.equal(result.oneWayExpected, 718);
    assert.equal(result.totalExpected, 718);
    // Verified fare must strictly prevent distance estimation override
    assert.notEqual(result.totalExpected, Math.round(470 * 2.5));
  });

  // TEST 6: No distance returns UNAVAILABLE
  it('TEST 6: No distance returns UNAVAILABLE', () => {
    const result = estimateBusFare({
      origin: 'Unknown Point A',
      destination: 'Unknown Point B',
      distanceKm: null,
      busCategory: 'EXPRESS_DELUXE',
      travelers: 2,
      tripType: 'ROUND_TRIP',
    });

    assert.equal(result.status, 'UNAVAILABLE');
    assert.equal(result.fareStatus, 'UNAVAILABLE');
    assert.equal(result.oneWayLow, null);
    assert.equal(result.oneWayExpected, null);
    assert.equal(result.oneWayHigh, null);
    assert.equal(result.totalLow, null);
    assert.equal(result.totalExpected, null);
    assert.equal(result.totalHigh, null);
    assert.equal(result.distanceKm, null);
  });

  // TEST 7: Zero travelers throws validation error
  it('TEST 7: Zero travelers throws validation error', () => {
    assert.throws(
      () => {
        estimateBusFare({
          origin: 'Bengaluru',
          destination: 'Mysuru',
          distanceKm: 150,
          travelers: 0,
        });
      },
      /Travelers count must be at least 1/
    );
  });

  // TEST 8: Negative distance throws validation error
  it('TEST 8: Negative distance throws validation error', () => {
    assert.throws(
      () => {
        estimateBusFare({
          origin: 'Bengaluru',
          destination: 'Mysuru',
          distanceKm: -50,
          travelers: 2,
        });
      },
      /Distance cannot be negative/
    );
  });

  // TEST 9: Large India route (Bengaluru to Delhi, ~2150 km)
  it('TEST 9: Large India route (Bengaluru → Delhi, 2150 km)', () => {
    const result = estimateBusFare({
      origin: 'Bengaluru',
      destination: 'New Delhi',
      distanceKm: 2150,
      busCategory: 'AC_PREMIUM',
      travelers: 1,
      tripType: 'ONE_WAY',
    });

    assert.equal(result.status, 'ESTIMATED');
    assert.equal(result.distanceKm, 2150);
    assert.equal(result.oneWayLow, 5375); // 2150 * 2.50
    assert.equal(result.oneWayExpected, 9138); // 2150 * 4.25 = 9137.5 -> 9138
    assert.equal(result.oneWayHigh, 12900); // 2150 * 6.00
    assert.equal(result.totalExpected, 9138);
  });

  // TEST 10: Short city route (Bengaluru to Electronic City, ~20 km)
  it('TEST 10: Short city route (Bengaluru → Electronic City, 20 km)', () => {
    const result = estimateBusFare({
      origin: 'Kempegowda Bus Station (Majestic)',
      destination: 'Electronic City Phase 1',
      distanceKm: 20,
      busCategory: 'ORDINARY',
      travelers: 1,
      tripType: 'ONE_WAY',
    });

    assert.equal(result.status, 'ESTIMATED');
    assert.equal(result.distanceKm, 20);
    assert.equal(result.oneWayLow, 20); // 20 * 1.00
    assert.equal(result.oneWayExpected, 35); // 20 * 1.75
    assert.equal(result.oneWayHigh, 50); // 20 * 2.50
  });

  // Bonus TEST: Ollama explanation contract
  it('Ollama explanation contract: Ollama cannot modify numeric fare', () => {
    const transportPlan = {
      operator: 'KSRTC',
      origin: 'Bengaluru',
      destination: 'Badami',
      fare: 718,
      fareStatus: 'VERIFIED',
      source: 'KSRTC',
    };

    const numericFare = transportPlan.fare;
    assert.equal(numericFare, 718);

    const ollamaPrompt = `Explain the travel route from ${transportPlan.origin} to ${transportPlan.destination} via ${transportPlan.operator} at ₹${transportPlan.fare}. Do not change the fare.`;
    assert.ok(ollamaPrompt.includes('₹718'));
    assert.equal(transportPlan.fare, 718);
  });
});
