import { NextRequest, NextResponse } from 'next/server';
import { estimateBusFare, BusCategory, TripType } from '@/lib/transport/bus-rate-model';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { origin, destination, distanceKm, travelers = 1, tripType = 'ROUND_TRIP', busCategory = 'EXPRESS_DELUXE', actualFare, fareStatus, source, sourceUrl } = body;

    if (!origin || typeof origin !== 'string' || !origin.trim()) {
      return NextResponse.json({ error: 'Origin is required' }, { status: 400 });
    }
    if (!destination || typeof destination !== 'string' || !destination.trim()) {
      return NextResponse.json({ error: 'Destination is required' }, { status: 400 });
    }

    const numTravelers = Number(travelers);
    if (isNaN(numTravelers) || numTravelers < 1) {
      return NextResponse.json({ error: 'Travelers must be at least 1' }, { status: 400 });
    }

    const estimate = estimateBusFare({
      origin,
      destination,
      distanceKm: typeof distanceKm === 'number' ? distanceKm : null,
      busCategory: busCategory as BusCategory,
      travelers: numTravelers,
      tripType: tripType as TripType,
      actualFare,
      fareStatus,
      source,
      sourceUrl,
      distanceSource: typeof distanceKm === 'number' ? 'OpenRouteService' : 'None',
    });

    return NextResponse.json(estimate);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error calculating bus fare' }, { status: 400 });
  }
}
