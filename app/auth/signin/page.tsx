'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/app/components/AuthProvider'
import { useRouter } from 'next/navigation'
import Logo from '@/app/components/Logo'

export default function SignInPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { signIn } = useAuth()
  const router = useRouter()

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { error: signInError } = await signIn(email, password)
      
      if (signInError) {
        setError(signInError.message || 'Failed to sign in')
        setLoading(false)
        return
      }

      // Redirect to homepage on success
      router.push('/')
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred')
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
        <h1>Sign In</h1>
        <p className="subtitle">Access your saved data</p>
      </div>

      <form onSubmit={handleSignIn} style={{ maxWidth: '400px', margin: '0 auto' }}>
        <div className="form-group">
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
            placeholder="your@email.com"
            required
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
            placeholder="Enter your password"
            required
            disabled={loading}
          />
        </div>

        {error && (
          <div style={{
            padding: '0.75rem',
            backgroundColor: '#fee2e2',
            color: '#dc2626',
            borderRadius: '0.5rem',
            marginBottom: '1rem',
            fontSize: '0.875rem'
          }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="primary-button large"
        >
          {loading ? 'Signing In...' : 'Sign In'}
        </button>

        <p style={{ 
          textAlign: 'center', 
          marginTop: '1.5rem', 
          fontSize: '0.875rem', 
          color: 'var(--text-tertiary)' 
        }}>
          Don't have an account?{' '}
          <Link href="/auth/signup" style={{ color: '#3b82f6', textDecoration: 'none' }}>
            Create Account
          </Link>
        </p>
      </form>
    </div>
  )
}
