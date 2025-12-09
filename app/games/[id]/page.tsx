'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

interface Game {
  id: string
  team_home_id: string
  team_away_id: string
  home_score: number
  away_score: number
  location?: string
  name?: string
  date: string
}

interface Team {
  id: string
  name: string
  color_primary: string
}

interface Player {
  id: string
  name: string
  number: number
  team_id: string
}

interface Point {
  id: string
  game_id: string
  point_number: number
  scoring_team_id: string | null
  created_at: string
}

export default function GamePage({ params }: { params: { id: string } }) {
  const [game, setGame] = useState<Game | null>(null)
  const [homeTeam, setHomeTeam] = useState<Team | null>(null)
  const [awayTeam, setAwayTeam] = useState<Team | null>(null)
  const [loading, setLoading] = useState(true)
  const [showLineupSelection, setShowLineupSelection] = useState(false)
  const [homePlayers, setHomePlayers] = useState<Player[]>([])
  const [awayPlayers, setAwayPlayers] = useState<Player[]>([])
  const [selectedHomePlayers, setSelectedHomePlayers] = useState<string[]>([])
  const [selectedAwayPlayers, setSelectedAwayPlayers] = useState<string[]>([])
  const [points, setPoints] = useState<Point[]>([])
  const [loadingLineup, setLoadingLineup] = useState(false)

  useEffect(() => {
    loadGame()
    loadPoints()
  }, [params.id])

  const loadGame = async () => {
    try {
      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .select('*')
        .eq('id', params.id)
        .single()

      if (gameError) throw gameError
      setGame(gameData)

      // Fetch home team
      if (gameData.team_home_id) {
        const { data: homeTeamData, error: homeError } = await supabase
          .from('teams')
          .select('*')
          .eq('id', gameData.team_home_id)
          .single()

        if (!homeError && homeTeamData) {
          setHomeTeam(homeTeamData)
        }
      }

      // Fetch away team
      if (gameData.team_away_id) {
        const { data: awayTeamData, error: awayError } = await supabase
          .from('teams')
          .select('*')
          .eq('id', gameData.team_away_id)
          .single()

        if (!awayError && awayTeamData) {
          setAwayTeam(awayTeamData)
        }
      }
    } catch (error) {
      console.error('Error loading game:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadPoints = async () => {
    try {
      const { data, error } = await supabase
        .from('points')
        .select('*')
        .eq('game_id', params.id)
        .order('point_number', { ascending: true })

      if (error) throw error
      setPoints(data || [])
    } catch (error) {
      console.error('Error loading points:', error)
    }
  }

  const startNewPoint = async () => {
    if (!game || !homeTeam || !awayTeam) return

    // Load players for both teams
    try {
      const [homePlayersData, awayPlayersData] = await Promise.all([
        supabase
          .from('players')
          .select('*')
          .eq('team_id', game.team_home_id)
          .order('number', { ascending: true }),
        supabase
          .from('players')
          .select('*')
          .eq('team_id', game.team_away_id)
          .order('number', { ascending: true })
      ])

      if (homePlayersData.error) throw homePlayersData.error
      if (awayPlayersData.error) throw awayPlayersData.error

      setHomePlayers(homePlayersData.data || [])
      setAwayPlayers(awayPlayersData.data || [])
      setSelectedHomePlayers([])
      setSelectedAwayPlayers([])
      setShowLineupSelection(true)
    } catch (error) {
      console.error('Error loading players:', error)
      alert('Failed to load players')
    }
  }

  const togglePlayerSelection = (playerId: string, teamId: string) => {
    if (teamId === game?.team_home_id) {
      setSelectedHomePlayers(prev => {
        if (prev.includes(playerId)) {
          return prev.filter(id => id !== playerId)
        } else if (prev.length < 7) {
          return [...prev, playerId]
        } else {
          alert('Maximum 7 players can be selected for home team')
          return prev
        }
      })
    } else {
      setSelectedAwayPlayers(prev => {
        if (prev.includes(playerId)) {
          return prev.filter(id => id !== playerId)
        } else if (prev.length < 7) {
          return [...prev, playerId]
        } else {
          alert('Maximum 7 players can be selected for away team')
          return prev
        }
      })
    }
  }

  const savePointAndLineups = async () => {
    if (!game) return

    // Validate that we have 7 players for each team
    if (selectedHomePlayers.length !== 7) {
      alert(`Please select exactly 7 players for ${homeTeam?.name || 'home team'}`)
      return
    }

    if (selectedAwayPlayers.length !== 7) {
      alert(`Please select exactly 7 players for ${awayTeam?.name || 'away team'}`)
      return
    }

    setLoadingLineup(true)

    try {
      // Calculate next point number
      const nextPointNumber = points.length > 0 
        ? Math.max(...points.map(p => p.point_number)) + 1 
        : 1

      // Create the point
      const { data: pointData, error: pointError } = await supabase
        .from('points')
        .insert([{
          game_id: game.id,
          point_number: nextPointNumber,
          scoring_team_id: null
        }])
        .select()
        .single()

      if (pointError) throw pointError

      // Create lineup entries for home team
      const homeLineups = selectedHomePlayers.map(playerId => ({
        point_id: pointData.id,
        player_id: playerId,
        team_id: game.team_home_id
      }))

      // Create lineup entries for away team
      const awayLineups = selectedAwayPlayers.map(playerId => ({
        point_id: pointData.id,
        player_id: playerId,
        team_id: game.team_away_id
      }))

      // Insert all lineups
      const { error: lineupError } = await supabase
        .from('point_lineups')
        .insert([...homeLineups, ...awayLineups])

      if (lineupError) throw lineupError

      // Reload points
      await loadPoints()

      // Close lineup selection
      setShowLineupSelection(false)
      setSelectedHomePlayers([])
      setSelectedAwayPlayers([])
    } catch (error: any) {
      console.error('Error saving point:', error)
      alert(`Failed to save point: ${error?.message || 'Unknown error'}`)
    } finally {
      setLoadingLineup(false)
    }
  }

  if (loading) {
    return (
      <div className="container">
        <p>Loading game...</p>
      </div>
    )
  }

  if (!game) {
    return (
      <div className="container">
        <p>Game not found</p>
        <Link href="/" className="primary-button">
          Go Home
        </Link>
      </div>
    )
  }

  return (
    <div className="container">
      <div className="header">
        <Link href="/" className="back-button">← Back</Link>
        <h1>{game.name || game.location || 'Game'}</h1>
        {game.name && game.location && (
          <p className="subtitle">{game.location}</p>
        )}
      </div>

      <div className="game-score">
        <div className="score-display">
          <div className="score-team">
            <h2>{homeTeam?.name || 'Home Team'}</h2>
            <div className="score-value">{game.home_score}</div>
          </div>
          <div className="score-separator">-</div>
          <div className="score-team">
            <h2>{awayTeam?.name || 'Away Team'}</h2>
            <div className="score-value">{game.away_score}</div>
          </div>
        </div>
      </div>

      <div className="game-info">
        <p className="game-status">Date: {new Date(game.date).toLocaleDateString()}</p>
      </div>

      <div style={{ marginTop: '2rem' }}>
        <button
          onClick={startNewPoint}
          className="primary-button large"
          style={{ width: '100%', marginBottom: '1rem' }}
        >
          Start New Point
        </button>

        {points.length > 0 && (
          <div style={{ marginTop: '2rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>Points ({points.length})</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {points.map(point => (
                <div
                  key={point.id}
                  style={{
                    padding: '1rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.5rem',
                    backgroundColor: '#f9fafb'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600 }}>Point {point.point_number}</span>
                    {point.scoring_team_id ? (
                      <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                        Scored by {point.scoring_team_id === game.team_home_id ? homeTeam?.name : awayTeam?.name}
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.875rem', color: '#9ca3af' }}>In progress</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showLineupSelection && (
        <div className="modal-overlay" onClick={() => !loadingLineup && setShowLineupSelection(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '90vh', overflow: 'auto' }}>
            <h2>Select Lineups - Point {points.length + 1}</h2>
            <p style={{ marginBottom: '1.5rem', color: '#6b7280', fontSize: '0.875rem' }}>
              Select 7 players for each team
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
              {/* Home Team Selection */}
              <div>
                {/* Selected Players Display */}
                {selectedHomePlayers.length > 0 && (
                  <div style={{
                    marginBottom: '1rem',
                    padding: '1rem',
                    backgroundColor: `${homeTeam?.color_primary || '#3B82F6'}10`,
                    border: `2px solid ${homeTeam?.color_primary || '#3B82F6'}`,
                    borderRadius: '0.5rem'
                  }}>
                    <div style={{ 
                      fontSize: '0.875rem', 
                      fontWeight: 600, 
                      color: homeTeam?.color_primary || '#3B82F6',
                      marginBottom: '0.75rem'
                    }}>
                      Selected Lineup ({selectedHomePlayers.length}/7)
                    </div>
                    <div style={{ 
                      display: 'flex', 
                      flexWrap: 'wrap', 
                      gap: '0.5rem'
                    }}>
                      {selectedHomePlayers.map(playerId => {
                        const player = homePlayers.find(p => p.id === playerId)
                        if (!player) return null
                        return (
                          <div
                            key={playerId}
                            onClick={() => togglePlayerSelection(playerId, game.team_home_id)}
                            style={{
                              padding: '0.5rem 0.75rem',
                              backgroundColor: homeTeam?.color_primary || '#3B82F6',
                              color: 'white',
                              borderRadius: '0.375rem',
                              fontSize: '0.875rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              transition: 'opacity 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                          >
                            <span style={{ fontWeight: 600 }}>#{player.number}</span>
                            <span>{player.name}</span>
                            <span style={{ marginLeft: '0.25rem' }}>×</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
                <h3 style={{ 
                  marginBottom: '1rem', 
                  color: homeTeam?.color_primary || '#000',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <div
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      backgroundColor: homeTeam?.color_primary || '#000'
                    }}
                  />
                  {homeTeam?.name || 'Home Team'}
                  <span style={{ fontSize: '0.875rem', fontWeight: 'normal', color: '#6b7280' }}>
                    ({selectedHomePlayers.length}/7)
                  </span>
                </h3>
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '0.5rem',
                  maxHeight: '400px',
                  overflowY: 'auto',
                  padding: '0.5rem',
                  border: `2px solid ${homeTeam?.color_primary || '#e5e7eb'}`,
                  borderRadius: '0.5rem'
                }}>
                  {homePlayers.length === 0 ? (
                    <p style={{ color: '#9ca3af', textAlign: 'center', padding: '1rem' }}>
                      No players available
                    </p>
                  ) : (
                    homePlayers.map(player => {
                        const isSelected = selectedHomePlayers.includes(player.id)
                        return (
                          <button
                            key={player.id}
                            onClick={() => togglePlayerSelection(player.id, game.team_home_id)}
                            disabled={!isSelected && selectedHomePlayers.length >= 7}
                            style={{
                              padding: '0.75rem',
                              border: `2px solid ${isSelected ? homeTeam?.color_primary || '#3B82F6' : '#e5e7eb'}`,
                              borderRadius: '0.5rem',
                              backgroundColor: isSelected 
                                ? `${homeTeam?.color_primary || '#3B82F6'}20` 
                                : 'white',
                              cursor: (!isSelected && selectedHomePlayers.length >= 7) ? 'not-allowed' : 'pointer',
                              opacity: (!isSelected && selectedHomePlayers.length >= 7) ? 0.5 : 1,
                              textAlign: 'left',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              transition: 'all 0.2s'
                            }}
                          >
                            <span style={{ 
                              fontWeight: 600, 
                              minWidth: '30px',
                              color: isSelected ? homeTeam?.color_primary || '#3B82F6' : '#374151'
                            }}>
                              #{player.number}
                            </span>
                            <span style={{ flex: 1 }}>{player.name}</span>
                            {isSelected && (
                              <span style={{ color: homeTeam?.color_primary || '#3B82F6', fontSize: '1.25rem' }}>
                                ✓
                              </span>
                            )}
                          </button>
                        )
                      })
                  )}
                </div>
              </div>

              {/* Away Team Selection */}
              <div>
                {/* Selected Players Display */}
                {selectedAwayPlayers.length > 0 && (
                  <div style={{
                    marginBottom: '1rem',
                    padding: '1rem',
                    backgroundColor: `${awayTeam?.color_primary || '#3B82F6'}10`,
                    border: `2px solid ${awayTeam?.color_primary || '#3B82F6'}`,
                    borderRadius: '0.5rem'
                  }}>
                    <div style={{ 
                      fontSize: '0.875rem', 
                      fontWeight: 600, 
                      color: awayTeam?.color_primary || '#3B82F6',
                      marginBottom: '0.75rem'
                    }}>
                      Selected Lineup ({selectedAwayPlayers.length}/7)
                    </div>
                    <div style={{ 
                      display: 'flex', 
                      flexWrap: 'wrap', 
                      gap: '0.5rem'
                    }}>
                      {selectedAwayPlayers.map(playerId => {
                        const player = awayPlayers.find(p => p.id === playerId)
                        if (!player) return null
                        return (
                          <div
                            key={playerId}
                            onClick={() => togglePlayerSelection(playerId, game.team_away_id)}
                            style={{
                              padding: '0.5rem 0.75rem',
                              backgroundColor: awayTeam?.color_primary || '#3B82F6',
                              color: 'white',
                              borderRadius: '0.375rem',
                              fontSize: '0.875rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              transition: 'opacity 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                          >
                            <span style={{ fontWeight: 600 }}>#{player.number}</span>
                            <span>{player.name}</span>
                            <span style={{ marginLeft: '0.25rem' }}>×</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
                <h3 style={{ 
                  marginBottom: '1rem',
                  color: awayTeam?.color_primary || '#000',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <div
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      backgroundColor: awayTeam?.color_primary || '#000'
                    }}
                  />
                  {awayTeam?.name || 'Away Team'}
                  <span style={{ fontSize: '0.875rem', fontWeight: 'normal', color: '#6b7280' }}>
                    ({selectedAwayPlayers.length}/7)
                  </span>
                </h3>
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '0.5rem',
                  maxHeight: '400px',
                  overflowY: 'auto',
                  padding: '0.5rem',
                  border: `2px solid ${awayTeam?.color_primary || '#e5e7eb'}`,
                  borderRadius: '0.5rem'
                }}>
                  {awayPlayers.length === 0 ? (
                    <p style={{ color: '#9ca3af', textAlign: 'center', padding: '1rem' }}>
                      No players available
                    </p>
                  ) : (
                    awayPlayers.map(player => {
                        const isSelected = selectedAwayPlayers.includes(player.id)
                        return (
                          <button
                            key={player.id}
                            onClick={() => togglePlayerSelection(player.id, game.team_away_id)}
                            disabled={!isSelected && selectedAwayPlayers.length >= 7}
                            style={{
                              padding: '0.75rem',
                              border: `2px solid ${isSelected ? awayTeam?.color_primary || '#3B82F6' : '#e5e7eb'}`,
                              borderRadius: '0.5rem',
                              backgroundColor: isSelected 
                                ? `${awayTeam?.color_primary || '#3B82F6'}20` 
                                : 'white',
                              cursor: (!isSelected && selectedAwayPlayers.length >= 7) ? 'not-allowed' : 'pointer',
                              opacity: (!isSelected && selectedAwayPlayers.length >= 7) ? 0.5 : 1,
                              textAlign: 'left',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              transition: 'all 0.2s'
                            }}
                          >
                            <span style={{ 
                              fontWeight: 600, 
                              minWidth: '30px',
                              color: isSelected ? awayTeam?.color_primary || '#3B82F6' : '#374151'
                            }}>
                              #{player.number}
                            </span>
                            <span style={{ flex: 1 }}>{player.name}</span>
                            {isSelected && (
                              <span style={{ color: awayTeam?.color_primary || '#3B82F6', fontSize: '1.25rem' }}>
                                ✓
                              </span>
                            )}
                          </button>
                        )
                      })
                  )}
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button 
                onClick={() => {
                  setShowLineupSelection(false)
                  setSelectedHomePlayers([])
                  setSelectedAwayPlayers([])
                }}
                className="secondary-button"
                disabled={loadingLineup}
              >
                Cancel
              </button>
              <button 
                onClick={savePointAndLineups}
                className="primary-button"
                disabled={loadingLineup || selectedHomePlayers.length !== 7 || selectedAwayPlayers.length !== 7}
              >
                {loadingLineup ? 'Saving...' : 'Start Point'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
