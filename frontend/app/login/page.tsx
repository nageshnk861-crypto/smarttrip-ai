'use client';

import React, { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (!isSupabaseConfigured || !supabase) {
      setError('Supabase authentication is not configured. Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.local.');
      return;
    }

    setIsSubmitting(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) throw new Error(signInError.message);
      
      setSuccess('Signed in successfully. Redirecting to your trips...');

      window.setTimeout(() => {
        router.push('/trips');
      }, 600);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong while signing you in. Please try again.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card auth-card-centered">
        <div className="auth-panel-form">
          <div className="auth-header-center">
            <Link href="/" className="auth-brand" aria-label="SmartTrip AI Home">
              <span className="auth-brand-mark">S</span>
              <span>SmartTrip<span style={{ color: '#2563eb' }}>AI</span></span>
            </Link>
          </div>

          <div className="auth-content auth-content-compact">
            <h1 className="auth-section-title">Sign in to your account</h1>
            <p className="auth-subtitle">Plan smarter. Travel better. Stay within budget.</p>

            {error && <p className="auth-error">{error}</p>}
            {success && <p className="auth-success">{success}</p>}

            <form onSubmit={handleLogin} className="auth-form">
              <label className="auth-label" htmlFor="email">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
                className="auth-input"
                autoComplete="email"
              />

              <label className="auth-label" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Your password"
                required
                className="auth-input"
                autoComplete="current-password"
              />

              <button type="submit" className="auth-button" disabled={isSubmitting}>
                {isSubmitting ? 'Signing in...' : 'Continue with email'}
              </button>
            </form>

            <div className="auth-divider">
              <span>OR CONTINUE WITH</span>
            </div>

            <div className="auth-socials">
              <button type="button" className="auth-social-button" disabled>
                <span className="auth-social-icon google">G</span>
                Continue with Google
              </button>
              <button type="button" className="auth-social-button" disabled>
                <span className="auth-social-icon apple"></span>
                Continue with Apple
              </button>
              <button type="button" className="auth-social-button" disabled>
                <span className="auth-social-icon github">◌</span>
                Continue with GitHub
              </button>
            </div>

            <div className="auth-links-row">
              <Link href="/forgot-password" className="auth-inline-link">Forgot password?</Link>
            </div>

            <p className="auth-footer-copy">
              Don&apos;t have an account?{' '}
              <Link href="/register">Create one</Link>
            </p>

            <p className="auth-legal">
              By continuing, you agree to our <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;