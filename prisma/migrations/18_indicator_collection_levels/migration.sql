-- Indicator collection levels, per-indicator roll-up methods, LGA-level
-- results and manual statewide overrides.
--
-- Each indicator now says where its data is collected (state, LGA or
-- facility) and how lower-level records combine into the statewide figure.
-- Roll-ups are computed when dashboards load (src/lib/scoring.ts), so this
-- replaces both the old entity-indicator "rolls up into" link and the
-- webapp's write-time cascade. A statewide result on an LGA- or
-- facility-collected indicator is a manual override: it always wins for its
-- period and records who entered it and why.
--
-- Every row this migration removes or rewrites is copied first into
-- results_migration_18_backup / indicators_migration_18_backup.

begin;

/* ------------------------------------------------------------------ */
/* 1. Settings and columns                                             */
/* ------------------------------------------------------------------ */

create type indicator_collected_at as enum ('state', 'lga', 'facility');
create type indicator_rollup_method as enum (
  'sum', 'count', 'average', 'weighted_average', 'max', 'min', 'none'
);
create type indicator_count_operator as enum ('gte', 'gt', 'eq', 'lte', 'lt');

alter table indicators
  add column collected_at indicator_collected_at not null default 'state',
  add column rollup_method indicator_rollup_method not null default 'average',
  -- Count roll-ups: a record qualifies when value <op> threshold, or when its
  -- value is one of count_values (score options such as Yes = 100).
  add column count_operator indicator_count_operator,
  add column count_threshold numeric,
  add column count_values numeric[],
  -- Per-level targets; when null, LGA targets for sum/count indicators are
  -- derived from the state target by population share.
  add column lga_target_value numeric,
  add column facility_target_value numeric;

alter table results
  add column lga_id uuid references lgas(id) on delete cascade on update cascade,
  add column entered_by text,
  add column override_note text,
  add constraint results_single_location check (entity_id is null or lga_id is null);

create index idx_results_lga on results(lga_id);

create table results_migration_18_backup as
  select r.*, ''::text as backup_reason, now() as backed_up_at from results r where false;
create table indicators_migration_18_backup as
  select i.*, ''::text as backup_reason, now() as backed_up_at from indicators i where false;
alter table results_migration_18_backup enable row level security;
alter table indicators_migration_18_backup enable row level security;

/* ------------------------------------------------------------------ */
/* 2. Fold entity indicators into the new model                        */
/* ------------------------------------------------------------------ */

-- Linked entity indicator → the state indicator it rolled up into.
create temporary table rollup_links on commit drop as
  select child.id as child_id, parent.id as parent_id
    from indicators child
    join indicators parent on parent.id = child.state_indicator_id
   where child.indicator_scope = 'entity'
     and parent.indicator_scope = 'state';

-- Parents become facility-collected, averaging like the old cascade did.
-- Facility targets come from the children when they agree on one.
update indicators p
   set collected_at = 'facility',
       rollup_method = 'average',
       facility_target_value = (
         select case when count(distinct c.target_value) = 1 then max(c.target_value) end
           from rollup_links l join indicators c on c.id = l.child_id
          where l.parent_id = p.id
       )
 where p.id in (select parent_id from rollup_links);

-- Standalone entity indicators stay facility-only: visible on entity, MDA
-- and LGA pages, never part of the statewide score (as before).
update indicators
   set collected_at = 'facility',
       rollup_method = 'none',
       facility_target_value = target_value
 where indicator_scope = 'entity'
   and id not in (select child_id from rollup_links);

-- Children's facility results move onto the parent. Where two results would
-- land on the same (parent, period, facility), keep the most recent one and
-- re-point the other's evidence to it.
create temporary table moved_results on commit drop as
  select r.id, l.parent_id, r.time_period_id, r.entity_id,
         row_number() over (
           partition by l.parent_id, r.time_period_id, r.entity_id
           order by r.updated_at desc, r.created_at desc, r.id
         ) as rank
    from results r
    join rollup_links l on l.child_id = r.indicator_id
   where r.entity_id is not null;

update result_evidence ev
   set result_id = keep.id
  from moved_results dup
  join moved_results keep
    on keep.parent_id = dup.parent_id
   and keep.time_period_id = dup.time_period_id
   and keep.entity_id = dup.entity_id
   and keep.rank = 1
 where ev.result_id = dup.id and dup.rank > 1;

insert into results_migration_18_backup
  select r.*, 'duplicate facility result when merging linked entity indicators', now()
    from results r join moved_results m on m.id = r.id
   where m.rank > 1;
delete from results where id in (select id from moved_results where rank > 1);

insert into results_migration_18_backup
  select r.*, 'moved from linked entity indicator to its state indicator', now()
    from results r where id in (select id from moved_results where rank = 1);
update results r
   set indicator_id = m.parent_id
  from moved_results m
 where m.id = r.id and m.rank = 1;

-- Statewide rows the old webapp cascade generated are now computed live.
insert into results_migration_18_backup
  select r.*, 'auto-aggregated statewide row replaced by live roll-up', now()
    from results r
   where r.entity_id is null
     and r.notes = 'Auto-aggregated from linked entity-level indicator results.'
     and r.indicator_id in (select parent_id from rollup_links);
delete from results
 where entity_id is null
   and notes = 'Auto-aggregated from linked entity-level indicator results.'
   and indicator_id in (select parent_id from rollup_links);

-- Any remaining statewide value on those indicators was typed in by hand:
-- it becomes an explicit override.
update results
   set override_note = 'Statewide value recorded before collection levels were introduced.'
 where entity_id is null
   and indicator_id in (select parent_id from rollup_links)
   and override_note is null;

-- Dashboard widgets that charted a merged child now chart its parent.
update dashboard_widgets w
   set indicator_ids = (
     select coalesce(jsonb_agg(distinct coalesce(l.parent_id::text, x.id)), '[]'::jsonb)
       from jsonb_array_elements_text(w.indicator_ids) as x(id)
       left join rollup_links l on l.child_id::text = x.id
   )
 where exists (
   select 1 from jsonb_array_elements_text(w.indicator_ids) as x(id)
    where x.id in (select child_id::text from rollup_links)
 );

insert into indicators_migration_18_backup
  select i.*, 'linked entity indicator merged into its state indicator', now()
    from indicators i where id in (select child_id from rollup_links);
delete from indicators where id in (select child_id from rollup_links);

/* ------------------------------------------------------------------ */
/* 3. Legacy scope column, kept in step for older clients              */
/* ------------------------------------------------------------------ */

update indicators set state_indicator_id = null where state_indicator_id is not null;
update indicators
   set indicator_scope = case when collected_at = 'facility' then 'entity'::indicator_scope
                              else 'state'::indicator_scope end;

create function indicators_sync_legacy_scope() returns trigger
language plpgsql as $$
begin
  new.indicator_scope := case when new.collected_at = 'facility'
                              then 'entity'::indicator_scope
                              else 'state'::indicator_scope end;
  new.state_indicator_id := null;
  return new;
end $$;

create trigger indicators_sync_legacy_scope
  before insert or update on indicators
  for each row execute function indicators_sync_legacy_scope();

/* ------------------------------------------------------------------ */
/* 4. One result per indicator, period and location                    */
/* ------------------------------------------------------------------ */

create temporary table duplicate_results on commit drop as
  select id, keep_id from (
    select id,
           first_value(id) over w as keep_id,
           row_number() over w as rank
      from results
    window w as (
      partition by indicator_id, time_period_id, entity_id, lga_id
      order by updated_at desc, created_at desc, id
    )
  ) ranked
  where rank > 1;

update result_evidence ev
   set result_id = d.keep_id
  from duplicate_results d
 where ev.result_id = d.id;

insert into results_migration_18_backup
  select r.*, 'duplicate result for the same indicator, period and location', now()
    from results r where id in (select id from duplicate_results);
delete from results where id in (select id from duplicate_results);

create unique index results_unique_state
  on results(indicator_id, time_period_id)
  where entity_id is null and lga_id is null;
create unique index results_unique_lga
  on results(indicator_id, time_period_id, lga_id)
  where lga_id is not null;
create unique index results_unique_entity
  on results(indicator_id, time_period_id, entity_id)
  where entity_id is not null;

/* ------------------------------------------------------------------ */
/* 5. Field capture permissions                                        */
/* ------------------------------------------------------------------ */

-- LGA officers enter LGA returns and facility results inside their LGAs.
alter type manage_role add value if not exists 'lga_officer';

create table manage_user_lgas (
  user_id uuid not null references auth.users(id) on delete cascade,
  lga_id uuid not null references lgas(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, lga_id)
);
alter table manage_user_lgas enable row level security;
create index idx_manage_user_lgas_lga_id on manage_user_lgas (lga_id);

-- Whether the signed-in user may write a result at this location. The
-- webapp writes with the service role (bypasses RLS); this governs the PWA
-- and native app, which write as the signed-in user.
create function can_write_result(p_indicator uuid, p_entity uuid, p_lga uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select case r.role::text
      when 'super_admin' then true
      when 'data_analyst' then true
      when 'mda_admin' then
        case
          when p_entity is not null then exists (
            select 1 from entities e
              join manage_user_mdas m on m.mda_id = e.mda_id and m.user_id = auth.uid()
             where e.id = p_entity)
          else exists (
            select 1 from indicators i
              join manage_user_mdas m on m.mda_id = i.responsible_mda_id and m.user_id = auth.uid()
             where i.id = p_indicator)
        end
      when 'lga_officer' then
        case
          when p_lga is not null then exists (
            select 1 from manage_user_lgas l where l.user_id = auth.uid() and l.lga_id = p_lga)
          when p_entity is not null then exists (
            select 1 from entities e
              join manage_user_lgas l on l.lga_id = e.lga_id and l.user_id = auth.uid()
             where e.id = p_entity)
          else false
        end
      else false
    end
    from manage_user_roles r where r.user_id = auth.uid()
  ), false)
$$;

create policy "capture insert results" on results for insert to authenticated
  with check (can_write_result(indicator_id, entity_id, lga_id));
create policy "capture update results" on results for update to authenticated
  using (can_write_result(indicator_id, entity_id, lga_id))
  with check (can_write_result(indicator_id, entity_id, lga_id));
create policy "capture delete results" on results for delete to authenticated
  using (can_write_result(indicator_id, entity_id, lga_id));

create policy "capture insert result evidence" on result_evidence for insert to authenticated
  with check (exists (
    select 1 from results r
     where r.id = result_id and can_write_result(r.indicator_id, r.entity_id, r.lga_id)));

-- Stamp who last entered each result for writes made as a signed-in user
-- (PWA / native). Service-role writes (webapp) pass entered_by themselves.
create function results_stamp_entered_by() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    select coalesce(u.raw_user_meta_data->>'full_name', u.email)
      into new.entered_by
      from auth.users u where u.id = auth.uid();
  end if;
  return new;
end $$;

create trigger results_stamp_entered_by
  before insert or update on results
  for each row execute function results_stamp_entered_by();

-- Evidence photos: field users may upload into <result id>/ folders of the
-- evidence bucket for results they can write. Skipped outside Supabase.
do $$
begin
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
              where n.nspname = 'storage' and c.relname = 'objects') then
    execute $policy$
      create policy "capture upload evidence" on storage.objects for insert to authenticated
        with check (
          bucket_id = 'evidence'
          and exists (
            select 1 from public.results r
             where r.id::text = (storage.foldername(name))[1]
               and public.can_write_result(r.indicator_id, r.entity_id, r.lga_id)))
    $policy$;
  end if;
end $$;

commit;
