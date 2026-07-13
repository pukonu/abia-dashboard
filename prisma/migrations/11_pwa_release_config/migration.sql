-- PWA remote release config (singleton). Service-role access only;
-- the public JSON surface is /api/pwa-config on the webapp.

create table if not exists pwa_release_config (
  id               text primary key default 'default',
  min_client_build text,
  latest_build     text,
  force_reload     boolean not null default false,
  force_reinstall  boolean not null default false,
  message          text,
  effective_at     timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

insert into pwa_release_config (id)
values ('default')
on conflict (id) do nothing;

alter table pwa_release_config enable row level security;
