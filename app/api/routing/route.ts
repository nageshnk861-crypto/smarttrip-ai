import { NextRequest, NextResponse } from 'next/server';
import { MAPBOX_DIRECTIONS_BASE_URL } from '../../../lib/config';

/**
 * GET /api/routing
 * Multi-waypoint trip routing. Accepts up to 25 waypoints as
 * repeated `waypoint=lng,lat` params (in order) and returns
 * a structured summary: total distance (km), duration (min),
 * and the list of legs.
 *
 * Example: /api/routing?waypoint=77.5946,12.9716&waypoint=77.6408,12.9975
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const waypoints = searchParams.getAll('waypoint');
  const accessToken = process.env.MAPBOX_ACCESS_TOKEN;

  if (waypoints.length < 2) {
    return NextResponse.json(
      { error: 'At least two waypoint parameters are required (e.g. waypoint=lng,lat).' },
      { status: 400 },
    );
  }
  if (waypoints.length > 25) {
    return NextResponse.json({ error: 'A maximum of 25 waypoints is supported.' }, { status: 400 });
  }

  if (!accessToken) {
    return NextResponse.json(
      { error: 'Routing provider is not configured.', code: 'PROVIDER_NOT_CONFIGURED' },
      { status: 503 },
    );
  }

  try {
    const coordinates = waypoints.map(encodeURIComponent).join(';');
    const url = `${MAPBOX_DIRECTIONS_BASE_URL}/${coordinates}?access_token=${accessToken}&geometries=geojson&overview=simplified&steps=false`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Mapbox responded with ${response.status}`);

    const raw = await response.json() as {
      routes?: Array<{
        distance: number;
        duration: number;
        legs: Array<{ distance: number; duration: number; summary: string }>;
      }>;
    };

    const route = raw.routes?.[0];
    if (!route) {
      return NextResponse.json({ error: 'No route found between the supplied waypoints.' }, { status: 404 });
    }

    return NextResponse.json({
      distanceKm: Math.round(route.distance / 1000),
      durationMin: Math.round(route.duration / 60),
      legs: route.legs.map((leg) => ({
        distanceKm: Math.round(leg.distance / 1000),
        durationMin: Math.round(leg.duration / 60),
        summary: leg.summary,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Routing information is unavailable.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
