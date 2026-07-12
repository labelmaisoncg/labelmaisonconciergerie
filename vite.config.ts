import { defineConfig, type Plugin } from 'vite'
import path from 'path'
import fs from 'fs'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

// Applique les rewrites de vercel.json au serveur de dev (URLs propres/courtes
// -> fichiers .html statiques), pour que /sens, /dubai, /conciergerie-airbnb-massy…
// fonctionnent en local comme en production. On ignore le catch-all SPA (index.html).
function vercelDevRewrites(): Plugin {
  let rewrites: { source: string; destination: string }[] = []
  try {
    const cfg = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'vercel.json'), 'utf-8'))
    rewrites = (cfg.rewrites || []).filter(
      (r: { destination: string }) => r.destination && !r.destination.includes('index.html'),
    )
  } catch {
    /* pas de vercel.json : on ne fait rien */
  }
  const map = new Map(rewrites.map((r) => [r.source.replace(/\/$/, ''), r.destination]))
  return {
    name: 'vercel-dev-rewrites',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url) {
          const [pathname, query] = req.url.split('?')
          const dest = map.get(pathname.replace(/\/$/, ''))
          if (dest) req.url = dest + (query ? '?' + query : '')
        }
        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
    vercelDevRewrites(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },
})
