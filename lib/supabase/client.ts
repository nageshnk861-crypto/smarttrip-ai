import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';

if (!supabaseUrl) {
  throw new Error('Supabase configuration error: NEXT_PUBLIC_SUPABASE_URL is missing');
}
if (!supabaseAnonKey) {
  throw new Error('Supabase configuration error: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Checks whether Supabase configuration environment variables are available.
 * Returns true if both URL and anon key are defined (non‑empty strings).
 */
export const isSupabaseConfigured = (): boolean => {
  return Boolean(supabaseUrl) && Boolean(supabaseAnonKey);
};

