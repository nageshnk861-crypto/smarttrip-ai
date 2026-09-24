/**
 * GET /api/places/autocomplete
 *
 * Place autocomplete using the active places provider (Nominatim/OSM by default).
 * Returns a Google Places API-compatible response shape ({ predictions }) so that
 * clients expecting the Google Places Autocomplete contract can be used unchanged.
 *
 * For SmartTrip's own autocomplete (returns { data }), use GET /api/destinations.
 *
 * Query params:
 *   input  string  The partial search text (minimum 2 characters)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getPlacesProvider } from '../../../../lib/providers/places';

export async function GET(request: NextRequest) {
  const input = request.nextUrl.searchParams.get('input');

  if (!input || input.trim().length < 2) {
    return NextResponse.json({ predictions: [] });
  }

  const provider = getPlacesProvider();
  try {
    const predictions = await provider.autocomplete(input);
    return NextResponse.json({
      predictions,
      isDemo: false,
      provider: provider.name,
    });
  } catch {
    return NextResponse.json({
      predictions: [],
      isDemo: false,
      error: 'Place search is temporarily unavailable.',
    }, { status: 502 });
  }
}
