import assert from 'node:assert/strict'
import test from 'node:test'
import { buildRiotRequest, getClientIp, isCrossSite } from './riotProxy.js'

function params(values) {
  return new URLSearchParams(values)
}

test('routes account lookups through the regional cluster', () => {
  const url = buildRiotRequest(params({
    action: 'account', region: 'na1', gameName: 'A name', tagLine: 'NA1',
  }))
  assert.equal(url, 'https://americas.api.riotgames.com/riot/account/v1/accounts/by-riot-id/A%20name/NA1')
})

test('routes current Arena match history and rejects obsolete queues', () => {
  const valid = buildRiotRequest(params({
    action: 'matchIds', region: 'euw1', puuid: 'valid_puuid-123', queue: '1710', start: '0', count: '100',
  }))
  assert.match(valid, /^https:\/\/europe\.api\.riotgames\.com\//)

  assert.throws(() => buildRiotRequest(params({
    action: 'matchIds', region: 'euw1', puuid: 'valid_puuid-123', queue: '1701',
  })), /Invalid match-history request/)
})

test('rejects unknown regions, actions, and malformed identifiers', () => {
  assert.throws(() => buildRiotRequest(params({ action: 'account', region: 'invalid' })), /Unsupported region/)
  assert.throws(() => buildRiotRequest(params({ action: 'anything', region: 'na1' })), /Unsupported Riot API action/)
  assert.throws(() => buildRiotRequest(params({
    action: 'match', region: 'na1', matchId: 'https://example.com',
  })), /Invalid match identifier/)
})

test('getClientIp trusts the last X-Forwarded-For hop, not a client-spoofable earlier one', () => {
  assert.equal(
    getClientIp({ headers: { 'x-forwarded-for': '9.9.9.9, 203.0.113.5' }, socket: {} }),
    '203.0.113.5',
  )
  assert.equal(
    getClientIp({ headers: {}, socket: { remoteAddress: '203.0.113.5' } }),
    '203.0.113.5',
  )
})

test('isCrossSite fails closed when same-site status cannot be verified', () => {
  assert.equal(isCrossSite({ headers: { 'sec-fetch-site': 'cross-site' } }), true)
  assert.equal(isCrossSite({ headers: { 'sec-fetch-site': 'same-origin' } }), false)
  assert.equal(isCrossSite({ headers: {} }), true)
  assert.equal(isCrossSite({
    headers: { origin: 'https://arena-tracker.example', host: 'arena-tracker.example' },
  }), false)
  assert.equal(isCrossSite({
    headers: { origin: 'https://evil.example', host: 'arena-tracker.example' },
  }), true)
})
