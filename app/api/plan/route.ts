/**
 * POST /api/plan
 *
 * Lightweight, deterministic trip planner — runs the budget engine and itinerary
 * builder directly WITHOUT the full agent pipeline (no Ollama AI, no live research,
 * no Overpass/OSM provider calls). Useful for headless / programmatic access where
 * instant, reproducible budget breakdowns are needed.
 *
 * For the full AI-powered plan (research + places + Ollama) use POST /api/plan-trip.
 */
import { NextRequest, NextResponse } from 'next/server';
import { NoFeasiblePlanError, planTrip } from '../../../lib/planner/planner';
import { validateTripRequest } from '../../../lib/planner/validators';

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    const tripRequest = validateTripRequest(body);
    const plan = planTrip(tripRequest);
    return NextResponse.json({
      data: {
        destination: plan.destination,
        totalCost: plan.budget.total,
        budget: tripRequest.budget,
        remaining: plan.budget.remaining,
        budgetUsagePercentage: Math.round((plan.budget.total / tripRequest.budget) * 100),
        currency: plan.budget.currency,
        transport: plan.budget.transport,
        accommodation: plan.budget.accommodation,
        food: plan.budget.food,
        activities: plan.budget.activities,
        localTransport: plan.budget.localTransport,
        buffer: plan.budget.buffer,
        dailyBudget: plan.budget.daily,
        days: plan.days,
        isDemo: plan.isDemo,
        source: plan.source,
      },
    });
  } catch (error) {
    if (error instanceof NoFeasiblePlanError) {
      return NextResponse.json({
        error: error.message,
        code: error.code,
        adjustments: error.adjustments,
      }, { status: 422 });
    }

    const message = error instanceof Error ? error.message : 'Unable to create a trip plan.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
