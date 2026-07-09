-- Flag which thematic area is the executive "sector dashboard" for a sector.
-- At most one per sector (partial unique index). Existing rows named
-- "Sector Dashboard" are backfilled automatically.

alter table "thematic_areas"
  add column "is_sector_dashboard" boolean not null default false;

update "thematic_areas"
set "is_sector_dashboard" = true
where lower(trim("name")) = 'sector dashboard';

-- One sector dashboard thematic area per sector.
create unique index "thematic_areas_one_sector_dashboard_per_sector"
  on "thematic_areas" ("sector_id")
  where "is_sector_dashboard" = true;
