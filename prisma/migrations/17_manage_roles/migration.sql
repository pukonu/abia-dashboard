-- Explicit management-console roles. Existing accounts retain their current
-- effective access by becoming Super Admins; newly-created accounts are
-- assigned an explicit role by a Super Admin.
create type manage_role as enum ('super_admin', 'data_analyst', 'mda_admin', 'guest');

create table manage_user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role manage_role not null default 'guest',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table manage_user_mdas (
  user_id uuid not null references auth.users(id) on delete cascade,
  mda_id uuid not null references mdas(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, mda_id)
);

-- Before this migration every existing signed-in account could manage all data.
-- Preserve that access, while all accounts created after deployment must be
-- deliberately assigned a role.
insert into manage_user_roles (user_id, role)
select id, 'super_admin'::manage_role from auth.users
on conflict (user_id) do nothing;

alter table manage_user_roles enable row level security;
alter table manage_user_mdas enable row level security;

create index idx_manage_user_mdas_mda_id on manage_user_mdas (mda_id);
