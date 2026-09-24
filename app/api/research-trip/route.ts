/**
 * POST /api/research-trip
 *
 * Runs the full travel research engine for a destination.
 * Returns normalized research data with full provenance.
 * Never returns hardcoded prices — all data comes from live providers
 * or is clearly labelled as estimated.
 */

import { NextRequest, NextResponse } from 'next/server';
import { researchTrip } from '../../../lib/research/travel-research';
import type { ResearchRequest } from '../../../lib/research/types';
import { DEFAULT_CURRENCY } from '../../../lib/config';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<ResearchRequest>;

    if (!body.destination || !body.origin) {
      return NextResponse.json(
        { error: 'origin and destination are required.' },
        { status: 400 },
      );
    }
    if (
      body.latitude === undefined ||
      body.longitude === undefined ||
      !Number.isFinite(body.latitude) ||
      !Number.isFinite(body.longitude)
    ) {
      return NextResponse.json(
        { error: 'Valid destination latitude and longitude are required.' },
        { status: 400 },
      );
    }

    const request: ResearchRequest = {
      origin: String(body.origin).trim(),
      originLatitude: typeof body.originLatitude === 'number' ? body.originLatitude : undefined,
      originLongitude: typeof body.originLongitude === 'number' ? body.originLongitude : undefined,
      destination: String(body.destination).trim(),
      latitude: body.latitude,
      longitude: body.longitude,
      boundingBox: body.boundingBox,
      city: body.city,
      state: body.state,
      country: body.country,
      travelers: Math.max(1, Number(body.travelers) || 2),
      days: Math.max(1, Number(body.days) || 3),
      startDate: body.startDate,
      currency: body.currency ?? DEFAULT_CURRENCY,
      interests: Array.isArray(body.interests) ? body.interests : [],
      preferences: {
        accommodation: body.preferences?.accommodation ?? 'standard',
        food: body.preferences?.food ?? 'standard',
        transport: body.preferences?.transport ?? ['bus', 'train'],
        localTransport: body.preferences?.localTransport ?? ['auto', 'taxi'],
        activities: body.preferences?.activities ?? 'standard',
      },
    };

    const result = await researchTrip(request);

    return NextResponse.json({ data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Research failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
