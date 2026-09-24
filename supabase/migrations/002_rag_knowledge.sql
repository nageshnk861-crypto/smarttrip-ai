-- SmartTrip destination knowledge for semantic retrieval.
-- Run this migration only after enabling pgvector in the Supabase project.

create extension if not exists vector;

create table if not exists public.destination_knowledge (
    id uuid primary key default gen_random_uuid(),
    destination_id uuid references public.destinations(id) on delete cascade,
    title text not null,
    content text not null,
    source text not null default 'curated',
    embedding vector(1536),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists destination_knowledge_embedding_idx
on public.destination_knowledge
using hnsw (embedding vector_cosine_ops);

alter table public.destination_knowledge enable row level security;

drop policy if exists "public destination knowledge readable"
on public.destination_knowledge;

create policy "public destination knowledge readable"
on public.destination_knowledge
for select
to anon, authenticated
using (true);

create or replace function public.match_destination_knowledge(
    query_embedding vector(1536),
    match_count integer default 5
)
returns table (
    id uuid,
    destination_id uuid,
    title text,
    content text,
    source text,
    similarity double precision
)
language sql
stable
as $$
    select
        knowledge.id,
        knowledge.destination_id,
        knowledge.title,
        knowledge.content,
        knowledge.source,
        1 - (knowledge.embedding <=> query_embedding) as similarity
    from public.destination_knowledge as knowledge
    where knowledge.embedding is not null
    order by knowledge.embedding <=> query_embedding
    limit greatest(match_count, 1);
$$;