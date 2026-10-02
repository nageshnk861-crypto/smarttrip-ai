/**
 * lib/research/providers/weather.ts
 *
 * Open-Meteo weather provider.
 *
 * https://open-meteo.com — free, no API key required.
 * Uses destination latitude/longitude to fetch current conditions
 * and a multi-day forecast.
 *
 * WMO weather interpretation codes are mapped to human-readable descriptions.
 * No API key is needed, so this provider is always available.
 * If the network request fails, an "unavailable" result is returned —
 * weather data is never invented.
 */

import type {
  DataSource,
  ResearchRequest,
  WeatherForecastDay,
  WeatherResearch,
} from '../types';
import type { WeatherProvider } from './interfaces';

const OPEN_METEO_BASE = 'https://api.open-meteo.com/v1/forecast';
const TIMEOUT_MS = 10_000;

function nowIso() { return new Date().toISOString(); }
function expiresIn(minutes: number) {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

function makeSource(): DataSource {
  return {
    name: 'Open-Meteo (open-meteo.com)',
    sourceType: 'live',
    retrievedAt: nowIso(),
    expiresAt: expiresIn(60),
    url: 'https://open-meteo.com',
  };
}

// ─── WMO weather code → description mapping ───────────────────────────────────
// https://open-meteo.com/en/docs#weathervariables

const WMO_DESCRIPTIONS: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Rime fog',
  51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
  56: 'Light freezing drizzle', 57: 'Heavy freezing drizzle',
  61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
  66: 'Light freezing rain', 67: 'Heavy freezing rain',
  71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Slight rain showers', 81: 'Moderate rain showers', 82: 'Violent rain showers',
  85: 'Slight snow showers', 86: 'Heavy snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm with slight hail', 99: 'Thunderstorm with heavy hail',
};

function wmoDescription(code: number): string {
  return WMO_DESCRIPTIONS[code] ?? `Weather code ${code}`;
}

// ─── Open-Meteo response types ────────────────────────────────────────────────

type OpenMeteoResponse = {
  current?: {
    temperature_2m?: number;
    apparent_temperature?: number;
    relative_humidity_2m?: number;
    wind_speed_10m?: number;
    weather_code?: number;
  };
  daily?: {
    time?: string[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    weather_code?: number[];
    precipitation_probability_max?: number[];
    wind_speed_10m_max?: number[];
  };
};

export class OpenMeteoProvider implements WeatherProvider {
  readonly name = 'Open-Meteo';

  async search(req: ResearchRequest): Promise<WeatherResearch> {
    const unavailable = (): WeatherResearch => ({
      available: false,
      forecast: [],
      source: {
        name: this.name,
        sourceType: 'estimated',
        retrievedAt: nowIso(),
      },
    });

    try {
      const url = new URL(OPEN_METEO_BASE);
      url.searchParams.set('latitude', String(req.latitude));
      url.searchParams.set('longitude', String(req.longitude));
      // Current weather fields
      url.searchParams.set(
        'current',
        'temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code',
      );
      // Daily forecast fields for up to 16 days (we use req.days + 1)
      const forecastDays = Math.min(req.days + 1, 16);
      url.searchParams.set('forecast_days', String(forecastDays));
      url.searchParams.set(
        'daily',
        'temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max,wind_speed_10m_max',
      );
      url.searchParams.set('timezone', 'auto');

      const res = await fetch(url.toString(), {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (!res.ok) return unavailable();

      const data = (await res.json()) as OpenMeteoResponse;
      const source = makeSource();

      // ── Current conditions ────────────────────────────────────────────────
      const current = data.current
        ? {
            tempC: Math.round((data.current.temperature_2m ?? 0) * 10) / 10,
            feelsLikeC: Math.round((data.current.apparent_temperature ?? 0) * 10) / 10,
            humidity: data.current.relative_humidity_2m ?? 0,
            windKph: Math.round((data.current.wind_speed_10m ?? 0) * 10) / 10,
            description: wmoDescription(data.current.weather_code ?? 0),
            icon: String(data.current.weather_code ?? 0),
          }
        : undefined;

      // ── Daily forecast ────────────────────────────────────────────────────
      const daily = data.daily;
      const forecast: WeatherForecastDay[] = [];

      if (daily?.time?.length) {
        for (let i = 0; i < Math.min(daily.time.length, req.days); i++) {
          forecast.push({
            date: daily.time[i],
            tempMaxC: Math.round((daily.temperature_2m_max?.[i] ?? 0) * 10) / 10,
            tempMinC: Math.round((daily.temperature_2m_min?.[i] ?? 0) * 10) / 10,
            description: wmoDescription(daily.weather_code?.[i] ?? 0),
            icon: String(daily.weather_code?.[i] ?? 0),
            rainProbability: daily.precipitation_probability_max?.[i],
            windKph: daily.wind_speed_10m_max?.[i]
              ? Math.round(daily.wind_speed_10m_max[i] * 10) / 10
              : undefined,
          });
        }
      }

      return {
        available: true,
        current,
        forecast,
        source,
      };
    } catch {
      return unavailable();
    }
  }
}
