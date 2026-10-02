import type { Request, Response } from 'express';
import { searchHotels } from '../services/overpass.js';
import { geocodePlace } from '../services/routing.js';

export async function getHotels(req: Request, res: Response): Promise<void> {
  const query = (req.query.destination as string) || (req.query.q as string) || '';
  const latStr = req.query.lat as string;
  const lngStr = req.query.lng as string;

  let lat = latStr ? parseFloat(latStr) : undefined;
  let lng = lngStr ? parseFloat(lngStr) : undefined;

  if ((lat === undefined || isNaN(lat)) && query) {
    const coords = await geocodePlace(query);
    if (coords) {
      lat = coords.lat;
      lng = coords.lng;
    }
  }

  if (lat === undefined || lng === undefined || isNaN(lat) || isNaN(lng)) {
    res.status(400).json({ error: 'Latitude and Longitude or a valid destination query is required' });
    return;
  }

  try {
    const hotels = await searchHotels(lat, lng, 12000);
    res.json({
      data: hotels,
      count: hotels.length,
      coordinates: { latitude: lat, longitude: lng },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to search hotels';
    res.status(500).json({ error: message });
  }
}
