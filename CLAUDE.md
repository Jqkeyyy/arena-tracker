# Arena Tracker — Project Context

## What this is
A React web app that lets you look up a League of Legends player by Riot ID and see which champions they've won with in Arena mode. Built as a personal tracker for the "win with every champ" challenge.

## Stack
- React + Vite + Tailwind CSS (`@tailwindcss/vite` plugin)
- No backend — Riot API called directly from the browser
- Fonts: Syne (headers) + Space Mono (body/stats) from Google Fonts

## Running it
```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build
```

## Environment
Riot API key goes in `.env` (not committed):
VITE_RIOT_API_KEY=RGAPI-xxxx-xxxx-xxxx
Dev keys expire every 24 hours — regenerate at https://developer.riotgames.com/

## Key decisions made
- **Arena queue IDs**: 1700, 1701, 1704 — all three must be queried or you miss games
- **Scan depth**: all-time history (paginated 100 at a time per queue ID)
- **Match data**: match-v5 API, each match has `championName` + `win` + `gameEndTimestamp` per participant
- **Regional routing**: platform regions (na1, euw1, kr etc) map to clusters (americas, europe, asia, sea) for match-v5 and account-v1 calls
- **Mastery**: fetched separately via champion-mastery-v4, keyed by championId
- **Riot policy**: cannot show Arena augment win rates — showing per-champ win/loss is fine

## Per-champion data tracked
- `games` — total Arena games on this champ
- `wins` — total Arena wins
- `firstWin` — timestamp of earliest win (shown as "won MMM DD")
- `lastPlayed` — timestamp of most recent game (shown as "last MMM DD")

## Sort options
A→Z, Z→A, Mastery level (desc), Most Played (desc)

## Filter options
All / Won / Played No Win / Unplayed

## Progress header (sticky)
- X / [total champs] won
- Completion % bar
- Total Arena games scanned

## Design
- Dark gaming aesthetic
- CSS variables in `src/index.css` (--bg-deep, --gold, --win-green, etc.)
- Champion cards: portrait image, green checkmark overlay on wins, name, games/wins, last played, first win date, mastery badge

## File structure
src/
api.js               # All Riot API calls + Data Dragon
App.jsx              # Root — switches between LookupPage and TrackerPage
index.css            # Global styles + design system CSS vars
main.jsx
components/
LookupPage.jsx     # Riot ID input + region picker
TrackerPage.jsx    # Loading state + header + renders ChampionGrid
ChampionGrid.jsx   # Sort/filter controls + champion card grid

## Known issues / future ideas
- Dev API key rate limits can slow down large match histories
- Could add: placement tracking (1st/2nd/etc per champ), augment history, export to image
- Could add: caching to localStorage so repeat lookups are instant