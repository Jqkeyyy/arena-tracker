const PLATFORM_TO_CLUSTER = Object.freeze({
  na1: 'americas',
  br1: 'americas',
  la1: 'americas',
  la2: 'americas',
  euw1: 'europe',
  eun1: 'europe',
  tr1: 'europe',
  ru: 'europe',
  kr: 'asia',
  jp1: 'asia',
  oc1: 'sea',
  ph2: 'sea',
  sg2: 'sea',
  th2: 'sea',
  tw2: 'sea',
  vn2: 'sea',
})

const ARENA_QUEUES = new Set(['1700', '1710'])
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_REQUESTS = 75
const REQUEST_TIMEOUT_MS = 15_000
const requestBuckets = new Map()

function validText(value, maxLength) {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength
}

function validPuuid(value) {
  return validText(value, 128) && /^[A-Za-z0-9_-]+$/.test(value)
}

function integerParam(value, { min, max, fallback }) {
  if (value == null || value === '') return fallback
  if (!/^\d+$/.test(value)) return null
  const number = Number(value)
  return Number.isSafeInteger(number) && number >= min && number <= max ? number : null
}

export function buildRiotRequest(searchParams) {
  const action = searchParams.get('action')
  const region = searchParams.get('region')?.toLowerCase()
  const cluster = PLATFORM_TO_CLUSTER[region]

  if (!cluster) throw new Error('Unsupported region.')

  if (action === 'account') {
    const gameName = searchParams.get('gameName')
    const tagLine = searchParams.get('tagLine')
    if (!validText(gameName, 32) || !validText(tagLine, 16)) {
      throw new Error('Invalid Riot ID.')
    }
    return `https://${cluster}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`
  }

  if (action === 'mastery') {
    const puuid = searchParams.get('puuid')
    if (!validPuuid(puuid)) throw new Error('Invalid player identifier.')
    return `https://${region}.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/${encodeURIComponent(puuid)}`
  }

  if (action === 'matchIds') {
    const puuid = searchParams.get('puuid')
    const queue = searchParams.get('queue')
    const start = integerParam(searchParams.get('start'), { min: 0, max: 10_000, fallback: 0 })
    const count = integerParam(searchParams.get('count'), { min: 1, max: 100, fallback: 100 })
    if (!validPuuid(puuid) || !ARENA_QUEUES.has(queue) || start == null || count == null) {
      throw new Error('Invalid match-history request.')
    }
    return `https://${cluster}.api.riotgames.com/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?queue=${queue}&start=${start}&count=${count}`
  }

  if (action === 'match') {
    const matchId = searchParams.get('matchId')
    if (!validText(matchId, 64) || !/^[A-Za-z0-9]+_\d+$/.test(matchId)) {
      throw new Error('Invalid match identifier.')
    }
    return `https://${cluster}.api.riotgames.com/lol/match/v5/matches/${encodeURIComponent(matchId)}`
  }

  throw new Error('Unsupported Riot API action.')
}

export function getClientIp(request) {
  const forwarded = request.headers['x-forwarded-for']
  if (typeof forwarded === 'string') {
    // The trusted edge proxy appends the real client IP as the last hop;
    // earlier entries can be set by the client itself, so trusting the
    // first entry lets a caller spoof a new IP on every request.
    const ips = forwarded.split(',').map((ip) => ip.trim()).filter(Boolean)
    if (ips.length > 0) return ips[ips.length - 1]
  }
  return request.socket?.remoteAddress || 'unknown'
}

function isRateLimited(ip, now = Date.now()) {
  if (requestBuckets.size >= 5_000) {
    for (const [bucketIp, bucket] of requestBuckets) {
      if (now - bucket.startedAt >= RATE_LIMIT_WINDOW_MS) requestBuckets.delete(bucketIp)
    }
    if (requestBuckets.size >= 5_000) requestBuckets.delete(requestBuckets.keys().next().value)
  }

  const current = requestBuckets.get(ip)
  if (!current || now - current.startedAt >= RATE_LIMIT_WINDOW_MS) {
    requestBuckets.set(ip, { count: 1, startedAt: now })
    return false
  }

  current.count += 1
  return current.count > RATE_LIMIT_REQUESTS
}

export function isCrossSite(request) {
  const secFetchSite = request.headers['sec-fetch-site']
  if (secFetchSite) return !['same-origin', 'same-site', 'none'].includes(secFetchSite)

  const origin = request.headers.origin
  const host = request.headers['x-forwarded-host'] || request.headers.host
  // Fail closed: without Sec-Fetch-Site or a comparable Origin/Host pair,
  // same-site status can't be verified, so treat the request as cross-site.
  if (!origin || !host) return true
  try {
    return new URL(origin).host !== host
  } catch {
    return true
  }
}

function sendJson(response, status, body, extraHeaders = {}) {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Cache-Control', 'no-store')
  for (const [name, value] of Object.entries(extraHeaders)) response.setHeader(name, value)
  response.end(JSON.stringify(body))
}

function publicErrorMessage(status, upstreamBody) {
  if (status === 401 || status === 403) return 'The Riot API credentials are invalid or expired.'
  if (status === 404) return 'The requested Riot player or match was not found.'
  if (status === 429) return 'Riot API rate limit reached. Please try again shortly.'
  if (status === 400 && upstreamBody?.status?.message) return 'Riot rejected the request.'
  return 'The Riot API request failed.'
}

export function createRiotProxyHandler({ riotApiKey = process.env.RIOT_API_KEY, fetchImpl = fetch } = {}) {
  return async function riotProxy(request, response) {
    if (request.method !== 'GET') {
      response.setHeader('Allow', 'GET')
      return sendJson(response, 405, { error: 'Method not allowed.' })
    }

    if (isCrossSite(request)) return sendJson(response, 403, { error: 'Cross-site requests are not allowed.' })
    if (isRateLimited(getClientIp(request))) {
      return sendJson(response, 429, { error: 'Too many requests. Please wait a minute and try again.' }, { 'Retry-After': '60' })
    }
    if (!riotApiKey) return sendJson(response, 503, { error: 'The server is missing RIOT_API_KEY.' })

    let upstreamUrl
    try {
      const requestUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`)
      upstreamUrl = buildRiotRequest(requestUrl.searchParams)
    } catch (error) {
      return sendJson(response, 400, { error: error.message })
    }

    try {
      const upstream = await fetchImpl(upstreamUrl, {
        headers: { 'X-Riot-Token': riotApiKey },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      const body = await upstream.json().catch(() => null)
      if (!upstream.ok) {
        const headers = upstream.status === 429
          ? { 'Retry-After': upstream.headers.get('Retry-After') || '6' }
          : {}
        return sendJson(response, upstream.status, { error: publicErrorMessage(upstream.status, body) }, headers)
      }
      return sendJson(response, 200, body)
    } catch (error) {
      const timedOut = error?.name === 'TimeoutError'
      return sendJson(response, timedOut ? 504 : 502, {
        error: timedOut ? 'The Riot API request timed out.' : 'Unable to reach the Riot API.',
      })
    }
  }
}
