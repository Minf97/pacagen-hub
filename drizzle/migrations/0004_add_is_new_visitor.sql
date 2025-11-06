-- Migration: Add is_new_visitor field to user_assignments
-- Description: Track whether a visitor is new or returning for segmentation analysis
-- Created: 2025-01-06

-- Add is_new_visitor column
ALTER TABLE user_assignments
ADD COLUMN IF NOT EXISTS is_new_visitor BOOLEAN DEFAULT NULL;

-- Add index for performance on visitor type queries
CREATE INDEX IF NOT EXISTS idx_assignments_new_visitor
ON user_assignments(experiment_id, variant_id, is_new_visitor)
WHERE is_new_visitor IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN user_assignments.is_new_visitor IS 'Indicates if the user was a first-time visitor (TRUE) or returning visitor (FALSE) when assigned to this experiment. NULL for historical data before this feature was added.';
