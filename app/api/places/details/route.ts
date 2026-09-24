import { NextRequest, NextResponse } from 'next/server';
import { getPlacesProvider } from '../../../../lib/providers/places';

export async function GET(request: NextRequest) {
  const placeId = request.nextUrl.searchParams.get('place_id');

  if (!placeId) {
    return NextResponse.json({ error: 'Place ID is required.' }, { status: 400 });
  }

  const provider = getPlacesProvider();
  try {
    const result = await provider.details(placeId);
    if (!result) return NextResponse.json({ error: 'Place not found.' }, { status: 404 });
    return NextResponse.json({
      result,
      isDemo: false,
      provider: provider.name,
    });
  } catch {
    return NextResponse.json({ error: 'Place details are temporarily unavailable.' }, { status: 502 });
  }
}
