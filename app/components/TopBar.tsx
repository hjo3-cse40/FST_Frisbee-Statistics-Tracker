'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from './AuthProvider'
import { useTheme } from './ThemeProvider'

function getDisplayName(email?: string | null, metadata?: Record<string, unknown>) {
  const fullName = metadata?.full_name ?? metadata?.name
  if (typeof fullName === 'string' && fullName.trim()) {
    return fullName.trim()
  }
  if (email) {
    return email.split('@')[0]
  }
  return 'Profile'
}

export default function TopBar() {
  const { user, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [showMenu, setShowMenu] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  const displayName = getDisplayName(user?.email, user?.user_metadata)

  return (
    <div
      style={{
        position: 'fixed',
        top: '1rem',
        right: '1rem',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
      }}
    >
      {user ? (
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '0.5rem',
              border: '2px solid var(--border-color)',
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span>{displayName}</span>
            <span>{showMenu ? '▲' : '▼'}</span>
          </button>

          {showMenu && (
            <>
              <div
                style={{
                  position: 'fixed',
                  inset: 0,
                  zIndex: 999,
                }}
                onClick={() => setShowMenu(false)}
              />
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '0.5rem',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '2px solid var(--border-color)',
                  borderRadius: '0.5rem',
                  padding: '0.5rem',
                  minWidth: '200px',
                  boxShadow: '0 4px 6px -1px var(--shadow)',
                  zIndex: 1001,
                }}
              >
                <div
                  style={{
                    padding: '0.75rem',
                    fontSize: '0.875rem',
                    color: 'var(--text-secondary)',
                    borderBottom: '1px solid var(--border-color)',
                    marginBottom: '0.5rem',
                  }}
                >
                  Signed in as<br />
                  <strong>{user.email}</strong>
                </div>
                <button
                  onClick={async () => {
                    await signOut()
                    setShowMenu(false)
                  }}
                  className="secondary-button"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    fontSize: '0.875rem',
                    minHeight: 'auto',
                  }}
                >
                  Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <Link
          href="/auth/signin"
          className="secondary-button"
          style={{
            padding: '0.75rem 1rem',
            fontSize: '0.875rem',
            width: 'auto',
            minHeight: 'auto',
            textDecoration: 'none',
          }}
        >
          Sign In
        </Link>
      )}

      <button
        onClick={toggleTheme}
        style={{
          padding: '0.75rem',
          borderRadius: '50%',
          border: 'none',
          backgroundColor: 'var(--bg-secondary)',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.5rem',
          width: '3rem',
          height: '3rem',
          transition: 'all 0.2s ease',
        }}
        aria-label="Toggle dark mode"
        title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
      >
        {theme === 'light' ? '🌙' : '☀️'}
      </button>
    </div>
  )
}
