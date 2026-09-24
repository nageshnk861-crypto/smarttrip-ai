-- Incremental provider catalog and user preference tables.
-- This migration preserves the existing SmartTrip schema.

create table if not exists public.hotels (
    id uuid primary key default gen_random_uuid(),
    destination_id uuid references public.destinations(id) on delete cascade,
    name text not null,
    category text not null default 'Budget',
    rating numeric(3,2),
    latitude double precision,
    longitude double precision,
    price_per_night numeric(12,2),
    provider text not null default 'database',
    provider_hotel_id text,
    created_at timestamptz not null default now(),
    constraint hotels_category_check check (category in ('Budget', 'Comfort', 'Premium')),
    constraint hotels_rating_check check (rating is null or rating between 0 and 5),
    constraint hotels_price_check check (price_per_night is null or price_per_night >= 0)
);

create table if not exists public.transport_options (
    id uuid primary key default gen_random_uuid(),
    origin text not null,
    destination_id uuid references public.destinations(id) on delete cascade,
    mode text not null,
    provider text not null default 'database',
    estimated_cost numeric(12,2),
    duration_minutes integer,
    distance_km numeric(12,2),
    provider_reference text,
    created_at timestamptz not null default now(),
    constraint transport_cost_check check (estimated_cost is null or estimated_cost >= 0),
    constraint transport_duration_check check (duration_minutes is null or duration_minutes > 0),
    constraint transport_distance_check check (distance_km is null or distance_km >= 0)
);

create table if not exists public.favorites (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    destination_id uuid references public.destinations(id) on delete cascade,
    place_id uuid references public.places(id) on delete cascade,
    created_at timestamptz not null default now(),
    constraint favorites_target_check check (destination_id is not null or place_id is not null)
);

create table if not exists public.notifications (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    title text not null,
    body text not null,
    read_at timestamptz,
    created_at timestamptz not null default now()
);

create index if not exists hotels_destination_idx on public.hotels(destination_id);
create index if not exists transport_destination_idx on public.transport_options(destination_id);
create index if not exists favorites_user_idx on public.favorites(user_id, created_at desc);
create unique index if not exists favorites_user_destination_idx on public.favorites(user_id, destination_id) where destination_id is not null;
create unique index if not exists favorites_user_place_idx on public.favorites(user_id, place_id) where place_id is not null;
create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);

alter table public.hotels enable row level security;
alter table public.transport_options enable row level security;
alter table public.favorites enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "public hotels readable" on public.hotels;
create policy "public hotels readable" on public.hotels for select to anon, authenticated using (true);

drop policy if exists "public transport readable" on public.transport_options;
create policy "public transport readable" on public.transport_options for select to anon, authenticated using (true);

drop policy if exists "users manage favorites" on public.favorites;
create policy "users manage favorites" on public.favorites for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users read notifications" on public.notifications;
create policy "users read notifications" on public.notifications for select to authenticated using (auth.uid() = user_id);

drop policy if exists "users update notifications" on public.notifications;
create policy "users update notifications" on public.notifications for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
