-- Migration: Update increment_impression function
-- Description: Changes unique_users calculation from simple increment to accurate COUNT from user_assignments
-- Created: 2025-01-05

-- =====================================================
-- Function: Atomically increment impression stats
-- =====================================================
-- Purpose: Eliminate race conditions in impression tracking
-- Usage: Called when user is assigned to an experiment variant
-- Version: 2.0 - Now calculates unique_users from user_assignments table

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
  -- This ensures accurate counting even with multiple impressions per user
  SELECT COUNT(DISTINCT user_id)
  INTO v_unique_users
  FROM user_assignments
  WHERE experiment_id = p_experiment_id
    AND variant_id = p_variant_id;

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
    v_unique_users,       -- unique_users: actual count from user_assignments
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

    -- Update unique users from user_assignments (actual count, not increment)
    unique_users = v_unique_users,

    -- Recalculate conversion rate (if we have conversions)
    conversion_rate = CASE
      WHEN experiment_stats.conversions > 0 AND v_unique_users > 0
      THEN (experiment_stats.conversions::numeric / v_unique_users) * 100
      ELSE 0
    END,

    -- Update timestamp
    updated_at = NOW();
END;
$$;

COMMENT ON FUNCTION increment_impression IS 'Atomically increments impression stats for an experiment variant. Calculates unique_users from user_assignments table for accurate counting. Uses ON CONFLICT to prevent race conditions.';
