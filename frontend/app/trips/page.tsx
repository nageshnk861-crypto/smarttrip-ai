'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, CalendarDays, Compass, LoaderCircle, Trash2 } from 'lucide-react';

type SavedTrip = {
  id: string;
  destination_name: string | null;
  origin: string;
  days: number;
  travelers: number;
  budget: number;
  travel_style: string;
  status: string;
  created_at: string;
};

export default function TripsPage() {
  const [trips, setTrips] = useState<SavedTrip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState('');

  async function loadTrips() {
    setIsLoading(true);
    try {
      const response = await fetch('/api/trips');
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.error ?? 'Unable to load your trips.');
        return;
      }
      setTrips(result.data ?? []);
    } catch {
      setMessage('Unable to load your trips right now.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadTrips();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function deleteTrip(id: string) {
    const response = await fetch(`/api/trips/${id}`, { method: 'DELETE' });
    if (response.ok) {
      setTrips((current) => current.filter((trip) => trip.id !== id));
    } else {
      setMessage('Unable to delete this trip.');
    }
  }

  return (
    <main className="simple-page">
      <section className="simple-hero container">
        <span className="section-eyebrow">MY TRIPS</span>
        <h1>Your future journeys, in one calm place.</h1>
        <p>Saved itineraries stay attached to your account and remain protected by Supabase row-level security.</p>
        <Link href="/planner" className="simple-cta">Plan a trip <ArrowRight className="w-4 h-4" /></Link>

        {isLoading && <div className="feature-empty"><LoaderCircle className="about-icon animate-spin" /><p>Loading your saved trips...</p></div>}
        {!isLoading && message && <div className="feature-empty"><CalendarDays className="about-icon" /><div><h2>{message}</h2><p>Sign in and connect Supabase to load private trip history.</p><Link href="/login" className="simple-cta">Sign in <ArrowRight className="w-4 h-4" /></Link></div></div>}
        {!isLoading && !message && !trips.length && <div className="feature-empty"><CalendarDays className="about-icon" /><div><h2>No saved journeys yet</h2><p>Generate a plan, then use Save Trip to add it to your library.</p><Link href="/planner" className="simple-cta">Open planner <Compass className="w-4 h-4" /></Link></div></div>}

        {!isLoading && !message && trips.length > 0 && (
          <div className="saved-trip-list">
            {trips.map((trip) => (
              <article className="saved-trip-card" key={trip.id}>
                <div><span className="section-eyebrow">{trip.status}</span><h2>{trip.origin} <span>to</span> {trip.destination_name ?? 'Destination'}</h2><p>{trip.days} days · {trip.travelers} travelers · {trip.travel_style} · ₹{Number(trip.budget).toLocaleString('en-IN')}</p></div>
                <button type="button" className="icon-action" onClick={() => void deleteTrip(trip.id)} aria-label={`Delete trip to ${trip.destination_name ?? 'destination'}`} title="Delete trip"><Trash2 className="w-4 h-4" /></button>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
