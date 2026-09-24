import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';
import { planTrip } from '../../../lib/planner/planner';
import { validateTripRequest } from '../../../lib/planner/validators';

async function getAuthenticatedClient() {
  const supabase = await createClient();
  if (!supabase) return { supabase: null, user: null };
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET() {
  const { supabase, user } = await getAuthenticatedClient();
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Supabase is not configured.' }, { status: 503 });
  }
  if (!user) {
    return NextResponse.json({ success: false, error: 'Authentication is required.' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('trips')
    .select('*, trip_budget(*), itinerary_days(*, itinerary_items(*))')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ success: false, error: 'Unable to load your trips.' }, { status: 502 });
  }

  return NextResponse.json({ success: true, data, metadata: { isDemo: false } });
}

export async function POST(request: NextRequest) {
  const { supabase, user } = await getAuthenticatedClient();
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Supabase is not configured.' }, { status: 503 });
  }
  if (!user) {
    return NextResponse.json({ success: false, error: 'Authentication is required.' }, { status: 401 });
  }

  try {
    const tripRequest = validateTripRequest(await request.json());
    const plan = planTrip(tripRequest);
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .insert({
        user_id: user.id,
        origin: tripRequest.origin,
        destination_name: plan.destination,
        days: tripRequest.days,
        travelers: tripRequest.travelers,
        budget: tripRequest.budget,
        travel_style: tripRequest.travelStyle,
        interests: tripRequest.interests,
        status: 'planned',
      })
      .select()
      .single();

    if (tripError || !trip) {
      return NextResponse.json({ success: false, error: 'Unable to save your trip.' }, { status: 502 });
    }

    const { error: budgetError } = await supabase.from('trip_budget').insert({
      trip_id: trip.id,
      transport: plan.budget.transport,
      hotel: plan.budget.accommodation,
      food: plan.budget.food,
      local_transport: plan.budget.localTransport,
      activities: plan.budget.activities,
      buffer: plan.budget.buffer,
      total: plan.budget.total,
      remaining: plan.budget.remaining,
      currency: plan.budget.currency,
    });

    if (budgetError) {
      await supabase.from('trips').delete().eq('id', trip.id).eq('user_id', user.id);
      return NextResponse.json({ success: false, error: 'Unable to save trip budget.' }, { status: 502 });
    }

    return NextResponse.json({ success: true, data: { trip, plan }, metadata: { isDemo: plan.isDemo } }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to save your trip.';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
