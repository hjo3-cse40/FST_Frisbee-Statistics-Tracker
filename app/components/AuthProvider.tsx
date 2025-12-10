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

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
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
    }
    
    return { error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
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
