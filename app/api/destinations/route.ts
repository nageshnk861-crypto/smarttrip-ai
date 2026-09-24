import { NextRequest, NextResponse } from 'next/server';
import { getPlacesProvider } from '../../../lib/providers/places';

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (query.length < 2) return NextResponse.json({ data: [], isDemo: false });

  try {
    const provider = getPlacesProvider();
    const data = await provider.autocomplete(query);
    return NextResponse.json({ data, isDemo: false, provider: provider.name });
  } catch {
    return NextResponse.json({ data: [], isDemo: false, error: 'Unable to find destinations.' }, { status: 502 });
  }
}
