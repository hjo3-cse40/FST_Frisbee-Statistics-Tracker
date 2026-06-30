'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/app/components/AuthProvider'

interface Game {
  id: string
  team_home_id: string
  team_away_id: string
  team_home_jersey_color?: string | null
  team_away_jersey_color?: string | null
  home_score: number
  away_score: number
  points_to_win: number
  location?: string
  name?: string
  date: string
}

interface Team {
  id: string
  name: string
  color_primary: string
}

export default function GamesListPage() {
  const { user } = useAuth()
  const [games, setGames] = useState<Game[]>([])
  const [teams, setTeams] = useState<Map<string, Team>>(new Map())
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    loadGames()
  }, [user])

  const loadGames = async () => {
    try {
      setLoading(true)
      
      // Load games filtered by user_id (or guest games if not logged in)
      let query = supabase
        .from('games')
        .select('*')
      
      if (user) {
        query = query.eq('user_id', user.id)
      } else {
        query = query.is('user_id', null)
      }
      
      const { data: gamesData, error: gamesError } = await query
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })

      if (gamesError) throw gamesError
      setGames(gamesData || [])

      // Load all unique team IDs
      const teamIds = new Set<string>()
      gamesData?.forEach(game => {
        if (game.team_home_id) teamIds.add(game.team_home_id)
        if (game.team_away_id) teamIds.add(game.team_away_id)
      })

      if (teamIds.size > 0) {
        // Load team details
        const { data: teamsData, error: teamsError } = await supabase
          .from('teams')
          .select('*')
          .in('id', Array.from(teamIds))

        if (teamsError) throw teamsError

        const teamsMap = new Map<string, Team>()
        teamsData?.forEach(team => {
          teamsMap.set(team.id, team)
        })
        setTeams(teamsMap)
      }
    } catch (error) {
      console.error('Error loading games:', error)
    } finally {
      setLoading(false)
    }
  }

  const deleteGame = async (gameId: string, displayName: string) => {
    const label = displayName || 'this game'
    if (!confirm(`Delete "${label}"? This cannot be undone.`)) return

    setDeletingId(gameId)
    try {
      const { error } = await supabase
        .from('games')
        .delete()
        .eq('id', gameId)

      if (error) throw error

      setGames((prev) => prev.filter((g) => g.id !== gameId))
    } catch (error) {
      console.error('Error deleting game:', error)
      alert('Failed to delete game. It may still have points or events linked to it.')
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <div className="container">
        <p>Loading games...</p>
      </div>
    )
  }

  return (
    <div className="container">
      <div className="header">
        <Link href="/" className="back-button">← Back</Link>
        <h1>All Games</h1>
        <p className="subtitle">{games.length} {games.length === 1 ? 'game' : 'games'} total</p>
      </div>

      {games.length === 0 ? (
        <div className="empty-state-container">
          <p>No games yet. Start tracking your first game!</p>
          <Link href="/games/setup" className="primary-button large">
            Start New Game
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '2rem' }}>
          {games.map(game => {
            const homeTeam = teams.get(game.team_home_id)
            const awayTeam = teams.get(game.team_away_id)
            const gameIsOver = game.home_score >= game.points_to_win || game.away_score >= game.points_to_win
            const winningTeam = game.home_score >= game.points_to_win 
              ? homeTeam 
              : game.away_score >= game.points_to_win 
              ? awayTeam 
              : null

            const homeColor =
              game.team_home_jersey_color ?? homeTeam?.color_primary ?? '#3B82F6'
            const awayColor =
              game.team_away_jersey_color ?? awayTeam?.color_primary ?? '#EF4444'

            const displayName = game.name || game.location || 'Untitled Game'

            return (
              <div key={game.id} style={{ position: 'relative' }}>
                <button
                  type="button"
                  className="delete-button"
                  aria-label={`Delete ${displayName}`}
                  disabled={deletingId === game.id}
                  onClick={() => deleteGame(game.id, displayName)}
                  style={{
                    position: 'absolute',
                    top: '0.75rem',
                    right: '0.75rem',
                    zIndex: 1,
                    opacity: deletingId === game.id ? 0.5 : 1,
                  }}
                >
                  ×
                </button>

              <Link
                href={gameIsOver ? `/games/${game.id}/stats` : `/games/${game.id}`}
                style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
              >
                <div
                  style={{
                    padding: '1.5rem',
                    paddingRight: '3rem',
                    border: '2px solid var(--border-color)',
                    borderRadius: '0.75rem',
                    backgroundColor: 'var(--bg-secondary)',
                    transition: 'all 0.2s',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-hover)'
                    e.currentTarget.style.transform = 'translateY(-2px)'
                    e.currentTarget.style.boxShadow = '0 4px 6px -1px var(--shadow)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-color)'
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <div>
                      <h3 style={{ margin: 0, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>
                        {displayName}
                      </h3>
                      <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>
                        {new Date(game.date).toLocaleDateString()}
                        {game.location && game.name && ` • ${game.location}`}
                      </p>
                    </div>
                    {gameIsOver && winningTeam && (
                      <div style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: '#059669',
                        backgroundColor: '#d1fae5',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '0.375rem'
                      }}>
                        🏆 {winningTeam.name} Won
                      </div>
                    )}
                    {!gameIsOver && (
                      <div style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: '#3b82f6',
                        backgroundColor: '#dbeafe',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '0.375rem'
                      }}>
                        In Progress
                      </div>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{
                        fontSize: '0.875rem',
                        color: 'var(--text-tertiary)',
                        marginBottom: '0.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.375rem',
                      }}>
                        <span className="team-color-swatch" style={{ backgroundColor: homeColor }} />
                        {homeTeam?.name || 'Team 1'}
                      </div>
                      <div style={{ 
                        fontSize: '2rem', 
                        fontWeight: 700, 
                        color: game.home_score >= game.points_to_win ? '#059669' : 'var(--text-primary)'
                      }}>
                        {game.home_score}
                      </div>
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-quaternary)' }}>
                      -
                    </div>
                    <div style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{
                        fontSize: '0.875rem',
                        color: 'var(--text-tertiary)',
                        marginBottom: '0.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.375rem',
                      }}>
                        <span className="team-color-swatch" style={{ backgroundColor: awayColor }} />
                        {awayTeam?.name || 'Team 2'}
                      </div>
                      <div style={{ 
                        fontSize: '2rem', 
                        fontWeight: 700, 
                        color: game.away_score >= game.points_to_win ? '#059669' : 'var(--text-primary)'
                      }}>
                        {game.away_score}
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ 
                    textAlign: 'center', 
                    marginTop: '0.75rem', 
                    fontSize: '0.75rem', 
                    color: 'var(--text-quaternary)' 
                  }}>
                    {gameIsOver ? 'Tap for game stats' : `Playing to ${game.points_to_win}`}
                  </div>
                </div>
              </Link>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}




