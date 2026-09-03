import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { createRiotProxyHandler } from './server/riotProxy.js'

function riotApiDevServer(riotApiKey) {
  return {
    name: 'riot-api-dev-server',
    configureServer(server) {
      const handler = createRiotProxyHandler({ riotApiKey })
      server.middlewares.use('/api/riot', handler)
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    // The VITE_ fallback only supports the existing local file during key rotation.
    // It is consumed by this server middleware and is never exposed to client code.
    plugins: [react(), tailwindcss(), riotApiDevServer(env.RIOT_API_KEY || env.VITE_RIOT_API_KEY)],
  }
})
