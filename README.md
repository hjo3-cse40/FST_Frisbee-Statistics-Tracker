![FST Logo](./public/fst-logo-dark.png)

FST is a mobile app developed to help keep track of statistics of frisbee players in real time using a mobile phone or tablet.

## Development Phases

### (DONE) PHASE 1 — Core Foundation (Week 1)

🔧 **Setup & Database**
- Create Next.js project
- Install Supabase client
- Configure Supabase environment variables
- Create tables:
  - teams
  - players
  - games

🖥️ **Basic UI**
- Team creation page
- Add players page (name, jersey #)
- Game creation page (select light/dark teams)

✔ **Deliverable**
- App runs locally
- Can add teams/players/games

### (DONE) PHASE 2 — Points + Lineups (Week 2)

🔧 **Backend**
- Create points table
- Create point_lineups table
- API to create a new point

🖥️ **UI**
- Point start screen
- Lineup selection UI (pick 7 players per team)
- Prevent more than 7 from being selected
- Save lineups to Supabase

✔ **Deliverable**
- Can start a point and assign active players

### (DONE) PHASE 3 — Stat Entry UI (Week 3)

🔧 **Backend**
- Create events table with comprehensive event tracking
- Support for multiple event types: `goal`, `assist`, `throwaway`, `drop`, `stall`, `block`, `interception`, `callahan`
- Turnover tracking system: `is_turnover` boolean flag separates outcomes (turnovers) from actions (defensive plays)
- Team tracking: `team_id` column links events to teams
- Migration system for schema evolution

🖥️ **UI Features**
- **Live Point Tracker**: Real-time stat entry during active points
- **Player Selection**: Tap player → stat buttons modal
- **Offense/Defense Labels**: Dynamic labels showing which team has possession
- **Smart Stat Filtering**: 
  - Offense players can record: Goal, Throwaway, Drop, Stall
  - Defense players can record: Block/D, Interception, Callahan
- **Possession Tracking**: Automatically tracks possession changes through turnovers
- **Turnover Confirmation Flow**:
  - For blocks/interceptions: Ask "Did possession change?"
  - If yes: Option to attribute to offensive player (throwaway) or record as great defensive play
- **Callahan Logic**:
  - Records callahan (defensive play)
  - Automatically records goal for the same player
  - Automatically completes the point for the defender's team
  - Option to attribute to offensive throwaway
- **Score Display**: Shows scores (e.g., "0-0", "1-0") instead of just point numbers
- **Event History**: Chronological list of all events with descriptions
- **Undo Last Event**: Remove the most recent event
- **Validation**: Prevents invalid stat combinations (e.g., defense scoring without turnover)

✔ **Deliverable**
- Can fully capture stats during a live point with proper turnover tracking
- Distinguishes between defensive actions (blocks/interceptions) and turnover outcomes
- Supports all standard ultimate frisbee stat types

### (DONE) PHASE 4 — User Authentication & Data Persistence (Week 4)

🔧 **Backend**
- Set up Supabase Authentication
- Add `user_id` columns to all tables (teams, players, games, points, events)
- Implement Row Level Security (RLS) policies
- Create migration for user_id columns
- Support guest mode (user_id = NULL)

🖥️ **UI**
- Sign up page (email/password)
- Sign in page
- Sign out functionality
- User session management
- "Claim existing data" flow for guest → authenticated transition

✔ **Deliverable**
- Users can create accounts
- Data is associated with user accounts
- Users can only see their own data
- Guest mode still works without login

### PHASE 5 — Score, Summaries & Plus/Minus (Week 5)

🔧 **Backend computation**
- Add "point scored" button
- Update points.scored_by value
- Compute Points Played (count lineups)
- Compute Plus/Minus
- Compute stat totals per game

🖥️ **UI**
- Game stats page
- Player stat summaries
- Team score display

✔ **Deliverable**
- All core Frisbee stats computed correctly

### PHASE 6 — Importing & Rosters (Week 6)

🔧 **Backend**
- CSV import for players
- Manual add player
- Optional: USAU roster scraper

🖥️ **UI**
- Upload CSV modal
- Validate player fields
- Select team for imported players

✔ **Deliverable**
- Fast roster setup without manual typing

### PHASE 7 — Games List & Navigation (Week 7)

🔧 **Backend**
- No database changes needed
- Query all games from existing games table (filtered by user_id if authenticated)

🖥️ **UI**
- Create `/games` page listing all games
- Show game name, date, teams, scores, status
- Link to individual game pages
- Add "View All Games" to homepage navigation
- Filter/sort games (by date, status, etc.)

✔ **Deliverable**
- Users can view and return to past games
- Easy navigation between games

### PHASE 8 — Polish + Deployment (Week 8)

📱 **Mobile Improvements**
- Responsive layout for phones/iPads
- Large tap targets
- Offline caching of previous game

🚀 **Deployment**
- Add PWA support
- "Add to Home Screen" functionality
- Deploy to Vercel
- Create production Supabase project

✔ **Deliverable**
- Stable MVP
- Mobile installable app

### TESTING TASKS (Throughout)

📱 **Mobile debugging**
- Test on iPhone using http://YOUR_IP:3000
- Test on iPad using same WiFi local IP
- Test Vercel preview link
- Field-test during a scrimmage
