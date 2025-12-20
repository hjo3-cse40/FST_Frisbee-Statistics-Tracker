'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from './AuthProvider'
import { useTheme } from './ThemeProvider'

export default function MobileMenu() {
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

  return (
    <div style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 1000 }}>
      <button
        onClick={() => setShowMenu(!showMenu)}
        style={{
          padding: '0.75rem',
          borderRadius: '0.5rem',
          border: '2px solid var(--border-color)',
          backgroundColor: 'var(--bg-secondary)',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '3rem',
          height: '3rem',
          transition: 'all 0.2s'
        }}
        aria-label="Menu"
      >
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem',
          width: '1.25rem',
          height: '1rem'
        }}>
          <div style={{
            width: '100%',
            height: '2px',
            backgroundColor: 'var(--text-primary)',
            borderRadius: '1px',
            transition: 'all 0.2s',
            transform: showMenu ? 'rotate(45deg) translate(5px, 5px)' : 'none'
          }} />
          <div style={{
            width: '100%',
            height: '2px',
            backgroundColor: 'var(--text-primary)',
            borderRadius: '1px',
            transition: 'all 0.2s',
            opacity: showMenu ? 0 : 1
          }} />
          <div style={{
            width: '100%',
            height: '2px',
            backgroundColor: 'var(--text-primary)',
            borderRadius: '1px',
            transition: 'all 0.2s',
            transform: showMenu ? 'rotate(-45deg) translate(5px, -5px)' : 'none'
          }} />
        </div>
      </button>

      {showMenu && (
        <>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 998,
              backgroundColor: 'var(--modal-overlay)'
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
              borderRadius: '0.75rem',
              padding: '0.75rem',
              minWidth: '250px',
              boxShadow: '0 4px 6px -1px var(--shadow)',
              zIndex: 999
            }}
          >
            {user ? (
              <>
                <div style={{
                  padding: '0.75rem',
                  fontSize: '0.875rem',
                  color: 'var(--text-secondary)',
                  borderBottom: '1px solid var(--border-color)',
                  marginBottom: '0.75rem'
                }}>
                  Signed in as<br />
                  <strong style={{ color: 'var(--text-primary)' }}>{user.email}</strong>
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
                    marginBottom: '0.75rem'
                  }}
                >
                  Sign Out
                </button>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <Link
                  href="/auth/signin"
                  onClick={() => setShowMenu(false)}
                  className="secondary-button"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    fontSize: '0.875rem',
                    minHeight: 'auto',
                    textAlign: 'center',
                    textDecoration: 'none',
                    display: 'block'
                  }}
                >
                  Login
                </Link>
                <Link
                  href="/auth/signup"
                  onClick={() => setShowMenu(false)}
                  className="primary-button"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    fontSize: '0.875rem',
                    minHeight: 'auto',
                    textAlign: 'center',
                    textDecoration: 'none',
                    display: 'block'
                  }}
                >
                  Create Account
                </Link>
              </div>
            )}

            <div style={{
              borderTop: '1px solid var(--border-color)',
              paddingTop: '0.75rem',
              marginTop: '0.75rem'
            }}>
              <button
                onClick={() => {
                  toggleTheme()
                }}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '0.5rem',
                  border: '2px solid var(--border-color)',
                  backgroundColor: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.2s'
                }}
              >
                <span style={{ fontSize: '1.25rem' }}>
                  {theme === 'light' ? '🌙' : '☀️'}
                </span>
                <span>{theme === 'light' ? 'Dark' : 'Light'}</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}


