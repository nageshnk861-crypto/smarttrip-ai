import Link from 'next/link';
import { ArrowRight, Database, ShieldCheck, Sparkles } from 'lucide-react';

export default function AboutPage() {
  return (
    <main className="simple-page">
      <section className="simple-hero container"><span className="section-eyebrow">THE SMARTTRIP METHOD</span><h1>Useful intelligence for decisions that still belong to you.</h1><p>SmartTrip combines destination knowledge, provider tools and deterministic budget checks. AI can explain the plan, but it cannot override the numbers.</p><Link href="/planner" className="simple-cta">Build an itinerary <ArrowRight className="w-4 h-4" /></Link></section>
      <section className="container about-grid">
        <article><Database className="about-icon" /><h2>Grounded in knowledge</h2><p>Destination notes and future vector search give the planner a traceable source of context instead of a blank chatbot prompt.</p></article>
        <article><ShieldCheck className="about-icon" /><h2>Guardrails first</h2><p>Budget, duration and traveler limits are validated before a plan reaches the screen. Demo estimates are always labeled.</p></article>
        <article><Sparkles className="about-icon" /><h2>AI where it helps</h2><p>Natural-language requests, explanations and refinements sit around a deterministic planning core.</p></article>
      </section>
    </main>
  );
}
