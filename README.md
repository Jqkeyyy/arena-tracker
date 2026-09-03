# Arena Tracker

Track which League of Legends champions you have won with in Arena mode. The app reads current champion data from Riot Data Dragon and scans Arena queues 1700 and 1710.

## Security model

Riot API requests go through the included server-side `/api/riot` endpoint. The browser never receives the Riot API key. The endpoint validates every supported action, region, queue, and identifier; rejects cross-site browser requests; and applies a basic per-instance rate limit.

Never use a `VITE_` prefix for secrets. Vite exposes those variables to browser code.

## Local setup

1. Create a Riot API key at [developer.riotgames.com](https://developer.riotgames.com/).
2. Copy `.env.example` to `.env` and set `RIOT_API_KEY`.
3. Install and run the app:

   ```bash
   npm install
   npm run dev
   ```

4. Open <http://localhost:5173>.

Development keys expire every 24 hours. Use a registered production key before hosting a public deployment.

## Deploying on Vercel

1. Import the repository into Vercel.
2. Add `RIOT_API_KEY` as a server-side environment variable. Do not expose it to the browser.
3. Deploy. Vercel builds the Vite client and serves `api/riot.js` as a serverless function.

The included `vercel.json` adds a Content Security Policy and other browser security headers. For a high-traffic deployment, replace the in-memory endpoint limiter with a shared rate limiter such as a managed Redis service and request an appropriate Riot production key.

## Commands

```bash
npm run lint
npm test
npm run build
npm audit
```

## Data and privacy

The app stores scan results and manual wins in the visitor's browser `localStorage`. It does not include a database or analytics. Riot IDs and match identifiers pass through the serverless endpoint only to fulfill the visitor's Riot API request.

## Riot attribution

Arena Tracker is not endorsed by Riot Games and does not reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games and all associated properties are trademarks or registered trademarks of Riot Games, Inc.
