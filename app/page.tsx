import Link from 'next/link'
import Image from 'next/image'
import Logo from './components/Logo'

export default function HomePage() {
  return (
    <div className="container">
      <Link href="/" style={{ display: 'block', textDecoration: 'none', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <Logo />
        </div>
      </Link>
      
      <div className="nav-cards">
        <Link href="/games/setup" className="nav-card">
          <span className="nav-card-text">Start New Game</span>
        </Link>
        
        <Link href="/teams" className="nav-card">
          <span className="nav-card-text">Manage Teams & Players</span>
        </Link>
        
        <Link href="/games" className="nav-card">
          <span className="nav-card-text">View All Games</span>
        </Link>
        
        <Link href="/test-data" className="nav-card" style={{ border: '2px dashed var(--border-color)' }}>
          <span className="nav-card-text" style={{ color: 'var(--text-tertiary)' }}>Load Test Data</span>
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
