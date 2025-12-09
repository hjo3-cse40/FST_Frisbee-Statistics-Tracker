-- Migration: Add turnover tracking and team_id to events table
-- This migration adds support for tracking turnovers vs blocks/defensive plays
-- Run this migration after create_events_table.sql

-- First, drop the old check constraint on event_type (if it exists)
-- This allows us to add new event types
DO $$ 
BEGIN
    -- Drop the constraint if it exists
    IF EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'events_event_type_check'
    ) THEN
        ALTER TABLE events DROP CONSTRAINT events_event_type_check;
    END IF;
END $$;

-- Add is_turnover column (boolean flag indicating if possession changed)
ALTER TABLE events
ADD COLUMN IF NOT EXISTS is_turnover BOOLEAN DEFAULT false;

COMMENT ON COLUMN events.is_turnover IS 'True if this event resulted in a change of possession (turnover)';

-- Add team_id column (tracks which team the event belongs to)
ALTER TABLE events
ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE CASCADE;

COMMENT ON COLUMN events.team_id IS 'The team of the player involved in this event';

-- Create index on team_id for faster queries
CREATE INDEX IF NOT EXISTS idx_events_team_id ON events(team_id);

-- Create index on is_turnover for faster turnover queries
CREATE INDEX IF NOT EXISTS idx_events_is_turnover ON events(is_turnover);

-- Update existing data: Set is_turnover based on event_type
-- Old 'turnover' events should have is_turnover = true
UPDATE events
SET is_turnover = true
WHERE event_type = 'turnover';

-- Old 'd' (defensive play) events should have is_turnover = true (most blocks cause turnovers)
UPDATE events
SET is_turnover = true
WHERE event_type = 'd';

-- Goals never cause turnovers
UPDATE events
SET is_turnover = false
WHERE event_type = 'goal';

-- Update existing data: Set team_id based on player_id
-- This assumes players table has team_id column
UPDATE events e
SET team_id = p.team_id
FROM players p
WHERE e.player_id = p.id
AND e.team_id IS NULL;

-- Add new check constraint with all supported event types
ALTER TABLE events
ADD CONSTRAINT events_event_type_check 
CHECK (event_type IN (
    'goal',
    'turnover',        -- Legacy: kept for backward compatibility
    'd',               -- Legacy: kept for backward compatibility
    'block',
    'throwaway',
    'drop',
    'stall',
    'interception',
    'callahan'
));

COMMENT ON TABLE events IS 'Stores all stat events during a point. event_type describes the action (goal, block, throwaway, etc.), is_turnover indicates if possession changed.';
