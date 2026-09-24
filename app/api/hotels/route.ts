import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const location = searchParams.get('location');
  const checkIn = searchParams.get('checkIn');
  const checkOut = searchParams.get('checkOut');
  const guests = searchParams.get('guests');

  if (!location || !checkIn || !checkOut || !guests) {
    return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
  }

  const providerUrl = process.env.HOTELS_API_URL;
  if (!providerUrl) {
    return NextResponse.json({
      error: 'Hotel availability is not configured.',
      code: 'PROVIDER_NOT_CONFIGURED',
      isDemo: false,
    }, { status: 503 });
  }

  try {
    const provider = new URL(providerUrl);
    provider.searchParams.set('location', location);
    provider.searchParams.set('checkIn', checkIn);
    provider.searchParams.set('checkOut', checkOut);
    provider.searchParams.set('guests', guests);
    const response = await fetch(
      provider,
      { next: { revalidate: 600 } },
    );
    if (!response.ok) {
      return NextResponse.json({ error: 'Hotel availability is currently unavailable.' }, { status: 502 });
    }
    const data = await response.json();

    return NextResponse.json({ data, isDemo: false });
  } catch {
    return NextResponse.json({ error: 'Hotel availability is currently unavailable.' }, { status: 502 });
  }
}