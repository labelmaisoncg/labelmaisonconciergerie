# ERP Label Maison

Outil **interne** de Label Maison Conciergerie, servi sur `/erp` dans le même
projet que le site (Vite + React 18 + react-router 7 + Tailwind 4). Le cahier
des charges complet est dans [`SPEC.md`](./SPEC.md).

Principes du fondateur, appliqués partout :

- l'ERP sert Label Maison ; une autre équipe (Sens…) peut y avoir son propre
  **espace**, aux données complètement séparées (voir « Espaces ») ;
- simple : un écran par question métier, pas de paramétrage superflu ;
- **tout ce qui peut être automatisé l'est** : le moteur d'automatisations fait
  le travail répétitif, les humains ne traitent que les exceptions (alertes) ;
- **une seule vue pour tout le monde** : pas de tableau de bord par personne.
  Chacun se connecte avec son propre compte ; son nom signe ses actions au
  journal.
- **données réelles** : en production, l'ERP lit et écrit dans la base
  Supabase de Label Maison. Le jeu de démonstration ne sert plus qu'au
  développement local.

## Lancer en local

```bash
npm install

# Démo (données fictives, rien n'est écrit dans la base) : développement,
# captures d'écran, recette des écrans.
VITE_ERP_DEMO=1 npm run dev
# puis http://localhost:5173/erp

# Données réelles : connexion avec un compte membre, écritures dans la base.
npm run dev
```

En local, pas de mot de passe de site : le middleware Vercel ne tourne pas
sous Vite. **Sans `VITE_ERP_DEMO=1`, l'ERP travaille sur les vraies données**
(écran de connexion Supabase). Les scripts de recette Playwright doivent donc
lancer le serveur avec `VITE_ERP_DEMO=1` (ou un build
`VITE_ERP_DEMO=1 npx vite build`), sauf pour tester les écrans de connexion.
En démo, une base vide se simule en posant dans `localStorage` la clé
`lm-erp-demo-v1` avec toutes les collections à `[]`.

Vérifications à faire passer avant toute livraison :

```bash
npx tsc -p tsconfig.erp.json --noEmit     # types de l'ERP
npm run build                             # build complet du site + ERP

# Auto-contrôle du moteur d'automatisations (idempotence sur le jeu de démo)
node_modules/.bin/esbuild src/erp/automatisations/verifier.ts --bundle \
  --platform=node --define:import.meta.env='{"VITE_ERP_DEMO":"1"}' \
  --log-level=error --outfile=/tmp/verifier.cjs && node /tmp/verifier.cjs

# Auto-contrôle de la synchronisation (fausse API Supabase en mémoire) :
# base vide, création / modification / suppression, travail du moteur,
# temps réel, échec réseau et file d'attente, base non installée.
node_modules/.bin/esbuild src/erp/data/verifier-synchro.ts --bundle \
  --platform=node --define:import.meta.env='{"VITE_ERP_DEMO":"1"}' \
  --log-level=error --outfile=/tmp/verifier-synchro.cjs && node /tmp/verifier-synchro.cjs

# Auto-contrôle de la synchronisation Repull (fausses API Repull et PostgREST) :
# formes conformes aux types, idempotence, saisies de l'équipe préservées,
# incrémental, limite du bouton, part d'appels, signature des webhooks.
node_modules/.bin/esbuild src/erp/data/verifier-repull.ts --bundle \
  --platform=node --define:import.meta.env='{"VITE_ERP_DEMO":"1"}' \
  --log-level=error --outfile=/tmp/verifier-repull.cjs && node /tmp/verifier-repull.cjs

# Auto-contrôle de l'agent IA (faux Claude, fausses API Repull, PostgREST et
# Telegram) : réponse, transmission, pause, horaires, dédoublonnage, codes
# cachés, part d'appels épuisée, reprise sans double envoi, relevé des messages.
node_modules/.bin/esbuild src/erp/data/verifier-agent.ts --bundle --format=esm \
  --platform=node --define:import.meta.env='{}' \
  --log-level=error --outfile=/tmp/verifier-agent.mjs && node /tmp/verifier-agent.mjs

# Auto-contrôle des notifications de l'app (vecteur officiel RFC 8291, signature
# VAPID, choix des notifications, problème signalé, idempotence, appareils
# expirés, envoi sans clés ou base en panne, surveillance d'un passage).
node_modules/.bin/esbuild src/erp/data/verifier-notifications.ts --bundle --format=esm \
  --platform=node --log-level=error --outfile=/tmp/verifier-notifications.mjs \
  && node /tmp/verifier-notifications.mjs

# Auto-contrôle des espaces (fausses API Supabase et Repull) : choix de
# l'espace, workspace Repull sur chaque appel, BaseErp avec ou sans espace,
# base pas encore préparée, vérification d'un membre, synchronisation du
# navigateur (filtres, clés, temps réel, file locale), plafond de l'agent.
node_modules/.bin/esbuild src/erp/data/verifier-espaces.ts --bundle --format=esm \
  --platform=node --define:import.meta.env='{}' \
  --log-level=error --outfile=/tmp/verifier-espaces.mjs && node /tmp/verifier-espaces.mjs

# Connexion à l'ERP (middleware.ts) : e-mail et mot de passe d'un membre,
# non-membre refusé, autre site refusé, anciens cookies (mot de passe commun)
# refusés, relais remis une fois, le serveur ne remet jamais la session du
# compte d'équipe, rien d'identifiant dans l'adresse, lien piégé confirmé,
# « Créer mon compte » (code gardé sur l'appareil, même réponse qu'un compte
# existe ou non, jamais de connexion depuis la création), activation par le
# code (compte créé avant par un autre : rien ; faux code, expiré, déjà
# servi : refus neutre ; mot de passe posé, autres sessions fermées),
# raison d'un refus (espace suspendu, invitation expirée), invitation
# d'espace activée laissée entrer.
node_modules/.bin/esbuild scripts/verifier-connexion-erp.ts --bundle --format=esm \
  --platform=node --log-level=error --outfile=/tmp/verifier-connexion-erp.mjs \
  && node /tmp/verifier-connexion-erp.mjs

# Même chose côté routes /api : compte serveur, réglages d'un espace, passage
# quotidien sur chaque espace, bouton d'un membre, routage des webhooks,
# connecteur Claude et agenda par espace (un jeton de Sens ne lit jamais
# Label Maison, et inversement), invitation « Créer mon compte », et les
# notifications de l'app « Opérations » (faux téléphones qui déchiffrent).
node_modules/.bin/esbuild scripts/verifier-espaces-serveur.ts --bundle --format=esm \
  --platform=node --define:import.meta.env='{}' \
  --log-level=error --outfile=/tmp/verifier-espaces-serveur.mjs && node /tmp/verifier-espaces-serveur.mjs

# Auto-contrôle de l'espace propriétaire : jamais le logement ou la réservation
# d'un autre, aucune donnée personnelle de voyageur, séjour à cheval sur deux
# mois, bilan non publié invisible, lien expiré ou réutilisé refusé, sessions.
node_modules/.bin/esbuild src/erp/data/verifier-proprietaire.ts --bundle --format=esm \
  --platform=node --define:import.meta.env='{"VITE_ERP_DEMO":"1"}' --log-level=error \
  --outfile=/tmp/verifier-proprietaire.mjs && node /tmp/verifier-proprietaire.mjs

# Auto-contrôle de l'espace opérations : urgences d'abord, contrôles après un
# départ, absences et remplaçants, périmètre (pôle / agent), « Prénom N. »,
# consignes d'accès le jour même, droits par rôle, collections écrites,
# « ce logement n'est pas à moi », invitation par espace, sessions par genre,
# notifications de l'app « Opérations » (qui reçoit quoi, téléphones liés à
# l'accès, une seule fois, rien sans clés ni en démonstration).
node_modules/.bin/esbuild src/erp/data/verifier-operations.ts --bundle --platform=node \
  --define:import.meta.env='{"VITE_ERP_DEMO":"1"}' --log-level=error \
  --outfile=/tmp/verifier-operations.cjs && node /tmp/verifier-operations.cjs

# Auto-contrôle des factures partagées et des relances de paiement.
node_modules/.bin/esbuild src/erp/data/verifier-relances.ts --bundle --format=esm \
  --platform=node --define:import.meta.env='{"VITE_ERP_DEMO":"1"}' --log-level=error \
  --outfile=/tmp/verifier-relances.mjs && node /tmp/verifier-relances.mjs

# Auto-contrôle des factures mensuelles (prolongations, commission, prorata,
# numérotation, TVA, identité de chaque espace, brouillon unique par mois).
node_modules/.bin/esbuild src/erp/data/verifier-factures.ts --bundle --format=esm \
  --platform=node --define:import.meta.env='{"VITE_ERP_DEMO":"1"}' --log-level=error \
  --outfile=/tmp/verifier-factures.mjs && node /tmp/verifier-factures.mjs

# Incidents côté ERP : un signalement de l'espace opérations remonte dans le
# « À faire » et sur la fiche du logement (lien de la notification « Urgence »),
# actions du gérant, « pas à moi », remplaçant qui suit déjà les logements.
node_modules/.bin/esbuild src/erp/data/verifier-incidents-erp.ts --bundle --format=esm \
  --platform=node --define:import.meta.env='{"VITE_ERP_DEMO":"1"}' --log-level=error \
  --outfile=/tmp/verifier-incidents-erp.mjs && node /tmp/verifier-incidents-erp.mjs

# Messages automatiques et avis à déposer (fausses base, plateforme et IA) :
# heures de Paris et changement d'heure, éteints par défaut, jamais avant 8 h
# ni après 21 h, jamais deux fois (même après une coupure), annulée / sans
# conversation écartées, codes seulement 48 h avant, plafond de l'IA.
node_modules/.bin/esbuild src/erp/data/verifier-messages-programmes.ts --bundle --format=esm \
  --platform=node --define:import.meta.env='{"VITE_ERP_DEMO":"1"}' --log-level=error \
  --outfile=/tmp/verifier-messages-programmes.mjs && node /tmp/verifier-messages-programmes.mjs

# Annonces à l'équipe : ce que chacun voit sur l'Accueil, « J'ai lu » sur
# l'appareil, « Bonjour » au nom de l'espace, écriture réservée au gérant,
# notification relue dans la base, jamais deux fois, refusée à un non-gérant.
node_modules/.bin/esbuild src/erp/data/verifier-annonces-equipe.ts --bundle --format=esm \
  --platform=node --define:import.meta.env='{"VITE_ERP_DEMO":"1"}' --log-level=error \
  --outfile=/tmp/verifier-annonces-equipe.mjs && node /tmp/verifier-annonces-equipe.mjs

# Avis des voyageurs : thèmes (français, anglais, négations), sentiment par la
# note, synthèse et tendance, lecture de l'IA qui n'invente rien, réponse
# simple, garde-fous (nom, téléphone, e-mail, adresse, code, lien, message
# privé, geste commercial), « Proposer une réponse » (IA absente, plafond,
# réponse écartée), compte en lecture refusé, rien publié sur la plateforme.
node_modules/.bin/esbuild src/erp/data/verifier-avis.ts --bundle --format=esm \
  --platform=node --define:import.meta.env='{"VITE_ERP_DEMO":"1"}' --log-level=error \
  --outfile=/tmp/verifier-avis.mjs && node /tmp/verifier-avis.mjs

# Briefing du matin : texte exact, aucun chiffre inventé, aucun nom dans la
# notification, mêmes nombres que « À faire », prix et factures au gérant
# seulement, fenêtre 7 h – midi à Paris, une fois par jour même à deux passages.
node_modules/.bin/esbuild src/erp/data/verifier-briefing.ts --bundle --format=esm \
  --platform=node --define:import.meta.env='{"VITE_ERP_DEMO":"1"}' --log-level=error \
  --outfile=/tmp/verifier-briefing.mjs && node /tmp/verifier-briefing.mjs

# Assistant CRM : propriétaire ou apporteur, score expliqué, file du jour,
# prochaine action, garde-fous des relances, fausse IA (plafond, rien d'envoyé).
node_modules/.bin/esbuild src/erp/data/verifier-crm-assistant.ts --bundle --format=esm \
  --platform=node --define:import.meta.env='{"VITE_ERP_DEMO":"1"}' --log-level=error \
  --outfile=/tmp/verifier-crm-assistant.mjs && node /tmp/verifier-crm-assistant.mjs

# Textes des annonces (A6) : limites d'Airbnb et de Booking.com, 3 titres et
# 1 description pour chaque logement de la démo, garde-fous (rien d'inventé,
# ni coordonnée, ni lien, ni code, ni adresse, ni nom), rédaction par l'IA
# relue (faux Claude, plafond du mois), aucune écriture d'annonce.
node_modules/.bin/esbuild src/erp/data/verifier-annonces.ts --bundle --format=esm \
  --platform=node --define:import.meta.env='{"VITE_ERP_DEMO":"1"}' --log-level=error \
  --outfile=/tmp/verifier-annonces.mjs && node /tmp/verifier-annonces.mjs

# Suppléments (B7) : réglages du gérant (et SQL), disponibilité sur les
# réservations et les ménages, textes, l'agent ne vend jamais seul un
# supplément (verdict et passage simulé), message automatique « Proposer les
# suppléments » (passage simulé), aucun paiement ni écriture vers les plateformes.
node_modules/.bin/esbuild src/erp/data/verifier-supplements.ts --bundle --format=esm \
  --platform=node --define:import.meta.env='{"VITE_ERP_DEMO":"1"}' --log-level=error \
  --outfile=/tmp/verifier-supplements.mjs && node /tmp/verifier-supplements.mjs

# Livret d'accueil et check-in en ligne (B2) : jeton signé lié au séjour et à
# l'espace, lien expiré ou séjour annulé, codes à l'identique de l'agent (48 h),
# codes courts sans le mot « code », jour du départ, rien de privé dans la vue,
# champs contrôlés, enfants sur la fiche d'un adulte, purge à 6 mois,
# {lien_sejour}, jamais pour l'IA, règles SQL. Côté routes : scripts/verifier-espaces-serveur.ts.
node_modules/.bin/esbuild src/erp/data/verifier-sejour.ts --bundle --format=esm \
  --platform=node --define:import.meta.env='{"VITE_ERP_DEMO":"1"}' --log-level=error \
  --outfile=/tmp/verifier-sejour.mjs && node /tmp/verifier-sejour.mjs
```

La base elle-même (règles RLS des deux passes de `supabase/erp-espaces.sql`)
se vérifie au moment de la lancer : le bilan affiche `recette = ok` (essai des
règles avec des comptes fictifs, annulé aussitôt).

Le vérificateur du moteur l'exécute deux fois sur la démo : la seconde passe
doit produire **0 changement**, le seed doit rester intact et les ids uniques.
Le vérificateur de synchronisation doit finir sur « 0 échec ».

## Variables d'environnement

| Variable | Où | Rôle |
|---|---|---|
| `ERP_PASSWORD` | Vercel, **Production ET Preview** (obligatoire) | Mot de passe du compte d'équipe `equipe@labelmaisoncg.fr` (fonctions serveur) et clé de signature des sessions de `/erp`. On n'entre plus dans l'ERP avec ce seul mot de passe : chacun se connecte avec son adresse e-mail et son mot de passe. Absent : accès refusé (page 503), jamais ouvert. Le changer déconnecte tout le monde. Redéployer après modification. Une fois les comptes personnels créés, le remplacer par un nouveau mot de passe aléatoire (ici et sur le compte d'équipe dans Supabase) : voir « Connexion à l'ERP ». |
| `ERP_SERVEUR_MOT_DE_PASSE` | Vercel (serveur), facultatif tant qu'il n'y a que Label Maison | Mot de passe du compte technique `serveur@labelmaisoncg.fr` (voir « Espaces »). Absent : le serveur écrit avec le compte d'équipe, dans Label Maison seulement. |
| `LINGE_PASSWORD` | Vercel | Mot de passe du registre `/linge` (inchangé). |
| `VITE_SUPABASE_URL` | build (Vercel), facultatif | Adresse du projet Supabase. Absente : celle de Label Maison, inscrite dans `src/erp/data/config.ts`. |
| `VITE_SUPABASE_ANON_KEY` | build (Vercel), facultatif | Clé publique (« anon ») du même projet. Les deux vont ensemble : si l'une manque, le couple par défaut est utilisé. |
| `VITE_ERP_DEMO` | local uniquement | `1` : jeu de démonstration en mémoire. **Jamais en production.** |
| `VITE_ERP_APERCU_NOTIFICATIONS` | local uniquement | `1` (avec la démo) : affiche la demande « Recevoir les notifications ? » pour les captures d'écran. **Jamais en production.** |
| `REPULL_API_KEY` | Vercel (serveur), obligatoire pour la synchronisation | Clé API Repull (`sk_live_...`). Voir « Synchronisation Repull ». |
| `REPULL_WORKSPACE_LM` | Vercel (serveur), facultative (recommandée dès qu'il y a plusieurs espaces) | Workspace Repull de Label Maison : envoyé en `X-Workspace-Id` sur chacun de ses appels (lecture et réponses aux voyageurs, rien de plus), et ses événements de webhook reconnus ; un workspace inconnu est alors ignoré. Obligatoire avant de déclarer un workspace du compte de Label Maison pour un autre espace. Absente : comme avant. Voir `espaces-mise-en-service.md`, étape 5. |
| `CRON_SECRET` | Vercel (serveur) | Secret du cron quotidien de synchronisation (Vercel l'envoie en `Authorization: Bearer`). |
| `REPULL_WEBHOOK_SECRET_ERP` | Vercel (serveur), facultatif | Secret de signature (`whsec_...`) de l'abonnement webhook **de l'ERP** (distinct de celui de l'agent IA). |
| `REPULL_BUDGET_ERP` | Vercel (serveur), facultatif | Part mensuelle des appels Repull réservée à l'ERP (défaut 400). |
| `REPULL_QUOTA_MOIS` | Vercel (serveur), facultatif | Quota mensuel du compte Repull, pour l'affichage (défaut 1000, offre gratuite). |
| `ANTHROPIC_API_KEY` | Vercel (serveur) | Agent IA de la messagerie (`api/erp-agent.ts`), jamais côté navigateur. Absente : l'agent ne répond pas. |
| `AGENT_MODELE` | Vercel (serveur), facultatif | Modèle des réponses aux voyageurs (défaut `claude-haiku-4-5-20251001`). |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Vercel (serveur), facultatifs | Alertes Telegram de l'agent (transmissions, copies des réponses, relances). |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Vercel (serveur), facultatives | Clés des notifications de l'app (Web Push). Générées par le gérant dans Paramètres → Application → Avancé, montrées une seule fois. Absentes : tout marche, sans notifications. Redéployer après ajout. |
| `VAPID_SUBJECT` | Vercel (serveur), facultative | Contact des services de notifications (`https://` ou `mailto:`). Défaut `https://www.labelmaisoncg.fr`. |
| `PROPRIETAIRE_SECRET` | Vercel (serveur), **Production et Preview** | Signature des sessions de l'espace propriétaire (`/espace-proprietaire`), 32 caractères au moins (ex. `openssl rand -base64 48`). Absente : l'espace reste fermé et la fiche logement le dit au gérant. La changer déconnecte tous les propriétaires. Redéployer après ajout. |
| `ACCES_SECRET` (ou `OPERATIONS_SECRET`) | Vercel (serveur), **Production et Preview** | Sessions de l'espace opérations (`/espace-operations`), 32 caractères au moins. Une seule variable `ACCES_SECRET` suffit pour les deux espaces (propriétaire et opérations) : le genre est signé dans la session, un cookie propriétaire ne vaut pas pour les opérations. `OPERATIONS_SECRET` passe avant si elle existe. Absente : l'espace opérations reste fermé et « Inviter » (Paramètres → Accès) dit ce qu'il manque. Sans `SEJOUR_SECRET`, `ACCES_SECRET` signe aussi les liens du livret d'accueil des séjours (`/sejour`, signature à part) : sans l'une ni l'autre, pas de lien (la ligne `{Lien du livret}` des messages est retirée). La changer coupe alors aussi les liens de séjour déjà envoyés. Redéployer après ajout. |
| `SEJOUR_SECRET` (facultative) | Vercel (serveur), **Production et Preview** | Secret propre aux liens du livret d'accueil (`/sejour`), 32 caractères au moins (`openssl rand -base64 48`). **Rien à faire si elle est absente** : `ACCES_SECRET` signe les liens. La poser (ou la changer) coupe tous les liens de séjour déjà envoyés, sans toucher aux sessions des espaces propriétaire et opérations. Posée mais trop courte : aucun lien (jamais de repli discret sur `ACCES_SECRET`), la carte de la réservation le dit. Redéployer après ajout. |
| `RESEND_API_KEY`, `CONTACT_FROM_EMAIL` | Vercel (serveur), facultatives | Envoi des liens de connexion aux propriétaires et des invitations « Créer mon compte » de l'équipe (mêmes variables que le formulaire de contact ; un autre espace envoie seulement avec son propre expéditeur). Sans : le gérant copie le lien et l'envoie par SMS ou WhatsApp. |
| `SITE_URL` | Vercel (serveur), facultative | Site des liens envoyés (invitations, « Recevoir mon lien », relances), origine `https://` seulement. Défaut `https://www.labelmaisoncg.fr`. Les liens ne prennent **jamais** l'adresse de la page qui appelle (en-tête Origin ou Host). |
| `ORIGINES_APERCU` | Vercel (serveur), facultative | Aperçus Vercel autorisés à appeler les formulaires et les espaces extérieurs : origines **exactes**, séparées par des virgules (`https://mon-apercu.vercel.app`). Sans : seuls `labelmaisoncg.fr`, `labelmaisoncgexperience.fr` (avec ou sans `www`) et, hors Vercel en ligne, `localhost`. |

## Accès et déploiement

- `middleware.ts` protège `/erp` comme `/linge` : page de connexion à
  `/erp/connexion`, déconnexion à `/erp/deconnexion`, session dans un cookie
  signé `erp_session` (HMAC, 30 jours, `Path=/erp`). Les deux zones ont des
  mots de passe et des cookies distincts. C'est une **première barrière** :
  derrière, chaque membre se connecte à l'ERP avec son compte Supabase
  (e-mail + mot de passe) et la base applique ses droits (RLS). La page du
  middleware garde les jetons d'un lien « mot de passe oublié » (partie `#`
  de l'adresse) pour les transmettre à l'ERP.
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
    store.tsx         ErpProvider + useErp() : état, mutations, journal, moteur,
                      connexion (production) ou démo locale
    config.ts         mode (réel / démo), projet Supabase, clés localStorage
    supabase.ts       client Supabase, connexion, espaces et membres, fichiers, erreurs
    espaces.ts        espaces (Label Maison, Sens…) : identifiants, choix, en-tête,
                      base « historique » (avant supabase/erp-espaces.sql)
    synchro.ts        lecture de la base, écriture par différence, file
                      d'attente, temps réel, état des automatisations
    collections.ts    liste des collections, jeu vide
    verifier-synchro.ts  auto-contrôle de la synchronisation (Node)
    verifier-espaces.ts  auto-contrôle des espaces (Node)
    repull.ts         Repull → ERP : conversion et fusion (fonctions pures)
    repull-synchro.ts synchronisation Repull côté serveur (appels, base, budget)
    repull-signature.ts  vérification de X-Repull-Signature (webhooks)
    verifier-repull.ts   auto-contrôle de la synchronisation Repull (Node)
    seed*.ts          jeu de démonstration déterministe (chargé seulement en démo)
  automatisations/    moteur pur (sans React) + une règle par automatisation
  analyse/            analyse des biens (SPEC §10), moteur pur
  ui/                 kit de composants (Button, Table, Drawer, Stat...)
  layout/             barre latérale, en-tête, recherche, connexion (Connexion.tsx),
                      état d'enregistrement (EtatSynchro.tsx), bandeau démo
  modules/
    registry.tsx      liste des modules : route, menu, groupe, composant
    <module>/index.tsx
api/erp-repull-sync.ts     synchronisation Repull (cron quotidien, bouton)
api/erp-repull-webhook.ts  webhooks Repull de l'ERP (quand l'offre les inclut)
api/_erp-espaces.ts        réglages d'un espace, espaces actifs, espace d'un jeton (espaceOuvertAuJeton)
api/erp-invitation.ts      « Envoyer l'invitation » (lien « Créer mon compte », src/erp/data/invitation.ts)
supabase/erp-installation.sql  installation de la base (à coller dans le SQL Editor)
supabase/erp-espaces.sql   espaces séparés, en deux passes (après l'installation)
supabase/migrations/  schéma normalisé : cible future, NON appliquée (voir son README)
```

Règles de code : montants en centimes entiers, dates `YYYY-MM-DD`, jamais
`new Date()` pour « aujourd'hui » (utiliser `AUJOURDHUI`), tout texte visible
en français et sans tiret cadratin.

### Store

`useErp()` expose toutes les collections (`logements`, `reservations`,
`missions`...), `donnees` (l'ensemble, pour les sélecteurs), le membre
connecté (`utilisateur`, nom et rôle lus dans `erp.membres`), l'état
d'enregistrement (`synchro`) et des mutations, synchrones comme avant :
`upsert`, `remove`, `mettreAJour(collection, id, patch)` (à partir de la
version la plus récente, utile après une attente comme un envoi de photo) et
les actions métier. Les règles métier sont appliquées dans le store et
renvoient `{ ok: false, erreur }` quand elles bloquent :

- `validerMission` : checklist complète et photos avant/après ;
- `refuserMission(id, commentaire)` : motif obligatoire, statut « refusée »
  (la mission n'est pas payée) ;
- `attribuerMission` : prestataire actif avec contrat, RC Pro et URSSAF valides ;
- `activerLogement` : mandat signé et checklist de lancement complète ;
- `resoudreIncident` puis `marquerIncidentRecupere` : un incident refacturable
  résolu reste « à récupérer » tant que la somme n'est pas encaissée
  (`recupereLe`).

Chaque mutation ajoute une entrée au journal d'audit, puis le moteur
d'automatisations repasse sur les données (il tourne aussi au chargement).

### Modules et routes

**Channel manager (octobre 2026)** : six rubriques dans la barre latérale,
Paramètres en bas. Sur téléphone et tablette (sous 1024 px), une barre
d'onglets en bas remplace la barre latérale, comme une app : Accueil,
Logements, Réservations, Messages, CRM, avec les compteurs en pastille
(`layout/BarreOnglets.tsx`) ; Paramètres est dans le menu du compte (avatar,
en haut à droite) ; une conversation ouverte prend tout l'écran, sans la
barre. Le contenu réserve sa hauteur (`--lm-barre-onglets`, `erp.css`), et
les barres « Enregistrer » collées en bas se posent au-dessus. Finance, Opérations (ménages, linge, incidents,
prestataires), Rentabilité, Annonces et la rubrique Propriétaires sont sortis
du menu sur décision du gérant : leur code et leurs données restent (ménages et
linge reviendront avec BNB Cleaning), leurs anciennes adresses mènent vers la
page la plus proche (`ANCIENNES_ADRESSES`, `modules/registry.tsx`), et leurs
automatisations ne tournent plus (`REGLES_CHANNEL_MANAGER`, `data/store.tsx` :
seules `activation-logement`, `plafond-120-nuits` et `messages-en-attente`).

| Rubrique | Contenu | Routes |
|---|---|---|
| Accueil | « Votre journée » (briefing du matin : arrivées, départs, logements occupés ce soir, puis « À faire » : voyageurs qui attendent, synchronisation en échec, avis, infos manquantes pour l'agent, contacts à appeler, alertes, et pour le gérant prix à revoir et factures à valider), arrivées / départs / sur place (cette semaine, ou une période choisie au calendrier : `ChoixPeriode.tsx`), 4 repères sur 30 jours (occupation, revenu versé par les plateformes, prix moyen par nuit, note), 2 courbes (revenu par mois sur 12 mois, occupation par semaine) | `/erp` |
| Logements | Cartes (photo, prochain événement, prix par nuit ou occupation, note) ; fiche en 3 onglets : Aperçu (galerie, 3 repères, prochains séjours, avis des voyageurs (thèmes, réponse proposée à copier), l'annonce et « Nouveaux textes » à copier, couchage, prix des prochaines semaines et prix de base lus sur les plateformes, propriétaire, logement, conditions, suppléments, plateformes, Administratif), Infos pour l'agent (ce que lit l'agent IA), Historique (séjours et journal) ; Avis (tout le parc) ; Connexions | `/erp/logements` (`/:id?onglet=fiche\|historique`, `/avis`, `/connexions`) |
| Réservations | Planning (2 semaines ou 30 jours, prix des nuits libres), Séjours (À venir · En cours · Passés · Annulés), fiche d'un séjour, réservation directe | `/erp/reservations` (`?vue=liste`, `?q=`, `/:id`) |
| Messagerie | Conversations (filtres À répondre · Toutes · Terminées, « Pas besoin de répondre ») · Activité · Votre agent | `/erp/messagerie` (`/:filId`, `?q=`), `/activite`, `/agent` |
| CRM | « Aujourd’hui » (file priorisée de l'assistant CRM, prochaine action, brouillon de relance) · « Tous les contacts » (grille sur ordinateur, cartes par étape sur téléphone), dossier propriétaire, agenda, connecteur Claude | `/erp/crm` (`?vue=tous`, `?contact=`, `?relance=`) |
| Paramètres | Équipe, Plateformes (synchronisation), Application (installer l'app, lien pour l'équipe, notifications de l'appareil), Annonces à l'équipe (gérant), Société (identité et sauvegarde) | `/erp/parametres` (`/plateformes`, `/application`, `/annonces-equipe`, `/societe`) |

Hors menu mais ouverte depuis la fiche logement : la fiche d'un propriétaire
(`/erp/proprietaires/:id`). Graphiques : `ui/Graphiques.tsx` (recharts, importé
directement, hors du lot commun) ; choix court : `ui/Segmente.tsx`.

**Annonce complète** (`phaseAnnonces`, `versDescriptif`, `data/repull.ts`) : les
pages `GET /v1/listings` sont lues avec
`include=content,details,thumbnail,photos,rooms,policies,rules,pricing,fees` (un
appel par page pour tous les logements ; repli sur `content,details,thumbnail`
si Repull répond 422). Photos dans l'ordre de l'annonce (https, 24 au plus) et
`Logement.descriptif` : titre, textes (bornés à 1 500 caractères), couchage
pièce par pièce, conditions (animaux, fumer, fêtes, enfants, calme, annulation,
arrivée), durée de séjour, prix de base et autres frais. Chaque partie n'est
remplacée que si l'annonce la renvoie. Affiché dans l'Aperçu de la fiche
logement ; l'agent reçoit couchage, conditions et textes (jamais les prix, qui
varient). Relevé une fois par jour, ou au bouton « Synchroniser » si le dernier
date de plus d'une heure.

**Photos et prix par nuit** (`enrichirAnnonce`, `data/repull-synchro.ts`), pour
chaque logement choisi, en lecture seule (GET) :
- photos : celles de l'annonce si la liste les renvoie ; sinon `GET
  /v1/listings/{id}/photos`, puis Booking.com (`/v1/channels/booking/content?type=photos`,
  galerie de la chambre puis de l'établissement), puis Airbnb, et en dernier recours la
  page publique de l'annonce Airbnb (`data/page-airbnb.ts` : `https://www.airbnb.fr/rooms/<id>`,
  GET sans cookie, 8 s et 3 Mo au plus, seules les photos `Hosting-<id>` du logement, hors
  budget d'appels ; elle complète aussi capacité, chambres et lits restés vides ou à 0, et
  sert aussi aux logements en pause). Booking.com protège sa page publique : pas lue. Relues une fois par
  semaine quand le logement en a déjà ; sans photo, au prochain relevé, puis une
  recherche vaine n'est refaite qu'une fois par jour ; sans note de lecture (relevés
  d'avant), tout de suite ;
- prix : `GET /v1/availability/{id}?from&to` (60 jours, réécrits seulement s'ils
  changent), sinon les tarifs Booking.com (`/v1/channels/booking/listings/{id}/pricing`).

Chaque logement garde une **note de lecture** (`repull.lecture` : source des photos et
des prix, raison en clair d'un manque, date du dernier changement). La fiche logement
l'affiche à la place de la galerie quand il n'y a pas de photo, avec « Mettre à jour ».
Un relevé qui laisse un logement choisi sans photo ou sans prix marque l'état
(`annoncesIncompletes`) : le bouton « Synchroniser » relit alors les annonces sans
attendre l'heure habituelle (toujours au plus une fois par 10 min). Lectures sautées
quand la part d'appels descend sous 20 ; rien n'est jamais renvoyé aux plateformes.

**Annonces uniquement Booking.com** : la connexion « Booking.com Extranet » de Repull
ne lit que réservations et messages (ni photos, ni contenu, ni tarifs). Dans la fiche
logement, l'équipe peut donc :
- **ajouter le lien de l'annonce Airbnb** du même logement (`extraireIdAirbnb`,
  `data/page-airbnb.ts` : airbnb.fr, .com…, `/rooms/<id>`) : enregistré dans
  `annonces` (canal airbnb, `connecte: false`, « Lien ajouté » dans Plateformes, retirable) ;
  ses photos sont lues sur la page publique au prochain relevé (« Mettre à jour ») ;
- **ajouter ses photos** (`photosEquipe`, `stockage://erp-fichiers/logements/<id>/photos/…`,
  liens signés à l'affichage) : elles passent avant celles des plateformes, la première
  sert de couverture (« Vos photos » : mettre en couverture, retirer), et aucune
  synchronisation ne les touche.

**Cartes des logements** (`CarteLogement.tsx`) : comme une annonce Airbnb, photo
arrondie sans cadre, nom et note, ville · type · voyageurs, prochain événement,
« 165 € par nuit » (ce soir, sinon la prochaine nuit connue, sinon le prix de base,
sinon « 95 € par nuit · moyenne constatée » : le prix moyen encaissé par nuit sur les
séjours des 90 derniers jours, hors ménage ;
rien pour un logement qui n'est pas en location). Sans photo, ou si elle ne se charge
pas, un aplat neutre (`Visuel.tsx`), jamais une fausse photo.

Principes d'écran : 3 ou 4 blocs visibles au plus, une action principale, les
actions secondaires dans un menu « … » (`ui/MenuActions.tsx`), les règles et
explications repliées (« Comment ça marche ? », `ui/Aide.tsx`), le détail au
clic (panneau, fenêtre). Langage : phrases courtes, vouvoiement, pas de jargon
(« transmise à l'équipe » plutôt qu'« escaladée », « mandat de gestion »
plutôt que « contrat de gestion »...).

**Recherche globale** (`layout/GlobalSearch.tsx`, moteur pur dans
`layout/recherche/moteur.ts`) : barre de l'en-tête, Ctrl/Cmd + K ou « / ».
Cherche dans toutes les collections (logements, propriétaires, réservations
et codes Airbnb/Booking, conversations, ménages, prestataires, incidents,
factures, contrats, prospects, historique), sans accents ni casse, mot par
mot (« dupont evry »), avec les dates (« 12/10 », « octobre »), montants
(« 150 € ») et téléphones. Résultats groupés et classés (identique > début >
contenu, réservations proches d'aujourd'hui d'abord), 5 par groupe,
« Voir tout » ouvre la liste filtrée (`?q=`, lu par `ui/useRechercheUrl.ts`).
Actions rapides et « Aller à… » chaque page ; recherches récentes dans le
navigateur (localStorage). Plein écran sur mobile.

### Réglages de l'agent de messagerie

« Messagerie > Votre agent » enregistre un élément unique
dans la collection **`reglages`** (id `agent`, type `ReglagesAgent` dans
`data/types.ts`, valeurs par défaut et lecture tolérante dans
`data/reglages.ts`). Il est synchronisé comme les autres collections : une
ligne de `erp.enregistrements` avec `collection = 'reglages'`,
`id = 'agent'`, contenu JSON dans `donnees` (pas de migration). Champs :
`actif`, `ton` (`chaleureux` | `professionnel` | `decontracte`), `langues`,
`signature`, `horaires` (`toujours` ou plage `debut`–`fin`, heure de Paris),
`transmettre` (`horsFiche`, `derogations`, `sejoursLongs`,
`sejoursLongsNuits` ; argent et litiges sont toujours transmis),
`delaiAlerteMinutes`, `telegram`, `majLe`, `majPar`.

L'agent du site (`src/erp/data/agent-messagerie.ts`, voir « Messagerie et
agent IA ») relit ce réglage à chaque passage : pas de réponse si
`actif = false` ou hors `horaires`, `ton`, `langues` et `signature`
appliqués, main passée selon `transmettre`, relance Telegram après
`delaiAlerteMinutes` sans réponse humaine. Absent : valeurs par défaut de
`data/reglages.ts`. (L'ancien service `agent-ia/` n'est pas déployé.)

### Messages automatiques et avis à déposer

« Messagerie > Messages automatiques » (gérant) : cinq messages
(`confirmation`, `proposer_supplements`, `veille_arrivee`, `jour_depart`,
`demande_avis`), **éteints par défaut**, enregistrés dans `reglages` (id `messages-programmes`, texte de
l'espace et texte propre à un logement). Le passage planifié de l'agent
(`api/erp-agent.ts` → `api/_erp-programmes.ts` →
`src/erp/data/passage-programmes.ts`) envoie ce qui est dû par
`envoyerMessage`, entre 8 h et 21 h (Paris), avec une clé d'idempotence
par séjour et par moment ; chaque envoi ou refus est une ligne de
`envoisProgrammes` (historique de l'écran, garantie « jamais deux fois »).
Rien ne part à un voyageur qui attend l'équipe : dernier message de sa part,
ou conversation transmise / en attente (`attendEquipe`,
`src/erp/data/attente-equipe.ts`, la même règle que « À répondre » et
l'Accueil). Règles pures : `src/erp/data/messages-programmes.ts`.

Après chaque départ Airbnb, le même passage prépare l'avis à déposer sur le
voyageur (`avisADeposer`) avec la clé et le modèle de l'agent (plafond
mensuel partagé pour un autre espace), ou un texte simple sans IA. Il
apparaît dans « À faire » et sur la réservation : « Copier le texte »,
« Ouvrir Airbnb » (simple lien, rien n'est publié), « C’est fait » ou
« Passer ». Incident, note sous 4 ou message négatif : « à relire », et
jamais d'éloge prérempli : l'IA en est informée (avis neutre), un éloge est
écarté, le texte simple n'est jamais proposé ; sans texte sûr, le champ
reste vide avec une ligne « Écrivez l’avis vous-même : … ».

Garanties dans la base (`supabase/erp-espaces.sql`, à relancer en passe 1
ou 2 ; même règle avant les espaces dans `erp-installation.sql` et
`erp-acces-gerants.sql`) : écriture réservée aux gérants de l'espace (et au
compte serveur) pour `envoisProgrammes`, `programmes`, `agent`, `repull`,
`factures`, `passagesFacturesMensuelles`, `annoncesEquipe`, `conseilsPrix` (`reglages`,
`etat`) et `reglages` (`messages-programmes`, `societe`,
`numerotation-factures`, `alerte-controle-agent`, `supplements`) ; dans les réglages de
l'agent, marche, niveau d'autonomie, horaires, ce qu'il confie et délai
changés par un gérant seulement (déclencheur `erp.garder_autonomie_agent`,
liste `REGLAGES_AGENT_GERANT` ; ton, signature, langues et Telegram restent
à l'équipe) ; numéro de facture
attribué par `erp.numeroter_facture(p_id)` seulement (à la suite, jamais
deux fois ; toute autre écriture d'un numéro est refusée, code `LMF02`, et
un index unique par espace l'interdit en double, numéros comparés sans
blancs autour : `erp.numero_normalise`) ; une facture numérotée ne
change plus, sauf paiement et partage, et ne se supprime pas (code
`LMF01`) ; une donnée ne change jamais d'espace par l'API
(`erp.garder_espace_enregistrement`, 42501). Copie des listes dans le navigateur : `ecritures-gerant.ts` (un
compte qui n'est pas gérant ne met pas ces écritures en file ;
`verifier-synchro.ts` compare les listes aux fichiers SQL). Toute écriture
refusée par la base (droits, règle RLS, déclencheur) est renvoyée ligne par
ligne : les acceptées sont gardées, les refusées retirées de la file sans
nouvel essai, signalées une fois (message et ligne de journal) et relues ;
réseau et 5xx : nouvel essai comme avant (`synchro.ts`, `refusParLaBase`).

L'onglet « Activité » est calculé depuis `filsMessages` :
messages `auteur = 'agent'`, conversations `statut = 'escalade'` (raison :
`raisonEscalade`, sinon déduite des messages), conversations qui attendent
un humain.

Sur chaque logement, deux chiffres sont visibles partout où il apparaît
(liste en cartes et en tableau, en-tête de la fiche logement, fiche
propriétaire) : la **commission** du mandat (« sous la cible » sous 18 %,
« Pas de mandat » sinon) et la **rentabilité pour Label Maison** (marge par
mois sur 90 jours, même calcul que `/erp/performance`). Composants dans
`modules/logements/_composants/EconomieBien.tsx`.

Chaque module est monté sur `<segment>/*` et gère ses sous-routes avec un
`<Routes>` relatif.

### Avis des voyageurs : analyse et réponses (A8)

Calculé à la volée, sans IA et sans table de plus (`src/erp/data/avis.ts`) :
les avis sont ceux que la synchronisation range sur les réservations
(`noteVoyageur`, `commentaireVoyageur` : avis public puis « Message privé :
… », séparés par `separerAvis`), sur les 12 derniers mois (fin du séjour),
séjours annulés exclus.

- **Lecture d'un avis** (`lireAvis`) : thèmes repérés par mots-clés français
  et anglais, proposition par proposition (propreté, calme et bruit, arrivée
  et clés, literie, équipements, emplacement, accueil et échanges, rapport
  qualité-prix, fidèle à l'annonce), avec leur sens : un mot qui dit le sens
  (« propre », « bruyant ») ou un mot général (« parfait », « problème »)
  rattaché au thème le plus proche ; les négations l'inversent (« pas
  propre », « aucun bruit », « ne fonctionnait pas » ; pas « un peu bruyant »,
  « sans doute » ni « bien plus »). Sentiment : la note d'abord (sous 4 :
  négatif ; de 4 à 4,5 : mitigé), puis les mots. Les thèmes du message privé
  sont comptés pour l'équipe, marqués « privé », et jamais repris dans une
  réponse.
- **Synthèse** (`syntheseAvis`, `analyseParc`) : nombre d'avis, note
  moyenne, tendance (les 5 derniers avis notés contre ceux d'avant, 3 au
  moins ; hausse ou baisse à partir de 0,2), thèmes et fréquence (un avis
  compte une fois par thème), avis à lire en premier (négatifs, puis mitigés,
  les plus récents d'abord). Logements sortis hors du parc.
- **Où** : carte « Avis des voyageurs » dans l'Aperçu de la fiche logement
  (3 thèmes, les autres à la demande ; la note moyenne est déjà dans les
  repères du haut) ; vue d'ensemble dans **Logements → Avis**
  (`/erp/logements/avis`, onglets « Tous · Avis » de la rubrique, sans
  entrée de menu de plus) : repères, avis à lire, ce qui revient, tableau
  par logement (note, à revoir, points forts, tendance) ; « Votre réponse »
  aussi sous l'avis d'un séjour (« Avis laissé par le voyageur », à côté de
  « Votre avis sur le voyageur » de B5). Tout membre voit l'analyse.
- **Réponse proposée** (gérant et opérations ; un compte en lecture ne la
  génère pas, et la route le refuse ; rien pour un séjour direct, qui n'a
  pas de page d'avis publique : `sansReponse`) : « Proposer une réponse »
  (même verbe que la Messagerie) →
  `POST /api/erp-agent` `{ action: 'reponse_avis', reservationId }`
  (`api/_erp-avis.ts` → `src/erp/data/avis-serveur.ts`, sans appel à Repull
  ni clé Repull exigée ; erreurs en français simple). L'IA ne reçoit que
  l'avis public (sans e-mail, téléphone ni lien : `textePourIA`, même règle
  de masquage que les relances du CRM, `data/masquage.ts`), le prénom, la
  note et les thèmes repérés ; consignes : vouvoiement, chaleureux,
  remercier, répondre au point négatif sans se justifier longuement, aucune
  promesse. Sa réponse
  est contrôlée (`problemesReponse`) : nom de famille, téléphone, e-mail,
  adresse, code ou wifi, lien, message privé, geste commercial ou
  remboursement → écartée, remplacée par le texte simple (`reponseModele`),
  qui sert aussi sans clé, au plafond du mois et en démonstration. Chaque
  appel compte dans le plafond mensuel de l'espace, et chaque membre a au
  plus 20 demandes par quart d'heure (« Trop de demandes d’un coup :
  réessayez dans quelques minutes. », 429). La réponse se modifie,
  puis **« Copier le texte »** (« Nouvelle proposition » demande
  confirmation si le texte a été retouché) ; « Ouvrir Airbnb » / « Ouvrir
  Booking.com » sont de
  simples liens : **l'ERP ne publie jamais une réponse d'avis**.
- **L'IA affine sans inventer** : sa lecture (sentiment, sens des thèmes
  déjà repérés) est gardée sur la réservation (`lectureAvis`, écriture
  conditionnelle) et ne vaut que pour le texte lu (empreinte) ; elle n'ajoute
  jamais de thème et ne contredit pas la note. Comme elle a lu le texte du
  voyageur, elle peut rendre la lecture plus sévère, jamais plus indulgente
  que les mots-clés : un avis ne sort pas seul de « à lire », un point
  négatif ne s'efface ni ne s'adoucit, et pas « négatif » contre une note de
  4,6 ou plus (au plus « mitigé »). Les chiffres sont toujours comptés par
  le code.

## Automatisations

Moteur dans `src/erp/automatisations/` : chaque règle est **pure** (aucune date
système) et **idempotente** (ids déterministes, existence vérifiée avant toute
création). Le moteur boucle jusqu'au point fixe (3 passes au plus), journalise
chaque changement sous l'auteur « Automatisation » et produit des événements
(info, action, alerte) dédoublonnés par id. Chaque règle peut être coupée
depuis `/erp/automatisations` ; une règle rallumée rattrape aussitôt son retard.

Catalogue (`REGLES`, dans l'ordre d'exécution) :

| Domaine | Règle (clé) | Déclencheur | Réf. | Ce qu'elle fait |
|---|---|---|---|---|
| Référentiel | Mise en ligne des logements prêts (`activation-logement`) | logement | §2.1 | Logement en lancement avec mandat signé et checklist complète : passe « actif ». |
| Réservations | Ménage créé à chaque départ (`menage-au-depart`) | réservation | §2.4 | Mission de ménage le jour du départ, entre l'heure de départ et l'arrivée suivante, checklist type. |
| Réservations | Ménage annulé avec la réservation (`menage-annulation`) | réservation | §2.4 | Réservation annulée : ménage non commencé annulé, prestataire libéré. |
| Opérations | Attribution automatique (`attribution-auto`) | mission | §2.3 | Ménage à attribuer confié au meilleur prestataire conforme qui couvre la ville, 2 ménages par jour au plus. |
| Opérations | Contrôle qualité automatique (`controle-qualite`) | mission | §2.5 | 1 ménage sur 10 tiré au sort, ou note voyageur < 4,5 : contrôle physique le lendemain. |
| Opérations | Relance des preuves photo (`preuves-manquantes`) | quotidien | §2.4 | Ménage dépassé : « à valider » ; photos manquantes : alerte, puis incident au bout d'un jour. |
| Opérations | Envoi groupé en blanchisserie (`envoi-blanchisserie`) | quotidien | §2.6 | Chaque jour, tout le linge sorti sale non envoyé part en **un** envoi par logement (id `auto-lin-envoi-<logement>-<date>`, complété si du linge sale arrive plus tard dans la journée) vers la blanchisserie active et conforme qui couvre le logement. Linge en blanchisserie depuis plus de 3 jours : alerte « Retour propre attendu ». |
| Opérations | Traçabilité du linge (`suivi-linge`) | quotidien | §2.6 | Ménage passé sans mouvement de linge : alerte ; envoi non revenu sous 5 jours : incident linge. |
| Prestataires | Documents et suspension (`documents-prestataires`) | document | §2.3 | Document expiré ; contrat, RC Pro ou URSSAF expiré : prestataire suspendu, missions à venir remises en attribution ; relance 30 jours avant l'échéance. |
| Finance | Paiement des missions validées (`paiement-prestataire`) | mission | §2.4 | Mission validée ajoutée au paiement du mois du prestataire. Pas de validation, pas de paiement. |
| Finance | Relance des factures en retard (`relance-factures`) | quotidien | §2.7 | Facture émise échue : « en retard » ; la relance part du passage quotidien du serveur si la facture est partagée (proposée par défaut). |
| Finance | Facture de commission et relevé mensuel (`facturation-mensuelle`) | mensuel | §2.7 | Fin de mois : facture de commission par propriétaire (une ligne par logement) et relevé prêt. |
| Pilotage | Compteur 120 nuits (`plafond-120-nuits`) | réservation | §2.10 | Résidence principale : alerte à 110 nuits, fermeture du calendrier demandée à 120. |
| Pilotage | Rappels commerciaux (`rappels-commerciaux`) | quotidien | | Prochaine action d'un prospect échue : rappel à son responsable. |
| Pilotage | Messages voyageurs sans réponse (`messages-en-attente`) | message | §2.8 | Message sans réponse depuis plus d'une heure : alerte ; fil escaladé par l'agent : Abdel prévenu. |
| Pilotage | Escalade des incidents graves (`escalade-incidents`) | quotidien | | Incident de gravité haute ouvert depuis plus de 24 h : escaladé au gérant. |
| Pilotage | Revue de performance des biens (`revue-performance`) | quotidien | §10 | Analyse hebdomadaire : alerte sur les biens à sortir ou renégocier, améliorations ajoutées au suivi (« à proposer »). |
| Pilotage | Rafraîchissement mensuel des annonces (`rafraichissement-annonces`) | mensuel | §11 | Chaque mois, une nouvelle version de l'annonce de chaque logement actif est proposée (saison, repères locaux, rien d'inventé) ; validation humaine obligatoire avant publication. Proposition en attente depuis plus de 7 jours : alerte. |

Pour ajouter une règle : un objet `Regle` dans un fichier `regles-*.ts`,
enregistré dans `regles.ts`, puis relancer le vérificateur (seconde passe à 0).

## Données réelles : comment ça marche

| | Production (par défaut) | Démo locale (`VITE_ERP_DEMO=1`) |
|---|---|---|
| Données | Base Supabase de Label Maison, schéma `erp` | Jeu fictif (11 logements...), date figée au 24 septembre 2026 |
| Date du jour | Date réelle à Paris ; la page se recharge seule au changement de jour | Figée |
| Connexion | Compte Supabase par membre (e-mail + mot de passe), accès si l'e-mail est dans `erp.membres` | Aucune |
| Persistance | Chaque action enregistrée aussitôt, modifications des autres membres reçues en direct | `localStorage` (`lm-erp-demo-v1`, `lm-erp-auto-v1`) |
| Photos, preuves, documents | Espace privé `erp-fichiers` (liens signés d'une heure) | Adresses `demo://`, rien n'est envoyé |
| Bandeau « Données de démonstration », « Réinitialiser » | Absents | Présents |

**Modèle** : une ligne de `erp.enregistrements` par élément (collection + id),
contenu complet en JSON dans `donnees` : ce que l'écran affiche est exactement
ce qui est stocké, sans correspondance de colonnes à maintenir. Les
interrupteurs et constats des automatisations sont dans
`erp.etat_automatisations`, l'équipe dans `erp.membres`, et chaque version
remplacée ou supprimée est archivée dans `erp.historique` (filet de sécurité).

**Écriture** : chaque action est appliquée à l'écran tout de suite, le moteur
d'automatisations repasse, puis `synchro.ts` compare avant / après et envoie
seulement ce qui a changé (upsert par collection + id, suppressions). Les ids
des éléments créés par le moteur sont déterministes : si les deux fondateurs
ouvrent l'ERP en même temps, leurs moteurs écrivent les mêmes lignes et le
résultat converge.

**Jamais de perte** : tant que la base n'a pas confirmé, la modification reste
dans une file d'attente (mémoire + `localStorage`, clé `lm-erp-file-attente`).
En cas d'échec, un bandeau « Enregistrement échoué, nouvel essai… » s'affiche
et l'envoi est retenté seul (1 s, 2 s, 4 s... jusqu'à 1 min), et aussitôt au
retour du réseau. Hors ligne, l'en-tête affiche « Hors ligne » ; la file
survit à la fermeture de l'onglet et part à la prochaine ouverture. Fermer
l'onglet avec des modifications en attente déclenche un avertissement.

**Temps réel** : Supabase Realtime pousse les modifications des autres
membres ; l'écho de ses propres écritures est ignoré, et une modification
locale encore en attente l'emporte sur la version distante. Après une coupure
(réseau, veille de plus de 2 minutes), l'ERP relit toute la base.

**Rôles** (appliqués par la base) : gérant et opérations lisent et écrivent,
lecture consulte seulement (bandeau « Lecture seule », rien n'est enregistré),
seul un gérant ajoute ou retire des membres (Paramètres, Utilisateurs &
rôles). Le rôle prestataire n'a pas encore d'accès.

**Base vide** : tout l'ERP fonctionne sans aucune donnée (indicateurs
« Aucune donnée », listes vides expliquées). Le tableau de bord affiche une
carte **Démarrage** (propriétaires, logements, mandats, prestataires et leurs
documents, réservations à venir) dont chaque bouton ouvre le bon formulaire
(`?nouveau=1`). Elle disparaît quand les cinq étapes sont faites.

## Mise en production réelle

À faire une seule fois, dans cet ordre. Le projet Supabase de Label Maison est
`https://ftfwnomkbjtlpijdevgx.supabase.co`.

1. **Installer la base.** Supabase → **SQL Editor** → **New query** → coller
   **tout** le fichier `supabase/erp-installation.sql` → **Run**. Le script
   peut être relancé sans risque. L'onglet « Results » affiche une ligne de
   bilan : `tables_erp` = 4, `temps_reel` = 2, `stockage_photos` = true,
   `politiques_photos` = 4. (Si `stockage_photos` ou `politiques_photos` ne
   sont pas bons, l'ERP marche mais l'envoi des photos échouera : Storage →
   New bucket `erp-fichiers`, privé, puis relancer le script.)
2. **Créer le compte d'équipe.** Les fonctions serveur (synchronisation,
   agent, CRM…) écrivent avec le compte d'équipe, dont le mot de passe est
   **exactement `ERP_PASSWORD`** (Vercel). Si `ERP_PASSWORD` change, changer
   aussi celui du compte (Authentication → Users). Ce compte peut aussi se
   connecter à l'ERP comme n'importe quel membre (page d'accès : adresse
   `equipe@labelmaisoncg.fr` et ce mot de passe).
   Supabase → **Authentication** → **Users** → **Add user** →
   **Create new user** : e-mail `equipe@labelmaisoncg.fr` (adresse technique,
   aucune boîte mail n'est nécessaire), mot de passe = la valeur de `ERP_PASSWORD`, cocher
   **Auto Confirm User** → **Create user**. Dans **Authentication → Sign In
   / Providers → Email** : **Allow new users to sign up** **désactivé tant
   que la passe 1 de `erp-espaces.sql` n'est pas faite** (avant, la base
   reconnaît un membre à sa seule adresse : n'importe qui pourrait créer le
   compte d'un membre qui n'en a pas encore), puis activé juste après (c'est
   « Créer mon compte ») ; **Confirm email** et **Secure email change**
   activés (obligatoires : voir « Connexion à l'ERP »).
3. **Lui donner l'accès à l'ERP.** Le script de l'étape 1 inscrit déjà
   `equipe@labelmaisoncg.fr` comme gérant dans `erp.membres` (bilan :
   `membres` = 1). Pour changer l'adresse du compte d'équipe : variable
   Vercel `VITE_ERP_EMAIL_EQUIPE`, et la même adresse dans `erp.membres`.
   **Mot de passe oublié :** Authentication → Users → le compte d'équipe →
   nouveau mot de passe (ou lien de récupération).
4. **Adresses de retour des e-mails.** Supabase → **Authentication** →
   **URL Configuration** : **Site URL** = `https://www.labelmaisoncg.fr`, et
   dans **Redirect URLs** ajouter `https://www.labelmaisoncg.fr/erp` (sans
   joker) → Save.
   (Sans cela, un lien de récupération du mot de passe ne ramène pas dans
   l'ERP.)
5. **Vercel (facultatif).** Les adresses du projet sont déjà dans le code
   (`src/erp/data/config.ts`). Pour les changer sans toucher au code :
   Settings → Environment Variables → `VITE_SUPABASE_URL` et
   `VITE_SUPABASE_ANON_KEY` (les deux ensemble), puis redéployer. Ne jamais y
   mettre `VITE_ERP_DEMO`.
6. **Vérifier.** Ouvrir `https://www.labelmaisoncg.fr/erp` et se connecter
   avec une adresse membre et son mot de passe : l'ERP s'ouvre directement.
   Si l'écran « La base de données
   n'est pas encore installée » reste affiché après l'étape 1 : Supabase →
   **Project Settings** → **Data API** (parfois **Settings → API**) →
   **Exposed schemas** → ajouter `erp` → Save, puis « Réessayer ».
   « Votre compte n'est pas autorisé » : l'e-mail n'est pas (ou mal écrit)
   dans `erp.membres` (étape 3).

Sauvegarde : Paramètres → Données → **Exporter en JSON** télécharge toute la
base à l'instant T. Les anciennes versions de chaque élément restent dans
`erp.historique` (Table Editor, schéma `erp`).

### Ensuite

1. **Repull** : voir « Synchronisation Repull » ci-dessous (variables, cron,
   webhooks). Les réservations directes se saisissent toujours à la main
   (Réservations → Nouvelle réservation directe).
2. **Anthropic** : recharger les crédits de l'agent IA, poser un plafond de
   dépense mensuel dans la console, `ANTHROPIC_API_KEY` côté serveur
   uniquement (voir « Messagerie et agent IA »). L'agent n'engage jamais d'argent.
3. **Moteur hors navigateur** : aujourd'hui le moteur d'automatisations tourne
   dans le navigateur à chaque ouverture et après chaque action (résultat
   enregistré dans la base). Les tâches du jour se font donc dès que quelqu'un
   ouvre l'ERP. Pour qu'elles tournent même si personne ne l'ouvre : fonction
   Vercel planifiée (cron quotidien protégé par `CRON_SECRET`, plus un appel
   après chaque synchronisation Repull) qui lit `erp.enregistrements` avec la clé
   `service_role` (côté serveur uniquement), exécute `executerAutomatisations`
   avec la date du jour à Paris et écrit la différence, exactement comme
   `synchro.ts`.
4. **Accès prestataires** : règles RLS dédiées (leurs seules missions) avant
   de donner le rôle `prestataire` à qui que ce soit.

## Connexion à l'ERP

Chacun entre avec **son adresse e-mail et son mot de passe** (page d'accès
de `/erp`, servie par `middleware.ts`). Il n'y a plus de « Retour au site » :
l'ERP est une application.

- **Pour l'équipe :** connectez-vous avec votre compte personnel, dont
  l'adresse figure dans les membres de votre espace (Paramètres → Équipe).
- **Créer mon compte** (après `supabase/erp-espaces.sql` ; plus de « Add
  user » dans Supabase) :
  1. le gérant ajoute la personne dans Paramètres → Équipe (adresse, nom,
     rôle), puis touche **Envoyer l'invitation** : un e-mail part avec le lien
     `https://www.labelmaisoncg.fr/erp#creer=<adresse>&code=<code>`
     (expéditeur de l'espace ; sans expéditeur, le lien s'affiche, à copier
     et envoyer par SMS ou WhatsApp). Le code (32 octets au hasard) sert une
     fois, 14 jours ; la base n'en garde que l'empreinte SHA-256
     (`erp.inviter_membre`). Une nouvelle invitation remplace la précédente.
     Plus tard, « Envoyer l'invitation » reste sur la ligne de chaque membre
     (gérant, sauf sa propre ligne et le rôle prestataire) ; pour un membre
     qui a déjà activé son accès, la base répond qu'il se connecte simplement
     (aucun code n'est créé) ;
  2. la personne ouvre le lien **sur l'appareil où elle utilisera l'ERP** :
     la page garde l'adresse et le code sur cet appareil, et s'ouvre sur
     « Créer mon compte », l'adresse fixée ; elle choisit son mot de passe
     (deux fois, 8 caractères au moins) ;
  3. elle reçoit un e-mail de confirmation de Supabase, ouvre son lien, puis
     saisit son mot de passe (« Dernière étape ») : l'accès est activé, c'est
     fait. Elle avait déjà un compte ? Elle ouvre le lien de l'invitation,
     touche « J'ai déjà un compte » et se connecte : même activation.
  **Sans le code, rien ne s'ouvre** : un compte créé à l'adresse d'un membre
  n'est jamais reconnu par la seule adresse. La ligne du membre est liée à
  un compte (`erp.membres.uid`) seulement par l'activation : à la première
  entrée avec le code, `/erp/connexion` pose le mot de passe saisi (PUT
  `/auth/v1/user`), ferme les autres sessions du compte
  (`/auth/v1/logout?scope=others`), puis appelle `erp.activer(code)` (code
  valable, adresse confirmée du compte = adresse de l'invitation), et
  renouvelle la session : la base ignore les jetons émis avant l'activation
  (`erp.jeton_apres`). Quelqu'un qui aurait créé le compte le premier, à
  l'adresse d'un futur membre (puis l'aurait fait confirmer par lui), perd
  ainsi mot de passe et sessions, et n'entre jamais. Les membres
  d'aujourd'hui sont liés une fois pour toutes, à la passe 1, au compte
  confirmé de même adresse : ils entrent sans code. Un compte créé à la main
  dans Supabase (sans invitation) se lie dans le SQL Editor :
  `select erp.lier_compte('prenom@exemple.fr', 'label-maison');` —
  seulement pour un compte créé par un gérant (**Add user**, **Auto Confirm
  User**), jamais pour un compte venu de « Créer mon compte » : la liaison
  ne change ni son mot de passe ni ses sessions.
  Sans code sur l'appareil, « Créer mon compte » dit d'ouvrir le lien de
  l'invitation. Un compte sans accès lit un refus neutre : « Ce compte n'a
  pas accès à l'ERP. Vous avez reçu une invitation ? Ouvrez son lien sur cet
  appareil. Sinon, demandez à un gérant de vous ajouter. » La page répond la
  même chose qu'un compte existe ou non. La route `/api/erp-invitation` est
  réservée aux gérants de l'espace ouvert et n'invite qu'une adresse déjà
  dans ses membres, pas encore activée ; le lien vise toujours le site
  fixe, jamais l'adresse de la page qui l'a demandé.
  **Base d'avant les espaces** (`erp-espaces.sql` pas encore passé) :
  « Créer mon compte » et « Envoyer l'invitation » sont fermés (« La
  création de compte n'est pas encore ouverte : demandez à un gérant de vous
  ajouter. » sur la page d'accès, « Les invitations ne sont pas encore
  ouvertes… » pour le gérant) ; les comptes existants entrent comme avant.
  Un lien d'invitation refusé (déjà servi, remplacé par un renvoi, expiré)
  sans autre accès : « Ce lien d'invitation n'est plus valable (déjà utilisé,
  remplacé ou expiré) : demandez qu'on vous le renvoie. » Un compte déjà
  membre ignore un code resté sur l'appareil (rien n'est fermé ni lié).
- **Réglages Supabase à garder** (Authentication → Sign In / Providers →
  Email, puis URL Configuration et Attack Protection) :
  - **Allow new users to sign up** : **désactivé jusqu'à la passe 1**, puis
    activé (sinon « Créer mon compte » répond « La création de compte n'est
    pas ouverte… »). Fermer la page ne suffit pas : l'API d'inscription de
    Supabase reste ouverte tant que ce réglage l'est ;
  - **Phone**, **Anonymous sign-ins**, **Manual linking** et tout autre
    fournisseur (Google, Apple…) : **désactivés** (réglages par défaut).
    `erp.activer` refuse d'ailleurs un compte qui porte un téléphone ou une
    autre identité que l'e-mail (ajoutés avant l'activation, ils
    survivraient au nouveau mot de passe) ;
  - **Confirm email** : **activé, obligatoire**. L'activation exige une
    adresse confirmée (la personne lit bien cette boîte mail). C'est le
    réglage par défaut de Supabase : ne pas le couper ;
  - **Secure email change** : **activé**. Changer l'adresse d'un compte
    demande alors la confirmation des deux adresses ;
  - **URL Configuration → Redirect URLs** : exactement
    `https://www.labelmaisoncg.fr/erp`, **sans joker** (`*` ou `**`) : un
    lien de confirmation ou de récupération ne peut renvoyer nulle part
    ailleurs ;
  - **Rate Limits** : garder les limites par défaut (inscriptions et e-mails
    par heure) ; les baisser si des inscriptions en rafale apparaissent
    (Authentication → Users) ;
  - **Attack Protection → captcha** (hCaptcha ou Turnstile) : conseillé si
    des inscriptions en masse arrivent. Attention : il faut alors ajouter le
    jeton du captcha à « Créer mon compte » (page d'accès et
    `src/erp/layout/Connexion.tsx`) avant de l'activer, sinon les
    inscriptions sont refusées ;
  - **Emails → SMTP Settings** : à faire **avant la première invitation**.
    L'envoi par défaut de Supabase est limité (quelques messages par heure)
    et refuse les adresses hors de l'équipe Supabase : y mettre le SMTP de
    Resend (hôte `smtp.resend.com`, port 465, utilisateur `resend`, mot de
    passe = une clé API Resend, expéditeur sur le domaine vérifié). Traduire
    le modèle **Confirm signup** (Emails → Templates) : voir
    `docs/erp/espaces-mise-en-service.md`, étape 5.
- **Invitation à créer l'espace d'une conciergerie** (Sens…) : même lien,
  même code (`erp.inviter_espace`). À la première entrée avec le code,
  l'invitation est rattachée à CE compte (`erp.activer`) ; `erp.qui_suis_je`
  la rend alors, la session est posée et l'application montre la création
  de l'espace, au nom donné par Label Maison (il ne se change pas ensuite).
  Forme attendue de la réponse : `{ "espaces": [...], "invitations_espace":
  [{ "nom_espace": "Sens", "expire_le": "<date ISO>" }] }`. Une entrée compte
  si c'est un objet dont `expire_le`, quand il est donné, est lisible et à
  venir ; toute autre forme vaut refus. Sans le code, l'invitation ne se
  montre pas et `erp.creer_espace` refuse. Base d'avant les espaces : rien
  ne change (`erp.membres` seulement).
- **Refus avec une raison** : `erp.qui_suis_je` rend aussi, sans rien
  ouvrir, `espaces_suspendus: [{ "nom" }]` et `invitations_espace_closes:
  [{ "nom_espace", "motif": "expiree" | "annulee" }]` (adresse confirmée du
  compte). La page d'accès et l'application disent alors « L'espace Sens est
  suspendu : contactez Label Maison. Rien n'est effacé. » ou « Votre
  invitation a expiré : demandez-en une nouvelle à Label Maison. » ; l'accès
  reste refusé.
- **En attendant les comptes personnels :** `equipe@labelmaisoncg.fr` et le
  mot de passe actuel de l'ERP marchent toujours.
- **Une fois les comptes personnels créés, fermer le mot de passe commun :**
  1. choisir un **nouveau** mot de passe aléatoire (gestionnaire de mots de
     passe, 24 caractères ou plus) ;
  2. le mettre dans Vercel → Settings → Environment Variables →
     `ERP_PASSWORD` (Production et Preview) **et** comme mot de passe du
     compte `equipe@labelmaisoncg.fr` dans Supabase → Authentication → Users ;
  3. **Redeploy** dans Vercel.
  Cela ferme l'ancien mot de passe commun et change la clé de signature des
  sessions : tout le monde se reconnecte une fois. Tant que ce n'est pas fait,
  quiconque connaît l'ancien mot de passe peut entrer avec le compte d'équipe
  (les données restent protégées par les règles de la base).
- **Mot de passe oublié ?** sur la même page : Supabase envoie un lien qui
  ramène sur `/erp`, où l'on choisit un nouveau mot de passe (8 caractères
  au moins). Les liens d'invitation de Supabase (« Invite user ») marchent de
  la même façon. Il faut que `https://www.labelmaisoncg.fr/erp` soit dans
  Authentication → URL Configuration → Redirect URLs.
- **Comment ça marche :** la page se connecte directement auprès de Supabase
  (ses limites de tentatives jouent par personne), puis envoie les jetons à
  `/erp/connexion`, qui vérifie le compte et son appartenance à l'ERP
  (`erp.qui_suis_je`, ou `erp.membres` avant les espaces). Elle pose alors
  `erp_session` (cookie signé, lié au compte, 30 jours) et `erp_relais`
  (5 minutes) que l'application échange une seule fois contre sa session
  sur `/erp/session`. Le serveur ne remet jamais la session du compte
  d'équipe à un navigateur : seul celui qui se connecte lui-même avec ce
  compte (pendant le passage) la reçoit. Un non-membre est refusé, et la
  page revient au formulaire de connexion ; une demande venue d'un autre
  site aussi. Un lien reçu par e-mail qui n'est ni une récupération ni une
  invitation demande de confirmer le compte avant d'ouvrir l'ERP (la
  confirmation d'adresse d'un compte invité demande son mot de passe : c'est
  la dernière étape) ; sans JavaScript, rien ne part dans l'adresse.
  « Créer mon compte » appelle Supabase depuis la page (`POST
  /auth/v1/signup`, clé publique, retour
  `redirect_to=https://www.labelmaisoncg.fr/erp`) et ne connecte jamais
  personne, même si Supabase rendait une session. Le code de l'invitation
  reste sur l'appareil (`localStorage`, clé `lm-erp-invitation`, 14 jours au
  plus), part seulement vers `/erp/connexion` avec le compte de la même
  adresse, et s'efface une fois servi ou refusé.
- **Page d'accès, finitions :** mêmes valeurs que l'ERP — bouton principal
  or assombri `#8A6424` (texte blanc, 5,3:1), brun `#403118` au survol et
  pour le badge, champs, boutons et messages arrondis à 10 px, carte et
  badge à 16 px ; tous les textes à 4,5:1 au moins. La zone du linge
  partage la même coquille.
- **Écran de secours de l'application** (`src/erp/layout/Connexion.tsx`,
  quand la page d'accès n'a pas pu passer la session) : mêmes règles —
  « Créer mon compte » avec le code gardé sur l'appareil, activation avant
  le contrôle d'accès (mot de passe posé, autres sessions fermées,
  `erp.activer`, session renouvelée), « Dernière étape » si un compte
  connecté a un code en attente, refus neutre ou avec sa raison. Un lien
  reçu par e-mail pour un autre compte que celui ouvert sur l'appareil
  demande « Se déconnecter pour continuer ? » au lieu d'ouvrir l'un ou
  l'autre en silence. Base pas installée : une phrase (« L'ERP n'est pas
  encore prêt : prévenez la personne qui l'installe. »), le détail
  technique replié sous « Détails techniques ».
- **Anciens accès :** les sessions ouvertes avec l'ancien mot de passe commun
  ne valent plus rien ; chacun se reconnecte une fois. « Se déconnecter »
  (menu du compte) ferme aussi la page d'accès.

## Synchronisation Repull

Dès qu'un propriétaire connecte ses comptes (Airbnb, Booking.com, Vrbo...)
dans [Repull](https://repull.dev/dashboard), tout arrive seul dans l'ERP :
aucune saisie. Le travail est fait côté serveur par
`api/erp-repull-sync.ts` (logique : `src/erp/data/repull-synchro.ts`,
conversions : `src/erp/data/repull.ts`), qui écrit dans `erp.enregistrements`
avec la session du compte d'équipe (même mot de passe que `ERP_PASSWORD`,
aucune clé `service_role`). Les onglets ouverts reçoivent les lignes en
direct ; le moteur d'automatisations crée ensuite le ménage de chaque
nouvelle réservation (tout de suite après le bouton, sinon à la prochaine
ouverture de l'ERP).

### Connexions : connecter les plateformes et choisir les logements

Tout se fait depuis l'ERP, page **Logements → Connexions**
(`/erp/logements/connexions`, bouton « Connecter Airbnb, Booking… » en tête
de la liste des logements, et étape 1 de la carte Démarrage du tableau de
bord). Serveur : `api/erp-repull-connexion.ts`, logique :
`src/erp/data/repull-connexion.ts` ; page : `src/erp/modules/logements/Connexions.tsx`.

1. **Vos plateformes** : Airbnb, Booking.com, Vrbo, et « Autres logiciels de
   gestion » (liste `GET /v1/connect/providers`, gardée une semaine). « Connecter »
   demande au serveur une page Repull Connect et y envoie le gérant ; il
   revient ensuite sur `/erp/logements/connexions?retour=<plateforme>`, la
   page relit tout et dit si la connexion a abouti.
   - Airbnb : `POST /v1/connect/airbnb` (`redirectUrl`, `locale: fr`), accès
     complet par défaut ;
   - Booking.com : `POST /v1/connect/booking` (`redirectUrl`). La page Repull
     guide tout : choisir Repull (FantasticStay) comme fournisseur de
     connectivité dans l'Extranet, coller le numéro d'établissement (Hotel
     ID), relier les chambres. Ses appels (`/v1/connect/booking/verify`,
     `/rooms`, `/map-rooms`) sont faits par la page elle-même avec le jeton de
     session, jamais avec notre clé ;
   - Vrbo et les logiciels de gestion : sélecteur hébergé `POST /v1/connect`
     limité à ce seul fournisseur (formulaire d'identifiants chez Repull).
   - « Déconnecter » : `DELETE /v1/connect/{provider}?accountId=` (Airbnb et
     Booking.com ; pour les autres, Repull renvoie la marche à suivre,
     affichée telle quelle). Les logements de ce compte sortent du choix et
     passent en pause dans l'ERP.
2. **Choisissez les logements à gérer** : tous les logements trouvés
   (`GET /v1/listings?status=all&include=thumbnail`, désactivés compris,
   archivés exclus), avec photo, ville et plateformes. Compteur « 2 / 3
   logements (offre gratuite) » : à la limite, les autres cases sont grisées.
   La limite vient de l'offre du compte (`GET /v1/usage/tier` : free 3,
   starter 50, custom illimité, relue une fois par jour), sinon de
   `REPULL_LIMITE_LOGEMENTS`, sinon 3. « Enregistrer mon choix » :
   - le serveur refuse au-delà de la limite (message en français) ;
   - les logements non choisis sont **désactivés chez Repull**
     (`POST /v1/listings/status`, `active: false`), puis les choisis activés :
     la limite de l'offre est respectée chez Repull aussi, rien n'est supprimé ;
   - le choix est gardé dans la ligne `repull / selection` de
     `erp.enregistrements` ;
   - un passage de synchronisation part aussitôt (complet si de nouveaux
     logements arrivent) ; la page affiche « 3 logements importés,
     12 réservations, 5 conversations ».

Règles de la synchronisation (cron, bouton, webhooks) :

- **tant qu'aucun choix n'est enregistré, rien n'est importé** et aucun appel
  Repull n'est fait (l'ERP affiche « Choisissez vos logements ») ;
- seuls les logements choisis entrent, avec leurs réservations, conversations
  et avis ; le reste est ignoré ;
- un logement retiré du choix passe en **pause** dans l'ERP (marqué
  `repull.horsSelection`), jamais supprimé ; ses réservations restent. Choisi
  de nouveau, il reprend le statut de son annonce.

Appels : l'état de la page est relu chez Repull au plus toutes les 5 minutes
(sauf « Actualiser » et retour de connexion) : environ 3 appels (comptes,
logements, offre une fois par jour). Chaque appel est compté dans la part
mensuelle de l'ERP (`REPULL_BUDGET_ERP`) ; part épuisée : la page affiche la
dernière lecture et le dit. Si le compte dépasse déjà la limite de son offre,
Repull refuse la liste (402) : la page le dit, garde la dernière liste connue
et le choix désactive d'abord le surplus (toujours permis). Connecter,
choisir et déconnecter sont réservés aux gérants.

### Ce qui est synchronisé

| Repull | ERP | Détail |
|---|---|---|
| Annonces (`GET /v1/listings?status=all`) | `logements` (`repull-<id>`) | Nom, adresse, ville, capacité, chambres, surface, wifi, horaires d'arrivée et de départ, annonces Airbnb / Booking.com (lien Airbnb), photo. Règles, accès et équipements seulement s'ils sont vides. Archivée → « sorti », désactivée → « pause », réactivée → « actif » (seulement quand l'état change chez Repull). Nouveau logement : rattaché à la fiche **« Propriétaire à renseigner »** (aucune donnée inventée), checklist de lancement vierge. |
| Réservations (`GET /v1/reservations?updated_since=`) | `reservations` (`repull-<id>`) | Logement, canal (airbnb, booking, direct, autre), voyageur (nom, nombre, pays), dates, nuits, statut (confirmée / en cours / terminée / annulée), montants en centimes : brut = versement hôte + commission plateforme, commission = frais facturés à l'hôte, ménage = frais « cleaning ». Les demandes en attente (à accepter, paiement ou vérification) n'entrent qu'une fois confirmées. |
| Fiches voyageurs (`GET /v1/guests`) | `reservations.voyageur.pays` | Une fois par semaine, pour les réservations sans pays. |
| Avis (`GET /v1/reviews`) | `reservations.noteVoyageur`, `commentaireVoyageur` | Note ramenée sur 5 (Booking.com note sur 10), avis public + message privé. |
| Conversations et messages | `filsMessages` (`repull-<id>`) | Messages dans l'ordre chronologique (voyageur, hôte, agent pour les réponses automatiques ou IA). Nouveau message du voyageur : fil rouvert et « en attente ». |
| Calendrier et prix | (rien) | L'ERP ne tient pas de calendrier de prix : non importés. |

Fusion sans écrasement : ce qui vient de Repull est remplacé à chaque passage,
ce que l'équipe saisit (propriétaire, mandat, commission, serrure, linge,
checklist, numéro d'enregistrement, statut d'un fil, note hors avis...) n'est
jamais touché, une valeur absente chez Repull ne vide rien, et rien n'est
jamais supprimé. Un logement créé à la main (dans n'importe quel espace,
même sans plateforme connectée) se relie ensuite à son annonce depuis sa
fiche : **Pas encore relié à une annonce → Relier à une annonce** (gérant),
puis l'annonce choisie dans la liste de celles trouvées sur les plateformes
de l'espace. Il est alors mis à jour au lieu d'être dupliqué : nom, photos,
description, réservations et messages viennent de l'annonce ; propriétaire,
mandat, réglages, adresse, position sur la carte, wifi et horaires restent.
Rien n'est écrit sur les plateformes ; l'annonce entre dans les logements
suivis (même limite d'offre). Relier et délier sont réservés au gérant,
jusque dans la base (déclencheur `erp.garder_lien_annonce()`). Décocher
l'annonce dans Connexions met le logement en pause ; son statut d'avant
revient quand elle est recochée, ou au « Délier ». « Délier » (repli
Administratif) n'existe que tant qu'aucune réservation ni conversation de
l'annonce n'est arrivée ; il rend les seuls champs que l'import remplace
(nom, photos, description, capacité…). Règles :
`src/erp/data/liaison-annonce.ts`. Chaque passage laisse une
ligne dans le journal (« Synchronisation Repull ») ; l'état (appels du mois,
dernier bilan) est dans la ligne `repull / etat` de `erp.enregistrements`,
ignorée par l'application.

### Budget d'appels (offre gratuite Repull)

L'offre gratuite compte **1 000 appels par mois pour tout le compte** (agent IA
compris), 3 annonces au plus, et **n'inclut pas les webhooks**. L'ERP s'en
réserve **400** (`REPULL_BUDGET_ERP`), comptés appel par appel ; une fois la
part épuisée, plus aucun appel avant le 1er du mois suivant (message clair
dans l'ERP et dans le journal).

| Quand | Appels |
|---|---|
| Cron quotidien (04:17 UTC, soit 6 h 17 à Paris l'été) | annonces 1 (une fois par jour), réservations modifiées 1 par page de 100, liste des conversations 1, messages 1 par conversation dont le dernier message a changé ; avis 1 et pays 1 une fois par semaine ; toutes les réservations relues une fois par semaine. **Environ 3 à 8 appels par jour.** |
| Bouton « Synchroniser maintenant » | Pareil, plus 1 appel pour lire le quota réel du compte (`GET /v1/usage/tier`). **Au plus un passage toutes les 10 minutes** : avant, le serveur renvoie le bilan précédent sans appeler Repull. |
| Première importation | Quelques appels de plus (équipements : 1 par nouvelle annonce). |

Estimation : 30 jours × 3 à 8 appels, plus les clics : 150 à 300 appels par mois.
Paramètres → Intégrations affiche « Appels Repull ce mois : X / 1000 » (quota
réel relevé au dernier clic, sinon la part de l'ERP seule) et la part de l'ERP.

### À faire par les propriétaires (Vercel, projet du site)

1. Settings → Environment Variables (Production et Preview) :
   - `REPULL_API_KEY` : clé API Repull (repull.dev → Dashboard → API keys) ;
   - `CRON_SECRET` : une longue chaîne aléatoire (Vercel l'envoie au cron) ;
   - `ERP_PASSWORD` : déjà en place (compte d'équipe) ;
   - facultatif : `REPULL_BUDGET_ERP` (400), `REPULL_QUOTA_MOIS` (1000).
2. Redéployer. Le cron `/api/erp-repull-sync` (vercel.json, `17 4 * * *`)
   tourne chaque jour : un seul cron quotidien, compatible avec l'offre Hobby
   de Vercel.
3. Dans l'ERP : Paramètres → Intégrations → **Synchroniser maintenant** pour
   la première importation, puis rattacher chaque logement importé à son vrai
   propriétaire (fiche « Propriétaire à renseigner »).

### Webhooks (offre Repull Starter et plus)

Inutiles pour que l'ERP soit complet ; ils apportent le temps réel quand
l'offre les inclut. Créer un abonnement **séparé de celui de l'agent IA**
(`POST /v1/webhooks`) :

- URL : `https://www.labelmaisoncg.fr/api/erp-repull-webhook`
- événements : `reservation.created`, `reservation.updated`,
  `reservation.cancelled`, `reservation.request.created`,
  `reservation.request.updated`, `reservation.alteration.responded`,
  `reservation.message.received`, `listing.created`, `listing.updated`,
  `listing.deleted`, `listing.suspended`, `listing.reactivated`,
  `review.created`, `review.responded`, `account.created`,
  `account.disconnected`
- le secret renvoyé une seule fois (`whsec_...`) va dans
  `REPULL_WEBHOOK_SECRET_ERP`, puis redéployer.

Chaque livraison est vérifiée (`X-Repull-Signature`, HMAC-SHA256 du corps
brut, 5 minutes de tolérance), dédoublonnée (`X-Repull-Event-Id`), puis
l'élément concerné est relu chez Repull (1 ou 2 appels, imputés sur la part
de l'ERP). `account.created` (nouveau compte connecté) lance une
synchronisation complète ; `account.disconnected` laisse une alerte dans le
journal. Avec des webhooks actifs, compter environ 1 à 2 appels par événement :
relever alors `REPULL_BUDGET_ERP` en conséquence.

## Messagerie et agent IA

Tout tourne dans le site (fonctions Vercel + base Supabase), sans autre
serveur.

### Répondre à un voyageur depuis l'ERP

Dans une conversation reliée à Airbnb ou Booking.com (importée par Repull),
« Envoyer » fait partir le message **chez le voyageur**, sur la plateforme de
la conversation : `POST /api/erp-repull-messages` `{ action: 'envoyer', filId,
texte }` (gérant ou opérations) → Repull `POST /v1/conversations/{id}/messages`
`{ message }`, avec un en-tête `Idempotency-Key` (fil + empreinte du texte +
minute : un double clic ne part qu'une fois). L'appel compte dans la part
mensuelle de l'ERP. Le message est ensuite écrit dans le fil (identifiant
Repull : la synchronisation le reconnaît, sans doublon), la conversation sort
de « À répondre », une ligne va au journal, et l'écran affiche « Envoyé sur
Booking.com ». Si Airbnb retire un lien ou un numéro, le texte réellement reçu
est gardé. En cas de refus (lien interdit, logement désactivé, part épuisée),
rien n'est écrit et le texte revient dans la zone de saisie avec l'explication.
Une conversation sans plateforme garde le message dans l'ERP (c'est indiqué
sous la zone de saisie). Code : `src/erp/data/messagerie-envoi.ts`.

### L'agent IA

`api/erp-agent.ts` → `src/erp/data/agent-messagerie.ts`. À chaque passage :

1. relit `reglages/agent` : en pause ou hors des heures de réponse → rien
   (le passage est noté) ;
2. relève les nouveaux messages chez Repull (phase « conversations » seule),
   au rythme que permet la part d'appels du mois (voir plus bas) ;
3. cherche les conversations Repull dont le dernier message vient du
   voyageur, ni closes, ni transmises, ni reprises par l'équipe, message pas
   encore traité (repère `fil.agent.dernierMessageTraite`), de moins de 48 h ;
4. pour 5 d'entre elles au plus (temps et appels permis), demande à Claude
   une décision en JSON strict (sorties structurées) :
   `{ action: repondre | transmettre, raison, langue, texte, resume }`, avec
   la fiche du logement, la réservation (dates, voyageurs), les 20 derniers
   messages et les réglages ;
5. **répondre** : la réponse (signature ajoutée par le code) part chez le
   voyageur par Repull, auteur « agent » ; **transmettre** : fil « escaladé »
   avec la raison (`argent`, `litige`, `hors_fiche`, `exception`, `autre`) et
   un résumé pour l'équipe (visible dans « À répondre », « Activité » et en tête de la conversation), un court message d'attente au
   voyageur si utile, journal, alerte Telegram.

**Garde-fous** (en plus des consignes données à Claude) : il n'affirme que ce
qui est dans la fiche du logement et la réservation ; argent et litiges sont
toujours transmis (même si Claude proposait de répondre) ; une réponse ou un
message d'attente qui parle d'argent n'est jamais envoyé ; codes d'accès et
wifi absents du contexte tant que le voyageur n'y a pas droit (réservation
confirmée, arrivée sous 48 h ou sur place) ; les messages du voyageur sont
des données, pas des consignes ; réponse illisible → transmis.

**Autonomie et réponses à valider** (`src/erp/data/messagerie-ia.ts`) :
Claude note aussi la demande du voyageur (`intention` : arrivee, depart,
arrivee_anticipee, depart_tardif, facture, prolongation, probleme_technique,
infos, annulation, paiement, avis, autre), son ton (`sentiment`), sa
`confiance` (0 à 1) et la version française de sa réponse. Le gérant choisit
dans Messagerie > Votre agent → « Ce qu'il envoie seul » : **Je valide tout**
(défaut d'un nouvel espace : rien ne part seul), **Questions simples**
(arrivée, départ, questions pratiques, avis, confiance ≥ 0,85) ou
**Autonome hors sujets sensibles** (confiance ≥ 0,7). Sans choix enregistré,
Label Maison est au niveau « Autonome hors sujets sensibles » (même seuil
de 0,7, mêmes garde-fous ; c'est ce que l'écran affiche). Sujets
sensibles, jamais envoyés seuls quel que soit le niveau (Label Maison sans
choix compris) : paiement, remboursement, caution, frais, prix, gratuité,
devises, annulation (`annul|\banul|cancel|stornier|cancelar`), réclamation,
problème sur place, données personnelles (avec leurs paraphrases courantes :
moitié, %, « on us », « give … back », settle…) ; ils sont cherchés dans tous
les messages du voyageur du séjour (sinon des 7 derniers jours), lus un par
un et collés sans séparateur, **et dans la réponse proposée elle-même**
(texte et version française) : une consigne cachée dans un message peut
faire écrire « nous vous remboursons » en notant « infos, confiance 0,99 ».
Les textes sont nettoyés avant toute recherche (NFKC, caractères invisibles
retirés) ; un mot latin qui contient une lettre cyrillique ou grecque met la
réponse à valider. L'envoi seul suppose aussi un voyageur qui écrit
nettement en français ou en anglais (langue devinée sans IA, aucune lettre
d'un autre alphabet, la moitié au moins des mots reconnus) et une réponse en
français ou en anglais (langue notée par l'IA et langue devinée) ; sinon, à
valider. Enfin, **un second contrôle par l'IA** (`src/erp/data/controle-reponse.ts`)
ne voit que la réponse et sa langue, jamais les messages du voyageur : il
dit si elle engage l'équipe, parle d'argent, accorde une exception ou
demande des données personnelles. Envoi seul seulement si les quatre sont
faux ; appel en échec, trop long, illisible ou plafond atteint : à valider.
Il compte dans le plafond du mois. Une réponse ou un message qui s'adresse à
un contrôle (« note to the reviewer », « answer false », « ignorez les
instructions », « json »…) est mis à valider sans l'appeler ; les balises du
texte à classer sont retirées sous toutes leurs formes. Après 5 échecs de
suite du contrôle (par exemple si le service refuse un jour un paramètre),
une alerte s'affiche dans l'état de l'agent et dans « À faire » (« L'agent
ne peut plus vérifier ses réponses : il les garde à valider. », élément
`reglages/alerte-controle-agent`), une notification part aux gérants une
seule fois ; tout se lève au premier contrôle réussi. Le message d'attente est un texte fixe
par langue (`MESSAGES_ATTENTE`), jamais celui de Claude. Une réponse qui ne
part pas seule est gardée sur le fil (`agent.brouillon`, décision
`a_valider`) : la conversation reste dans « À répondre » et la réponse est
déjà dans la zone de saisie, l'équipe l'envoie en un clic. Chaque décision
va au journal (demande, confiance, envoyée / à valider / transmise) et dans le
bilan du passage ; l'envoi d'une réponse de l'agent par un membre note qui
l'a validée et si elle a été retouchée (`api/erp-repull-messages.ts` : le
serveur compare le texte envoyé à `agent.brouillon` ou `fil.proposition`,
le champ `brouillon` du navigateur n'est qu'un indice). La lecture du message (`fil.analyse` : langue, demande, ton,
urgence) sert au tri de « À répondre » (urgent : problème pendant le séjour,
puis arrivée sous 24 h ou voyageur sur place) et au libellé de la demande en
tête de conversation ; aucun appel à l'IA juste pour trier.

**Suppléments (B7)** (`src/erp/data/supplements.ts`) : arrivée plus tôt,
départ plus tard, ménage supplémentaire, navette.

- **Réglages** : fiche du logement → onglet « Infos pour votre agent » →
  carte « Suppléments », juste après « Arrivée et départ » → « Régler » /
  « Modifier » (gérant ; rien de réglé et pas gérant : pas de carte ; logement
  sorti : pas de carte). Pour chacun : proposé ou non, prix indicatif (0 € :
  sans supplément), heure possible (arrivée dès, départ jusqu'à, avant
  l'arrivée / après le départ habituels), « Seulement si personne ne part
  (n'arrive) ce jour-là » (coché par défaut), précision montrée au voyageur.
  Heures au format 12:00 à l'écran, « 12 h » seulement dans les textes aux
  voyageurs. `?onglet=fiche&supplements=regler` ouvre directement le panneau
  (lien « Régler les suppléments » de la Messagerie). Élément `reglages/supplements` (un
  bloc par logement), dans `erp.ecriture_gerant_seulement` (les trois
  fichiers SQL et leurs recettes, `ecritures-gerant.ts`). Lecture tolérante :
  jamais allumé sans prix lisible.
- **Messagerie** : quand le voyageur demande une arrivée plus tôt ou un
  départ plus tard (demande lue par l'IA, sinon ses mots ; ménage et navette :
  ses mots) et attend une réponse, un bandeau au-dessus de la zone de réponse
  donne le supplément, son prix, l'état (possible, à vérifier, pas possible
  ce jour-là) et ce que dit le planning : un départ d'un autre voyageur le jour
  de l'arrivée (ou une arrivée le jour du départ) le bloque « selon le
  planning », sinon il est à vérifier ; un ménage prévu ce jour-là est dit.
  Arrivée plus tôt : un ménage qui finit après l'heure la met « à vérifier ».
  Départ plus tard sans arrivée ce jour-là : le ménage de ce départ se décale
  (« Ménage décalé après 14:00 ») et le départ reste possible ; à vérifier
  seulement si un voyageur arrive (case décochée) ou si le ménage décalé
  (2 h, `DUREE_MENAGE_MINUTES`) ne tient plus avant sa fin au plus tard.
  « Insérer » met la proposition (ou, si ce n'est pas possible, une réponse
  polie sans prix) dans la zone de réponse, en français ou en anglais selon
  le voyageur ; « à vérifier », elle est au conditionnel (« une arrivée dès
  12 h devrait être possible, pour 20 € : nous vérifions avec l'équipe ménage
  et vous confirmons très vite »), jamais « Bonne nouvelle ». Une fois
  insérée, seul le bandeau de la zone de réponse reste. L'équipe l'envoie
  comme une réponse normale. Les autres suppléments du logement sont dans la
  rangée des modèles (pas celui déjà demandé).
- **Message automatique** « Proposer les suppléments » : facultatif, éteint par
  défaut, 3 jours avant l'arrivée (11:00, réglable), seulement pour les
  logements qui proposent un supplément, avec ceux que le planning permet
  (rien « à vérifier » ne part) ; rien de possible : pas envoyé, noté une fois.
  Ni « Accès et clés » ni « Wifi » dans l'éditeur pour ce moment. Le message
  garde son moment (`envoi.moment = 'proposer_supplements'`, comme tout
  message automatique). La réponse du voyageur qui ne demande rien (« Non
  merci, à jeudi ») ne retient pas les infos d'arrivée
  (`reponseSansDemandeAuxSupplements`, `attendReponse` dans
  `messages-programmes.ts`) ; une demande de supplément (`supplementDansTexte`),
  un « oui » ou une question les retient. Ailleurs, la règle reste
  `attendEquipe` / `voyageurAttend`, et la conversation reste dans « À
  répondre ».
- **Aucun paiement ni changement de réservation par l'ERP** : ni offre
  spéciale, ni modification sur la plateforme, ni lien de paiement.
  L'encaissement se fait hors ERP (c'est écrit dans l'aide de la carte et des
  messages automatiques).
- **L'agent ne vend jamais seul un supplément** (`supplementAValider`, dans
  `verdictEnvoi`, conversation lue par `messagesVerdict`) : « à valider » à
  tous les niveaux d'autonomie pour toute réponse à une proposition de
  suppléments (message automatique « Proposer les suppléments », ou
  proposition de l'équipe avec un prix), pour une demande d'arrivée plus tôt
  ou de départ plus tard (lue par l'IA, ou dans les mots du voyageur encore
  sans réponse, sous la forme d'une demande : « possible », « peut-on »,
  « could we… earlier »), et pour une réponse qui accorde un supplément
  (« vous pourrez », « you can », « c'est noté »…) ou une heure avant
  l'arrivée / après le départ de la fiche (`offreSupplement`). Les questions
  simples partent seules : « Nous arriverons vers 15 h, est-ce trop tôt ? »,
  « We will arrive early evening, where is the key box? », le wifi après une
  demande déjà traitée, « Si vous souhaitez arriver plus tôt, dites-le-nous ».
  Un prix ou le mot « supplément » est une question d'argent (transmis,
  `sujetSensible`) ; ses consignes lui disent de n'accorder rien, de ne
  donner aucun prix et de ne jamais proposer de lui-même une arrivée plus tôt
  ni un départ plus tard.

**Textes de l'annonce (A6)** (`src/erp/annonces/textes.ts`, limites dans
`src/erp/annonces/limites.ts` avec leurs sources) : fiche du logement → carte
« L'annonce » → « Nouveaux textes ». Trois titres (un par angle : le logement
et son atout, le lieu d'abord, l'usage) et une description, tirés de la fiche
(équipements, atouts, couchage, repères du quartier de
`src/erp/annonces/ancrages.ts`), avec leur compteur et « Copier ». Limites :
Airbnb 50 caractères pour le titre, 500 pour la description ; Booking.com 3 à
255 pour le nom, sans plus de 5 chiffres de suite, ni emoji, ni symbole hors
de ! # & ` ' " - , : les textes tiennent dans les deux. Garde-fous (pour tout
texte proposé) : aucun équipement absent de la fiche (négations comprises),
aucune promesse, ni coordonnée, ni lien, ni nom de plateforme, ni code d'accès
ou wifi (même court : « code 482 », ou un code court de la fiche recopié),
ni adresse exacte, ni nom du propriétaire. Compteur lisible sans survol
(« 48 / 50 caractères · Airbnb et Booking.com », « 2 caractères · trop court
pour Booking.com »). « Rédiger avec votre agent » : `POST /api/erp-agent
{ action: 'textes_annonce', logementId }` (`api/_erp-annonces.ts`,
`src/erp/data/annonce-ia.ts`, gérant ou opérations, plafond mensuel de
l'IA, 20 demandes par quart d'heure et par membre : « Trop de demandes d'un
coup : réessayez dans quelques minutes. », 429 ; la clé Repull n'est pas
exigée ; indisponible : « La rédaction par votre agent n'est pas disponible
pour l'instant : les textes tirés de la fiche restent proposés. », 503) ;
l'IA ne reçoit que des faits sûrs et publics (stationnement en une catégorie,
jamais le texte libre du parking ; phrases des textes de l'annonce qui
parlent d'un accès retirées ; équipements qui citent un code écartés), ce
qu'elle rend repasse par les garde-fous et un texte refusé est remplacé par
celui de la fiche. Pas de carte « L'annonce » pour un logement sorti. La dernière proposition est gardée dans
`versionsAnnonce` (id `textes-<logement>`, champ `titres`). **L'ERP ne publie
jamais l'annonce** : l'équipe copie et colle elle-même sur la plateforme.

**Assistant de réponse** (`src/erp/data/agent-assistant.ts`, actions de
`POST /api/erp-agent`, gérant ou opérations) : `brouillon` (« Proposer une
réponse » : même contexte et même décision que l'agent, rien n'est envoyé ;
proposition écartée si elle contient un code d'accès avant l'heure),
`traduire` (« Voir en français » sous un message étranger, traduction gardée
sur le message) et `traduire_texte` (« Traduire en … » : la réponse de
l'équipe dans la langue du voyageur). Chaque appel compte dans le plafond
mensuel de l'espace (`agent/etat`, `iaMois`), comme les décisions de l'agent.

**Guides et questions fréquentes** (`src/erp/data/guides.ts`, onglet « Infos
pour l'agent » : `onglets/GuidesFiche.tsx`) : chaque logement peut avoir des
guides (vidéo, photo, PDF déposés, 50 Mo au plus, ou lien https : YouTube non
répertoriée, Google Drive, iCloud…) avec « quand l'envoyer », et des questions
fréquentes (question + réponse). Les questions fréquentes entrent dans la
fiche donnée à Claude comme réponses sûres. Les guides lui sont listés par id
et titre, sans adresse ; il peut en joindre 2 au plus (champ `guides` de sa
réponse). Le serveur vérifie les ids (inconnu : ignoré), ajoute « Titre :
lien » avant la signature et, pour un fichier déposé, crée un lien signé de
7 jours (Storage, compte d'équipe). Un guide marqué « Contient l'accès » suit
la règle des codes : retiré (et noté pour l'équipe) tant que le voyageur n'y a
pas droit. Si une plateforme refuse le message à cause du lien, la
conversation est transmise à l'équipe avec le nom du guide. Dans la
Messagerie, la rangée « Modèles » propose aussi les guides du logement
(cadenas pour un guide d'accès, même règle que le modèle « Arrivée »). Au
relevé des annonces, le livret d'accueil Repull (`details.houseManual`)
remplit « À savoir » s'il est vide.

**Jamais deux réponses** : avant d'envoyer, le fil garde un marqueur « envoi
en cours » (message du voyageur, texte, clé `lm-agent-<fil>-<message>`). Un
passage coupé en plein envoi est repris au suivant avec le même texte et la
même clé : Repull rejoue sa réponse au lieu d'envoyer une seconde fois. Un
verrou (`agent/etat`) évite deux passages en même temps, et la clé liée au
message du voyageur bloque de toute façon un second envoi.

**Quand passe-t-il ?**

- toutes les 30 minutes de 7 h à 23 h (Paris), par Supabase (`pg_cron` +
  `pg_net`, tâche `*/30 5-22 * * *` en heure UTC) : exécuter
  `supabase/erp-agent-cron.sql` dans le SQL Editor du projet Label Maison, en
  remplaçant `REMPLACER_PAR_CRON_SECRET` par la valeur de `CRON_SECRET`
  (rangée dans le coffre chiffré Vault). **À relancer après chaque changement
  du fichier** : en octobre 2026, le premier réveil passe de 6 h à 5 h UTC
  pour que le briefing du matin parte à 7 h à Paris l'été aussi (l'hiver, un
  passage de plus à 6 h ; briefing et app « Opérations » attendent 7 h, prix
  conseillés 8 h, messages automatiques jamais avant 8 h) ;
- chaque jour par le cron Vercel (`53 6 * * *`, secours) ;
- juste après chaque synchronisation Repull qui apporte des messages (bouton,
  cron quotidien, webhooks) ;
- à la demande : Réglages de l'agent → « Lancer l'agent maintenant ».

L'onglet Réglages de l'agent montre l'état réel (bloc « Votre agent en ce moment ») :
en clair, agent actif ou en pause et « tout est branché » ou non ; replié
sous « Détails techniques », clé IA présente ou manquante, plateformes
reliées, dernier passage, Telegram branché ou non. Le serveur ne renvoie que des
oui/non, jamais la valeur d'une variable (`GET /api/erp-agent?action=etat`).

**Relevé des messages et part d'appels** : sans webhooks (offre gratuite
Repull), l'agent relève lui-même les nouveaux messages (1 appel pour la
liste, 1 de plus par conversation qui a bougé). Le rythme se calcule à chaque
passage sur ce qui reste de la part du mois : réserve de 4 appels par jour
restant (synchronisation quotidienne) + 20 (réponses), 1,5 appel par relevé,
jamais plus d'un relevé par demi-heure. Avec la part de 400 appels, cela
donne un relevé environ toutes les 3 heures entre 8 h et 23 h ; en fin de part, plus de
relevé (le bouton et la synchronisation quotidienne restent). Chaque réponse
envoyée coûte 1 appel. Pour des réponses plus rapides : relever
`REPULL_BUDGET_ERP` (la part de l'ERP sur les 1 000 appels du compte), passer
à l'offre Repull supérieure, ou brancher les webhooks (réponse immédiate).

### À faire par les propriétaires

1. Vercel → Settings → Environment Variables (Production et Preview) :
   - `ANTHROPIC_API_KEY` : clé de console.anthropic.com (poser aussi un
     plafond de dépense mensuel dans la console) ;
   - facultatif : `AGENT_MODELE` (défaut `claude-haiku-4-5-20251001`) ;
   - facultatif : `TELEGRAM_BOT_TOKEN` (bot créé avec @BotFather) et
     `TELEGRAM_CHAT_ID` (groupe de l'équipe, où le bot a été ajouté) ;
   - `CRON_SECRET` et `REPULL_API_KEY` : déjà en place pour la synchronisation.
2. Redéployer.
3. Supabase → SQL Editor : coller `supabase/erp-agent-cron.sql`, remplacer
   `REMPLACER_PAR_CRON_SECRET` par la valeur de `CRON_SECRET`, Run.
4. Dans l'ERP : compléter les fiches des logements (wifi, accès, horaires,
   parking, règles, équipements), puis Messagerie → Réglages de
   l'agent → activer, enregistrer, et « Lancer l'agent maintenant » pour
   vérifier.

**Coût estimé** (Claude Haiku 4.5, tarif public d'environ 1 $ par million de
jetons en entrée et 5 $ en sortie, à vérifier sur anthropic.com/pricing) :
2 000 à 3 000 jetons lus et 150 à 300 écrits par décision, soit **environ
0,3 à 0,5 centime par réponse**, moins d'1 € pour 200 réponses. Un passage
sans message en attente n'appelle pas Claude.


## CRM d'appels et connecteur Claude (octobre 2026)

- **CRM** (`/erp/crm`) : chaque formulaire du site (`/api/contact`) crée une ligne « À appeler » dans la collection `crm` (sans doublon par e-mail ou téléphone), en parallèle de l'e-mail. Règles : `src/erp/data/crm.ts` ; contrôles : `verifier-crm.ts`.
- **Connecteur MCP « Label Maison »** (`/api/crm-mcp`, serveur `label-maison` 2.1.0) : Claude (claude.ai, Claude Desktop, Claude Code) suit tout le channel manager et tient le CRM. Logique : `src/erp/data/crm-mcp.ts` (CRM et protocole), `cm-mcp.ts` (channel manager), `mcp-commun.ts` (contexte, forme d'un outil) ; transport : `api/_crm-mcp-http.ts` (`depotsMcp(base)`, seul point d'entrée vers les données : la base de l'espace du jeton) ; contrôles : `verifier-crm-mcp.ts` et `scripts/verifier-espaces-serveur.ts`.
  - **CRM** (six outils, inchangés) : `crm_resume`, `crm_chercher`, `crm_voir`, `crm_ajouter`, `crm_modifier`, `crm_noter_appel` (aucune suppression).
  - **Channel manager** (dix outils) :
    - **Le point du jour** : `cm_resume`, avec les conversations à répondre, les arrivées, départs et voyageurs sur place du jour, les avis sous 4,5 des 14 derniers jours et le nombre d'appels CRM.
    - **Logements** : `logements_lister` (statut, prix de ce soir, prochain événement) et `logement_voir` (fiche, couchage, conditions, infos pratiques, plateformes, prix des 14 prochaines nuits ; par id ou par nom).
    - **Réservations** : `reservations_periode` (du / au compris, 92 jours au plus ; arrivées, départs, sur place ; annulées exclues) et `reservation_voir` (montants, dont « vous recevez » = total − frais de la plateforme ; avis).
    - **Conversations** : `conversations_a_repondre` (même règle que « À répondre » de la Messagerie), `conversation_voir` et `reponse_preparer` (contexte et consignes pour rédiger une réponse, qui n'est **jamais envoyée** par le connecteur : l'équipe la relit et l'envoie depuis la Messagerie).
    - **Chiffres** : `indicateurs`, sur 30 jours ou une période choisie, comparés à la période précédente, avec les mêmes définitions que l'Accueil (`data/selectors`), vérifiées par le test.
  - **Écritures du channel manager** : `conversation_pas_besoin_de_repondre`, qui classe la conversation « terminée » dans l'ERP, comme le bouton de la Messagerie (elle se rouvre si le voyageur réécrit), et `reponse_proposer` (copilote, ci-dessous).
  - **Copilote** (cahier A15, `src/erp/data/copilote-mcp.ts`, règles `copilote.ts`, contrôles `verifier-copilote.ts`) : ce que Claude peut faire, formalisé, tracé et réversible.
    - `reponse_proposer` range une réponse dans la conversation (« Proposée par Claude », déjà écrite dans la Messagerie) : **l'équipe la relit et l'envoie** (la confirmation), rien ne part du connecteur ; refusée si elle parle d'argent ou de données personnelles, accorde un supplément, contient un code (même épelé, « 4 8 2 »), le wifi, un lien, un e-mail ou un téléphone, ou une consigne cachée ; l'agent ne répond pas au même message tant qu'elle attend. Envoyée, sa trace passe « Envoyée par … » (« …, après retouche » si l'équipe l'a modifiée ; le journal dit « proposée par Claude ») ; retirée, « Retirée par … ».
    - `menage_creer` prévoit un ménage au planning **interne** de l'ERP (« à attribuer », `interne: true`), jamais transmis à un prestataire ni à une plateforme de ménage ; jamais doublé le même jour. Les règles et écrans des prestataires l'écartent (`missionPrestataire`, `selectors.ts`) : ni attribution, ni paiement, ni contrôle, ni alerte « personne ».
    - `facture_preparer` prépare le **brouillon** de la facture mensuelle d'un propriétaire s'il n'existe pas (jamais remplacé, validé, numéroté, envoyé ni encaissé : le gérant le fait dans l'ERP).
    - `prix_conseils` lit les prix conseillés : **lecture seule**, « ajuster un prix » reste un conseil, aucun prix n'est écrit nulle part. Aucun paiement.
    - **Trace** : chaque outil d'écriture passe par `contexteTrace`, qui écrit la trace dans la collection `actionsAgent` de l'espace **avant** l'écriture (sans trace, rien n'est écrit ; une écriture en échec laisse une trace « pas faite ») : qui (Claude et le gérant qui l'a connecté, ou la clé fixe), quand, quel outil, la cible, avant → après (textes masqués : ni code, ni wifi, ni e-mail ou téléphone de voyageur). Un outil de lecture ne peut rien écrire (`contexteLecture`). L'agent de la messagerie trace aussi ses décisions (réponse envoyée seule, à valider, transmise).
    - **Paramètres → Actions de l'IA** (gérant) : les actions des 90 derniers jours, les réponses proposées « à envoyer » en tête, et « Annuler » (fiche du CRM, appel noté, conversation terminée, ménage, brouillon de facture, réponse proposée) tant que la cible n'a pas changé depuis (empreinte ; sinon refusé, rien d'écrasé). Une facture validée depuis ne s'annule plus (« La facture a été validée depuis »). Un message parti ne se reprend pas.
    - **Base** : `supabase/erp-espaces.sql` (à relancer) réserve `actionsAgent` aux gérants de l'espace (lecture et écriture), n'en garde aucune ancienne version dans `erp.historique`, et la borne à 90 jours et, par espace, 5 000 actions de Claude et 500 de l'agent (déclencheur `erp.borner_actions_ia`). Tant que la règle manque (témoin `erp.actions_ia_protegees()`), aucune trace n'est écrite (elle serait lisible par tous les membres) : les outils d'avant le copilote (`crm_ajouter`, `crm_modifier`, `crm_noter_appel`, `conversation_pas_besoin_de_repondre`) écrivent comme avant, sans trace ; `reponse_proposer`, `menage_creer` et `facture_preparer` refusent (« Le gérant doit d'abord relancer la mise à jour de la base ») ; l'agent ne trace rien ; rien n'est annulé.
    - **Accès** : le gérant qui a connecté Claude doit le rester. Retiré de l'équipe, passé « opérations » ou réinvité sans avoir réactivé son compte, ses jetons sont refusés (au plus 1 min après), le rafraîchissement aussi (l'autorisation tombe) : `api/_oauth.ts`, `BaseErp.roleMembre`.
  - **Ce qui ne passe jamais par le connecteur** :
    - aucun envoi aux voyageurs, aucune écriture vers les plateformes ;
    - jamais de wifi ni de code d'accès : les e-mails, téléphones et codes du logement présents dans les messages sont masqués ;
    - les voyageurs sont nommés « Prénom N. ».
  - **Une clé par espace (« chacun a sa clé »)** : une autorisation appartient à l'espace du gérant qui clique « Autoriser » (l'espace ouvert dans l'ERP ; le serveur revérifie qu'il en est gérant avec `verifierMembre(jeton, { espace })`). Le code et les jetons sont rangés dans la base de cet espace, avec cet espace ; ceux d'un autre espace que Label Maison portent son identifiant en tête (`<espace>.<valeur>`, `avecEspace` / `espaceDuJeton` dans `oauth-regles.ts`) pour que `/api/oauth-token` et `/api/crm-mcp` les cherchent dans la bonne base, et chaque appel d'outil lit avec `baseErp(c, <espace du jeton>)` (compte serveur et en-tête de l'espace). L'empreinte couvre la valeur complète : changer ou retirer le préfixe donne un jeton inconnu partout. Label Maison garde la forme d'avant (valeur seule) ; un ancien jeton (sans espace) vaut pour Label Maison. Base d'avant les espaces : Label Maison seul, exactement comme avant ; un jeton d'un autre espace y est refusé. Espace fermé, ou compte serveur pas prêt : ses jetons sont refusés (jamais Label Maison à sa place). « Déconnecter Claude » ne révoque que les jetons de l'espace ouvert. Le connecteur se présente au nom de l'espace (instructions de Label Maison inchangées ; un autre espace : son nom, rien de Label Maison). La clé fixe `MCP_CRM_TOKEN` reste celle de Label Maison.
  1. **Connexion par OAuth 2.1** (ce qu'attend claude.ai) : CRM → Plus → « Connecter à Claude » donne l'adresse `https://www.labelmaisoncg.fr/api/crm-mcp` (aucun secret, la même pour tous les espaces). Dans claude.ai → Paramètres → Connecteurs → « Ajouter un connecteur personnalisé » (nom : celui de l'espace, « Label Maison » ou « Sens » ; paramètres avancés vides ; un connecteur déjà ajouté sous l'ancien nom « CRM Label Maison » continue de marcher et reçoit les nouveaux outils sans rien refaire), puis se connecter : l'ERP ouvre `/erp/autoriser-claude` (« Connecter Claude à l'espace Sens ? »), un gérant de cet espace clique « Autoriser ».
  2. Mécanique : découverte par `/.well-known/oauth-protected-resource[/api/crm-mcp]` et `/.well-known/oauth-authorization-server` (servis par `middleware.ts`, les rewrites de `vercel.json` étant ignorés avec `cleanUrls`), inscription dynamique `/api/oauth-register` (adresses de retour de Claude seulement : claude.ai, claude.com, localhost), code à usage unique de 10 min lié au défi PKCE S256 (route gérant `/api/erp-connecteur-claude`), jetons `/api/oauth-token` (accès 7 jours, rafraîchissement 90 jours avec rotation). Règles d'entrée : `src/erp/data/oauth-regles.ts` ; codes et jetons : `api/_oauth.ts`.
  3. La base (collection technique `connecteurs`) ne garde que des **empreintes** SHA-256 des codes et jetons. « Déconnecter Claude… » (même fenêtre) révoque tous les jetons (effet en 1 min au plus). Pour réserver cette collection aux gérants, lancer une fois `supabase/erp-connecteurs-gerants.sql` dans Supabase → SQL Editor (règle aussi incluse dans `erp-installation.sql`).
  4. Facultatif, pour un outil sans OAuth : `MCP_CRM_TOKEN` (32 caractères au moins) dans Vercel ouvre `/api/crm-mcp/<cette clé>`. Sans la variable, cette adresse est fermée.
  5. RGPD : le connecteur transmet à Claude (Anthropic) des données personnelles du CRM (noms, téléphones, e-mails) et, pour le channel manager, des prénoms et initiales de voyageurs, dates de séjour et messages (e-mails et téléphones masqués) : Anthropic figure parmi les sous-traitants de la politique de confidentialité (`/politique-de-confidentialite`).
- **Relances dans Calendrier** (`/api/crm-agenda/<clé>`) : l'agenda des relances au format iCalendar, pour un abonnement dans Calendrier (iPhone, Mac), Google Agenda ou Outlook. Lecture seule : rien n'est écrit, ni dans le CRM ni ailleurs.
  1. CRM → Plus → « Relances dans Calendrier » (gérants) : choisir « Toute l'équipe », « Abdel » ou « Kamel » (ses contacts, plus ceux que personne ne suit encore ; dans un autre espace que Label Maison, toute l'équipe seulement, `filtresAgenda`, revérifié par `/api/erp-agenda`), « Créer le lien », puis « Ouvrir dans Calendrier » (lien `webcal://`) → « S'abonner » (emplacement iCloud pour l'avoir sur tous les appareils). Ailleurs : coller le lien `https://` (Calendrier → Fichier → Nouvel abonnement, Google Agenda → Autres agendas → À partir de l'URL).
  2. Contenu (`src/erp/data/agenda-crm.ts`, contrôles `verifier-agenda.ts`) : un événement par contact, sur la journée, avec un rappel à 9 h. Aujourd'hui : chaque « À appeler » et chaque relance échue (« en retard ») ; à sa date : chaque relance prévue ; jamais : « Signé » et « Pas intéressé ». La date suit la relance (UID stable). Rafraîchissement demandé toutes les 15 min (Calendrier d'Apple décide du rythme réel ; Google Agenda relit en quelques heures).
  3. Clés (`api/_agenda.ts`, route gérant `/api/erp-agenda`) : 256 bits, montrées une seule fois ; la collection `connecteurs` n'en garde que l'empreinte SHA-256. Un lien par espace, comme les jetons de Claude : rangé dans l'espace du gérant qui le crée, préfixé par l'espace hors Label Maison (liens de Label Maison inchangés), il ne donne que le CRM de cet espace (calendrier à son nom). « Couper tous les liens… » révoque ceux de l'espace ouvert (effet en 1 min au plus, l'agenda abonné garde sa dernière copie). Le lien donne noms et téléphones des contacts : à garder pour soi. RGPD : Apple (iCloud) et Google (Agenda) figurent parmi les sous-traitants de la politique de confidentialité.


## Briefing du matin et assistant CRM (octobre 2026)

**Briefing du matin (A12)** : la journée en quelques phrases, calculée
**sans IA** sur les vraies données (`src/erp/data/briefing.ts`, contrôles
`verifier-briefing.ts`) : arrivées, départs et logements occupés ce soir,
urgences, voyageurs qui attendent l'équipe (`attendEquipe`), incidents,
avis à déposer, notes sous 4,5, personnes à appeler (file de l'assistant
CRM), alertes (anomalies, mise à jour des plateformes en échec), votre agent
(contrôle des réponses en panne, fiches incomplètes : `data/fiche-agent.ts`)
et, pour le gérant seulement, prix à revoir, factures mensuelles à valider et
logements signalés « pas à moi ». Chaque ligne de « À faire » a sa phrase,
avec la même définition (mêmes nombres, vérifiés sur la démonstration) ; un
membre non gérant n'y voit ni prix, ni facture, ni « pas à moi ». Dans une
liste de noms, un nom qui revient est cité une fois avec son nombre, et
« et N autres » compte les éléments restants.

- **À l'écran** : un seul bloc en haut de l'Accueil, « Votre journée »
  (`tableau-de-bord/_composants/Briefing.tsx`). Il remplace la carte
  « À faire » et les tuiles du jour au lieu de s'y ajouter : première ligne,
  la journée (arrivées, départs, logements occupés ce soir ; prénoms des
  arrivants, logements quittés) ; ensuite les sujets de « À faire », une
  phrase chacun, « Tout voir » pour le détail, et « … » → « Copier le
  briefing » (texte dans l'ordre de la carte ; « Copié » s'affiche 2,5 s dans
  l'en-tête). Les tuiles « Arrivées et départs » plus bas montrent désormais
  la semaine (ou la période choisie, « Aujourd’hui » compris) et comptent les
  logements occupés. La ligne « facture mensuelle à valider » ouvre la fiche
  du logement sur `#factures` : la carte Propriétaire vient à l'écran et
  « Gérer » s'ouvre sur les factures. Base encore vide : « À faire » seul,
  comme avant.
- **Notification « Briefing du matin »** (type `rappel` gardé : les
  préférences des appareils restent valables ; éteinte par défaut comme
  l'ancien rappel) : le passage planifié de l'agent (`api/erp-agent.ts` →
  `api/_briefing.ts` → `src/erp/data/briefing-passage.ts`) l'envoie de 7 h à
  midi (Paris), une fois par jour et par espace (état
  `connecteurs/briefing-etat`, écrit sous condition avant l'envoi). Corps
  sans aucun nom (écran verrouillé), le plus pressant d'abord ; version du
  gérant (prix, factures) pour ses appareils (`VarianteNotification.gerant`),
  celle de l'équipe pour les autres. Le 1er, il attend jusqu'à 10 h que les
  brouillons des factures du mois soient prêts. Le serveur lit aussi l'état
  de la dernière synchronisation (`repull/etat`, une ligne) : en échec, elle
  compte dans « à vérifier », comme à l'écran. L'ancien rappel de la
  synchronisation de 4 h 17 UTC est retiré (trop tôt).
- Pas de version reformulée par l'IA : le texte calculé est déjà en
  français courant, juste sans clé IA, et ne peut pas inventer un chiffre.

**Assistant CRM (A11)** (`src/erp/data/crm-assistant.ts`, contrôles
`verifier-crm-assistant.ts`) : CRM → « Aujourd’hui ».

- **File « à appeler / à relancer aujourd’hui »** : la règle du CRM
  (`aTraiterLe` : nouvelles demandes et relances échues, comme « À faire »
  et l'agenda), triée par un **score** : étape (nouvelle demande 40, à
  rappeler 30, rendez-vous 25, échange en cours 20, en attente 10), relance
  du jour 15 ou en retard 5 + 1 par jour (15 au plus : jamais devant une
  relance du jour), demande du jour 15 / de la veille 10 / de la semaine 5,
  sans nouvelles depuis 14 jours 5, source (dossier 15, audit 10, accueil 5,
  contact 3), propriétaire 10 ou apporteur 5, 3 appels sans réponse −10, ni
  téléphone ni e-mail −20. À l'écran : « Comment la file est triée ? » en
  trois phrases sans chiffres ; le détail chiffré de chaque contact sous
  « Pourquoi cette priorité ? ». Chaque ligne se touche ; l'appel reste à
  droite. Si la prochaine action est d'appeler, « Appeler » passe avant
  l'écrit. Un membre en lecture seule y voit la prochaine action et l'appel,
  sans brouillon.
- **Propriétaire ou apporteur** : champ `profil` du contact (fiche →
  « Profil ») ; absent, déduit de la source (candidature au Cercle =
  apporteur). Aucune migration : le champ vit dans le JSON du contact.
- **Prochaine action** en une phrase (appeler, écrire après deux appels sans
  réponse, confirmer un rendez-vous, prendre des nouvelles…).
- **« Préparer la relance »** (un clic quand la prochaine action est
  d'écrire) : brouillon SMS ou e-mail rédigé par l'IA au ton de la maison,
  vouvoiement (`POST /api/erp-agent { action:
  'crm_relance', contactId, canal }` → `api/_crm-assistant.ts` →
  `src/erp/data/crm-relance.ts`), éditable, « Copier ». **Rien n'est
  envoyé** : l'ERP n'envoie ni e-mail ni SMS ; « C’est envoyé » note la
  relance dans l'historique et fixe la suivante (3 jours, 7 après un premier
  échange) ; la page confirme « Relance notée pour … » et reste sur
  « Aujourd’hui ». Le contact est relu dans la base ; ni son téléphone ni son
  e-mail ne partent à l'IA, ni en champ ni dans les textes libres : prénom
  seul (« nom non communiqué » si le nom contient « @ » ou des chiffres),
  liens, e-mails et numéros masqués dans la ville, le bien, le message, les
  notes, le motif d'attente et l'historique (`data/masquage.ts`, la même
  règle que les réponses aux avis) ; plafond mensuel de l'IA de l'espace
  (`compterAppelIA`), 20 brouillons par quart d'heure et par membre.
  Brouillon écarté s'il contient un lien, une adresse, un numéro, un
  montant, du tutoiement (mots entiers, lettres accentuées comprises :
  « vous êtes » passe) ou un chiffre absent de la fiche ; IA absente,
  plafond atteint ou brouillon écarté : un modèle sans IA à compléter (aussi
  en démonstration).
- **Connecteur Claude** : `crm_resume` rend la même file, dans le même ordre,
  avec priorité, pourquoi, prochaine action et profil. Lecture seule, aucun
  outil d'écriture ajouté.

## App installable et notifications (octobre 2026)

L'ERP s'installe comme une app (sans App Store) : icône sur l'écran d'accueil
du téléphone ou dans le Dock, plein écran, et notifications envoyées par
Apple, Google ou Mozilla selon l'appareil (Web Push).

**Le lien à envoyer à l'équipe : `https://www.labelmaisoncg.fr/erp/installer`**
(aussi dans Paramètres → Application, avec « Copier » et « Partager »).
Les personnes de terrain ont leur propre app, « Opérations », depuis leur
espace (voir « App « Opérations » et notifications » plus bas).

1. On ouvre le lien et on se connecte (son adresse e-mail et son mot de
   passe) ; la page reconnaît l'appareil.
2. **iPhone / iPad** (Safari) : Partager → « Sur l'écran d'accueil » →
   « Ajouter ». **Android** (Chrome) et **ordinateur** (Chrome, Edge) : bouton
   « Installer l'app » (sinon menu ⋮ → « Installer l'application », ou Safari
   sur Mac : Fichier → « Ajouter au Dock »).
3. On ouvre l'app et on se connecte une fois dedans (sur iPhone, l'app de
   l'écran d'accueil ne partage pas la session de Safari). L'ERP demande
   aussitôt « Recevoir les notifications ? » : « Activer » suffit. Sinon,
   Paramètres → Application → « Activer les notifications » ; « Envoyer une
   notification de test » vérifie que tout marche.

La demande à l'ouverture (`_application/DemandeNotifications.tsx`) : feuille
du bas sur téléphone, fenêtre au centre sur ordinateur, un seul bouton
principal « Activer » qui ouvre l'autorisation du système dans le même
toucher (obligatoire sur iPhone : jamais au chargement), tous les types par
défaut. Elle ne s'affiche que si toutes ces conditions sont réunies
(`demandeNotifications`, `data/notifications.ts`, contrôlée par
`verifier-notifications.ts`) : clés présentes sur le serveur, autorisation
encore jamais demandée sur cet appareil, navigateur capable (sur iPhone,
seulement dans l'app de l'écran d'accueil : dans Safari, c'est la
proposition d'installation qui parle), appareil pas encore abonné, pas de
« Plus tard » depuis moins de 7 jours, ni proposition d'installation ni
autre fenêtre ouverte, jamais en démonstration. Acceptée : « Notifications
activées » en bas de l'écran. Refusée : la marche à suivre (Réglages de
l'iPhone → Notifications → Label Maison), et plus jamais reproposée. Pour la
voir en capture d'écran avec la démo : construire avec
`VITE_ERP_DEMO=1 VITE_ERP_APERCU_NOTIFICATIONS=1` (sans effet en production).

Une proposition discrète « Installez l'app » apparaît sur l'Accueil (téléphone,
ou navigateur qui installe d'un clic) ; elle ne revient plus après « Plus
tard » et disparaît une fois l'app installée.

### Activer les notifications (une fois, par le gérant)

1. Paramètres → Application → Avancé → « Générer les clés ». La paire est
   montrée **une seule fois** et n'est enregistrée nulle part par l'ERP.
2. Vercel → projet du site → Settings → Environment Variables : ajouter
   `VAPID_PUBLIC_KEY` et `VAPID_PRIVATE_KEY` (Production), et au besoin
   `VAPID_SUBJECT`, puis redéployer.
3. Chaque membre active les notifications sur chacun de ses appareils.

Sans ces variables, tout fonctionne et Paramètres affiche « Notifications pas
encore activées sur le serveur ». Remplacer les clés oblige chaque appareil à
réactiver ses notifications.

### Les notifications

Un interrupteur par type, réglé par appareil (Paramètres → Application). Tout
est activé par défaut, sauf le briefing du matin. Un toucher ouvre le bon écran.

| Type | Quand | Ouvre |
|---|---|---|
| Nouvelle réservation | Réservation confirmée ou en cours, pas encore terminée (plus de 5 d'un coup : une seule notification « N nouvelles réservations ») | la réservation |
| Réservation annulée ou modifiée | Annulation, nouvelles dates, nombre de voyageurs | la réservation |
| Nouveau message d'un voyageur | Message de moins de 48 h | la conversation |
| L'agent a répondu | L'agent a répondu à la place de l'équipe | la conversation |
| L'agent vous passe la main | L'agent transmet, avec la raison en clair | la conversation |
| Problème signalé dans un logement | Raison « litige » de l'agent, ou mots d'un problème en français ou en anglais (panne, fuite, clé, bruit, ménage…) | la conversation |
| Nouvel avis | Avec la note ; « Avis à lire » sous 4,5 | la réservation |
| Mise à jour des plateformes en échec | Une fois par jour au plus | Paramètres → Plateformes |
| Briefing du matin | Le point de la journée, une fois par jour à partir de 7 h (passage planifié de l'agent ; version du gérant avec prix et factures). Ancien « Rappel du matin » : même réglage, préférences gardées | l'Accueil |
| Annonce à l'équipe | Le gérant publie une annonce avec « Prévenir aussi par notification » (une seule fois par annonce, jamais une annonce retirée) | l'Accueil |

Un même message ne donne qu'**une** notification, la plus importante pour
l'appareil (problème, puis l'agent passe la main, l'agent a répondu, nouveau
message). Chaque notification a une clé : elle ne part jamais deux fois.

### Fonctionnement

- **App** : manifeste `public/erp-app/manifest.webmanifest` (portée et départ
  `/erp`), icônes générées par `node scripts/icones-erp.mjs`, balises Apple
  ajoutées à la coquille `/erp` par `scripts/spa-shells.mjs`, encoche et
  barre d'accueil de l'iPhone gérées par `env(safe-area-inset-*)` (`erp.css`).
  Manifeste, icônes et service worker sont servis hors de `/erp` : le
  navigateur les lit sans session, et `middleware.ts` n'a pas changé.
- **Service worker** (`public/erp-sw.js`, portée `/erp`) : ne garde en cache
  que les fichiers `/assets/` (noms uniques à chaque version) ; pages, données
  et `/api` passent toujours par le réseau ; sans réseau, une courte page
  « Pas de connexion internet ». Chaque déploiement le remplace et vide
  l'ancien cache.
- **Envoi** : `api/erp-repull-sync.ts`, `api/erp-repull-webhook.ts` et
  `api/erp-agent.ts` enveloppent leur travail dans `surveiller`
  (`src/erp/data/notifications-envoi.ts`) : photo de la base avant et après,
  puis envoi de ce qui est nouveau (`notificationsEntre`,
  `src/erp/data/notifications.ts`). Un envoi raté ne casse jamais la
  synchronisation ni l'agent ; un appareil expiré (404/410) est retiré ; sans
  clés, rien n'est lu en plus.
- **Chiffrement** : `src/erp/data/web-push.ts` (WebCrypto, sans dépendance),
  RFC 8291 (contenu chiffré de bout en bout : Apple, Google ou Mozilla ne
  voient que l'appareil destinataire) et RFC 8292 (signature VAPID), contrôlé
  contre le vecteur officiel de la RFC (`verifier-notifications.ts`).
- **Appareils** : collection technique `connecteurs` (réservée aux gérants),
  un enregistrement par appareil (`notifications-appareil-…`) et le journal
  des envois (`notifications-journal`, 800 dernières clés). Route :
  `/api/erp-notifications` (membres gérant ou opérations ; clés et annonces à l’équipe : gérant).
- **Limites** : iPhone et iPad avec iOS / iPadOS 16.4 ou plus récent, app
  ajoutée à l'écran d'accueil (Safari seul ne reçoit pas de notifications).
  Les notifications partent quand l'ERP apprend la nouveauté : webhook Repull
  (quasi immédiat, offre Starter), passage de l'agent, ou synchronisation
  (quotidienne, ou « Synchroniser maintenant »).

### Annonces à l'équipe

Un court message du gérant à toute l'équipe de l'espace (premier essai :
« Bonjour 👋 »). Rien à voir avec l'annonce d'un logement sur Airbnb ou
Booking (`versionsAnnonce`).

- **Gérant** : Paramètres → Annonces à l'équipe (`/erp/parametres/annonces-equipe`,
  onglet après Application) : « Nouvelle annonce à l'équipe » (titre, texte,
  « Prévenir aussi par notification », cochée, proposée seulement quand les
  notifications marchent sur le serveur), « Publier » ; « Sur l'Accueil de
  l'équipe » : les annonces publiées, « Retirer » puis « Retirer de
  l'Accueil ». Tant que l'espace n'a aucune annonce, le formulaire propose
  « Bonjour 👋 / Bienvenue dans l'app {nom} » au nom de la conciergerie
  (`nomConciergerie`), à publier en un clic. Une erreur inattendue de la
  notification propose « Réessayer » (même annonce, jamais deux envois).
- **Chaque membre** (gérant, opérations, lecture) : une carte en haut de
  l'Accueil, une ligne par annonce publiée (3 au plus, texte sur 4 lignes
  et « Lire la suite »), jusqu'à « J'ai lu ». La recherche nomme leur
  historique « Annonce à l'équipe : … ». La
  fermeture reste sur l'appareil (localStorage, par espace et par
  personne) : un membre qui n'est pas gérant n'écrit rien. Un membre qui
  arrive plus tard voit les annonces encore publiées.
- **Données** : collection `annoncesEquipe` (`erp.enregistrements`), dans
  `erp.ecriture_gerant_seulement` : la base refuse toute écriture d'un autre
  compte. Règles pures : `src/erp/data/annonces-equipe.ts`.
- **Notification** : « Publier » enregistre l'annonce, puis appelle
  `POST /api/erp-notifications { action: 'annoncer', id }` (gérant de
  l'espace de l'en-tête seulement). Le serveur relit l'annonce dans la base,
  l'envoie aux appareils de l'espace qui acceptent le type « Annonce à
  l'équipe », clé `annonce-<id>` au journal des envois. Un envoi raté laisse
  l'annonce publiée et le dit. En démonstration, aucun appel au serveur.
- **Mise en service** (Supabase → SQL Editor, une fois) : relancer
  `supabase/erp-espaces.sql` dans sa passe actuelle (`recette = ok`) ; base
  d'avant les espaces : `supabase/erp-acces-gerants.sql`. Une ligne y est
  ajoutée (`annoncesEquipe` dans `erp.ecriture_gerant_seulement`). Le code
  marche sans : seule la garantie de la base manque jusque-là.

## Espaces (octobre 2026)

La même application sert plusieurs équipes, chacune dans son **espace** :
Label Maison, puis Sens. Se connecter à l'espace de Label Maison, c'est voir
les données et le Repull de Label Maison ; à celui de Sens, ceux de Sens.
Aucune donnée ne passe d'un espace à l'autre. Mise en service pas à pas, pour
les gérants : [`espaces-mise-en-service.md`](./espaces-mise-en-service.md).

### Dans la base (`supabase/erp-espaces.sql`)

- Table `erp.espaces` (code, nom, actif, `repull_workspace`, `config` non
  secrète). Label Maison a l'identifiant fixe
  `4c4d0000-0000-4000-8000-000000000001` et reçoit toutes les données d'avant.
- Colonne `espace` sur `enregistrements`, `etat_automatisations`, `membres`,
  `historique`. Toutes les règles RLS portent dessus, plus une règle
  **restrictive** « cloison des espaces » qui tient même si une règle plus
  large est ajoutée un jour. Les fichiers du stockage appartiennent à l'espace
  de leur premier dossier (`<espace>/menages/…`), Label Maison sinon.
- **Deux passes** (une ligne à changer en haut du fichier) :
  1. passe 1 : colonne avec Label Maison par défaut, nouvelles clés en plus
     des anciennes. L'ancien et le nouveau code marchent tous les deux ;
  2. passe 2, au moins 24 h après la PLUS TARDIVE de la mise en ligne du code
     et de la passe 1 : clés primaires `(espace, …)` (le même identifiant
     possible dans deux espaces, une adresse membre de plusieurs espaces),
     plus de valeur par défaut. Ne savent plus écrire ensuite : l'ancien code,
     et une page du nouveau code ouverte avant la passe 1 (restée en mode
     « historique » jusqu'à son rechargement de la nuit, qui relit
     `qui_suis_je`). D'où l'attente.
- Un autre espace que Label Maison ne peut être créé qu'après la passe 2
  (déclencheur `espaces_apres_passe_2`, message « Passe 2 d'abord ») : avant,
  ses lignes techniques (`repull/etat`, `agent/etat`, `etat_automatisations/
  global`) heurteraient celles de Label Maison (erreur 23505).
- Compte technique `serveur@labelmaisoncg.fr` (`app_metadata.erp_role =
  serveur`, posé par le script) : il ne voit **que** l'espace nommé par
  l'en-tête `x-erp-espace`, avec les droits d'un gérant ; sans en-tête, rien.
- **Membres liés à leur compte** : `erp.membres.uid` (et `lie_le`). Un
  membre n'est reconnu que par SON compte, jamais par la seule adresse :
  `mes_espaces`, `qui_suis_je`, les règles RLS et `role_membre` ne comptent
  que les lignes liées, avec un jeton émis après l'activation
  (`erp.jeton_apres`, jeton `iat` > `lie_le`). À la passe 1 (une seule fois,
  à l'ajout de la colonne), les membres d'aujourd'hui sont liés au compte
  confirmé de même adresse. Ensuite, une ligne se lie par
  `erp.activer(code)` (code de l'invitation, adresse confirmée du compte
  connecté) ; l'adresse changée dans la fiche délie la ligne. L'ERP n'écrit
  jamais `uid` (droits par colonne : `espace`, `email`, `nom`, `role`).
  `erp.lier_compte(email, code_espace)` : SQL Editor seulement, pour un
  compte créé par un gérant (Add user, Auto Confirm), jamais pour un compte
  venu de l'inscription publique.
- Fonctions : `erp.qui_suis_je()` (espaces et rôle du compte),
  `erp.espaces_actifs()`, `erp.secret_espace()` (coffre Vault, serveur
  seulement, pour l'espace de l'en-tête seulement, jamais pour Label Maison),
  `erp.ranger_secret()` (SQL Editor seulement), `erp.recette_espaces()`
  (essai des règles, annulé). Relancer le fichier après la passe 2 ne recrée
  rien en double (`erp.cle_par_espace`).
- `erp.invitations` (invitations des membres : empreinte SHA-256 du code,
  espace, adresse, échéance, usage) reste sans règle d'accès :
  `erp.inviter_membre(espace, email, empreinte)` (gérant de l'espace, ligne
  déjà dans l'équipe et pas encore liée ; une nouvelle invitation remplace
  la précédente) et `erp.activer(code)` seulement.
- **Espaces ouverts par invitation** (`erp.invitations_espace`, sans règle
  d'accès : seules les fonctions ci-dessous la lisent ou l'écrivent) :
  `erp.inviter_espace(nom, email, empreinte)` (gérant de Label Maison en
  personne, pas le compte serveur ; après la passe 2 ; une invitation en
  attente par adresse, 14 jours, avec l'empreinte du code du lien, refusée
  si l'adresse est déjà membre d'un espace ; nom d'une ligne, jamais
  « Label Maison » ; renouveler remplace le code), `erp.espaces_plateforme()`,
  `erp.annuler_invitation_espace(id)`, `erp.suspendre_espace(espace, actif)`
  (jamais Label Maison) ; `erp.activer(code)` rattache l'invitation au
  compte connecté (adresse **confirmée**) ; `erp.creer_espace()` : avec
  l'invitation activée par CE compte (jeton émis après l'activation), crée
  l'espace au nom de l'invitation (code tiré du nom), en fait la personne
  gérante (ligne liée à son compte), consomme l'invitation ; idempotent (un
  nouvel appel rend le même espace, jamais un second).
  `erp.qui_suis_je()` rend aussi `invitations_espace` : toujours une liste,
  `[{ "nom_espace": "Sens", "expire_le": "…" }]` pour une adresse confirmée
  invitée, `[]` sinon ; la page d'accès (`middleware.ts`) laisse entrer un
  compte sans espace qui a une telle invitation, l'ERP lui montre alors
  « Créez l'espace de votre conciergerie » (`layout/CreerEspace.tsx`).
- **Secrets d'un espace** rangés par SON gérant (ou le compte serveur avec
  l'en-tête de l'espace) : `erp.enregistrer_secret_espace(espace, nom,
  valeur)` (`repull_cle`, `repull_webhook`, coffre Vault, jamais pour Label
  Maison), `erp.regler_repull_espace(espace, workspace)` (workspace de SA
  clé, `config.repull.workspace`), `erp.reglages_repull_espace(espace)`
  (enregistrés oui / non, jamais leur valeur). La recette essaie chaque refus
  (sans invitation, adresse non confirmée, invitation d'une autre adresse ou
  expirée, second espace, secrets d'un autre espace, espace suspendu).
- `erp-installation.sql`, `erp-connecteurs-gerants.sql` et
  `erp-acces-gerants.sql` refusent de tourner une fois les espaces en place
  (ils remettraient les règles d'avant).

### Dans le code

- **Base « historique »** : tant que le SQL n'est pas passé, `qui_suis_je` ou
  la colonne `espace` manquent ; le navigateur et le serveur le voient et font
  **exactement comme avant** (Label Maison, sans colonne ni en-tête). Le code
  peut donc partir en ligne avant le SQL.
- Navigateur : `store.tsx` ouvre l'espace du compte (`quiSuisJe`, Label Maison
  d'abord, dernier choix retenu sur l'appareil) ; `synchro.ts` filtre, écrit et
  supprime dans cet espace, ignore le temps réel des autres espaces, et ne
  reprend une file locale que pour le même espace et le même compte. Les appels
  aux routes `/api` portent l'en-tête `x-erp-espace` (même origine) ; les
  requêtes à Supabase, elles, n'en ont pas besoin (règles par membre).
- Serveur : `baseErp(c, espace)` écrit avec le compte serveur et l'en-tête de
  l'espace ; sans compte serveur prêt, avec le compte d'équipe et **pour Label
  Maison seulement**. `verifierMembre(jeton, { espace })` vérifie le rôle dans
  l'espace de l'en-tête (Label Maison à défaut : anciennes versions de l'app).
  Le site public (formulaires, dossier propriétaire) et la clé fixe
  `MCP_CRM_TOKEN` restent dans Label Maison.
- **Marque de l'espace** (`src/erp/data/marque-espace.ts`, contrôles
  `verifier-marque-espace.ts`) : dans un autre espace que Label Maison, les
  écrans principaux ne montrent ni le nom de Label Maison, ni ses associés,
  ni ses formulaires. Titre de l'onglet « ERP · Sens » ; « Part du
  propriétaire » d'un séjour : « Ménage (pour Sens) », « Commission Sens
  (20 %) » ; réponse rapide « Merci » signée comme l'agent de l'espace
  (« L'équipe Sens », ou la signature réglée) ; CRM sans « Lien du dossier
  propriétaire » ni « Envoyer le dossier » (ses réponses iraient au CRM et à
  la boîte de Label Maison), et sans la phrase sur les formulaires du site ;
  « Suivi par » : les membres de l'espace (gérant, opérations ; valeur :
  leur adresse) au lieu d'Abdel et Kamel, que Claude ne voit ni ne règle
  dans cet espace (`outilsDeLEspace` : pas de `suivi_par`) ; carte et page
  d'installation de l'app sans nom (« Installez l'app » : l'app installée
  garde le nom de son manifeste, commun à tous les espaces) ; ni Telegram
  (groupe de Label Maison) dans les réglages de l'agent, ni l'identité
  légale de Label Maison dans Paramètres → Société (le nom de l'espace
  seulement). Label Maison :
  textes d'avant, à l'identique (la réponse « Merci » suit la signature
  réglée de l'agent, « L'équipe Label Maison » par défaut). Le connecteur Claude (OAuth,
  MCP) et l'agenda du CRM suivent l'espace de leur jeton ou de leur lien
  (`espaceOuvertAuJeton`, voir « CRM d'appels et connecteur Claude ») ;
  l'invitation « Créer mon compte » part au nom de l'espace ouvert.
- `configurationEspace(espace)` (`api/_erp-espaces.ts`) : Label Maison garde
  ses variables Vercel (`REPULL_WORKSPACE_LM` facultatif : en-tête
  `X-Workspace-Id` sur chacun de ses appels, et ses événements reconnus).
  Un autre espace n'en reprend **aucune** : Repull par sa propre clé (coffre,
  rangée par son gérant dans Paramètres → Plateformes via
  `api/erp-espaces.ts`, avec le workspace de SA clé s'il en a donné un) ou,
  cas déclaré par Label Maison seulement, par un workspace sur le compte de
  Label Maison (`repull_workspace`, même clé de compte, permis seulement une
  fois `REPULL_WORKSPACE_LM` posé et jamais égal à lui) ; sa part
  d'appels Repull (`config.repull.budgetMois`, 150 par défaut, 0 permis : la
  part de Label Maison n'est pas entamée) ; secret de webhook propre (coffre)
  pour une adresse propre ; agent IA avec la clé Claude commune, un plafond de
  décisions par mois (`config.agent.plafondMois`, 300 par défaut), en pause
  tant que l'équipe ne l'allume pas, jamais de Telegram. Sans workspace ni
  clé, Repull est coupé pour l'espace (message clair).
- Passages planifiés (cron de synchronisation, réveil de l'agent) : chaque
  espace actif à son tour, Label Maison d'abord ; Label Maison seul : même
  passage et même réponse qu'avant. Webhook (`espaceDuWorkspace`) : un
  événement « tagué » `workspaceId` va à l'espace qui a déclaré ce workspace
  (Label Maison compris, par `REPULL_WORKSPACE_LM`) ; tant qu'aucun espace
  n'en a déclaré, tout reste à Label Maison comme avant ; ensuite, un
  workspace inconnu est ignoré — jamais versé dans Label Maison. Un espace
  avec son propre compte Repull a son adresse :
  `/api/erp-repull-webhook?espace=<code>`, signée avec SON secret ; un espace
  inconnu, fermé ou sans secret y reçoit la réponse d'une signature fausse.
- **Fichiers** (`signeurFichiersErp`, `deposeurFichiersErp`,
  `api/_erp-repull.ts`) : chaque espace signe et dépose dans SON dossier du
  stockage (`<espace>/…` ; chemins d'avant pour Label Maison), règle
  `fichierDeLEspace` (`data/espaces.ts`) vérifiée avant tout appel au
  stockage : jamais un chemin d'un autre espace, même connu. Label Maison :
  compte d'équipe, comme avant ; un autre espace : compte serveur avec son
  en-tête (règles du stockage de `erp-espaces.sql`), jamais le compte
  d'équipe. Documents et photos de l'espace propriétaire, photos de l'espace
  opérations et guides de l'agent en profitent ; un espace qui ne peut pas
  encore signer (compte serveur pas prêt) le dit (`stockageFerme`).
- **Plateforme** (`api/erp-espaces.ts`, Paramètres → Espaces, gérants de
  Label Maison) : inviter une conciergerie (e-mail avec l'expéditeur de Label
  Maison, lien « Créer mon compte » du site fixe
  `…/erp#creer=<adresse>&code=<code>`, sinon lien à copier), invitations en
  attente, suspendre ou rouvrir (avec confirmation). Chaque appel à la base
  passe avec la session du gérant (la base revérifie).
  Dans un nouvel espace : carte « Votre compte Repull » (Plateformes ; la
  clé est essayée chez Repull, en lecture seule, avant d'être rangée ; une
  clé refusée plus tard renvoie vers Paramètres → Plateformes → « Remplacer
  la clé », jamais vers Vercel) et
  « Démarrage » à l'accueil (Repull, plateformes, équipe, propriétaires et
  responsables, agent).
- Nom de l'espace : signature par défaut de l'agent (« L'équipe Sens » ;
  Label Maison inchangé), notification d'essai, en-tête imprimé des bilans
  et factures de l'espace propriétaire (identité légale de Label Maison
  décidée par l'identifiant de l'espace, `VueProprietaire.conciergerie.espace`,
  jamais par le nom).
- Retour en arrière du SQL : la première écriture refusée (colonne `espace`
  inconnue) fait oublier l'état gardé de la base, relue au prochain appel.
- Toujours en lecture seule sur les plateformes : `ecritureRepullPermise` et le
  verrou de l'agent sont inchangés ; l'en-tête de workspace n'ouvre rien.

### Pas encore (étapes suivantes)

- Choix de l'espace à l'écran : un membre de deux espaces connecte Claude
  (ou crée un lien d'agenda) pour l'espace ouvert, celui que l'ERP a choisi
  (Label Maison d'abord, puis le dernier ouvert sur l'appareil).
- Les autorisations de Claude survivent au retrait du gérant qui les a
  données, jusqu'à « Déconnecter Claude » dans l'espace (à revérifier à
  chaque appel plus tard).
- Vérification de types de `api/` : elle passe sans erreur avec `@types/node`,
  qui n'est pas encore dans les dépendances de développement.
- Identité légale par espace : dans un autre espace, contrat de mandat,
  relevés et factures de Finance et Conformité portent encore celle de
  Label Maison ; Paramètres → Société n'affiche que le nom de l'espace (voir
  les limites dans `espaces-mise-en-service.md`).

## Espace propriétaire (octobre 2026)

Une page à part, **`https://www.labelmaisoncg.fr/espace-proprietaire`** (pas
`/proprietaires`, qui reste la page commerciale du site), pour rassurer les
propriétaires sans leur ouvrir l'ERP : mobile d'abord, épurée, en lecture
seule. Quatre onglets (barre du bas sur téléphone, en-tête sur ordinateur) :

| Onglet | Ce que voit le propriétaire |
|---|---|
| Accueil | Ses logements (photo, nom), le net du mois en cours et du mois dernier (nuits, occupation ; « Bilan publié » ou « Provisoire »), les prochaines arrivées, les contacts de Label Maison, les derniers documents. |
| Logements | « Mes logements » : une fiche par logement (photo, nom, ville) avec les 12 derniers mois terminés : revenu net par mois (graphique en barres, survol et clavier, tableau mois par mois), occupation, prix moyen par nuit, séjours et nuits, comparaison avec les mêmes mois de l'an dernier quand il y a des données ; note moyenne et derniers avis (partie publique seulement) ; séjour en cours et prochains séjours. L'accueil mène à chaque fiche. |
| Calendrier | Un mois par logement : nuits réservées et libres, arrivées et départs (bande dorée du milieu du jour d'arrivée au milieu du jour de départ), navigation de mois en mois, séjours du mois. |
| Finances → Bilans | Les mois **publiés** seulement : séjours, nuits, encaissé, frais des plateformes, ménage, commission Label Maison, net propriétaire, le mot de Label Maison ; « Télécharger en PDF » (impression du navigateur, en-tête légal de Label Maison). |
| Finances → Factures | Les factures partagées : montant TTC, échéance, statut, PDF (voir « Phase 2 »). |
| Documents | Rangés par catégorie (Contrat, Attestation, Bilan, Facture, Autre), ouverts par un lien signé de 2 minutes. |

Données des voyageurs : « Prénom N. » et le nombre de personnes, rien d'autre
(ni contact, ni pays, ni avis, ni code d'accès, ni identifiant de réservation).

### Côté gérant (fiche logement → carte « Propriétaire » → « Inviter » / « Gérer »)

- **Accès** : adresse e-mail, « Inviter dans l'espace propriétaire » (lien
  valable 7 jours, à usage unique, envoyé par e-mail et affiché pour le
  copier), état « Invité le… » / « Connecté le… » / « Accès retiré »,
  « Retirer l'accès » (déconnexion immédiate). Réservé au gérant.
- **Bilans mensuels** : les six derniers mois terminés, calculés
  automatiquement ; « Ouvrir » montre l'**aperçu exact**, le mot de Label
  Maison, puis « Publier » / « Dépublier » / « Mettre à jour » (signalé quand
  les chiffres ont changé depuis la publication). Les chiffres sont figés à la
  publication : le propriétaire voit exactement l'aperçu.
- **Documents partagés** : catégorie, titre, « Déposer un document »
  (`stockage://erp-fichiers/proprietaires/<id>/…`), ouvrir, retirer.
- **Voir son espace** : l'espace complet tel que le propriétaire le voit.

Démo (`VITE_ERP_DEMO=1`) : SCI Les Tilleuls est connectée, avec le bilan
d'août publié et deux documents ; son espace :
`/espace-proprietaire?apercu=pro-sci-tilleuls`.

### Fonctionnement

- **Connexion sans compte ni SQL** (`src/erp/data/proprietaire-acces.ts`) :
  jeton aléatoire de 32 octets dans un lien `…/espace-proprietaire#jeton=…`
  (après `#` : jamais envoyé aux serveurs ni dans les journaux, retiré de la
  barre d'adresse à l'ouverture). Seule son empreinte SHA-256 est gardée,
  dans la collection `accesProprietaires` (un enregistrement par
  propriétaire, écrit **uniquement par le serveur**). Le lien ouvre une
  session : cookie `lm_proprio` HttpOnly, Secure, SameSite=Lax, limité à
  `/api/espace-proprietaire`, signé HMAC-SHA256 avec `PROPRIETAIRE_SECRET`,
  30 jours. Chaque appel revérifie l'accès en base (actif, même version) :
  retirer l'accès ou changer d'adresse ferme aussitôt toutes les sessions.
  Le propriétaire peut redemander un lien avec son adresse (valable 1 heure,
  réponse identique que l'adresse ait un accès ou non, 5 demandes par heure).
- **Espaces** (`api/_acces-externe.ts`, commun aux propriétaires et aux
  opérations) : un accès appartient à l'espace du gérant qui invite (en-tête
  `x-erp-espace`, `verifierMembre(jeton, { espace })`). Il est écrit, lu et
  revérifié dans la base de cet espace seulement ; le lien porte l'espace
  (`#espace=<uuid>&jeton=…`, l'espace n'est pas secret ; un ancien lien sans
  espace vaut Label Maison) et la session signée aussi (genre, propriétaire,
  espace, version) : un cookie dont on change l'espace est refusé.
  « Recevoir mon lien » cherche l'adresse dans chaque espace actif et envoie
  un lien par espace (chaque espace est un compte à part), avec la même
  réponse neutre. E-mails et écrans portent le nom de l'espace ; un autre
  espace que Label Maison n'utilise ni l'expéditeur ni les contacts de Label
  Maison (sa fiche : `config.email.expediteur`, `config.contacts` ; sans
  expéditeur, le gérant copie le lien). Base d'avant les espaces : Label
  Maison seul, comme avant. Photos déposées et documents (`stockage://`) sont
  signés dans l'espace de l'accès seulement (`signeurFichiersErp`, voir
  « Espaces ») : jamais le fichier d'un autre espace.
- **Lecture seule** : le propriétaire ne lit jamais la base.
  `api/espace-proprietaire.ts` (via `api/_proprietaire.ts`, session du compte
  d'équipe) lit puis filtre par propriétaire avant tout calcul, et ne renvoie
  que la `VueProprietaire` (`src/erp/data/types-proprietaire.ts`). Le serveur
  n'écrit que les accès ; rien sur les logements, réservations, prix ou
  calendrier, et rien vers les plateformes.
- **Calculs** (`src/erp/data/proprietaire.ts`, purs, partagés par le serveur,
  l'aperçu du gérant et la démo) : bilan d'un mois **au prorata des nuits**
  (un séjour du 29 août au 3 septembre compte 3 nuits en août et 2 en
  septembre, montants partagés de même) ; commission Label Maison =
  (encaissé − frais de plateforme − ménage) × taux du mandat en vigueur ;
  net = encaissé − frais − ménage − commission, au centime sur chaque ligne ;
  occupation = nuits réservées / (jours du mois × logements). Fiche d'un
  logement (`ficheLogement`) : un mois n'est « suivi » qu'à partir du premier
  séjour connu dans l'ERP (et du début du mandat) — avant, ce n'est pas un
  mois vide mais un mois sans données, exclu des totaux et du graphique ;
  l'occupation se compte sur les jours gérés ; la comparaison ne garde que
  les mois suivis les deux années ; prix moyen par nuit = encaissé hors
  ménage / nuits ; avis : jamais le « Message privé » ni adresse, numéro ou
  lien glissé dans le texte, voyageur en « Prénom N. ». La fiche
  d'attente des logements importés (`repull-proprietaire-a-renseigner`)
  n'a jamais d'espace.
- **Changement de propriétaire** (`changerProprietaire`, data/proprietaire.ts) :
  le logement garde `proprietaireDepuis` (premier jour du nouveau
  propriétaire) et `proprietairesPrecedents` (chacun jusqu'à la veille du
  changement). Le nouveau ne voit rien d'avant (chiffres, avis, séjours,
  calendrier) ; l'ancien garde ses mois d'avant, et ses bilans publiés
  restent figés tels quels. Côté gérant, `etatBilan` ne propose jamais de
  « Mettre à jour » un bilan publié dont un logement a changé de
  propriétaire (« Logement transféré depuis le … »). Le premier vrai
  propriétaire d'un logement importé (fiche d'attente) reçoit tout son
  historique. Un séjour est à celui qui avait le logement le jour de
  l'arrivée, toutes ses nuits comprises (chiffres, avis, calendrier,
  séjours) ; un séjour arrivé avant le début du mandat n'est pas compté.
  Taux de commission : le mandat du propriétaire, jamais celui d'un autre ;
  sans mandat à lui, ni taux ni ligne « Commission » (le gérant voit
  « Taux de commission à renseigner »). Le serveur ne lui remet que ses
  mandats, ses séjours, et le séjour d'un autre qui déborde sur sa période
  réduit à ses dates (pour l'occupation). Toutes ses périodes comptent
  (avant et après un changement) ; un aller-retour le même jour efface la
  période vide et rend l'état d'avant. Calendrier borné : un jour qui n'est
  pas à lui est grisé (« Avant votre arrivée », « Après votre départ »), ni
  libre ni réservé ; calendrier, bilan et « Ce mois-ci » comptent la même
  occupation. Après un changement, l'ancien garde son calendrier sur sa
  période et lit « Plus de logement en gestion depuis le … ».
- **Documents d'un autre espace** que Label Maison : signés dans son dossier
  avec le compte serveur. Si l'espace ne peut pas encore signer (compte
  serveur pas prêt), le propriétaire lit « Les documents ne peuvent pas être
  ouverts pour l'instant. Contactez votre conciergerie. » (409) ; un document
  dont le fichier n'est pas de son espace reste « introuvable ».
- **Collections** (ajoutées à `collections.ts`, sans SQL, compatibles avec
  les anciennes sauvegardes) : `accesProprietaires`, `documentsProprietaire`,
  `bilansProprietaire` (id `<proprietaireId>-<AAAA-MM>`, statut `brouillon` /
  `publie`, chiffres figés).

### Phase 2 : factures partagées et relances de paiement

- **Factures** (onglet « Finances » → « Factures » ; bilans et factures sous
  un même onglet pour garder cinq onglets dans la barre du bas) : le
  propriétaire voit les factures dont il est le `proprietaireId` ET qui sont
  partagées (`Facture.partageeLe`), ni brouillon ni annulée : numéro, date,
  échéance, montant TTC, statut « À payer » (neutre), « En retard » (alerte,
  jamais rouge), « Payée le… » (succès), dernier rappel envoyé. Le PDF est un
  `DocumentProprietaire` de catégorie `facture` avec `factureId`, ouvert par
  lien signé ; sans PDF, la facture s'imprime depuis l'espace. Une facture
  qui n'est plus partagée disparaît, son PDF aussi (liste et lien signé).
  L'accueil signale d'une ligne les factures à régler.
- **Relances** (`src/erp/data/relances.ts`, `api/_relances.ts`) : pour les
  factures partagées et à payer seulement. Calendrier par espace (J+5, J+15,
  J+30 après l'échéance par défaut), une relance par étape et par facture
  (`<factureId>-r<niveau>`) ; très en retard d'un coup : seule l'étape la
  plus avancée ; une relance encore à valider est remplacée par l'étape
  suivante ; tout s'arrête dès que la facture est payée, annulée ou plus
  partagée (« sans objet »). Mode « proposer » (par défaut) : le passage
  quotidien ne fait que proposer, un gérant valide chaque envoi. Mode
  « automatique » : envoi par e-mail avec l'expéditeur de l'espace (jamais
  celui de Label Maison pour un autre espace) ; sans expéditeur ou sans
  adresse, la relance reste à valider avec le motif. Jamais deux fois : la
  relance est notée envoyée avant l'envoi, remise à valider si l'envoi
  échoue. Message poli et court, signé du nom de l'espace : montant TTC,
  numéro, échéance, virement avec le numéro en référence ; aucune
  coordonnée bancaire.
- **Passage quotidien** : `api/erp-repull-sync.ts` (cron) appelle
  `relancesDuJour()` pour chaque espace actif avant la synchronisation
  Repull, sans jamais la bloquer (base d'avant les espaces : Label Maison).
- **Données serveur** : collections `relancesPaiement` et
  `reglagesRelances` (id `relances` : actif, mode, jours), lues et écrites
  par le serveur seul, dans la base de chaque espace ; le navigateur ne les
  synchronise pas. Gérant : `GET ?action=relances`, `POST relance-envoyer`,
  `relance-annuler`, `relances-reglages` (api/espace-proprietaire.ts, gérant
  de l'espace).
- **Écrans du gérant** : `logements/_composants/FacturesProprietaire.tsx`
  (partager ou non chaque facture, joindre son PDF, « Marquer payée » avec
  la date du paiement, « Annuler le paiement » ; gérant seulement), dans le
  panneau « Espace propriétaire » après « Bilans mensuels » ;
  `RelancesPaiement.tsx` (réglages, relances à valider : « Échéance 20 août ·
  Dernier rappel le 19 sept. », même nom d'étape que l'e-mail, aperçu du
  message, « Envoyer » ou « Ne pas envoyer » après une relance par
  téléphone ; historique : envoyées, annulées, sans objet ; une facture
  marquée payée sort aussitôt de la file ; `useRelances()`) dans
  Paramètres → Accès, section Propriétaires, et, limité au propriétaire,
  dans son panneau. « Je valide chaque relance » (`proposer`) reste le
  réglage par défaut.
- **Contrôles** : `verifier-relances.ts` (calendrier, idempotence, arrêt au
  paiement, message, ce que voit chaque propriétaire) et
  `scripts/verifier-espaces-serveur.ts` (chaque espace chez lui, « proposer »
  n'envoie jamais seul, pas d'expéditeur = pas d'envoi, jamais deux fois).

### Phase 3 : factures mensuelles et identité de la société

- **Calcul** (`src/erp/data/factures-mensuelles.ts`) : une facture par
  propriétaire et par mois (id `fm-<proprietaireId>-<AAAA-MM>`), tirée de
  son bilan (`bilanMensuel`) : commission de gestion de chaque logement (taux
  du mandat de ce propriétaire, base nette = encaissé − commissions des
  plateformes − ménage), puis un ménage par séjour. Prolongations
  (`src/erp/data/sejours-consolides.ts`, `consoliderSejours`) : des
  réservations qui se suivent, même voyageur, même logement = un séjour =
  un ménage, dans le bilan comme dans la facture. Prorata des nuits d'un
  mois à l'autre, comme le bilan : commission et ménages de la facture sont
  ceux du bilan, au centime.
- **Brouillon** : préparé à partir du 1er pour le mois terminé par le
  passage planifié de l'agent (`api/erp-agent.ts` →
  `api/_factures-mensuelles.ts`, une fois par mois et par espace, trace
  `passagesFacturesMensuelles`, n'ajoute que les factures absentes :
  `BaseErp.ajouterSiAbsent`), ou à la demande dans le panneau « Espace
  propriétaire » → Factures (« Préparer », « Facturer un autre mois »).
  Les lignes calculées ne se modifient pas ; un ajustement s'ajoute avec sa
  raison. « Ne pas facturer ce mois » écarte le brouillon (gardé, pas recréé,
  plus proposé en tête : il reste dans « Facturer un autre mois »).
- **Validation** (`validerAvecLaBase`) : le contenu final est d'abord
  enregistré sans numéro (émise le jour, échéance à 15 jours ; lignes,
  montants, identités de la conciergerie et du propriétaire, logements,
  mentions et TVA figés), puis la BASE attribue le numéro `AAAA-NNNN`
  (`rpc('numeroter_facture', { p_id })` avec l'en-tête de l'espace : gérant
  seulement, compteur verrouillé, idempotente), puis la facture est relue.
  Le navigateur ne numérote jamais en production (démonstration seulement :
  `validerFacture`) ; la fenêtre montre le « numéro prévu » avant de
  confirmer. Fonction absente (base pas mise à jour) : « La validation des
  factures sera disponible après la mise à jour de l’ERP. », aucun numéro.
  Écriture refusée par le déclencheur (onglet resté ouvert qui renverrait un
  ancien brouillon) : retirée de la file sans nouvel essai, avertissement,
  version de la base relue (`synchro.ts`, `refusParLaBase`, codes `LMF01`
  et `LMF02`). Après validation, seuls changent le partage
  (`partageeLe`) et le paiement (`statut`, `payeeLe`). Puis
  « Partager au propriétaire » : la facture entre dans son espace et dans les
  relances (phase 2). Impression : une seule mise en page,
  `src/erp/espace-proprietaire/DocumentFacture.tsx`, charte « Ivoire & or »,
  fond ivoire bord à bord (`.lm-facture`, `erp.css`).
- **Identité** (Paramètres → Société, `src/erp/data/identite-conciergerie.ts`,
  élément `societe` de `reglages`) : raison sociale, forme, SIRET, adresse,
  régime de TVA (franchise en base : « TVA non applicable, art. 293 B du
  CGI » ; TVA facturée : taux de l'espace, 20 % proposé), n° de TVA, mentions.
  Label Maison : son identité d'avant, en franchise, par défaut. Un autre
  espace n'a jamais celle de Label Maison : son SIRET ou son nom sont
  ignorés à la lecture, refusés à l'enregistrement et à la validation, et
  jamais montrés au propriétaire (`emetteurDeLabelMaison`) ; sans identité
  complète, aucune facture ne se valide. Elle donne aussi la ligne légale
  imprimée en tête des bilans. Propriétaire société (SCI, société) : la
  facture porte toujours « Pénalités de retard : trois fois le taux
  d’intérêt légal. Indemnité forfaitaire pour frais de recouvrement : 40 €. »,
  puis les mentions écrites par le gérant (`mentionsFacture`). Règlement :
  par virement sur le compte indiqué dans le mandat de gestion (jamais de
  coordonnées bancaires sur la facture).
- **Contrôles** : `verifier-factures.ts`.

### Sécurité des accès extérieurs (audit d'octobre 2026)

Pour les deux espaces extérieurs (propriétaires et opérations,
`api/_acces-externe.ts`) :

- **Liens sur le site fixe** : invitation, « Recevoir mon lien » et lien des
  relances pointent toujours vers `SITE_URL` (défaut
  `https://www.labelmaisoncg.fr`), jamais vers l'adresse de la page qui
  appelle. Avant, une page publiée sur un projet Vercel au nom proche
  (`labelmaisonconciergerie-….vercel.app`) pouvait faire envoyer par le vrai
  site un lien vers chez elle et y lire le jeton. Les origines acceptées
  (`api/_garde-formulaire.ts`) sont le site en production et, pour un aperçu,
  la liste exacte `ORIGINES_APERCU` ; plus de motif `*.vercel.app`.
- **L'adresse de la fiche fait foi** : à l'invitation, l'adresse de la fiche
  (propriétaire : `contact.email` ; équipe : `email`) est relevée dans l'accès
  (`emailFiche`). Si le gérant met une autre adresse dans la fiche sans
  « Retirer », la session tombe au prochain appel, le lien ne s'ouvre plus et
  l'ancienne adresse ne reçoit plus de lien de connexion. Un accès d'avant ce
  relevé vaut tant que la fiche a la même adresse que l'accès (ou aucune).
  Fiche supprimée : accès fermé. Réinviter remet le relevé à jour.
- **Usage unique, vraiment** : le lien est marqué utilisé par une écriture
  conditionnelle (`BaseErp.remplacerSi` : PATCH filtré sur `maj_le`, la
  version lue) ; présenté deux fois en même temps, il n'ouvre qu'une session.
  Même chose pour l'envoi d'une relance (deux validations simultanées : un
  seul e-mail) et son annulation, et pour l'ajout d'un lien de connexion (il
  n'écrase pas un lien utilisé au même instant).
- **Un lien de connexion toutes les 2 minutes au plus** par accès, compté
  dans l'accès lui-même (date du dernier lien), donc valable pour toutes les
  instances du serveur ; le frein par instance (5 demandes par heure et par
  adresse IP) reste en plus. Les liens gardés sont plafonnés **par sorte**
  (3 invitations, 3 liens de connexion) : des demandes répétées ne chassent
  jamais une invitation encore valable.
- **Label Maison seulement si c'est Label Maison** : fiche d'espace illisible
  (panne passagère, espace fermé) = pas d'e-mail (le gérant copie le lien),
  pas de contacts, nom « Votre conciergerie » ; jamais l'expéditeur ou les
  contacts de Label Maison par défaut.
- **Factures** : seules celles adressées au propriétaire
  (`destinataire = 'proprietaire'`) et à son nom sont partagées et relancées.
- **Base réservée aux gérants** : `accesProprietaires`, `accesOperations`,
  `relancesPaiement`, `reglagesRelances` ne sont lisibles et modifiables que
  par un gérant (et le compte serveur, gérant de l'espace nommé). Sans cette
  règle, un compte « opérations » pourrait écrire un accès avec l'empreinte
  d'un jeton qu'il connaît et entrer dans l'espace d'un propriétaire. Leurs
  anciennes versions dans `erp.historique` (et celles de `connecteurs`) sont
  réservées aux gérants de la même façon.
  **À faire une fois dans Supabase → SQL Editor** :
  - base d'avant les espaces : lancer `supabase/erp-acces-gerants.sql`
    (attendu dans « Results » : `regles = 2`, `recette = ok`) ;
  - base passée aux espaces : relancer `supabase/erp-espaces.sql` (la règle y
    est, par espace ; `recette = ok`).

  Conséquence dans l'ERP : un compte « opérations » ou « lecture » ne voit
  plus l'état des accès (Paramètres → Accès, fiche logement) ; le gérant, si.


## Espace opérations (octobre 2026)

Une page à part, **`https://www.labelmaisoncg.fr/espace-operations`**, pour
les personnes de terrain : leur espace à elles, hors de l'ERP du gérant,
avec leur propre connexion (lien à usage unique reçu par e-mail, session
signée de 30 jours, mêmes mécanismes que l'espace propriétaire). Ménage,
linge et consommables restent chez BNB Cleaning : rien ici n'y touche.

| Rôle | Ce que voit la personne |
|---|---|
| Responsable de pôle | Ses logements (ceux que le gérant a cochés), les séjours, les urgences et incidents de ces logements, les contrôles qualité, son équipe, les absences et remplacements. Cinq onglets : Aujourd'hui, Logements, Incidents, Contrôles, Équipe. |
| Agent de terrain | Ses logements, les incidents qu'il a signalés ou qui lui sont confiés, les contrôles à faire. Quatre onglets (pas d'Équipe). |

Sur chaque logement : « Signaler un incident » (photo, urgent ou non) et
« Ce logement n'est pas à moi » (le gérant est prévenu ; le logement reste
affiché jusqu'à sa réponse). Voyageurs en « Prénom N. » et nombre de
personnes (une adresse ou un numéro saisi comme nom devient « Voyageur »,
comme dans l'espace propriétaire). Consignes d'accès : le jour même
seulement (arrivée, départ, intervention ou contrôle prévu ce jour-là ;
jamais pour un contrôle en retard), et seulement pour qui a la charge du
logement ce jour-là (le responsable, ou son remplaçant pendant une absence)
ou le responsable de pôle.

Règles de l'audit (octobre 2026) :

- **Absences** : un pôle ne note, ne change ni n'annule l'absence de
  quelqu'un qui suit aussi des logements hors des siens (c'est au gérant),
  ni une absence notée par le gérant (`parMembreId` absent : lui seul la
  change ; l'écran la montre en lecture). Le motif n'est ni saisi ni montré
  dans l'espace (« Absence du … au … »), il reste chez le gérant.
- **Contrôle fait** : il ne se réécrit plus, sauf par le responsable de pôle
  ou par son auteur le jour même ; chaque changement, « finir plus tard »
  compris, est vérifié (toutes les réponses, une note) et ajoute une ligne
  d'historique ; l'auteur et la date restent. Un champ absent de la demande
  reste tel quel.
- **Entrées** : une opération mal formée est refusée (400), jamais une
  erreur serveur ; une valeur qui n'est pas du texte compte pour rien.
- **Écriture** : avant d'écrire, le serveur relit les enregistrements
  touchés et ne reprend que les champs changés par l'action (l'historique et
  les photos s'ajoutent à la version relue) : une modification du gérant
  faite entre-temps n'est pas écrasée. Si l'action change un statut que
  quelqu'un d'autre vient de changer (incident réglé par le gérant puis
  « Je m'en occupe »), rien n'est écrit et la personne voit pourquoi (409).

### Côté gérant

- **Paramètres → Accès** : « Propriétaires » (un propriétaire par logement ;
  cocher le logement d'un autre propriétaire le lui reprend après
  confirmation ; « Inviter un propriétaire ») et « Responsables
  opérationnels » (nom, e-mail, rôle, logements cochés, plusieurs personnes
  par logement, invitation, accès, « Voir son espace » en aperçu, et les
  « ce logement n'est pas à moi » à traiter : « Le garder » / « Lui retirer »).
- **Fiche logement** : sous la carte Propriétaire (avec la ligne du mandat :
  « Mandat signé le … · 18 % » ou « Mandat envoyé, pas encore signé »), une
  carte « Responsables opérationnels » : qui suit le logement, son accès,
  « Ajouter un responsable » (quelqu'un de l'équipe ou une invitation).
- Une invitation est rangée dans l'espace de l'ERP qui invite (Label Maison,
  Sens…) et part au nom de cet espace ; la personne ne voit que la base de
  cet espace.
- Notification « Urgence » sur les appareils de l'ERP quand un incident
  urgent est signalé ou confié (désactivable dans Paramètres → Application).
- « Le garder » / « Lui retirer » sur un « ce logement n'est pas à moi » :
  la personne reçoit la réponse sur son téléphone (app « Opérations »).

### Fonctionnement

- Données : collections `equipe`, `accesOperations`, `affectations`,
  `absences`, `controles`, `signalementsLogement` (+ `incidents`) dans
  `erp.enregistrements`, base de l'espace (`baseErp(c, espace)`).
- `api/espace-operations.ts` : `lien`, `entrer`, `sortir`, `vue`, `agir`,
  `photo` (personne connectée), `etat`, `inviter`, `retirer`,
  `signalement-traite` (gérant) ; notifications de l'app :
  `notifications-etat`, `notifications-abonner`, `notifications-desabonner`,
  `notifications-tester`, `prevenus` (`api/_operations-notifications.ts`).
  Chaque appel relit l'accès dans la base de l'espace ; la vue et les
  actions sont calculées par `src/erp/data/espace-operations.ts` sur le seul
  périmètre de la personne. Écritures limitées à `incidents`, `controles`,
  `absences`, `affectations`, `signalementsLogement` : jamais de réservation,
  de logement, de prix, de calendrier ni d'appel à Repull.
- Photos : réduites dans le navigateur (JPEG, 1600 px), déposées dans
  `erp-fichiers/[<espace>/]operations/<personne>/` (compte d'équipe pour
  Label Maison, compte serveur avec l'en-tête de l'espace sinon), lues par
  liens signés dans le même espace. Une action n'accepte que les photos du
  dossier de la personne connectée, dans son espace (`photoOperations`).
- Variables : `ACCES_SECRET` (ou `OPERATIONS_SECRET`), `ERP_PASSWORD`
  (lecture de la base), `RESEND_API_KEY` et `CONTACT_FROM_EMAIL` pour envoyer
  les liens par e-mail (sans : le lien s'affiche au gérant, qui le transmet).
- Démo : `/espace-operations?apercu=eq-ines` (responsable de pôle),
  `/espace-operations?apercu=eq-yanis` (agent de terrain).

### App « Opérations » et notifications (octobre 2026)

L'espace opérations s'installe comme une app, **« Opérations »**, à part de
celle de l'ERP : icône sur l'écran d'accueil, plein écran, et notifications
sur le téléphone des responsables de pôle et des agents de terrain. **Rien à
faire de plus côté Vercel** : mêmes clés que l'app de l'ERP
(`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, déjà en place). Sans elles, l'espace
marche comme avant et dit « Pas encore ouvertes par votre conciergerie ».

Pour la personne (en haut de son espace : « Installer l'app », puis
« Notifications » une fois l'app installée) :

1. **iPhone** (Safari) : Partager → « Sur l'écran d'accueil » → « Ajouter ».
   L'app de l'écran d'accueil ne partage pas la session de Safari et le lien
   du mail s'ouvre dans Safari : dans l'app, on demande son lien, puis on le
   colle (appui long sur « Ouvrir mon espace » dans l'e-mail → Copier →
   champ « Lien reçu par e-mail » → « Ouvrir avec ce lien »).
   **Android** (Chrome) et **ordinateur** : bouton « Installer l'app »
   (fenêtre du navigateur), sinon menu ⋮ → « Installer l'application ».
2. À la première ouverture, « Recevoir les notifications ? » : « Activer »
   demande l'autorisation dans le même toucher (obligatoire sur iPhone).
   Mêmes règles que l'ERP (`demandeNotifications`) : jamais en
   démonstration, plus jamais après un refus, « Plus tard » retenu 7 jours,
   sur iPhone seulement dans l'app installée. Ensuite : « Notifications »
   en haut de l'espace (test, couper).

| Notification | Qui | Quand | Ouvre |
|---|---|---|---|
| Urgence · logement | La personne qui s'en occupe aujourd'hui (« Urgence confiée »), qui a la charge du logement, les responsables de pôle du logement | Urgence signalée ou passée en urgent | l'incident |
| Incident confié · logement | La personne qui s'en occupe aujourd'hui (le titulaire, ou son remplaçant pendant une absence) | Incident confié (signalé, depuis un contrôle, « Confier ») | l'incident |
| Vous remplacez Clara D. | Le remplaçant, sur ses logements seulement (jamais le motif) | Le matin du premier jour, ou tout de suite si le pôle note une absence déjà commencée | ses logements |
| Aujourd'hui : N contrôles qualité | Qui a la charge du logement (sinon les responsables de pôle) | Passage du matin, une fois par jour | Contrôles |
| Logement confirmé / retiré | La personne qui a dit « ce logement n'est pas à moi » | Réponse du gérant (rattrapée au passage du matin) | ses logements |

Jamais l'auteur de l'action, jamais un logement hors de son espace, jamais
un autre espace (une personne de Label Maison ne reçoit rien de Sens). Pas
de nom de voyageur ; un numéro ou une adresse tapés dans un incident sont
masqués. « Signaler » dit qui sera vraiment prévenu (« Le gérant et Inès M.
sont prévenus tout de suite. ») : les personnes dont le téléphone recevra
l'urgence, et le gérant seulement si un appareil de l'app de l'ERP la
recevra (clés du serveur, appareil abonné qui accepte « Urgence ») ; sinon
« Le gérant le verra dans l'ERP. ». Après l'envoi, même règle (« Urgence
signalée. » suivi de la même phrase, calculée par le serveur). Accès
retiré : « Votre accès a été retiré. Contactez votre conciergerie. »
partout (`ACCES_RETIRE`, espaces propriétaire et opérations).

Fonctionnement :

- **App** : manifeste `public/operations-app/manifest.webmanifest` (portée
  et départ `/espace-operations`, icônes de l'ERP), service worker
  `public/operations-sw.js` (même règles que celui de l'ERP : cache des
  seuls `/assets/`, son propre cache `lm-ops-…`), balises de l'écran
  d'accueil ajoutées à la coquille `/espace-operations` par
  `scripts/spa-shells.mjs`. Servis hors de toute zone protégée. Côté
  navigateur : `src/erp/espace-operations/app-operations.ts` et
  `AppOperations.tsx` (indépendants de l'app de l'ERP, qui ne change pas).
- **Téléphones** : collection `connecteurs` (réservée aux gérants, jamais lue
  par la synchronisation du navigateur), un enregistrement par personne
  (`operations-appareils-<membre>`) dans la base de son espace, chaque
  téléphone lié à l'adresse et à la version de l'accès. Accès retiré,
  nouvelle invitation à une autre adresse, personne hors de l'équipe :
  oublié ; adresse changée dans la fiche sans « Retirer » : plus rien ne
  part. Un téléphone repris par un collègue n'appartient plus qu'à lui ;
  « Se déconnecter » le fait oublier. À la connexion suivante (même
  personne après une nouvelle invitation, ou un collègue), un téléphone qui
  a déjà l'autorisation est relié à la personne connectée sans rien
  redemander ; « Couper » l'arrête pour de bon.
- **Envoi** : règles dans `src/erp/data/notifications-operations.ts`
  (pur, contrôlé par `verifier-operations.ts`), journal d'idempotence
  `connecteurs/operations-notifications-journal` (une notification ne part
  qu'une fois). Après une action de l'espace (`agir`), avec la notification
  « Urgence » de l'ERP ; le matin avec le passage planifié de l'agent
  (`api/erp-agent.ts`, `notificationsOpsDuJour`, 8 s au plus, jamais
  bloquant), à partir de 7 h (heure de Paris) : le réveil de 22 h UTC tombe
  à minuit l'été, déjà le jour suivant à Paris, et n'envoie donc rien
  (`matinOpsOuvert`) ; à la réponse du gérant (l'ERP appelle
  `signalement-traite` juste après avoir enregistré, et réessaie tant que la
  base ne l'a pas).

## Livret d'accueil et check-in en ligne (B2, octobre 2026)

Une page par séjour, pour le voyageur, sans compte : **`/sejour#<jeton>`**.
Pensée pour le téléphone, en français ou en anglais (bouton FR / EN ; les
textes de la fiche restent tels que l'équipe les a écrits).

**Ce que voit le voyageur** : « Bonjour Marie », le logement (titre de
l'annonce, sinon la ville, sinon rien : jamais le nom interne,
qui peut citer le propriétaire ; photo), arrivée et départ avec leurs
heures, nuits et voyageurs ; le **check-in en ligne** ; **Accès et wifi** —
seulement pour une réservation confirmée, de 48 h avant l'arrivée à la
veille du départ (même règle que l'agent et les messages automatiques),
sinon « Code communiqué dans les 48 heures avant l'arrivée » et la date où
il s'affichera. Pendant le séjour, l'accès passe avant le check-in. Le jour
du départ, le séjour dure jusqu'à l'heure de départ de la fiche (11:00 par
défaut) : les codes restent cachés (« le code reste celui de votre
arrivée ») ; après le départ, plus de carte d'accès du tout. Puis l'adresse
(« Itinéraire »), le parking, les transports ; le règlement intérieur
(celui de la fiche, sinon les règles de l'annonce) ; « À savoir » et les
questions fréquentes ; les guides (liens signés de 6 h) ; les « Consignes
de départ » (nouveau champ de la fiche voyageur ; un code masqué y devient
« code : le même qu’à votre arrivée », sans crochets) ; « Une question ? » renvoie à la
messagerie de la plateforme (Airbnb, Booking.com), ou aux boutons
« Appeler » et « Écrire un e-mail » de la conciergerie pour un séjour
direct. Avant les 48 h, un texte qui cite le wifi (cherché dans le texte
brut) n'est pas montré ; les autres passent par `masquerCodesLivret` : code
postal, année (« rénové en 2019 »), distance, durée, montant, numéro de bus,
de ligne ou « n° » restent lisibles, toute autre suite de chiffres est
masquée comme pour l'IA, et montrée sans crochets (« Digicode (code
communiqué 48 h avant l'arrivée) ») ; après le séjour, plus
d'« Itinéraire ». Un texte n'est pas montré s'il cite encore un code
du champ Accès, le wifi ou un code écrit après « code » dans un autre champ
(jamais les nombres nus des autres champs : « 91100 » n'est pas un secret),
ni si un court jeton avec un chiffre (même espacé : « 4 8 2 ») suit ou
précède portail, porte, boîte, cadenas, badge, digicode, interphone,
grille, barrière, garage, coffre à clés, bip, télécommande, gate, keybox…
(« Portail du parking : 482. », « Dans la boîte B7Z » : `codeProbable`).
La fiche voyageur le signale sous le champ.

**Check-in** (2 minutes) : heure d'arrivée prévue, nombre de voyageurs,
« J'ai lu le règlement intérieur et je l'accepte », nationalité des
voyageurs ; pour les voyageurs étrangers seulement, la **fiche individuelle
de police** (une par voyageur de 15 ans et plus : nom, prénoms, date et lieu
de naissance, nationalité, domicile habituel, enfants de moins de 15 ans
inscrits sur sa fiche, seulement celle d'un adulte de 18 ans le jour de
l'arrivée). Aucune photo ni numéro de pièce d'identité. Modifiable jusqu'au
jour de l'arrivée compris (un premier envoi reste possible pendant le
séjour, « Il reste votre check-in : deux minutes. »), 12 envois au plus.
Les fiches envoyées ne reviennent jamais vers la page : en modifiant, le
voyageur les garde telles quelles ou les remplit de nouveau.

> Base légale : CESEDA, art. R. 814-1 et suivants (ancien art. R. 611-42,
> étendu aux loueurs de meublés de tourisme par le décret n° 2015-1002 du
> 18 août 2015) ; fiches conservées 6 mois, remises seulement à la police ou
> à la gendarmerie sur leur demande (CNIL). **Question ouverte** : le décret
> de 2015 cite aussi le téléphone mobile et l'adresse e-mail du voyageur ;
> ils ne sont pas demandés (minimisation, la plateforme les a). À trancher
> par Label Maison : un champ facultatif s'ajoute en quelques lignes
> (`src/erp/data/sejour.ts`, `FICHE_POLICE`).

**Côté équipe** (fiche d'une réservation, carte « Livret d'accueil et
check-in ») : « Check-in : Fait le 24 sept. / Pas encore » (rien
pour une réservation annulée ou un lien expiré), l'heure d'arrivée prévue,
le nombre de voyageurs seulement s'il change (« 3 personnes (2 à la
réservation) »), les fiches de police (repliées) et la date de leur
effacement, **« Copier le lien »**. Gérants et opérations de l'espace,
réservation de cet espace seulement ; les fiches de police restent aux
gérants (un compte opérations n'en voit que le nombre).
Messages automatiques : variable **`{Lien du livret}`** (`{lien_sejour}`,
la clé ne change pas), ajoutée aux textes par défaut de « Merci pour la
réservation » et « Infos d'arrivée » ; ce dernier ne cite plus
`{Lien du guide}` (le livret montre les guides). Les textes déjà enregistrés
ne changent pas ; `{Lien du guide}` reste disponible et garde son sens.

Fonctionnement :

- **Lien** : jeton signé HMAC-SHA256 avec `SEJOUR_SECRET` si elle est posée,
  sinon `ACCES_SECRET` (signature à part de celle des sessions : l'une ne
  vaut jamais pour l'autre), qui porte
  l'espace et la réservation. Même séjour, même lien (copié ou envoyé par
  message). Après « # » : jamais dans les journaux ni l'en-tête Referer ;
  la page l'envoie dans le corps d'un POST à `api/sejour.ts`. Rien n'est
  gardé pour lui : la réservation est relue à chaque ouverture, dans la base
  de SON espace. Annulée : rien ; 3 jours après le départ : expiré.
  Changer le secret qui signe (ou poser `SEJOUR_SECRET`) coupe tous les liens
  déjà envoyés.
- **Route** `api/sejour.ts` : `vue` et `checkin` (voyageur : provenance du
  site, 16 Ko au plus, freins par adresse IP, écriture conditionnelle),
  `equipe` (session d'un membre). Réponse limitée à `VueSejour` : prénom,
  dates, logement ; jamais d'autre réservation, d'e-mail ou de téléphone du
  voyageur, de montant ni rien du propriétaire.
- **Données** : collection `checkinsEnLigne` (une ligne par réservation),
  lue et écrite par les gérants et le serveur seulement (règle « acces
  exterieurs reserves aux gerants »), **jamais archivée** dans
  `erp.historique`, jamais chargée par le navigateur avec le reste de l'ERP
  (ni dans « Télécharger une sauvegarde »), jamais donnée à l'IA ni aux
  connecteurs. Le serveur n'enregistre rien tant que
  `erp.checkin_en_ligne_pret()` n'existe pas (SQL pas encore passé).
- **Purge** : au passage planifié (`api/erp-agent.ts`,
  `purgeCheckinsDuJour`, `api/_sejour.ts`), dans chaque espace : 6 mois
  après le départ, tout de suite pour une réservation annulée ; les espaces
  fermés aussi (`erp.purger_checkins_espaces_fermes()`, serveur seulement).
- **À faire** : relancer `supabase/erp-espaces.sql` (passe en cours ; base
  d'avant les espaces : `erp-installation.sql`, ou `erp-acces-gerants.sql`),
  bilan `recette = ok`. `ACCES_SECRET` déjà en place pour l'espace
  opérations : rien de plus dans Vercel (`OPERATIONS_SECRET` seule ne
  suffit pas : la carte de la réservation le dit). `SEJOUR_SECRET` est
  facultative : à poser seulement pour séparer les liens des séjours des
  sessions des espaces.
- **Démo** (10:30 le 24 septembre 2026) : `/sejour?apercu=res-0030` (8 jours avant : pas de code),
  `/sejour?apercu=res-0094` (48 h : accès et wifi) ; le check-in de démo
  reste dans le navigateur et apparaît sur la fiche de la réservation.
- **Pas fait** : pas de serrure connectée (les codes viennent de la fiche,
  comme avant) ; pas de traduction des textes de la fiche ; pas de lien
  révocable un par un (il s'éteint avec la réservation) ; pas de
  transmission automatique aux autorités.
