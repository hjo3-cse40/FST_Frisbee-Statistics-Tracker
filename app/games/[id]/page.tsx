'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/app/components/AuthProvider'

interface Game {
  id: string
  team_home_id: string
  team_away_id: string
  pulling_team_id?: string | null
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
  event_type: 'goal' | 'turnover' | 'd' | 'block' | 'throwaway' | 'drop' | 'stall' | 'interception' | 'callahan'
  player_id: string
  assist_player_id: string | null
  sequence_number: number
  is_turnover: boolean
  team_id: string | null
  created_at: string
}

interface PointLineup {
  point_id: string
  player_id: string
  team_id: string
}

export default function GamePage({ params }: { params: { id: string } }) {
  const { user } = useAuth()
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
  const [showTurnoverConfirmation, setShowTurnoverConfirmation] = useState(false)
  const [pendingBlockPlayer, setPendingBlockPlayer] = useState<string | null>(null)
  const [pendingDefensiveEventType, setPendingDefensiveEventType] = useState<'block' | 'interception' | 'callahan' | null>(null)
  const [showOffensiveCauseSelection, setShowOffensiveCauseSelection] = useState(false)
  const [pendingDefensiveEventConfirmed, setPendingDefensiveEventConfirmed] = useState<{ playerId: string, eventType: 'block' | 'interception' | 'callahan', isTurnover: boolean } | null>(null)
  const activePointRef = useRef<HTMLDivElement>(null)

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
        loadActivePointData(incompletePoint.id).then(() => {
          // Scroll to the active point after loading
          setTimeout(() => {
            activePointRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }, 100)
        })
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

  const recordEvent = async (
    eventType: 'goal' | 'turnover' | 'd' | 'block' | 'throwaway' | 'drop' | 'stall' | 'interception' | 'callahan',
    playerId: string,
    assistPlayerId?: string,
    isTurnover?: boolean
  ) => {
    if (!activePoint || !game) return

    const player = activePointPlayers.find(p => p.id === playerId)
    if (!player) return

    // Determine if this is a turnover based on event type and explicit flag
    let finalIsTurnover = false
    if (isTurnover !== undefined) {
      finalIsTurnover = isTurnover
    } else {
      // Auto-detect turnover status based on event type
      switch (eventType) {
        case 'goal':
          finalIsTurnover = false // Goals end possession but aren't turnovers
          break
        case 'turnover':
        case 'throwaway':
        case 'drop':
        case 'stall':
          finalIsTurnover = true
          break
        case 'd':
        case 'block':
        case 'interception':
        case 'callahan':
          // For defensive plays, default to true (most blocks cause turnovers)
          // But allow override via isTurnover parameter
          finalIsTurnover = true
          break
        default:
          finalIsTurnover = false
      }
    }

    // If recording a goal, validate that pulling team can't score without receiving team turning over
    if (eventType === 'goal') {
      const { pullingTeamId, receivingTeamId } = getPullingAndReceivingTeams()
      
      // If the scoring player is on the pulling team (defense)
      if (pullingTeamId && player.team_id === pullingTeamId) {
        // Check if receiving team has any turnovers
        // This includes:
        // 1. Turnovers by receiving team players (throwaway, drop, stall)
        // 2. Blocks/interceptions by pulling team (defense gets block/interception = receiving team loses possession)
        const receivingTeamTurnovers = events.filter(e => {
          if (!e.is_turnover) return false
          
          const turnoverPlayer = activePointPlayers.find(p => p.id === e.player_id)
          if (!turnoverPlayer) return false
          
          // If it's a block, interception, or callahan by the pulling team, it counts as a turnover by the receiving team
          if ((e.event_type === 'interception' || e.event_type === 'block' || e.event_type === 'd' || e.event_type === 'callahan') && turnoverPlayer.team_id === pullingTeamId) {
            return true
          }
          
          // Otherwise, check if the turnover was by a receiving team player
          return turnoverPlayer.team_id === receivingTeamId
        })

        if (receivingTeamTurnovers.length === 0) {
          const receivingTeam = receivingTeamId === game.team_home_id ? homeTeam : awayTeam
          alert(`Cannot record goal: ${receivingTeam?.name || 'The receiving team'} must have at least one turnover before ${pullingTeamId === game.team_home_id ? homeTeam?.name : awayTeam?.name} can score.`)
          return
        }
      }
    }

    try {
      // Fetch fresh events from database to ensure we have the latest sequence numbers
      const { data: currentEvents, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .eq('point_id', activePoint.id)
        .order('sequence_number', { ascending: true })

      if (eventsError) throw eventsError

      // Get next sequence number from fresh data
      const nextSequence = currentEvents && currentEvents.length > 0 
        ? Math.max(...currentEvents.map((e: Event) => e.sequence_number)) + 1 
        : 1

      // Map old event types to new ones for backward compatibility
      let mappedEventType = eventType
      if (eventType === 'd') {
        mappedEventType = 'block' // Map old 'd' to 'block'
      }

      const eventData: any = {
        point_id: activePoint.id,
        event_type: mappedEventType,
        player_id: playerId,
        sequence_number: nextSequence,
        is_turnover: finalIsTurnover,
        team_id: player.team_id
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
      setShowTurnoverConfirmation(false)
      setPendingBlockPlayer(null)
      setPendingDefensiveEventType(null)
      setShowOffensiveCauseSelection(false)
      setPendingDefensiveEventConfirmed(null)
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
    setShowTurnoverConfirmation(false)
    setPendingBlockPlayer(null)
    setPendingDefensiveEventType(null)
    setShowOffensiveCauseSelection(false)
    setPendingDefensiveEventConfirmed(null)
  }

  const handleBlockClick = (playerId: string) => {
    // Check if player is on defense (pulling team)
    const player = activePointPlayers.find(p => p.id === playerId)
    if (!player) return

    const { pullingTeamId } = getPullingAndReceivingTeams()
    
    // If player is on defense, blocks typically cause turnovers
    // Show confirmation dialog to ask if possession changed
    if (pullingTeamId && player.team_id === pullingTeamId) {
      setPendingBlockPlayer(playerId)
      setPendingDefensiveEventType('block')
      setShowTurnoverConfirmation(true)
      setShowStatButtons(null)
    } else {
      // If player is on offense, this is unusual but allow it
      // Default to turnover = true for blocks
      recordEvent('block', playerId, undefined, true)
    }
  }

  const handleInterceptionClick = (playerId: string) => {
    // Check if player is on defense (pulling team)
    const player = activePointPlayers.find(p => p.id === playerId)
    if (!player) return

    const { pullingTeamId } = getPullingAndReceivingTeams()
    
    // Interceptions always cause turnovers, but ask if someone caused it with a bad throw
    if (pullingTeamId && player.team_id === pullingTeamId) {
      setPendingBlockPlayer(playerId)
      setPendingDefensiveEventType('interception')
      setShowTurnoverConfirmation(true)
      setShowStatButtons(null)
    } else {
      // If player is on offense, this is unusual but allow it
      recordEvent('interception', playerId, undefined, true)
    }
  }

  const handleCallahanClick = async (playerId: string, offensivePlayerId?: string) => {
    if (!activePoint || !game) return
    
    const player = activePointPlayers.find(p => p.id === playerId)
    if (!player) return

    try {
      // Get current events to determine sequence numbers
      const { data: currentEvents, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .eq('point_id', activePoint.id)
        .order('sequence_number', { ascending: true })

      if (eventsError) throw eventsError
      
      let nextSequence = currentEvents && currentEvents.length > 0 
        ? Math.max(...currentEvents.map((e: Event) => e.sequence_number)) + 1 
        : 1

      // Record throwaway on offensive player if specified
      if (offensivePlayerId) {
        const throwawayData: any = {
          point_id: activePoint.id,
          event_type: 'throwaway',
          player_id: offensivePlayerId,
          sequence_number: nextSequence++,
          is_turnover: true,
          team_id: activePointPlayers.find(p => p.id === offensivePlayerId)?.team_id
        }
        
        const { error: throwawayError } = await supabase
          .from('events')
          .insert([throwawayData])
        
        if (throwawayError) throw throwawayError
      }
      
      // Record callahan (defensive play) - this is a turnover
      const callahanData: any = {
        point_id: activePoint.id,
        event_type: 'callahan',
        player_id: playerId,
        sequence_number: nextSequence++,
        is_turnover: true,
        team_id: player.team_id
      }
      
      const { error: callahanError } = await supabase
        .from('events')
        .insert([callahanData])
      
      if (callahanError) throw callahanError
      
      // Record goal for the same player (callahan = goal)
      const goalData: any = {
        point_id: activePoint.id,
        event_type: 'goal',
        player_id: playerId,
        sequence_number: nextSequence++,
        is_turnover: false,
        team_id: player.team_id
      }
      
      const { error: goalError } = await supabase
        .from('events')
        .insert([goalData])
      
      if (goalError) throw goalError
      
      // Fetch events fresh from database to ensure completePoint has latest data
      const { data: updatedEvents, error: updatedEventsError } = await supabase
        .from('events')
        .select('*')
        .eq('point_id', activePoint.id)
        .order('sequence_number', { ascending: true })

      if (updatedEventsError) throw updatedEventsError
      
      // Reload events to update state
      await loadActivePointData(activePoint.id)
      
      // Automatically complete the point for the defender's team
      // Pass fresh events to avoid state timing issues
      await completePoint(player.team_id, updatedEvents as Event[])
      
      // Close any open modals
      setShowStatButtons(null)
      setShowOffensiveCauseSelection(false)
      setPendingDefensiveEventConfirmed(null)
      setPendingBlockPlayer(null)
      setPendingDefensiveEventType(null)
    } catch (error: any) {
      console.error('Error recording callahan:', error)
      alert(`Failed to record callahan: ${error?.message || 'Unknown error'}`)
    }
  }

  const getPlayerStats = (playerId: string) => {
    const goals = events.filter(e => e.event_type === 'goal' && e.player_id === playerId).length
    const assists = events.filter(e => e.event_type === 'goal' && e.assist_player_id === playerId).length
    // Turnovers: count events where this player caused a turnover
    const turnovers = events.filter(e => e.is_turnover && e.player_id === playerId).length
    // Blocks/Ds: count defensive plays (block, d, interception, callahan)
    const ds = events.filter(e => 
      (e.event_type === 'block' || e.event_type === 'd' || e.event_type === 'interception' || e.event_type === 'callahan') 
      && e.player_id === playerId
    ).length
    
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

  // Determine which team currently has possession (is on offense)
  const getCurrentPossession = () => {
    const { pullingTeamId, receivingTeamId } = getPullingAndReceivingTeams()
    if (!pullingTeamId || !receivingTeamId) return { offenseTeamId: null, defenseTeamId: null }
    
    // Start with receiving team on offense
    let offenseTeamId = receivingTeamId
    let defenseTeamId = pullingTeamId
    
    // Track possession changes through turnovers
    // Sort events by sequence to process chronologically
    const sortedEvents = [...events].sort((a, b) => a.sequence_number - b.sequence_number)
    
    for (const event of sortedEvents) {
      if (event.is_turnover) {
        const eventPlayer = activePointPlayers.find(p => p.id === event.player_id)
        if (!eventPlayer) continue
        
        // If it's a defensive play (block/interception/callahan) by the defense team, offense loses possession
        if ((event.event_type === 'block' || event.event_type === 'd' || event.event_type === 'interception' || event.event_type === 'callahan') 
            && eventPlayer.team_id === defenseTeamId) {
          // Defense got the turnover, so they now have possession
          const temp = offenseTeamId
          offenseTeamId = defenseTeamId
          defenseTeamId = temp
        } 
        // If it's an offensive mistake (throwaway/drop/stall) by the offense team, they lose possession
        else if ((event.event_type === 'throwaway' || event.event_type === 'drop' || event.event_type === 'stall') 
                 && eventPlayer.team_id === offenseTeamId) {
          // Offense turned it over, so defense now has possession
          const temp = offenseTeamId
          offenseTeamId = defenseTeamId
          defenseTeamId = temp
        }
      }
    }
    
    return { offenseTeamId, defenseTeamId }
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

  const completePoint = async (scoringTeamId: string, eventsOverride?: Event[]) => {
    if (!activePoint || !game) return

    // Use provided events or fall back to state
    const eventsToCheck = eventsOverride || events

    // Validate that there is at least one goal with an assist (or a callahan, which doesn't need an assist)
    const goalEvents = eventsToCheck.filter(e => e.event_type === 'goal')
    const callahanEvents = eventsToCheck.filter(e => e.event_type === 'callahan')
    
    if (goalEvents.length === 0 && callahanEvents.length === 0) {
      alert('Cannot complete point: No goal has been recorded. Please record at least one goal before completing the point.')
      return
    }

    // Check if at least one goal has an assist (callahans don't need assists)
    const goalsWithAssists = goalEvents.filter(e => e.assist_player_id !== null)
    
    if (goalsWithAssists.length === 0 && callahanEvents.length === 0) {
      alert('Cannot complete point: No goal has an assist recorded. Please record a goal with an assist before completing the point.')
      return
    }

        // Validate that if pulling team scored, receiving team had a turnover
        const { pullingTeamId, receivingTeamId } = getPullingAndReceivingTeams()
        
        if (pullingTeamId && scoringTeamId === pullingTeamId) {
          // Check if receiving team has any turnovers
          // This includes:
          // 1. Turnovers by receiving team players (throwaway, drop, stall)
          // 2. Blocks/interceptions by pulling team (defense gets block/interception = receiving team loses possession)
          const receivingTeamTurnovers = eventsToCheck.filter(e => {
            if (!e.is_turnover) return false
            
            const turnoverPlayer = activePointPlayers.find(p => p.id === e.player_id)
            if (!turnoverPlayer) return false
            
            // If it's a block, interception, or callahan by the pulling team, it counts as a turnover by the receiving team
            if ((e.event_type === 'interception' || e.event_type === 'block' || e.event_type === 'd' || e.event_type === 'callahan') && turnoverPlayer.team_id === pullingTeamId) {
              return true
            }
            
            // Otherwise, check if the turnover was by a receiving team player
            return turnoverPlayer.team_id === receivingTeamId
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

      // Check if a team has won
      const winningTeam = newHomeScore >= game.points_to_win 
        ? homeTeam 
        : newAwayScore >= game.points_to_win 
        ? awayTeam 
        : null

      // Reload game and points
      await loadGame()
      await loadPoints()

      // Clear active point
      setActivePoint(null)
      setActivePointPlayers([])
      setEvents([])

      // Scroll to top to show the score and "Start New Point" button
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }, 100)

      // Show win message if game is over
      if (winningTeam) {
        setTimeout(() => {
          alert(`🎉 ${winningTeam.name} wins! Final score: ${newHomeScore}-${newAwayScore}`)
        }, 500)
      }
      
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

    // Check if game is over
    if (game.home_score >= game.points_to_win || game.away_score >= game.points_to_win) {
      const winningTeam = game.home_score >= game.points_to_win ? homeTeam : awayTeam
      alert(`Game is over! ${winningTeam?.name || 'A team'} has already won.`)
      return
    }

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

      // Scroll to the new point after a short delay to ensure it's rendered
      setTimeout(() => {
        activePointRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
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
            {(() => {
              const homeIsGamePoint = game.home_score === game.points_to_win - 1 && game.away_score < game.points_to_win - 1
              const isUniverse = game.home_score === game.points_to_win - 1 && game.away_score === game.points_to_win - 1
              
              return (
                <>
                  {homeIsGamePoint && !isUniverse && (
                    <div style={{ 
                      fontSize: '0.75rem', 
                      fontWeight: 700, 
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      color: '#dc2626',
                      marginBottom: '0.25rem'
                    }}>
                      GAMEPOINT
                    </div>
                  )}
                  <h2>{homeTeam?.name || 'Home Team'}</h2>
                </>
              )
            })()}
            <div className="score-value" style={{ 
              color: game.home_score >= game.points_to_win ? '#059669' : 'var(--text-primary)',
              fontWeight: game.home_score >= game.points_to_win ? 800 : 700
            }}>
              {game.home_score}
            </div>
            {game.home_score >= game.points_to_win && (
              <div style={{ fontSize: '0.875rem', color: '#059669', fontWeight: 600, marginTop: '0.25rem' }}>
                🏆 Winner!
              </div>
            )}
          </div>
          <div className="score-separator" style={{ position: 'relative' }}>
            {(() => {
              const isUniverse = game.home_score === game.points_to_win - 1 && game.away_score === game.points_to_win - 1
              return isUniverse ? (
                <div style={{
                  position: 'absolute',
                  top: '-1.5rem',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: '#dc2626',
                  whiteSpace: 'nowrap'
                }}>
                  UNIVERSE
                </div>
              ) : null
            })()}
            -
          </div>
          <div className="score-team">
            {(() => {
              const awayIsGamePoint = game.away_score === game.points_to_win - 1 && game.home_score < game.points_to_win - 1
              const isUniverse = game.home_score === game.points_to_win - 1 && game.away_score === game.points_to_win - 1
              
              return (
                <>
                  {awayIsGamePoint && !isUniverse && (
                    <div style={{ 
                      fontSize: '0.75rem', 
                      fontWeight: 700, 
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      color: '#dc2626',
                      marginBottom: '0.25rem'
                    }}>
                      GAMEPOINT
                    </div>
                  )}
                  <h2>{awayTeam?.name || 'Away Team'}</h2>
                </>
              )
            })()}
            <div className="score-value" style={{ 
              color: game.away_score >= game.points_to_win ? '#059669' : 'var(--text-primary)',
              fontWeight: game.away_score >= game.points_to_win ? 800 : 700
            }}>
              {game.away_score}
            </div>
            {game.away_score >= game.points_to_win && (
              <div style={{ fontSize: '0.875rem', color: '#059669', fontWeight: 600, marginTop: '0.25rem' }}>
                🏆 Winner!
              </div>
            )}
          </div>
        </div>
        <div style={{ textAlign: 'center', marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>
          Playing to {game.points_to_win}
        </div>
      </div>

      <div className="game-info">
        <p className="game-status">Date: {new Date(game.date).toLocaleDateString()}</p>
      </div>

      <div style={{ marginTop: '2rem' }}>
        {(() => {
          const gameIsOver = game.home_score >= game.points_to_win || game.away_score >= game.points_to_win
          return (
            <button
              onClick={startNewPoint}
              disabled={gameIsOver}
              className="primary-button large"
              style={{ 
                width: '100%', 
                marginBottom: '1rem',
                opacity: gameIsOver ? 0.5 : 1,
                cursor: gameIsOver ? 'not-allowed' : 'pointer'
              }}
            >
              {gameIsOver ? 'Game Over' : 'Start New Point'}
            </button>
          )
        })()}

        {points.length > 0 && (
          <div style={{ marginTop: '2rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>Points ({points.length})</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {points.map(point => {
                // Calculate score at the start of this point
                let homeScore = 0
                let awayScore = 0
                
                // Count points scored before this point
                const previousPoints = points.filter(p => p.point_number < point.point_number && p.scoring_team_id)
                previousPoints.forEach(p => {
                  if (p.scoring_team_id === game.team_home_id) {
                    homeScore++
                  } else if (p.scoring_team_id === game.team_away_id) {
                    awayScore++
                  }
                })
                
                // If this point is completed, include it in the score
                if (point.scoring_team_id) {
                  if (point.scoring_team_id === game.team_home_id) {
                    homeScore++
                  } else if (point.scoring_team_id === game.team_away_id) {
                    awayScore++
                  }
                }
                
                return (
                  <div
                    key={point.id}
                    onClick={async () => {
                      if (!point.scoring_team_id) {
                        setActivePoint(point)
                        await loadActivePointData(point.id)
                        // Scroll to the active point after loading
                        setTimeout(() => {
                          activePointRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                        }, 100)
                      }
                    }}
                    style={{
                      padding: '1rem',
                      border: '1px solid #e5e7eb',
                      borderRadius: '0.5rem',
                      backgroundColor: point.id === activePoint?.id ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-tertiary)',
                      cursor: !point.scoring_team_id ? 'pointer' : 'default'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600 }}>
                        {homeScore}-{awayScore}
                        {!point.scoring_team_id && <span style={{ fontSize: '0.875rem', fontWeight: 'normal', color: 'var(--text-quaternary)', marginLeft: '0.5rem' }}>(Point {point.point_number})</span>}
                      </span>
                      {point.scoring_team_id ? (
                        <span style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>
                          Scored by {point.scoring_team_id === game.team_home_id ? homeTeam?.name : awayTeam?.name}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.875rem', color: 'var(--text-quaternary)' }}>In progress</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Live Point Tracker */}
      {activePoint && (
        <div ref={activePointRef} style={{ 
          marginTop: '2rem', 
          padding: '1.5rem',
          border: '2px solid #3B82F6',
          borderRadius: '0.75rem',
          backgroundColor: 'var(--bg-tertiary)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            {(() => {
              // Calculate score at the start of this point
              let homeScore = 0
              let awayScore = 0
              
              const previousPoints = points.filter(p => p.point_number < activePoint.point_number && p.scoring_team_id)
              previousPoints.forEach(p => {
                if (p.scoring_team_id === game.team_home_id) {
                  homeScore++
                } else if (p.scoring_team_id === game.team_away_id) {
                  awayScore++
                }
              })
              
              return (
                <h2 style={{ margin: 0 }}>Live Point: {homeScore}-{awayScore}</h2>
              )
            })()}
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
                  color: 'var(--text-tertiary)', 
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
                {(() => {
                  const { offenseTeamId, defenseTeamId } = getCurrentPossession()
                  const isOffense = offenseTeamId === game.team_home_id
                  const isDefense = defenseTeamId === game.team_home_id
                  
                  return (
                    <>
                      {(isOffense || isDefense) && (
                        <div style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          marginBottom: '0.25rem',
                          color: isOffense ? '#059669' : '#7c3aed'
                        }}>
                          {isOffense ? 'Offense' : 'Defense'}
                        </div>
                      )}
                    </>
                  )
                })()}
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
                            border: `2px solid ${showStatButtons === player.id ? homeTeam?.color_primary || '#3B82F6' : 'var(--border-color)'}`,
                            borderRadius: '0.5rem',
                            backgroundColor: showStatButtons === player.id 
                              ? `${homeTeam?.color_primary || '#3B82F6'}20` 
                              : 'var(--bg-secondary)',
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
                {(() => {
                  const { offenseTeamId, defenseTeamId } = getCurrentPossession()
                  const isOffense = offenseTeamId === game.team_away_id
                  const isDefense = defenseTeamId === game.team_away_id
                  
                  return (
                    <>
                      {(isOffense || isDefense) && (
                        <div style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          marginBottom: '0.25rem',
                          color: isOffense ? '#059669' : '#7c3aed'
                        }}>
                          {isOffense ? 'Offense' : 'Defense'}
                        </div>
                      )}
                    </>
                  )
                })()}
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
                            border: `2px solid ${showStatButtons === player.id ? awayTeam?.color_primary || '#3B82F6' : 'var(--border-color)'}`,
                            borderRadius: '0.5rem',
                            backgroundColor: showStatButtons === player.id 
                              ? `${awayTeam?.color_primary || '#3B82F6'}20` 
                              : 'var(--bg-secondary)',
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
          {showStatButtons && (() => {
            const player = activePointPlayers.find(p => p.id === showStatButtons)
            if (!player) return null
            
            const { offenseTeamId, defenseTeamId } = getCurrentPossession()
            const isOnOffense = offenseTeamId === player.team_id
            const isOnDefense = defenseTeamId === player.team_id
            
            return (
              <div className="modal-overlay" onClick={() => setShowStatButtons(null)}>
                <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                  <h3 style={{ marginBottom: '1rem' }}>
                    {player.name || 'Player'}
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {/* Offense-only stats */}
                    {isOnOffense && (
                      <>
                        <button
                          onClick={() => handleGoalClick(showStatButtons)}
                          className="primary-button"
                          style={{ padding: '1rem', fontSize: '1rem' }}
                        >
                          Goal
                        </button>
                        <button
                          onClick={() => recordEvent('throwaway', showStatButtons)}
                          className="secondary-button"
                          style={{ padding: '1rem', fontSize: '1rem' }}
                        >
                          Throwaway
                        </button>
                        <button
                          onClick={() => recordEvent('drop', showStatButtons)}
                          className="secondary-button"
                          style={{ padding: '1rem', fontSize: '1rem' }}
                        >
                          Drop
                        </button>
                        <button
                          onClick={() => recordEvent('stall', showStatButtons)}
                          className="secondary-button"
                          style={{ padding: '1rem', fontSize: '1rem' }}
                        >
                          Stall
                        </button>
                      </>
                    )}
                    
                    {/* Defense-only stats */}
                    {isOnDefense && (
                      <>
                        <button
                          onClick={() => handleBlockClick(showStatButtons)}
                          className="secondary-button"
                          style={{ padding: '1rem', fontSize: '1rem', backgroundColor: '#7c3aed', color: 'white' }}
                        >
                          Block / D
                        </button>
                        <button
                          onClick={() => handleInterceptionClick(showStatButtons)}
                          className="secondary-button"
                          style={{ padding: '1rem', fontSize: '1rem', backgroundColor: '#059669', color: 'white' }}
                        >
                          Interception
                        </button>
                        <button
                          onClick={() => {
                            // Callahan: ask if someone caused it, then record callahan + goal + complete point
                            const { pullingTeamId } = getPullingAndReceivingTeams()
                            
                            // Callahans are always by the defense
                            if (pullingTeamId && player.team_id === pullingTeamId) {
                              setPendingBlockPlayer(showStatButtons)
                              setPendingDefensiveEventType('callahan')
                              setShowTurnoverConfirmation(true)
                              setShowStatButtons(null)
                            } else {
                              // If somehow on offense, still allow it
                              handleCallahanClick(showStatButtons)
                            }
                          }}
                          className="secondary-button"
                          style={{ padding: '1rem', fontSize: '1rem', backgroundColor: '#dc2626', color: 'white' }}
                        >
                          Callahan
                        </button>
                      </>
                    )}
                    
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
            )
          })()}

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

          {/* Turnover Confirmation Modal for Blocks/Interceptions/Callahans */}
          {showTurnoverConfirmation && pendingBlockPlayer && pendingDefensiveEventType && (
            <div className="modal-overlay" onClick={() => {
              setShowTurnoverConfirmation(false)
              setPendingBlockPlayer(null)
              setPendingDefensiveEventType(null)
            }}>
              <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                <h3 style={{ marginBottom: '1rem' }}>
                  {pendingDefensiveEventType === 'callahan' ? 'Callahan!' : 'Did Possession Change?'}
                </h3>
                <p style={{ marginBottom: '1.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
                  {pendingDefensiveEventType === 'callahan' 
                    ? `${activePointPlayers.find(p => p.id === pendingBlockPlayer)?.name || 'This player'} intercepted in the endzone for a callahan!`
                    : `Did ${activePointPlayers.find(p => p.id === pendingBlockPlayer)?.name || 'this player'}'s ${pendingDefensiveEventType === 'block' ? 'block' : 'interception'} cause a turnover?`}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {pendingDefensiveEventType === 'callahan' ? (
                    <>
                      {/* For callahans, always proceed to offensive cause selection */}
                      <button
                        onClick={() => {
                          setPendingDefensiveEventConfirmed({
                            playerId: pendingBlockPlayer,
                            eventType: 'callahan',
                            isTurnover: true
                          })
                          setShowTurnoverConfirmation(false)
                          setShowOffensiveCauseSelection(true)
                        }}
                        className="primary-button"
                        style={{ padding: '1rem', fontSize: '1rem', backgroundColor: '#dc2626' }}
                      >
                        Continue
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          // Yes, possession changed - now ask if someone caused it with a bad throw
                          setPendingDefensiveEventConfirmed({
                            playerId: pendingBlockPlayer,
                            eventType: pendingDefensiveEventType,
                            isTurnover: true
                          })
                          setShowTurnoverConfirmation(false)
                          setShowOffensiveCauseSelection(true)
                        }}
                        className="primary-button"
                        style={{ padding: '1rem', fontSize: '1rem', backgroundColor: '#dc2626' }}
                      >
                        Yes - Turnover ({pendingDefensiveEventType === 'block' ? 'Block' : 'Interception'} caused possession change)
                      </button>
                      <button
                        onClick={() => {
                          recordEvent(pendingDefensiveEventType, pendingBlockPlayer, undefined, false)
                          setShowTurnoverConfirmation(false)
                          setPendingBlockPlayer(null)
                          setPendingDefensiveEventType(null)
                        }}
                        className="secondary-button"
                        style={{ padding: '1rem', fontSize: '1rem' }}
                      >
                        No - No Turnover ({pendingDefensiveEventType === 'block' ? 'Block' : 'Interception'} but offense kept possession)
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => {
                      setShowTurnoverConfirmation(false)
                      setPendingBlockPlayer(null)
                      setPendingDefensiveEventType(null)
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

          {/* Offensive Cause Selection Modal */}
          {showOffensiveCauseSelection && pendingDefensiveEventConfirmed && (
            <div className="modal-overlay" onClick={() => {
              setShowOffensiveCauseSelection(false)
              setPendingDefensiveEventConfirmed(null)
            }}>
              <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
                <h3 style={{ marginBottom: '1rem' }}>Did Someone Cause This?</h3>
                <p style={{ marginBottom: '1.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
                  Did someone on offense cause this {pendingDefensiveEventConfirmed.eventType === 'block' ? 'block' : pendingDefensiveEventConfirmed.eventType === 'interception' ? 'interception' : 'callahan'} with a bad throw?
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {(() => {
                    const { pullingTeamId, receivingTeamId } = getPullingAndReceivingTeams()
                    if (!receivingTeamId) return null
                    
                    const offensivePlayers = activePointPlayers.filter(p => p.team_id === receivingTeamId)
                    
                    return (
                      <>
                        {offensivePlayers.map(player => (
                          <button
                            key={player.id}
                            onClick={async () => {
                              if (pendingDefensiveEventConfirmed.eventType === 'callahan') {
                                // For callahans, use the special handler
                                await handleCallahanClick(pendingDefensiveEventConfirmed.playerId, player.id)
                              } else {
                                try {
                                  // Record throwaway on the offensive player first
                                  await recordEvent('throwaway', player.id, undefined, true)
                                  
                                  // Fetch fresh events to get the updated sequence number
                                  const { data: updatedEvents, error: eventsError } = await supabase
                                    .from('events')
                                    .select('*')
                                    .eq('point_id', activePoint.id)
                                    .order('sequence_number', { ascending: true })

                                  if (eventsError) throw eventsError
                                  
                                  // Reload events state
                                  await loadActivePointData(activePoint.id)
                                  
                                  // Now record the defensive play (block/interception) with correct sequence
                                  await recordEvent(pendingDefensiveEventConfirmed.eventType, pendingDefensiveEventConfirmed.playerId, undefined, true)
                                  
                                  setShowOffensiveCauseSelection(false)
                                  setPendingDefensiveEventConfirmed(null)
                                  setPendingBlockPlayer(null)
                                  setPendingDefensiveEventType(null)
                                } catch (error: any) {
                                  console.error('Error recording events:', error)
                                  alert(`Failed to record events: ${error?.message || 'Unknown error'}`)
                                }
                              }
                            }}
                            className="secondary-button"
                            style={{ padding: '0.75rem', textAlign: 'left' }}
                          >
                            #{player.number} {player.name} (Throwaway)
                          </button>
                        ))}
                        <button
                          onClick={async () => {
                            if (pendingDefensiveEventConfirmed.eventType === 'callahan') {
                              // For callahans, use the special handler
                              await handleCallahanClick(pendingDefensiveEventConfirmed.playerId)
                            } else {
                              try {
                                // No specific offensive player - just record the defensive play
                                await recordEvent(pendingDefensiveEventConfirmed.eventType, pendingDefensiveEventConfirmed.playerId, undefined, true)
                                setShowOffensiveCauseSelection(false)
                                setPendingDefensiveEventConfirmed(null)
                                setPendingBlockPlayer(null)
                                setPendingDefensiveEventType(null)
                              } catch (error: any) {
                                console.error('Error recording event:', error)
                                alert(`Failed to record event: ${error?.message || 'Unknown error'}`)
                              }
                            }
                          }}
                          className="secondary-button"
                          style={{ padding: '1rem', fontSize: '1rem', backgroundColor: '#7c3aed', color: 'white' }}
                        >
                          No - Great Defensive Play (No offensive turnover)
                        </button>
                      </>
                    )
                  })()}
                  <button
                    onClick={() => {
                      setShowOffensiveCauseSelection(false)
                      setPendingDefensiveEventConfirmed(null)
                      setPendingBlockPlayer(null)
                      setPendingDefensiveEventType(null)
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
            <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
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
                    } else if (event.event_type === 'throwaway') {
                      return `Throwaway by #${player?.number} ${player?.name}${event.is_turnover ? ' (Turnover)' : ''}`
                    } else if (event.event_type === 'drop') {
                      return `Drop by #${player?.number} ${player?.name}${event.is_turnover ? ' (Turnover)' : ''}`
                    } else if (event.event_type === 'stall') {
                      return `Stall by #${player?.number} ${player?.name}${event.is_turnover ? ' (Turnover)' : ''}`
                    } else if (event.event_type === 'block' || event.event_type === 'd') {
                      return `Block/D by #${player?.number} ${player?.name}${event.is_turnover ? ' (Turnover)' : ' (No turnover)'}`
                    } else if (event.event_type === 'interception') {
                      return `Interception by #${player?.number} ${player?.name}${event.is_turnover ? ' (Turnover)' : ' (No turnover)'}`
                    } else if (event.event_type === 'callahan') {
                      return `Callahan by #${player?.number} ${player?.name}${event.is_turnover ? ' (Turnover)' : ''}`
                    } else if (event.event_type === 'turnover') {
                      // Legacy event type
                      return `Turnover by #${player?.number} ${player?.name}`
                    }
                    return 'Unknown event'
                  }

                  return (
                    <div
                      key={event.id}
                      style={{
                        padding: '0.75rem',
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
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
                  border: `2px solid ${homeTeam?.color_primary || 'var(--border-color)'}`,
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
                              border: `2px solid ${isSelected ? homeTeam?.color_primary || '#3B82F6' : 'var(--border-color)'}`,
                              borderRadius: '0.5rem',
                              backgroundColor: isSelected 
                                ? `${homeTeam?.color_primary || '#3B82F6'}20` 
                                : 'var(--bg-secondary)',
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
                              border: `2px solid ${isSelected ? awayTeam?.color_primary || '#3B82F6' : 'var(--border-color)'}`,
                              borderRadius: '0.5rem',
                              backgroundColor: isSelected 
                                ? `${awayTeam?.color_primary || '#3B82F6'}20` 
                                : 'var(--bg-secondary)',
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
