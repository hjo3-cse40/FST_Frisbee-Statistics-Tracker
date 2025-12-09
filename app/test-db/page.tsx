'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function TestDatabasePage() {
  const [results, setResults] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const addResult = (message: string, success: boolean = true) => {
    const icon = success ? '✅' : '❌'
    setResults(prev => [...prev, `${icon} ${message}`])
  }

  const clearResults = () => {
    setResults([])
  }

  const testDatabase = async () => {
    setLoading(true)
    clearResults()
    addResult('Starting database tests...')

    try {
      // Test 1: Check if points table exists and has correct structure
      addResult('Test 1: Checking points table...')
      try {
        const { data: pointsData, error: pointsError } = await supabase
          .from('points')
          .select('id, game_id, point_number, scoring_team_id, created_at')
          .limit(1)

        if (pointsError) {
          if (pointsError.code === '42P01') {
            addResult('Points table does not exist!', false)
          } else {
            addResult(`Points table error: ${pointsError.message}`, false)
          }
        } else {
          addResult('Points table exists and is accessible')
        }
      } catch (error: any) {
        addResult(`Points table check failed: ${error.message}`, false)
      }

      // Test 2: Check if point_lineups table exists
      addResult('Test 2: Checking point_lineups table...')
      try {
        const { data: lineupsData, error: lineupsError } = await supabase
          .from('point_lineups')
          .select('point_id, player_id, team_id')
          .limit(1)

        if (lineupsError) {
          if (lineupsError.code === '42P01') {
            addResult('Point_lineups table does not exist!', false)
          } else {
            addResult(`Point_lineups table error: ${lineupsError.message}`, false)
          }
        } else {
          addResult('Point_lineups table exists and is accessible')
        }
      } catch (error: any) {
        addResult(`Point_lineups table check failed: ${error.message}`, false)
      }

      // Test 3: Check if games table exists (prerequisite)
      addResult('Test 3: Checking games table (prerequisite)...')
      try {
        const { data: gamesData, error: gamesError } = await supabase
          .from('games')
          .select('id')
          .limit(1)

        if (gamesError) {
          addResult(`Games table error: ${gamesError.message}`, false)
        } else {
          addResult('Games table exists')
        }
      } catch (error: any) {
        addResult(`Games table check failed: ${error.message}`, false)
      }

      // Test 4: Check if teams table exists (prerequisite)
      addResult('Test 4: Checking teams table (prerequisite)...')
      try {
        const { data: teamsData, error: teamsError } = await supabase
          .from('teams')
          .select('id')
          .limit(1)

        if (teamsError) {
          addResult(`Teams table error: ${teamsError.message}`, false)
        } else {
          addResult('Teams table exists')
        }
      } catch (error: any) {
        addResult(`Teams table check failed: ${error.message}`, false)
      }

      // Test 5: Check if players table exists (prerequisite)
      addResult('Test 5: Checking players table (prerequisite)...')
      try {
        const { data: playersData, error: playersError } = await supabase
          .from('players')
          .select('id')
          .limit(1)

        if (playersError) {
          addResult(`Players table error: ${playersError.message}`, false)
        } else {
          addResult('Players table exists')
        }
      } catch (error: any) {
        addResult(`Players table check failed: ${error.message}`, false)
      }

      // Test 6: Try to create a test point (if we have a game)
      addResult('Test 6: Testing point creation...')
      try {
        const { data: games } = await supabase
          .from('games')
          .select('id')
          .limit(1)

        if (games && games.length > 0) {
          const testGameId = games[0].id
          
          // Get max point number for this game
          const { data: existingPoints } = await supabase
            .from('points')
            .select('point_number')
            .eq('game_id', testGameId)
            .order('point_number', { ascending: false })
            .limit(1)

          const nextPointNumber = existingPoints && existingPoints.length > 0
            ? existingPoints[0].point_number + 1
            : 1

          const { data: newPoint, error: createError } = await supabase
            .from('points')
            .insert([{
              game_id: testGameId,
              point_number: nextPointNumber,
              scoring_team_id: null
            }])
            .select()
            .single()

          if (createError) {
            // Check if it's a unique constraint violation (which is actually good!)
            if (createError.code === '23505') {
              addResult('Unique constraint works! (point_number per game is enforced)')
            } else {
              addResult(`Point creation error: ${createError.message}`, false)
            }
          } else {
            addResult(`Test point created successfully (ID: ${newPoint.id})`)
            
            // Clean up test point
            await supabase
              .from('points')
              .delete()
              .eq('id', newPoint.id)
            addResult('Test point cleaned up')
          }
        } else {
          addResult('No games found - skipping point creation test', false)
        }
      } catch (error: any) {
        addResult(`Point creation test failed: ${error.message}`, false)
      }

      // Test 7: Check for unique constraint (try to create duplicate point_number)
      addResult('Test 7: Testing unique constraint on (game_id, point_number)...')
      try {
        const { data: games } = await supabase
          .from('games')
          .select('id')
          .limit(1)

        if (games && games.length > 0) {
          const testGameId = games[0].id
          
          // Get first point number for this game
          const { data: firstPoint } = await supabase
            .from('points')
            .select('point_number')
            .eq('game_id', testGameId)
            .limit(1)
            .single()

          if (firstPoint) {
            // Try to create duplicate
            const { error: duplicateError } = await supabase
              .from('points')
              .insert([{
                game_id: testGameId,
                point_number: firstPoint.point_number,
                scoring_team_id: null
              }])

            if (duplicateError && duplicateError.code === '23505') {
              addResult('Unique constraint is working! Duplicate point numbers are prevented')
            } else if (duplicateError) {
              addResult(`Unique constraint test error: ${duplicateError.message}`, false)
            } else {
              addResult('WARNING: Unique constraint may not be set up!', false)
            }
          } else {
            addResult('No existing points found - skipping unique constraint test')
          }
        } else {
          addResult('No games found - skipping unique constraint test')
        }
      } catch (error: any) {
        addResult(`Unique constraint test failed: ${error.message}`, false)
      }

      // Test 8: Count existing data
      addResult('Test 8: Counting existing data...')
      try {
        const [pointsCount, lineupsCount, gamesCount, teamsCount, playersCount] = await Promise.all([
          supabase.from('points').select('id', { count: 'exact', head: true }),
          supabase.from('point_lineups').select('id', { count: 'exact', head: true }),
          supabase.from('games').select('id', { count: 'exact', head: true }),
          supabase.from('teams').select('id', { count: 'exact', head: true }),
          supabase.from('players').select('id', { count: 'exact', head: true })
        ])

        addResult(`Points: ${pointsCount.count || 0}`)
        addResult(`Point Lineups: ${lineupsCount.count || 0}`)
        addResult(`Games: ${gamesCount.count || 0}`)
        addResult(`Teams: ${teamsCount.count || 0}`)
        addResult(`Players: ${playersCount.count || 0}`)
      } catch (error: any) {
        addResult(`Data count failed: ${error.message}`, false)
      }

      addResult('All tests completed!')
    } catch (error: any) {
      addResult(`Test suite error: ${error.message}`, false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container">
      <div className="header">
        <Link href="/" className="back-button">← Back</Link>
        <h1>Database Test Suite</h1>
        <p className="subtitle">Test your Supabase database setup</p>
      </div>

      <div style={{ marginTop: '2rem' }}>
        <button
          onClick={testDatabase}
          disabled={loading}
          className="primary-button large"
          style={{ width: '100%', marginBottom: '1rem' }}
        >
          {loading ? 'Running Tests...' : 'Run Database Tests'}
        </button>

        <button
          onClick={clearResults}
          className="secondary-button"
          style={{ width: '100%', marginBottom: '2rem' }}
        >
          Clear Results
        </button>

        {results.length > 0 && (
          <div style={{
            padding: '1.5rem',
            backgroundColor: '#f9fafb',
            border: '1px solid #e5e7eb',
            borderRadius: '0.5rem',
            fontFamily: 'monospace',
            fontSize: '0.875rem',
            lineHeight: '1.75'
          }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: 600 }}>
              Test Results:
            </h3>
            {results.map((result, index) => (
              <div key={index} style={{ marginBottom: '0.5rem' }}>
                {result}
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#eff6ff', border: '1px solid #3b82f6', borderRadius: '0.5rem' }}>
          <h3 style={{ marginBottom: '0.5rem', fontSize: '1rem', fontWeight: 600 }}>What this tests:</h3>
          <ul style={{ marginLeft: '1.5rem', fontSize: '0.875rem', lineHeight: '1.75' }}>
            <li>Points table existence and structure</li>
            <li>Point_lineups table existence and structure</li>
            <li>Prerequisite tables (games, teams, players)</li>
            <li>Point creation functionality</li>
            <li>Unique constraint on (game_id, point_number)</li>
            <li>Data counts for all tables</li>
          </ul>
        </div>
      </div>
    </div>
  )
}


