import { NextResponse } from 'next/server';

export async function GET(req) {
    const { origin } = req.nextUrl;

    // Example coordinates for the route
    const start = '37.7749,-122.4194'; // San Francisco
    const end = '34.0522,-118.2437'; // Los Angeles

    // Replace with your actual Mapbox or Google Maps API key
    const apiKey = process.env.MAPS_API_KEY;
    const apiUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${start};${end}?access_token=${apiKey}`;

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error('Failed to fetch route data');
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}