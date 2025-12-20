# Authentication & Data Persistence Plan

## Overview

This document outlines the plan for implementing user authentication and data persistence in the FST Frisbee Statistics Tracker app. The goal is to support both guest users (no login required) and authenticated users (with persistent data storage).

## User Experience Goals

### Guest Mode (No Login)
- Users can immediately start using the app
- Data stored locally (localStorage/sessionStorage)
- Teams, players, and games exist only in the browser
- Data is lost if browser data is cleared
- Perfect for one-time use or testing

### Authenticated Mode (With Login)
- Users create an account to save their data
- All teams, players, and games are stored in the database
- Data persists across devices and sessions
- Users can access their data from any device
- Data is backed up and secure

## Implementation Strategy

### Phase 1: Games List Page (Immediate)
**Goal**: Allow users to view and return to past games

**Implementation**:
- Create `/games` page that lists all games
- Show game name, date, teams, final score
- Link to individual game pages
- Add "View All Games" link from homepage

**Database Changes**: None (uses existing `games` table)

### Phase 2: Guest Mode Support (Short-term)
**Goal**: Make the app work without authentication

**Implementation**:
- All current functionality works as-is (no auth required)
- Data is stored in Supabase but not user-specific
- Add "Export Game Data" feature (JSON/CSV)
- Add "Import Game Data" feature (future)

**Database Changes**: None initially, but prepare for user_id columns

### Phase 3: User Authentication (Medium-term)
**Goal**: Add optional user accounts with Supabase Auth

**Implementation**:
- Use Supabase Authentication (email/password)
- Add sign up, sign in, sign out pages
- Add user profile management
- Store user_id in session

**Database Changes**:
- Add `user_id` column to `teams`, `players`, `games`, `points`, `events` tables
- Add Row Level Security (RLS) policies
- Migration to add user_id to existing tables

### Phase 4: Data Migration & User Association (Medium-term)
**Goal**: Link existing data to user accounts

**Implementation**:
- When user signs up/logs in, associate existing guest data with their account
- Migration strategy for existing data
- "Claim my data" flow for users who created data before signing up

**Database Changes**:
- Update existing records with user_id
- Handle orphaned data (no user_id)

### Phase 5: Multi-Device Sync (Long-term)
**Goal**: Sync data across devices

**Implementation**:
- Real-time sync using Supabase subscriptions
- Conflict resolution for concurrent edits
- Offline support with sync on reconnect

## Database Schema Changes

### Tables to Update

1. **teams**
   ```sql
   ALTER TABLE teams ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
   CREATE INDEX idx_teams_user_id ON teams(user_id);
   ```

2. **players**
   ```sql
   ALTER TABLE players ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
   CREATE INDEX idx_players_user_id ON players(user_id);
   ```

3. **games**
   ```sql
   ALTER TABLE games ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
   CREATE INDEX idx_games_user_id ON games(user_id);
   ```

4. **points** (inherits from games, but can add for direct queries)
   - Already linked via games.user_id

5. **events** (inherits from games via points)
   - Already linked via games.user_id

### Row Level Security (RLS) Policies

```sql
-- Teams: Users can only see/edit their own teams
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own teams" ON teams
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own teams" ON teams
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own teams" ON teams
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own teams" ON teams
  FOR DELETE USING (auth.uid() = user_id);

-- Similar policies for players, games, etc.
```

## UI/UX Flow

### Guest User Flow
1. User opens app → No login required
2. User creates teams, players, games
3. Data stored in database without user_id (NULL)
4. User can view all games (including guest games)
5. User can optionally sign up to save their data

### Authenticated User Flow
1. User signs up/logs in
2. User sees only their own teams, players, games
3. All new data is automatically associated with their user_id
4. User can access data from any device
5. User can sign out and continue as guest

### Sign Up Flow
1. User clicks "Sign Up" or "Create Account"
2. User enters email and password
3. Email verification (optional, can be disabled for MVP)
4. On first login, prompt: "Would you like to claim your existing games?"
5. If yes, associate existing guest data with user_id
6. Redirect to homepage

## Migration Strategy

### For Existing Data
1. Create migration to add `user_id` columns (nullable)
2. Existing data remains with `user_id = NULL` (guest data)
3. When user signs up, they can "claim" their guest data
4. Update RLS to allow viewing guest data (user_id IS NULL) OR user's own data

### For New Data
1. If user is logged in, automatically set `user_id`
2. If user is not logged in, set `user_id = NULL`
3. Filter queries based on authentication status

## Security Considerations

1. **RLS Policies**: Ensure users can only access their own data
2. **Guest Data**: Consider if guest data should be publicly viewable or private
3. **Data Export**: Allow users to export their data before account deletion
4. **Account Deletion**: Cascade delete user's data when account is deleted

## Implementation Phases

### Phase 6 — Games List & Navigation (Week 7)
- Create games list page
- Add navigation between games
- Add "View All Games" from homepage
- Basic game filtering/sorting

### Phase 7 — User Authentication (Week 8)
- Set up Supabase Auth
- Create sign up/sign in pages
- Add user session management
- Add sign out functionality

### Phase 8 — Data Association (Week 9)
- Add user_id columns to tables
- Update RLS policies
- Migrate existing data
- Add "claim data" flow

### Phase 9 — User Profile & Settings (Week 10)
- User profile page
- Account settings
- Data export functionality
- Account deletion

## Questions to Consider

1. **Guest Data Visibility**: Should guest games be visible to all users, or only to the browser that created them?
2. **Data Migration**: How should we handle users who create data before signing up?
3. **Team Sharing**: Should teams be shareable between users? (Future feature)
4. **Public Games**: Should there be an option to make games public/private?


