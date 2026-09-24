import Link from 'next/link';
import { Bookmark, Compass } from 'lucide-react';

export default function SavedPage() {
  return <main className="simple-page"><section className="simple-hero container"><span className="section-eyebrow">SAVED PLACES</span><h1>Keep the places that made you pause.</h1><p>Save destinations and places when your Supabase account is connected. For now, explore the curated SmartTrip knowledge base.</p><div className="feature-empty"><Bookmark className="about-icon" /><div><h2>Your collection is empty</h2><p>Discover a destination and begin shaping your next trip.</p><Link href="/explore" className="simple-cta"><Compass className="w-4 h-4" /> Explore destinations</Link></div></div></section></main>;
}
