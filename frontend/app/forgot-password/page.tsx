'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');
    if (!isSupabaseConfigured || !supabase) {
      setError('Password recovery is unavailable until Supabase is configured.');
      return;
    }

    setIsSubmitting(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setIsSubmitting(false);
    if (resetError) setError(resetError.message);
    else setMessage('Check your email for a secure password reset link.');
  }

  return <main className="simple-page"><section className="simple-hero container"><span className="section-eyebrow">ACCOUNT RECOVERY</span><h1>Get back to planning.</h1><p>Enter the email connected to your SmartTrip account and we will send a secure reset link.</p><form className="auth-form recovery-form" onSubmit={handleSubmit}><label className="auth-label" htmlFor="recovery-email">Email address</label><input id="recovery-email" className="auth-input" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="you@example.com" />{error && <p className="auth-error">{error}</p>}{message && <p className="auth-success">{message}</p>}<button className="auth-button" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Sending...' : 'Send reset link'}</button></form><Link href="/login" className="simple-cta">Back to sign in</Link></section></main>;
}
