import { NextRequest, NextResponse } from 'next/server';
import { WEATHER_API_BASE_URL, WEATHER_UNITS, WEATHER_CACHE_REVALIDATE_SECONDS } from '../../../lib/config';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const city = searchParams.get('city');
  const apiKey = process.env.WEATHER_API_KEY ?? '';

  if (!city) {
    return NextResponse.json({ error: 'city parameter is required.' }, { status: 400 });
  }

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Weather information is currently unavailable.', code: 'PROVIDER_NOT_CONFIGURED' },
      { status: 503 },
    );
  }

  try {
    const url = `${WEATHER_API_BASE_URL}?q=${encodeURIComponent(city)}&appid=${apiKey}&units=${WEATHER_UNITS}`;
    const response = await fetch(url, { next: { revalidate: WEATHER_CACHE_REVALIDATE_SECONDS } });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Weather information is currently unavailable.' },
        { status: 502 },
      );
    }

    const data = await response.json();
    return NextResponse.json({ data, units: WEATHER_UNITS, isDemo: false });
  } catch {
    return NextResponse.json({ error: 'Weather information is currently unavailable.' }, { status: 502 });
  }
}
