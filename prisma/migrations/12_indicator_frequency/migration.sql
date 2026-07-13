-- Per-indicator reporting frequency (daily/weekly/monthly/quarterly/yearly).
-- Defaults to monthly; operators can override per indicator in Manage.
-- Idempotent: safe if the column was added manually earlier.

alter table "indicators"
  add column if not exists "frequency" "frequency";

update "indicators" as i
set "frequency" = coalesce(i."frequency", ta."frequency", 'monthly'::"frequency")
from "domains" as d
join "thematic_areas" as ta on ta."id" = d."thematic_area_id"
where i."domain_id" = d."id"
  and i."frequency" is null;

update "indicators"
set "frequency" = 'monthly'::"frequency"
where "frequency" is null;
