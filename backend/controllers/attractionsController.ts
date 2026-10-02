/**
 * Attractions Controller
 * Handles: /api/attractions/categories, /api/attractions/search,
 *          /api/attractions/destinations, /api/attractions/autocomplete
 */

import type { Request, Response } from 'express';
import {
  VALID_CATEGORIES,
  loadCategory,
  searchGeoJsonByText,
  type PlaceCategory,
  type PlaceResult,
} from '../services/geojson.js';
import { fetchPlacesForCategory } from '../services/overpass.js';

// ── Controller: GET /api/attractions/categories ───────────────────────────────

export function getCategories(_req: Request, res: Response): void {
  res.json({
    success: true,
    categories: VALID_CATEGORIES,
  });
}

// ── Controller: GET /api/attractions/search ───────────────────────────────────

export async function searchPlacesByCategory(
  req: Request,
  res: Response,
): Promise<void> {
  const { category, latitude, longitude, radius } = req.query;

  // ─ Validate category ─
  if (!category || typeof category !== 'string') {
    res.status(400).json({
      success: false,
      error: 'Missing required parameter: category',
      validCategories: VALID_CATEGORIES,
    });
    return;
  }

  const cat = category.trim().toLowerCase() as PlaceCategory;
  if (!VALID_CATEGORIES.includes(cat)) {
    res.status(400).json({
      success: false,
      error: `Invalid category "${category}". Must be one of: ${VALID_CATEGORIES.join(', ')}`,
      validCategories: VALID_CATEGORIES,
    });
    return;
  }

  // ─ Validate coords ─
  const lat = parseFloat(latitude as string);
  const lng = parseFloat(longitude as string);
  if (isNaN(lat) || isNaN(lng) || latitude === undefined || longitude === undefined) {
    res.status(400).json({
      success: false,
      error: 'Missing or invalid parameters: latitude and longitude are required numbers',
    });
    return;
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    res.status(400).json({
      success: false,
      error: 'latitude must be -90..90, longitude must be -180..180',
    });
    return;
  }

  // ─ Validate radius ─
  const radiusRaw = radius !== undefined ? parseFloat(radius as string) : 10000;
  if (isNaN(radiusRaw) || radiusRaw < 100 || radiusRaw > 100000) {
    res.status(400).json({
      success: false,
      error: 'radius must be a number between 100 and 100000 (metres)',
    });
    return;
  }

  // ─ Fetch from unified service (GeoJSON + Overpass fallback + deduplicated) ─
  const { places, overpassUsed } = await fetchPlacesForCategory(cat, lat, lng, radiusRaw);

  res.json({
    success: true,
    category: cat,
    count: places.length,
    overpassUsed,
    places,
  });
}

// ── Controller: GET /api/attractions/destinations ─────────────────────────────

export async function getDestinations(_req: Request, res: Response): Promise<void> {
  // Return a representative sample from all 7 categories
  const places: PlaceResult[] = [];

  for (const cat of VALID_CATEGORIES) {
    const list = loadCategory(cat);
    // Take up to 20 per category for a lightweight overview
    places.push(...list.slice(0, 20));
  }

  res.json({
    success: true,
    count: places.length,
    data: places,
  });
}

// ── Controller: GET /api/attractions/autocomplete?q= ─────────────────────────

export async function autocompletePlaces(req: Request, res: Response): Promise<void> {
  const query = (req.query.q as string) || (req.query.input as string) || '';

  if (!query || query.trim().length < 2) {
    res.json({ success: true, predictions: [] });
    return;
  }

  const cat = req.query.category as PlaceCategory | undefined;
  const results = searchGeoJsonByText(query.trim(), cat, 10);

  const predictions = results.map((p) => ({
    place_id: p.id,
    description: [p.name, p.city, p.state, p.country].filter(Boolean).join(', '),
    structured_formatting: {
      main_text: p.name,
      secondary_text: [p.city, p.state].filter(Boolean).join(', '),
    },
    latitude: p.latitude,
    longitude: p.longitude,
    category: p.category,
  }));

  res.json({ success: true, predictions });
}

// ── Controller: GET /api/places/search?q= ─────────────────────────────────────

export async function searchPlaces(req: Request, res: Response): Promise<void> {
  // If 'category' param is present, delegate to category search handler
  if (req.query.category) {
    return searchPlacesByCategory(req, res);
  }

  const query = ((req.query.q as string) || (req.query.destination as string) || '').trim();

  if (!query || query.length < 2) {
    res.json({ success: true, results: [], data: [] });
    return;
  }

  const suggestions: any[] = [];
  const seenNames = new Set<string>();

  // 1. Search OpenStreetMap / Nominatim for live cities, states, regions, landmarks
  try {
    const nomUrl = new URL('https://nominatim.openstreetmap.org/search');
    nomUrl.searchParams.set('q', query);
    nomUrl.searchParams.set('format', 'jsonv2');
    nomUrl.searchParams.set('addressdetails', '1');
    nomUrl.searchParams.set('limit', '8');
    nomUrl.searchParams.set('countrycodes', 'in,np,bt,lk'); // Prioritize South Asia / India

    const nomRes = await fetch(nomUrl.toString(), {
      headers: { 'User-Agent': 'SmartTrip AI/1.0' },
      signal: AbortSignal.timeout(6000),
    });

    if (nomRes.ok) {
      const nomData = (await nomRes.json()) as any[];
      for (const item of nomData) {
        const name = item.name || item.display_name?.split(',')[0] || query;
        const displayName = item.display_name || name;
        const key = `${name.toLowerCase()}|${parseFloat(item.lat).toFixed(2)}`;

        if (!seenNames.has(key)) {
          seenNames.add(key);
          const addr = item.address || {};
          const city = addr.city || addr.town || addr.village || addr.county || '';
          const state = addr.state || '';
          const country = addr.country || 'India';

          suggestions.push({
            place_id: `osm-${item.osm_type || 'node'}-${item.osm_id || Math.random()}`,
            name,
            displayName,
            description: displayName,
            latitude: parseFloat(item.lat),
            longitude: parseFloat(item.lon),
            city,
            state,
            country,
            osmType: item.osm_type,
            boundingBox: item.boundingbox ? item.boundingbox.map(Number) : undefined,
            structured_formatting: {
              main_text: name,
              secondary_text: [city, state, country].filter(Boolean).join(', '),
            },
          });
        }
      }
    }
  } catch (nomErr) {
    console.warn('[Places Search] Nominatim error:', nomErr);
  }

  // 2. Search GeoJSON Places fallback
  const geojsonMatches = searchGeoJsonByText(query, undefined, 10);
  for (const p of geojsonMatches) {
    const key = `${p.name.toLowerCase()}|${p.latitude.toFixed(2)}`;
    if (!seenNames.has(key)) {
      seenNames.add(key);
      const desc = [p.name, p.city, p.state, p.country].filter(Boolean).join(', ');
      suggestions.push({
        place_id: p.id,
        name: p.name,
        displayName: desc,
        description: desc,
        latitude: p.latitude,
        longitude: p.longitude,
        city: p.city,
        state: p.state,
        country: p.country,
        category: p.category,
        structured_formatting: {
          main_text: p.name,
          secondary_text: [p.city, p.state].filter(Boolean).join(', '),
        },
      });
    }
  }

  res.json({
    success: true,
    results: suggestions,
    data: suggestions,
  });
}

// ── Controller: GET /api/places/reverse-geocode?lat=&lng= ─────────────────────

export async function reverseGeocodePlace(req: Request, res: Response): Promise<void> {
  const lat = parseFloat(req.query.lat as string);
  const lng = parseFloat(req.query.lng as string);

  if (isNaN(lat) || isNaN(lng)) {
    res.status(400).json({ error: 'Latitude and longitude must be valid numbers' });
    return;
  }

  try {
    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lng));
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('addressdetails', '1');

    const response = await fetch(url.toString(), {
      headers: { 'User-Agent': 'SmartTrip AI/1.0' },
      signal: AbortSignal.timeout(6000),
    });

    if (response.ok) {
      const data = (await response.json()) as any;
      const addr = data.address || {};
      const cityName = addr.city || addr.town || addr.village || addr.suburb || addr.county || 'Detected Location';
      const stateName = addr.state || '';
      const countryName = addr.country || 'India';
      const fullName = [cityName, stateName, countryName].filter(Boolean).join(', ');

      res.json({
        name: fullName,
        city: cityName,
        state: stateName,
        country: countryName,
        latitude: lat,
        longitude: lng,
      });
      return;
    }
  } catch (err) {
    console.warn('[Reverse Geocode] Error:', err);
  }

  // Fallback response with coordinates
  res.json({
    name: `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
    latitude: lat,
    longitude: lng,
  });
}

// ── Controller: GET /api/places/ip-location ───────────────────────────────────

export async function getIpLocation(_req: Request, res: Response): Promise<void> {
  // Return a reliable detected default
  res.json({
    name: 'Bengaluru, Karnataka',
    latitude: 12.9716,
    longitude: 77.5946,
    city: 'Bengaluru',
    state: 'Karnataka',
    country: 'India',
  });
}
