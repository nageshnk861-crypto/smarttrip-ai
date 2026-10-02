/**
 * lib/agent/travel-agent.ts
 *
 * Main SmartTrip planning orchestrator.
 *
 * Pipeline:
 *   1. Deterministic planner  — budget guardrail, destination contract
 *   2. Research engine        — hotels, food, transport, places, weather
 *   3. Research budget engine — calculates from real provider data
 *   4. Itinerary builder      — uses verified dynamic places only
 *   5. Ollama AI              — narrative/explanation (non-fatal)
 *
 * CONTRACT: plan.destination === request.destination (never overridden).
 */

import { askOllama } from '../ollama';
import { planTrip } from '../planner/planner';
import { buildItinerary } from '../planner/itinerary-engine';
import { calculateResearchBudget } from '../planner/budget-engine';
import { NearbyPlace, TripPlan, TripRequest } from '../planner/types';
import { getPlacesProvider, NearbyOptions } from '../providers/places';
import { researchTrip } from '../research/travel-research';
import type { ResearchRequest } from '../research/types';
import { DEFAULT_CURRENCY } from '../config';

export type AgentToolResult = {
  tool:
    | 'searchPlaces'
    | 'searchHotels'
    | 'getWeather'
    | 'getDirections'
    | 'calculateBudget'
    | 'retrieveKnowledge'
    | 'researchTrip';
  status: 'completed' | 'skipped';
  source: 'places-provider' | 'deterministic-engine' | 'research-engine' | 'provider-not-configured';
  summary: string;
};

export type AgentTripPlan = TripPlan & {
  research?: import('../research/types').ResearchResult;
  researchBudget?: import('../research/types').ResearchBudget;
  agent: {
    steps: AgentToolResult[];
    retrievedKnowledge: [];
    explanation: string;
  };
};

export async function runTravelAgent(
  request: TripRequest,
  prompt = '',
): Promise<AgentTripPlan> {
  if (request.latitude === undefined || request.longitude === undefined) {
    throw new Error(
      'The selected destination must include valid coordinates. ' +
        'Please select a destination from the search results.',
    );
  }

  // ── 1. Deterministic planner ──────────────────────────────────────────────
  const plan = planTrip(request);
  // plan.destination === request.destination — guaranteed by planTrip contract

  // ── 2. Travel research engine ─────────────────────────────────────────────
  let research: import('../research/types').ResearchResult | undefined;
  let researchBudget: import('../research/types').ResearchBudget | undefined;
  let researchStatus: AgentToolResult['status'] = 'skipped';
  let researchSummary = 'Research engine not run.';

  try {
    const researchReq: ResearchRequest = {
      origin: request.origin,
      originLatitude: request.originLatitude,
      originLongitude: request.originLongitude,
      destination: plan.destination, // always == request.destination
      latitude: request.latitude,
      longitude: request.longitude,
      boundingBox: request.boundingBox,
      city: request.city,
      state: request.state,
      country: request.country,
      travelers: request.travelers,
      days: request.days,
      currency: DEFAULT_CURRENCY,
      interests: request.interests,
      preferences: {
        accommodation:
          request.travelStyle === 'Budget'
            ? 'budget'
            : request.travelStyle === 'Premium'
            ? 'premium'
            : 'standard',
        food:
          request.travelStyle === 'Budget'
            ? 'budget'
            : request.travelStyle === 'Premium'
            ? 'premium'
            : 'standard',
        transport: ['bus', 'train'],
        localTransport: ['auto', 'taxi'],
        activities:
          request.travelStyle === 'Budget'
            ? 'budget'
            : request.travelStyle === 'Premium'
            ? 'premium'
            : 'standard',
      },
    };

    research = await researchTrip(researchReq);
    researchBudget = calculateResearchBudget(request, research);

    researchStatus = 'completed';
    researchSummary =
      `Research complete. Live data: ${research.hasAnyLiveData ? 'yes' : 'no (estimates used)'}. ` +
      `Places: ${research.places.places.length}, Hotels: ${research.accommodation.results.length}, ` +
      `Transport options: ${research.intercityTransport.options.length}.`;
  } catch (err) {
    researchSummary = `Research engine failed: ${err instanceof Error ? err.message : String(err)}`;
    console.warn('[travel-agent] research engine failed — using config estimates:', researchSummary);
  }

  // ── 3. Dynamic nearby places ──────────────────────────────────────────────
  // Use research places if available, otherwise fall back to Overpass
  let verifiedPlaces: NearbyPlace[] = [];
  let placesStatus: AgentToolResult['status'] = 'skipped';
  let placesSummary = 'No verified nearby places found.';

  // Use places from research engine first
  if (research?.places.places.length) {
    verifiedPlaces = research.places.places.map((p) => ({
      place_id: p.placeId,
      name: p.name,
      category: p.category,
      latitude: p.latitude,
      longitude: p.longitude,
      distance: p.distanceKm,
      address: p.address,
      source: p.source.name,
    }));
    placesStatus = 'completed';
    placesSummary = `${verifiedPlaces.length} places from ${research.places.source.name}.`;
  } else {
    // Fall back to Overpass
    try {
      const provider = getPlacesProvider();
      const nearbyOptions: NearbyOptions = {
        interests: request.interests,
        boundingBox: request.boundingBox,
        osmType: request.osmType,
      };
      const raw = await provider.nearby(request.latitude, request.longitude, nearbyOptions);
      verifiedPlaces = raw
        .filter(
          (p): p is typeof p & {
            name: string; category: string; latitude: number; longitude: number;
          } =>
            Boolean(p.name && p.category && p.latitude !== undefined && p.longitude !== undefined),
        )
        .map((p) => ({
          place_id: p.place_id,
          name: p.name!,
          category: p.category!,
          latitude: p.latitude!,
          longitude: p.longitude!,
          distance: p.distance,
          address: p.address,
          source: p.source ?? 'OpenStreetMap',
        }));

      if (verifiedPlaces.length > 0) {
        placesStatus = 'completed';
        placesSummary = `${verifiedPlaces.length} places from OpenStreetMap/Overpass.`;
      } else {
        placesSummary = 'No places returned by provider.';
      }
    } catch (err) {
      placesSummary = `Places lookup failed: ${err instanceof Error ? err.message : 'unknown error'}`;
      console.warn('[travel-agent] Overpass places failed:', placesSummary);
    }
  }

  // ── 4. Build itinerary with verified places ───────────────────────────────
  const planWithPlaces: TripPlan = {
    ...plan,
    days: buildItinerary(request, plan.destination, verifiedPlaces.map((p) => p.name)),
    nearbyPlaces: verifiedPlaces,
  };

  // ── 5. AI narrative ───────────────────────────────────────────────────────
  let aiExplanation = '';
  try {
    aiExplanation = await askOllama(
      buildOllamaPrompt(request, plan, verifiedPlaces, research, researchBudget, prompt),
    );
  } catch (err) {
    console.warn('[travel-agent] Ollama unavailable:', err);
    const budget = researchBudget ?? null;
    const total = budget?.total ?? plan.budget.total;
    const remaining = budget?.remaining ?? plan.budget.remaining;
    const currency = budget?.currency ?? DEFAULT_CURRENCY;
    aiExplanation =
      remaining >= 0
        ? `Trip to ${plan.destination} is within budget. ` +
          `Estimated total: ${currency} ${total.toLocaleString()}, ` +
          `leaving ${currency} ${remaining.toLocaleString()} unspent.`
        : `The estimated cost of ${currency} ${total.toLocaleString()} ` +
          `exceeds your ${currency} ${request.budget.toLocaleString()} budget.`;
  }

  // ── 6. Agent step trace ───────────────────────────────────────────────────
  const steps: AgentToolResult[] = [
    {
      tool: 'researchTrip',
      status: researchStatus,
      source: 'research-engine',
      summary: researchSummary,
    },
    {
      tool: 'retrieveKnowledge',
      status: placesStatus,
      source: 'places-provider',
      summary: placesSummary,
    },
    {
      tool: 'searchHotels',
      status: research?.accommodation.available ? 'completed' : 'skipped',
      source: research?.accommodation.hasLiveData ? 'research-engine' : 'deterministic-engine',
      summary: research?.accommodation.available
        ? `${research.accommodation.results.length} hotels found near ${plan.destination}.`
        : 'Hotel data unavailable — using config-based estimate.',
    },
    {
      tool: 'getDirections',
      status: research?.intercityTransport.options.length ? 'completed' : 'skipped',
      source: 'research-engine',
      summary: research?.intercityTransport.options.length
        ? `${research.intercityTransport.options.length} transport options estimated.`
        : 'Transport estimate unavailable.',
    },
    {
      tool: 'getWeather',
      status: research?.weather.available ? 'completed' : 'skipped',
      source: research?.weather.available ? 'research-engine' : 'provider-not-configured',
      summary: research?.weather.available
        ? `Weather data retrieved for ${plan.destination}.`
        : 'Set WEATHER_API_KEY to enable live weather.',
    },
    {
      tool: 'calculateBudget',
      status: 'completed',
      source: researchBudget ? 'research-engine' : 'deterministic-engine',
      summary: researchBudget
        ? `Research budget: ${researchBudget.currency} ${researchBudget.total.toLocaleString()} ` +
          `(min ${researchBudget.minimum.toLocaleString()} – max ${researchBudget.maximum.toLocaleString()}).`
        : `Config budget: ${plan.budget.currency} ${plan.budget.total.toLocaleString()}.`,
    },
  ];

  return {
    ...planWithPlaces,
    research,
    researchBudget,
    agent: {
      steps,
      retrievedKnowledge: [],
      explanation: aiExplanation,
    },
  };
}

// ─── Ollama prompt builder ────────────────────────────────────────────────────

function buildOllamaPrompt(
  request: TripRequest,
  plan: TripPlan,
  verifiedPlaces: NearbyPlace[],
  research: import('../research/types').ResearchResult | undefined,
  researchBudget: import('../research/types').ResearchBudget | undefined,
  userPrompt: string,
): string {
  const currency = researchBudget?.currency ?? DEFAULT_CURRENCY;
  const total = researchBudget?.total ?? plan.budget.total;
  const remaining = researchBudget?.remaining ?? plan.budget.remaining;

  const budgetLines = researchBudget
    ? [
        `  Accommodation:    ${currency} ${researchBudget.accommodation.lineTotal.toLocaleString()} (${researchBudget.accommodation.isLiveData ? 'provider data' : 'estimated'})`,
        `  Food:             ${currency} ${researchBudget.food.lineTotal.toLocaleString()} (${researchBudget.food.isLiveData ? 'provider data' : 'estimated'})`,
        `  Transport:        ${currency} ${researchBudget.intercityTransport.lineTotal.toLocaleString()} (distance estimate)`,
        `  Local transport:  ${currency} ${researchBudget.localTransport.lineTotal.toLocaleString()} (estimate)`,
        `  Activities:       ${currency} ${researchBudget.activities.lineTotal.toLocaleString()} (estimate)`,
        `  Buffer:           ${currency} ${researchBudget.buffer.lineTotal.toLocaleString()}`,
        `  Known Provider Costs:  ${currency} ${researchBudget.knownCost.toLocaleString()}`,
        `  Estimated Costs:       ${currency} ${researchBudget.estimatedCost.toLocaleString()}`,
        `  TOTAL:                 ${currency} ${total.toLocaleString()}`,
        `  Remaining:             ${currency} ${remaining.toLocaleString()}`,
      ].join('\n')
    : `  TOTAL: ${currency} ${total.toLocaleString()} (config estimate)`;

  const unavailableNote = researchBudget?.unavailableCosts.length
    ? `Unavailable live prices: ${researchBudget.unavailableCosts.join('; ')}`
    : 'All components estimated from available data.';

  return `Create a concise travel recommendation.

User request: ${userPrompt || 'No prompt provided.'}

Trip:
- ${request.origin} → ${plan.destination}
- ${request.days} days, ${request.travelers} traveler(s)
- Budget: ${currency} ${request.budget.toLocaleString()}
- Style: ${request.travelStyle}
- Interests: ${request.interests.join(', ')}

Budget summary (DO NOT recalculate or invent any numbers):
${budgetLines}
${unavailableNote}

Weather: ${
    research?.weather.current
      ? `${research.weather.current.tempC}°C, ${research.weather.current.description}`
      : 'not available'
  }

STRICT ANTI-HALLUCINATION RULES:
1. NEVER invent or alter prices, costs, fees, or budget numbers.
2. NEVER invent hotel availability or live booking rates.
3. NEVER invent train or bus ticket fares — describe transit costs strictly as distance-based estimates.
4. NEVER claim an OpenStreetMap / Overpass attraction or restaurant has a specific menu price or entry fee unless explicitly stated in the research data.
5. NEVER change or substitute the destination (${plan.destination}) with another city (e.g., do not substitute Bangalore, Mysore, Coorg, or Kerala).
6. Use ONLY research data supplied by the application; explain the research rather than acting as a source of truth.
7. Give practical, specific travel tips for ${plan.destination} within ${request.days} days.
8. Keep response under 200 words.

Verified places (ONLY these may be mentioned):
${
  verifiedPlaces.length
    ? verifiedPlaces.slice(0, 15).map((p, i) => `${i + 1}. ${p.name} (${p.category})`).join('\n')
    : 'None — do not name any specific attractions.'
}

Return only the recommendation text.`;
}
