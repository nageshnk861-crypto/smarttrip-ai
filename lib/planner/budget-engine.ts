/**
 * lib/planner/budget-engine.ts
 *
 * Deterministic budget calculation engine.
 *
 * Two modes:
 *  1. Research-driven: uses real provider data from ResearchResult.
 *     Every line item is labelled with provenance (source, sourceType).
 *  2. Config-driven fallback: uses environment-variable base rates when
 *     no provider data is available. Clearly labelled as "estimated".
 *
 * The AI (Ollama) NEVER performs the arithmetic. It only explains the result.
 */

import {
  BUDGET_BASE_TRANSPORT,
  BUDGET_BASE_ACCOMMODATION,
  BUDGET_BASE_FOOD,
  BUDGET_BASE_ACTIVITIES,
  BUDGET_BASE_LOCAL_TRANSPORT,
  BUDGET_BUFFER_RATE,
  BUDGET_STYLE_MULTIPLIERS,
  DEFAULT_CURRENCY,
} from '../config';
import type { BudgetBreakdown, DailyBudget, TripRequest } from './types';
import type { CostItem, ResearchBudget, ResearchResult } from '../research/types';

// ─── Legacy budget engine (config-driven) ────────────────────────────────────
// Kept for backward compatibility with existing planner flow and tests.

export function calculateBudget(
  request: TripRequest,
  destinationCostFactor = 1,
): BudgetBreakdown {
  const multiplier = BUDGET_STYLE_MULTIPLIERS[request.travelStyle];
  const groupFactor = Math.max(1, request.travelers / 2);

  const transport = Math.round(
    BUDGET_BASE_TRANSPORT * multiplier * groupFactor * destinationCostFactor,
  );
  const accommodation = Math.round(
    BUDGET_BASE_ACCOMMODATION * request.days * multiplier * groupFactor * destinationCostFactor,
  );
  const food = Math.round(
    BUDGET_BASE_FOOD * request.days * request.travelers * multiplier * destinationCostFactor,
  );
  const activities = Math.round(
    BUDGET_BASE_ACTIVITIES * request.days * request.travelers * multiplier * destinationCostFactor,
  );
  const localTransport = Math.round(
    BUDGET_BASE_LOCAL_TRANSPORT * request.days * request.travelers * multiplier * destinationCostFactor,
  );

  const subtotal = transport + accommodation + food + activities + localTransport;
  const buffer = Math.round(subtotal * BUDGET_BUFFER_RATE);
  const total = subtotal + buffer;

  const daily: DailyBudget[] = Array.from({ length: request.days }, (_, index) => {
    const day = index + 1;
    const travelDays = request.days === 1 ? 1 : 2;
    const dayTransport =
      day === 1 || day === request.days
        ? Math.round(transport / Math.max(1, travelDays))
        : 0;
    const dayAccommodation = Math.round(accommodation / request.days);
    const dayFood = Math.round(food / request.days);
    const dayLocalTransport = Math.round(localTransport / request.days);
    const dayActivities = Math.round(activities / request.days);
    const dayBuffer = Math.round(buffer / request.days);

    return {
      day,
      transport: dayTransport,
      accommodation: dayAccommodation,
      food: dayFood,
      localTransport: dayLocalTransport,
      activities: dayActivities,
      buffer: dayBuffer,
      total:
        dayTransport + dayAccommodation + dayFood + dayLocalTransport + dayActivities + dayBuffer,
    };
  });

  // Absorb rounding difference in the last day.
  const diff = total - daily.reduce((s, d) => s + d.total, 0);
  if (daily.length > 0) {
    daily[daily.length - 1].total += diff;
    daily[daily.length - 1].buffer += diff;
  }

  return {
    transport,
    accommodation,
    food,
    activities,
    localTransport,
    buffer,
    total,
    remaining: request.budget - total,
    currency: DEFAULT_CURRENCY,
    daily,
  };
}

// ─── Research-driven budget engine ───────────────────────────────────────────

/**
 * Builds a ResearchBudget from live/estimated provider data.
 *
 * Formula:
 *   accommodation  = priceRange.mid × rooms × nights
 *   food           = dailyCostPerPerson.mid × travelers × days
 *   intercity      = selected transport option midpoint × travelers
 *   localTransport = dailyEstimatePerPerson.mid × travelers × days
 *   activities     = config-based per-person per-day (no live data yet)
 *   buffer         = subtotal × BUDGET_BUFFER_RATE
 *   total          = subtotal + buffer
 */
export function calculateResearchBudget(
  request: TripRequest,
  research: ResearchResult,
): ResearchBudget {
  const currency = research.request.currency ?? DEFAULT_CURRENCY;
  const now = new Date().toISOString();
  const configSource = {
    name: `Config estimate (BUDGET_BASE_* env vars) — not a live price`,
    sourceType: 'estimated' as const,
    retrievedAt: now,
  };

  // ── Accommodation ──────────────────────────────────────────────────────────
  const accRange = research.accommodation.priceRange;
  const accHasData = research.accommodation.hasLiveData && accRange.max > 0;
  const accMid = accHasData
    ? Math.round((accRange.min + accRange.max) / 2)
    : Math.round(
        BUDGET_BASE_ACCOMMODATION *
          BUDGET_STYLE_MULTIPLIERS[request.travelStyle] *
          Math.max(1, request.travelers / 2),
      );
  const accTotal = accMid * request.days;
  const accItem: CostItem = {
    id: 'accommodation',
    category: 'accommodation',
    name: `${request.travelStyle} accommodation`,
    description: accHasData
      ? `${research.accommodation.tier} hotels near ${request.destination}`
      : `Config-based estimate — no live hotel data`,
    priceRange: accHasData
      ? { min: accRange.min * request.days, max: accRange.max * request.days, currency }
      : { min: accTotal, max: accTotal, currency },
    selectedAmount: accMid,
    unit: 'per_night',
    quantity: request.days,
    lineTotal: accTotal,
    source: accHasData ? research.accommodation.source : configSource,
    isLiveData: accHasData,
  };

  // ── Food ───────────────────────────────────────────────────────────────────
  const foodRange = research.food.dailyCostPerPerson;
  const foodHasData = research.food.hasLiveData && foodRange.max > 0;
  const foodMidPerPersonPerDay = foodHasData
    ? Math.round((foodRange.min + foodRange.max) / 2)
    : Math.round(BUDGET_BASE_FOOD * BUDGET_STYLE_MULTIPLIERS[request.travelStyle]);
  const foodTotal = foodMidPerPersonPerDay * request.travelers * request.days;
  const foodItem: CostItem = {
    id: 'food',
    category: 'food',
    name: `${request.travelStyle} food`,
    description: foodHasData
      ? `Restaurant data near ${request.destination}`
      : `Config-based estimate — no live restaurant data`,
    priceRange: {
      min: foodHasData
        ? foodRange.min * request.travelers * request.days
        : foodTotal,
      max: foodHasData
        ? foodRange.max * request.travelers * request.days
        : foodTotal,
      currency,
    },
    selectedAmount: foodMidPerPersonPerDay,
    unit: 'per_person',
    quantity: request.travelers * request.days,
    lineTotal: foodTotal,
    source: foodHasData ? research.food.source : configSource,
    isLiveData: foodHasData,
  };

  // ── Intercity transport ────────────────────────────────────────────────────
  const transportOptions = research.intercityTransport.options;
  const selectedTransport =
    research.intercityTransport.cheapestOption ?? transportOptions[0];
  const transHasData = !!selectedTransport;
  const transMid = transHasData
    ? Math.round(
        (selectedTransport.priceRange.min + selectedTransport.priceRange.max) / 2,
      )
    : Math.round(
        BUDGET_BASE_TRANSPORT *
          BUDGET_STYLE_MULTIPLIERS[request.travelStyle] *
          Math.max(1, request.travelers / 2),
      );
  const transTotal = transMid * request.travelers;
  const transItem: CostItem = {
    id: 'intercity_transport',
    category: 'transport',
    name: transHasData
      ? `${selectedTransport.mode} — ${request.origin} → ${request.destination}`
      : `Transport estimate`,
    description: transHasData
      ? `${selectedTransport.source.name}`
      : `Config-based estimate — no live transport data`,
    priceRange: transHasData
      ? {
          min: selectedTransport.priceRange.min * request.travelers,
          max: selectedTransport.priceRange.max * request.travelers,
          currency,
        }
      : { min: transTotal, max: transTotal, currency },
    selectedAmount: transMid,
    unit: 'per_person',
    quantity: request.travelers,
    lineTotal: transTotal,
    source: transHasData ? selectedTransport.source : configSource,
    isLiveData: false, // transport is always estimated (no live booking)
  };

  // ── Local transport ────────────────────────────────────────────────────────
  const localRange = research.localTransport.dailyEstimatePerPerson;
  const localMid = localRange.max > 0
    ? Math.round((localRange.min + localRange.max) / 2)
    : Math.round(BUDGET_BASE_LOCAL_TRANSPORT * BUDGET_STYLE_MULTIPLIERS[request.travelStyle]);
  const localTotal = localMid * request.travelers * request.days;
  const localItem: CostItem = {
    id: 'local_transport',
    category: 'local_transport',
    name: 'Local transport',
    description: `Estimated daily local transport per person in ${request.destination}`,
    priceRange: {
      min: localRange.min * request.travelers * request.days,
      max: localRange.max * request.travelers * request.days,
      currency,
    },
    selectedAmount: localMid,
    unit: 'per_person',
    quantity: request.travelers * request.days,
    lineTotal: localTotal,
    source: research.localTransport.source,
    isLiveData: false,
  };

  // ── Activities ─────────────────────────────────────────────────────────────
  const actMid = Math.round(
    BUDGET_BASE_ACTIVITIES * BUDGET_STYLE_MULTIPLIERS[request.travelStyle],
  );
  const actTotal = actMid * request.travelers * request.days;
  const actItem: CostItem = {
    id: 'activities',
    category: 'activity',
    name: 'Activities & entry fees',
    description: `Config-based estimate — real entry fees shown in places section`,
    priceRange: { min: actTotal, max: actTotal, currency },
    selectedAmount: actMid,
    unit: 'per_person',
    quantity: request.travelers * request.days,
    lineTotal: actTotal,
    source: configSource,
    isLiveData: false,
  };

  // ── Subtotal & buffer ──────────────────────────────────────────────────────
  const subtotal = accTotal + foodTotal + transTotal + localTotal + actTotal;
  const bufferAmount = Math.round(subtotal * BUDGET_BUFFER_RATE);
  const bufferItem: CostItem = {
    id: 'buffer',
    category: 'buffer',
    name: `Contingency buffer (${Math.round(BUDGET_BUFFER_RATE * 100)}%)`,
    description: `${Math.round(BUDGET_BUFFER_RATE * 100)}% of subtotal as safety buffer`,
    priceRange: { min: bufferAmount, max: bufferAmount, currency },
    selectedAmount: bufferAmount,
    unit: 'flat',
    quantity: 1,
    lineTotal: bufferAmount,
    source: { name: 'Deterministic calculation', sourceType: 'estimated', retrievedAt: now },
    isLiveData: false,
  };

  const total = subtotal + bufferAmount;

  // ── Min / max across all ranges ────────────────────────────────────────────
  const minItems = [
    accItem.priceRange.min,
    foodItem.priceRange.min,
    transItem.priceRange.min,
    localItem.priceRange.min,
    actItem.priceRange.min,
  ];
  const maxItems = [
    accItem.priceRange.max,
    foodItem.priceRange.max,
    transItem.priceRange.max,
    localItem.priceRange.max,
    actItem.priceRange.max,
  ];
  const minimum = minItems.reduce((s, v) => s + v, 0) + bufferAmount;
  const maximum = maxItems.reduce((s, v) => s + v, 0) + bufferAmount;

  return {
    accommodation: accItem,
    food: foodItem,
    intercityTransport: transItem,
    localTransport: localItem,
    activities: actItem,
    subtotal,
    buffer: bufferItem,
    total,
    perPerson: request.travelers > 0 ? Math.round(total / request.travelers) : total,
    perDay: request.days > 0 ? Math.round(total / request.days) : total,
    perPersonPerDay:
      request.travelers > 0 && request.days > 0
        ? Math.round(total / request.travelers / request.days)
        : total,
    currency,
    minimum,
    maximum,
    remaining: request.budget - total,
    breakdown:
      `Accommodation: ${currency} ${accTotal.toLocaleString()} ` +
      `(${request.days} night${request.days > 1 ? 's' : ''} × ${currency} ${accMid.toLocaleString()}) | ` +
      `Food: ${currency} ${foodTotal.toLocaleString()} ` +
      `(${request.travelers} traveler${request.travelers > 1 ? 's' : ''} × ${request.days} days × ${currency} ${foodMidPerPersonPerDay.toLocaleString()}/person/day) | ` +
      `Transport: ${currency} ${transTotal.toLocaleString()} | ` +
      `Local transport: ${currency} ${localTotal.toLocaleString()} | ` +
      `Activities: ${currency} ${actTotal.toLocaleString()} | ` +
      `Buffer (${Math.round(BUDGET_BUFFER_RATE * 100)}%): ${currency} ${bufferAmount.toLocaleString()}`,
  };
}
