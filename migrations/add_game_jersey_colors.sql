-- Migration: Add per-game jersey color columns to games table
-- Stores the jersey color each team wore for this specific game

ALTER TABLE games
  ADD COLUMN IF NOT EXISTS team_home_jersey_color text,
  ADD COLUMN IF NOT EXISTS team_away_jersey_color text;

COMMENT ON COLUMN games.team_home_jersey_color IS 'Jersey color worn by home team in this game';
COMMENT ON COLUMN games.team_away_jersey_color IS 'Jersey color worn by away team in this game';

-- Optional backfill for existing games from current team profile colors
UPDATE games g
SET team_home_jersey_color = t.color_primary
FROM teams t
WHERE g.team_home_id = t.id AND g.team_home_jersey_color IS NULL;

UPDATE games g
SET team_away_jersey_color = t.color_primary
FROM teams t
WHERE g.team_away_id = t.id AND g.team_away_jersey_color IS NULL;
