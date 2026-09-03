import assert from 'node:assert/strict'
import test from 'node:test'
import { buildRiotRequest } from './riotProxy.js'

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
