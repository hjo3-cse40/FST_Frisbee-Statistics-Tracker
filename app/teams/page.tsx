'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

interface Player {
  id: string
  name: string
  jersey_number: number
  team_id: string
}

interface Team {
  id: string
  name: string
  color: string
  created_at: string
}

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null)
  const [showCreateTeam, setShowCreateTeam] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
  const [newTeamColor, setNewTeamColor] = useState('#3B82F6')
  const [showAddPlayer, setShowAddPlayer] = useState<string | null>(null)
  const [newPlayerName, setNewPlayerName] = useState('')
  const [newPlayerJersey, setNewPlayerJersey] = useState('')

  useEffect(() => {
    loadTeams()
    loadPlayers()
  }, [])

  const loadTeams = async () => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setTeams(data || [])
    } catch (error) {
      console.error('Error loading teams:', error)
    }
  }

  const loadPlayers = async () => {
    try {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .order('jersey_number', { ascending: true })
      
      if (error) throw error
      setPlayers(data || [])
    } catch (error) {
      console.error('Error loading players:', error)
    }
  }

  const createTeam = async () => {
    if (!newTeamName.trim()) return

    try {
      const { data, error } = await supabase
        .from('teams')
        .insert([{ name: newTeamName, color: newTeamColor }])
        .select()
        .single()

      if (error) throw error
      
      setTeams([data, ...teams])
      setNewTeamName('')
      setNewTeamColor('#3B82F6')
      setShowCreateTeam(false)
    } catch (error) {
      console.error('Error creating team:', error)
      alert('Failed to create team')
    }
  }

  const addPlayer = async (teamId: string) => {
    if (!newPlayerName.trim() || !newPlayerJersey.trim()) return

    try {
      const { data, error } = await supabase
        .from('players')
        .insert([{
          name: newPlayerName,
          jersey_number: parseInt(newPlayerJersey),
          team_id: teamId
        }])
        .select()
        .single()

      if (error) throw error
      
      setPlayers([...players, data])
      setNewPlayerName('')
      setNewPlayerJersey('')
      setShowAddPlayer(null)
    } catch (error) {
      console.error('Error adding player:', error)
      alert('Failed to add player')
    }
  }

  const deletePlayer = async (playerId: string) => {
    try {
      const { error } = await supabase
        .from('players')
        .delete()
        .eq('id', playerId)

      if (error) throw error
      
      setPlayers(players.filter(p => p.id !== playerId))
    } catch (error) {
      console.error('Error deleting player:', error)
      alert('Failed to delete player')
    }
  }

  const getTeamPlayers = (teamId: string) => {
    return players.filter(p => p.team_id === teamId)
  }

  return (
    <div className="container">
      <div className="header">
        <Link href="/" className="back-button">← Back</Link>
        <h1>Teams</h1>
      </div>

      <button 
        className="primary-button"
        onClick={() => setShowCreateTeam(true)}
      >
        + Create Team
      </button>

      {showCreateTeam && (
        <div className="modal-overlay" onClick={() => setShowCreateTeam(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Create New Team</h2>
            <input
              type="text"
              placeholder="Team name"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              className="input"
            />
            <div className="color-picker-group">
              <label>Team Color:</label>
              <input
                type="color"
                value={newTeamColor}
                onChange={(e) => setNewTeamColor(e.target.value)}
                className="color-picker"
              />
            </div>
            <div className="modal-actions">
              <button onClick={() => setShowCreateTeam(false)} className="secondary-button">
                Cancel
              </button>
              <button onClick={createTeam} className="primary-button">
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="teams-list">
        {teams.map(team => {
          const teamPlayers = getTeamPlayers(team.id)
          const isExpanded = expandedTeam === team.id

          return (
            <div key={team.id} className="team-card">
              <div 
                className="team-card-header"
                onClick={() => setExpandedTeam(isExpanded ? null : team.id)}
              >
                <div className="team-info">
                  <div 
                    className="team-color-indicator"
                    style={{ backgroundColor: team.color }}
                  />
                  <div>
                    <h3>{team.name}</h3>
                    <p className="team-meta">{teamPlayers.length} players</p>
                  </div>
                </div>
                <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
              </div>

              {isExpanded && (
                <div className="team-card-content">
                  <button
                    className="add-player-button"
                    onClick={() => setShowAddPlayer(showAddPlayer === team.id ? null : team.id)}
                  >
                    + Add Player
                  </button>

                  {showAddPlayer === team.id && (
                    <div className="add-player-form">
                      <input
                        type="text"
                        placeholder="Player name"
                        value={newPlayerName}
                        onChange={(e) => setNewPlayerName(e.target.value)}
                        className="input"
                      />
                      <input
                        type="number"
                        placeholder="Jersey #"
                        value={newPlayerJersey}
                        onChange={(e) => setNewPlayerJersey(e.target.value)}
                        className="input"
                      />
                      <div className="form-actions">
                        <button
                          onClick={() => addPlayer(team.id)}
                          className="primary-button small"
                        >
                          Add
                        </button>
                        <button
                          onClick={() => {
                            setShowAddPlayer(null)
                            setNewPlayerName('')
                            setNewPlayerJersey('')
                          }}
                          className="secondary-button small"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="players-list">
                    {teamPlayers.length === 0 ? (
                      <p className="empty-state">No players yet</p>
                    ) : (
                      teamPlayers.map(player => (
                        <div key={player.id} className="player-item">
                          <span className="jersey-number">#{player.jersey_number}</span>
                          <span className="player-name">{player.name}</span>
                          <button
                            onClick={() => deletePlayer(player.id)}
                            className="delete-button"
                            aria-label="Delete player"
                          >
                            ×
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {teams.length === 0 && (
        <div className="empty-state-container">
          <p>No teams yet. Create your first team to get started!</p>
        </div>
      )}
    </div>
  )
}
