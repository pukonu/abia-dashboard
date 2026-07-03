-- =============================================================
-- Abia State Dashboard — Supabase Schema
-- Run with: supabase db push  (or paste into the SQL editor)
-- =============================================================

-- ---------- Reference layers ----------

create table if not exists sectors (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  description text,
  icon        text,            -- emoji or icon key used by the UI
  color       text,            -- hex accent color used by the UI
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists lgas (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  zone       text,             -- senatorial zone: Abia North / Central / South
  population int,
  created_at timestamptz not null default now()
);

create table if not exists mdas (
  id           uuid primary key default gen_random_uuid(),
  sector_id    uuid not null references sectors(id) on delete cascade,
  name         text not null,
  abbreviation text,
  description  text,
  created_at   timestamptz not null default now(),
  unique (sector_id, name)
);

-- Entity: the concrete unit being measured (a school, hospital, road project…)
create table if not exists entities (
  id          uuid primary key default gen_random_uuid(),
  mda_id      uuid not null references mdas(id) on delete cascade,
  lga_id      uuid not null references lgas(id) on delete restrict,
  name        text not null,
  entity_type text,            -- e.g. 'Hospital', 'School', 'Police Division'
  description text,
  created_at  timestamptz not null default now(),
  unique (mda_id, name)
);

-- ---------- Measurement framework ----------

create type frequency as enum ('daily', 'weekly', 'monthly', 'quarterly', 'yearly');
create type direction as enum ('higher_is_better', 'lower_is_better');

create table if not exists thematic_areas (
  id          uuid primary key default gen_random_uuid(),
  sector_id   uuid not null references sectors(id) on delete cascade,
  name        text not null,
  description text,
  frequency   frequency not null default 'quarterly',
  weight      numeric not null default 1,   -- weight within the sector
  created_at  timestamptz not null default now(),
  unique (sector_id, name)
);

create table if not exists domains (
  id               uuid primary key default gen_random_uuid(),
  thematic_area_id uuid not null references thematic_areas(id) on delete cascade,
  name             text not null,
  description      text,
  benchmark_nigeria text,                       -- national comparison value, free text
  benchmark_target  text,                       -- official target, free text
  weight           numeric not null default 1,  -- weight within the thematic area
  created_at       timestamptz not null default now(),
  unique (thematic_area_id, name)
);

create table if not exists indicators (
  id            uuid primary key default gen_random_uuid(),
  domain_id     uuid not null references domains(id) on delete cascade,
  name          text not null,
  description   text,
  unit          text not null default '%',       -- '%', 'per 1,000', 'count', 'NGN bn' …
  direction     direction not null default 'higher_is_better',
  target_value  numeric,                          -- default target (SDG/WHO/UN/state plan)
  target_source text,                             -- 'SDG', 'WHO', 'UN', 'National Plan' …
  weight        numeric not null default 1,       -- weight within the domain
  created_at    timestamptz not null default now(),
  unique (domain_id, name)
);

-- Time periods — one row per measured window, keyed by frequency
create table if not exists time_periods (
  id         uuid primary key default gen_random_uuid(),
  frequency  frequency not null,
  label      text not null,        -- '2026 Q1', 'Mar 2026', '2025', 'W12 2026', '2026-03-14'
  start_date date not null,
  end_date   date not null,
  unique (frequency, start_date)
);

-- ---------- Results ----------

create table if not exists results (
  id             uuid primary key default gen_random_uuid(),
  indicator_id   uuid not null references indicators(id) on delete cascade,
  time_period_id uuid not null references time_periods(id) on delete cascade,
  entity_id      uuid references entities(id) on delete cascade,  -- null = state-level result
  abia_value     numeric not null,   -- the main input: Abia State's measured value
  nigeria_value  numeric,            -- national comparison value
  target_value   numeric,            -- period-specific override of indicator target
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique nulls not distinct (indicator_id, time_period_id, entity_id)
);

-- Evidence images backing a result (stored in the Storage bucket
-- named by NEXT_PUBLIC_EVIDENCE_BUCKET, default "evidence").
create table if not exists result_evidence (
  id           uuid primary key default gen_random_uuid(),
  result_id    uuid not null references results(id) on delete cascade,
  storage_path text not null,
  caption      text,
  uploaded_at  timestamptz not null default now()
);

create index if not exists idx_result_evidence_result on result_evidence(result_id);

create index if not exists idx_results_indicator on results(indicator_id);
create index if not exists idx_results_period    on results(time_period_id);
create index if not exists idx_results_entity    on results(entity_id);
create index if not exists idx_entities_lga      on entities(lga_id);
create index if not exists idx_entities_mda      on entities(mda_id);

-- ---------- Row Level Security ----------
-- Read-only for anonymous dashboard viewers; writes via service role
-- (or extend with authenticated policies for data-entry users).

alter table sectors        enable row level security;
alter table lgas           enable row level security;
alter table mdas           enable row level security;
alter table entities       enable row level security;
alter table thematic_areas enable row level security;
alter table domains        enable row level security;
alter table indicators     enable row level security;
alter table time_periods   enable row level security;
alter table results        enable row level security;

do $$
declare t text;
begin
  foreach t in array array['sectors','lgas','mdas','entities','thematic_areas',
                           'domains','indicators','time_periods','results',
                           'result_evidence'] loop
    execute format('create policy "public read %1$s" on %1$s for select using (true);', t);
  end loop;
end $$;
