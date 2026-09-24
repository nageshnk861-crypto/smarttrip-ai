import Link from 'next/link';
import { ArrowRight, UserRound } from 'lucide-react';

export default function ProfilePage() {
  return <main className="simple-page"><section className="simple-hero container"><span className="section-eyebrow">PROFILE & PREFERENCES</span><h1>Make the planner feel more like you.</h1><p>Preferences will personalize recommendations and remembered trips after Supabase authentication is configured.</p><div className="feature-empty"><UserRound className="about-icon" /><div><h2>Profile setup is waiting</h2><p>Connect an account to save preferences, favorite places and trip history.</p><Link href="/login" className="simple-cta">Sign in <ArrowRight className="w-4 h-4" /></Link></div></div></section></main>;
}
