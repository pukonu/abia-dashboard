-- Responsible MDA for each indicator (who reports / owns the data).
-- Idempotent: safe if already applied manually.

alter table "indicators"
  add column if not exists "responsible_mda_id" uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'indicators_responsible_mda_id_fkey'
  ) then
    alter table "indicators"
      add constraint "indicators_responsible_mda_id_fkey"
      foreign key ("responsible_mda_id") references "mdas"("id")
      on delete set null on update cascade;
  end if;
end $$;

create index if not exists "idx_indicators_responsible_mda"
  on "indicators"("responsible_mda_id");
