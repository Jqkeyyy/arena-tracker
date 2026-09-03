const ARENA_QUEUES = [1710, 1700]
const MAX_RETRIES = 5

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function riotRequest(params) {
  const query = new URLSearchParams(params)

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const response = await fetch(`/api/riot?${query}`, { headers: { Accept: 'application/json' } })
    if (response.status === 429 && attempt < MAX_RETRIES) {
      const retryAfter = Number.parseInt(response.headers.get('Retry-After') || '6', 10)
      await sleep(Math.min(retryAfter, 60) * 1000 + 250)
      continue
    }

    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(body.error || `Request failed (${response.status}).`)
    return body
  }

  throw new Error('Riot API rate limit reached. Please try again later.')
}

export function getAccountByRiotId(gameName, tagLine, region) {
  return riotRequest({ action: 'account', gameName, tagLine, region })
}

export function getChampionMastery(puuid, region) {
  return riotRequest({ action: 'mastery', puuid, region })
}

export async function getAllArenaMatchIds(puuid, region, onProgress, maxIds = Infinity) {
  const limit = Number.isFinite(maxIds) ? Math.max(1, Math.floor(maxIds)) : Infinity
  const allIds = new Set()

  for (const queue of ARENA_QUEUES) {
    let start = 0
    while (allIds.size < limit) {
      const count = Math.min(100, limit - allIds.size)
      const batch = await riotRequest({
        action: 'matchIds', puuid, region, queue: String(queue), start: String(start), count: String(count),
      })
      if (!Array.isArray(batch) || batch.length === 0) break
      batch.forEach(id => allIds.add(id))
      onProgress?.({ matchIdsFound: allIds.size })
      if (batch.length < count) break
      start += count
      await sleep(250)
    }
    if (allIds.size >= limit) break
  }

  return [...allIds]
}

export function getMatchDetail(matchId, region) {
  return riotRequest({ action: 'match', matchId, region })
}

export async function fetchAllArenaStats(puuid, region, matchIds, onProgress) {
  const champStats = {}
  const matchRecords = []

  for (let index = 0; index < matchIds.length; index += 1) {
    let match
    try {
      match = await getMatchDetail(matchIds[index], region)
    } catch (error) {
      console.warn(`Skipping match ${matchIds[index]}:`, error.message)
      onProgress?.({ processed: index + 1, total: matchIds.length })
      await sleep(500)
      continue
    }

    const participant = match.info?.participants?.find(candidate => candidate.puuid === puuid)
    if (participant) {
      const { championId, championName, gameEndTimestamp } = participant
      const won = participant.placement === 1 || (participant.placement == null && participant.win === true)
      const timestamp = gameEndTimestamp || match.info?.gameEndTimestamp

      if (!champStats[championId]) {
        champStats[championId] = {
          championId, championName, wins: 0, games: 0, lastPlayed: null, firstWin: null,
        }
      }
      champStats[championId].games += 1
      if (won) {
        champStats[championId].wins += 1
        if (timestamp && (!champStats[championId].firstWin || timestamp < champStats[championId].firstWin)) {
          champStats[championId].firstWin = timestamp
        }
      }
      if (timestamp && (!champStats[championId].lastPlayed || timestamp > champStats[championId].lastPlayed)) {
        champStats[championId].lastPlayed = timestamp
      }

      matchRecords.push({
        matchId: matchIds[index], championId, championName, win: won,
        placement: participant.placement ?? null, gameEndTimestamp: timestamp,
      })
    }

    onProgress?.({ processed: index + 1, total: matchIds.length })
    await sleep(1300)
  }

  matchRecords.sort((a, b) => (b.gameEndTimestamp || 0) - (a.gameEndTimestamp || 0))
  return { champStats, recentMatches: matchRecords.slice(0, 50) }
}

const CACHE_KEY = puuid => `arena-tracker-v2-${puuid}`
const MANUAL_KEY = puuid => `arena-tracker-manual-${puuid}`

export function loadManualWins(puuid) {
  try {
    const raw = localStorage.getItem(MANUAL_KEY(puuid))
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch {
    return new Set()
  }
}

export function saveManualWins(puuid, winsSet) {
  try {
    localStorage.setItem(MANUAL_KEY(puuid), JSON.stringify([...winsSet]))
  } catch (error) {
    console.warn('Manual win save failed:', error.message)
  }
}

export function loadCache(puuid) {
  try {
    const raw = localStorage.getItem(CACHE_KEY(puuid))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveCache(puuid, data) {
  try {
    localStorage.setItem(CACHE_KEY(puuid), JSON.stringify(data))
  } catch (error) {
    console.warn('Cache save failed:', error.message)
  }
}

export function clearCache(puuid) {
  localStorage.removeItem(CACHE_KEY(puuid))
}

let cachedChampions = null
export async function getChampionData() {
  if (cachedChampions) return cachedChampions
  const versionsResponse = await fetch('https://ddragon.leagueoflegends.com/api/versions.json')
  if (!versionsResponse.ok) throw new Error('Unable to load the current League patch.')
  const versions = await versionsResponse.json()
  const version = versions[0]

  const championResponse = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`)
  if (!championResponse.ok) throw new Error(`Unable to load champion data for patch ${version}.`)
  const data = await championResponse.json()
  cachedChampions = { version, champions: data.data }
  return cachedChampions
}

export function getChampionImageUrl(version, championKey) {
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${championKey}.png`
}
