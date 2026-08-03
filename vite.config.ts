import { defineConfig, loadEnv, type Plugin } from 'vite'
import path from 'path'
import fs from 'fs'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

// Sert les fonctions serverless /api/*.ts pendant `npm run dev` (Vite seul ne
// les exécute pas — c'est Vercel qui le fait en prod). Sans ce plugin, tout
// POST /api/contact renvoie 404 en local. On charge aussi le .env pour que
// RESEND_API_KEY (et consorts) soient disponibles côté serveur de dev.
function devApiRoutes(): Plugin {
  return {
    name: 'dev-api-routes',
    configureServer(server) {
      const env = loadEnv('development', process.cwd(), '')
      for (const k of ['RESEND_API_KEY', 'CONTACT_TO_EMAIL', 'CONTACT_FROM_EMAIL']) {
        if (env[k] && !process.env[k]) process.env[k] = env[k]
      }
      server.middlewares.use('/api/contact', async (req, res) => {
        try {
          let raw = ''
          for await (const chunk of req) raw += chunk
          ;(req as unknown as { body: string }).body = raw
          const shim = {
            statusCode: 200,
            setHeader: (name: string, value: string) => res.setHeader(name, value),
            status(code: number) {
              this.statusCode = code
              return this
            },
            json(obj: unknown) {
              res.statusCode = this.statusCode
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(obj))
              return this
            },
          }
          const mod = await server.ssrLoadModule('/api/contact.ts')
          await mod.default(req, shim)
        } catch (err) {
          server.config.logger.error(`[dev-api] /api/contact a échoué: ${String(err)}`)
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: false, error: 'Erreur serveur de dev.' }))
        }
      })
    },
  }
}

// Applique les rewrites de vercel.json au serveur de dev (URLs propres/courtes
// -> fichiers .html statiques), pour que /sens, /dubai, /conciergerie-airbnb-massy…
// fonctionnent en local comme en production. On ignore le catch-all SPA (index.html).
function vercelDevRewrites(): Plugin {
  let rewrites: { source: string; destination: string }[] = []
  try {
    const cfg = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'vercel.json'), 'utf-8'))
    rewrites = (cfg.rewrites || []).filter(
      (r: { destination: string }) => r.destination && r.destination !== '/index.html',
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
    devApiRoutes(),
    vercelDevRewrites(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },
})
