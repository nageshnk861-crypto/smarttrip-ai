/**
 * GET /api/places/reverse-geocode?lat=…&lng=…
 *
 * Converts a coordinate pair into a human-readable place name using
 * Nominatim (OpenStreetMap). Runs server-side so the User-Agent header
 * can be sent correctly and no API key is exposed to the browser.
 *
 * Returns:
 *   { name, city, state, country, displayName, latitude, longitude }
 *
 * On failure returns { error } — never falls back to a hardcoded city.
 */

import { NextRequest, NextResponse } from 'next/server';
import { NOMINATIM_BASE_URL, NOMINATIM_USER_AGENT } from '../../../../lib/config';

type NominatimReverseResponse = {
  display_name?: string;
  name?: string;
  address?: {
    road?: string;
    neighbourhood?: string;
    suburb?: string;
    village?: string;
    town?: string;
    city?: string;
    city_district?: string;
    county?: string;
    state_district?: string;
    state?: string;
    country?: string;
    country_code?: string;
  };
  error?: string;
};

/** Build a concise, human-friendly location name from Nominatim address fields. */
function buildLocationName(resp: NominatimReverseResponse): string {
  const a = resp.address ?? {};

  // Most specific → least specific
  const locality =
    a.suburb ??
    a.neighbourhood ??
    a.village ??
    a.town ??
    a.city_district ??
    a.city ??
    a.county ??
    a.state_district;

  const region = a.city ?? a.state_district ?? a.county ?? a.state;
  const state = a.state;
  const country = a.country;

  // Build layered name: "Suburb, City, State" or "City, State" etc.
  const parts: string[] = [];
  if (locality && locality !== region) parts.push(locality);
  if (region) parts.push(region);
  if (state && state !== region) parts.push(state);

  // For international queries include country if no state/city matched
  if (!parts.length && country) parts.push(country);

  return parts.length ? parts.join(', ') : (resp.display_name?.split(',')[0] ?? 'Unknown location');
}

export async function GET(request: NextRequest) {
  const lat = request.nextUrl.searchParams.get('lat');
  const lng = request.nextUrl.searchParams.get('lng');

  const latNum = Number(lat);
  const lngNum = Number(lng);

  if (!lat || !lng || !Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
    return NextResponse.json(
      { error: 'Valid lat and lng parameters are required.' },
      { status: 400 },
    );
  }

  try {
    const url = new URL('/reverse', NOMINATIM_BASE_URL);
    url.searchParams.set('lat', String(latNum));
    url.searchParams.set('lon', String(lngNum));
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('accept-language', 'en');

    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': NOMINATIM_USER_AGENT },
      signal: AbortSignal.timeout(8_000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Nominatim responded with ${res.status}.` },
        { status: 502 },
      );
    }

    const data = (await res.json()) as NominatimReverseResponse;

    if (data.error) {
      return NextResponse.json({ error: data.error }, { status: 404 });
    }

    const a = data.address ?? {};
    return NextResponse.json({
      name: buildLocationName(data),
      city: a.city ?? a.town ?? a.village ?? a.city_district ?? null,
      state: a.state ?? null,
      country: a.country ?? null,
      countryCode: a.country_code?.toUpperCase() ?? null,
      displayName: data.display_name ?? null,
      latitude: latNum,
      longitude: lngNum,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Reverse geocoding failed.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
