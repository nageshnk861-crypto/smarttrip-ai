import { Request, Response, Router } from 'express';
import { estimateBusFare, BusCategory, TripType } from '../services/bus-rate-model.js';
import { geocodePlace, getRoadDistance } from '../services/routing.js';

const transportRouter = Router();

/**
 * POST /api/transport/bus
 *
 * Calculates deterministic all-India bus fare estimate based on road distance
 * or verified operator fare.
 *
 * Body:
 * {
 *   origin: "Bangalore",
 *   destination: "Badami",
 *   travelers: 2,
 *   tripType: "ROUND_TRIP",
 *   busCategory: "EXPRESS_DELUXE"
 * }
 */
transportRouter.post('/bus', async (req: Request, res: Response) => {
  try {
    const { origin, destination, travelers = 1, tripType = 'ROUND_TRIP', busCategory = 'EXPRESS_DELUXE' } = req.body;

    if (!origin || typeof origin !== 'string' || !origin.trim()) {
      res.status(400).json({ error: 'Origin is required' });
      return;
    }
    if (!destination || typeof destination !== 'string' || !destination.trim()) {
      res.status(400).json({ error: 'Destination is required' });
      return;
    }

    const numTravelers = Number(travelers);
    if (isNaN(numTravelers) || numTravelers < 1) {
      res.status(400).json({ error: 'Travelers must be at least 1' });
      return;
    }

    // Resolve distance using free Nominatim geocoding & OpenRouteService / Haversine fallback
    let distanceKm: number | null = null;
    let distanceSource = 'OpenRouteService';

    try {
      const originCoords = await geocodePlace(origin);
      const destCoords = await geocodePlace(destination);

      if (originCoords && destCoords) {
        const roadInfo = await getRoadDistance(originCoords.lat, originCoords.lng, destCoords.lat, destCoords.lng);
        if (roadInfo && roadInfo.distanceKm > 0) {
          distanceKm = roadInfo.distanceKm;
          distanceSource = roadInfo.isRoad ? 'OpenRouteService' : 'SmartTrip Distance Estimator';
        }
      }
    } catch {
      distanceKm = null;
    }

    const estimate = estimateBusFare({
      origin,
      destination,
      distanceKm,
      busCategory: busCategory as BusCategory,
      travelers: numTravelers,
      tripType: tripType as TripType,
      distanceSource,
    });

    res.json(estimate);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Error calculating bus fare' });
  }
});

export default transportRouter;
