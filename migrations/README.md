# Database Migrations

This directory contains SQL migration files for the FST Frisbee Statistics Tracker database.

## Running Migrations

### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of the migration file
4. Paste into the SQL Editor
5. Click **Run** to execute the migration

### Option 2: Supabase CLI

If you have the Supabase CLI installed:

```bash
supabase db push
```

Or manually:

```bash
psql -h <your-supabase-host> -U postgres -d postgres -f migrations/create_events_table.sql
```

## Migration Files

### `create_events_table.sql` (Phase 3)

Creates the `events` table which stores all stat events (goals, assists, turnovers, Ds) that occur during a point.

**What it creates:**
- `events` table with proper foreign keys and constraints
- Indexes for performance optimization
- Column comments for documentation

**Important:** Run this migration before using Phase 3 features. The app will fail if the events table doesn't exist.

### `add_turnover_tracking.sql` (Turnover Tracking Update)

Adds support for tracking turnovers vs blocks/defensive plays with proper separation.

**What it adds:**
- `is_turnover` boolean column - indicates if possession changed
- `team_id` column - tracks which team the event belongs to
- Indexes on `team_id` and `is_turnover` for faster queries
- Updates existing data to set `is_turnover` based on event type
- Updates existing data to set `team_id` based on player's team

**Important:** Run this migration after `create_events_table.sql`. This enables the new turnover tracking system where:
- Turnover is an **outcome** (possession changed) tracked via `is_turnover` flag
- Block/D is an **action** (defensive play) tracked via `event_type`
- A block can cause a turnover (is_turnover = true) or not (is_turnover = false)

## Verification

After running the migration, you can verify it worked by:

1. Checking the Supabase dashboard → Table Editor → `events` table should appear
2. Or running the test page at `/test-db` (if you have one set up)

