import { useState } from 'react'
import { getAccountByRiotId } from '../api'

const REGIONS = [
  { value: 'na1', label: 'NA' },
  { value: 'euw1', label: 'EUW' },
  { value: 'kr', label: 'KR' },
  { value: 'eun1', label: 'EUNE' },
  { value: 'br1', label: 'BR' },
  { value: 'la1', label: 'LAN' },
  { value: 'la2', label: 'LAS' },
  { value: 'oc1', label: 'OCE' },
  { value: 'tr1', label: 'TR' },
  { value: 'ru', label: 'RU' },
  { value: 'jp1', label: 'JP' },
  { value: 'ph2', label: 'PH' },
  { value: 'sg2', label: 'SG' },
  { value: 'th2', label: 'TH' },
  { value: 'tw2', label: 'TW' },
  { value: 'vn2', label: 'VN' },
]

const SCAN_DEPTHS = [
  { value: 100,      label: 'Last 100' },
  { value: 300,      label: 'Last 300' },
  { value: Infinity, label: 'All time' },
]

export default function LookupPage({ onPlayer }) {
  const [input, setInput] = useState('')
  const [region, setRegion] = useState('na1')
  const [scanDepth, setScanDepth] = useState(100)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLookup() {
    const trimmed = input.trim()
    if (!trimmed.includes('#')) {
      setError('Enter your Riot ID in the format: Name#TAG')
      return
    }
    const separator = trimmed.lastIndexOf('#')
    const gameName = trimmed.slice(0, separator).trim()
    const tagLine = trimmed.slice(separator + 1).trim()
    if (!gameName || !tagLine) {
      setError('Invalid Riot ID format. Example: Faker#KR1')
      return
    }

    setLoading(true)
    setError('')
    try {
      const account = await getAccountByRiotId(gameName, tagLine, region)
      onPlayer({ ...account, region, displayName: `${gameName}#${tagLine}`, scanDepth })
    } catch (e) {
      setError(e.message || 'Player not found. Check your Riot ID and region.')
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter') handleLookup()
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
    }}>
      {/* Decorative background orbs */}
      <div style={{
        position: 'fixed', top: '20%', left: '10%',
        width: 300, height: 300,
        background: 'radial-gradient(circle, #c89b3c08 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'fixed', bottom: '20%', right: '10%',
        width: 400, height: 400,
        background: 'radial-gradient(circle, #00e5a008 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ maxWidth: 480, width: '100%', animation: 'fadeInUp 0.5s ease' }}>
        {/* Logo / Title */}
        <div style={{ marginBottom: '2.5rem', textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            marginBottom: '0.75rem',
          }}>
            <div style={{
              width: 36, height: 36,
              background: 'linear-gradient(135deg, var(--gold) 0%, var(--gold-bright) 100%)',
              borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.1rem', boxShadow: '0 0 20px #c89b3c30',
            }}>⚔</div>
            <h1 style={{
              fontSize: '1.6rem', fontWeight: 800, margin: 0,
              letterSpacing: '-0.02em',
              background: 'linear-gradient(90deg, var(--gold) 0%, var(--gold-bright) 60%, var(--text-primary) 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>ARENA TRACKER</h1>
          </div>
          <p style={{
            color: 'var(--text-secondary)', fontSize: '0.75rem',
            letterSpacing: '0.15em', textTransform: 'uppercase', margin: 0,
          }}>
            Champion win tracker for Arena mode
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '2rem',
          boxShadow: '0 24px 60px rgba(0,0,0,0.4)',
        }}>
          <label style={{
            display: 'block', fontSize: '0.65rem', letterSpacing: '0.12em',
            color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8,
          }}>Riot ID</label>
          <input
            className="search-input"
            style={{
              width: '100%', padding: '10px 14px', borderRadius: 6,
              fontSize: '0.9rem', marginBottom: '1rem',
            }}
            placeholder="YourName#NA1"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            disabled={loading}
            autoComplete="off"
            maxLength={49}
          />

          <label style={{
            display: 'block', fontSize: '0.65rem', letterSpacing: '0.12em',
            color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8,
          }}>Region</label>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6,
            marginBottom: '1.5rem',
          }}>
            {REGIONS.map(r => (
              <button
                type="button"
                key={r.value}
                className={`sort-btn ${region === r.value ? 'active' : ''}`}
                style={{ padding: '6px 4px', textAlign: 'center' }}
                onClick={() => setRegion(r.value)}
              >{r.label}</button>
            ))}
          </div>

          <label style={{
            display: 'block', fontSize: '0.65rem', letterSpacing: '0.12em',
            color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8,
          }}>Scan depth</label>
          <div style={{ display: 'flex', gap: 6, marginBottom: '1.5rem' }}>
            {SCAN_DEPTHS.map(d => (
              <button
                type="button"
                key={String(d.value)}
                className={`sort-btn ${scanDepth === d.value ? 'active' : ''}`}
                style={{ flex: 1, padding: '6px 4px', textAlign: 'center' }}
                onClick={() => setScanDepth(d.value)}
              >{d.label}</button>
            ))}
          </div>

          {error && (
            <div style={{
              background: '#2a0a0a', border: '1px solid #5a1a1a',
              borderRadius: 6, padding: '10px 14px',
              fontSize: '0.75rem', color: '#ff7070', marginBottom: '1rem',
            }}>{error}</div>
          )}

          <button
            type="button"
            onClick={handleLookup}
            disabled={loading || !input.trim()}
            style={{
              width: '100%', padding: '11px',
              background: loading || !input.trim()
                ? 'var(--border)'
                : 'linear-gradient(90deg, var(--gold) 0%, var(--gold-bright) 100%)',
              border: 'none', borderRadius: 6, cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
              color: loading || !input.trim() ? 'var(--text-muted)' : '#0a0800',
              fontFamily: "'Syne', sans-serif", fontWeight: 700,
              fontSize: '0.85rem', letterSpacing: '0.08em',
              transition: 'all 0.2s',
              boxShadow: loading || !input.trim() ? 'none' : '0 4px 20px #c89b3c30',
            }}
          >
            {loading ? 'LOOKING UP...' : 'SEARCH PLAYER'}
          </button>
        </div>

        <p style={{
          textAlign: 'center', marginTop: '1.5rem',
          fontSize: '0.65rem', color: 'var(--text-muted)', letterSpacing: '0.05em',
        }}>
          Current patch data · Arena queues 1700 + 1710
        </p>
      </div>
    </div>
  )
}
