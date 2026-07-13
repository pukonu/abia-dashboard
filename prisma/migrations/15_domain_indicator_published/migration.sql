-- Publish flags for domains and indicators (default published).
-- Unpublishing a domain hides its indicators on public views (query-time cascade).
-- Idempotent.

alter table "domains"
  add column if not exists "is_published" boolean not null default true;

alter table "indicators"
  add column if not exists "is_published" boolean not null default true;
