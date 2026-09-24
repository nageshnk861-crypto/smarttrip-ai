'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (password.trim().length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords must match.');
      return;
    }

    if (!isSupabaseConfigured || !supabase) {
      setError('Supabase authentication is not configured. Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.local.');
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { display_name: name.trim() } },
      });
      if (signUpError) throw new Error(signUpError.message);

      if (signUpData.session) {
        setSuccess('Account created successfully. Redirecting to your trips...');
        window.setTimeout(() => router.push('/trips'), 600);
      } else {
        setSuccess('Account created. Check your email to confirm your address before signing in.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong while creating your account. Please try again.';
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
            <h1 className="auth-section-title">Create your account</h1>
            <p className="auth-subtitle">Plan smarter. Travel better. Stay within budget.</p>

            {error && <p className="auth-error">{error}</p>}
            {success && <p className="auth-success">{success}</p>}

            <form onSubmit={handleRegister} className="auth-form">
              <label className="auth-label" htmlFor="name">Name</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your name"
                required
                className="auth-input"
                autoComplete="name"
              />

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

              <label className="auth-label" htmlFor="password">
                Password
              </label>
              <div className="password-field">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Create a secure password"
                  required
                  className="auth-input password-input"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>

              <label className="auth-label" htmlFor="confirmPassword">Confirm password</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Repeat your password"
                required
                className="auth-input"
                autoComplete="new-password"
              />

              <button type="submit" className="auth-button" disabled={isSubmitting}>
                {isSubmitting ? 'Creating account...' : 'Create account'}
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

            <p className="auth-footer-copy">
              Already have an account?{' '}
              <Link href="/login">Login</Link>
            </p>

            <p className="auth-legal">
              By continuing, you agree to our <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
