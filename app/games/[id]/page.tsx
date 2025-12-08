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
  date: string
}

interface Team {
  id: string
  name: string
  color_primary: string
}

export default function GamePage({ params }: { params: { id: string } }) {
  const [game, setGame] = useState<Game | null>(null)
  const [homeTeam, setHomeTeam] = useState<Team | null>(null)
  const [awayTeam, setAwayTeam] = useState<Team | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadGame()
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
        <h1>{game.location || 'Game'}</h1>
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
        <p className="info-text">Point tracking and stat entry will be available in Phase 2.</p>
      </div>
    </div>
  )
}
