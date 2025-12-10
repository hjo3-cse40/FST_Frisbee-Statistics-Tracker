'use client'

import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/app/components/AuthProvider'
import Logo from '@/app/components/Logo'

export default function TestDataPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [testData, setTestData] = useState<{
    teams: any[]
    players: any[]
    games: any[]
  } | null>(null)

  const fetchTestData = async () => {
    try {
      setLoading(true)
      setError(null)
      setStatus('Fetching test data from Supabase...')

      // Fetch teams with matching names (case-insensitive)
      // Looking for: "Cal Ursa Major 2024-2025" and "Slugs 2024-2025"
      // Get the original test teams (those without a user_id or with a specific user_id)
      // We'll use the first instance of each team name
      const { data: allTeamsData, error: teamsError } = await supabase
        .from('teams')
        .select('*')
        .or('name.ilike.%Cal Ursa Major 2024-2025%,name.ilike.%Slugs 2024-2025%')
        .order('created_at', { ascending: true })

      if (teamsError) throw teamsError

      if (!allTeamsData || allTeamsData.length === 0) {
        throw new Error('No test teams found. Make sure teams named "Cal Ursa Major 2024-2025" and "Slugs 2024-2025" exist in Supabase.')
      }

      // Deduplicate by team name - take the first instance of each team name
      const uniqueTeamsMap = new Map<string, any>()
      for (const team of allTeamsData) {
        const teamNameLower = team.name.toLowerCase()
        if (!uniqueTeamsMap.has(teamNameLower)) {
          uniqueTeamsMap.set(teamNameLower, team)
        }
      }
      
      const teamsData = Array.from(uniqueTeamsMap.values())

      setStatus(`Found ${teamsData.length} test teams`)

      // Fetch players for these teams
      const teamIds = teamsData.map(t => t.id)
      const { data: allPlayersData, error: playersError } = await supabase
        .from('players')
        .select('*')
        .in('team_id', teamIds)
        .order('team_id', { ascending: true })
        .order('number', { ascending: true })

      if (playersError) throw playersError

      // Deduplicate players by team_id, name, and number
      // Take only the first instance of each unique player
      const playerMap = new Map<string, any>()
      for (const player of (allPlayersData || [])) {
        const key = `${player.team_id}-${player.name.toLowerCase()}-${player.number}`
        if (!playerMap.has(key)) {
          playerMap.set(key, player)
        }
      }
      
      const playersData = Array.from(playerMap.values())

      setStatus(`Found ${playersData.length} unique players`)

      // Fetch games for these teams (home or away)
      const { data: gamesDataHome, error: gamesErrorHome } = await supabase
        .from('games')
        .select('*')
        .in('team_home_id', teamIds)
      
      const { data: gamesDataAway, error: gamesErrorAway } = await supabase
        .from('games')
        .select('*')
        .in('team_away_id', teamIds)
      
      if (gamesErrorHome) throw gamesErrorHome
      if (gamesErrorAway) throw gamesErrorAway
      
      // Combine and deduplicate games
      const allGames = [...(gamesDataHome || []), ...(gamesDataAway || [])]
      const gamesData = Array.from(new Map(allGames.map(g => [g.id, g])).values())
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

      setStatus(`Found ${gamesData?.length || 0} games`)

      setTestData({
        teams: teamsData,
        players: playersData || [],
        games: gamesData || []
      })

      setStatus('Test data fetched successfully!')
    } catch (err: any) {
      setError(err.message || 'Failed to fetch test data')
      setStatus(null)
    } finally {
      setLoading(false)
    }
  }

  const loadTestData = async () => {
    if (!testData) {
      setError('Please fetch test data first')
      return
    }

    try {
      setLoading(true)
      setError(null)
      setStatus('Loading test data into your account...')

      const userId = user?.id || null

      // Create teams (or update if they exist)
      const teamsToCreate = testData.teams.map(team => ({
        name: team.name,
        color_primary: team.color_primary,
        color_secondary: team.color_secondary || null,
        user_id: userId
      }))

      // Check if teams already exist for this user
      let existingTeams: any[] = []
      if (user) {
        const { data: existing } = await supabase
          .from('teams')
          .select('id, name')
          .eq('user_id', user.id)
        
        existingTeams = existing || []
      } else {
        const { data: existing } = await supabase
          .from('teams')
          .select('id, name')
          .is('user_id', null)
        
        existingTeams = existing || []
      }

      const teamMap = new Map<string, string>() // old team id -> new team id

      for (const team of teamsToCreate) {
        const existing = existingTeams.find(t => t.name === team.name)
        
        if (existing) {
          // Update existing team
          const { error: updateError } = await supabase
            .from('teams')
            .update({
              color_primary: team.color_primary,
              color_secondary: team.color_secondary
            })
            .eq('id', existing.id)

          if (updateError) throw updateError
          teamMap.set(testData.teams.find(t => t.name === team.name)!.id, existing.id)
        } else {
          // Create new team
          const { data: newTeam, error: createError } = await supabase
            .from('teams')
            .insert([team])
            .select()
            .single()

          if (createError) throw createError
          teamMap.set(testData.teams.find(t => t.name === team.name)!.id, newTeam.id)
        }
      }

      setStatus('Teams loaded. Loading players...')

      // Create players
      const playersToCreate = testData.players
        .filter(p => teamMap.has(p.team_id))
        .map(player => ({
          name: player.name,
          number: player.number,
          team_id: teamMap.get(player.team_id)!,
          user_id: userId
        }))

      if (playersToCreate.length > 0) {
        // Delete existing players for these teams first
        const newTeamIds = Array.from(teamMap.values())
        if (user) {
          await supabase
            .from('players')
            .delete()
            .eq('user_id', user.id)
            .in('team_id', newTeamIds)
        } else {
          await supabase
            .from('players')
            .delete()
            .is('user_id', null)
            .in('team_id', newTeamIds)
        }

        // Insert new players
        const { error: playersError } = await supabase
          .from('players')
          .insert(playersToCreate)

        if (playersError) throw playersError
      }

      setStatus(`Loaded ${teamsToCreate.length} teams and ${playersToCreate.length} players!`)

      // Show success message
      setTimeout(() => {
        setStatus('Test data loaded successfully! Redirecting to teams page...')
        setTimeout(() => {
          window.location.href = '/teams'
        }, 1500)
      }, 1000)
    } catch (err: any) {
      setError(err.message || 'Failed to load test data')
      setStatus(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container">
      <Link href="/" style={{ display: 'block', textDecoration: 'none', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <Logo />
        </div>
      </Link>

      <div className="header">
        <Link href="/" className="back-button">← Back</Link>
        <h1>Load Test Data</h1>
        <p className="subtitle">Load sample teams and players from Supabase</p>
      </div>

      <div style={{
        maxWidth: '600px',
        margin: '2rem auto',
        padding: '2rem',
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: '1rem',
        border: '2px solid var(--border-color)'
      }}>
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>
            Instructions
          </h2>
          <ol style={{ 
            paddingLeft: '1.5rem',
            color: 'var(--text-secondary)',
            lineHeight: '1.8'
          }}>
            <li>Click "Fetch Test Data" to load teams from Supabase</li>
            <li>Review the teams and players found</li>
            <li>Click "Load Test Data" to import them into your account</li>
          </ol>
        </div>

        {testData && (
          <div style={{
            marginBottom: '2rem',
            padding: '1.5rem',
            backgroundColor: 'var(--bg-tertiary)',
            borderRadius: '0.75rem'
          }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>
              Test Data Preview
            </h3>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              <p><strong>Teams:</strong> {testData.teams.length}</p>
              <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
                {testData.teams.map(team => (
                  <li key={team.id}>
                    {team.name} ({testData.players.filter(p => p.team_id === team.id).length} players)
                  </li>
                ))}
              </ul>
              {testData.games.length > 0 && (
                <p style={{ marginTop: '0.75rem' }}>
                  <strong>Games:</strong> {testData.games.length}
                </p>
              )}
            </div>
          </div>
        )}

        {status && (
          <div style={{
            padding: '1rem',
            backgroundColor: '#dbeafe',
            color: '#1e40af',
            borderRadius: '0.5rem',
            marginBottom: '1rem',
            fontSize: '0.875rem'
          }}>
            {status}
          </div>
        )}

        {error && (
          <div style={{
            padding: '1rem',
            backgroundColor: '#fee2e2',
            color: '#dc2626',
            borderRadius: '0.5rem',
            marginBottom: '1rem',
            fontSize: '0.875rem'
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <button
            onClick={fetchTestData}
            disabled={loading}
            className="primary-button"
          >
            {loading ? 'Fetching...' : 'Fetch Test Data'}
          </button>

          {testData && (
            <button
              onClick={loadTestData}
              disabled={loading}
              className="secondary-button"
            >
              {loading ? 'Loading...' : 'Load Test Data'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
