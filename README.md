# SmartTrip AI

SmartTrip AI is an intelligent, budget-aware travel planning application. It accepts a structured trip request, validates constraints, generates a deterministic budget and itinerary, and clearly labels unconnected provider data as demo data.

## Features

- SmartTrip AI authentication experience
- Protected dashboard and planner routes
- Validated `/api/plan` server pipeline
- Budget and itinerary engines under `lib/planner`
- Destination discovery API with isolated demo provider
- Google Places autocomplete when configured
- Supabase-ready schema with UUIDs, constraints, indexes, and RLS

## Tech stack

- Next.js
- React
- TypeScript
- Tailwind CSS and shared CSS design system
- Google Places API integration
- Supabase PostgreSQL migration

## Setup

1. Install dependencies from the workspace root:
   ```bash
   npm install --prefix smarttrip-app
   ```

2. Copy the example environment file:
   ```bash
   copy smarttrip-app\.env.example smarttrip-app\.env.local
   ```

3. Add Supabase and provider keys in `.env.local`. The core planner runs in demo mode without external keys.

4. Run the app:
   ```bash
   npm run dev
   ```

5. Open the app at:
   ```text
   http://localhost:3000
   ```

> If port 3000 is already occupied, Next.js will switch to another available port automatically.

## Current planner architecture

`UI -> /api/plan-trip -> prompt parser -> travel agent -> tools/RAG -> budget guardrail -> itinerary -> UI`

The original `/api/plan` endpoint remains available for structured planner requests. `/api/plan-trip` accepts the same structured fields or a prompt such as:

```json
{
   "prompt": "Plan a 3-day trip from Bangalore for 2 people. Budget ₹10,000. I like temples, local food and nature."
}
```

The local agent reports each tool step and labels provider-backed steps as unavailable until their environment variable is configured. It never treats demo estimates as live prices. Curated destination notes are retrieved locally today; `supabase/migrations/002_rag_knowledge.sql` adds the pgvector table and cosine-search function for production embeddings.

The demo provider is isolated under `lib/providers/demo`. It does not claim live prices, availability, routes, or weather. Apply `supabase/migrations/001_initial_schema.sql`, then `002_rag_knowledge.sql` and `003_provider_catalog.sql` in Supabase when enabling persistence and provider catalog data.

## Production notes

- Set `GOOGLE_PLACES_API_KEY` in `smarttrip-app/.env.local` for live place autocomplete and place details. Keep this server-only key out of client code and source control.
- Authentication is disabled until Supabase credentials are configured; protected routes fail closed and use Supabase SSR sessions when enabled.
- Real destination, hotel, route, weather, and AI providers should be added behind provider interfaces. Hotel requests return `PROVIDER_NOT_CONFIGURED` rather than calling a placeholder URL.
- `OPENAI_API_KEY` enables the optional text assistant. It is not the source of truth for prices, routes, or budget feasibility.
- Configure `WEATHER_API_KEY`, `HOTELS_API_URL`, and Google Places credentials only when those providers are available.

## Project structure

- app/ - app routes and pages
- components/ - reusable UI components
- lib/ - auth, planner engines, and providers
- app/api/ - API routes for travel features
- middleware.ts - protected route middleware
- supabase/migrations/ - PostgreSQL schema and RLS policies

## Phase 3: Google Places & Deterministic Planning

Phase 3 integrates live Google Places discovery with deterministic cost estimation and automatic itinerary generation:

1. **Google Places Autocomplete**: `GET /api/places/autocomplete?input={query}` returns live city and locality predictions (or demo predictions when unconfigured).
2. **Google Places Details**: `GET /api/places/details?place_id={id}` returns verified address, name, and geographic coordinates (`lat`/`lng`).
3. **Google Places Nearby Search**: `GET /api/places/nearby?lat={lat}&lng={lng}&radius={meters}` returns nearby attractions and points of interest based on coordinates.
4. **Deterministic Budget Engine**: Calculates deterministic estimated breakdowns (transport, stay, food, activities, local transit, and buffer) based on duration, traveler count, and travel style without inventing prices.
5. **Itinerary Engine**: Generates day-by-day activity schedules utilizing destination points of interest and user-selected interests.
6. **Provider Status Labeling**: Clearly differentiates `LIVE`, `ESTIMATED`, `DEMO`, and `UNAVAILABLE` statuses across the UI and agent steps.

## Build verification

This project has been verified with:

```bash
npx tsc --noEmit
npm run lint
npm run build
npx tsx --test __tests__/phase3.test.ts
```

Both commands run against the nested Next.js app through the workspace root scripts.