-- Split indicators into state-level and entity-level records.
CREATE TYPE "indicator_scope" AS ENUM ('state', 'entity');

ALTER TABLE "indicators"
  ADD COLUMN "indicator_scope" "indicator_scope" NOT NULL DEFAULT 'state',
  ADD COLUMN "state_indicator_id" UUID;

ALTER TABLE "indicators"
  ADD CONSTRAINT "indicators_state_indicator_id_fkey"
  FOREIGN KEY ("state_indicator_id") REFERENCES "indicators"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

DROP INDEX IF EXISTS "indicators_domain_id_name_key";
CREATE UNIQUE INDEX "indicators_domain_id_name_indicator_scope_key"
  ON "indicators"("domain_id", "name", "indicator_scope");
CREATE INDEX "idx_indicators_state_indicator"
  ON "indicators"("state_indicator_id");
