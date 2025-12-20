-- Migration: Add tournament_name column to games table
-- This migration adds support for tracking tournament names for games

-- Add tournament_name column (text, optional)
ALTER TABLE games
ADD COLUMN IF NOT EXISTS tournament_name TEXT;

COMMENT ON COLUMN games.tournament_name IS 'Name of the tournament this game belongs to (optional)';

