'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

interface Game {
  id: string
  name: string
  light_team_id: string
  dark_team_id: string
  light_score: number
  dark_score: number
  status: string
}

export default function GamePage({ params }: { params: { id: string } }) {
  const [game, setGame] = useState<Game | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadGame()
  }, [params.id])

  const loadGame = async () => {
    try {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('id', params.id)
        .single()

      if (error) throw error
      setGame(data)
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
        <h1>{game.name || 'Game'}</h1>
      </div>

      <div className="game-score">
        <div className="score-display">
          <div className="score-team">
            <h2>Light</h2>
            <div className="score-value">{game.light_score}</div>
          </div>
          <div className="score-separator">-</div>
          <div className="score-team">
            <h2>Dark</h2>
            <div className="score-value">{game.dark_score}</div>
          </div>
        </div>
      </div>

      <div className="game-info">
        <p className="game-status">Status: {game.status}</p>
        <p className="info-text">Point tracking and stat entry will be available in Phase 2.</p>
      </div>
    </div>
  )
}
