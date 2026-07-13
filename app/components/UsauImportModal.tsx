'use client'

import { useMemo, useState } from 'react'
import type { UsauEventPlayer, UsauEventRoster } from '@/lib/usau/parseEventRoster'

export interface UsauImportRow extends UsauEventPlayer {
  selected: boolean
  editNumber: string
}

interface TeamOption {
  id: string
  name: string
}

interface UsauImportModalProps {
  teams: TeamOption[]
  initialTeamId?: string | null
  onClose: () => void
  onImport: (args: {
    teamId: string | null
    createTeamName: string | null
    players: Array<{ name: string; number: number }>
  }) => Promise<void>
}

export default function UsauImportModal({
  teams,
  initialTeamId = null,
  onClose,
  onImport,
}: UsauImportModalProps) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [roster, setRoster] = useState<UsauEventRoster | null>(null)
  const [rows, setRows] = useState<UsauImportRow[]>([])
  const [targetMode, setTargetMode] = useState<'create' | 'existing'>(
    initialTeamId ? 'existing' : 'create'
  )
  const [selectedTeamId, setSelectedTeamId] = useState(initialTeamId ?? teams[0]?.id ?? '')
  const [createTeamName, setCreateTeamName] = useState('')

  const selectedCount = useMemo(
    () => rows.filter((row) => row.selected).length,
    [rows]
  )

  const duplicateNumberWarning = useMemo(() => {
    if (!roster) return null
    const entries = Object.entries(roster.duplicateNumbers)
    if (entries.length === 0) return null
    return entries
      .map(([number, names]) => `#${number}: ${names.join(', ')}`)
      .join(' · ')
  }, [roster])

  const fetchRoster = async () => {
    setError(null)
    setLoading(true)
    try {
      const response = await fetch('/api/usau/roster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch roster')
      }

      const parsed = data as UsauEventRoster
      setRoster(parsed)
      setCreateTeamName(parsed.teamName ?? '')
      setRows(
        parsed.players.map((player) => ({
          ...player,
          selected: true,
          editNumber: String(player.number),
        }))
      )
      if (!initialTeamId) {
        setTargetMode('create')
      }
    } catch (err) {
      setRoster(null)
      setRows([])
      setError(err instanceof Error ? err.message : 'Failed to fetch roster')
    } finally {
      setLoading(false)
    }
  }

  const toggleRow = (index: number) => {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, selected: !row.selected } : row))
    )
  }

  const updateNumber = (index: number, value: string) => {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, editNumber: value } : row))
    )
  }

  const selectAll = (selected: boolean) => {
    setRows((prev) => prev.map((row) => ({ ...row, selected })))
  }

  const handleImport = async () => {
    setError(null)
    const selected = rows.filter((row) => row.selected)
    if (selected.length === 0) {
      setError('Select at least one player to import.')
      return
    }

    const players: Array<{ name: string; number: number }> = []
    for (const row of selected) {
      const number = Number.parseInt(row.editNumber, 10)
      if (!Number.isFinite(number) || number < 0) {
        setError(`Invalid jersey number for ${row.name}`)
        return
      }
      players.push({ name: row.name, number })
    }

    if (targetMode === 'create') {
      if (!createTeamName.trim()) {
        setError('Enter a team name for the new team.')
        return
      }
    } else if (!selectedTeamId) {
      setError('Select a team to import into.')
      return
    }

    setImporting(true)
    try {
      await onImport({
        teamId: targetMode === 'existing' ? selectedTeamId : null,
        createTeamName: targetMode === 'create' ? createTeamName.trim() : null,
        players,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '640px', maxHeight: '90vh', overflow: 'auto' }}
      >
        <h2>Import from USAU</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: '-0.5rem', marginBottom: '1rem' }}>
          Paste an Event Team URL from play.usaultimate.org (TeamId or EventTeamId links both work)
        </p>

        <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.35rem' }}>
          Event Team URL
        </label>
        <input
          type="url"
          className="input"
          placeholder="https://play.usaultimate.org/events/teams/?EventTeamId=..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />

        <div className="modal-actions" style={{ marginTop: '0.75rem' }}>
          <button className="secondary-button" onClick={onClose} disabled={importing}>
            Cancel
          </button>
          <button
            className="primary-button"
            onClick={fetchRoster}
            disabled={loading || importing || !url.trim()}
          >
            {loading ? 'Fetching…' : 'Fetch roster'}
          </button>
        </div>

        {error && (
          <p style={{ color: '#dc2626', marginTop: '1rem', marginBottom: 0 }}>{error}</p>
        )}

        {roster && (
          <div style={{ marginTop: '1.25rem' }}>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.75rem',
                alignItems: 'center',
                marginBottom: '0.75rem',
              }}
            >
              <strong>{roster.teamName ?? 'USAU roster'}</strong>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                {roster.players.length} players · {roster.jerseyZeroCount} with #0
              </span>
            </div>

            {duplicateNumberWarning && (
              <p
                style={{
                  background: '#fff7ed',
                  border: '1px solid #fdba74',
                  borderRadius: '0.5rem',
                  padding: '0.75rem',
                  fontSize: '0.875rem',
                  color: '#9a3412',
                  marginBottom: '0.75rem',
                }}
              >
                Duplicate jersey numbers on USAU (still importable): {duplicateNumberWarning}
              </p>
            )}

            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.35rem' }}>
                Import into
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="radio"
                    checked={targetMode === 'create'}
                    onChange={() => setTargetMode('create')}
                  />
                  Create new team
                </label>
                {targetMode === 'create' && (
                  <input
                    className="input"
                    value={createTeamName}
                    onChange={(e) => setCreateTeamName(e.target.value)}
                    placeholder="New team name"
                  />
                )}
                <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="radio"
                    checked={targetMode === 'existing'}
                    onChange={() => setTargetMode('existing')}
                    disabled={teams.length === 0}
                  />
                  Existing team
                </label>
                {targetMode === 'existing' && (
                  <select
                    className="input"
                    value={selectedTeamId}
                    onChange={(e) => setSelectedTeamId(e.target.value)}
                    disabled={teams.length === 0}
                  >
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.5rem',
              }}
            >
              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                {selectedCount} selected
              </span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="secondary-button small"
                  onClick={() => selectAll(true)}
                >
                  Select all
                </button>
                <button
                  type="button"
                  className="secondary-button small"
                  onClick={() => selectAll(false)}
                >
                  Clear
                </button>
              </div>
            </div>

            <div
              style={{
                border: '1px solid var(--border-color)',
                borderRadius: '0.5rem',
                maxHeight: '280px',
                overflow: 'auto',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-tertiary)', textAlign: 'left' }}>
                    <th style={{ padding: '0.5rem' }}></th>
                    <th style={{ padding: '0.5rem' }}>#</th>
                    <th style={{ padding: '0.5rem' }}>Player</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={`${row.name}-${index}`} style={{ borderTop: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.4rem 0.5rem' }}>
                        <input
                          type="checkbox"
                          checked={row.selected}
                          onChange={() => toggleRow(index)}
                        />
                      </td>
                      <td style={{ padding: '0.4rem 0.5rem', width: '72px' }}>
                        <input
                          type="number"
                          className="input"
                          value={row.editNumber}
                          onChange={(e) => updateNumber(index, e.target.value)}
                          style={{
                            marginBottom: 0,
                            padding: '0.35rem 0.5rem',
                            width: '64px',
                            borderColor: row.numberUnset ? '#fdba74' : undefined,
                          }}
                          title={row.numberUnset ? 'Jersey # unset on USAU' : undefined}
                        />
                      </td>
                      <td style={{ padding: '0.4rem 0.5rem' }}>
                        {row.name}
                        {row.numberUnset && (
                          <span
                            style={{
                              marginLeft: '0.5rem',
                              fontSize: '0.75rem',
                              color: '#c2410c',
                            }}
                          >
                            # unset
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="modal-actions" style={{ marginTop: '1rem' }}>
              <button className="secondary-button" onClick={onClose} disabled={importing}>
                Cancel
              </button>
              <button
                className="primary-button"
                onClick={handleImport}
                disabled={importing || selectedCount === 0}
              >
                {importing ? 'Importing…' : `Import ${selectedCount} players`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
