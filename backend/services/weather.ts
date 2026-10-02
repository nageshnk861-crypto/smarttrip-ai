/**
 * Open-Meteo Weather Service
 * Free, accurate multi-day forecast without requiring API keys.
 */

import type { DataSource, WeatherForecastDay, WeatherResearch } from '../models/types.js';

const OPEN_METEO_BASE = 'https://api.open-meteo.com/v1/forecast';
const TIMEOUT_MS = 10_000;

function nowIso(): string {
  return new Date().toISOString();
}

function expiresIn(minutes: number): string {
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

const WMO_DESCRIPTIONS: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  56: 'Light freezing drizzle',
  57: 'Heavy freezing drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  66: 'Light freezing rain',
  67: 'Heavy freezing rain',
  71: 'Slight snow',
  73: 'Moderate snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  85: 'Slight snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail',
};

function wmoDescription(code: number): string {
  return WMO_DESCRIPTIONS[code] || `Weather code ${code}`;
}

interface OpenMeteoApiResponse {
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
}

export async function fetchWeather(lat: number, lng: number, days: number = 3): Promise<WeatherResearch> {
  const unavailable: WeatherResearch = {
    available: false,
    forecast: [],
    source: {
      name: 'Open-Meteo',
      sourceType: 'estimated',
      retrievedAt: nowIso(),
    },
  };

  try {
    const url = new URL(OPEN_METEO_BASE);
    url.searchParams.set('latitude', String(lat));
    url.searchParams.set('longitude', String(lng));
    url.searchParams.set(
      'current',
      'temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code',
    );
    const forecastDays = Math.min(Math.max(days + 1, 1), 16);
    url.searchParams.set('forecast_days', String(forecastDays));
    url.searchParams.set(
      'daily',
      'temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max,wind_speed_10m_max',
    );
    url.searchParams.set('timezone', 'auto');

    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': 'SmartTrip AI/1.0' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) return unavailable;

    const data = (await res.json()) as OpenMeteoApiResponse;
    const source = makeSource();

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

    const daily = data.daily;
    const forecast: WeatherForecastDay[] = [];

    if (daily?.time?.length) {
      for (let i = 0; i < Math.min(daily.time.length, days); i++) {
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
  } catch (error) {
    console.error('Weather service error:', error);
    return unavailable;
  }
}
