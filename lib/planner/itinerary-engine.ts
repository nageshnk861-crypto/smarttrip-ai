import { DayPlan, TripRequest } from './types';

/**
 * Builds a day-by-day itinerary.
 *
 * CONTRACT: activities are built ONLY from verifiedPlaces.
 * No hardcoded attraction names are ever injected.
 * If there are not enough verified places for a day the activity
 * explicitly tells the user that more place data is needed.
 */
export function buildItinerary(
  request: TripRequest,
  destination: string,
  verifiedPlaces: string[] = [],
): DayPlan[] {
  return Array.from({ length: request.days }, (_, index) => {
    const day = index + 1;

    let activities: string[];
    if (day === 1) {
      activities = [
        `Travel from ${request.origin} to ${destination}`,
        'Check in and get oriented',
      ];
    } else if (day === request.days) {
      activities = [
        'Enjoy a final local meal',
        `Return from ${destination} to ${request.origin}`,
      ];
    } else {
      // Slice two verified places per middle day.
      const sliceStart = (index - 1) * 2; // index 0 = day 1 (travel), index 1 = day 2 (first explore)
      const placesForDay = verifiedPlaces.slice(sliceStart, sliceStart + 2);

      activities =
        placesForDay.length > 0
          ? placesForDay.map((place) => `Visit ${place}`)
          : ['No verified nearby places found — connect a places provider for specific recommendations.'];
    }

    return {
      day,
      title:
        day === 1
          ? `Arrival in ${destination}`
          : day === request.days
          ? `Departure from ${destination}`
          : `Explore ${destination} — Day ${day}`,
      activities,
      places: (() => {
        if (day === 1 || day === request.days) return [];
        const sliceStart = (index - 1) * 2;
        return verifiedPlaces.slice(sliceStart, sliceStart + 2);
      })(),
    };
  });
}
