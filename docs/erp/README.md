# ERP Label Maison

Outil interne de gestion, servi sur `/erp` dans le même projet que le site
(Vite + React 18 + react-router 7 + Tailwind 4). Le cahier des charges complet
est dans [`SPEC.md`](./SPEC.md).

## Lancer en local

```bash
npm install
npm run dev
# puis http://localhost:5173/erp
```

En local, pas de mot de passe : le middleware Vercel ne tourne pas sous Vite.
Les données sont celles du jeu de démonstration (voir plus bas).

Vérifier les types de l'ERP :

```bash
npx tsc -p tsconfig.erp.json --noEmit
```

## Variables d'environnement

| Variable | Où | Rôle |
|---|---|---|
| `ERP_PASSWORD` | Vercel (Production + Preview) | Mot de passe de `/erp`. Absent : accès refusé (page 503), jamais ouvert. Redéployer après modification. |
| `LINGE_PASSWORD` | Vercel | Mot de passe du registre `/linge` (inchangé). |
| `VITE_SUPABASE_URL` | build | Active le mode `supabase`. Tant qu'il est absent, l'ERP reste en mode démo. |
| `VITE_SUPABASE_ANON_KEY` | build | Clé publique Supabase (à brancher avec le mode `supabase`). |

## Accès et déploiement

- `middleware.ts` protège `/erp` comme `/linge` : page de connexion à
  `/erp/connexion`, déconnexion à `/erp/deconnexion`, session dans un cookie
  signé `erp_session` (HMAC, 30 jours, `Path=/erp`). Les deux zones ont des
  mots de passe et des cookies distincts.
- `vercel.json` active `cleanUrls`, qui fait ignorer les rewrites : le
  middleware réécrit donc lui-même toute sous-route `/erp/...` (sans extension)
  vers `/erp/index.html`, coquille générée par `scripts/spa-shells.mjs`.
- `App.tsx` charge l'ERP en `React.lazy` : le site public ne télécharge jamais
  son code. Sous `/erp`, ni navigation, ni pied de page, ni intro animée.
- La page ERP pose `noindex, nofollow` et le titre « ERP · Label Maison ».

## Architecture

```
src/erp/
  ErpApp.tsx          provider, layout, routes des modules, 404
  erp.css             jetons de la charte (variables --lm-*), portée .erp-root
  data/
    types.ts          modèle (SPEC §3)
    constantes.ts     checklists, étapes du pipeline, seuils métier
    libelles.ts       libellés français de toutes les énumérations
    format.ts         euros, dates FR, pluriels, AUJOURDHUI (date figée)
    selectors.ts      indicateurs (SPEC §6) et règles métier (SPEC §2)
    store.tsx         ErpProvider + useErp() : état, mutations, journal
    seed*.ts          jeu de démonstration déterministe
  ui/                 kit de composants (Button, Table, Drawer, Stat...)
  layout/             barre latérale, en-tête, recherche, bandeau démo
  modules/
    registry.tsx      liste des modules : route, menu, groupe, composant
    <module>/index.tsx
supabase/migrations/  schéma Postgres miroir (schéma erp, RLS)
```

Règles de code : montants en centimes entiers, dates `YYYY-MM-DD`, jamais
`new Date()` pour « aujourd'hui » (utiliser `AUJOURDHUI`), tout texte visible
en français et sans tiret cadratin.

### Store

`useErp()` expose toutes les collections (`logements`, `reservations`,
`missions`...), `donnees` (l'ensemble, pour les sélecteurs), l'utilisateur
courant et des mutations. Les règles métier sont appliquées dans le store et
renvoient `{ ok: false, erreur }` quand elles bloquent :

- `validerMission` : checklist complète et photos avant/après ;
- `attribuerMission` : prestataire actif avec contrat, RC Pro et URSSAF valides ;
- `activerLogement` : mandat signé et checklist de lancement complète.

Chaque mutation ajoute une entrée au journal d'audit.

### Modules et routes

| Couche | Module | Route |
|---|---|---|
| Pilotage | Tableau de bord | `/erp` |
| Commercial | Pipeline & lancements | `/erp/commercial` |
| Référentiel | Propriétaires | `/erp/proprietaires` (`/:id`) |
| Référentiel | Mandats | `/erp/mandats` |
| Référentiel | Logements | `/erp/logements` (`/:id`) |
| Distribution | Réservations | `/erp/reservations` (`/:id`) |
| Relation voyageur | Messagerie | `/erp/messagerie` |
| Opérations | Ménages | `/erp/menages` |
| Opérations | Linge | `/erp/linge` |
| Opérations | Incidents | `/erp/incidents` |
| Prestataires | Prestataires | `/erp/prestataires` |
| Finance | Finance | `/erp/finance` |
| Conformité & admin | Conformité | `/erp/conformite` |
| Conformité & admin | Paramètres | `/erp/parametres` |

Chaque module est monté sur `<segment>/*` et gère ses sous-routes avec un
`<Routes>` relatif. La recherche globale renvoie vers `/erp/logements/:id`,
`/erp/proprietaires/:id` et `/erp/reservations/:id`.

## Démo ou réel

| | Aujourd'hui |
|---|---|
| Données | Jeu de démo réaliste (11 logements en Essonne et à Paris, réservations de juin à novembre 2026, missions, linge, factures...). Noms et adresses fictifs. Date de référence figée au 24 septembre 2026. |
| Persistance | Mémoire du navigateur + `localStorage` (clé `lm-erp-demo-v1`). « Réinitialiser » dans le bandeau recharge la démo. |
| Plateformes | Rien n'est envoyé à Airbnb, Booking ni Channex. |
| Supabase | Schéma prêt (`supabase/migrations/20260924000000_erp_schema.sql`). Le mode `supabase` est détecté mais retombe encore sur la démo (TODO dans `store.tsx`). |
| Utilisateurs | Sélecteur Abdel / Kamel pour la démo ; l'authentification réelle reste le mot de passe du middleware. |
