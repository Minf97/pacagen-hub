-- =====================================================
-- Function: Atomically increment impression stats
-- =====================================================
-- Purpose: Eliminate race conditions in impression tracking
-- Usage: Called when user is assigned to an experiment variant

CREATE OR REPLACE FUNCTION increment_impression(
  p_experiment_id uuid,
  p_variant_id uuid,
  p_date date,
  p_user_id text
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Atomic INSERT or UPDATE using ON CONFLICT
  -- This ensures no race conditions even with concurrent requests
  INSERT INTO experiment_stats (
    experiment_id,
    variant_id,
    date,
    impressions,
    unique_users,
    clicks,
    conversions,
    revenue,
    avg_order_value,
    conversion_rate,
    updated_at
  )
  VALUES (
    p_experiment_id,
    p_variant_id,
    p_date,
    1,                    -- impressions: start with 1
    1,                    -- unique_users: start with 1 (will be refined by unique count)
    0,                    -- clicks: 0 initially
    0,                    -- conversions: 0 initially
    0,                    -- revenue: 0 initially
    0,                    -- avg_order_value: 0 initially
    0,                    -- conversion_rate: 0 initially
    NOW()
  )
  ON CONFLICT (experiment_id, variant_id, date)
  DO UPDATE SET
    -- Atomically increment impression count
    impressions = experiment_stats.impressions + 1,

    -- Update unique users count (approximation - actual unique count requires separate tracking)
    unique_users = experiment_stats.unique_users + 1,

    -- Recalculate conversion rate (if we have conversions)
    conversion_rate = CASE
      WHEN experiment_stats.conversions > 0
      THEN (experiment_stats.conversions::numeric / (experiment_stats.impressions + 1)) * 100
      ELSE 0
    END,

    -- Update timestamp
    updated_at = NOW();
END;
$$;

COMMENT ON FUNCTION increment_impression IS 'Atomically increments impression stats for an experiment variant. Uses ON CONFLICT to prevent race conditions when multiple users view the same experiment simultaneously.';
