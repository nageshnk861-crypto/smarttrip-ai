import { NextRequest, NextResponse } from 'next/server';
import { runTravelAgent } from '../../../lib/agent/travel-agent';
import type { PlanTripRequestBody, PlanTripSuccessResponse } from '../../../lib/api/types';
import { NoFeasiblePlanError } from '../../../lib/planner/planner';
import { parseTripPrompt, validateTripRequest } from '../../../lib/planner/validators';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PlanTripRequestBody;
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';

    // When a raw prompt is present, parse it first then let explicit body fields override.
    const requestData: Record<string, unknown> = prompt
      ? { ...parseTripPrompt(prompt), ...body }
      : { ...body };

    const tripRequest = validateTripRequest(requestData);
    const plan = await runTravelAgent(tripRequest, prompt);

    const response: PlanTripSuccessResponse = {
      data: {
        destination: plan.destination,
        coordinates:
          tripRequest.latitude !== undefined && tripRequest.longitude !== undefined
            ? { latitude: tripRequest.latitude, longitude: tripRequest.longitude }
            : undefined,
        city: tripRequest.city,
        state: tripRequest.state,
        country: tripRequest.country,
        totalCost: plan.budget.total,
        budget: tripRequest.budget,
        remaining: plan.budget.remaining,
        budgetUsagePercentage: Math.round(
          (plan.budget.total / tripRequest.budget) * 100,
        ),
        currency: plan.budget.currency,
        transport: plan.budget.transport,
        accommodation: plan.budget.accommodation,
        food: plan.budget.food,
        activities: plan.budget.activities,
        localTransport: plan.budget.localTransport,
        buffer: plan.budget.buffer,
        dailyBudget: plan.budget.daily,
        days: plan.days,
        candidates: plan.candidates,
        nearbyPlaces: plan.nearbyPlaces,
        optimization: plan.optimization,
        isDemo: plan.isDemo,
        source: plan.source,
        agent: plan.agent,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof NoFeasiblePlanError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          adjustments: error.adjustments,
        },
        { status: 422 },
      );
    }

    const message =
      error instanceof Error ? error.message : 'Unable to create a trip plan.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
