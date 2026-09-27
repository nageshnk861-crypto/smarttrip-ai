import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/**
 * Checks whether Supabase configuration environment variables are available.
 * Returns true if both URL and anon key are defined (non-empty strings).
 */
export const isSupabaseConfigured = (): boolean => {
  return Boolean(supabaseUrl) && Boolean(supabaseAnonKey);
};

let browserClient: SupabaseClient | null = null;

/**
 * Returns a singleton browser Supabase client, or null if the environment
 * is not configured. Never throws at module-evaluation time so the app can
 * render even when configuration is missing.
 */
export function createClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }
  if (!browserClient) {
    browserClient = createBrowserClient(supabaseUrl!, supabaseAnonKey!, {
      cookieOptions: { secure: process.env.NODE_ENV === 'production' },
    });
  }
  return browserClient;
}

export const supabase = createClient();
