import { NextResponse } from 'next/server';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const city = searchParams.get('city');
    const apiKey = process.env.WEATHER_API_KEY; // Ensure you have your API key in the environment variables

    if (!city) {
        return NextResponse.json({ error: 'City is required' }, { status: 400 });
    }

    const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric`);

    if (!response.ok) {
        return NextResponse.json({ error: 'Failed to fetch weather data' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
}