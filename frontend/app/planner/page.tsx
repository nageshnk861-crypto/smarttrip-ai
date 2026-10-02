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

type TravelStyle = 'Budget' | 'Comfort' | 'Premium';

type TransportMode = 'bus' | 'train' | 'flight' | 'taxi' | 'car';

type PlaceItem = {
  id?: string;
  placeId?: string;
  place_id?: string;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  city?: string;
  state?: string;
  country?: string;
  distanceKm?: number;
  distance?: number;
  source?: any;
  pricePerNight?: number;
  amenities?: string[];
  cuisine?: string;
  specialty?: string;
  address?: string;
  mealCostPerPerson?: number;
};

type ItinerarySlot = {
  activity: string;
  place?: PlaceItem;
};

type DailyItineraryDay = {
  dayNumber: number;
  title: string;
  theme?: string;
  morning: ItinerarySlot | string;
  afternoon: ItinerarySlot | string;
  evening: ItinerarySlot | string;
  places?: PlaceItem[];
  hotel?: PlaceItem;
  meals?: {
    lunch?: { name: string; cuisine?: string; distanceKm?: number; specialty?: string };
    dinner?: { name: string; cuisine?: string; distanceKm?: number; specialty?: string };
  };
  transitTip?: string;
  estimatedCost?: number;
};

type TransitScheduleItem = {
  mode: string;
  name: string;
  operator?: string;
  departureTimes: string[];
  frequency: string;
  duration: string;
  estimatedFare: string;
  boardingPoint: string;
  droppingPoint: string;
  type?: string;
};

type TransitStationInfo = {
  name: string;
  type: string;
  distanceKm: number;
  city?: string;
  address?: string;
};

type TransitGuide = {
  selectedMode: string;
  summary: string;
  originStation?: string;
  destinationStation?: string;
  nearestBusStand?: TransitStationInfo;
  nearestRailwayStation?: TransitStationInfo;
  schedules: TransitScheduleItem[];
  howToTravelSteps: string[];
  localTransitTips: string[];
};

type TripPlan = {
  destination: string;
  startLocation?: string;
  startDate?: string;
  endDate?: string;
  numberOfDays?: number;
  travelers?: number;
  budget: number | { total: number; remaining: number; currency: string };
  interests?: string[];
  transport?: {
    mode?: string;
    description?: string;
    estimatedCost?: number;
    distanceKm?: number;
    durationMinutes?: number;
    options?: Array<{
      mode: string;
      class?: string;
      priceRange: { min: number; max: number; currency: string };
      durationMinutes?: number;
      distanceKm?: number;
      source?: { name: string; sourceType: string };
    }>;
  };
  transitGuide?: TransitGuide;
  hotels?: PlaceItem[];
  restaurants?: PlaceItem[];
  foodSpots?: PlaceItem[];
  weather?: {
    available: boolean;
    message?: string;
    current?: {
      tempC: number;
      feelsLikeC: number;
      humidity: number;
      windKph: number;
      description: string;
      icon: string;
    };
    forecast?: Array<{
      date: string;
      tempMinC: number;
      tempMaxC: number;
      description: string;
      rainProbability?: number;
    }>;
  };
  places?: PlaceItem[];
  dailyItinerary?: DailyItineraryDay[];
  budgetBreakdown?: {
    transport: number;
    hotel: number;
    food: number;
    activities: number;
    localTransport: number;
    buffer: number;
    estimatedTotal: number;
    remainingBudget: number;
    currency: string;
    isLivePrice: boolean;
    daily: number;
  };
  // Compatibility
  days?: number;
  itinerary?: DailyItineraryDay[];
  nearbyPlaces?: PlaceItem[];
  currency?: string;
  totalCost?: number;
  remaining?: number;
  transportCost?: number;
  accommodation?: number;
  food?: number;
  activities?: number;
  localTransport?: number;
  buffer?: number;
};

function formatCurrency(amount: number, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getCategoryIcon(cat: string = '') {
  switch (cat.toLowerCase()) {
    case 'beach': return '🏖️';
    case 'temple': return '🛕';
    case 'cafe': return '☕';
    case 'viewpoint': return '🌄';
    case 'museum': return '🏛️';
    case 'hotel': return '🏨';
    case 'attraction': return '🎡';
    default: return '📍';
  }
}

function PlannerPageContent() {
  const searchParams = useSearchParams();
  const parsedPrompt = parseTripPrompt(searchParams.get('prompt') ?? '');
  const initialInterests = Array.isArray(parsedPrompt.interests)
    ? parsedPrompt.interests
    : ['Beach', 'Cafe', 'Attraction'];

  const [destination, setDestination] = useState(
    typeof parsedPrompt.destination === 'string' ? parsedPrompt.destination : '',
  );

  const promptOriginName =
    typeof parsedPrompt.origin === 'string' ? (parsedPrompt.origin as string).trim() : '';

  const [origin, setOrigin] = useState<OriginLocation>({
    name: promptOriginName || 'Bengaluru',
    source: 'manual',
  });

  const startingLocation = origin.name;
  const [selectedPlace, setSelectedPlace] = useState<PlaceDetails | null>(null);

  const [startDate, setStartDate] = useState(
    new Date().toISOString().split('T')[0],
  );

  const [budget, setBudget] = useState(
    typeof parsedPrompt.budget === 'number'
      ? String(parsedPrompt.budget)
      : String(DEFAULT_BUDGET_AMOUNT || 20000),
  );
  const [days, setDays] = useState(
    typeof parsedPrompt.days === 'number'
      ? String(parsedPrompt.days)
      : String(DEFAULT_TRIP_DAYS || 3),
  );
  const [travelers, setTravelers] = useState(
    typeof parsedPrompt.travelers === 'number'
      ? String(parsedPrompt.travelers)
      : String(DEFAULT_TRIP_TRAVELERS || 2),
  );
  const [interests, setInterests] = useState<string[]>(initialInterests);
  const [transportMode, setTransportMode] = useState<TransportMode>('bus');
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

    const start = startingLocation.trim();
    const dest = (destination || selectedPlace?.name || selectedPlace?.description || '').trim();

    if (!start) {
      setError('Please enter your starting location.');
      return;
    }
    if (!dest) {
      setError('Please enter a destination.');
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
          origin: start,
          startLocation: start,
          originLatitude: origin.source === 'browser-geolocation' ? origin.latitude : undefined,
          originLongitude: origin.source === 'browser-geolocation' ? origin.longitude : undefined,
          destination: dest,
          latitude: selectedPlace?.latitude,
          longitude: selectedPlace?.longitude,
          boundingBox: selectedPlace?.boundingBox ?? undefined,
          osmType: selectedPlace?.osmType ?? undefined,
          city: selectedPlace?.city,
          state: selectedPlace?.state,
          country: selectedPlace?.country,
          budget: numericBudget,
          days: numericDays,
          numberOfDays: numericDays,
          travelers: numericTravelers,
          interests,
          transport: transportMode,
          transportMode,
          startDate,
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
          destination: tripPlan.destination,
          latitude: selectedPlace?.latitude,
          longitude: selectedPlace?.longitude,
          budget: numericBudget,
          days: numericDays,
          travelers: numericTravelers,
          interests,
          travelStyle,
          plan_data: tripPlan,
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

  const fmt = (n: number) => formatCurrency(n, 'INR');

  const allPlaces = tripPlan?.places || tripPlan?.nearbyPlaces || [];
  const itineraryDays = tripPlan?.dailyItinerary || tripPlan?.itinerary || [];
  const budgetData = tripPlan?.budgetBreakdown;

  return (
    <div className="planner-page">
      <div className="container">

        {/* ── HERO ──────────────────────────────────────────────────────── */}
        <section className="planner-hero">
          <div>
            <div className="planner-badge">✨ SMARTTRIP AI PLANNER (PHASE 3)</div>
            <h1 className="page-title">
              Plan your perfect trip
              <br />
              <span className="planner-highlight">with real places &amp; live weather.</span>
            </h1>
            <p className="page-subtitle">
              Connected directly to OpenStreetMap &amp; 7 verified place categories.
              Get deterministic, budget-aware day-by-day itineraries tailored to your interests.
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
                <p>Starting location, destination, duration, budget &amp; interests.</p>
              </div>
            </div>

            <form onSubmit={handleSubmit}>

              {/* Starting location */}
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
                    }
                  }}
                  placeholder="Search destination (e.g. Goa, Tamilnadu, Jaipur)…"
                />
                {selectedPlace?.latitude !== undefined ? (
                  <span className="input-help" style={{ color: '#16a34a' }}>
                    ✓ {selectedPlace.displayName ?? selectedPlace.description} —{' '}
                    {selectedPlace.latitude.toFixed(4)}, {selectedPlace.longitude?.toFixed(4)}
                  </span>
                ) : (
                  <span className="input-help">
                    Type to search or type a destination name directly (e.g. Goa).
                  </span>
                )}
              </div>

              {/* Start Date + Days */}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="startDate">
                    Start Date
                  </label>
                  <input
                    id="startDate"
                    type="date"
                    className="form-input"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
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

              {/* Budget + Travelers */}
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
                </div>

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
                </div>
              </div>

              {/* Transport mode */}
              <div className="form-group">
                <label className="form-label">Preferred Transport</label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {[
                    { mode: 'bus' as TransportMode, label: '🚌 Bus' },
                    { mode: 'train' as TransportMode, label: '🚆 Train' },
                    { mode: 'flight' as TransportMode, label: '✈️ Flight' },
                    { mode: 'taxi' as TransportMode, label: '🚕 Cab / Taxi' },
                    { mode: 'car' as TransportMode, label: '🚗 Car' },
                  ].map((t) => (
                    <button
                      key={t.mode}
                      type="button"
                      className={`interest-chip ${transportMode === t.mode ? 'selected' : ''}`}
                      onClick={() => setTransportMode(t.mode)}
                      aria-pressed={transportMode === t.mode}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Interests (7 Categories supported) */}
              <div className="form-group">
                <label className="form-label">Select Your Interests (7 Categories Supported)</label>
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
                        {style === 'Budget' && 'Maximum value, smart savings'}
                        {style === 'Comfort' && 'Balanced comfort and budget'}
                        {style === 'Premium' && 'Premium stays and experiences'}
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
                  <>✨ PLAN TRIP</>
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
                  <h2>Trip Summary</h2>
                  <p>Your inputs for itinerary generation.</p>
                </div>
              </div>
              <div className="consider-list">
                <div>
                  <span>📍</span>
                  <p>
                    <strong>Starting point</strong>
                    {startingLocation || 'Bengaluru'}
                  </p>
                </div>
                <div>
                  <span>🗺️</span>
                  <p>
                    <strong>Destination</strong>
                    {selectedPlace
                      ? (selectedPlace.displayName ?? selectedPlace.description)
                      : destination || 'Goa'}
                  </p>
                </div>
                <div>
                  <span>📅</span>
                  <p>
                    <strong>Dates &amp; Duration</strong>
                    {startDate} · {numericDays || 3} days
                  </p>
                </div>
                <div>
                  <span>🚌</span>
                  <p>
                    <strong>Transport</strong>
                    {transportMode.toUpperCase()}
                  </p>
                </div>
                <div>
                  <span>👥</span>
                  <p>
                    <strong>Travelers</strong>
                    {numericTravelers || 2} people
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
                  <span>❤️</span>
                  <p>
                    <strong>Interests</strong>
                    {interests.length ? interests.join(', ') : 'Beach, Cafe, Attraction'}
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
              <h3>Phase 3 Connected Engine</h3>
              <p>
                Connected to 7 GeoJSON categories (Temples, Beaches, Attractions,
                Viewpoints, Cafes, Hotels, Museums), Open-Meteo Live Weather,
                and Distance-based Fare Estimator.
              </p>
            </div>
          </aside>
        </section>

        {/* ── TRIP RESULT ───────────────────────────────────────────────── */}
        {tripPlan && (
          <section className="trip-result" style={{ marginTop: '2.5rem' }}>

            {/* 1. Trip Summary */}
            <div className="result-header" style={{ marginBottom: '1.5rem' }}>
              <div>
                <div className="planner-badge">✨ TRIP PLAN READY</div>
                <h2>
                  {tripPlan.startLocation || startingLocation} → {tripPlan.destination}
                </h2>
                <p style={{ fontSize: '1.05rem', color: '#475569', marginTop: '0.35rem' }}>
                  📅 <strong>Dates:</strong> {tripPlan.startDate} to {tripPlan.endDate} ({tripPlan.numberOfDays || numericDays} days) · 👥 <strong>Travelers:</strong> {tripPlan.travelers || numericTravelers} · 💰 <strong>Budget:</strong> {fmt(typeof tripPlan.budget === 'number' ? tripPlan.budget : numericBudget)} · 🚌 <strong>Transport:</strong> {tripPlan.transport?.mode?.toUpperCase() || transportMode.toUpperCase()}
                </p>
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
                style={{ color: saveMessage.startsWith('✓') ? '#16a34a' : '#dc2626', marginBottom: '1rem' }}
              >
                {saveMessage}
              </p>
            )}

            {/* 2. Weather Section */}
            <div className="result-section">
              <div className="result-section-heading">
                <h3>🌦️ Weather</h3>
                <p>Daily forecast for your travel dates in {tripPlan.destination}.</p>
              </div>

              {tripPlan.weather?.available ? (
                <div>
                  {tripPlan.weather.current && (
                    <div style={{ padding: '0.85rem 1rem', background: '#f0f9ff', borderRadius: '0.5rem', marginBottom: '0.75rem', border: '1px solid #bae6fd' }}>
                      <strong>Current Weather in {tripPlan.destination}: </strong>
                      {tripPlan.weather.current.tempC}°C · {tripPlan.weather.current.description} ·
                      Humidity {tripPlan.weather.current.humidity}% · Wind {tripPlan.weather.current.windKph} km/h
                    </div>
                  )}
                  {tripPlan.weather.forecast && tripPlan.weather.forecast.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
                      {tripPlan.weather.forecast.slice(0, numericDays).map((day, idx) => (
                        <div key={day.date || idx} className="card" style={{ padding: '0.85rem', textAlign: 'center' }}>
                          <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Day {idx + 1}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{day.date}</div>
                          <div style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0.35rem 0', color: '#0f172a' }}>
                            {day.tempMinC}° – {day.tempMaxC}°C
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#475569' }}>{day.description}</div>
                          {day.rainProbability !== undefined && (
                            <div style={{ fontSize: '0.75rem', color: '#2563eb', marginTop: '0.2rem' }}>
                              🌧 {day.rainProbability}% rain
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ padding: '0.85rem 1rem', background: '#fffbeb', borderRadius: '0.5rem', color: '#b45309', border: '1px solid #fde68a' }}>
                  Weather information temporarily unavailable.
                </div>
              )}
            </div>

            {/* 2. Transit Guide & Bus/Train Schedules */}
            <div className="result-section">
              <div className="result-section-heading">
                <h3>🚌 / 🚆 How to Reach &amp; Transit Schedules</h3>
                <p>Departure timings, nearest bus stands, railway stations &amp; travel guide from {tripPlan.startLocation || startingLocation} to {tripPlan.destination}.</p>
              </div>

              {tripPlan.transitGuide ? (
                <div style={{ display: 'grid', gap: '1rem' }}>
                  {/* Nearest Bus Stand & Railway Station Badges */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem' }}>
                    {tripPlan.transitGuide.nearestBusStand && (
                      <div className="card" style={{ padding: '0.85rem 1rem', borderLeft: '4px solid #f59e0b', background: '#fffdfa' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                          <span style={{ fontSize: '1.25rem' }}>🚏</span>
                          <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>Nearest Bus Station / Terminal</strong>
                        </div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#b45309' }}>
                          {tripPlan.transitGuide.nearestBusStand.name}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem' }}>
                          📍 {tripPlan.transitGuide.nearestBusStand.distanceKm} km from city center · {tripPlan.transitGuide.nearestBusStand.address || tripPlan.destination}
                        </div>
                      </div>
                    )}

                    {tripPlan.transitGuide.nearestRailwayStation && (
                      <div className="card" style={{ padding: '0.85rem 1rem', borderLeft: '4px solid #2563eb', background: '#f8faff' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                          <span style={{ fontSize: '1.25rem' }}>🚆</span>
                          <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>Nearest Railway Station</strong>
                        </div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1d4ed8' }}>
                          {tripPlan.transitGuide.nearestRailwayStation.name}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem' }}>
                          📍 {tripPlan.transitGuide.nearestRailwayStation.distanceKm} km from destination center · {tripPlan.transitGuide.nearestRailwayStation.address || tripPlan.destination}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Bus & Train Timetables */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
                    {tripPlan.transitGuide.schedules.map((item, sIdx) => (
                      <div key={sIdx} className="card" style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <span style={{ fontSize: '1.2rem' }}>{item.mode === 'bus' ? '🚌' : item.mode === 'train' ? '🚆' : item.mode === 'flight' ? '✈️' : '🚕'}</span>
                              <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>{item.name}</strong>
                            </div>
                            {item.operator && (
                              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.15rem' }}>
                                Operator: {item.operator}
                              </div>
                            )}
                          </div>
                          <span className="planner-badge" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}>
                            {item.estimatedFare}
                          </span>
                        </div>

                        <div style={{ fontSize: '0.82rem', color: '#334155', background: '#f8fafc', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', margin: '0.5rem 0' }}>
                          ⏱️ <strong>Frequency:</strong> {item.frequency} · <strong>Duration:</strong> {item.duration}
                        </div>

                        <div style={{ marginTop: '0.5rem' }}>
                          <strong style={{ fontSize: '0.8rem', color: '#475569' }}>🕒 Available Departure Timings:</strong>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.35rem' }}>
                            {item.departureTimes.map((time, tIdx) => (
                              <span key={tIdx} style={{ fontSize: '0.75rem', background: '#f1f5f9', color: '#1e293b', padding: '0.2rem 0.45rem', borderRadius: '0.25rem', border: '1px solid #cbd5e1' }}>
                                {time}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.75rem', fontSize: '0.78rem', color: '#64748b', borderTop: '1px solid #f1f5f9', paddingTop: '0.5rem' }}>
                          <div>
                            <strong>Boarding:</strong> {item.boardingPoint}
                          </div>
                          <div>
                            <strong>Dropping:</strong> {item.droppingPoint}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Step-by-Step Directions */}
                  <div className="card" style={{ padding: '1rem', background: '#faf5ff', border: '1px solid #e9d5ff' }}>
                    <strong style={{ fontSize: '0.9rem', color: '#6b21a8' }}>🧭 Step-by-Step Travel Route:</strong>
                    <ul style={{ margin: '0.4rem 0 0 1.2rem', padding: 0, fontSize: '0.85rem', color: '#475569', lineHeight: 1.6 }}>
                      {tripPlan.transitGuide.howToTravelSteps.map((step, idx) => (
                        <li key={idx}>{step}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '0.85rem 1rem', background: '#f0f9ff', borderRadius: '0.5rem', color: '#0369a1', border: '1px solid #bae6fd' }}>
                  🚌 Regular express buses depart every 30-45 minutes from {tripPlan.startLocation || startingLocation} Central Bus Stand to {tripPlan.destination}. Daily superfast trains and intercity cabs are also available.
                </div>
              )}
            </div>

            {/* 3. Recommended Hotels & Stays */}
            <div className="result-section">
              <div className="result-section-heading">
                <h3>🏨 Recommended Hotels &amp; Accommodations ({tripPlan.hotels?.length || 0} Stays Available)</h3>
                <p>Verified stays, resorts &amp; hotels nearby {tripPlan.destination}.</p>
              </div>

              {tripPlan.hotels && tripPlan.hotels.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.85rem' }}>
                  {tripPlan.hotels.slice(0, 8).map((hotel, idx) => (
                    <div key={hotel.id || idx} className="card" style={{ padding: '1rem', borderTop: '3px solid #0284c7' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
                        <span style={{ fontSize: '1.3rem' }}>🏨</span>
                        <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>{hotel.name}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#64748b', marginTop: '0.25rem' }}>
                        <span>📍 {hotel.distanceKm !== undefined ? `${hotel.distanceKm} km from center` : hotel.city || tripPlan.destination}</span>
                        <span style={{ fontWeight: 600, color: '#16a34a' }}>
                          ₹{(hotel.pricePerNight || 1200 + (idx * 250)).toLocaleString()} / night
                        </span>
                      </div>
                      {hotel.address && (
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.35rem' }}>
                          {hotel.address}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                        {(hotel.amenities || ['WiFi', 'AC Room', 'Room Service', '24/7 Desk']).slice(0, 3).map((am, aIdx) => (
                          <span key={aIdx} style={{ fontSize: '0.72rem', background: '#f0f9ff', color: '#0369a1', padding: '0.15rem 0.4rem', borderRadius: '0.25rem' }}>
                            ✓ {am}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: '#64748b' }}>Finding hotels nearby {tripPlan.destination}…</p>
              )}
            </div>

            {/* 4. Best Local Food & Dining Spots */}
            <div className="result-section">
              <div className="result-section-heading">
                <h3>🍛 Best Local Food, Cafes &amp; Restaurants ({tripPlan.restaurants?.length || tripPlan.foodSpots?.length || 0} Spots Available)</h3>
                <p>Authentic cuisine, regional dining &amp; popular food spots in {tripPlan.destination}.</p>
              </div>

              {(tripPlan.restaurants || tripPlan.foodSpots) && (tripPlan.restaurants?.length || tripPlan.foodSpots?.length || 0) > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.85rem' }}>
                  {(tripPlan.restaurants || tripPlan.foodSpots || []).slice(0, 8).map((food, idx) => (
                    <div key={food.id || idx} className="card" style={{ padding: '1rem', borderTop: '3px solid #f59e0b' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
                        <span style={{ fontSize: '1.3rem' }}>🍽️</span>
                        <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>{food.name}</strong>
                      </div>
                      <div style={{ fontSize: '0.82rem', color: '#b45309', fontWeight: 600, marginTop: '0.2rem' }}>
                        {food.cuisine || food.specialty || 'Authentic Regional & Indian Specialties'}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748b', marginTop: '0.35rem' }}>
                        <span>📍 {food.distanceKm !== undefined ? `${food.distanceKm} km away` : food.city || tripPlan.destination}</span>
                        <span style={{ fontWeight: 600, color: '#334155' }}>
                          ~₹{(food.mealCostPerPerson || 200 + (idx * 50)).toLocaleString()} / person
                        </span>
                      </div>
                      {food.address && (
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.3rem' }}>
                          {food.address}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: '#64748b' }}>Finding dining spots nearby {tripPlan.destination}…</p>
              )}
            </div>

            {/* 5. Recommended Places */}
            <div className="result-section">
              <div className="result-section-heading">
                <h3>📍 Sightseeing Places &amp; Attractions ({allPlaces.length} Found)</h3>
                <p>Nearby places retrieved across your selected interest categories.</p>
              </div>

              {allPlaces.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.75rem' }}>
                  {allPlaces.slice(0, 15).map((place, idx) => (
                    <div key={place.id || place.placeId || place.place_id || idx} className="card" style={{ padding: '0.85rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                        <span style={{ fontSize: '1.25rem' }}>{getCategoryIcon(place.category)}</span>
                        <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>{place.name}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748b' }}>
                        <span style={{ textTransform: 'capitalize' }}>{place.category}</span>
                        <span>
                          {place.distanceKm !== undefined ? `${place.distanceKm} km` : place.distance !== undefined ? `${place.distance} km` : ''}
                        </span>
                      </div>
                      {place.city && (
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                          📍 {place.city}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: '#64748b' }}>No places found for this search radius.</p>
              )}
            </div>

            {/* 6. Day-by-Day Itinerary */}
            <div className="result-section">
              <div className="result-section-heading">
                <h3>🗓️ Day-by-Day Itinerary (With Hotels, Food &amp; Transit)</h3>
                <p>Deterministic, distance-clustered itinerary for {tripPlan.destination}.</p>
              </div>

              <div className="itinerary-list">
                {itineraryDays.map((day: any, idx: number) => {
                  const dayNum = day.dayNumber || day.day || idx + 1;
                  const morningText = typeof day.morning === 'object' ? day.morning.activity : day.morning;
                  const afternoonText = typeof day.afternoon === 'object' ? day.afternoon.activity : day.afternoon;
                  const eveningText = typeof day.evening === 'object' ? day.evening.activity : day.evening;

                  return (
                    <article key={dayNum} className="itinerary-card" style={{ marginBottom: '1.25rem' }}>
                      <div className="day-number">
                        <span>DAY</span>
                        <strong>{dayNum}</strong>
                      </div>
                      <div className="day-content" style={{ flex: 1 }}>
                        <h4 style={{ fontSize: '1.1rem', marginBottom: '0.75rem', color: '#0f172a' }}>
                          {day.title || `Day ${dayNum} in ${tripPlan.destination}`}
                        </h4>

                        <div style={{ display: 'grid', gap: '0.6rem' }}>
                          <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '0.5rem', borderLeft: '3px solid #f59e0b' }}>
                            <strong style={{ fontSize: '0.85rem', color: '#b45309' }}>🌅 MORNING</strong>
                            <p style={{ fontSize: '0.9rem', color: '#334155', margin: '0.25rem 0 0' }}>{morningText}</p>
                          </div>

                          <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '0.5rem', borderLeft: '3px solid #0284c7' }}>
                            <strong style={{ fontSize: '0.85rem', color: '#0369a1' }}>☀️ AFTERNOON</strong>
                            <p style={{ fontSize: '0.9rem', color: '#334155', margin: '0.25rem 0 0' }}>{afternoonText}</p>
                          </div>

                          <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '0.5rem', borderLeft: '3px solid #7c3aed' }}>
                            <strong style={{ fontSize: '0.85rem', color: '#6d28d9' }}>🌆 EVENING</strong>
                            <p style={{ fontSize: '0.9rem', color: '#334155', margin: '0.25rem 0 0' }}>{eveningText}</p>
                          </div>

                          {/* Hotel & Food Highlights for this day */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.5rem', marginTop: '0.35rem' }}>
                            {day.hotel && (
                              <div style={{ background: '#eff6ff', padding: '0.6rem 0.75rem', borderRadius: '0.375rem', fontSize: '0.82rem', border: '1px solid #bfdbfe' }}>
                                <strong style={{ color: '#1d4ed8' }}>🏨 Night Stay: </strong>
                                <span style={{ color: '#1e293b' }}>{day.hotel.name}</span>
                              </div>
                            )}

                            {day.meals && (
                              <div style={{ background: '#fffbeb', padding: '0.6rem 0.75rem', borderRadius: '0.375rem', fontSize: '0.82rem', border: '1px solid #fde68a' }}>
                                <strong style={{ color: '#b45309' }}>🍽️ Where to Eat: </strong>
                                <span style={{ color: '#1e293b' }}>
                                  Lunch at {day.meals.lunch?.name || 'Local Eatery'} · Dinner at {day.meals.dinner?.name || 'Heritage Dining'}
                                </span>
                              </div>
                            )}
                          </div>

                          {day.transitTip && (
                            <div style={{ fontSize: '0.78rem', color: '#64748b', background: '#f1f5f9', padding: '0.45rem 0.65rem', borderRadius: '0.25rem' }}>
                              🚏 <strong>Transit Tip:</strong> {day.transitTip}
                            </div>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>

            {/* 7. Budget Breakdown */}
            <div className="result-section">
              <div className="result-section-heading">
                <h3>💰 Budget Breakdown</h3>
                <p>Preliminary estimates based on distance, duration &amp; standard rates.</p>
              </div>

              {budgetData ? (
                <div className="card" style={{ padding: '1.25rem' }}>
                  {/* Bus Transport Detailed Card if transport is bus */}
                  {transportMode === 'bus' && (
                    <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', marginBottom: '1.25rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ fontSize: '1.2rem' }}>🚌</span>
                            <strong style={{ fontSize: '1rem', color: '#0f172a' }}>Bus Transport Budget</strong>
                            <span className="planner-badge" style={{ fontSize: '0.72rem', background: '#e0f2fe', color: '#0369a1', padding: '0.15rem 0.45rem' }}>
                              ESTIMATED
                            </span>
                          </div>
                          <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0.25rem 0 0' }}>
                            Planning Estimate based on distance ({tripPlan.transport?.distanceKm || 250} km) × Express/Deluxe planning rate (₹2.50/km)
                          </p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                            {fmt(budgetData.transport)}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                            Planning amount ({numericTravelers} travelers · Round trip)
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px solid #cbd5e1', fontSize: '0.8rem' }}>
                        <div>
                          <span style={{ color: '#64748b' }}>Estimated Range:</span>
                          <div style={{ fontWeight: 700, color: '#1e293b' }}>
                            {fmt(Math.round((tripPlan.transport?.distanceKm || 250) * 1.50 * numericTravelers * 2))} – {fmt(Math.round((tripPlan.transport?.distanceKm || 250) * 3.50 * numericTravelers * 2))}
                          </div>
                        </div>
                        <div>
                          <span style={{ color: '#64748b' }}>Route Distance:</span>
                          <div style={{ fontWeight: 700, color: '#1e293b' }}>{tripPlan.transport?.distanceKm || 250} km (Round trip: {(tripPlan.transport?.distanceKm || 250) * 2} km)</div>
                        </div>
                        <div>
                          <span style={{ color: '#64748b' }}>Rate Model:</span>
                          <div style={{ fontWeight: 700, color: '#1e293b' }}>₹1.50 – ₹3.50/km (Expected ₹2.50/km)</div>
                        </div>
                        <div>
                          <span style={{ color: '#64748b' }}>Source:</span>
                          <div style={{ fontWeight: 700, color: '#1e293b' }}>SmartTrip planning-rate model</div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="budget-grid">
                    <BudgetItem icon="🚌" label={`Transport (${transportMode.toUpperCase()} Round-trip)`} value={budgetData.transport} />
                    <BudgetItem icon="🏨" label="Hotel / Accommodation" value={budgetData.hotel} />
                    <BudgetItem icon="🍛" label="Food &amp; Dining" value={budgetData.food} />
                    <BudgetItem icon="🎟️" label="Activities &amp; Sightseeing" value={budgetData.activities} />
                    <BudgetItem icon="🚕" label="Local City Transport" value={budgetData.localTransport} />
                    <BudgetItem icon="🛡️" label="Contingency Buffer (8%)" value={budgetData.buffer} />
                  </div>

                  <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                      <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Estimated Total</span>
                      <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>
                        {fmt(budgetData.estimatedTotal)}
                      </div>
                    </div>

                    <div>
                      <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Your Total Budget</span>
                      <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#334155' }}>
                        {fmt(typeof tripPlan.budget === 'number' ? tripPlan.budget : numericBudget)}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Remaining Budget</span>
                      <div style={{ fontSize: '1.4rem', fontWeight: 800, color: budgetData.remainingBudget >= 0 ? '#16a34a' : '#dc2626' }}>
                        {fmt(budgetData.remainingBudget)}
                      </div>
                    </div>
                  </div>

                  {/* Estimation Label Notice */}
                  <div style={{ marginTop: '1rem', padding: '0.65rem 0.85rem', background: '#f8fafc', borderRadius: '0.5rem', fontSize: '0.8rem', color: '#64748b' }}>
                    ℹ️ <strong>Note on Pricing:</strong> All fares, hotel allowances, and activity fees are distance-based preliminary planning estimates (labelled ESTIMATED). No paid live booking quotes are queried.
                  </div>
                </div>
              ) : (
                <div className="budget-grid">
                  <BudgetItem icon="🚌" label="Transport" value={tripPlan.transportCost || 1200} />
                  <BudgetItem icon="🏨" label="Hotel" value={tripPlan.accommodation || 2400} />
                  <BudgetItem icon="🍛" label="Food" value={tripPlan.food || 2700} />
                  <BudgetItem icon="🎟️" label="Activities" value={tripPlan.activities || 1500} />
                  <BudgetItem icon="🚕" label="Local Transport" value={tripPlan.localTransport || 1200} />
                  <BudgetItem icon="🛡️" label="Buffer" value={tripPlan.buffer || 690} />
                </div>
              )}
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
