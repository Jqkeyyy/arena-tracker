import { getChampionImageUrl } from '../api'

const PLACEMENT = {
  1: { label: '1ST', color: '#c89b3c' },
  2: { label: '2ND', color: '#8a9bb5' },
  3: { label: '3RD', color: '#a0725a' },
  4: { label: '4TH', color: '#4a5568' },
}

function formatDate(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function RecentMatches({ matches, version }) {
  if (!matches?.length) return null

  return (
    <aside className="recent-matches" style={{
      width: 196,
      flexShrink: 0,
      borderLeft: '1px solid var(--border)',
      position: 'sticky',
      top: 57,
      maxHeight: 'calc(100vh - 57px)',
      overflowY: 'auto',
      scrollbarWidth: 'thin',
    }}>
      <div style={{
        fontSize: '0.55rem',
        letterSpacing: '0.15em',
        color: 'var(--text-muted)',
        fontFamily: "'Space Mono', monospace",
        padding: '1rem 1rem 0.6rem',
        borderBottom: '1px solid var(--border)',
      }}>RECENT GAMES</div>

      {matches.slice(0, 30).map((m, i) => {
        const p = PLACEMENT[m.placement] || PLACEMENT[4]
        const imgUrl = version ? getChampionImageUrl(version, m.championName) : null

        return (
          <div key={m.matchId || i} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '6px 10px',
            borderBottom: '1px solid var(--border)',
            background: m.win ? '#0b1f0e' : 'transparent',
          }}>
            {imgUrl && (
              <img
                src={imgUrl}
                alt=""
                width="30"
                height="30"
                style={{ width: 30, height: 30, borderRadius: 4, flexShrink: 0, objectFit: 'cover' }}
                onError={e => { e.target.style.display = 'none' }}
              />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: '0.62rem',
                fontFamily: "'Syne', sans-serif",
                fontWeight: 700,
                color: m.win ? 'var(--win-green)' : 'var(--text-secondary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>{m.championName}</div>
              <div style={{
                display: 'flex',
                gap: '0.4rem',
                marginTop: 2,
                fontSize: '0.52rem',
                fontFamily: "'Space Mono', monospace",
              }}>
                <span style={{ color: p.color }}>{p.label}</span>
                <span style={{ color: 'var(--text-muted)' }}>{formatDate(m.gameEndTimestamp)}</span>
              </div>
            </div>
          </div>
        )
      })}
    </aside>
  )
}
