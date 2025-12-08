import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="container">
      <div className="header">
        <h1>FST</h1>
        <p className="subtitle">Frisbee Stats Tracker</p>
        <p className="description">Real-time ultimate stats</p>
      </div>
      
      <div className="nav-cards">
        <Link href="/games/setup" className="nav-card">
          <div className="nav-card-icon">🎮</div>
          <span className="nav-card-text">Start New Game</span>
        </Link>
        
        <Link href="/teams" className="nav-card">
          <div className="nav-card-icon">👥</div>
          <span className="nav-card-text">Manage Teams & Players</span>
        </Link>
      </div>
      
      <div className="quick-start-guide">
        <h2>Quick Start Guide</h2>
        <ul className="guide-list">
          <li>Create your teams and add player rosters</li>
          <li>Start a new game and select light/dark teams</li>
          <li>Pick 7 players for the starting lineup</li>
          <li>Track stats in real-time during points</li>
          <li>Export game data after completion</li>
        </ul>
      </div>
    </div>
  )
}
