-- Default indicator reporting frequency to monthly; nulls become monthly.
-- Idempotent: safe if already applied manually.

alter table "indicators"
  alter column "frequency" set default 'monthly'::"frequency";

update "indicators"
set "frequency" = 'monthly'::"frequency"
where "frequency" is null;
