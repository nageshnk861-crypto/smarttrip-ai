import { NextRequest, NextResponse } from 'next/server';
import { getPlacesProvider } from '../../../../lib/providers/places';
import type { BoundingBox } from '../../../../lib/planner/types';

/**
 * GET /api/places/nearby
 *
 * Dynamically retrieves tourist places around the supplied coordinates.
 * Supports both point+radius (cities) and bounding-box (regions/countries).
 *
 * Query params:
 *   lat          required  decimal latitude of destination centre
 *   lng          required  decimal longitude of destination centre
 *   radius       optional  radius in metres for city search (default 5000)
 *   interests    optional  comma-separated interest list (e.g. Nature,History)
 *   bbox         optional  [south,north,west,east] as comma-separated string
 *                          — when provided, area search is used for regions
 *   osmType      optional  osm type hint ('node'|'way'|'relation')
 *
 * Returns: { places, count, provider, coordinates, isDemo }
 * NEVER returns hardcoded places.
 * On provider failure returns empty array + warning (not 502).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const lat = Number(searchParams.get('lat'));
  const lng = Number(searchParams.get('lng'));

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    (lat === 0 && lng === 0)
  ) {
    return NextResponse.json(
      { error: 'Valid lat and lng parameters are required.' },
      { status: 400 },
    );
  }

  const radius = Number(searchParams.get('radius') ?? '5000');
  const interestsParam = searchParams.get('interests') ?? '';
  const interests = interestsParam
    ? interestsParam.split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  const bboxParam = searchParams.get('bbox');
  const osmType = searchParams.get('osmType') ?? undefined;

  let boundingBox: BoundingBox | undefined;
  if (bboxParam) {
    const parts = bboxParam.split(',').map(Number);
    if (parts.length === 4 && parts.every(Number.isFinite)) {
      boundingBox = parts as BoundingBox;
    }
  }

  const provider = getPlacesProvider();

  try {
    const raw = await provider.nearby(lat, lng, {
      radius,
      interests,
      boundingBox,
      osmType,
    });

    return NextResponse.json({
      places: raw,
      count: raw.length,
      provider: provider.name,
      coordinates: { lat, lng },
      radiusMetres: radius,
      hasBoundingBox: !!boundingBox,
      isDemo: false,
    });
  } catch (err) {
    const warning = err instanceof Error ? err.message : 'Places provider unavailable.';
    console.warn('[api/places/nearby] provider error:', warning);

    return NextResponse.json({
      places: [],
      count: 0,
      provider: provider.name,
      coordinates: { lat, lng },
      hasBoundingBox: !!boundingBox,
      isDemo: false,
      warning,
    });
  }
}
