import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getAllArenaMatchIds, fetchAllArenaStats,
  getChampionData, getChampionMastery,
  loadCache, saveCache, clearCache,
  loadManualWins, saveManualWins,
} from '../api'
import ChampionGrid from './ChampionGrid'
import RecentMatches from './RecentMatches'

function formatRelativeTime(ts) {
  const mins = Math.floor((Date.now() - ts) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function mergeChampStats(existing, additions) {
  const merged = { ...existing }
  for (const [key, ns] of Object.entries(additions)) {
    if (!merged[key]) {
      merged[key] = { ...ns }
    } else {
      merged[key].games += ns.games
      merged[key].wins += ns.wins
      if (ns.lastPlayed && (!merged[key].lastPlayed || ns.lastPlayed > merged[key].lastPlayed))
        merged[key].lastPlayed = ns.lastPlayed
      if (ns.firstWin && (!merged[key].firstWin || ns.firstWin < merged[key].firstWin))
        merged[key].firstWin = ns.firstWin
    }
  }
  return merged
}

function mergeRecentMatches(existing, additions) {
  const seen = new Set()
  return [...additions, ...existing]
    .filter(m => seen.has(m.matchId) ? false : seen.add(m.matchId))
    .sort((a, b) => (b.gameEndTimestamp || 0) - (a.gameEndTimestamp || 0))
    .slice(0, 50)
}

export default function TrackerPage({ player, onBack }) {
  const [phase, setPhase] = useState('loading') // loading | updating | done | error
  const [status, setStatus] = useState('')
  const [matchCount, setMatchCount] = useState(0)
  const [processed, setProcessed] = useState(0)
  const [total, setTotal] = useState(0)
  const [champStats, setChampStats] = useState({})
  const [recentMatches, setRecentMatches] = useState([])
  const [manualWins, setManualWins] = useState(new Set())
  const [champions, setChampions] = useState([])
  const [version, setVersion] = useState('')
  const [masteryMap, setMasteryMap] = useState({})
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState(null)
  const [scannedIds, setScannedIds] = useState([])

  const loadBaseData = useCallback(async function loadBaseData() {
    const [champData, masteryData] = await Promise.all([
      getChampionData(),
      getChampionMastery(player.puuid, player.region).catch(() => []),
    ])
    setVersion(champData.version)
    setChampions(Object.values(champData.champions))
    const mMap = {}
    for (const m of masteryData) mMap[m.championId] = m.championLevel
    setMasteryMap(mMap)
  }, [player.puuid, player.region])

  const loadFull = useCallback(async function loadFull() {
    try {
      setPhase('loading')
      setStatus('Loading champion data...')
      await loadBaseData()

      setStatus('Scanning Arena match history...')
      const matchIds = await getAllArenaMatchIds(player.puuid, player.region, ({ matchIdsFound }) => {
        setMatchCount(matchIdsFound)
        setStatus(`Found ${matchIdsFound} Arena matches, loading details...`)
      }, player.scanDepth)

      if (matchIds.length === 0) {
        const now = Date.now()
        setChampStats({})
        setRecentMatches([])
        setScannedIds([])
        setLastUpdated(now)
        saveCache(player.puuid, { champStats: {}, scannedIds: [], lastUpdated: now, recentMatches: [] })
        setPhase('done')
        return
      }

      setTotal(matchIds.length)
      const { champStats: stats, recentMatches: matches } = await fetchAllArenaStats(
        player.puuid, player.region, matchIds,
        ({ processed, total }) => {
          setProcessed(processed)
          setStatus(`Processing matches... ${processed} / ${total}`)
        }
      )

      const now = Date.now()
      setChampStats(stats)
      setRecentMatches(matches)
      setScannedIds(matchIds)
      setLastUpdated(now)
      saveCache(player.puuid, { champStats: stats, scannedIds: matchIds, lastUpdated: now, recentMatches: matches })
      setPhase('done')
    } catch (e) {
      setError(e.message || 'Something went wrong.')
      setPhase('error')
    }
  }, [loadBaseData, player.puuid, player.region, player.scanDepth])

  const init = useCallback(async function init() {
    setManualWins(loadManualWins(player.puuid))
    const cache = loadCache(player.puuid)
    if (cache?.champStats && cache?.scannedIds) {
      setChampStats(cache.champStats)
      setRecentMatches(cache.recentMatches || [])
      setScannedIds(cache.scannedIds)
      setMatchCount(cache.scannedIds.length)
      setLastUpdated(cache.lastUpdated)
      setStatus('Loading champion data...')
      await loadBaseData().catch(() => {})
      setPhase('done')
    } else {
      await loadFull()
    }
  }, [loadBaseData, loadFull, player.puuid])

  useEffect(() => {
    const timeoutId = window.setTimeout(init, 0)
    return () => window.clearTimeout(timeoutId)
  }, [init])

  async function handleUpdate() {
    try {
      setPhase('updating')
      setProcessed(0)
      setTotal(0)
      setStatus('Checking for new matches...')

      const allIds = await getAllArenaMatchIds(player.puuid, player.region, () => {}, player.scanDepth)
      const cachedSet = new Set(scannedIds)
      const newIds = allIds.filter(id => !cachedSet.has(id))

      if (newIds.length === 0) {
        const now = Date.now()
        setLastUpdated(now)
        saveCache(player.puuid, { champStats, scannedIds, lastUpdated: now, recentMatches })
        setPhase('done')
        return
      }

      setTotal(newIds.length)
      setStatus(`Loading ${newIds.length} new matches...`)
      const { champStats: newStats, recentMatches: newMatches } = await fetchAllArenaStats(
        player.puuid, player.region, newIds,
        ({ processed, total }) => {
          setProcessed(processed)
          setStatus(`Loading new matches... ${processed} / ${total}`)
        }
      )

      const merged = mergeChampStats(champStats, newStats)
      const mergedMatches = mergeRecentMatches(recentMatches, newMatches)
      const updatedIds = [...scannedIds, ...newIds]
      const now = Date.now()

      setChampStats(merged)
      setRecentMatches(mergedMatches)
      setScannedIds(updatedIds)
      setMatchCount(updatedIds.length)
      setLastUpdated(now)
      saveCache(player.puuid, { champStats: merged, scannedIds: updatedIds, lastUpdated: now, recentMatches: mergedMatches })
      setPhase('done')
    } catch (e) {
      setError(e.message || 'Update failed.')
      setPhase('error')
    }
  }

  function handleToggleManual(champKey) {
    setManualWins(prev => {
      const next = new Set(prev)
      if (next.has(champKey)) next.delete(champKey)
      else next.add(champKey)
      saveManualWins(player.puuid, next)
      return next
    })
  }

  const wonCount = useMemo(() => {
    const apiWins = new Set(
      Object.values(champStats).filter(c => c.wins > 0).map(c => String(c.championId))
    )
    return new Set([...apiWins, ...manualWins]).size
  }, [champStats, manualWins])
  const totalChamps = champions.length
  const completion = totalChamps > 0 ? (wonCount / totalChamps) * 100 : 0
  const isUpdating = phase === 'updating'

  return (
    <div style={{ minHeight: '100vh', padding: '0 0 4rem' }}>
      {/* Header */}
      <div className="tracker-header" style={{
        borderBottom: '1px solid var(--border)',
        background: '#080b12ee',
        backdropFilter: 'blur(12px)',
        position: 'sticky', top: 0, zIndex: 100,
        padding: '0.85rem 1.5rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: '1rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button type="button" onClick={onBack} style={{
            background: 'none', border: '1px solid var(--border)',
            color: 'var(--text-secondary)', cursor: 'pointer',
            borderRadius: 4, padding: '4px 10px', fontSize: '0.7rem',
            fontFamily: "'Space Mono', monospace",
            transition: 'all 0.15s',
          }}
            onMouseOver={event => { event.currentTarget.style.borderColor = 'var(--gold)' }}
            onMouseOut={event => { event.currentTarget.style.borderColor = 'var(--border)' }}
          >← BACK</button>
          <div>
            <div style={{
              fontFamily: "'Syne', sans-serif", fontWeight: 700,
              fontSize: '0.95rem', color: 'var(--gold)',
            }}>{player.displayName}</div>
            <div style={{
              fontSize: '0.6rem', color: 'var(--text-muted)',
              letterSpacing: '0.1em', textTransform: 'uppercase',
            }}>{player.region.toUpperCase()}{version ? ` · PATCH ${version}` : ''}</div>
          </div>
        </div>

        {(phase === 'done' || isUpdating) && (
          <div className="tracker-summary" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>ARENA WINS</div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: '1.1rem' }}>
                <span style={{ color: 'var(--win-green)' }}>{wonCount}</span>
                <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> / {totalChamps}</span>
              </div>
            </div>
            <div style={{ width: 120 }}>
              <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginBottom: 4, letterSpacing: '0.08em', textAlign: 'right' }}>
                {Math.round(completion)}%
              </div>
              <div className="progress-bar-track">
                <div className="progress-bar-fill" style={{ width: `${completion}%` }} />
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.08em' }}>GAMES SCANNED</div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
                {matchCount}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              {lastUpdated && (
                <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                  {formatRelativeTime(lastUpdated)}
                </div>
              )}
              {isUpdating ? (
                <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontFamily: "'Space Mono', monospace" }}>
                  {total > 0 ? `${processed} / ${total}` : status}
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 4 }}>
                  <button type="button" onClick={handleUpdate} className="sort-btn" style={{ fontSize: '0.65rem', padding: '3px 10px' }}>
                    UPDATE
                  </button>
                  <button
                    type="button"
                    onClick={() => { clearCache(player.puuid); loadFull() }}
                    className="sort-btn"
                    style={{ fontSize: '0.65rem', padding: '3px 10px', opacity: 0.5 }}
                    title="Clear cache and rescan from scratch"
                  >
                    RESCAN
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Update progress bar */}
      {isUpdating && total > 0 && (
        <div style={{
          background: '#0a0e18',
          borderBottom: '1px solid var(--border)',
          padding: '6px 1.5rem',
          display: 'flex', alignItems: 'center', gap: '1rem',
        }}>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{status}</div>
          <div className="progress-bar-track" style={{ flex: 1, maxWidth: 240 }}>
            <div className="progress-bar-fill" style={{ width: `${(processed / total) * 100}%` }} />
          </div>
        </div>
      )}

      {/* Full-screen loading (first scan only) */}
      {phase === 'loading' && (
        <div style={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          minHeight: 'calc(100vh - 60px)', gap: '1.5rem',
          padding: '2rem',
        }}>
          <div style={{ position: 'relative', width: 64, height: 64 }}>
            <div style={{
              position: 'absolute', inset: 0,
              border: '2px solid var(--border)',
              borderTop: '2px solid var(--gold)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontFamily: "'Syne', sans-serif", fontWeight: 700,
              fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: 8,
            }}>{status}</div>
            {total > 0 && (
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 6 }}>
                  {processed} / {total} matches
                </div>
                <div className="progress-bar-track" style={{ width: 240 }}>
                  <div className="progress-bar-fill" style={{ width: `${(processed / total) * 100}%` }} />
                </div>
              </div>
            )}
          </div>
          <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', maxWidth: 320, textAlign: 'center' }}>
            Scanning {Number.isFinite(player.scanDepth) ? `your latest ${player.scanDepth}` : 'all-time'} Arena history. Results are cached in this browser.
          </p>
        </div>
      )}

      {phase === 'error' && (
        <div style={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          minHeight: 'calc(100vh - 60px)', gap: '1rem',
        }}>
          <div style={{ fontSize: '2rem' }}>⚠</div>
          <div style={{ color: '#ff7070', fontFamily: "'Syne', sans-serif", fontWeight: 700 }}>Error loading data</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{error}</div>
          <button type="button" onClick={loadFull} className="sort-btn" style={{ marginTop: 8 }}>RETRY</button>
        </div>
      )}

      {(phase === 'done' || isUpdating) && (
        <div className="tracker-content" style={{ display: 'flex', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <ChampionGrid
              champions={champions}
              champStats={champStats}
              masteryMap={masteryMap}
              version={version}
              manualWins={manualWins}
              onToggleManual={handleToggleManual}
            />
          </div>
          <RecentMatches matches={recentMatches} version={version} />
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
