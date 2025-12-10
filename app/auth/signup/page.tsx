'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/app/components/AuthProvider'
import { useRouter } from 'next/navigation'
import Logo from '@/app/components/Logo'

export default function SignUpPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const { signUp, claimGuestData } = useAuth()
  const router = useRouter()

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      setLoading(false)
      return
    }

    try {
      const { error: signUpError } = await signUp(email, password)
      
      if (signUpError) {
        setError(signUpError.message || 'Failed to create account')
        setLoading(false)
        return
      }

      // Try to claim existing guest data
      const { error: claimError } = await claimGuestData()
      
      if (claimError) {
        console.error('Error claiming guest data:', claimError)
        // Don't fail signup if claiming fails, just log it
      }

      setSuccess(true)
      setTimeout(() => {
        router.push('/')
      }, 2000)
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
        <h1>Create Account</h1>
        <p className="subtitle">Save your teams, players, and games</p>
      </div>

      {success ? (
        <div style={{
          padding: '2rem',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '0.75rem',
          textAlign: 'center'
        }}>
          <h2 style={{ color: '#059669', marginBottom: '1rem' }}>✓ Account Created!</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Your account has been created and your existing data has been saved.
          </p>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>
            Redirecting to homepage...
          </p>
        </div>
      ) : (
        <form onSubmit={handleSignUp} style={{ maxWidth: '400px', margin: '0 auto' }}>
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
              placeholder="At least 6 characters"
              required
              minLength={6}
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input"
              placeholder="Re-enter password"
              required
              minLength={6}
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
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>

          <p style={{ 
            textAlign: 'center', 
            marginTop: '1.5rem', 
            fontSize: '0.875rem', 
            color: 'var(--text-tertiary)' 
          }}>
            Already have an account?{' '}
            <Link href="/auth/signin" style={{ color: '#3b82f6', textDecoration: 'none' }}>
              Sign In
            </Link>
          </p>
        </form>
      )}
    </div>
  )
}
