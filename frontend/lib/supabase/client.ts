import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';

/**
 * Checks whether Supabase configuration environment variables are available.
 * Returns true if both URL and anon key are defined (non‑empty strings).
 */
export const isSupabaseConfigured = (): boolean => {
  return Boolean(supabaseUrl) && Boolean(supabaseAnonKey);
};

// Null when Supabase isn't configured, so importing this module never crashes
// the build or the page; callers should check isSupabaseConfigured() first.
export const supabase = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
