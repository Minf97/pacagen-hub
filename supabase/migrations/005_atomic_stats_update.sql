-- =====================================================
-- Atomic Stats Update Function
-- =====================================================
-- Purpose: Eliminate race conditions in conversion tracking
-- Performance: Reduces webhook DB calls from 3 to 1
-- Safety: Atomic UPSERT prevents concurrent update conflicts
-- =====================================================

-- Function: Atomically increment conversion stats
-- Usage: Called by Shopify webhook when order is created
CREATE OR REPLACE FUNCTION increment_conversion_stats(
  p_experiment_id uuid,
  p_variant_id uuid,
  p_date date,
  p_order_value numeric
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
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
    0,                    -- unique_users: will be updated by tracking events
    0,                    -- clicks: will be updated by tracking events
    0,                    -- conversion_rate: 0 until we have impressions
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

    -- Recalculate conversion rate (if we have impression data)
    conversion_rate = CASE
      WHEN experiment_stats.impressions > 0
      THEN ((experiment_stats.conversions + 1)::numeric / experiment_stats.impressions) * 100
      ELSE 0
    END,

    -- Update timestamp
    updated_at = NOW();
END;
$$;

-- Add function comment
COMMENT ON FUNCTION increment_conversion_stats IS
'Atomically increments conversion stats for an experiment variant. Uses ON CONFLICT to prevent race conditions when multiple webhooks arrive simultaneously. Called by Shopify order webhook.';

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION increment_conversion_stats(uuid, uuid, date, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_conversion_stats(uuid, uuid, date, numeric) TO anon;
