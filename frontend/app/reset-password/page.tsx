'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');
    if (password.length < 6) return setError('Password must be at least 6 characters long.');
    if (password !== confirmPassword) return setError('Passwords must match.');
    if (!isSupabaseConfigured || !supabase) return setError('Password reset is unavailable until Supabase is configured.');

    setIsSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setIsSubmitting(false);
    if (updateError) setError(updateError.message);
    else setMessage('Your password was updated. You can sign in with it now.');
  }

  return <main className="simple-page"><section className="simple-hero container"><span className="section-eyebrow">SECURE RESET</span><h1>Choose a new password.</h1><p>Use at least six characters. Your reset link is handled by Supabase Auth.</p><form className="auth-form recovery-form" onSubmit={handleSubmit}><label className="auth-label" htmlFor="new-password">New password</label><input id="new-password" className="auth-input" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" /><label className="auth-label" htmlFor="confirm-new-password">Confirm password</label><input id="confirm-new-password" className="auth-input" type="password" required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" />{error && <p className="auth-error">{error}</p>}{message && <p className="auth-success">{message}</p>}<button className="auth-button" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Updating...' : 'Update password'}</button></form><Link href="/login" className="simple-cta">Back to sign in</Link></section></main>;
}
