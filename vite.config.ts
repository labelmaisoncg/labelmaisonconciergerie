import { defineConfig, loadEnv, type Plugin } from 'vite'
import path from 'path'
import fs from 'fs'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

// Sert les fonctions serverless /api/*.ts pendant `npm run dev` (Vite seul ne
// les exécute pas — c'est Vercel qui le fait en prod). Sans ce plugin, tout
// POST /api/contact (ou /api/studio-*) renvoie 404 en local. On charge aussi le
// .env pour que les clés (Resend, Stripe, moteur d'images…) soient disponibles
// côté serveur de dev.
const CLES_ENV = [
  'RESEND_API_KEY',
  'CONTACT_TO_EMAIL',
  'CONTACT_FROM_EMAIL',
  'STUDIO_SECRET',
  'STUDIO_GRATUIT_PAR_JOUR',
  'STUDIO_PRIX_UNIQUE_CENTIMES',
  'STUDIO_PRIX_TRIO_CENTIMES',
  'STUDIO_FAL_MODEL',
  'STUDIO_REPLICATE_MODEL',
  'STUDIO_GEMINI_MODEL',
  'FAL_KEY',
  'REPLICATE_API_TOKEN',
  'GEMINI_API_KEY',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_STUDIO_BUCKET',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
]

function devApiRoutes(): Plugin {
  return {
    name: 'dev-api-routes',
    configureServer(server) {
      const env = loadEnv('development', process.cwd(), '')
      for (const k of CLES_ENV) {
        if (env[k] && !process.env[k]) process.env[k] = env[k]
      }
      server.middlewares.use(async (req, res, next) => {
        const chemin = (req.url || '').split('?')[0]
        if (!chemin.startsWith('/api/')) return next()

        // Les modules techniques (préfixe « _ ») ne sont pas des routes, comme chez Vercel.
        const nom = chemin.slice('/api/'.length)
        if (!/^[a-z0-9-]+$/i.test(nom)) return next()
        const fichier = path.resolve(__dirname, 'api', nom + '.ts')
        if (!fs.existsSync(fichier)) return next()

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
          const mod = await server.ssrLoadModule('/api/' + nom + '.ts')
          await mod.default(req, shim)
        } catch (err) {
          server.config.logger.error(`[dev-api] /api/${nom} a échoué: ${String(err)}`)
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
  const publicDir = path.resolve(__dirname, 'public')
  return {
    name: 'vercel-dev-rewrites',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url) {
          const [pathname, query] = req.url.split('?')
          const clean = pathname.replace(/\/$/, '')
          let dest = map.get(clean)
          // Émule `cleanUrls: true` de Vercel : /ma-page -> public/ma-page.html.
          // Sans ça, les milliers de pages du silo national (qui n'ont pas de
          // rewrite dédié dans vercel.json) tomberaient sur le catch-all SPA en dev.
          if (!dest && clean && !path.extname(clean)) {
            // /ma-page -> public/ma-page.html, sinon /ma-page -> public/ma-page/index.html
            // (c'est la forme utilisée par /linge, page statique dans son propre dossier).
            for (const suffixe of ['.html', '/index.html']) {
              const candidat = path.join(publicDir, clean + suffixe)
              if (candidat.startsWith(publicDir) && fs.existsSync(candidat)) {
                dest = clean + suffixe
                break
              }
            }
          }
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
