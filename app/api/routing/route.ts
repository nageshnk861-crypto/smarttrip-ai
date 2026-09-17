import { NextResponse } from 'next/server';

export async function GET(request) {
    const { origin } = request.nextUrl;

    // Example parameters for routing API
    const { start, end } = request.nextUrl.searchParams;

    if (!start || !end) {
        return NextResponse.json({ error: 'Start and end locations are required.' }, { status: 400 });
    }

    try {
        const response = await fetch(`https://api.mapbox.com/directions/v5/mapbox/driving/${start};${end}?access_token=${process.env.MAPBOX_ACCESS_TOKEN}`);
        const data = await response.json();

        if (!response.ok) {
            return NextResponse.json({ error: data.message }, { status: response.status });
        }

        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch routing information.' }, { status: 500 });
    }
}