import type { Request, Response } from 'express';
import { geocodePlace } from '../services/routing.js';
import { fetchWeather } from '../services/weather.js';

export async function getWeather(req: Request, res: Response): Promise<void> {
  const query = (req.query.destination as string) || (req.query.q as string) || '';
  const latStr = req.query.lat as string;
  const lngStr = req.query.lng as string;
  const daysStr = req.query.days as string;

  let lat = latStr ? parseFloat(latStr) : undefined;
  let lng = lngStr ? parseFloat(lngStr) : undefined;
  const days = daysStr ? parseInt(daysStr, 10) : 5;

  if ((lat === undefined || isNaN(lat)) && query) {
    const coords = await geocodePlace(query);
    if (coords) {
      lat = coords.lat;
      lng = coords.lng;
    }
  }

  if (lat === undefined || lng === undefined || isNaN(lat) || isNaN(lng)) {
    res.status(400).json({ error: 'Latitude and Longitude or a valid destination is required' });
    return;
  }

  try {
    const weather = await fetchWeather(lat, lng, days);
    res.json({ data: weather });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch weather';
    res.status(500).json({ error: message });
  }
}
