import type { Request, Response } from 'express';
import type { TripRequest } from '../models/types.js';
import { askOllama } from '../services/ollama.js';
import { NoFeasiblePlanError, planTripPipeline, planTripDeterministic } from '../services/planner.js';

export async function chatAI(req: Request, res: Response): Promise<void> {
  const { prompt, systemPrompt } = req.body;

  if (!prompt) {
    res.status(400).json({ error: 'Prompt is required' });
    return;
  }

  try {
    const response = await askOllama(prompt, systemPrompt);
    res.json({ response });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate AI response';
    res.status(500).json({ error: message });
  }
}

export async function planTrip(req: Request, res: Response): Promise<void> {
  const body = req.body;
  const destination = body.destination || body.destination_name;

  if (!destination) {
    res.status(400).json({ error: 'Destination is required' });
    return;
  }

  const tripRequest: TripRequest = {
    origin: body.origin || body.startLocation || 'Bengaluru',
    destination: destination.trim(),
    days: Number(body.days || body.numberOfDays) || 3,
    budget: Number(body.budget) || 20000,
    travelers: Number(body.travelers) || 1,
    travelStyle: body.travelStyle || body.travel_style || 'Budget',
    interests: Array.isArray(body.interests) ? body.interests : [],
    transport: body.transport || body.transportMode || 'bus',
    startDate: body.startDate,
    endDate: body.endDate,
    currency: body.currency || 'INR',
    latitude: typeof body.latitude === 'number' ? body.latitude : (body.latitude ? parseFloat(body.latitude) : undefined),
    longitude: typeof body.longitude === 'number' ? body.longitude : (body.longitude ? parseFloat(body.longitude) : undefined),
    originLatitude: typeof body.originLatitude === 'number' ? body.originLatitude : (body.originLatitude ? parseFloat(body.originLatitude) : undefined),
    originLongitude: typeof body.originLongitude === 'number' ? body.originLongitude : (body.originLongitude ? parseFloat(body.originLongitude) : undefined),
    city: body.city,
    state: body.state,
    country: body.country,
    boundingBox: body.boundingBox,
  };

  try {
    const plan = await planTripPipeline(tripRequest);
    res.json({ data: plan });
  } catch (error) {
    if (error instanceof NoFeasiblePlanError) {
      res.status(422).json({
        error: error.message,
        code: error.code,
        adjustments: error.adjustments,
      });
      return;
    }

    const message = error instanceof Error ? error.message : 'Unable to create a trip plan';
    res.status(400).json({ error: message });
  }
}

export async function planDeterministic(req: Request, res: Response): Promise<void> {
  const body = req.body;
  const destination = body.destination || body.destination_name;

  if (!destination) {
    res.status(400).json({ error: 'Destination is required' });
    return;
  }

  const tripRequest: TripRequest = {
    origin: body.origin || body.startLocation || 'Bengaluru',
    destination: destination.trim(),
    days: Number(body.days || body.numberOfDays) || 3,
    budget: Number(body.budget) || 20000,
    travelers: Number(body.travelers) || 1,
    travelStyle: body.travelStyle || body.travel_style || 'Budget',
    interests: Array.isArray(body.interests) ? body.interests : [],
    transport: body.transport || body.transportMode || 'bus',
    startDate: body.startDate,
    endDate: body.endDate,
    currency: body.currency || 'INR',
    latitude: typeof body.latitude === 'number' ? body.latitude : (body.latitude ? parseFloat(body.latitude) : undefined),
    longitude: typeof body.longitude === 'number' ? body.longitude : (body.longitude ? parseFloat(body.longitude) : undefined),
    originLatitude: typeof body.originLatitude === 'number' ? body.originLatitude : (body.originLatitude ? parseFloat(body.originLatitude) : undefined),
    originLongitude: typeof body.originLongitude === 'number' ? body.originLongitude : (body.originLongitude ? parseFloat(body.originLongitude) : undefined),
  };

  try {
    const plan = await planTripPipeline(tripRequest);
    res.json({ data: plan });
  } catch (error) {
    if (error instanceof NoFeasiblePlanError) {
      res.status(422).json({
        error: error.message,
        code: error.code,
        adjustments: error.adjustments,
      });
      return;
    }
    const message = error instanceof Error ? error.message : 'Unable to calculate budget plan';
    res.status(400).json({ error: message });
  }
}
