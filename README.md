![FST Logo](./public/fst-logo-dark.png)

# FST — Frisbee Statistics Tracker

FST is a mobile-first web app for tracking ultimate frisbee player statistics in real time from your phone or tablet.

## Open FST

**[https://fst-frisbee-statistics-tracker.vercel.app](https://fst-frisbee-statistics-tracker.vercel.app)**

FST runs in your browser — no install required. Works best on a phone or tablet.

---

## Quick start

No account required — you can try FST immediately as a guest.

1. Open FST in your browser
2. Under **Manage Teams & Players**, create teams and add players (name + jersey number)
3. Tap **Start New Game**, pick the two teams, and configure the game
4. For each point: select 7 players per side, then tap a player to record stats
5. Use **View All Games** anytime to resume an in-progress game or review past results

### Optional: create an account

Sign up when you want to keep your data long-term or use FST on another device.

- **Guest mode** — use FST without signing in; teams, players, and games are tied to your current browser session
- **Sign up** — links any guest data you created in that browser to your account
- **Sign in** — access your saved data from any device

Guest data does not follow you to a new browser or device until you sign up.

---

## Features

### Available now

- Live point-by-point stat entry
- Goals, assists, turnovers (throwaway, drop, stall), blocks, interceptions, and callahans
- Possession tracking with turnover confirmation flow
- 7-player lineups per team, with reload-last-lineup shortcut
- Live score display and game-over detection (configurable points to win)
- Game history with scores, status, and team names
- Team and player management (manual roster entry)
- Dark mode
- Optional accounts with guest mode

### Coming soon

- Game-wide player stat summaries and plus/minus
- CSV roster import and stat export
- Filter/sort on the games list
- PWA support and “Add to Home Screen”
- Production deployment on Vercel

---

## How stat tracking works

During an active point, tap a player to open the stat buttons for that player.

- **On offense:** Goal, Throwaway, Drop, Stall
- **On defense:** Block/D, Interception, Callahan

For blocks and interceptions, FST asks whether possession changed and can attribute a turnover to an offensive player or record a standalone defensive play.

**Callahans** record the defensive play, a goal for the same player, and complete the point for the defending team.

You can undo the last event and review a chronological event history for the current point.

---

## Development status

| Phase | Status | Summary |
|-------|--------|---------|
| 1 — Core Foundation | ✅ Done | Teams, players, games |
| 2 — Points + Lineups | ✅ Done | 7-player lineups, point creation |
| 3 — Stat Entry | ✅ Done | Live tracker with turnover logic |
| 4 — Auth & Persistence | ✅ Done | Supabase auth, RLS, guest mode, claim-on-signup |
| 5 — Summaries & +/- | 🟡 In progress | Scoring works; game stats page and plus/minus not built |
| 6 — Rosters | 🟡 Partial | Manual player entry; CSV import not built |
| 7 — Games list | 🟡 Mostly done | `/games` works; filter/sort not built |
| 8 — Polish & deploy | ⬜ Not started | Responsive UI exists; PWA and Vercel deploy pending |

---

## Development phases (detail)

### (DONE) PHASE 1 — Core Foundation (Week 1)

🔧 **Setup & Database**
- Create Next.js project
- Install Supabase client
- Configure Supabase environment variables
- Create tables: teams, players, games

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
- Add `user_id` columns to teams, players, and games tables
- Implement Row Level Security (RLS) policies
- Create migration for user_id columns
- Support guest mode (`user_id = NULL`)

🖥️ **UI**
- Sign up page (email/password)
- Sign in page
- Sign out functionality
- User session management
- "Claim existing data" flow for guest → authenticated transition (on sign up)

✔ **Deliverable**
- Users can create accounts
- Data is associated with user accounts
- Users can only see their own data when signed in
- Guest mode still works without login

### (PARTIAL) PHASE 5 — Score, Summaries & Plus/Minus (Week 5)

🔧 **Backend computation**
- ✅ Point completion updates `points.scoring_team_id` and game score
- ✅ Live per-player stat badges during active points
- ⬜ Compute points played (count lineups)
- ⬜ Compute plus/minus
- ⬜ Compute stat totals per game (aggregated across all points)

🖥️ **UI**
- ✅ Team score display during games
- ⬜ Game stats page
- ⬜ Player stat summaries (full game)
- ⬜ CSV export

✔ **Deliverable**
- All core Frisbee stats computed correctly _(in progress)_

### (PARTIAL) PHASE 6 — Importing & Rosters (Week 6)

🔧 **Backend**
- ⬜ CSV import for players
- ✅ Manual add player
- ⬜ Optional: USAU roster scraper

🖥️ **UI**
- ⬜ Upload CSV modal
- ⬜ Validate player fields
- ⬜ Select team for imported players
- ✅ Manual roster management on `/teams`

✔ **Deliverable**
- Fast roster setup without manual typing _(partial — manual entry only)_

### (MOSTLY DONE) PHASE 7 — Games List & Navigation (Week 7)

🔧 **Backend**
- No database changes needed
- Query all games from existing games table (filtered by `user_id` if authenticated)

🖥️ **UI**
- ✅ Create `/games` page listing all games
- ✅ Show game name, date, teams, scores, status
- ✅ Link to individual game pages
- ✅ Add "View All Games" to homepage navigation
- ⬜ Filter/sort games (by date, status, etc.)

✔ **Deliverable**
- Users can view and return to past games
- Easy navigation between games

### PHASE 8 — Polish + Deployment (Week 8)

📱 **Mobile Improvements**
- ✅ Responsive layout for phones/iPads (partial)
- ✅ Large tap targets (partial)
- ⬜ Offline caching of previous game

🚀 **Deployment**
- ⬜ Add PWA support
- ⬜ "Add to Home Screen" functionality
- ⬜ Deploy to Vercel
- ⬜ Create production Supabase project

✔ **Deliverable**
- Stable MVP
- Mobile installable app

### Extras (beyond original plan)

- Dark mode toggle
- Per-game jersey colors and pulling team selection
- Configurable points to win with game-over and universe-point UI
- Reload previous point lineup
- Delete games from the games list

### TESTING TASKS (Throughout)

📱 **Mobile debugging**
- Test on iPhone using the production Vercel URL or local network IP during development
- Test on iPad
- Field-test during a scrimmage

---

## For developers

Local setup, environment variables, and database migrations are documented in [`migrations/README.md`](./migrations/README.md).
