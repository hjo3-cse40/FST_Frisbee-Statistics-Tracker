'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/app/components/AuthProvider'

interface Player {
  id: string
  name: string
  number: number
  team_id: string
}

interface Team {
  id: string
  name: string
  color_primary: string
  color_secondary?: string
  created_at: string
}

type SortOption = 'name-asc' | 'name-desc' | 'number-asc' | 'number-desc'

export default function TeamsPage() {
  const { user } = useAuth()
  const [teams, setTeams] = useState<Team[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null)
  const [showCreateTeam, setShowCreateTeam] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
  const [newTeamColor, setNewTeamColor] = useState('#3B82F6')
  const [showAddPlayer, setShowAddPlayer] = useState<string | null>(null)
  const [newPlayerName, setNewPlayerName] = useState('')
  const [newPlayerJersey, setNewPlayerJersey] = useState('')
  const [sortOption, setSortOption] = useState<SortOption>('number-asc')
  const [editingPlayer, setEditingPlayer] = useState<string | null>(null)
  const [editingPlayerName, setEditingPlayerName] = useState('')
  const [editingTeam, setEditingTeam] = useState<string | null>(null)
  const [editingTeamName, setEditingTeamName] = useState('')

  useEffect(() => {
    loadTeams()
  }, [user])

  useEffect(() => {
    // Load players whenever teams change
    if (teams.length > 0) {
      loadPlayers()
    } else {
      setPlayers([])
    }
  }, [teams, user])

  const loadTeams = async () => {
    try {
      let query = supabase
        .from('teams')
        .select('*')
      
      // Filter by user_id if logged in, or show guest teams (user_id IS NULL) if not
      if (user) {
        query = query.eq('user_id', user.id)
      } else {
        query = query.is('user_id', null)
      }
      
      const { data, error } = await query.order('created_at', { ascending: false })
      
      if (error) throw error
      
      // Deduplicate teams by name - take only the first instance of each unique team name
      const uniqueTeamsMap = new Map<string, any>()
      for (const team of (data || [])) {
        const teamNameLower = team.name.toLowerCase()
        if (!uniqueTeamsMap.has(teamNameLower)) {
          uniqueTeamsMap.set(teamNameLower, team)
        }
      }
      
      setTeams(Array.from(uniqueTeamsMap.values()))
    } catch (error) {
      console.error('Error loading teams:', error)
    }
  }

  const loadPlayers = async () => {
    try {
      // Load players for teams that belong to the user (or guest)
      const teamIds = teams.map(t => t.id)
      if (teamIds.length === 0) {
        setPlayers([])
        return
      }

      let query = supabase
        .from('players')
        .select('*')
        .in('team_id', teamIds)
      
      if (user) {
        query = query.eq('user_id', user.id)
      } else {
        query = query.is('user_id', null)
      }
      
      const { data, error } = await query.order('number', { ascending: true })
      
      if (error) throw error
      
      // Deduplicate players by team_id, name, and number
      // Take only the first instance of each unique player
      const playerMap = new Map<string, any>()
      for (const player of (data || [])) {
        const key = `${player.team_id}-${player.name.toLowerCase()}-${player.number}`
        if (!playerMap.has(key)) {
          playerMap.set(key, player)
        }
      }
      
      setPlayers(Array.from(playerMap.values()))
    } catch (error) {
      console.error('Error loading players:', error)
    }
  }

  const createTeam = async () => {
    if (!newTeamName.trim()) return

    try {
      const teamData: any = {
        name: newTeamName,
        color_primary: newTeamColor,
        user_id: user?.id || null
      }

      const { data, error } = await supabase
        .from('teams')
        .insert([teamData])
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

    const playerNumber = parseInt(newPlayerJersey)
    const playerName = newPlayerName.trim()
    
    const playerData: any = {
      name: playerName,
      number: playerNumber,
      team_id: teamId,
      user_id: user?.id || null
    }

    // Check for duplicates: same name and number, or just same name
    const teamPlayers = players.filter(p => p.team_id === teamId)
    const duplicateNameAndNumber = teamPlayers.some(
      p => p.name.toLowerCase() === playerName.toLowerCase() && p.number === playerNumber
    )
    const duplicateName = teamPlayers.some(
      p => p.name.toLowerCase() === playerName.toLowerCase()
    )

    if (duplicateNameAndNumber) {
      alert(`A player with the name "${playerName}" and number ${playerNumber} already exists on this team.`)
      return
    }

    if (duplicateName) {
      const confirmAdd = confirm(
        `A player with the name "${playerName}" already exists on this team (possibly with a different number). Do you want to add this player anyway?`
      )
      if (!confirmAdd) return
    }

    try {
      const { data, error } = await supabase
        .from('players')
        .insert([playerData])
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

  const updatePlayer = async (playerId: string, newName: string) => {
    if (!newName.trim()) return

    const player = players.find(p => p.id === playerId)
    if (!player) return

    const playerName = newName.trim()

    // Check for duplicates in the same team
    const teamPlayers = players.filter(p => p.team_id === player.team_id && p.id !== playerId)
    const duplicateNameAndNumber = teamPlayers.some(
      p => p.name.toLowerCase() === playerName.toLowerCase() && p.number === player.number
    )
    const duplicateName = teamPlayers.some(
      p => p.name.toLowerCase() === playerName.toLowerCase()
    )

    if (duplicateNameAndNumber) {
      alert(`A player with the name "${playerName}" and number ${player.number} already exists on this team.`)
      return
    }

    if (duplicateName) {
      const confirmUpdate = confirm(
        `A player with the name "${playerName}" already exists on this team (possibly with a different number). Do you want to update this player anyway?`
      )
      if (!confirmUpdate) return
    }

    try {
      const { data, error } = await supabase
        .from('players')
        .update({ name: playerName })
        .eq('id', playerId)
        .select()
        .single()

      if (error) throw error
      
      setPlayers(players.map(p => p.id === playerId ? data : p))
      setEditingPlayer(null)
      setEditingPlayerName('')
    } catch (error) {
      console.error('Error updating player:', error)
      alert('Failed to update player')
    }
  }

  const updateTeam = async (teamId: string, newName: string) => {
    if (!newName.trim()) return

    try {
      const { data, error } = await supabase
        .from('teams')
        .update({ name: newName.trim() })
        .eq('id', teamId)
        .select()
        .single()

      if (error) throw error
      
      setTeams(teams.map(t => t.id === teamId ? data : t))
      setEditingTeam(null)
      setEditingTeamName('')
    } catch (error) {
      console.error('Error updating team:', error)
      alert('Failed to update team')
    }
  }

  const getTeamPlayers = (teamId: string) => {
    const teamPlayers = players.filter(p => p.team_id === teamId)
    
    // Sort based on selected option
    const sorted = [...teamPlayers]
    
    switch (sortOption) {
      case 'name-asc':
        return sorted.sort((a, b) => a.name.localeCompare(b.name))
      case 'name-desc':
        return sorted.sort((a, b) => b.name.localeCompare(a.name))
      case 'number-asc':
        return sorted.sort((a, b) => a.number - b.number)
      case 'number-desc':
        return sorted.sort((a, b) => b.number - a.number)
      default:
        return sorted.sort((a, b) => a.number - b.number)
    }
  }

  const startEditingPlayer = (player: Player) => {
    setEditingPlayer(player.id)
    setEditingPlayerName(player.name)
  }

  const startEditingTeam = (team: Team) => {
    setEditingTeam(team.id)
    setEditingTeamName(team.name)
  }

  return (
    <div className="container">
      <div className="header">
        <Link href="/" className="back-button">← Back</Link>
        <h1>Teams</h1>
      </div>

      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <button 
          className="primary-button"
          onClick={() => setShowCreateTeam(true)}
          style={{ flex: '1', minWidth: '200px' }}
        >
          + Create Team
        </button>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#374151' }}>
            Sort players by:
          </label>
          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value as SortOption)}
            style={{
              padding: '0.5rem 1rem',
              border: '2px solid #e5e7eb',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              cursor: 'pointer',
              backgroundColor: 'white'
            }}
          >
            <option value="name-asc">Name (A-Z)</option>
            <option value="name-desc">Name (Z-A)</option>
            <option value="number-asc">Number (0-99)</option>
            <option value="number-desc">Number (99-0)</option>
          </select>
        </div>
      </div>

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
                    style={{ backgroundColor: team.color_primary }}
                  />
                  <div>
                    {editingTeam === team.id ? (
                      <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <input
                          type="text"
                          value={editingTeamName}
                          onChange={(e) => setEditingTeamName(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              updateTeam(team.id, editingTeamName)
                            } else if (e.key === 'Escape') {
                              setEditingTeam(null)
                              setEditingTeamName('')
                            }
                          }}
                          className="input"
                          style={{ padding: '0.5rem', fontSize: '1.25rem', marginBottom: '0' }}
                          autoFocus
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            updateTeam(team.id, editingTeamName)
                          }}
                          className="primary-button small"
                          style={{ minHeight: 'auto', padding: '0.5rem 1rem' }}
                        >
                          ✓
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditingTeam(null)
                            setEditingTeamName('')
                          }}
                          className="secondary-button small"
                          style={{ minHeight: 'auto', padding: '0.5rem 1rem' }}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <h3>{team.name}</h3>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            startEditingTeam(team)
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#6b7280',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '0.25rem',
                            transition: 'background-color 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#f3f4f6'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent'
                          }}
                          aria-label="Edit team name"
                        >
                          ✏️
                        </button>
                      </div>
                    )}
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
                          <span className="jersey-number">#{player.number}</span>
                          {editingPlayer === player.id ? (
                            <div style={{ flex: 1, display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <input
                                type="text"
                                value={editingPlayerName}
                                onChange={(e) => setEditingPlayerName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    updatePlayer(player.id, editingPlayerName)
                                  } else if (e.key === 'Escape') {
                                    setEditingPlayer(null)
                                    setEditingPlayerName('')
                                  }
                                }}
                                className="input"
                                style={{ padding: '0.5rem', fontSize: '1rem', marginBottom: '0' }}
                                autoFocus
                              />
                              <button
                                onClick={() => updatePlayer(player.id, editingPlayerName)}
                                className="primary-button small"
                                style={{ minHeight: 'auto', padding: '0.5rem 1rem' }}
                              >
                                ✓
                              </button>
                              <button
                                onClick={() => {
                                  setEditingPlayer(null)
                                  setEditingPlayerName('')
                                }}
                                className="secondary-button small"
                                style={{ minHeight: 'auto', padding: '0.5rem 1rem' }}
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <>
                              <span className="player-name">{player.name}</span>
                              <button
                                onClick={() => startEditingPlayer(player)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#6b7280',
                                  cursor: 'pointer',
                                  fontSize: '0.875rem',
                                  padding: '0.25rem 0.5rem',
                                  borderRadius: '0.25rem',
                                  transition: 'background-color 0.2s',
                                  minWidth: '44px',
                                  minHeight: '44px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = '#f3f4f6'
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = 'transparent'
                                }}
                                aria-label="Edit player name"
                              >
                                ✏️
                              </button>
                            </>
                          )}
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
