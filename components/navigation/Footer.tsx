import React from 'react';
import Link from 'next/link';
import { Sparkles, Shield } from 'lucide-react';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <div className="footer-top-grid">
          {/* Column 1: Brand */}
          <div className="footer-col footer-col-brand">
            <Link href="/" className="brand-logo" aria-label="SmartTrip AI Home">
              <div className="brand-icon">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="brand-text">
                SmartTrip<span className="brand-highlight">AI</span>
              </span>
            </Link>
            <p className="footer-tagline">
              Intelligent, constraint-first travel planning platform. Plan realistic itineraries around your budget, travelers, origin, and interests.
            </p>
            <div className="footer-badge">
              <Shield className="w-4 h-4 text-emerald-600" />
              <span>Deterministic Budget & Constraint Guardrails</span>
            </div>
          </div>

          {/* Column 2: Product */}
          <div className="footer-col">
            <h4 className="footer-heading">Platform</h4>
            <ul className="footer-links">
              <li><Link href="/planner">AI Trip Planner</Link></li>
              <li><Link href="/explore">Explore Destinations</Link></li>
              <li><Link href="/trips">My Trips</Link></li>
              <li><Link href="/saved">Saved Places</Link></li>
            </ul>
          </div>

          {/* Column 3: Features */}
          <div className="footer-col">
            <h4 className="footer-heading">Features</h4>
            <ul className="footer-links">
              <li><Link href="/planner">Budget Optimization</Link></li>
              <li><Link href="/explore">Destination Discovery</Link></li>
              <li><Link href="/about#weather">Weather-Aware Routing</Link></li>
              <li><Link href="/about#ai">Natural Language Editing</Link></li>
              <li><Link href="/about#providers">Live Provider Abstractions</Link></li>
            </ul>
          </div>

          {/* Column 4: Architecture & Trust */}
          <div className="footer-col">
            <h4 className="footer-heading">Architecture & Trust</h4>
            <p className="footer-disclaimer">
              SmartTrip AI uses deterministic constraint calculation engines as the primary source of truth. AI assists with natural language extraction, personalization, and recommendations without fabricating unverified travel facts.
            </p>
          </div>
        </div>

        {/* Footer Bottom Bar */}
        <div className="footer-bottom">
          <p className="footer-copy">
            © {currentYear} SmartTrip AI. Built with Next.js, Supabase, and local AI.
          </p>
          <div className="footer-legal-links">
            <Link href="/about">About</Link>
            <span>·</span>
            <Link href="/about#terms">Terms of Service</Link>
            <span>·</span>
            <Link href="/about#privacy">Privacy Policy</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
