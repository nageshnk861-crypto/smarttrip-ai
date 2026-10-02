import { NextResponse } from 'next/server';

interface IpLocationResponse {
  name: string;
  city?: string;
  state?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
}

export async function GET() {
  try {
    // Attempt 1: ipwho.is (fast, HTTPS, generous free rate limit)
    const res = await fetch('https://ipwho.is/', {
      signal: AbortSignal.timeout(5_000),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success !== false && data.latitude && data.longitude) {
        const parts: string[] = [];
        if (data.city) parts.push(data.city);
        if (data.region && data.region !== data.city) parts.push(data.region);
        if (data.country) parts.push(data.country);

        const name = parts.length > 0 ? parts.join(', ') : (data.city || 'Current Location');

        const responsePayload: IpLocationResponse = {
          name,
          city: data.city,
          state: data.region,
          country: data.country,
          latitude: data.latitude,
          longitude: data.longitude,
        };

        return NextResponse.json(responsePayload);
      }
    }
  } catch {
    // Fall through to backup provider
  }

  try {
    // Attempt 2: ip-api.com fallback
    const res = await fetch('http://ip-api.com/json/?fields=status,city,regionName,country,lat,lon', {
      signal: AbortSignal.timeout(5_000),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.status === 'success' && data.lat && data.lon) {
        const parts: string[] = [];
        if (data.city) parts.push(data.city);
        if (data.regionName && data.regionName !== data.city) parts.push(data.regionName);
        if (data.country) parts.push(data.country);

        const name = parts.length > 0 ? parts.join(', ') : (data.city || 'Current Location');

        const responsePayload: IpLocationResponse = {
          name,
          city: data.city,
          state: data.regionName,
          country: data.country,
          latitude: data.lat,
          longitude: data.lon,
        };

        return NextResponse.json(responsePayload);
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'IP geolocation failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }

  return NextResponse.json({ error: 'Could not resolve IP location' }, { status: 404 });
}
