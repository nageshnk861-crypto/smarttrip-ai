import { createBrowserClient } from '@supabase/ssr';
import { isSupabaseConfigured as checkConfigured } from './supabase/client';

export const isSupabaseConfigured = checkConfigured();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const supabase = isSupabaseConfigured
  ? createBrowserClient(supabaseUrl!, supabasePublishableKey!)
  : null;

export default supabase;
