-- =====================================================
-- Database Functions for Pacagen Hub
-- =====================================================

-- Function: Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: Atomically increment conversion stats
-- Purpose: Eliminate race conditions in conversion tracking
-- Usage: Called by Shopify webhook when order is created
-- Version: 2.0 - Now uses unique_users for conversion rate calculation
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

  -- Atomic INSERT or UPDATE using ON CONFLICT
  -- This ensures no race conditions even with concurrent webhooks
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
    1,                    -- conversions: start with 1
    p_order_value,        -- revenue: initial order value
    p_order_value,        -- avg_order_value: same as first order
    0,                    -- impressions: will be updated by tracking events
    v_unique_users,       -- unique_users: actual count from user_assignments
    0,                    -- clicks: will be updated by tracking events
    CASE
      WHEN v_unique_users > 0
      THEN (1::numeric / v_unique_users) * 100
      ELSE 0
    END,                  -- conversion_rate: based on unique users
    NOW()
  )
  ON CONFLICT (experiment_id, variant_id, date)
  DO UPDATE SET
    -- Atomically increment conversion count
    conversions = experiment_stats.conversions + 1,

    -- Atomically add to total revenue
    revenue = experiment_stats.revenue + p_order_value,

    -- Recalculate average order value
    avg_order_value = (experiment_stats.revenue + p_order_value) / (experiment_stats.conversions + 1),

    -- Update unique users from user_assignments (actual count, not increment)
    unique_users = v_unique_users,

    -- Recalculate conversion rate based on unique users (not impressions)
    conversion_rate = CASE
      WHEN v_unique_users > 0
      THEN ((experiment_stats.conversions + 1)::numeric / v_unique_users) * 100
      ELSE 0
    END,

    -- Update timestamp
    updated_at = NOW();
END;
$$;

COMMENT ON FUNCTION increment_conversion_stats IS 'Atomically increments conversion stats for an experiment variant. Calculates conversion rate based on unique users from user_assignments table. Uses ON CONFLICT to prevent race conditions.';
