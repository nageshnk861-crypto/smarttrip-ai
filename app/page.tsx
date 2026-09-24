'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  ArrowRight,
  Compass,
  MapPin,
  ShieldCheck,
  DollarSign,
  CloudSun,
  Route,
  Map,
  Sliders,
  Globe,
  Star,
  CheckCircle2,
  Zap,
  Hotel,
  Search,
} from 'lucide-react';

const examplePrompts = [
  { text: '₹15,000 · 3 days · Bangalore to Coorg · nature & coffee', icon: '🌿' },
  { text: '₹25,000 · 4 days · Mumbai to Goa · beaches & seafood', icon: '🏖️' },
  { text: '₹50,000 · 5 days · Delhi to Manali · snow & relaxation', icon: '🏔️' },
  { text: '$1,200 · 5 days · Tokyo to Kyoto · culture & food', icon: '⛩️' },
];

const stats = [
  { value: '100%', label: 'Dynamic Global Geocoding', sub: 'Nominatim & OSM' },
  { value: '0', label: 'Hardcoded / Fake Rates', sub: 'Transparent Line Items' },
  { value: '7-Day', label: 'Live Weather Forecast', sub: 'Open-Meteo Integration' },
  { value: '100%', label: 'Deterministic Budget Engine', sub: 'Safety Buffers Included' },
];

export default function HomePage() {
  const router = useRouter();
  const [nlInput, setNlInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleNlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = nlInput.trim() || examplePrompts[0].text;
    router.push(`/planner?prompt=${encodeURIComponent(query)}`);
  };

  const handleChipClick = (promptText: string) => {
    setNlInput(promptText);
    inputRef.current?.focus();
  };

  return (
    <div className="home-page">

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className="hp-hero">
        <div className="hp-hero-glow-1" aria-hidden="true" />
        <div className="hp-hero-glow-2" aria-hidden="true" />

        <div className="container hp-hero-inner">

          {/* Left column */}
          <div className="hp-hero-copy">

            <div className="hp-badge">
              <span className="hp-badge-pulse" />
              <Sparkles className="hp-badge-icon" aria-hidden />
              <span>AI-Powered · Real Open Providers · No Hallucinated Prices</span>
            </div>

            <h1 className="hp-title">
              Plan any trip,<br />
              <span className="hp-title-accent">anywhere in the world.</span>
            </h1>

            <p className="hp-subtitle">
              Type your budget, destination, and interests in natural language.
              SmartTrip researches real places, calculates an honest cost
              breakdown, and builds your custom itinerary — with verifiable data.
            </p>

            {/* Elevated Search Bar */}
            <form onSubmit={handleNlSubmit} className="hp-search-form" aria-label="Trip search">
              <div className="hp-search-input-row">
                <Search className="hp-search-icon" aria-hidden />
                <input
                  ref={inputRef}
                  type="text"
                  className="hp-search-input"
                  value={nlInput}
                  onChange={(e) => setNlInput(e.target.value)}
                  placeholder="e.g. ₹20,000 · 4 days · Bangalore to Kerala · nature & food"
                  aria-label="Describe your trip"
                />
              </div>
              <button type="submit" className="hp-search-btn">
                <span>Plan My Trip</span>
                <ArrowRight className="w-4 h-4" aria-hidden />
              </button>
            </form>

            {/* Example chips */}
            <div className="hp-chips" aria-label="Example trip queries">
              <span className="hp-chips-label">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span>Try:</span>
              </span>
              <div className="hp-chips-list">
                {examplePrompts.map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    className="hp-chip"
                    onClick={() => handleChipClick(p.text)}
                  >
                    <span className="hp-chip-icon">{p.icon}</span>
                    <span>{p.text}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Action buttons row */}
            <div className="hp-cta-row">
              <Link href="/planner" className="hp-btn-primary">
                <Compass className="w-4 h-4" aria-hidden />
                <span>Open Advanced Planner</span>
              </Link>
              <Link href="/explore" className="hp-btn-ghost">
                <MapPin className="w-4 h-4" aria-hidden />
                <span>Explore Curated Destinations</span>
              </Link>
            </div>

            {/* Trust line */}
            <div className="hp-trust">
              <ShieldCheck className="hp-trust-icon" aria-hidden />
              <span>
                All prices come from live providers or are clearly labelled as
                estimates. SmartTrip never invents hotel rates, fares, or attractions.
              </span>
            </div>
          </div>

          {/* Right column — live engine card */}
          <div className="hp-hero-card" aria-hidden="true">
            <div className="hp-card-header">
              <div className="hp-card-dots">
                <span className="hp-card-dot hp-dot-red" />
                <span className="hp-card-dot hp-dot-yellow" />
                <span className="hp-card-dot hp-dot-green" />
              </div>
              <div className="hp-card-status-badge">
                <span className="hp-status-live-dot" />
                <span>Live Research Engine</span>
              </div>
            </div>

            <div className="hp-card-steps">
              {[
                { icon: '🗺️', step: '01', label: 'Geocode Destination', sub: 'Nominatim & OpenStreetMap API' },
                { icon: '📍', step: '02', label: 'Query Verified POIs', sub: 'Overpass API real coordinates' },
                { icon: '🏨', step: '03', label: 'Accommodation & Dining', sub: 'OSM data · Dynamic estimate model' },
                { icon: '🌦️', step: '04', label: '7-Day Live Weather', sub: 'Open-Meteo · Real-time forecast' },
                { icon: '💰', step: '05', label: 'Deterministic Budget', sub: 'Exact line-item calculation + 8% buffer' },
              ].map(({ icon, step, label, sub }) => (
                <div key={step} className="hp-step">
                  <span className="hp-step-num">{step}</span>
                  <span className="hp-step-icon">{icon}</span>
                  <div className="hp-step-info">
                    <strong>{label}</strong>
                    <span>{sub}</span>
                  </div>
                  <CheckCircle2 className="hp-step-check" />
                </div>
              ))}
            </div>

            <div className="hp-card-footer">
              <div className="hp-card-footer-item">
                <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                <span>Transparent Guardrails</span>
              </div>
              <div className="hp-card-footer-divider" />
              <div className="hp-card-footer-item">
                <Globe className="w-3.5 h-3.5 text-blue-400" />
                <span>Worldwide Coverage</span>
              </div>
            </div>
          </div>

        </div>

        {/* Stats bar */}
        <div className="hp-stats-bar">
          <div className="container hp-stats-inner">
            {stats.map(({ value, label, sub }) => (
              <div key={label} className="hp-stat-card">
                <strong className="hp-stat-value">{value}</strong>
                <span className="hp-stat-label">{label}</span>
                <span className="hp-stat-sub">{sub}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────── */}
      <section className="section-how-it-works">
        <div className="container">
          <div className="section-header text-center">
            <span className="section-eyebrow">THE SMARTTRIP ARCHITECTURE</span>
            <h2 className="section-title">How SmartTrip Works</h2>
            <p className="section-subtitle">
              Unlike chatbots that hallucinate hotel rates and impossible
              transit times, SmartTrip runs a strict research-first pipeline.
            </p>
          </div>

          <div className="steps-grid">
            {[
              {
                num: '01',
                icon: <Sliders className="w-6 h-6 text-blue-600" />,
                bg: 'bg-blue-50 text-blue-600',
                title: 'Describe Your Trip',
                text: 'Set origin, destination, budget, days, travelers and interests in plain English or the structured form.',
              },
              {
                num: '02',
                icon: <Globe className="w-6 h-6 text-indigo-600" />,
                bg: 'bg-indigo-50 text-indigo-600',
                title: 'Live Destination Research',
                text: 'Real places, accommodation options, restaurants, and weather are fetched from live open providers.',
              },
              {
                num: '03',
                icon: <DollarSign className="w-6 h-6 text-emerald-600" />,
                bg: 'bg-emerald-50 text-emerald-600',
                title: 'Deterministic Budget Calculation',
                text: 'Every line item — stay, food, activities, transport, and 8% buffer — is mathematically computed.',
              },
              {
                num: '04',
                icon: <Sparkles className="w-6 h-6 text-purple-600" />,
                bg: 'bg-purple-50 text-purple-600',
                title: 'AI Narrative Synthesis',
                text: 'AI receives verified factual data and synthesizes day-by-day itineraries without fabricating facts.',
              },
            ].map(({ num, icon, bg, title, text }) => (
              <div key={num} className="step-card">
                <div className="step-card-top">
                  <div className={`step-icon-box ${bg}`}>{icon}</div>
                  <span className="step-number">{num}</span>
                </div>
                <h3 className="step-name">{title}</h3>
                <p className="step-text">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────────────────── */}
      <section className="section-features">
        <div className="container">
          <div className="section-header text-center">
            <span className="section-eyebrow">INTELLIGENT CAPABILITIES</span>
            <h2 className="section-title">Built for Real-World Travel</h2>
            <p className="section-subtitle">
              Every feature is engineered for honesty, accuracy, and actionable travel execution.
            </p>
          </div>

          <div className="features-grid">
            {[
              {
                color: 'text-emerald-600 bg-emerald-50 border-emerald-100',
                icon: <DollarSign className="w-6 h-6" />,
                title: 'Honest Budget Breakdown',
                desc: 'Transport, stay, dining, activities, and an 8% safety buffer — all itemized with data transparency.',
              },
              {
                color: 'text-blue-600 bg-blue-50 border-blue-100',
                icon: <Compass className="w-6 h-6" />,
                title: 'Worldwide Destination Search',
                desc: 'Powered by Nominatim and OpenStreetMap. Search any city, region, or landmark across the globe.',
              },
              {
                color: 'text-amber-600 bg-amber-50 border-amber-100',
                icon: <CloudSun className="w-6 h-6" />,
                title: '7-Day Live Weather Forecast',
                desc: 'Open-Meteo delivers accurate forecasts, high/low temperatures, and precipitation probabilities.',
              },
              {
                color: 'text-indigo-600 bg-indigo-50 border-indigo-100',
                icon: <Route className="w-6 h-6" />,
                title: 'Route-Based Transport Logic',
                desc: 'Calculates road distances and transit estimates so your travel days remain realistic and stress-free.',
              },
              {
                color: 'text-cyan-600 bg-cyan-50 border-cyan-100',
                icon: <Map className="w-6 h-6" />,
                title: 'Verified Nearby Places & POIs',
                desc: 'Attractions, landmarks, and cultural spots fetched live from Overpass API using real geospatial coordinates.',
              },
              {
                color: 'text-purple-600 bg-purple-50 border-purple-100',
                icon: <Sliders className="w-6 h-6" />,
                title: 'Natural Language Prompting',
                desc: 'Describe your dream trip in a single sentence. SmartTrip extracts constraints and builds your plan instantly.',
              },
            ].map(({ color, icon, title, desc }) => (
              <div key={title} className="feature-card">
                <div className={`feature-icon-wrapper ${color}`}>{icon}</div>
                <h3 className="feature-title">{title}</h3>
                <p className="feature-desc">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ───────────────────────────────────────────────── */}
      <section className="section-cta">
        <div className="container">
          <div className="cta-card">
            <div className="cta-card-glow" aria-hidden="true" />
            <div className="cta-content">
              <span className="cta-badge">
                <Sparkles className="w-3.5 h-3.5" />
                <span>READY TO PLAN YOUR NEXT JOURNEY?</span>
              </span>
              <h2 className="cta-title">Turn your budget into a realistic, verified itinerary.</h2>
              <p className="cta-desc">
                No credit card required. No fabricated prices. Real places, honest costs, and optimized travel schedules.
              </p>
              <div className="cta-buttons">
                <Link href="/planner" className="btn-cta-primary">
                  <Compass className="w-5 h-5" aria-hidden />
                  <span>Start Planning Free</span>
                  <ArrowRight className="w-4 h-4" aria-hidden />
                </Link>
                <Link href="/explore" className="btn-cta-secondary">
                  <span>Browse Curated Destinations</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}

