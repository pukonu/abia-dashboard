-- Manual executive facts shown on sector landing pages.
-- These are for curated numbers that may not come from entity-level results yet
-- (for example enrolment totals, investment pipeline values, or programme reach).

create table "sector_facts" (
  "id"         uuid primary key default gen_random_uuid(),
  "sector_id" uuid not null references "sectors"("id") on delete cascade,
  "label"      text not null,
  "value"      text not null,
  "caption"    text,
  "source"     text,
  "sort_order" integer not null default 0,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);

create index "idx_sector_facts_sector" on "sector_facts"("sector_id");

alter table sector_facts enable row level security;
create policy "public read sector_facts" on sector_facts for select using (true);
