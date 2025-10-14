-- =====================================================
-- PACAGENHUB A/B TESTING FRAMEWORK
-- Initial Database Schema
-- =====================================================

-- =====================================================
-- EXPERIMENTS TABLE
-- =====================================================
CREATE TABLE experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  hypothesis TEXT,

  -- Status management
  status TEXT NOT NULL CHECK (status IN ('draft', 'running', 'paused', 'completed', 'archived')) DEFAULT 'draft',

  -- Traffic allocation (JSON for flexibility)
  traffic_allocation JSONB NOT NULL DEFAULT '{"control": 50, "variant_a": 50}',
  -- Example: {"control": 40, "variant_a": 30, "variant_b": 30}

  -- Targeting rules
  targeting_rules JSONB DEFAULT '{}',
  -- Example: {
  --   "url_patterns": ["/products/*", "/collections/*"],
  --   "device_types": ["mobile", "desktop"],
  --   "countries": ["US", "CA"],
  --   "custom_js": "return user.email.endsWith('@test.com')"
  -- }

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,

  -- Metadata
  created_by UUID REFERENCES auth.users(id)
);

-- Indexes for experiments
CREATE INDEX idx_experiments_status ON experiments(status);
CREATE INDEX idx_experiments_created_at ON experiments(created_at DESC);

-- =====================================================
-- VARIANTS TABLE
-- =====================================================
CREATE TABLE variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,

  -- Variant identification
  name TEXT NOT NULL,              -- 'control', 'variant_a', 'variant_b'
  display_name TEXT NOT NULL,      -- 'Original Button', 'Green Button'
  is_control BOOLEAN DEFAULT FALSE,

  -- Weight for traffic allocation (0-100)
  weight INTEGER NOT NULL DEFAULT 50 CHECK (weight >= 0 AND weight <= 100),

  -- Variant configuration (flexible JSON)
  config JSONB DEFAULT '{}',
  -- Example: {
  --   "button_color": "green",
  --   "button_text": "Buy Now",
  --   "pricing": {"amount": 29.99, "currency": "USD"},
  --   "component_props": {...}
  -- }

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  UNIQUE (experiment_id, name)
);

-- Indexes for variants
CREATE INDEX idx_variants_experiment ON variants(experiment_id);

-- =====================================================
-- USER ASSIGNMENTS TABLE
-- =====================================================
CREATE TABLE user_assignments (
  user_id TEXT NOT NULL,                    -- Cookie ID (persistent)
  experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES variants(id) ON DELETE CASCADE,

  -- Assignment metadata
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  assignment_method TEXT DEFAULT 'hash',    -- 'hash', 'manual', 'override'

  -- User context at assignment time
  user_agent TEXT,
  country TEXT,
  device_type TEXT,

  -- Primary key
  PRIMARY KEY (user_id, experiment_id)
);

-- Indexes for user assignments
CREATE INDEX idx_assignments_experiment ON user_assignments(experiment_id);
CREATE INDEX idx_assignments_variant ON user_assignments(variant_id);
CREATE INDEX idx_assignments_assigned_at ON user_assignments(assigned_at DESC);

-- =====================================================
-- EVENTS TABLE (High-volume, time-series data)
-- =====================================================
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Event identification
  event_type TEXT NOT NULL,                 -- 'exposure', 'click', 'add_to_cart', 'purchase'

  -- Experiment context
  user_id TEXT NOT NULL,
  experiment_id UUID REFERENCES experiments(id) ON DELETE SET NULL,
  variant_id UUID REFERENCES variants(id) ON DELETE SET NULL,

  -- Event data (flexible JSON)
  event_data JSONB DEFAULT '{}',
  -- Example for 'purchase': {
  --   "order_id": "12345",
  --   "revenue": 129.99,
  --   "currency": "USD",
  --   "items": [...]
  -- }

  -- Context
  url TEXT,
  referrer TEXT,
  user_agent TEXT,
  ip_address INET,
  country TEXT,

  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for events (optimized for analytics queries)
CREATE INDEX idx_events_experiment ON events(experiment_id, created_at DESC);
CREATE INDEX idx_events_variant ON events(variant_id, created_at DESC);
CREATE INDEX idx_events_type ON events(event_type, created_at DESC);
CREATE INDEX idx_events_user ON events(user_id, created_at DESC);

-- =====================================================
-- EXPERIMENT STATS TABLE (Aggregated data)
-- =====================================================
CREATE TABLE experiment_stats (
  experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES variants(id) ON DELETE CASCADE,
  date DATE NOT NULL,

  -- Core metrics
  impressions INTEGER DEFAULT 0,
  unique_users INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,

  -- Revenue metrics
  revenue NUMERIC(12,2) DEFAULT 0,
  avg_order_value NUMERIC(12,2) DEFAULT 0,

  -- Engagement metrics
  bounce_rate NUMERIC(5,2),
  avg_session_duration INTEGER,        -- seconds

  -- Statistical data
  conversion_rate NUMERIC(5,4),        -- 0.0523 = 5.23%
  confidence_level NUMERIC(5,4),       -- 0.95 = 95%
  p_value NUMERIC(10,8),

  -- Timestamps
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Primary key
  PRIMARY KEY (experiment_id, variant_id, date)
);

-- Indexes for experiment stats
CREATE INDEX idx_stats_date ON experiment_stats(date DESC);
CREATE INDEX idx_stats_experiment ON experiment_stats(experiment_id, date DESC);

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to experiments
CREATE TRIGGER experiments_updated_at
  BEFORE UPDATE ON experiments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Apply trigger to variants
CREATE TRIGGER variants_updated_at
  BEFORE UPDATE ON variants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- VIEWS
-- =====================================================

-- Experiment summary view
CREATE VIEW experiment_summary AS
SELECT
  e.id,
  e.name,
  e.status,
  e.started_at,
  e.ended_at,
  COUNT(DISTINCT ua.user_id) as total_users,
  COUNT(DISTINCT v.id) as variant_count,
  COALESCE(SUM(es.impressions), 0) as total_impressions,
  COALESCE(SUM(es.conversions), 0) as total_conversions,
  COALESCE(SUM(es.revenue), 0) as total_revenue
FROM experiments e
LEFT JOIN variants v ON e.id = v.experiment_id
LEFT JOIN user_assignments ua ON e.id = ua.experiment_id
LEFT JOIN experiment_stats es ON e.id = es.experiment_id
GROUP BY e.id, e.name, e.status, e.started_at, e.ended_at;

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiment_stats ENABLE ROW LEVEL SECURITY;

-- Experiments policies
CREATE POLICY "Allow authenticated users to view experiments"
  ON experiments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to create experiments"
  ON experiments FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Allow experiment creators to update their experiments"
  ON experiments FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Allow experiment creators to delete their experiments"
  ON experiments FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- Variants policies
CREATE POLICY "Allow authenticated users to view variants"
  ON variants FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to manage variants"
  ON variants FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM experiments
      WHERE experiments.id = variants.experiment_id
      AND experiments.created_by = auth.uid()
    )
  );

-- User assignments policies (public read for assignment, authenticated write)
CREATE POLICY "Allow public read for user assignments"
  ON user_assignments FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to create assignments"
  ON user_assignments FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Events policies (public write for tracking)
CREATE POLICY "Allow public write for events"
  ON events FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read events"
  ON events FOR SELECT
  TO authenticated
  USING (true);

-- Stats policies
CREATE POLICY "Allow authenticated users to view stats"
  ON experiment_stats FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to manage stats"
  ON experiment_stats FOR ALL
  TO authenticated
  USING (true);

-- =====================================================
-- SEED DATA (Optional - for testing)
-- =====================================================

-- This will be populated by the admin dashboard
-- No seed data needed for production
