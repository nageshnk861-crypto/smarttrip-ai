import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';

type RouteContext = { params: Promise<{ id: string }> };

async function getUser() {
  const supabase = await createClient();
  if (!supabase) return { supabase: null, user: null };
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { supabase, user } = await getUser();
  const { id } = await context.params;
  if (!supabase) return NextResponse.json({ success: false, error: 'Supabase is not configured.' }, { status: 503 });
  if (!user) return NextResponse.json({ success: false, error: 'Authentication is required.' }, { status: 401 });

  const { data, error } = await supabase
    .from('trips')
    .select('*, trip_budget(*), itinerary_days(*, itinerary_items(*))')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ success: false, error: 'Unable to load the trip.' }, { status: 502 });
  if (!data) return NextResponse.json({ success: false, error: 'Trip not found.' }, { status: 404 });
  return NextResponse.json({ success: true, data });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { supabase, user } = await getUser();
  const { id } = await context.params;
  if (!supabase) return NextResponse.json({ success: false, error: 'Supabase is not configured.' }, { status: 503 });
  if (!user) return NextResponse.json({ success: false, error: 'Authentication is required.' }, { status: 401 });

  const { error } = await supabase.from('trips').delete().eq('id', id).eq('user_id', user.id);
  if (error) return NextResponse.json({ success: false, error: 'Unable to delete the trip.' }, { status: 502 });
  return NextResponse.json({ success: true, data: { id } });
}
