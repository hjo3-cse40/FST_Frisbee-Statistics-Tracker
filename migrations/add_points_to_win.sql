-- Migration: Add points_to_win column to games table
-- This migration adds support for tracking the winning score for a game

-- Add points_to_win column (integer, required)
ALTER TABLE games
ADD COLUMN IF NOT EXISTS points_to_win INTEGER NOT NULL DEFAULT 15;

COMMENT ON COLUMN games.points_to_win IS 'Number of points required to win the game (e.g., 15, 21)';

-- Update existing games to have a default value if they don't have one
UPDATE games
SET points_to_win = 15
WHERE points_to_win IS NULL;
