import { NextRequest } from 'next/server';

export async function getSession(req: NextRequest) {
  // Authentication will be connected to Supabase later.
  // For now, allow the application to run without authentication.
  return {
    user: null,
  };
}