'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/app/components/AuthProvider'

interface Team {
  id: string
  name: string
  color_primary: string
  color_secondary?: string
}

export default function GameSetupPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [teams, setTeams] = useState<Team[]>([])
  const [teamOneId, setTeamOneId] = useState<string>('')
  const [teamTwoId, setTeamTwoId] = useState<string>('')
  const [teamOneJerseyColor, setTeamOneJerseyColor] = useState('#3B82F6')
  const [teamTwoJerseyColor, setTeamTwoJerseyColor] = useState('#EF4444')
  const [pullingTeamId, setPullingTeamId] = useState<string>('')
  const [gameLocation, setGameLocation] = useState('')
  const [gameName, setGameName] = useState('')
  const [pointsToWin, setPointsToWin] = useState<number>(15)
  const [creating, setCreating] = useState(false)

  const bothTeamsSelected = Boolean(
    teamOneId && teamTwoId && teamOneId !== teamTwoId
  )

  useEffect(() => {
    if (!teamOneId || !teamTwoId || teamOneId === teamTwoId) {
      setPullingTeamId('')
      return
    }
    setPullingTeamId((prev) => {
      if (prev === teamOneId || prev === teamTwoId) return prev
      return teamOneId
    })
  }, [teamOneId, teamTwoId])

  useEffect(() => {
    loadTeams()
  }, [user])

  const loadTeams = async () => {
    try {
      let query = supabase
        .from('teams')
        .select('*')

      if (user) {
        query = query.eq('user_id', user.id)
      } else {
        query = query.is('user_id', null)
      }

      const { data, error } = await query.order('name', { ascending: true })

      if (error) throw error
      setTeams(data || [])
    } catch (error) {
      console.error('Error loading teams:', error)
    }
  }

  const handleTeamSelect = (teamId: string, setTeamId: (id: string) => void) => {
    setTeamId(teamId)
  }

  const handlePullCheck = (teamId: string, checked: boolean) => {
    if (checked) {
      setPullingTeamId(teamId)
    } else if (pullingTeamId === teamId) {
      setPullingTeamId('')
    }
  }

  const createGame = async () => {
    if (!teamOneId || !teamTwoId) {
      alert('Please select both teams')
      return
    }

    if (teamOneId === teamTwoId) {
      alert('Teams must be different')
      return
    }

    if (!pullingTeamId) {
      alert('Please select which team pulls first')
      return
    }

    if (!gameName.trim()) {
      alert('Please enter a game name')
      return
    }

    if (!pointsToWin || pointsToWin < 1) {
      alert('Please enter a valid number of points to win (must be at least 1)')
      return
    }

    setCreating(true)

    try {
      const gameData: any = {
        team_home_id: teamOneId,
        team_away_id: teamTwoId,
        pulling_team_id: pullingTeamId,
        team_home_jersey_color: teamOneJerseyColor,
        team_away_jersey_color: teamTwoJerseyColor,
        home_score: 0,
        away_score: 0,
        points_to_win: pointsToWin,
        location: gameLocation.trim() || null,
        user_id: user?.id || null,
        name: gameName.trim(),
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

      if (!data?.id) {
        throw new Error('Game was created but no ID was returned')
      }

      router.push(`/games/${data.id}`)
    } catch (error: any) {
      console.error('Error creating game:', error)
      const errorMessage = error?.message || 'Unknown error occurred'
      alert(`Failed to create game: ${errorMessage}`)
      setCreating(false)
    }
  }

  const renderTeamColumn = (
    label: string,
    teamId: string,
    setTeamId: (id: string) => void,
    jerseyColor: string,
    setJerseyColor: (color: string) => void,
    otherTeamId: string
  ) => {
    return (
      <div className="team-picker-column">
        <label className="team-picker-sublabel">{label}</label>
        <select
          className="input"
          value={teamId}
          onChange={(e) =>
            handleTeamSelect(e.target.value, setTeamId)
          }
        >
          <option value="">Select team...</option>
          {teams.map((team) => (
            <option
              key={team.id}
              value={team.id}
              disabled={team.id === otherTeamId}
            >
              {team.name}
            </option>
          ))}
        </select>

        {teamId && (
          <>
            <div className="jersey-color-picker">
              <label className="team-picker-sublabel">Jersey color *</label>
              <input
                type="color"
                value={jerseyColor}
                onChange={(e) => setJerseyColor(e.target.value)}
                className="color-picker"
                aria-label={`${label} jersey color`}
              />
            </div>

            <label className="pull-check-label">
              <input
                type="checkbox"
                checked={pullingTeamId === teamId}
                onChange={(e) => handlePullCheck(teamId, e.target.checked)}
                disabled={!bothTeamsSelected}
              />
              <span
                className="pull-check-color"
                style={{ backgroundColor: jerseyColor }}
              />
              Pulls first
            </label>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="container">
      <div className="header">
        <Link href="/" className="back-button">← Back</Link>
        <div className="form-group game-name-header">
          <input
            type="text"
            className="input game-name-input"
            placeholder="e.g., Cal vs Slugs — Pool Play"
            value={gameName}
            onChange={(e) => setGameName(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="game-setup-form">
        {teams.length === 0 ? (
          <div className="empty-state-container">
            <p>No teams available. Please create teams first.</p>
            <Link href="/teams" className="primary-button">
              Go to Teams
            </Link>
          </div>
        ) : (
          <>
            <div className="form-group">
              <label>Teams *</label>
              <div className="team-pickers-row">
                {renderTeamColumn(
                  'Team 1',
                  teamOneId,
                  setTeamOneId,
                  teamOneJerseyColor,
                  setTeamOneJerseyColor,
                  teamTwoId
                )}
                {renderTeamColumn(
                  'Team 2',
                  teamTwoId,
                  setTeamTwoId,
                  teamTwoJerseyColor,
                  setTeamTwoJerseyColor,
                  teamOneId
                )}
              </div>
              <p className="form-hint">
                The team that scores each point pulls the next point.
              </p>
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
              <p className="form-hint">
                First team to reach this score wins the game (common: 15 or 21)
              </p>
            </div>

            <button
              type="button"
              onClick={createGame}
              disabled={
                creating ||
                !gameName.trim() ||
                !teamOneId ||
                !teamTwoId ||
                teamOneId === teamTwoId ||
                !pullingTeamId ||
                !pointsToWin ||
                pointsToWin < 1
              }
              className="primary-button large"
            >
              {creating ? 'Starting...' : 'Start Game'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
