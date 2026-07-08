-- Custom dashboards built in the manage console and displayed on
-- sector and LGA pages.

create type "dashboard_scope" as enum ('sector', 'lga');
create type "dashboard_chart_type" as enum ('trend', 'bar', 'radar', 'stat');

create table "dashboards" (
  "id"          uuid primary key default gen_random_uuid(),
  "name"        text not null,
  "description" text,
  "scope"       dashboard_scope not null,
  "sector_id"   uuid references "sectors"("id") on delete cascade,
  "lga_id"      uuid references "lgas"("id") on delete cascade,
  "published"   boolean not null default true,
  "sort_order"  integer not null default 0,
  "created_at"  timestamptz not null default now()
);

create table "dashboard_widgets" (
  "id"            uuid primary key default gen_random_uuid(),
  "dashboard_id"  uuid not null references "dashboards"("id") on delete cascade,
  "chart_type"    dashboard_chart_type not null,
  "title"         text,
  "indicator_ids" jsonb not null default '[]',
  "span"          integer not null default 1,
  "position"      integer not null default 0,
  "created_at"    timestamptz not null default now()
);

create index "idx_dashboards_sector" on "dashboards"("sector_id");
create index "idx_dashboards_lga" on "dashboards"("lga_id");
create index "idx_dashboard_widgets_dashboard" on "dashboard_widgets"("dashboard_id");

-- Row Level Security: public read, writes via the service role only
-- (matches 1_rls_policies).
alter table dashboards enable row level security;
alter table dashboard_widgets enable row level security;
create policy "public read dashboards" on dashboards for select using (true);
create policy "public read dashboard_widgets" on dashboard_widgets for select using (true);
