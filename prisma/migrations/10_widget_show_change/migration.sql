-- Stat widgets can show a period-over-period change indicator (▲/▼/steady).
-- Default is simple view (no change indicator). Existing widgets stay simple.
alter table "dashboard_widgets"
  add column if not exists "show_change" boolean not null default false;
