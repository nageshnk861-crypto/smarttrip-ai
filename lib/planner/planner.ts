import { calculateBudget } from './budget-engine';
import { discoverDestinations } from './destination-engine';
import { buildItinerary } from './itinerary-engine';
import { TripPlan, TripRequest } from './types';

export class NoFeasiblePlanError extends Error {
  readonly code = 'NO_FEASIBLE_PLAN' as const;
  readonly adjustments = [
    'Increase the budget',
    'Reduce the trip duration',
    'Reduce the number of travelers',
    'Choose a different destination',
    'Choose a lower-cost travel style',
  ];

  constructor() {
    super('No feasible trip was found within the current budget.');
    this.name = 'NoFeasiblePlanError';
  }
}

/**
 * Builds a deterministic TripPlan.
 *
 * CONTRACT: the destination in the returned plan ALWAYS equals
 * request.destination exactly as the user entered it.
 * No hardcoded city is ever substituted.
 */
export function planTrip(request: TripRequest): TripPlan {
  if (!request.destination?.trim()) {
    throw new Error('A selected destination is required.');
  }

  // The destination name is taken directly from the user's request.
  // discoverDestinations() wraps it but never replaces it.
  const discovered = discoverDestinations(request);
  if (discovered.length === 0) {
    throw new Error('A selected destination is required.');
  }

  const candidate = discovered[0];
  const destinationName = candidate.destination.name; // === request.destination.trim()
  const budget = calculateBudget(request, candidate.destination.costFactor);

  if (budget.total > request.budget) {
    throw new NoFeasiblePlanError();
  }

  return {
    destination: destinationName,
    budget,
    // Itinerary is built with an empty place list here;
    // travel-agent.ts injects verified nearby places after the Overpass lookup.
    days: buildItinerary(request, destinationName, []),
    candidates: [
      {
        name: destinationName,
        budgetTotal: candidate.budgetTotal,
        remainingBudget: candidate.remainingBudget,
        interestScore: candidate.interestScore,
        feasible: candidate.feasible,
      },
    ],
    nearbyPlaces: [],
    optimization: candidate.feasible
      ? `Selected ${destinationName} — budget calculation is deterministic.`
      : `The selected destination exceeds the current budget estimate.`,
    isDemo: false,
    source: 'selected-place with deterministic estimates',
  };
}
