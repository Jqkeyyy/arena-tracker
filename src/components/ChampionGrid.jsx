import { useMemo, useState } from 'react'
import { getChampionImageUrl } from '../api'

const SORTS = [
  { id: 'az', label: 'A → Z' },
  { id: 'za', label: 'Z → A' },
  { id: 'mastery', label: 'Mastery' },
  { id: 'games', label: 'Most Played' },
]

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'won', label: 'Won' },
  { id: 'played', label: 'Played, no win' },
  { id: 'unplayed', label: 'Unplayed' },
]

function formatDate(timestamp) {
  if (!timestamp) return null
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: '2-digit',
  })
}

function masteryLabel(level) {
  if (!level) return null
  if (level >= 7) return { label: `M${level}`, color: '#c89b3c' }
  if (level >= 5) return { label: `M${level}`, color: '#7a90b0' }
  return { label: `M${level}`, color: '#3a4f6a' }
}

export default function ChampionGrid({
  champions,
  champStats,
  masteryMap,
  version,
  manualWins = new Set(),
  onToggleManual,
}) {
  const [sort, setSort] = useState('az')
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  const sorted = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase()
    const list = champions.filter(champion => {
      if (normalizedSearch && !champion.name.toLocaleLowerCase().includes(normalizedSearch)) return false
      const stats = champStats[champion.key]
      const won = stats?.wins > 0 || manualWins.has(champion.key)
      if (filter === 'won') return won
      if (filter === 'played') return Boolean(stats?.games) && !won
      if (filter === 'unplayed') return !stats?.games && !won
      return true
    })

    list.sort((a, b) => {
      if (sort === 'az') return a.name.localeCompare(b.name)
      if (sort === 'za') return b.name.localeCompare(a.name)
      if (sort === 'mastery') {
        return (masteryMap[b.key] || 0) - (masteryMap[a.key] || 0) || a.name.localeCompare(b.name)
      }
      if (sort === 'games') {
        return (champStats[b.key]?.games || 0) - (champStats[a.key]?.games || 0) || a.name.localeCompare(b.name)
      }
      return 0
    })

    return list
  }, [champions, champStats, masteryMap, manualWins, sort, filter, search])

  return (
    <section className="champion-section" aria-label="Champion progress">
      <div className="tracker-controls">
        <label className="sr-only" htmlFor="champion-search">Search champions</label>
        <input
          id="champion-search"
          className="search-input champion-search"
          placeholder="Search champion…"
          value={search}
          onChange={event => setSearch(event.target.value)}
        />

        <div className="control-group" aria-label="Sort champions">
          {SORTS.map(option => (
            <button
              type="button"
              key={option.id}
              className={`sort-btn ${sort === option.id ? 'active' : ''}`}
              aria-pressed={sort === option.id}
              onClick={() => setSort(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="control-group" aria-label="Filter champions">
          {FILTERS.map(option => (
            <button
              type="button"
              key={option.id}
              className={`filter-btn ${filter === option.id ? 'active' : ''}`}
              aria-pressed={filter === option.id}
              onClick={() => setFilter(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <span className="champion-count">{sorted.length} champions</span>
      </div>

      <div className="champion-grid">
        {sorted.map(champion => {
          const stats = champStats[champion.key]
          const apiWon = stats?.wins > 0
          const manualWon = manualWins.has(champion.key)
          const won = apiWon || manualWon
          const mastery = masteryLabel(masteryMap[champion.key])
          const title = apiWon
            ? `${champion.name} — ${stats.games} games, ${stats.wins} wins (API verified)`
            : manualWon
              ? `${champion.name} — manually marked won; click to unmark`
              : `${champion.name}${stats ? ` — ${stats.games} games, ${stats.wins} wins` : ' — unplayed'}; click to mark won`

          return (
            <button
              type="button"
              key={champion.key}
              className={`champion-card ${won ? 'won' : ''}`}
              title={title}
              aria-pressed={won}
              onClick={() => { if (!apiWon) onToggleManual?.(champion.key) }}
            >
              <div className="card-img-wrap">
                <img
                  src={getChampionImageUrl(version, champion.id)}
                  alt=""
                  loading="lazy"
                  width="120"
                  height="120"
                />
                {won && (
                  <span className={`win-overlay ${manualWon && !apiWon ? 'manual' : ''}`} aria-hidden="true">✓</span>
                )}
                {mastery && (
                  <span className="mastery-badge" style={{ color: mastery.color }}>{mastery.label}</span>
                )}
              </div>

              <span className="champion-card-body">
                <span className="champion-name">{champion.name}</span>
                {stats ? (
                  <span className="champion-stats">
                    <span className="stat-chip">{stats.games}G · {stats.wins}W</span>
                    {stats.firstWin && <span className="stat-chip win-date">won {formatDate(stats.firstWin)}</span>}
                    {stats.lastPlayed && <span className="stat-chip">last {formatDate(stats.lastPlayed)}</span>}
                  </span>
                ) : (
                  <span className="stat-chip">{manualWon ? 'manual win' : 'unplayed'}</span>
                )}
              </span>
            </button>
          )
        })}
      </div>

      {sorted.length === 0 && <p className="empty-state">No champions match your filters.</p>}
    </section>
  )
}
