-- ============================================================
-- SmartTrip AI
-- Initial Supabase PostgreSQL Schema
-- ============================================================

-- ============================================================
-- 1. EXTENSIONS
-- ============================================================

create extension if not exists "pgcrypto";


-- ============================================================
-- 2. HELPER FUNCTION: updated_at
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;


-- ============================================================
-- 3. PROFILES
-- ============================================================

create table if not exists public.profiles (
    id uuid primary key
        references auth.users(id)
        on delete cascade,

    display_name text,

    preferred_currency text
        not null
        default 'INR',

    created_at timestamptz
        not null
        default now(),

    updated_at timestamptz
        not null
        default now()
);


-- ============================================================
-- 4. DESTINATIONS
-- ============================================================

create table if not exists public.destinations (
    id uuid primary key
        default gen_random_uuid(),

    name text not null,

    country text,

    state text,

    city text,

    description text,

    latitude double precision,

    longitude double precision,

    categories text[]
        not null
        default '{}',

    image_url text,

    average_daily_cost numeric(12,2),

    created_at timestamptz
        not null
        default now(),

    updated_at timestamptz
        not null
        default now(),

    constraint destinations_latitude_check
        check (
            latitude is null
            or latitude between -90 and 90
        ),

    constraint destinations_longitude_check
        check (
            longitude is null
            or longitude between -180 and 180
        ),

    constraint destinations_cost_check
        check (
            average_daily_cost is null
            or average_daily_cost >= 0
        )
);


-- ============================================================
-- 5. PLACES
-- ============================================================

create table if not exists public.places (
    id uuid primary key
        default gen_random_uuid(),

    destination_id uuid not null
        references public.destinations(id)
        on delete cascade,

    name text not null,

    type text not null,

    description text,

    latitude double precision,

    longitude double precision,

    rating numeric(3,2),

    price_level smallint,

    opening_time time,

    closing_time time,

    provider text
        not null
        default 'database',

    provider_place_id text,

    created_at timestamptz
        not null
        default now(),

    constraint places_latitude_check
        check (
            latitude is null
            or latitude between -90 and 90
        ),

    constraint places_longitude_check
        check (
            longitude is null
            or longitude between -180 and 180
        ),

    constraint places_rating_check
        check (
            rating is null
            or rating between 0 and 5
        ),

    constraint places_price_level_check
        check (
            price_level is null
            or price_level between 0 and 4
        )
);


-- ============================================================
-- 6. TRIPS
-- ============================================================

create table if not exists public.trips (
    id uuid primary key
        default gen_random_uuid(),

    user_id uuid not null
        references auth.users(id)
        on delete cascade,

    origin text not null,

    destination_id uuid
        references public.destinations(id)
        on delete set null,

    destination_name text,

    start_date date,

    end_date date,

    days integer not null,

    travelers integer not null,

    budget numeric(12,2) not null,

    travel_style text not null,

    interests text[]
        not null
        default '{}',

    special_requirements text,

    status text
        not null
        default 'draft',

    created_at timestamptz
        not null
        default now(),

    updated_at timestamptz
        not null
        default now(),

    constraint trips_days_check
        check (days between 1 and 30),

    constraint trips_travelers_check
        check (travelers between 1 and 20),

    constraint trips_budget_check
        check (budget > 0),

    constraint trips_travel_style_check
        check (
            travel_style in (
                'Budget',
                'Comfort',
                'Premium'
            )
        ),

    constraint trips_status_check
        check (
            status in (
                'draft',
                'planned',
                'archived'
            )
        ),

    constraint trips_dates_check
        check (
            start_date is null
            or end_date is null
            or end_date >= start_date
        ),

    constraint trips_destination_check
        check (
            destination_id is not null
            or destination_name is not null
        )
);


-- ============================================================
-- 7. ITINERARY DAYS
-- ============================================================

create table if not exists public.itinerary_days (
    id uuid primary key
        default gen_random_uuid(),

    trip_id uuid not null
        references public.trips(id)
        on delete cascade,

    day_number integer not null,

    date date,

    title text not null,

    summary text,

    created_at timestamptz
        not null
        default now(),

    updated_at timestamptz
        not null
        default now(),

    constraint itinerary_days_number_check
        check (day_number > 0),

    constraint itinerary_days_unique
        unique (trip_id, day_number)
);


-- ============================================================
-- 8. ITINERARY ITEMS
-- ============================================================

create table if not exists public.itinerary_items (
    id uuid primary key
        default gen_random_uuid(),

    itinerary_day_id uuid not null
        references public.itinerary_days(id)
        on delete cascade,

    place_id uuid
        references public.places(id)
        on delete set null,

    title text not null,

    type text not null,

    start_time time,

    end_time time,

    duration_minutes integer,

    estimated_cost numeric(12,2)
        not null
        default 0,

    latitude double precision,

    longitude double precision,

    notes text,

    order_index integer
        not null
        default 0,

    created_at timestamptz
        not null
        default now(),

    updated_at timestamptz
        not null
        default now(),

    constraint itinerary_items_duration_check
        check (
            duration_minutes is null
            or duration_minutes > 0
        ),

    constraint itinerary_items_cost_check
        check (
            estimated_cost >= 0
        ),

    constraint itinerary_items_order_check
        check (
            order_index >= 0
        ),

    constraint itinerary_items_time_check
        check (
            start_time is null
            or end_time is null
            or end_time >= start_time
        ),

    constraint itinerary_items_latitude_check
        check (
            latitude is null
            or latitude between -90 and 90
        ),

    constraint itinerary_items_longitude_check
        check (
            longitude is null
            or longitude between -180 and 180
        )
);


-- ============================================================
-- 9. TRIP BUDGET
-- ============================================================

create table if not exists public.trip_budget (
    id uuid primary key
        default gen_random_uuid(),

    trip_id uuid unique not null
        references public.trips(id)
        on delete cascade,

    transport numeric(12,2)
        not null
        default 0,

    hotel numeric(12,2)
        not null
        default 0,

    food numeric(12,2)
        not null
        default 0,

    local_transport numeric(12,2)
        not null
        default 0,

    activities numeric(12,2)
        not null
        default 0,

    buffer numeric(12,2)
        not null
        default 0,

    total numeric(12,2)
        not null
        default 0,

    remaining numeric(12,2)
        not null
        default 0,

    currency text
        not null
        default 'INR',

    created_at timestamptz
        not null
        default now(),

    updated_at timestamptz
        not null
        default now(),

    constraint trip_budget_transport_check
        check (transport >= 0),

    constraint trip_budget_hotel_check
        check (hotel >= 0),

    constraint trip_budget_food_check
        check (food >= 0),

    constraint trip_budget_local_transport_check
        check (local_transport >= 0),

    constraint trip_budget_activities_check
        check (activities >= 0),

    constraint trip_budget_buffer_check
        check (buffer >= 0),

    constraint trip_budget_total_check
        check (total >= 0)
);


-- ============================================================
-- 10. SAVED PLACES
-- ============================================================

create table if not exists public.saved_places (
    user_id uuid not null
        references auth.users(id)
        on delete cascade,

    place_id uuid not null
        references public.places(id)
        on delete cascade,

    created_at timestamptz
        not null
        default now(),

    primary key (user_id, place_id)
);


-- ============================================================
-- 11. TRIP MESSAGES
-- ============================================================

create table if not exists public.trip_messages (
    id uuid primary key
        default gen_random_uuid(),

    trip_id uuid not null
        references public.trips(id)
        on delete cascade,

    user_id uuid not null
        references auth.users(id)
        on delete cascade,

    role text not null,

    content text not null,

    created_at timestamptz
        not null
        default now(),

    constraint trip_messages_role_check
        check (
            role in (
                'user',
                'assistant',
                'system'
            )
        )
);


-- ============================================================
-- 12. INDEXES
-- ============================================================

create index if not exists destinations_name_idx
on public.destinations
using gin (
    to_tsvector('simple', name)
);


create index if not exists destinations_country_idx
on public.destinations(country);


create index if not exists destinations_city_idx
on public.destinations(city);


create index if not exists places_destination_idx
on public.places(destination_id);


create index if not exists places_type_idx
on public.places(type);


create index if not exists places_provider_idx
on public.places(provider);


create index if not exists trips_user_idx
on public.trips(user_id, created_at desc);


create index if not exists trips_status_idx
on public.trips(user_id, status);


create index if not exists itinerary_days_trip_idx
on public.itinerary_days(trip_id, day_number);


create index if not exists itinerary_items_day_idx
on public.itinerary_items(
    itinerary_day_id,
    order_index
);


create index if not exists trip_messages_trip_idx
on public.trip_messages(
    trip_id,
    created_at
);


create index if not exists saved_places_user_idx
on public.saved_places(user_id);


-- ============================================================
-- 13. UNIQUE PROVIDER PLACE
-- ============================================================

create unique index if not exists places_provider_place_unique_idx
on public.places(provider, provider_place_id)
where provider_place_id is not null;


-- ============================================================
-- 14. ENABLE ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles
enable row level security;

alter table public.destinations
enable row level security;

alter table public.places
enable row level security;

alter table public.trips
enable row level security;

alter table public.itinerary_days
enable row level security;

alter table public.itinerary_items
enable row level security;

alter table public.trip_budget
enable row level security;

alter table public.saved_places
enable row level security;

alter table public.trip_messages
enable row level security;


-- ============================================================
-- 15. PROFILE POLICIES
-- ============================================================

drop policy if exists "users manage own profile"
on public.profiles;

create policy "users manage own profile"
on public.profiles
for all
to authenticated
using (
    auth.uid() = id
)
with check (
    auth.uid() = id
);


-- ============================================================
-- 16. DESTINATION POLICIES
-- ============================================================

drop policy if exists "public destinations readable"
on public.destinations;

create policy "public destinations readable"
on public.destinations
for select
to anon, authenticated
using (true);


-- ============================================================
-- 17. PLACE POLICIES
-- ============================================================

drop policy if exists "public places readable"
on public.places;

create policy "public places readable"
on public.places
for select
to anon, authenticated
using (true);


-- ============================================================
-- 18. TRIP POLICIES
-- ============================================================

drop policy if exists "users manage own trips"
on public.trips;

create policy "users manage own trips"
on public.trips
for all
to authenticated
using (
    auth.uid() = user_id
)
with check (
    auth.uid() = user_id
);


-- ============================================================
-- 19. ITINERARY DAY POLICIES
-- ============================================================

drop policy if exists "users manage own days"
on public.itinerary_days;

create policy "users manage own days"
on public.itinerary_days
for all
to authenticated
using (
    exists (
        select 1
        from public.trips
        where trips.id = itinerary_days.trip_id
        and trips.user_id = auth.uid()
    )
)
with check (
    exists (
        select 1
        from public.trips
        where trips.id = itinerary_days.trip_id
        and trips.user_id = auth.uid()
    )
);


-- ============================================================
-- 20. ITINERARY ITEM POLICIES
-- ============================================================

drop policy if exists "users manage own items"
on public.itinerary_items;

create policy "users manage own items"
on public.itinerary_items
for all
to authenticated
using (
    exists (
        select 1
        from public.itinerary_days
        join public.trips
            on trips.id = itinerary_days.trip_id
        where itinerary_days.id =
              itinerary_items.itinerary_day_id
        and trips.user_id = auth.uid()
    )
)
with check (
    exists (
        select 1
        from public.itinerary_days
        join public.trips
            on trips.id = itinerary_days.trip_id
        where itinerary_days.id =
              itinerary_items.itinerary_day_id
        and trips.user_id = auth.uid()
    )
);


-- ============================================================
-- 21. TRIP BUDGET POLICIES
-- ============================================================

drop policy if exists "users manage own budgets"
on public.trip_budget;

create policy "users manage own budgets"
on public.trip_budget
for all
to authenticated
using (
    exists (
        select 1
        from public.trips
        where trips.id = trip_budget.trip_id
        and trips.user_id = auth.uid()
    )
)
with check (
    exists (
        select 1
        from public.trips
        where trips.id = trip_budget.trip_id
        and trips.user_id = auth.uid()
    )
);


-- ============================================================
-- 22. SAVED PLACE POLICIES
-- ============================================================

drop policy if exists "users manage saved places"
on public.saved_places;

create policy "users manage saved places"
on public.saved_places
for all
to authenticated
using (
    auth.uid() = user_id
)
with check (
    auth.uid() = user_id
);


-- ============================================================
-- 23. TRIP MESSAGE POLICIES
-- ============================================================

drop policy if exists "users manage own trip messages"
on public.trip_messages;

create policy "users manage own trip messages"
on public.trip_messages
for all
to authenticated
using (
    auth.uid() = user_id
    and exists (
        select 1
        from public.trips
        where trips.id = trip_messages.trip_id
        and trips.user_id = auth.uid()
    )
)
with check (
    auth.uid() = user_id
    and exists (
        select 1
        from public.trips
        where trips.id = trip_messages.trip_id
        and trips.user_id = auth.uid()
    )
);


-- ============================================================
-- 24. UPDATED_AT TRIGGERS
-- ============================================================

drop trigger if exists profiles_updated_at
on public.profiles;

create trigger profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();


drop trigger if exists destinations_updated_at
on public.destinations;

create trigger destinations_updated_at
before update on public.destinations
for each row
execute function public.set_updated_at();


drop trigger if exists trips_updated_at
on public.trips;

create trigger trips_updated_at
before update on public.trips
for each row
execute function public.set_updated_at();


drop trigger if exists itinerary_days_updated_at
on public.itinerary_days;

create trigger itinerary_days_updated_at
before update on public.itinerary_days
for each row
execute function public.set_updated_at();


drop trigger if exists itinerary_items_updated_at
on public.itinerary_items;

create trigger itinerary_items_updated_at
before update on public.itinerary_items
for each row
execute function public.set_updated_at();


drop trigger if exists trip_budget_updated_at
on public.trip_budget;

create trigger trip_budget_updated_at
before update on public.trip_budget
for each row
execute function public.set_updated_at();


-- ============================================================
-- 25. AUTOMATIC PROFILE CREATION
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin

    insert into public.profiles (
        id,
        display_name
    )
    values (
        new.id,
        coalesce(
            new.raw_user_meta_data ->> 'display_name',
            new.raw_user_meta_data ->> 'full_name',
            split_part(new.email, '@', 1)
        )
    )
    on conflict (id) do nothing;

    return new;

end;
$$;


drop trigger if exists on_auth_user_created
on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();


-- ============================================================
-- 26. MIGRATION COMPLETE
-- ============================================================