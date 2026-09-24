import { NextRequest, NextResponse } from 'next/server';
import { MAPBOX_DIRECTIONS_BASE_URL } from '../../../lib/config';

/**
 * GET /api/maps
 * Returns raw Mapbox driving directions between two coordinate strings.
 * Params: start=lng,lat  end=lng,lat
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  const accessToken = process.env.MAPBOX_ACCESS_TOKEN;

  if (!start || !end) {
    return NextResponse.json({ error: 'start and end coordinate parameters are required.' }, { status: 400 });
  }

  if (!accessToken) {
    return NextResponse.json(
      { error: 'Map provider is not configured.', code: 'PROVIDER_NOT_CONFIGURED' },
      { status: 503 },
    );
  }

  try {
    const url = `${MAPBOX_DIRECTIONS_BASE_URL}/${encodeURIComponent(start)};${encodeURIComponent(end)}?access_token=${accessToken}&geometries=geojson&overview=full`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Mapbox responded with ${response.status}`);
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Map route information is unavailable.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
