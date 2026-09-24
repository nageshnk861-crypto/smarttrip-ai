import { NextRequest, NextResponse } from 'next/server';
import { getPlacesProvider } from '../../../../lib/providers/places';

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')?.trim() ?? '';

  if (query.length < 2) {
    return NextResponse.json({ results: [], provider: getPlacesProvider().name });
  }

  try {
    const provider = getPlacesProvider();
    const results = await provider.autocomplete(query);
    return NextResponse.json({ results, provider: provider.name, isDemo: false });
  } catch {
    return NextResponse.json(
      { results: [], error: 'Place search is temporarily unavailable.' },
      { status: 502 },
    );
  }
}
