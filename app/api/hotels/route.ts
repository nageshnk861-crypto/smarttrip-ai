import { NextResponse } from 'next/server';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const location = searchParams.get('location');
    const checkIn = searchParams.get('checkIn');
    const checkOut = searchParams.get('checkOut');
    const guests = searchParams.get('guests');

    if (!location || !checkIn || !checkOut || !guests) {
        return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    try {
        // Replace with actual hotel API integration
        const response = await fetch(`https://api.example.com/hotels?location=${location}&checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}`);
        const data = await response.json();

        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch hotel data' }, { status: 500 });
    }
}