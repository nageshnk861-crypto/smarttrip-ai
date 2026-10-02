import { calculateBudget } from './budget-engine';
import { TripRequest } from './types';

export type DestinationCandidate = {
  destination: {
    name: string;
    description: string;
    interests: string[];
    /**
     * Cost multiplier relative to a baseline destination.
     * Always 1 for user-selected places — the budget engine
     * is the sole source of truth for cost estimation.
     */
    costFactor: number;
  };
  interestScore: number;
  budgetTotal: number;
  remainingBudget: number;
  feasible: boolean;
  /** Origin of this candidate — always 'selected-place' now. */
  source: 'selected-place';
};

/**
 * Returns exactly ONE candidate: the destination the user explicitly selected.
 * There is NO fallback to any hardcoded city (Mysore, Coorg, Goa, etc.).
 * If no destination was provided the caller is responsible for throwing.
 */
export function discoverDestinations(request: TripRequest): DestinationCandidate[] {
  if (!request.destination) return [];

  const destination = {
    name: request.destination.trim(),
    description: 'Selected from the live place provider.',
    interests: request.interests,
    costFactor: 1,
  };

  const budget = calculateBudget(request, destination.costFactor);

  return [
    {
      destination,
      interestScore: request.interests.length,
      budgetTotal: budget.total,
      remainingBudget: budget.remaining,
      feasible: budget.total <= request.budget,
      source: 'selected-place',
    },
  ];
}
