-- Migration: create analyses table for animal health persistence
-- Run with: supabase db push  OR  supabase migrate new create_analyses && psql ...
-- Project ID: ththidbncdgdpolijgcu

create table if not exists public.analyses (
  id           text primary key,
  created_at   timestamptz not null default now(),
  user_id      uuid references auth.users(id) on delete set null,

  -- animal identity
  species       text not null,
  anatomy_class text not null,
  model_name    text,
  file_name     text,

  -- core metrics
  overall_health int,
  symmetry       int,
  lameness_risk  int,
  bcs            numeric,

  -- clinical notes
  vet_notes      text,

  -- structured AI output
  ai_scores      jsonb,

  -- diagnostic data
  alerts         jsonb,
  hotspots       jsonb,
  frame_count    int
);

-- index for user queries
create index if not exists analyses_user_id_idx on public.analyses(user_id);
create index if not exists analyses_created_at_idx on public.analyses(created_at desc);

-- Enable Row Level Security
alter table public.analyses enable row level security;

-- Users can only see their own analyses
create policy "Users can view own analyses"
  on public.analyses for select
  using (auth.uid() = user_id);

-- Users can insert their own analyses
create policy "Users can insert own analyses"
  on public.analyses for insert
  with check (auth.uid() = user_id);

-- Users can delete their own analyses
create policy "Users can delete own analyses"
  on public.analyses for delete
  using (auth.uid() = user_id);

-- anon + authenticated roles can invoke the analyze-animal edge function (already enforced by Supabase)
-- No separate policies needed for functions.
