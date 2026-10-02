import type { Request, Response } from 'express';
import { getSupabaseClient } from '../services/supabase.js';

export async function getTrips(req: Request, res: Response): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    res.json({
      data: [
        {
          id: 'demo-1',
          destination_name: 'Jaipur, Rajasthan',
          origin: 'Delhi',
          days: 3,
          travelers: 2,
          budget: 15000,
          travel_style: 'Budget',
          status: 'Planned',
          created_at: new Date().toISOString(),
        },
      ],
    });
    return;
  }

  try {
    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ data: data || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch trips';
    res.status(500).json({ error: message });
  }
}

export async function getTripById(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const supabase = getSupabaseClient();
  if (!supabase) {
    res.json({
      data: {
        id,
        destination_name: 'Jaipur, Rajasthan',
        origin: 'Delhi',
        days: 3,
        travelers: 2,
        budget: 15000,
        travel_style: 'Budget',
        status: 'Planned',
      },
    });
    return;
  }

  try {
    const { data, error } = await supabase.from('trips').select('*').eq('id', id).single();
    if (error) {
      res.status(404).json({ error: 'Trip not found' });
      return;
    }
    res.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch trip';
    res.status(500).json({ error: message });
  }
}

export async function createTrip(req: Request, res: Response): Promise<void> {
  const supabase = getSupabaseClient();
  const tripData = req.body;

  if (!tripData.destination && !tripData.destination_name) {
    res.status(400).json({ error: 'Destination is required' });
    return;
  }

  if (!supabase) {
    res.status(201).json({
      data: {
        id: 'trip_' + Date.now(),
        ...tripData,
        destination_name: tripData.destination || tripData.destination_name,
        created_at: new Date().toISOString(),
      },
      message: 'Trip saved (demo mode - connect Supabase for persistent DB storage)',
    });
    return;
  }

  try {
    const { data, error } = await supabase.from('trips').insert([tripData]).select().single();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(201).json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save trip';
    res.status(500).json({ error: message });
  }
}

export async function deleteTrip(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const supabase = getSupabaseClient();

  if (!supabase) {
    res.json({ success: true, message: 'Deleted trip' });
    return;
  }

  try {
    const { error } = await supabase.from('trips').delete().eq('id', id);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete trip';
    res.status(500).json({ error: message });
  }
}
