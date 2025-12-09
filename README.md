# FST (Frisbee Statistics Tracker)

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

### (CURRENT) PHASE 3 — Stat Entry UI (Week 3)

🔧 **Backend**
- Create events table
- API to insert events (goal, assist, turn, D)

🖥️ **UI**
- Live point tracker
- Show active players
- Tap player → stat buttons
- Save event to Supabase
- Undo last event

✔ **Deliverable**
- Can fully capture stats during a live point

### PHASE 4 — Score, Summaries & Plus/Minus (Week 4)

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

### PHASE 5 — Importing & Rosters (Week 5)

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

### PHASE 6 — Polish + Deployment (Week 6)

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
