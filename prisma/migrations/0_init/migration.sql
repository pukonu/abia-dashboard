-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "frequency" AS ENUM ('daily', 'weekly', 'monthly', 'quarterly', 'yearly');

-- CreateEnum
CREATE TYPE "direction" AS ENUM ('higher_is_better', 'lower_is_better');

-- CreateTable
CREATE TABLE "sectors" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sectors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lgas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "zone" TEXT,
    "population" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lgas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mdas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sector_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "abbreviation" TEXT,
    "description" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mdas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "mda_id" UUID NOT NULL,
    "lga_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "entity_type" TEXT,
    "description" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "thematic_areas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sector_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "frequency" "frequency" NOT NULL DEFAULT 'quarterly',
    "weight" DECIMAL NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "thematic_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "domains" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "thematic_area_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "weight" DECIMAL NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "domains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "indicators" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "domain_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT NOT NULL DEFAULT '%',
    "direction" "direction" NOT NULL DEFAULT 'higher_is_better',
    "target_value" DECIMAL,
    "target_source" TEXT,
    "weight" DECIMAL NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "indicators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_periods" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "frequency" "frequency" NOT NULL,
    "label" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,

    CONSTRAINT "time_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "results" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "indicator_id" UUID NOT NULL,
    "time_period_id" UUID NOT NULL,
    "entity_id" UUID,
    "abia_value" DECIMAL NOT NULL,
    "nigeria_value" DECIMAL,
    "target_value" DECIMAL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "result_evidence" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "result_id" UUID NOT NULL,
    "storage_path" TEXT NOT NULL,
    "caption" TEXT,
    "uploaded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "result_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sectors_slug_key" ON "sectors"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "lgas_name_key" ON "lgas"("name");

-- CreateIndex
CREATE UNIQUE INDEX "mdas_sector_id_name_key" ON "mdas"("sector_id", "name");

-- CreateIndex
CREATE INDEX "idx_entities_lga" ON "entities"("lga_id");

-- CreateIndex
CREATE INDEX "idx_entities_mda" ON "entities"("mda_id");

-- CreateIndex
CREATE UNIQUE INDEX "entities_mda_id_name_key" ON "entities"("mda_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "thematic_areas_sector_id_name_key" ON "thematic_areas"("sector_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "domains_thematic_area_id_name_key" ON "domains"("thematic_area_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "indicators_domain_id_name_key" ON "indicators"("domain_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "time_periods_frequency_start_date_key" ON "time_periods"("frequency", "start_date");

-- CreateIndex
CREATE INDEX "idx_results_indicator" ON "results"("indicator_id");

-- CreateIndex
CREATE INDEX "idx_results_period" ON "results"("time_period_id");

-- CreateIndex
CREATE INDEX "idx_results_entity" ON "results"("entity_id");

-- CreateIndex
CREATE INDEX "idx_result_evidence_result" ON "result_evidence"("result_id");

-- AddForeignKey
ALTER TABLE "mdas" ADD CONSTRAINT "mdas_sector_id_fkey" FOREIGN KEY ("sector_id") REFERENCES "sectors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entities" ADD CONSTRAINT "entities_mda_id_fkey" FOREIGN KEY ("mda_id") REFERENCES "mdas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entities" ADD CONSTRAINT "entities_lga_id_fkey" FOREIGN KEY ("lga_id") REFERENCES "lgas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thematic_areas" ADD CONSTRAINT "thematic_areas_sector_id_fkey" FOREIGN KEY ("sector_id") REFERENCES "sectors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "domains" ADD CONSTRAINT "domains_thematic_area_id_fkey" FOREIGN KEY ("thematic_area_id") REFERENCES "thematic_areas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indicators" ADD CONSTRAINT "indicators_domain_id_fkey" FOREIGN KEY ("domain_id") REFERENCES "domains"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "results" ADD CONSTRAINT "results_indicator_id_fkey" FOREIGN KEY ("indicator_id") REFERENCES "indicators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "results" ADD CONSTRAINT "results_time_period_id_fkey" FOREIGN KEY ("time_period_id") REFERENCES "time_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "results" ADD CONSTRAINT "results_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "result_evidence" ADD CONSTRAINT "result_evidence_result_id_fkey" FOREIGN KEY ("result_id") REFERENCES "results"("id") ON DELETE CASCADE ON UPDATE CASCADE;
