-- Migration: Add user authentication support
-- This migration adds user_id columns to all tables to support user accounts
-- Guest mode is supported by allowing user_id to be NULL

-- Add user_id to teams table
ALTER TABLE teams
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_teams_user_id ON teams(user_id);

COMMENT ON COLUMN teams.user_id IS 'User who owns this team. NULL for guest users.';

-- Add user_id to players table
ALTER TABLE players
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_players_user_id ON players(user_id);

COMMENT ON COLUMN players.user_id IS 'User who owns this player. NULL for guest users.';

-- Add user_id to games table
ALTER TABLE games
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_games_user_id ON games(user_id);

COMMENT ON COLUMN games.user_id IS 'User who owns this game. NULL for guest users.';

-- Note: points and events inherit user_id through games, but we can add direct columns if needed
-- For now, we'll query through games.user_id

-- Enable Row Level Security (RLS) on tables
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;

-- RLS Policies for teams
-- Users can view their own teams OR guest teams (user_id IS NULL)
CREATE POLICY "Users can view their own teams or guest teams" ON teams
  FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

-- Users can insert teams with their own user_id or NULL (guest)
CREATE POLICY "Users can insert teams" ON teams
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Users can update their own teams
CREATE POLICY "Users can update their own teams" ON teams
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own teams
CREATE POLICY "Users can delete their own teams" ON teams
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for players
CREATE POLICY "Users can view their own players or guest players" ON players
  FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can insert players" ON players
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can update their own players" ON players
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own players" ON players
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for games
CREATE POLICY "Users can view their own games or guest games" ON games
  FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can insert games" ON games
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can update their own games" ON games
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own games" ON games
  FOR DELETE USING (auth.uid() = user_id);
