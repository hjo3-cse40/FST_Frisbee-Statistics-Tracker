'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

interface Team {
  id: string
  name: string
  color: string
}

export default function GameSetupPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [lightTeamId, setLightTeamId] = useState<string>('')
  const [darkTeamId, setDarkTeamId] = useState<string>('')
  const [gameName, setGameName] = useState('')

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
    if (!lightTeamId || !darkTeamId) {
      alert('Please select both light and dark teams')
      return
    }

    if (lightTeamId === darkTeamId) {
      alert('Light and dark teams must be different')
      return
    }

    try {
      const gameData = {
        name: gameName || `Game ${new Date().toLocaleDateString()}`,
        light_team_id: lightTeamId,
        dark_team_id: darkTeamId,
        light_score: 0,
        dark_score: 0,
        status: 'active'
      }

      const { data, error } = await supabase
        .from('games')
        .insert([gameData])
        .select()
        .single()

      if (error) throw error

      // Redirect to game page (to be created in Phase 2)
      window.location.href = `/games/${data.id}`
    } catch (error) {
      console.error('Error creating game:', error)
      alert('Failed to create game')
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
            placeholder="e.g., Practice Scrimmage"
            value={gameName}
            onChange={(e) => setGameName(e.target.value)}
            className="input"
          />
        </div>

        <div className="team-selection">
          <div className="team-selection-group">
            <h2>Light Team</h2>
            <div className="team-options">
              {teams.map(team => (
                <button
                  key={team.id}
                  className={`team-option ${lightTeamId === team.id ? 'selected' : ''}`}
                  onClick={() => setLightTeamId(team.id)}
                  style={{
                    borderColor: lightTeamId === team.id ? team.color : '#e5e7eb',
                    backgroundColor: lightTeamId === team.id ? `${team.color}20` : 'transparent'
                  }}
                >
                  <div
                    className="team-option-color"
                    style={{ backgroundColor: team.color }}
                  />
                  <span>{team.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="team-selection-group">
            <h2>Dark Team</h2>
            <div className="team-options">
              {teams.map(team => (
                <button
                  key={team.id}
                  className={`team-option ${darkTeamId === team.id ? 'selected' : ''}`}
                  onClick={() => setDarkTeamId(team.id)}
                  style={{
                    borderColor: darkTeamId === team.id ? team.color : '#e5e7eb',
                    backgroundColor: darkTeamId === team.id ? `${team.color}20` : 'transparent'
                  }}
                >
                  <div
                    className="team-option-color"
                    style={{ backgroundColor: team.color }}
                  />
                  <span>{team.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

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
            disabled={!lightTeamId || !darkTeamId}
            className="primary-button large"
          >
            Start Game
          </button>
        )}
      </div>
    </div>
  )
}
