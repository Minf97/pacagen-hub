-- Migration: Change events table from single experiment/variant to variants_group array
-- Drop old indexes
DROP INDEX IF EXISTS "idx_events_experiment";
DROP INDEX IF EXISTS "idx_events_variant";

-- Add new variants_group column (text array)
ALTER TABLE "events" ADD COLUMN "variants_group" text[];

-- Drop old columns (experiment_id and variant_id)
ALTER TABLE "events" DROP COLUMN IF EXISTS "experiment_id";
ALTER TABLE "events" DROP COLUMN IF EXISTS "variant_id";
