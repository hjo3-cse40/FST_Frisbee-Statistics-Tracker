'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface AuthContextType {
  user: User | null
  loading: boolean
  signUp: (email: string, password: string) => Promise<{ error: any }>
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signOut: () => Promise<void>
  claimGuestData: () => Promise<{ error: any }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [testDataLoaded, setTestDataLoaded] = useState(false)

  const autoLoadTestData = async (userId: string) => {
    // Prevent multiple loads
    if (testDataLoaded) return
    
    try {
      // Check if user already has teams (don't reload if they do)
      const { data: existingTeams } = await supabase
        .from('teams')
        .select('id')
        .eq('user_id', userId)
        .limit(1)

      if (existingTeams && existingTeams.length > 0) {
        // User already has data, mark as loaded and don't reload
        setTestDataLoaded(true)
        return
      }

      // Mark as loading to prevent duplicate calls
      setTestDataLoaded(true)

      // Fetch test teams
      const { data: teamsData } = await supabase
        .from('teams')
        .select('*')
        .or('name.ilike.%Cal Ursa Major 2024-2025%,name.ilike.%Slugs 2024-2025%')

      if (!teamsData || teamsData.length === 0) return

      const teamIds = teamsData.map(t => t.id)

      // Fetch players for these teams
      const { data: playersData } = await supabase
        .from('players')
        .select('*')
        .in('team_id', teamIds)

      // Create teams for this user
      const teamMap = new Map<string, string>()
      for (const team of teamsData) {
        // Check if team with this name already exists for this user
        const { data: existingTeam } = await supabase
          .from('teams')
          .select('id')
          .eq('user_id', userId)
          .eq('name', team.name)
          .single()

        if (existingTeam) {
          teamMap.set(team.id, existingTeam.id)
        } else {
          const { data: newTeam } = await supabase
            .from('teams')
            .insert([{
              name: team.name,
              color_primary: team.color_primary,
              color_secondary: team.color_secondary || null,
              user_id: userId
            }])
            .select()
            .single()

          if (newTeam) {
            teamMap.set(team.id, newTeam.id)
          }
        }
      }

      // Create players for this user (only if they don't already exist)
      if (playersData && playersData.length > 0) {
        const newTeamIds = Array.from(teamMap.values())
        
        // Check existing players for these teams
        const { data: existingPlayers } = await supabase
          .from('players')
          .select('name, number, team_id')
          .eq('user_id', userId)
          .in('team_id', newTeamIds)

        const existingPlayerKeys = new Set(
          (existingPlayers || []).map(p => `${p.team_id}-${p.name}-${p.number}`)
        )

        const playersToCreate = playersData
          .filter(p => teamMap.has(p.team_id))
          .map(player => ({
            name: player.name,
            number: player.number,
            team_id: teamMap.get(player.team_id)!,
            user_id: userId
          }))
          .filter(player => {
            const key = `${player.team_id}-${player.name}-${player.number}`
            return !existingPlayerKeys.has(key)
          })

        if (playersToCreate.length > 0) {
          await supabase
            .from('players')
            .insert(playersToCreate)
        }
      }
    } catch (error) {
      console.error('Error auto-loading test data:', error)
      // Reset flag on error so it can retry
      setTestDataLoaded(false)
    }
  }

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
      
      // Auto-load test data for test@example.com
      if (session?.user?.email === 'test@example.com') {
        autoLoadTestData(session.user.id)
      }
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
      
      // Auto-load test data for test@example.com
      if (session?.user?.email === 'test@example.com') {
        autoLoadTestData(session.user.id)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Disable email confirmation for testing
        emailRedirectTo: undefined,
        // Allow test emails
        data: {
          // This helps bypass some validation
        }
      }
    })
    
    if (!error && data.user) {
      setUser(data.user)
    }
    
    return { error }
  }

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    
    if (!error && data.user) {
      setUser(data.user)
      
      // Auto-load test data for test@example.com
      if (data.user.email === 'test@example.com') {
        autoLoadTestData(data.user.id)
      }
    }
    
    return { error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setTestDataLoaded(false) // Reset flag on sign out
  }

  const claimGuestData = async () => {
    if (!user) return { error: { message: 'Not authenticated' } }

    try {
      // Update all guest data (user_id IS NULL) to current user's ID
      const userId = user.id

      // Claim teams
      const { error: teamsError } = await supabase
        .from('teams')
        .update({ user_id: userId })
        .is('user_id', null)

      if (teamsError) throw teamsError

      // Claim players
      const { error: playersError } = await supabase
        .from('players')
        .update({ user_id: userId })
        .is('user_id', null)

      if (playersError) throw playersError

      // Claim games (and cascade to points/events)
      const { error: gamesError } = await supabase
        .from('games')
        .update({ user_id: userId })
        .is('user_id', null)

      if (gamesError) throw gamesError

      return { error: null }
    } catch (error: any) {
      return { error }
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, signUp, signIn, signOut, claimGuestData }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
