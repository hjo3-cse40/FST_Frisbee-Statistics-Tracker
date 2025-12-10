'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from './AuthProvider'

export default function UserMenu() {
  const { user, signOut } = useAuth()
  const [showMenu, setShowMenu] = useState(false)

  if (!user) {
    return (
      <div style={{ 
        position: 'fixed',
        top: '1rem',
        right: '5rem',
        zIndex: 1000,
        display: 'flex',
        gap: '0.75rem'
      }}>
        <Link 
          href="/auth/signin"
          className="secondary-button"
          style={{ 
            padding: '0.75rem 1rem',
            fontSize: '0.875rem',
            width: 'auto',
            minHeight: 'auto'
          }}
        >
          Login
        </Link>
        <Link 
          href="/auth/signup"
          className="primary-button"
          style={{ 
            padding: '0.75rem 1rem',
            fontSize: '0.875rem',
            width: 'auto',
            minHeight: 'auto'
          }}
        >
          Create Account
        </Link>
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', top: '1rem', right: '5rem', zIndex: 1000 }}>
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
          gap: '0.5rem'
        }}
      >
        <span>👤</span>
        <span>{user.email}</span>
        <span>{showMenu ? '▲' : '▼'}</span>
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
              zIndex: 999
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
              zIndex: 1001
            }}
          >
            <div style={{
              padding: '0.75rem',
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
              borderBottom: '1px solid var(--border-color)',
              marginBottom: '0.5rem'
            }}>
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
                minHeight: 'auto'
              }}
            >
              Sign Out
            </button>
          </div>
        </>
      )}
    </div>
  )
}
