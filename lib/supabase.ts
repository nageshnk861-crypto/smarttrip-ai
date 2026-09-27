import {
  supabase,
  isSupabaseConfigured as checkConfigured,
} from './supabase/client';

export const isSupabaseConfigured = checkConfigured();

export { supabase };

export default supabase;
