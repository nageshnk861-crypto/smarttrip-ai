'use client';

import { FormEvent, useMemo, useState } from 'react';

type TravelStyle = 'Budget' | 'Comfort' | 'Premium';

type TripPlan = {
  destination: string;
  totalCost: number;
  budget: number;
  transport: number;
  accommodation: number;
  food: number;
  activities: number;
  localTransport: number;
  buffer: number;
  days: {
    day: number;
    title: string;
    activities: string[];
  }[];
};

const interestOptions = [
  'Nature',
  'Food',
  'Beaches',
  'Mountains',
  'History',
  'Adventure',
  'Photography',
  'Shopping',
];

const destinationOptions = [
  'Goa',
  'Coorg',
  'Mysore',
  'Chikmagalur',
  'Hampi',
  'Wayanad',
];

const destinationDescriptions: Record<string, string> = {
  Goa: 'Beaches, local food, sunsets and relaxed coastal experiences.',
  Coorg: 'Coffee plantations, waterfalls, forests and peaceful nature.',
  Mysore: 'Palaces, heritage sites, local food and cultural experiences.',
  Chikmagalur: 'Mountains, coffee estates, viewpoints and nature.',
  Hampi: 'Ancient ruins, history, landscapes and photography.',
  Wayanad: 'Forests, waterfalls, wildlife and scenic mountain views.',
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function PlannerPage() {
  const [startingLocation, setStartingLocation] = useState('Bangalore');
  const [destination, setDestination] = useState('');
  const [budget, setBudget] = useState('15000');
  const [days, setDays] = useState('3');
  const [travelers, setTravelers] = useState('2');
  const [interests, setInterests] = useState<string[]>([
    'Nature',
    'Food',
  ]);
  const [travelStyle, setTravelStyle] =
    useState<TravelStyle>('Budget');

  const [isPlanning, setIsPlanning] = useState(false);
  const [tripPlan, setTripPlan] = useState<TripPlan | null>(null);
  const [error, setError] = useState('');

  const numericBudget = Number(budget) || 0;
  const numericDays = Number(days) || 0;
  const numericTravelers = Number(travelers) || 0;

  const budgetPerTraveler = useMemo(() => {
    if (!numericTravelers) return 0;

    return Math.round(numericBudget / numericTravelers);
  }, [numericBudget, numericTravelers]);

  function toggleInterest(interest: string) {
    setInterests((current) => {
      if (current.includes(interest)) {
        return current.filter((item) => item !== interest);
      }

      return [...current, interest];
    });
  }

  function chooseDestination() {
    if (destination) {
      return destination;
    }

    if (interests.includes('Beaches')) {
      return 'Goa';
    }

    if (interests.includes('Mountains')) {
      return 'Chikmagalur';
    }

    if (interests.includes('History')) {
      return 'Hampi';
    }

    if (interests.includes('Nature')) {
      return 'Coorg';
    }

    return 'Mysore';
  }

  function calculatePlan(selectedDestination: string): TripPlan {
    const styleMultiplier: Record<TravelStyle, number> = {
      Budget: 1,
      Comfort: 1.35,
      Premium: 1.8,
    };

    const multiplier = styleMultiplier[travelStyle];

    const baseTransport = 1800;
    const baseAccommodationPerDay = 1200;
    const baseFoodPerDay = 700;
    const baseActivitiesPerDay = 500;
    const baseLocalTransportPerDay = 300;

    const transport = Math.round(
      baseTransport * multiplier * Math.max(1, numericTravelers / 2)
    );

    const accommodation = Math.round(
      baseAccommodationPerDay *
        numericDays *
        multiplier *
        Math.max(1, numericTravelers / 2)
    );

    const food = Math.round(
      baseFoodPerDay *
        numericDays *
        numericTravelers *
        multiplier
    );

    const activities = Math.round(
      baseActivitiesPerDay *
        numericDays *
        numericTravelers *
        multiplier
    );

    const localTransport = Math.round(
      baseLocalTransportPerDay *
        numericDays *
        numericTravelers *
        multiplier
    );

    const subtotal =
      transport +
      accommodation +
      food +
      activities +
      localTransport;

    const buffer = Math.round(subtotal * 0.08);

    const totalCost = subtotal + buffer;

    const dayPlans = createDayPlans(selectedDestination);

    return {
      destination: selectedDestination,
      totalCost,
      budget: numericBudget,
      transport,
      accommodation,
      food,
      activities,
      localTransport,
      buffer,
      days: dayPlans,
    };
  }

  function createDayPlans(selectedDestination: string) {
    const plans: TripPlan['days'] = [];

    for (let day = 1; day <= numericDays; day++) {
      let title = '';
      let activitiesForDay: string[] = [];

      if (day === 1) {
        title = `Arrival and explore ${selectedDestination}`;

        activitiesForDay = [
          `Travel from ${startingLocation} to ${selectedDestination}`,
          'Check in to accommodation',
        ];

        if (interests.includes('Food')) {
          activitiesForDay.push(
            'Explore a popular local food area'
          );
        }

        if (interests.includes('Nature')) {
          activitiesForDay.push(
            'Visit a nearby scenic nature spot'
          );
        }

        if (interests.includes('Beaches')) {
          activitiesForDay.push(
            'Relax at a nearby beach and watch the sunset'
          );
        }
      } else if (day === numericDays) {
        title = 'Final experiences and return';

        if (interests.includes('Shopping')) {
          activitiesForDay.push(
            'Visit a local market for shopping'
          );
        }

        if (interests.includes('Food')) {
          activitiesForDay.push(
            'Have a final local breakfast or lunch'
          );
        }

        activitiesForDay.push(
          `Return from ${selectedDestination} to ${startingLocation}`
        );
      } else {
        title = `Explore ${selectedDestination}`;

        if (interests.includes('Nature')) {
          activitiesForDay.push(
            'Visit a scenic nature attraction'
          );
        }

        if (interests.includes('Mountains')) {
          activitiesForDay.push(
            'Explore mountain viewpoints and landscapes'
          );
        }

        if (interests.includes('History')) {
          activitiesForDay.push(
            'Explore a historical or cultural attraction'
          );
        }

        if (interests.includes('Adventure')) {
          activitiesForDay.push(
            'Try a suitable outdoor adventure activity'
          );
        }

        if (interests.includes('Photography')) {
          activitiesForDay.push(
            'Visit a scenic photography location'
          );
        }

        if (interests.includes('Beaches')) {
          activitiesForDay.push(
            'Spend time at a coastal location'
          );
        }

        if (interests.includes('Food')) {
          activitiesForDay.push(
            'Try recommended local cuisine'
          );
        }

        if (activitiesForDay.length === 0) {
          activitiesForDay.push(
            'Explore the destination and discover local attractions'
          );
        }
      }

      plans.push({
        day,
        title,
        activities: activitiesForDay,
      });
    }

    return plans;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError('');
    setTripPlan(null);

    if (!startingLocation.trim()) {
      setError('Please enter your starting location.');
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

    // Simulate planning work.
    await new Promise((resolve) => setTimeout(resolve, 1200));

    const selectedDestination = chooseDestination();
    const plan = calculatePlan(selectedDestination);

    setIsPlanning(false);

    if (plan.totalCost > numericBudget) {
      setError(
        `No feasible ${travelStyle.toLowerCase()} plan was generated within your current budget. Try increasing the budget, reducing the trip duration, or choosing Budget travel style.`
      );
      return;
    }

    setTripPlan(plan);
  }

  function resetPlan() {
    setTripPlan(null);
    setError('');
  }

  return (
    <div className="planner-page">
      <div className="container">
        {/* HERO */}
        <section className="planner-hero">
          <div>
            <div className="planner-badge">
              ✨ AI-POWERED TRIP PLANNER
            </div>

            <h1 className="page-title">
              Plan your perfect trip
              <br />
              <span className="planner-highlight">
                within your budget.
              </span>
            </h1>

            <p className="page-subtitle">
              Tell SmartTrip where you are starting, how much you
              want to spend, and what you love. We&apos;ll create a
              personalized trip plan.
            </p>
          </div>
        </section>

        {/* PLANNER FORM */}
        <section className="planner-layout">
          <div className="card planner-form-card">
            <div className="section-heading">
              <span className="section-icon">🧭</span>

              <div>
                <h2>Trip details</h2>
                <p>
                  Give us the information needed to plan your trip.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              {/* STARTING LOCATION */}
              <div className="form-group">
                <label className="form-label" htmlFor="startingLocation">
                  Starting location
                </label>

                <input
                  id="startingLocation"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Bangalore"
                  value={startingLocation}
                  onChange={(event) =>
                    setStartingLocation(event.target.value)
                  }
                />

                <span className="input-help">
                  Where will your journey start?
                </span>
              </div>

              {/* DESTINATION */}
              <div className="form-group">
                <label className="form-label" htmlFor="destination">
                  Destination
                </label>

                <select
                  id="destination"
                  className="form-select"
                  value={destination}
                  onChange={(event) =>
                    setDestination(event.target.value)
                  }
                >
                  <option value="">
                    ✨ Let SmartTrip choose
                  </option>

                  {destinationOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>

                <span className="input-help">
                  Leave this on &quot;Let SmartTrip choose&quot; to get
                  an automatic recommendation.
                </span>
              </div>

              {/* BUDGET + DAYS */}
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
                      onChange={(event) =>
                        setBudget(event.target.value)
                      }
                    />
                  </div>

                  <span className="input-help">
                    Total amount for all travelers.
                  </span>
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
                      onChange={(event) =>
                        setDays(event.target.value)
                      }
                    />

                    <span>days</span>
                  </div>
                </div>
              </div>

              {/* TRAVELERS */}
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
                  onChange={(event) =>
                    setTravelers(event.target.value)
                  }
                />

                <span className="input-help">
                  Number of people traveling together.
                </span>
              </div>

              {/* INTERESTS */}
              <div className="form-group">
                <label className="form-label">
                  What are you interested in?
                </label>

                <div className="interest-grid">
                  {interestOptions.map((interest) => {
                    const selected = interests.includes(interest);

                    return (
                      <button
                        key={interest}
                        type="button"
                        className={`interest-chip ${
                          selected ? 'selected' : ''
                        }`}
                        onClick={() => toggleInterest(interest)}
                      >
                        <span>
                          {selected ? '✓' : '+'}
                        </span>

                        {interest}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* TRAVEL STYLE */}
              <div className="form-group">
                <label className="form-label">
                  Travel style
                </label>

                <div className="travel-style-grid">
                  {(['Budget', 'Comfort', 'Premium'] as TravelStyle[]).map(
                    (style) => (
                      <button
                        key={style}
                        type="button"
                        className={`style-option ${
                          travelStyle === style ? 'selected' : ''
                        }`}
                        onClick={() => setTravelStyle(style)}
                      >
                        <strong>
                          {style === 'Budget' && '💰'}
                          {style === 'Comfort' && '🏨'}
                          {style === 'Premium' && '✨'} {style}
                        </strong>

                        <span>
                          {style === 'Budget' &&
                            'Save more and travel smart'}
                          {style === 'Comfort' &&
                            'Balanced comfort and cost'}
                          {style === 'Premium' &&
                            'Higher comfort and experiences'}
                        </span>
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* ERROR */}
              {error && (
                <div className="planner-error">
                  <span>⚠️</span>
                  <p>{error}</p>
                </div>
              )}

              {/* SUBMIT */}
              <button
                type="submit"
                className="planner-submit"
                disabled={isPlanning}
              >
                {isPlanning ? (
                  <>
                    <span className="spinner" />
                    Planning your trip...
                  </>
                ) : (
                  <>✨ Plan My Trip</>
                )}
              </button>
            </form>
          </div>

          {/* SIDE SUMMARY */}
          <aside className="planner-sidebar">
            <div className="card planning-summary">
              <div className="section-heading">
                <span className="section-icon">💡</span>

                <div>
                  <h2>SmartTrip will consider</h2>
                  <p>
                    Your plan is built around your requirements.
                  </p>
                </div>
              </div>

              <div className="consider-list">
                <div>
                  <span>📍</span>
                  <p>
                    <strong>Starting point</strong>
                    {startingLocation || 'Not specified'}
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
                    {interests.length
                      ? interests.join(', ')
                      : 'None selected'}
                  </p>
                </div>
              </div>

              <div className="budget-per-person">
                <span>Budget per traveler</span>
                <strong>
                  {formatCurrency(budgetPerTraveler)}
                </strong>
              </div>
            </div>

            <div className="card ai-info-card">
              <div className="ai-icon">✨</div>

              <h3>AI planning is coming next</h3>

              <p>
                This first version validates your trip requirements
                and creates a local plan. Later, SmartTrip will use
                real travel data and AI to improve destination,
                route, weather, hotel and activity recommendations.
              </p>
            </div>
          </aside>
        </section>

        {/* GENERATED TRIP */}
        {tripPlan && (
          <section className="trip-result">
            <div className="result-header">
              <div>
                <div className="planner-badge">
                  ✨ TRIP READY
                </div>

                <h2>
                  {startingLocation} → {tripPlan.destination}
                </h2>

                <p>
                  {numericDays} days · {numericTravelers} travelers ·{' '}
                  {travelStyle} travel
                </p>
              </div>

              <button
                type="button"
                className="secondary-button"
                onClick={resetPlan}
              >
                Plan Again
              </button>
            </div>

            {/* TOTAL COST */}
            <div className="result-total card">
              <div>
                <span className="result-label">
                  Estimated trip cost
                </span>

                <strong className="result-price">
                  {formatCurrency(tripPlan.totalCost)}
                </strong>
              </div>

              <div className="budget-status">
                <span>Budget</span>

                <strong>
                  {formatCurrency(tripPlan.budget)}
                </strong>

                <span className="remaining">
                  {formatCurrency(
                    tripPlan.budget - tripPlan.totalCost
                  )}{' '}
                  remaining
                </span>
              </div>
            </div>

            {/* BUDGET BREAKDOWN */}
            <div className="result-section">
              <div className="result-section-heading">
                <h3>Budget breakdown</h3>

                <p>
                  Your estimated spending across the main trip
                  categories.
                </p>
              </div>

              <div className="budget-grid">
                <BudgetItem
                  icon="🚌"
                  label="Transport"
                  value={tripPlan.transport}
                />

                <BudgetItem
                  icon="🏨"
                  label="Accommodation"
                  value={tripPlan.accommodation}
                />

                <BudgetItem
                  icon="🍛"
                  label="Food"
                  value={tripPlan.food}
                />

                <BudgetItem
                  icon="🎟️"
                  label="Activities"
                  value={tripPlan.activities}
                />

                <BudgetItem
                  icon="🚕"
                  label="Local transport"
                  value={tripPlan.localTransport}
                />

                <BudgetItem
                  icon="🛟"
                  label="Safety buffer"
                  value={tripPlan.buffer}
                />
              </div>
            </div>

            {/* ITINERARY */}
            <div className="result-section">
              <div className="result-section-heading">
                <h3>Day-by-day itinerary</h3>

                <p>
                  A starting itinerary based on your selected
                  interests.
                </p>
              </div>

              <div className="itinerary-list">
                {tripPlan.days.map((day) => (
                  <article
                    key={day.day}
                    className="itinerary-card"
                  >
                    <div className="day-number">
                      <span>DAY</span>
                      <strong>{day.day}</strong>
                    </div>

                    <div className="day-content">
                      <h4>{day.title}</h4>

                      <ul>
                        {day.activities.map(
                          (activity, index) => (
                            <li key={`${activity}-${index}`}>
                              <span>✓</span>
                              {activity}
                            </li>
                          )
                        )}
                      </ul>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            {/* DESTINATION NOTE */}
            <div className="destination-note">
              <span>📍</span>

              <div>
                <strong>
                  About {tripPlan.destination}
                </strong>

                <p>
                  {destinationDescriptions[
                    tripPlan.destination
                  ] ||
                    'Explore local attractions, food and experiences that match your interests.'}
                </p>
              </div>
            </div>

            <div className="demo-notice">
              <strong>Important:</strong> These are planning estimates
              for the first local prototype. They are not live hotel,
              transport, activity, weather, or availability prices.
              We will connect real APIs before treating the results
              as bookable travel information.
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function BudgetItem({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: number;
}) {
  return (
    <div className="budget-item">
      <span className="budget-icon">{icon}</span>

      <div>
        <span>{label}</span>
        <strong>{formatCurrency(value)}</strong>
      </div>
    </div>
  );
}