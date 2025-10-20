-- Add index on variant_id for better JOIN performance
-- This improves queries that filter or join by variant_id

CREATE INDEX IF NOT EXISTS idx_stats_variant
ON public.experiment_stats(variant_id);

-- Add comment explaining the index purpose
COMMENT ON INDEX public.idx_stats_variant IS
'Improves JOIN performance with variants table and queries filtering by variant_id';
