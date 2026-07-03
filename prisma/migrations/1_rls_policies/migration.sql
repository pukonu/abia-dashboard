-- Enable Row Level Security with public read access for dashboard viewers.
-- Writes go through the server using the Supabase service role key,
-- which bypasses RLS.

alter table sectors         enable row level security;
alter table lgas            enable row level security;
alter table mdas            enable row level security;
alter table entities        enable row level security;
alter table thematic_areas  enable row level security;
alter table domains         enable row level security;
alter table indicators      enable row level security;
alter table time_periods    enable row level security;
alter table results         enable row level security;
alter table result_evidence enable row level security;

do $$
declare t text;
begin
  foreach t in array array['sectors','lgas','mdas','entities','thematic_areas',
                           'domains','indicators','time_periods','results',
                           'result_evidence'] loop
    execute format('create policy "public read %1$s" on %1$s for select using (true);', t);
  end loop;
end $$;
