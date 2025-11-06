-- Migration: Update stats calculation functions
-- Description:
--   1. Changes unique_users calculation from simple increment to accurate COUNT from user_assignments
--   2. Fixes conversion_rate to use unique_users instead of impressions
-- Created: 2025-01-06

-- =====================================================
-- Function: Atomically increment impression stats
-- =====================================================
CREATE OR REPLACE FUNCTION increment_impression(
  p_experiment_id uuid,
  p_variant_id uuid,
  p_date date,
  p_user_id text
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_unique_users integer;
BEGIN
  -- Calculate actual unique users from user_assignments table
  SELECT COUNT(DISTINCT user_id)
  INTO v_unique_users
  FROM user_assignments
  WHERE experiment_id = p_experiment_id
    AND variant_id = p_variant_id;

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
    1,
    v_unique_users,
    0,
    0,
    0,
    0,
    0,
    NOW()
  )
  ON CONFLICT (experiment_id, variant_id, date)
  DO UPDATE SET
    impressions = experiment_stats.impressions + 1,
    unique_users = v_unique_users,
    conversion_rate = CASE
      WHEN experiment_stats.conversions > 0 AND v_unique_users > 0
      THEN (experiment_stats.conversions::numeric / v_unique_users) * 100
      ELSE 0
    END,
    updated_at = NOW();
END;
$$;

COMMENT ON FUNCTION increment_impression IS 'Atomically increments impression stats. Calculates unique_users from user_assignments table.';

-- =====================================================
-- Function: Atomically increment conversion stats
-- =====================================================
CREATE OR REPLACE FUNCTION increment_conversion_stats(
  p_experiment_id uuid,
  p_variant_id uuid,
  p_date date,
  p_order_value numeric
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_unique_users integer;
BEGIN
  -- Calculate actual unique users from user_assignments table
  SELECT COUNT(DISTINCT user_id)
  INTO v_unique_users
  FROM user_assignments
  WHERE experiment_id = p_experiment_id
    AND variant_id = p_variant_id;

  INSERT INTO experiment_stats (
    experiment_id,
    variant_id,
    date,
    conversions,
    revenue,
    avg_order_value,
    impressions,
    unique_users,
    clicks,
    conversion_rate,
    updated_at
  )
  VALUES (
    p_experiment_id,
    p_variant_id,
    p_date,
    1,
    p_order_value,
    p_order_value,
    0,
    v_unique_users,
    0,
    CASE
      WHEN v_unique_users > 0
      THEN (1::numeric / v_unique_users) * 100
      ELSE 0
    END,
    NOW()
  )
  ON CONFLICT (experiment_id, variant_id, date)
  DO UPDATE SET
    conversions = experiment_stats.conversions + 1,
    revenue = experiment_stats.revenue + p_order_value,
    avg_order_value = (experiment_stats.revenue + p_order_value) / (experiment_stats.conversions + 1),
    unique_users = v_unique_users,
    conversion_rate = CASE
      WHEN v_unique_users > 0
      THEN ((experiment_stats.conversions + 1)::numeric / v_unique_users) * 100
      ELSE 0
    END,
    updated_at = NOW();
END;
$$;

COMMENT ON FUNCTION increment_conversion_stats IS 'Atomically increments conversion stats. Calculates conversion rate based on unique users.';
