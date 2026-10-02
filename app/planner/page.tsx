'use client';

import { FormEvent, Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { DestinationSearch, PlaceDetails } from '../../components/planner/DestinationSearch';
import {
  StartingLocationInput,
  type OriginLocation,
} from '../../components/planner/StartingLocationInput';
import { parseTripPrompt } from '../../lib/planner/validators';
import { ALL_INTEREST_OPTIONS } from '../../lib/config';
import {
  DEFAULT_BUDGET_AMOUNT,
  DEFAULT_TRIP_DAYS,
  DEFAULT_TRIP_TRAVELERS,
} from '../../lib/config';

type BoundingBox = [number, number, number, number];

type TravelStyle = 'Budget' | 'Comfort' | 'Premium';

type AgentStep = {
  tool: string;
  status: 'completed' | 'skipped';
  source: string;
  summary: string;
};

type TripPlan = {
  destination: string;
  coordinates?: { latitude: number; longitude: number };
  city?: string;
  state?: string;
  country?: string;
  totalCost: number;
  budget: number;
  remaining: number;
  budgetUsagePercentage: number;
  currency: string;
  transport: number;
  accommodation: number;
  food: number;
  activities: number;
  localTransport: number;
  buffer: number;
  dailyBudget?: Array<{
    day: number;
    transport: number;
    accommodation: number;
    food: number;
    localTransport: number;
    activities: number;
    buffer: number;
    total: number;
  }>;
  candidates: {
    name: string;
    budgetTotal: number;
    remainingBudget: number;
    interestScore: number;
    feasible: boolean;
  }[];
  nearbyPlaces: {
    place_id: string;
    name: string;
    category: string;
    latitude: number;
    longitude: number;
    distance?: number;
  }[];
  optimization: string;
  isDemo: boolean;
  source: string;
  days: {
    day: number;
    title: string;
    activities: string[];
    places?: string[];
  }[];
  agent?: {
    steps: AgentStep[];
    explanation: string;
  };
  /** Research budget from live provider data (may be absent if research failed). */
  researchBudget?: {
    accommodation: { lineTotal: number; priceRange: { min: number; max: number }; isLiveData: boolean; name: string; description?: string };
    food: { lineTotal: number; priceRange: { min: number; max: number }; isLiveData: boolean; name: string; description?: string };
    intercityTransport: { lineTotal: number; priceRange: { min: number; max: number }; name: string; description?: string };
    localTransport: { lineTotal: number; priceRange: { min: number; max: number }; name: string; description?: string };
    activities: { lineTotal: number; priceRange: { min: number; max: number }; name: string };
    buffer: { lineTotal: number };
    total: number;
    minimum: number;
    maximum: number;
    perPerson: number;
    perDay: number;
    perPersonPerDay: number;
    currency: string;
    remaining: number;
    breakdown: string;
    knownCost?: number;
    estimatedCost?: number;
    unavailableCosts?: string[];
  };
  /** Full research result for transport, hotel, food, weather sections. */
  research?: {
    intercityTransport: {
      options: Array<{
        mode: string; class?: string; priceRange: { min: number; max: number; currency: string };
        durationMinutes?: number; distanceKm?: number;
        source: { name: string; sourceType: string };
      }>;
    };
    accommodation: {
      results: Array<{ name: string; address?: string; pricePerNight?: { min: number; max: number; currency: string } | null; userRating?: number }>;
      priceRange: { min: number; max: number; currency: string };
      hasLiveData: boolean;
    };
    food: {
      restaurants: Array<{ name: string; address?: string; cuisine?: string; priceLevel?: number; userRating?: number }>;
      dailyCostPerPerson: { min: number; max: number; currency: string };
      hasLiveData: boolean;
    };
    weather: {
      available: boolean;
      current?: { tempC: number; description: string; humidity: number; windKph: number };
      forecast: Array<{ date: string; tempMinC: number; tempMaxC: number; description: string; rainProbability?: number }>;
    };
    hasAnyLiveData: boolean;
  };
};

// GeoStatus and OriginLocation are imported from StartingLocationInput component.

// ─── Planner page ─────────────────────────────────────────────────────────────

function formatCurrency(amount: number, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function PlannerPageContent() {
  const searchParams = useSearchParams();
  const parsedPrompt = parseTripPrompt(searchParams.get('prompt') ?? '');
  const initialInterests = Array.isArray(parsedPrompt.interests)
    ? parsedPrompt.interests
    : ['Nature', 'Food'];

  const [destination, setDestination] = useState(
    typeof parsedPrompt.destination === 'string' ? parsedPrompt.destination : '',
  );

  // ── Starting location ────────────────────────────────────────────────────
  // If the prompt already has an origin, seed it as a manual entry.
  const promptOriginName =
    typeof parsedPrompt.origin === 'string' ? (parsedPrompt.origin as string).trim() : '';

  const [origin, setOrigin] = useState<OriginLocation>({
    name: promptOriginName,
    source: 'manual',
  });

  // Convenience aliases used in the rest of the page.
  const startingLocation = origin.name;
  // ── End starting location ─────────────────────────────────────────────────
  const [selectedPlace, setSelectedPlace] = useState<PlaceDetails | null>(null);
  const [budget, setBudget] = useState(
    typeof parsedPrompt.budget === 'number'
      ? String(parsedPrompt.budget)
      : String(DEFAULT_BUDGET_AMOUNT),
  );
  const [days, setDays] = useState(
    typeof parsedPrompt.days === 'number'
      ? String(parsedPrompt.days)
      : String(DEFAULT_TRIP_DAYS),
  );
  const [travelers, setTravelers] = useState(
    typeof parsedPrompt.travelers === 'number'
      ? String(parsedPrompt.travelers)
      : String(DEFAULT_TRIP_TRAVELERS),
  );
  const [interests, setInterests] = useState<string[]>(initialInterests);
  const [travelStyle, setTravelStyle] = useState<TravelStyle>('Budget');
  const [isPlanning, setIsPlanning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [tripPlan, setTripPlan] = useState<TripPlan | null>(null);
  const [error, setError] = useState('');

  const numericBudget = Number(budget) || 0;
  const numericDays = Number(days) || 0;
  const numericTravelers = Number(travelers) || 0;

  const budgetPerTraveler = useMemo(
    () => (numericTravelers ? Math.round(numericBudget / numericTravelers) : 0),
    [numericBudget, numericTravelers],
  );

  function toggleInterest(interest: string) {
    setInterests((current) =>
      current.includes(interest)
        ? current.filter((i) => i !== interest)
        : [...current, interest],
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setTripPlan(null);

    if (!startingLocation.trim()) {
      setError('Please enter your starting location.');
      return;
    }
    if (!selectedPlace) {
      setError('Please search and select a destination from the results.');
      return;
    }
    if (
      selectedPlace.latitude === undefined ||
      selectedPlace.longitude === undefined ||
      !Number.isFinite(selectedPlace.latitude) ||
      !Number.isFinite(selectedPlace.longitude)
    ) {
      setError(
        'The selected destination is missing coordinates. Please select it again from the search results.',
      );
      return;
    }
    if (numericBudget < 1000) {
      setError('Please enter a budget of at least ₹1,000.');
      return;
    }
    if (numericDays < 1 || numericDays > 30) {
      setError('Trip duration must be between 1 and 30 days.');
      return;
    }
    if (numericTravelers < 1 || numericTravelers > 20) {
      setError('Travelers must be between 1 and 20.');
      return;
    }
    if (interests.length === 0) {
      setError('Please select at least one interest.');
      return;
    }

    setIsPlanning(true);
    try {
      const response = await fetch('/api/plan-trip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: startingLocation.trim(),
          originLatitude: origin.source === 'browser-geolocation' ? origin.latitude : undefined,
          originLongitude: origin.source === 'browser-geolocation' ? origin.longitude : undefined,
          destination: destination || selectedPlace.name || selectedPlace.description,
          latitude: selectedPlace.latitude,
          longitude: selectedPlace.longitude,
          boundingBox: selectedPlace.boundingBox ?? undefined,
          osmType: selectedPlace.osmType ?? undefined,
          city: selectedPlace.city,
          state: selectedPlace.state,
          country: selectedPlace.country,
          budget: numericBudget,
          days: numericDays,
          travelers: numericTravelers,
          interests,
          travelStyle,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        const adjustments =
          Array.isArray(result.adjustments) && result.adjustments.length
            ? ` Suggestions: ${(result.adjustments as string[]).join(', ')}.`
            : '';
        setError(`${result.error ?? 'Unable to create a trip plan.'}${adjustments}`);
        return;
      }

      setTripPlan(result.data as TripPlan);
    } catch {
      setError('Something went wrong while creating your itinerary. Please try again.');
    } finally {
      setIsPlanning(false);
    }
  }

  function resetPlan() {
    setTripPlan(null);
    setError('');
    setSaveMessage('');
  }

  async function saveTrip() {
    if (!tripPlan) return;
    setIsSaving(true);
    setSaveMessage('');
    try {
      const response = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: startingLocation,
          originLatitude: origin.source === 'browser-geolocation' ? origin.latitude : undefined,
          originLongitude: origin.source === 'browser-geolocation' ? origin.longitude : undefined,
          destination: tripPlan.destination,
          latitude: selectedPlace?.latitude,
          longitude: selectedPlace?.longitude,
          boundingBox: selectedPlace?.boundingBox ?? undefined,
          osmType: selectedPlace?.osmType ?? undefined,
          city: selectedPlace?.city,
          state: selectedPlace?.state,
          country: selectedPlace?.country,
          budget: numericBudget,
          days: numericDays,
          travelers: numericTravelers,
          interests,
          travelStyle,
        }),
      });
      const result = await response.json();
      setSaveMessage(
        response.ok ? '✓ Trip saved to your account.' : result.error ?? 'Unable to save this trip.',
      );
    } catch {
      setSaveMessage('Unable to save this trip right now.');
    } finally {
      setIsSaving(false);
    }
  }

  const fmt = (n: number) => formatCurrency(n, tripPlan?.currency ?? 'INR');

  return (
    <div className="planner-page">
      <div className="container">

        {/* ── HERO ──────────────────────────────────────────────────────── */}
        <section className="planner-hero">
          <div>
            <div className="planner-badge">✨ AI-POWERED TRIP PLANNER</div>
            <h1 className="page-title">
              Plan your perfect trip
              <br />
              <span className="planner-highlight">within your budget.</span>
            </h1>
            <p className="page-subtitle">
              Search a destination, set your budget and interests, and SmartTrip
              will generate a fully dynamic, budget-aware itinerary — no
              hardcoded suggestions.
            </p>
          </div>
        </section>

        {/* ── FORM + SIDEBAR ────────────────────────────────────────────── */}
        <section className="planner-layout">
          <div className="card planner-form-card">
            <div className="section-heading">
              <span className="section-icon">🧭</span>
              <div>
                <h2>Trip details</h2>
                <p>All destinations are resolved dynamically from real geocoding data.</p>
              </div>
            </div>

            <form onSubmit={handleSubmit}>

              {/* Starting location — manual entry + optional browser geolocation */}
              <StartingLocationInput
                value={origin}
                onChange={setOrigin}
                initialGeoStatus={promptOriginName ? 'manual' : 'idle'}
              />

              {/* Destination */}
              <div className="form-group">
                <label className="form-label" htmlFor="destination">
                  Destination
                </label>
                <DestinationSearch
                  value={selectedPlace?.displayName ?? destination}
                  onPlaceSelect={(place) => {
                    setSelectedPlace(place);
                    if (place) {
                      setDestination(
                        place.name ??
                          place.formatted_address ??
                          place.displayName ??
                          place.description ??
                          '',
                      );
                    } else {
                      setDestination('');
                    }
                  }}
                  placeholder="Search for a city, region, or landmark…"
                />
                {/* Coordinate confirmation badge */}
                {selectedPlace?.latitude !== undefined && (
                  <span className="input-help" style={{ color: '#16a34a' }}>
                    ✓ {selectedPlace.displayName ?? selectedPlace.description} —{' '}
                    {selectedPlace.latitude.toFixed(4)},{selectedPlace.longitude?.toFixed(4)}
                  </span>
                )}
                {!selectedPlace && (
                  <span className="input-help">
                    Type to search — select a result to lock the destination coordinates.
                  </span>
                )}
              </div>

              {/* Budget + Days */}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="budget">
                    Total budget
                  </label>
                  <div className="input-with-prefix">
                    <span>₹</span>
                    <input
                      id="budget"
                      type="number"
                      min="1000"
                      step="500"
                      className="form-input"
                      value={budget}
                      onChange={(e) => setBudget(e.target.value)}
                    />
                  </div>
                  <span className="input-help">Total for all travelers.</span>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="days">
                    Duration
                  </label>
                  <div className="input-with-suffix">
                    <input
                      id="days"
                      type="number"
                      min="1"
                      max="30"
                      className="form-input"
                      value={days}
                      onChange={(e) => setDays(e.target.value)}
                    />
                    <span>days</span>
                  </div>
                </div>
              </div>

              {/* Travelers */}
              <div className="form-group">
                <label className="form-label" htmlFor="travelers">
                  Travelers
                </label>
                <input
                  id="travelers"
                  type="number"
                  min="1"
                  max="20"
                  className="form-input"
                  value={travelers}
                  onChange={(e) => setTravelers(e.target.value)}
                />
                <span className="input-help">Number of people traveling together.</span>
              </div>

              {/* Interests — sourced from config, never hardcoded */}
              <div className="form-group">
                <label className="form-label">What are you interested in?</label>
                <div className="interest-grid">
                  {ALL_INTEREST_OPTIONS.map((interest) => {
                    const selected = interests.includes(interest);
                    return (
                      <button
                        key={interest}
                        type="button"
                        className={`interest-chip ${selected ? 'selected' : ''}`}
                        onClick={() => toggleInterest(interest)}
                        aria-pressed={selected}
                      >
                        <span aria-hidden>{selected ? '✓' : '+'}</span>
                        {interest}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Travel style */}
              <div className="form-group">
                <label className="form-label">Travel style</label>
                <div className="travel-style-grid">
                  {(['Budget', 'Comfort', 'Premium'] as TravelStyle[]).map((style) => (
                    <button
                      key={style}
                      type="button"
                      className={`style-option ${travelStyle === style ? 'selected' : ''}`}
                      onClick={() => setTravelStyle(style)}
                      aria-pressed={travelStyle === style}
                    >
                      <strong>
                        {style === 'Budget' && '💰'}
                        {style === 'Comfort' && '🏨'}
                        {style === 'Premium' && '✨'} {style}
                      </strong>
                      <span>
                        {style === 'Budget' && 'Save more and travel smart'}
                        {style === 'Comfort' && 'Balanced comfort and cost'}
                        {style === 'Premium' && 'Higher comfort and experiences'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="planner-error" role="alert">
                  <span aria-hidden>⚠️</span>
                  <p>{error}</p>
                </div>
              )}

              {/* Submit */}
              <button type="submit" className="planner-submit" disabled={isPlanning}>
                {isPlanning ? (
                  <>
                    <span className="spinner" aria-hidden />
                    Planning your trip…
                  </>
                ) : (
                  <>✨ Plan My Trip</>
                )}
              </button>
            </form>
          </div>

          {/* Sidebar */}
          <aside className="planner-sidebar">
            <div className="card planning-summary">
              <div className="section-heading">
                <span className="section-icon">💡</span>
                <div>
                  <h2>SmartTrip will consider</h2>
                  <p>Your plan is built around your requirements.</p>
                </div>
              </div>
              <div className="consider-list">
                <div>
                  <span>📍</span>
                  <p>
                    <strong>Starting point</strong>
                    {startingLocation || (
                      <em style={{ color: '#94a3b8', fontStyle: 'normal' }}>
                        Not specified
                      </em>
                    )}
                    {origin.latitude && origin.source === 'browser-geolocation' && (
                      <em style={{ display: 'block', fontSize: '0.75rem', color: '#16a34a' }}>
                        📍 GPS detected
                      </em>
                    )}
                  </p>
                </div>
                <div>
                  <span>🗺️</span>
                  <p>
                    <strong>Destination</strong>
                    {selectedPlace
                      ? (selectedPlace.displayName ?? selectedPlace.description)
                      : destination || 'Not selected'}
                    {selectedPlace?.latitude !== undefined && (
                      <em style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>
                        {selectedPlace.latitude.toFixed(4)},{' '}
                        {selectedPlace.longitude?.toFixed(4)}
                        {selectedPlace.boundingBox && ' · region'}
                      </em>
                    )}
                  </p>
                </div>
                <div>
                  <span>💰</span>
                  <p>
                    <strong>Budget</strong>
                    {formatCurrency(numericBudget)}
                  </p>
                </div>
                <div>
                  <span>📅</span>
                  <p>
                    <strong>Duration</strong>
                    {numericDays || 0} days
                  </p>
                </div>
                <div>
                  <span>👥</span>
                  <p>
                    <strong>Travelers</strong>
                    {numericTravelers || 0} people
                  </p>
                </div>
                <div>
                  <span>❤️</span>
                  <p>
                    <strong>Interests</strong>
                    {interests.length ? interests.join(', ') : 'None selected'}
                  </p>
                </div>
              </div>
              <div className="budget-per-person">
                <span>Budget per traveler</span>
                <strong>{formatCurrency(budgetPerTraveler)}</strong>
              </div>
            </div>

            <div className="card ai-info-card">
              <div className="ai-icon">🌐</div>
              <h3>100% dynamic destinations</h3>
              <p>
                Destinations are geocoded in real-time via OpenStreetMap/Nominatim.
                Nearby places are fetched from Overpass API using the selected
                coordinates. No hardcoded city suggestions are used.
              </p>
            </div>
          </aside>
        </section>

        {/* ── TRIP RESULT ───────────────────────────────────────────────── */}
        {tripPlan && (
          <section className="trip-result">
            {/* Header */}
            <div className="result-header">
              <div>
                <div className="planner-badge">✨ TRIP READY</div>
                <h2>
                  {startingLocation} → {tripPlan.destination}
                </h2>
                <p>
                  {numericDays} days · {numericTravelers} traveler
                  {numericTravelers !== 1 ? 's' : ''} · {travelStyle} travel
                  {tripPlan.city || tripPlan.state || tripPlan.country
                    ? ` · ${[tripPlan.city, tripPlan.state, tripPlan.country].filter(Boolean).join(', ')}`
                    : ''}
                </p>
                {tripPlan.coordinates && (
                  <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>
                    Coordinates: {tripPlan.coordinates.latitude.toFixed(5)},{' '}
                    {tripPlan.coordinates.longitude.toFixed(5)}
                  </p>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button type="button" className="secondary-button" onClick={resetPlan}>
                  Plan Again
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={saveTrip}
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving…' : 'Save Trip'}
                </button>
              </div>
            </div>

            {saveMessage && (
              <p
                className="input-help"
                style={{ color: saveMessage.startsWith('✓') ? '#16a34a' : '#dc2626' }}
              >
                {saveMessage}
              </p>
            )}

            {/* ── AI Explanation ──────────────────────────────────────── */}
            {tripPlan.agent?.explanation && (
              <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
                <div className="result-section-heading" style={{ marginBottom: '0.75rem' }}>
                  <h3>✨ SmartTrip AI Recommendation</h3>
                  <p>Generated from dynamically discovered places near {tripPlan.destination}.</p>
                </div>
                <p style={{ lineHeight: '1.7', color: '#374151' }}>
                  {tripPlan.agent.explanation}
                </p>
              </div>
            )}

            {/* ── Budget Summary ──────────────────────────────────────── */}
            <div className="result-total card">
              <div>
                <span className="result-label">Estimated trip cost</span>
                <strong className="result-price">{fmt(tripPlan.totalCost)}</strong>
              </div>
              <div className="budget-status">
                <span>Budget</span>
                <strong>{fmt(tripPlan.budget)}</strong>
                <span
                  className="remaining"
                  style={{ color: tripPlan.remaining >= 0 ? '#16a34a' : '#dc2626' }}
                >
                  {fmt(Math.abs(tripPlan.remaining))}{' '}
                  {tripPlan.remaining >= 0 ? 'remaining' : 'over budget'}
                </span>
                <small>{tripPlan.budgetUsagePercentage}% of budget used</small>
              </div>
            </div>

            {/* ── Budget Breakdown ────────────────────────────────────── */}
            <div className="result-section">
              <div className="result-section-heading">
                <h3>Budget breakdown</h3>
                <p>Deterministic estimates — the AI cannot change these numbers.</p>
              </div>
              <div className="budget-grid">
                <BudgetItem icon="🚌" label="Transport" value={tripPlan.transport} currency={tripPlan.currency} />
                <BudgetItem icon="🏨" label="Accommodation" value={tripPlan.accommodation} currency={tripPlan.currency} />
                <BudgetItem icon="🍛" label="Food" value={tripPlan.food} currency={tripPlan.currency} />
                <BudgetItem icon="🎟️" label="Activities" value={tripPlan.activities} currency={tripPlan.currency} />
                <BudgetItem icon="🚕" label="Local transport" value={tripPlan.localTransport} currency={tripPlan.currency} />
                <BudgetItem icon="🛟" label="Safety buffer" value={tripPlan.buffer} currency={tripPlan.currency} />
              </div>
            </div>

            {/* ── Nearby Places ───────────────────────────────────────── */}
            <div className="result-section">
              <div className="result-section-heading">
                <h3>📍 Nearby places</h3>
                <p>
                  {tripPlan.nearbyPlaces.length > 0
                    ? `${tripPlan.nearbyPlaces.length} places dynamically retrieved near ${tripPlan.destination}.`
                    : 'No nearby places found — Overpass API may be temporarily slow.'}
                </p>
              </div>
              {tripPlan.nearbyPlaces.length > 0 ? (
                <div className="nearby-place-list">
                  {tripPlan.nearbyPlaces.map((place) => (
                    <div
                      key={place.place_id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem 0',
                        borderBottom: '1px solid #f1f5f9',
                      }}
                    >
                      <span>📍</span>
                      <div>
                        <strong style={{ fontSize: '0.9rem' }}>{place.name}</strong>
                        <span
                          style={{
                            marginLeft: '0.5rem',
                            fontSize: '0.8rem',
                            color: '#64748b',
                          }}
                        >
                          {place.category}
                          {place.distance !== undefined ? ` · ${place.distance} km` : ''}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
                  The itinerary days note where place data was unavailable. Try planning again
                  in a few minutes if Overpass is slow.
                </p>
              )}
            </div>

            {/* ── Itinerary ───────────────────────────────────────────── */}
            <div className="result-section">
              <div className="result-section-heading">
                <h3>Day-by-day itinerary</h3>
                <p>Built from dynamically discovered places around {tripPlan.destination}.</p>
              </div>
              <div className="itinerary-list">
                {tripPlan.days.map((day) => (
                  <article key={day.day} className="itinerary-card">
                    <div className="day-number">
                      <span>DAY</span>
                      <strong>{day.day}</strong>
                    </div>
                    <div className="day-content">
                      <h4>{day.title}</h4>
                      <ul>
                        {day.activities.map((activity, idx) => (
                          <li key={`${day.day}-${idx}`}>
                            <span aria-hidden>✓</span>
                            {activity}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            {/* ── Research: Transport Options ─────────────────────────── */}
            {tripPlan.research?.intercityTransport?.options?.length ? (
              <div className="result-section">
                <div className="result-section-heading">
                  <h3>🚌 Transport Options</h3>
                  <p>
                    {tripPlan.research.hasAnyLiveData
                      ? 'Distance-based estimates from real route data.'
                      : 'Route estimates — not live booking prices.'}
                  </p>
                </div>
                <div style={{ display: 'grid', gap: '0.75rem' }}>
                  {tripPlan.research.intercityTransport.options.map((opt, i) => (
                    <div key={i} className="card" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong style={{ textTransform: 'capitalize' }}>{opt.mode.replace('_', ' ')}</strong>
                        {opt.class && <span style={{ color: '#64748b', marginLeft: '0.5rem', fontSize: '0.85rem' }}>{opt.class}</span>}
                        {opt.durationMinutes && (
                          <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                            ~{Math.floor(opt.durationMinutes / 60)}h {opt.durationMinutes % 60}m
                            {opt.distanceKm ? ` · ${opt.distanceKm} km` : ''}
                          </div>
                        )}
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                          Source: {opt.source.name} · {opt.source.sourceType}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <strong style={{ color: '#0f172a' }}>
                          {fmt(opt.priceRange.min)} – {fmt(opt.priceRange.max)}
                        </strong>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>per person</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* ── Research: Accommodation ─────────────────────────────────── */}
            {(tripPlan.research?.accommodation?.results?.length || tripPlan.research?.accommodation?.priceRange?.max) ? (
              <div className="result-section">
                <div className="result-section-heading">
                  <h3>🏨 Accommodation</h3>
                  <p>
                    {tripPlan.research!.accommodation.hasLiveData
                      ? `${tripPlan.research!.accommodation.results.length} hotels found near ${tripPlan.destination}.`
                      : 'No live hotel data — price range is an estimate from Google price_level indicators.'}
                  </p>
                </div>
                {tripPlan.research!.accommodation.results.slice(0, 6).map((h, i) => (
                  <div key={i} style={{ padding: '0.6rem 0', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                      <strong style={{ fontSize: '0.9rem' }}>{h.name}</strong>
                      {h.address && <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{h.address}</div>}
                      {h.userRating && <div style={{ fontSize: '0.8rem', color: '#f59e0b' }}>★ {h.userRating}</div>}
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '0.85rem' }}>
                      {h.pricePerNight && h.pricePerNight.max > 0 ? (
                        <>
                          <span style={{ color: '#64748b' }}>~{fmt(h.pricePerNight.min)}–{fmt(h.pricePerNight.max)}/night</span>
                          <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>indicative</div>
                        </>
                      ) : (
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Booking price unavailable</div>
                      )}
                    </div>
                  </div>
                ))}
                {tripPlan.research!.accommodation.priceRange.max > 0 ? (
                  <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#f8fafc', borderRadius: '0.5rem' }}>
                    <strong>Range: </strong>
                    {fmt(tripPlan.research!.accommodation.priceRange.min)} – {fmt(tripPlan.research!.accommodation.priceRange.max)} per night
                    <span style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: '0.5rem' }}>
                      (from provider data)
                    </span>
                  </div>
                ) : (
                  <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#f8fafc', borderRadius: '0.5rem', fontSize: '0.8rem', color: '#64748b' }}>
                    Live booking prices are unavailable from OpenStreetMap. An estimated accommodation allowance is calculated in the budget breakdown.
                  </div>
                )}
              </div>
            ) : null}

            {/* ── Research: Food ──────────────────────────────────────────── */}
            {tripPlan.research?.food?.hasLiveData ? (
              <div className="result-section">
                <div className="result-section-heading">
                  <h3>🍽️ Food & Restaurants</h3>
                  <p>Restaurants near {tripPlan.destination} from OpenStreetMap.</p>
                </div>
                {tripPlan.research.food.restaurants.slice(0, 6).map((r, i) => (
                  <div key={i} style={{ padding: '0.6rem 0', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                      <strong style={{ fontSize: '0.9rem' }}>{r.name}</strong>
                      {r.address && <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{r.address}</div>}
                      {r.cuisine && <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{r.cuisine}</div>}
                      {r.userRating && <div style={{ fontSize: '0.8rem', color: '#f59e0b' }}>★ {r.userRating}</div>}
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '0.85rem', color: '#64748b' }}>
                      {r.priceLevel ? '₹'.repeat(r.priceLevel) : <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Menu price unavailable</span>}
                    </div>
                  </div>
                ))}
                {tripPlan.research.food.dailyCostPerPerson.max > 0 ? (
                  <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#f8fafc', borderRadius: '0.5rem' }}>
                    <strong>Est. daily food cost per person: </strong>
                    {fmt(tripPlan.research.food.dailyCostPerPerson.min)} – {fmt(tripPlan.research.food.dailyCostPerPerson.max)}
                  </div>
                ) : (
                  <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#f8fafc', borderRadius: '0.5rem', fontSize: '0.8rem', color: '#64748b' }}>
                    Restaurant discovery provided by OpenStreetMap. Menu prices are not published; an estimated daily food allowance is included in the budget breakdown.
                  </div>
                )}
              </div>
            ) : null}

            {/* ── Research: Weather ───────────────────────────────────────── */}
            {tripPlan.research?.weather?.available ? (
              <div className="result-section">
                <div className="result-section-heading">
                  <h3>🌦️ Weather</h3>
                  <p>Live weather data from Open-Meteo.</p>
                </div>
                {tripPlan.research.weather.current && (
                  <div style={{ padding: '0.75rem', background: '#f0f9ff', borderRadius: '0.5rem', marginBottom: '0.75rem' }}>
                    <strong>Current: </strong>
                    {tripPlan.research.weather.current.tempC}°C · {tripPlan.research.weather.current.description} ·
                    Humidity {tripPlan.research.weather.current.humidity}% · Wind {tripPlan.research.weather.current.windKph} km/h
                  </div>
                )}
                {tripPlan.research.weather.forecast.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {tripPlan.research.weather.forecast.slice(0, numericDays).map((day) => (
                      <div key={day.date} style={{ padding: '0.5rem 0.75rem', background: '#f8fafc', borderRadius: '0.5rem', fontSize: '0.8rem', minWidth: '120px' }}>
                        <div style={{ fontWeight: 600 }}>{day.date}</div>
                        <div>{day.tempMinC}° – {day.tempMaxC}°C</div>
                        <div style={{ color: '#64748b' }}>{day.description}</div>
                        {day.rainProbability !== undefined && (
                          <div style={{ color: '#3b82f6' }}>🌧 {day.rainProbability}%</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {/* ── Research Budget (min/est/max) ────────────────────────────── */}
            {tripPlan.researchBudget && (
              <div className="result-section">
                <div className="result-section-heading">
                  <h3>📊 Research-Based Cost Estimate</h3>
                  <p>Calculated from provider data &amp; distance models. Sources shown per line.</p>
                </div>
                <div style={{ background: '#f8fafc', borderRadius: '0.75rem', padding: '1.25rem' }}>
                  {[
                    { label: '🏨 Accommodation', item: tripPlan.researchBudget.accommodation },
                    { label: '🍽️ Food', item: tripPlan.researchBudget.food },
                    { label: '🚌 Transport', item: tripPlan.researchBudget.intercityTransport },
                    { label: '🚕 Local transport', item: tripPlan.researchBudget.localTransport },
                    { label: '🎟️ Activities', item: tripPlan.researchBudget.activities },
                    { label: '🛡️ Buffer', item: tripPlan.researchBudget.buffer },
                  ].map(({ label, item }) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid #e2e8f0', fontSize: '0.9rem' }}>
                      <span>{label}</span>
                      <div style={{ textAlign: 'right' }}>
                        <strong>{fmt(item.lineTotal)}</strong>
                        {'isLiveData' in item && (
                          <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', color: item.isLiveData ? '#16a34a' : '#94a3b8' }}>
                            {item.isLiveData ? '● live quote' : '○ estimate'}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Known vs Estimated Provenance Breakdown */}
                  <div style={{ marginTop: '0.75rem', padding: '0.6rem 0.75rem', background: '#f1f5f9', borderRadius: '0.5rem', fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between' }}>
                    <span><strong>Known Provider Cost:</strong> {fmt(tripPlan.researchBudget.knownCost ?? 0)}</span>
                    <span><strong>Estimated Cost:</strong> {fmt(tripPlan.researchBudget.estimatedCost ?? tripPlan.researchBudget.total)}</span>
                  </div>

                  {Boolean(tripPlan.researchBudget.unavailableCosts && tripPlan.researchBudget.unavailableCosts.length > 0) && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#64748b' }}>
                      <em>Unavailable live quotes:</em> {tripPlan.researchBudget.unavailableCosts!.join(' · ')}
                    </div>
                  )}

                  <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', textAlign: 'center' }}>
                    <div style={{ background: '#ecfdf5', borderRadius: '0.5rem', padding: '0.75rem' }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Minimum</div>
                      <strong style={{ color: '#16a34a' }}>{fmt(tripPlan.researchBudget.minimum)}</strong>
                    </div>
                    <div style={{ background: '#eff6ff', borderRadius: '0.5rem', padding: '0.75rem' }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Estimated</div>
                      <strong style={{ color: '#2563eb' }}>{fmt(tripPlan.researchBudget.total)}</strong>
                    </div>
                    <div style={{ background: '#fff7ed', borderRadius: '0.5rem', padding: '0.75rem' }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Maximum</div>
                      <strong style={{ color: '#ea580c' }}>{fmt(tripPlan.researchBudget.maximum)}</strong>
                    </div>
                  </div>
                  <div style={{ marginTop: '0.75rem', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', textAlign: 'center', fontSize: '0.8rem' }}>
                    <div>
                      <div style={{ color: '#64748b' }}>Per person</div>
                      <strong>{fmt(tripPlan.researchBudget.perPerson)}</strong>
                    </div>
                    <div>
                      <div style={{ color: '#64748b' }}>Per day</div>
                      <strong>{fmt(tripPlan.researchBudget.perDay)}</strong>
                    </div>
                    <div>
                      <div style={{ color: '#64748b' }}>Per person/day</div>
                      <strong>{fmt(tripPlan.researchBudget.perPersonPerDay)}</strong>
                    </div>
                  </div>
                </div>
                <details style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: '#64748b' }}>
                  <summary style={{ cursor: 'pointer' }}>Show calculation breakdown</summary>
                  <pre style={{ marginTop: '0.5rem', whiteSpace: 'pre-wrap', background: '#f1f5f9', padding: '0.75rem', borderRadius: '0.5rem' }}>
                    {tripPlan.researchBudget.breakdown}
                  </pre>
                </details>
              </div>
            )}

            {/* ── Agent Pipeline Trace ────────────────────────────────── */}
            {tripPlan.agent?.steps && tripPlan.agent.steps.length > 0 && (
              <div className="planning-pipeline">
                <div className="result-section-heading">
                  <h3>How this plan was built</h3>
                  <p>Every step is traceable — no black-box AI decisions.</p>
                </div>
                <div className="pipeline-trace">
                  {tripPlan.agent.steps.map((step, idx) => (
                    <div key={step.tool} className="pipeline-trace-item">
                      <span className="pipeline-trace-number">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <div>
                        <strong>
                          {step.tool}
                          <span
                            style={{
                              marginLeft: '0.5rem',
                              fontSize: '0.75rem',
                              color: step.status === 'completed' ? '#16a34a' : '#9ca3af',
                            }}
                          >
                            [{step.status}]
                          </span>
                        </strong>
                        <span>{step.summary}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Disclaimer ──────────────────────────────────────────── */}
            <div className="demo-notice">
              <strong>Data sources:</strong> Tourist places from Google Places / OpenStreetMap.
              Hotel &amp; food prices are indicative estimates from Google price_level indicators — not live booking prices.
              Transport fares are distance-based estimates — not live bus/train/flight tickets.
              Always verify prices with official providers before booking.
              <br />
              <span style={{ fontSize: '0.8rem' }}>Place data © OpenStreetMap contributors (ODbL).</span>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default function PlannerPage() {
  return (
    <Suspense fallback={<div className="container planner-page" />}>
      <PlannerPageContent />
    </Suspense>
  );
}

function BudgetItem({
  icon,
  label,
  value,
  currency = 'INR',
}: {
  icon: string;
  label: string;
  value: number;
  currency?: string;
}) {
  return (
    <div className="budget-item">
      <span className="budget-icon" aria-hidden>{icon}</span>
      <div>
        <span>{label}</span>
        <strong>
          {new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency,
            maximumFractionDigits: 0,
          }).format(value)}
        </strong>
      </div>
    </div>
  );
}
