'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

interface Team {
  id: string
  name: string
  color_primary: string
  color_secondary?: string
}

export default function GameSetupPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [homeTeamId, setHomeTeamId] = useState<string>('')
  const [awayTeamId, setAwayTeamId] = useState<string>('')
  const [pullingTeamId, setPullingTeamId] = useState<string>('')
  const [gameLocation, setGameLocation] = useState('')
  const [gameName, setGameName] = useState('')
  const [pointsToWin, setPointsToWin] = useState<number>(15)

  // Set default pulling team when both teams are selected
  useEffect(() => {
    if (homeTeamId && awayTeamId && !pullingTeamId) {
      setPullingTeamId(homeTeamId) // Default to home team pulling first
    }
  }, [homeTeamId, awayTeamId, pullingTeamId])

  useEffect(() => {
    loadTeams()
  }, [])

  const loadTeams = async () => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .order('name', { ascending: true })
      
      if (error) throw error
      setTeams(data || [])
    } catch (error) {
      console.error('Error loading teams:', error)
    }
  }

  const createGame = async () => {
    if (!homeTeamId || !awayTeamId) {
      alert('Please select both home and away teams')
      return
    }

    if (homeTeamId === awayTeamId) {
      alert('Home and away teams must be different')
      return
    }

    if (!pullingTeamId) {
      alert('Please select which team pulls first')
      return
    }

    if (!pointsToWin || pointsToWin < 1) {
      alert('Please enter a valid number of points to win (must be at least 1)')
      return
    }

    try {
      const gameData: any = {
        team_home_id: homeTeamId,
        team_away_id: awayTeamId,
        pulling_team_id: pullingTeamId,
        home_score: 0,
        away_score: 0,
        points_to_win: pointsToWin,
        location: gameLocation.trim() || null
      }

      // Only include name if it's provided (in case the column doesn't exist yet)
      if (gameName.trim()) {
        gameData.name = gameName.trim()
      }

      const { data, error } = await supabase
        .from('games')
        .insert([gameData])
        .select()
        .single()

      if (error) {
        console.error('Supabase error:', error)
        throw error
      }

      // Redirect to game page (to be created in Phase 2)
      window.location.href = `/games/${data.id}`
    } catch (error: any) {
      console.error('Error creating game:', error)
      const errorMessage = error?.message || 'Unknown error occurred'
      alert(`Failed to create game: ${errorMessage}\n\nIf you see a column error, you may need to add a "name" column to the games table.`)
    }
  }

  return (
    <div className="container">
      <div className="header">
        <Link href="/" className="back-button">← Back</Link>
        <h1>New Game</h1>
      </div>

      <div className="game-setup-form">
        <div className="form-group">
          <label>Game Name (optional)</label>
          <input
            type="text"
            placeholder="e.g., President's Day Invite Pool Play: Cal vs Santa Cruz"
            value={gameName}
            onChange={(e) => setGameName(e.target.value)}
            className="input"
          />
        </div>

        <div className="form-group">
          <label>Location (optional)</label>
          <input
            type="text"
            placeholder="e.g., Practice Field"
            value={gameLocation}
            onChange={(e) => setGameLocation(e.target.value)}
            className="input"
          />
        </div>

        <div className="form-group">
          <label>Points to Win *</label>
          <input
            type="number"
            min="1"
            max="50"
            placeholder="e.g., 15"
            value={pointsToWin}
            onChange={(e) => setPointsToWin(parseInt(e.target.value) || 15)}
            className="input"
            required
          />
          <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem' }}>
            First team to reach this score wins the game (common: 15 or 21)
          </p>
        </div>

        <div className="team-selection">
          <div className="team-selection-group">
            <h2>Home Team</h2>
            <div className="team-options">
              {teams.map(team => (
                <button
                  key={team.id}
                  className={`team-option ${homeTeamId === team.id ? 'selected' : ''}`}
                  onClick={() => setHomeTeamId(team.id)}
                  style={{
                    borderColor: homeTeamId === team.id ? team.color_primary : '#e5e7eb',
                    backgroundColor: homeTeamId === team.id ? `${team.color_primary}20` : 'transparent'
                  }}
                >
                  <div
                    className="team-option-color"
                    style={{ backgroundColor: team.color_primary }}
                  />
                  <span>{team.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="team-selection-group">
            <h2>Away Team</h2>
            <div className="team-options">
              {teams.map(team => (
                <button
                  key={team.id}
                  className={`team-option ${awayTeamId === team.id ? 'selected' : ''}`}
                  onClick={() => setAwayTeamId(team.id)}
                  style={{
                    borderColor: awayTeamId === team.id ? team.color_primary : '#e5e7eb',
                    backgroundColor: awayTeamId === team.id ? `${team.color_primary}20` : 'transparent'
                  }}
                >
                  <div
                    className="team-option-color"
                    style={{ backgroundColor: team.color_primary }}
                  />
                  <span>{team.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {homeTeamId && awayTeamId && (
          <div className="team-selection-group" style={{ marginTop: '2rem' }}>
            <h2>Pulling Team (Pulls First)</h2>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
              Select which team pulls first. After that, the team that scores each point will pull the next point.
            </p>
            <div className="team-options">
              {[homeTeamId, awayTeamId].map(teamId => {
                const team = teams.find(t => t.id === teamId)
                if (!team) return null
                return (
                  <button
                    key={teamId}
                    className={`team-option ${pullingTeamId === teamId ? 'selected' : ''}`}
                    onClick={() => setPullingTeamId(teamId)}
                    style={{
                      borderColor: pullingTeamId === teamId ? team.color_primary : '#e5e7eb',
                      backgroundColor: pullingTeamId === teamId ? `${team.color_primary}20` : 'transparent'
                    }}
                  >
                    <div
                      className="team-option-color"
                      style={{ backgroundColor: team.color_primary }}
                    />
                    <span>{team.name}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {teams.length === 0 && (
          <div className="empty-state-container">
            <p>No teams available. Please create teams first.</p>
            <Link href="/teams" className="primary-button">
              Go to Teams
            </Link>
          </div>
        )}

        {teams.length > 0 && (
          <button
            onClick={createGame}
            disabled={!homeTeamId || !awayTeamId || !pullingTeamId || !pointsToWin || pointsToWin < 1}
            className="primary-button large"
          >
            Start Game
          </button>
        )}
      </div>
    </div>
  )
}
