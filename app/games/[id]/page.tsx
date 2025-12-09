'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

interface Game {
  id: string
  team_home_id: string
  team_away_id: string
  pulling_team_id?: string | null
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

interface Event {
  id: string
  point_id: string
  event_type: 'goal' | 'turnover' | 'd'
  player_id: string
  assist_player_id: string | null
  sequence_number: number
  created_at: string
}

interface PointLineup {
  point_id: string
  player_id: string
  team_id: string
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
  const [activePoint, setActivePoint] = useState<Point | null>(null)
  const [activePointPlayers, setActivePointPlayers] = useState<Player[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [showStatButtons, setShowStatButtons] = useState<string | null>(null)
  const [showAssistSelection, setShowAssistSelection] = useState(false)
  const [pendingGoalPlayer, setPendingGoalPlayer] = useState<string | null>(null)

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
      
      // Set the most recent incomplete point as active
      const incompletePoint = data?.find(p => !p.scoring_team_id)
      if (incompletePoint) {
        setActivePoint(incompletePoint)
        loadActivePointData(incompletePoint.id)
      }
    } catch (error) {
      console.error('Error loading points:', error)
    }
  }

  const loadActivePointData = async (pointId: string) => {
    try {
      // Load players in lineup for this point
      const { data: lineupData, error: lineupError } = await supabase
        .from('point_lineups')
        .select('player_id')
        .eq('point_id', pointId)

      if (lineupError) throw lineupError

      if (lineupData && lineupData.length > 0) {
        const playerIds = lineupData.map(l => l.player_id)
        const { data: playersData, error: playersError } = await supabase
          .from('players')
          .select('*')
          .in('id', playerIds)

        if (playersError) throw playersError
        setActivePointPlayers(playersData || [])
      }

      // Load events for this point
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .eq('point_id', pointId)
        .order('sequence_number', { ascending: true })

      if (eventsError) throw eventsError
      setEvents(eventsData || [])
    } catch (error) {
      console.error('Error loading active point data:', error)
    }
  }

  const recordEvent = async (eventType: 'goal' | 'turnover' | 'd', playerId: string, assistPlayerId?: string) => {
    if (!activePoint || !game) return

    // If recording a goal, validate that pulling team can't score without receiving team turning over
    if (eventType === 'goal') {
      const player = activePointPlayers.find(p => p.id === playerId)
      if (!player) return

      const { pullingTeamId, receivingTeamId } = getPullingAndReceivingTeams()
      
      // If the scoring player is on the pulling team (defense)
      if (pullingTeamId && player.team_id === pullingTeamId) {
        // Check if receiving team has any turnovers
        const receivingTeamTurnovers = events.filter(e => {
          if (e.event_type !== 'turnover') return false
          const turnoverPlayer = activePointPlayers.find(p => p.id === e.player_id)
          return turnoverPlayer && turnoverPlayer.team_id === receivingTeamId
        })

        if (receivingTeamTurnovers.length === 0) {
          const receivingTeam = receivingTeamId === game.team_home_id ? homeTeam : awayTeam
          alert(`Cannot record goal: ${receivingTeam?.name || 'The receiving team'} must have at least one turnover before ${pullingTeamId === game.team_home_id ? homeTeam?.name : awayTeam?.name} can score.`)
          return
        }
      }
    }

    try {
      // Get next sequence number
      const nextSequence = events.length > 0 
        ? Math.max(...events.map(e => e.sequence_number)) + 1 
        : 1

      const eventData: any = {
        point_id: activePoint.id,
        event_type: eventType,
        player_id: playerId,
        sequence_number: nextSequence
      }

      if (eventType === 'goal' && assistPlayerId) {
        eventData.assist_player_id = assistPlayerId
      }

      const { data, error } = await supabase
        .from('events')
        .insert([eventData])
        .select()
        .single()

      if (error) throw error

      // Reload events
      await loadActivePointData(activePoint.id)
      setShowStatButtons(null)
      setShowAssistSelection(false)
      setPendingGoalPlayer(null)
    } catch (error: any) {
      console.error('Error recording event:', error)
      alert(`Failed to record event: ${error?.message || 'Unknown error'}`)
    }
  }

  const undoLastEvent = async () => {
    if (!activePoint || events.length === 0) return

    try {
      const lastEvent = events[events.length - 1]
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', lastEvent.id)

      if (error) throw error

      // Reload events
      await loadActivePointData(activePoint.id)
    } catch (error: any) {
      console.error('Error undoing event:', error)
      alert(`Failed to undo event: ${error?.message || 'Unknown error'}`)
    }
  }

  const handlePlayerTap = (playerId: string) => {
    setShowStatButtons(playerId)
    setShowAssistSelection(false)
    setPendingGoalPlayer(null)
  }

  const getPlayerStats = (playerId: string) => {
    const goals = events.filter(e => e.event_type === 'goal' && e.player_id === playerId).length
    const assists = events.filter(e => e.event_type === 'goal' && e.assist_player_id === playerId).length
    const turnovers = events.filter(e => e.event_type === 'turnover' && e.player_id === playerId).length
    const ds = events.filter(e => e.event_type === 'd' && e.player_id === playerId).length
    
    return { goals, assists, turnovers, ds }
  }

  const getPullingAndReceivingTeams = () => {
    if (!game?.pulling_team_id || !activePoint) return { pullingTeamId: null, receivingTeamId: null }
    
    let pullingTeamId: string | null = null
    
    if (activePoint.point_number === 1) {
      pullingTeamId = game.pulling_team_id
    } else {
      const previousPoint = points.find(p => p.point_number === activePoint.point_number - 1)
      if (previousPoint && previousPoint.scoring_team_id) {
        pullingTeamId = previousPoint.scoring_team_id
      } else {
        pullingTeamId = game.pulling_team_id
      }
    }
    
    const receivingTeamId = pullingTeamId === game.team_home_id ? game.team_away_id : game.team_home_id
    
    return { pullingTeamId, receivingTeamId }
  }

  const handleGoalClick = (playerId: string) => {
    // For goals, we need to check if there are other players on the same team
    // who could have assisted
    const player = activePointPlayers.find(p => p.id === playerId)
    if (!player) return

    const teammates = activePointPlayers.filter(
      p => p.team_id === player.team_id && p.id !== playerId
    )

    if (teammates.length > 0) {
      // Show assist selection
      setPendingGoalPlayer(playerId)
      setShowAssistSelection(true)
      setShowStatButtons(null)
    } else {
      // No teammates, record goal without assist
      recordEvent('goal', playerId)
    }
  }

  const completePoint = async (scoringTeamId: string) => {
    if (!activePoint || !game) return

    // Validate that there is at least one goal with an assist
    const goalEvents = events.filter(e => e.event_type === 'goal')
    
    if (goalEvents.length === 0) {
      alert('Cannot complete point: No goal has been recorded. Please record at least one goal before completing the point.')
      return
    }

    // Check if at least one goal has an assist
    const goalsWithAssists = goalEvents.filter(e => e.assist_player_id !== null)
    
    if (goalsWithAssists.length === 0) {
      alert('Cannot complete point: No goal has an assist recorded. Please record a goal with an assist before completing the point.')
      return
    }

    // Validate that if pulling team scored, receiving team had a turnover
    const { pullingTeamId, receivingTeamId } = getPullingAndReceivingTeams()
    
    if (pullingTeamId && scoringTeamId === pullingTeamId) {
      const receivingTeamTurnovers = events.filter(e => {
        if (e.event_type !== 'turnover') return false
        const turnoverPlayer = activePointPlayers.find(p => p.id === e.player_id)
        return turnoverPlayer && turnoverPlayer.team_id === receivingTeamId
      })

      if (receivingTeamTurnovers.length === 0) {
        const receivingTeam = receivingTeamId === game.team_home_id ? homeTeam : awayTeam
        alert(`Cannot complete point: ${receivingTeam?.name || 'The receiving team'} must have at least one turnover before the pulling team can score.`)
        return
      }
    }

    try {
      // Update the point to mark it as scored
      const { error: pointError } = await supabase
        .from('points')
        .update({ scoring_team_id: scoringTeamId })
        .eq('id', activePoint.id)

      if (pointError) throw pointError

      // Update game scores
      const newHomeScore = scoringTeamId === game.team_home_id 
        ? game.home_score + 1 
        : game.home_score
      const newAwayScore = scoringTeamId === game.team_away_id 
        ? game.away_score + 1 
        : game.away_score

      const { error: gameError } = await supabase
        .from('games')
        .update({ 
          home_score: newHomeScore,
          away_score: newAwayScore
        })
        .eq('id', game.id)

      if (gameError) throw gameError

      // Reload game and points
      await loadGame()
      await loadPoints()
      
      // Clear active point
      setActivePoint(null)
      setActivePointPlayers([])
      setEvents([])
    } catch (error: any) {
      console.error('Error completing point:', error)
      alert(`Failed to complete point: ${error?.message || 'Unknown error'}`)
    }
  }

  const loadLastLineup = async () => {
    if (!game || points.length === 0) return

    try {
      // Find the most recent completed point
      const completedPoints = points
        .filter(p => p.scoring_team_id)
        .sort((a, b) => b.point_number - a.point_number)

      if (completedPoints.length === 0) {
        alert('No previous point found to reload lineup from')
        return
      }

      const lastPoint = completedPoints[0]

      // Load lineup from last point
      const { data: lineupData, error: lineupError } = await supabase
        .from('point_lineups')
        .select('player_id, team_id')
        .eq('point_id', lastPoint.id)

      if (lineupError) throw lineupError

      if (!lineupData || lineupData.length === 0) {
        alert('No lineup found for previous point')
        return
      }

      // Separate by team
      const lastHomePlayers = lineupData
        .filter(l => l.team_id === game.team_home_id)
        .map(l => l.player_id)
      const lastAwayPlayers = lineupData
        .filter(l => l.team_id === game.team_away_id)
        .map(l => l.player_id)

      setSelectedHomePlayers(lastHomePlayers)
      setSelectedAwayPlayers(lastAwayPlayers)
    } catch (error: any) {
      console.error('Error loading last lineup:', error)
      alert(`Failed to load last lineup: ${error?.message || 'Unknown error'}`)
    }
  }

  const selectRandomPlayers = () => {
    if (!homePlayers.length || !awayPlayers.length) {
      alert('Please wait for players to load')
      return
    }

    // Shuffle and take first 7 for each team
    const shuffledHome = [...homePlayers].sort(() => Math.random() - 0.5)
    const shuffledAway = [...awayPlayers].sort(() => Math.random() - 0.5)

    setSelectedHomePlayers(shuffledHome.slice(0, 7).map(p => p.id))
    setSelectedAwayPlayers(shuffledAway.slice(0, 7).map(p => p.id))
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

      // Set the new point as active and load its data
      setActivePoint(pointData)
      await loadActivePointData(pointData.id)

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
                  onClick={() => {
                    if (!point.scoring_team_id) {
                      setActivePoint(point)
                      loadActivePointData(point.id)
                    }
                  }}
                  style={{
                    padding: '1rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.5rem',
                    backgroundColor: point.id === activePoint?.id ? '#dbeafe' : '#f9fafb',
                    cursor: !point.scoring_team_id ? 'pointer' : 'default'
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

      {/* Live Point Tracker */}
      {activePoint && (
        <div style={{ 
          marginTop: '2rem', 
          padding: '1.5rem',
          border: '2px solid #3B82F6',
          borderRadius: '0.75rem',
          backgroundColor: '#f0f9ff'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h2 style={{ margin: 0 }}>Live Point {activePoint.point_number}</h2>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              {(() => {
                const goalEvents = events.filter(e => e.event_type === 'goal')
                const goalsWithAssists = goalEvents.filter(e => e.assist_player_id !== null)
                const canComplete = goalEvents.length > 0 && goalsWithAssists.length > 0
                
                // Determine which team scored based on the first goal with assist
                let scoringTeamId: string | null = null
                if (canComplete && goalsWithAssists.length > 0) {
                  const firstGoalWithAssist = goalsWithAssists[0]
                  const goalScorer = activePointPlayers.find(p => p.id === firstGoalWithAssist.player_id)
                  if (goalScorer) {
                    scoringTeamId = goalScorer.team_id
                  }
                }
                
                return (
                  <>
                    {!canComplete && (
                      <span style={{ 
                        fontSize: '0.75rem', 
                        color: '#ef4444',
                        padding: '0.25rem 0.5rem',
                        backgroundColor: '#fee2e2',
                        borderRadius: '0.25rem'
                      }}>
                        {goalEvents.length === 0 
                          ? 'Record a goal to complete point'
                          : 'Record a goal with assist to complete point'}
                      </span>
                    )}
                    {canComplete && (
                      <span style={{ 
                        fontSize: '0.75rem', 
                        color: '#059669',
                        padding: '0.25rem 0.5rem',
                        backgroundColor: '#d1fae5',
                        borderRadius: '0.25rem'
                      }}>
                        ✓ Ready to complete
                      </span>
                    )}
                    {events.length > 0 && (
                      <button
                        onClick={undoLastEvent}
                        className="secondary-button"
                        style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                      >
                        Undo Last Event
                      </button>
                    )}
                    {canComplete && scoringTeamId && (
                      <button
                        onClick={() => {
                          if (confirm(`Did ${scoringTeamId === game.team_home_id ? homeTeam?.name : awayTeam?.name} score this point?`)) {
                            completePoint(scoringTeamId)
                          }
                        }}
                        className="primary-button"
                        style={{ 
                          fontSize: '0.875rem', 
                          padding: '0.5rem 1rem',
                          backgroundColor: scoringTeamId === game.team_home_id 
                            ? (homeTeam?.color_primary || '#3B82F6')
                            : (awayTeam?.color_primary || '#3B82F6')
                        }}
                      >
                        {scoringTeamId === game.team_home_id ? (homeTeam?.name || 'Home') : (awayTeam?.name || 'Away')} Scored
                      </button>
                    )}
                  </>
                )
              })()}
            </div>
          </div>

          {/* Active Players */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ marginBottom: '0.5rem', fontSize: '1rem' }}>Active Players - Tap to Record Stats</h3>
            {game.pulling_team_id && (() => {
              const { pullingTeamId, receivingTeamId } = getPullingAndReceivingTeams()
              
              if (!pullingTeamId || !receivingTeamId) return null
              
              const pullingTeam = pullingTeamId === game.team_home_id ? homeTeam : awayTeam
              const receivingTeam = receivingTeamId === game.team_home_id ? homeTeam : awayTeam
              
              return (
                <p style={{ 
                  fontSize: '0.875rem', 
                  color: '#6b7280', 
                  marginBottom: '0.75rem',
                  fontStyle: 'italic'
                }}>
                  {pullingTeam?.name || 'Team'} pulls, {receivingTeam?.name || 'Team'} receives
                </p>
              )
            })()}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              {/* Home Team Players */}
              <div>
                <h4 style={{ 
                  fontSize: '0.875rem', 
                  fontWeight: 600, 
                  color: homeTeam?.color_primary || '#000',
                  marginBottom: '0.5rem'
                }}>
                  {homeTeam?.name || 'Home Team'}
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {activePointPlayers
                    .filter(p => p.team_id === game.team_home_id)
                    .map(player => {
                      const stats = getPlayerStats(player.id)
                      return (
                        <button
                          key={player.id}
                          onClick={() => handlePlayerTap(player.id)}
                          style={{
                            padding: '0.75rem',
                            border: `2px solid ${showStatButtons === player.id ? homeTeam?.color_primary || '#3B82F6' : '#e5e7eb'}`,
                            borderRadius: '0.5rem',
                            backgroundColor: showStatButtons === player.id 
                              ? `${homeTeam?.color_primary || '#3B82F6'}20` 
                              : 'white',
                            textAlign: 'left',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                          }}
                        >
                          <span style={{ fontWeight: 600, minWidth: '30px' }}>#{player.number}</span>
                          <span style={{ flex: 1 }}>{player.name}</span>
                          <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                            {stats.goals > 0 && (
                              <span style={{
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                color: '#059669',
                                backgroundColor: '#d1fae5',
                                padding: '0.125rem 0.375rem',
                                borderRadius: '0.25rem'
                              }}>
                                G{stats.goals > 1 ? stats.goals : ''}
                              </span>
                            )}
                            {stats.assists > 0 && (
                              <span style={{
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                color: '#0284c7',
                                backgroundColor: '#e0f2fe',
                                padding: '0.125rem 0.375rem',
                                borderRadius: '0.25rem'
                              }}>
                                A{stats.assists > 1 ? stats.assists : ''}
                              </span>
                            )}
                            {stats.turnovers > 0 && (
                              <span style={{
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                color: '#dc2626',
                                backgroundColor: '#fee2e2',
                                padding: '0.125rem 0.375rem',
                                borderRadius: '0.25rem'
                              }}>
                                T{stats.turnovers > 1 ? stats.turnovers : ''}
                              </span>
                            )}
                            {stats.ds > 0 && (
                              <span style={{
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                color: '#7c3aed',
                                backgroundColor: '#ede9fe',
                                padding: '0.125rem 0.375rem',
                                borderRadius: '0.25rem'
                              }}>
                                D{stats.ds > 1 ? stats.ds : ''}
                              </span>
                            )}
                          </div>
                        </button>
                      )
                    })}
                </div>
              </div>

              {/* Away Team Players */}
              <div>
                <h4 style={{ 
                  fontSize: '0.875rem', 
                  fontWeight: 600, 
                  color: awayTeam?.color_primary || '#000',
                  marginBottom: '0.5rem'
                }}>
                  {awayTeam?.name || 'Away Team'}
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {activePointPlayers
                    .filter(p => p.team_id === game.team_away_id)
                    .map(player => {
                      const stats = getPlayerStats(player.id)
                      return (
                        <button
                          key={player.id}
                          onClick={() => handlePlayerTap(player.id)}
                          style={{
                            padding: '0.75rem',
                            border: `2px solid ${showStatButtons === player.id ? awayTeam?.color_primary || '#3B82F6' : '#e5e7eb'}`,
                            borderRadius: '0.5rem',
                            backgroundColor: showStatButtons === player.id 
                              ? `${awayTeam?.color_primary || '#3B82F6'}20` 
                              : 'white',
                            textAlign: 'left',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                          }}
                        >
                          <span style={{ fontWeight: 600, minWidth: '30px' }}>#{player.number}</span>
                          <span style={{ flex: 1 }}>{player.name}</span>
                          <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                            {stats.goals > 0 && (
                              <span style={{
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                color: '#059669',
                                backgroundColor: '#d1fae5',
                                padding: '0.125rem 0.375rem',
                                borderRadius: '0.25rem'
                              }}>
                                G{stats.goals > 1 ? stats.goals : ''}
                              </span>
                            )}
                            {stats.assists > 0 && (
                              <span style={{
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                color: '#0284c7',
                                backgroundColor: '#e0f2fe',
                                padding: '0.125rem 0.375rem',
                                borderRadius: '0.25rem'
                              }}>
                                A{stats.assists > 1 ? stats.assists : ''}
                              </span>
                            )}
                            {stats.turnovers > 0 && (
                              <span style={{
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                color: '#dc2626',
                                backgroundColor: '#fee2e2',
                                padding: '0.125rem 0.375rem',
                                borderRadius: '0.25rem'
                              }}>
                                T{stats.turnovers > 1 ? stats.turnovers : ''}
                              </span>
                            )}
                            {stats.ds > 0 && (
                              <span style={{
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                color: '#7c3aed',
                                backgroundColor: '#ede9fe',
                                padding: '0.125rem 0.375rem',
                                borderRadius: '0.25rem'
                              }}>
                                D{stats.ds > 1 ? stats.ds : ''}
                              </span>
                            )}
                          </div>
                        </button>
                      )
                    })}
                </div>
              </div>
            </div>
          </div>

          {/* Stat Buttons Modal */}
          {showStatButtons && (
            <div className="modal-overlay" onClick={() => setShowStatButtons(null)}>
              <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                <h3 style={{ marginBottom: '1rem' }}>
                  {activePointPlayers.find(p => p.id === showStatButtons)?.name || 'Player'}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <button
                    onClick={() => handleGoalClick(showStatButtons)}
                    className="primary-button"
                    style={{ padding: '1rem', fontSize: '1rem' }}
                  >
                    Goal
                  </button>
                  <button
                    onClick={() => recordEvent('turnover', showStatButtons)}
                    className="secondary-button"
                    style={{ padding: '1rem', fontSize: '1rem' }}
                  >
                    Turnover
                  </button>
                  <button
                    onClick={() => recordEvent('d', showStatButtons)}
                    className="secondary-button"
                    style={{ padding: '1rem', fontSize: '1rem' }}
                  >
                    D (Defensive Play)
                  </button>
                  <button
                    onClick={() => setShowStatButtons(null)}
                    className="secondary-button"
                    style={{ padding: '0.75rem', fontSize: '0.875rem', marginTop: '0.5rem' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Assist Selection Modal */}
          {showAssistSelection && pendingGoalPlayer && (
            <div className="modal-overlay" onClick={() => {
              setShowAssistSelection(false)
              setPendingGoalPlayer(null)
            }}>
              <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                <h3 style={{ marginBottom: '1rem' }}>Select Assister</h3>
                <p style={{ marginBottom: '1rem', fontSize: '0.875rem', color: '#6b7280' }}>
                  Who assisted {activePointPlayers.find(p => p.id === pendingGoalPlayer)?.name || 'this goal'}?
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto' }}>
                  {activePointPlayers
                    .filter(p => {
                      const goalPlayer = activePointPlayers.find(pl => pl.id === pendingGoalPlayer)
                      return goalPlayer && p.team_id === goalPlayer.team_id && p.id !== pendingGoalPlayer
                    })
                    .map(player => (
                      <button
                        key={player.id}
                        onClick={() => recordEvent('goal', pendingGoalPlayer, player.id)}
                        className="secondary-button"
                        style={{ padding: '0.75rem', textAlign: 'left' }}
                      >
                        #{player.number} {player.name}
                      </button>
                    ))}
                  <button
                    onClick={() => recordEvent('goal', pendingGoalPlayer)}
                    className="secondary-button"
                    style={{ padding: '0.75rem', marginTop: '0.5rem' }}
                  >
                    No Assist
                  </button>
                  <button
                    onClick={() => {
                      setShowAssistSelection(false)
                      setPendingGoalPlayer(null)
                    }}
                    className="secondary-button"
                    style={{ padding: '0.75rem', fontSize: '0.875rem', marginTop: '0.5rem' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Event History */}
          {events.length > 0 && (
            <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #e5e7eb' }}>
              <h3 style={{ marginBottom: '0.75rem', fontSize: '1rem' }}>Event History</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {events.map(event => {
                  const player = activePointPlayers.find(p => p.id === event.player_id)
                  const assistPlayer = event.assist_player_id 
                    ? activePointPlayers.find(p => p.id === event.assist_player_id)
                    : null
                  
                  const getEventDescription = () => {
                    if (event.event_type === 'goal') {
                      return assistPlayer 
                        ? `Goal by #${player?.number} ${player?.name} (assist: #${assistPlayer?.number} ${assistPlayer?.name})`
                        : `Goal by #${player?.number} ${player?.name}`
                    } else if (event.event_type === 'turnover') {
                      return `Turnover by #${player?.number} ${player?.name}`
                    } else if (event.event_type === 'd') {
                      return `D by #${player?.number} ${player?.name}`
                    }
                    return 'Unknown event'
                  }

                  return (
                    <div
                      key={event.id}
                      style={{
                        padding: '0.75rem',
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '0.5rem',
                        fontSize: '0.875rem'
                      }}
                    >
                      {getEventDescription()}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {showLineupSelection && (
        <div className="modal-overlay" onClick={() => !loadingLineup && setShowLineupSelection(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '90vh', overflow: 'auto' }}>
            <h2>Select Lineups - Point {points.length + 1}</h2>
            <p style={{ marginBottom: '1rem', color: '#6b7280', fontSize: '0.875rem' }}>
              Select 7 players for each team
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              <button
                onClick={loadLastLineup}
                className="secondary-button"
                style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                disabled={points.length === 0}
              >
                Reload Last Lineup
              </button>
              <button
                onClick={selectRandomPlayers}
                className="secondary-button"
                style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
              >
                Random 7 (Testing)
              </button>
            </div>

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
