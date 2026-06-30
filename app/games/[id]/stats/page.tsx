'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  fetchGameStats,
  formatRate,
  type GameStatsResult,
  type PlayerGameStats,
  type TeamGameStats,
} from '@/lib/gameStats'
import {
  buildExportFilename,
  buildGameStatsCsv,
  downloadCsv,
  type ExportScope,
} from '@/lib/exportGameStatsCsv'

function PlayerStatsTable({ players }: { players: PlayerGameStats[] }) {
  if (players.length === 0) {
    return (
      <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem', margin: '0.5rem 0' }}>
        No players recorded for this team yet.
      </p>
    )
  }

  return (
    <div className="stats-table-wrap">
      <table className="stats-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>PP</th>
            <th>A</th>
            <th>G</th>
            <th>B</th>
            <th>TO</th>
          </tr>
        </thead>
        <tbody>
          {players.map((player) => (
            <tr key={player.playerId}>
              <td>
                <span className="stats-player-name">{player.name}</span>
                <span className="stats-player-number">#{player.number}</span>
              </td>
              <td>{player.pointsPlayed}</td>
              <td>{player.assists}</td>
              <td>{player.goals}</td>
              <td>{player.blocks}</td>
              <td>{player.turnovers}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TeamSummary({ stats }: { stats: TeamGameStats }) {
  const rows: { label: string; value: string }[] = [
    { label: 'Goals Scored', value: String(stats.goalsScored) },
    { label: 'Goals Given', value: String(stats.goalsGiven) },
    { label: 'Total Points', value: String(stats.totalPoints) },
    { label: 'Blocks', value: String(stats.blocks) },
    { label: 'Turnovers', value: String(stats.turnovers) },
    { label: 'Blocks/Pt', value: formatRate(stats.blocksPerPoint) },
    { label: 'Turnovers/Pt', value: formatRate(stats.turnoversPerPoint) },
  ]

  return (
    <div className="team-summary-card">
      {rows.map((row) => (
        <div key={row.label} className="team-summary-row">
          <span className="team-summary-label">{row.label}</span>
          <span className="team-summary-value">{row.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function GameStatsPage({ params }: { params: { id: string } }) {
  const [stats, setStats] = useState<GameStatsResult | null>(null)
  const [gameNameValue, setGameNameValue] = useState('')
  const [showExportModal, setShowExportModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (stats) {
      setGameNameValue(stats.game.name || stats.game.location || '')
    }
  }, [stats?.game.id, stats?.game.name, stats?.game.location])

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        setLoading(true)
        setError(null)
        const result = await fetchGameStats(params.id)
        if (!cancelled) setStats(result)
      } catch (err: unknown) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Failed to load game stats'
          setError(message)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [params.id])

  const saveGameName = async () => {
    if (!stats) return

    const trimmed = gameNameValue.trim()
    const savedDisplay = stats.game.name || stats.game.location || ''

    if (!trimmed) {
      setGameNameValue(savedDisplay)
      return
    }

    if (trimmed === (stats.game.name ?? '')) {
      setGameNameValue(trimmed)
      return
    }

    const { error: updateError } = await supabase
      .from('games')
      .update({ name: trimmed })
      .eq('id', stats.game.id)

    if (updateError) {
      alert(`Failed to update game name: ${updateError.message}`)
      setGameNameValue(savedDisplay)
      return
    }

    setStats({
      ...stats,
      game: { ...stats.game, name: trimmed },
    })
    setGameNameValue(trimmed)
  }

  const handleExport = (scope: ExportScope) => {
    if (!stats) return

    const csv = buildGameStatsCsv(stats, scope)
    const filename = buildExportFilename(stats, scope)
    downloadCsv(filename, csv)
    setShowExportModal(false)
  }

  const hasStats = stats && (stats.homeStats.totalPoints > 0 || stats.awayStats.totalPoints > 0)

  if (loading) {
    return (
      <div className="container">
        <p>Loading stats...</p>
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="container">
        <Link href={`/games/${params.id}`} className="back-button">
          ← Back to game
        </Link>
        <p style={{ color: '#dc2626' }}>{error ?? 'Game not found'}</p>
      </div>
    )
  }

  const subtitle = stats.gameIsOver ? 'Final stats' : 'Stats so far'

  return (
    <div className="container">
      <Link href="/games" className="back-button">
        ← All Games
      </Link>

      <div className="header" style={{ marginBottom: '1.5rem' }}>
        <input
          type="text"
          value={gameNameValue}
          onChange={(e) => setGameNameValue(e.target.value)}
          onBlur={saveGameName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.currentTarget.blur()
            } else if (e.key === 'Escape') {
              setGameNameValue(stats.game.name || stats.game.location || '')
              e.currentTarget.blur()
            }
          }}
          className="input game-name-input"
          style={{ fontSize: '1.75rem' }}
          placeholder={stats.game.location || 'Game name'}
          aria-label="Game name"
        />
        <p className="subtitle">{subtitle}</p>
        <p className="description">{new Date(stats.game.date).toLocaleDateString()}</p>
      </div>

      <div className="stats-scoreboard">
        <div className="stats-score-team">
          <span className="team-color-swatch" style={{ backgroundColor: stats.homeStats.jerseyColor }} />
          <span className="stats-score-team-name">{stats.homeTeam.name}</span>
          <span
            className="stats-score-value"
            style={{ color: stats.gameIsOver && stats.game.home_score >= stats.game.points_to_win ? '#059669' : undefined }}
          >
            {stats.game.home_score}
          </span>
        </div>
        <span className="stats-score-divider">–</span>
        <div className="stats-score-team">
          <span className="team-color-swatch" style={{ backgroundColor: stats.awayStats.jerseyColor }} />
          <span className="stats-score-team-name">{stats.awayTeam.name}</span>
          <span
            className="stats-score-value"
            style={{ color: stats.gameIsOver && stats.game.away_score >= stats.game.points_to_win ? '#059669' : undefined }}
          >
            {stats.game.away_score}
          </span>
        </div>
      </div>

      {stats.homeStats.totalPoints === 0 && stats.awayStats.totalPoints === 0 ? (
        <div className="empty-state-container" style={{ marginTop: '2rem' }}>
          <p>No points played yet. Start tracking to see stats here.</p>
          <Link href={`/games/${params.id}`} className="primary-button large">
            Go to Game
          </Link>
        </div>
      ) : (
        <>
          <section className="stats-team-section">
            <h2 className="stats-team-heading">
              <span className="team-color-swatch" style={{ backgroundColor: stats.homeStats.jerseyColor }} />
              {stats.homeStats.teamName}
            </h2>
            <PlayerStatsTable players={stats.homeStats.players} />
            <h3 className="stats-summary-heading">Team totals</h3>
            <TeamSummary stats={stats.homeStats} />
          </section>

          <section className="stats-team-section">
            <h2 className="stats-team-heading">
              <span className="team-color-swatch" style={{ backgroundColor: stats.awayStats.jerseyColor }} />
              {stats.awayStats.teamName}
            </h2>
            <PlayerStatsTable players={stats.awayStats.players} />
            <h3 className="stats-summary-heading">Team totals</h3>
            <TeamSummary stats={stats.awayStats} />
          </section>
        </>
      )}

      <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {!stats.gameIsOver && (
          <Link href={`/games/${params.id}`} className="primary-button large" style={{ textAlign: 'center', textDecoration: 'none' }}>
            Back to Live Game
          </Link>
        )}
        {stats.gameIsOver && (
          <Link href={`/games/${params.id}`} className="secondary-button large" style={{ textAlign: 'center', textDecoration: 'none' }}>
            View Point History
          </Link>
        )}
        {hasStats && (
          <button
            type="button"
            onClick={() => setShowExportModal(true)}
            className="secondary-button large"
          >
            Export to CSV
          </button>
        )}
      </div>

      {showExportModal && (
        <div className="modal-overlay" onClick={() => setShowExportModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Export to CSV</h2>
            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
              Choose a team or export the full game. Opens in Google Sheets or Excel.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => handleExport('home')}
                className="secondary-button large"
              >
                {stats.homeTeam.name}
              </button>
              <button
                type="button"
                onClick={() => handleExport('away')}
                className="secondary-button large"
              >
                {stats.awayTeam.name}
              </button>
              <button
                type="button"
                onClick={() => handleExport('both')}
                className="primary-button large"
              >
                Game stats
              </button>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="secondary-button"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="stats-legend" style={{ marginTop: '1.5rem' }}>
        PP = Points Played · A = Assists · G = Goals · B = Blocks · TO = Turnovers
      </p>
    </div>
  )
}
