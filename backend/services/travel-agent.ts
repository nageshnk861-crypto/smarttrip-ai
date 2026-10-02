/**
 * Travel Agent Multi-Step Orchestration Service
 */

import type { TouristPlace, TripPlan, TripRequest } from '../models/types.js';
import { askOllama } from './ollama.js';
import { searchAttractions } from './overpass.js';
import { planTripDeterministic } from './planner.js';
import { estimateTransport } from './routing.js';
import { fetchWeather } from './weather.js';

export async function runTravelAgentPipeline(
  request: TripRequest,
  prompt?: string,
): Promise<TripPlan> {
  const dest = request.destination.trim();
  const lat = request.latitude ?? 28.6139;
  const lng = request.longitude ?? 77.2090;

  // 1. Fetch live places from Overpass
  let places: TouristPlace[] = [];
  try {
    places = await searchAttractions(lat, lng, 15000, request.interests);
  } catch (err) {
    console.warn('Overpass lookup failed, continuing with empty places list:', err);
  }

  // 2. Fetch live weather
  let weatherSummary = 'Pleasant travel conditions expected.';
  try {
    const weather = await fetchWeather(lat, lng, request.days);
    if (weather.current) {
      weatherSummary = `${weather.current.description}, temperature around ${weather.current.tempC}°C.`;
    }
  } catch (err) {
    console.warn('Weather fetch failed:', err);
  }

  // 3. Estimate transport
  try {
    await estimateTransport(
      request.origin,
      dest,
      lat,
      lng,
      request.originLatitude,
      request.originLongitude,
      request.currency || 'INR',
    );
  } catch (err) {
    console.warn('Transport estimation failed:', err);
  }

  // 4. Generate plan
  const basePlan = planTripDeterministic(request, places);

  // 5. Query Ollama AI for rich advice
  let aiAdvice = '';
  try {
    const aiPrompt = prompt
      ? `User prompt: "${prompt}". Provide a brief 2-sentence recommendation for a ${request.days}-day trip to ${dest}.`
      : `Provide a concise 2-sentence travel tip for visiting ${dest} for ${request.days} days focusing on ${request.interests.join(', ') || 'local culture'}.`;
    aiAdvice = await askOllama(aiPrompt);
  } catch {
    aiAdvice = `Enjoy exploring the vibrant sights, cuisine, and heritage of ${dest}!`;
  }

  basePlan.agent = {
    summary: aiAdvice,
    weatherAdvice: weatherSummary,
    packingAdvice: [
      'Comfortable walking shoes',
      'Breathable cotton clothes and a light jacket',
      'Universal power adapter and portable power bank',
      'Sun protection and refillable water bottle',
    ],
  };

  return basePlan;
}
