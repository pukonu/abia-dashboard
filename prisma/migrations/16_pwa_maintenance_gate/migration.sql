-- Global PWA maintenance / operator-message gate. The existing release-config
-- API exposes this to clients; service-role writes are performed by Makefile
-- commands in pwa/scripts.
alter table pwa_release_config
  add column if not exists maintenance_active boolean not null default false,
  add column if not exists maintenance_message text;
