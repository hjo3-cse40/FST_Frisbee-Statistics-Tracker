# Turnover Tracking Implementation

This document explains the implementation of the turnover vs blocks/defensive plays tracking system.

## Overview

The system separates **turnovers** (possession outcomes) from **blocks/defensive plays** (player actions), allowing for accurate stat tracking where:
- A block can cause a turnover OR not cause a turnover
- Turnovers can be caused by blocks OR other events (throwaway, drop, stall, etc.)
- Defensive stats and turnover stats are tracked independently

## Database Schema Changes

### New Columns in `events` Table

1. **`is_turnover`** (BOOLEAN)
   - `true` = possession changed (turnover occurred)
   - `false` = no turnover (possession did not change)
   - Default: `false`

2. **`team_id`** (UUID, references `teams.id`)
   - Tracks which team the event belongs to
   - Used for team-based stat queries
   - Allows filtering turnovers by team

### Migration

Run `migrations/add_turnover_tracking.sql` to add these columns to your existing `events` table.

The migration:
- Adds the new columns
- Creates indexes for performance
- Updates existing data:
  - Sets `is_turnover = true` for old 'turnover' and 'd' events
  - Sets `is_turnover = false` for goals
  - Sets `team_id` based on the player's team

## Event Types

### Offensive Events
- **`goal`** - Player scored (is_turnover = false)
- **`throwaway`** - Bad throw (is_turnover = true)
- **`drop`** - Dropped disc (is_turnover = true)
- **`stall`** - Stall count reached (is_turnover = true)
- **`callahan_against`** - Callahan scored against (is_turnover = true)

### Defensive Events
- **`block`** - Defensive block (is_turnover = true/false - user confirms)
- **`interception`** - Intercepted pass (is_turnover = true/false - user confirms)
- **`callahan`** - Callahan scored (is_turnover = true)

### Legacy Support
- **`turnover`** - Legacy event type (mapped to throwaway, is_turnover = true)
- **`d`** - Legacy defensive play (mapped to block, is_turnover = true)

## UI Workflow

### Recording a Block/Defensive Play

1. User taps a player
2. User taps "Block / D" button
3. **Popup appears**: "Did Possession Change?"
   - **Yes** → Records block with `is_turnover = true`
   - **No** → Records block with `is_turnover = false`
   - **Cancel** → Cancels the action

### Recording Other Events

- **Throwaway, Drop, Stall** → Automatically recorded as turnovers (`is_turnover = true`)
- **Goal** → Not a turnover (`is_turnover = false`)
- **Callahan** → Automatically a turnover (`is_turnover = true`)

## Stat Calculations

### Player Stats

```typescript
// Turnovers = events where this player caused a turnover
turnovers = events.filter(e => e.is_turnover && e.player_id === playerId).length

// Blocks/Ds = defensive plays by this player
ds = events.filter(e => 
  (e.event_type === 'block' || e.event_type === 'd' || 
   e.event_type === 'interception' || e.event_type === 'callahan') 
  && e.player_id === playerId
).length
```

### Team Stats

```typescript
// Turnovers by a team
teamTurnovers = events.filter(e => 
  e.is_turnover && e.team_id === teamId
).length

// Turnovers forced (against opponent)
forcedTurnovers = events.filter(e => 
  e.is_turnover && e.team_id !== teamId
).length
```

## Benefits

✅ **Accurate Stats**: Blocks and turnovers are tracked separately  
✅ **Flexible**: Can record blocks that don't cause turnovers  
✅ **Analytics Ready**: Enables advanced stats like:
   - D-efficiency (blocks that caused turnovers)
   - Defensive pressure (blocks that didn't cause turnovers)
   - Turnover causes (blocks vs throwaways vs drops)
✅ **Backward Compatible**: Old events are automatically migrated

## Example Scenarios

### Scenario 1: Block Causes Turnover
- Event: `event_type = 'block'`, `is_turnover = true`
- Stats: +1 Block, +1 Turnover (for opponent)

### Scenario 2: Block Doesn't Cause Turnover
- Event: `event_type = 'block'`, `is_turnover = false`
- Stats: +1 Block, +0 Turnovers
- Example: Defender tips disc, but offense catches it

### Scenario 3: Throwaway
- Event: `event_type = 'throwaway'`, `is_turnover = true`
- Stats: +1 Turnover (for thrower's team)

### Scenario 4: Callahan
- Event: `event_type = 'callahan'`, `is_turnover = true`
- Stats: +1 Callahan, +1 Block, +1 Turnover (for opponent)

## Migration Steps

1. **Backup your database** (always!)
2. Run `migrations/add_turnover_tracking.sql` in Supabase SQL Editor
3. Verify the migration:
   ```sql
   -- Check that columns exist
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'events' 
   AND column_name IN ('is_turnover', 'team_id');
   
   -- Check that existing data was updated
   SELECT event_type, COUNT(*) 
   FROM events 
   GROUP BY event_type;
   ```
4. Test the UI - record a block and verify the turnover confirmation popup appears

## Future Enhancements

- Add more granular event types (hand block, layout block, sky block)
- Add "pressure" event type for non-turnover defensive plays
- Add analytics dashboard showing turnover causes
- Add possession tracking based on turnover events

