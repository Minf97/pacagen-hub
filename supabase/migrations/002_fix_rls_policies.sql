-- =====================================================
-- FIX: Update RLS Policies for Development
-- Run this in Supabase SQL Editor to allow operations without auth
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Allow authenticated users to view experiments" ON experiments;
DROP POLICY IF EXISTS "Allow authenticated users to create experiments" ON experiments;
DROP POLICY IF EXISTS "Allow experiment creators to update their experiments" ON experiments;
DROP POLICY IF EXISTS "Allow experiment creators to delete their experiments" ON experiments;

DROP POLICY IF EXISTS "Allow authenticated users to view variants" ON variants;
DROP POLICY IF EXISTS "Allow authenticated users to manage variants" ON variants;

DROP POLICY IF EXISTS "Allow public read for user assignments" ON user_assignments;
DROP POLICY IF EXISTS "Allow authenticated users to create assignments" ON user_assignments;

DROP POLICY IF EXISTS "Allow public write for events" ON events;
DROP POLICY IF EXISTS "Allow authenticated users to read events" ON events;

DROP POLICY IF EXISTS "Allow authenticated users to view stats" ON experiment_stats;
DROP POLICY IF EXISTS "Allow authenticated users to manage stats" ON experiment_stats;

-- =====================================================
-- NEW PERMISSIVE POLICIES (Development Mode)
-- =====================================================

-- Experiments: Allow all operations for both authenticated and anonymous users
CREATE POLICY "Allow all users to view experiments"
  ON experiments FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow all users to create experiments"
  ON experiments FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow all users to update experiments"
  ON experiments FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all users to delete experiments"
  ON experiments FOR DELETE
  TO anon, authenticated
  USING (true);

-- Variants: Allow all operations
CREATE POLICY "Allow all users to view variants"
  ON variants FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow all users to manage variants"
  ON variants FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- User Assignments: Public access
CREATE POLICY "Allow public access to user assignments"
  ON user_assignments FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Events: Public write access
CREATE POLICY "Allow public access to events"
  ON events FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Stats: Public access
CREATE POLICY "Allow public access to stats"
  ON experiment_stats FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- NOTES
-- =====================================================
-- These policies allow unrestricted access for development.
--
-- For production, you should:
-- 1. Implement Supabase Auth
-- 2. Replace these policies with user-scoped policies
-- 3. Add role-based access control (RBAC)
--
-- Example production policy:
-- CREATE POLICY "Users can only manage their own experiments"
--   ON experiments FOR ALL
--   USING (created_by = auth.uid())
--   WITH CHECK (created_by = auth.uid());
