'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, Compass, MapPin, Search, Sparkles } from 'lucide-react';

type SearchResult = {
  place_id: string;
  name?: string;
  displayName?: string;
  description: string;
  city?: string;
  state?: string;
  country?: string;
};

export default function ExplorePage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      setIsLoading(true);
      setError('');
      try {
        const response = await fetch(`/api/places/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setResults(data.results ?? []);
      } catch {
        setResults([]);
        setError('Unable to search destinations. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [query]);

  return (
    <main className="explore-page">
      <section className="explore-hero">
        <div className="container explore-hero-inner">
          <div className="explore-hero-copy">
            <span className="section-eyebrow">CURATED FOR REAL BUDGETS</span>
            <h1>Find the place that fits your kind of weekend.</h1>
            <p>Browse destination knowledge gathered by SmartTrip, then turn a place into a verified itinerary in one click.</p>
            <div className="explore-search">
              <Search className="w-5 h-5" aria-hidden="true" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search places, moods or interests" aria-label="Search destinations" />
              <span>{isLoading ? 'Searching...' : `${results.length} places`}</span>
            </div>
          </div>
          <div className="explore-hero-mark" aria-hidden="true"><Compass className="w-16 h-16" /></div>
        </div>
      </section>

      <section className="container explore-content">
        <div className="explore-section-heading">
          <div><span className="section-eyebrow">DESTINATION NOTES</span><h2>Shortlist your next escape</h2></div>
          <span className="explore-source"><Sparkles className="w-4 h-4" /> Live place provider</span>
        </div>
        <div className="destination-grid">
          {results.map((destination) => (
            <article className="destination-card destination-card-sunrise" key={destination.place_id}>
              <div className="destination-card-art"><MapPin className="w-7 h-7" /><span>{destination.state ?? destination.country ?? 'Live result'}</span></div>
              <div className="destination-card-body">
                <div className="destination-card-title"><div><h3>{destination.name ?? destination.description.split(',')[0]}</h3><p>{destination.displayName ?? destination.description}</p></div></div>
                <div className="destination-tags">{[destination.city, destination.state, destination.country].filter(Boolean).map((tag) => <span key={tag}>{tag}</span>)}</div>
                <Link href="/planner" className="destination-cta">Plan this destination <ArrowRight className="w-4 h-4" /></Link>
              </div>
            </article>
          ))}
        </div>
        {!isLoading && error && <div className="empty-state"><h2>{error}</h2></div>}
        {!isLoading && !error && query.trim().length >= 2 && !results.length && <div className="empty-state"><h2>No destinations found.</h2></div>}
        {!query.trim() && <div className="empty-state"><h2>Search for a city, region, or landmark.</h2></div>}
      </section>
    </main>
  );
}
