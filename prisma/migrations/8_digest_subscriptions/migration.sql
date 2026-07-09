-- Weekly digest email subscribers.
-- Service-role only: no public SELECT/INSERT policies (unlike dashboard tables).

create table "digest_subscriptions" (
  "id"                 uuid primary key default gen_random_uuid(),
  "email"              text not null unique,
  "name"               text,
  "unsubscribe_token"  uuid not null unique default gen_random_uuid(),
  "subscribed_at"      timestamptz not null default now(),
  "unsubscribed_at"    timestamptz,
  "last_sent_at"       timestamptz,
  "created_at"         timestamptz not null default now()
);

create index "idx_digest_subscriptions_active" on "digest_subscriptions"("unsubscribed_at");

alter table digest_subscriptions enable row level security;
-- Intentionally no public policies: only the service role can read/write.
