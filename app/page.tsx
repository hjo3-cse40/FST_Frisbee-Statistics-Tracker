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

      <div className="header" style={{ marginBottom: '2rem' }}>
        <p className="subtitle" style={{ maxWidth: '640px', margin: '0 auto 1.5rem', lineHeight: 1.6 }}>
          FST is a real-time ultimate frisbee stats tracker. Capture every point, every play,
          and every player action as it happens — then turn your games into clear, structured insights.
        </p>

        <h2 style={{
          fontSize: '1.125rem',
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginBottom: '1rem',
        }}>
          What you can do
        </h2>

        <ul className="guide-list" style={{ textAlign: 'left' }}>
          <li>Track live games point-by-point</li>
          <li>Record goals, assists, turnovers, blocks, and callahans</li>
          <li>Manage teams and player lineups</li>
          <li>Review full game history anytime</li>
          <li>Export stats to CSV for analysis</li>
        </ul>
      </div>
      
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
      </div>
      
      <div className="quick-start-guide">
          <h2 style={{
            fontSize: '1.125rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: '1rem',
            textAlign: 'center',
          }}>
          Quick Start Guide
        </h2>
        <ul className="guide-list">
          <li>Create your teams and add player rosters</li>
          <li>Start a new game and select team colors</li>
          <li>Pick 7 players/team for the starting lineup</li>
          <li>Track stats in real-time during points</li>
          <li>Export game data after completion</li>
        </ul>
      </div>
    </div>
  )
}
