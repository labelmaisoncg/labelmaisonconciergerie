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
# compte d'équipe, rien d'identifiant dans l'adresse, lien piégé confirmé.
node_modules/.bin/esbuild scripts/verifier-connexion-erp.ts --bundle --format=esm \
  --platform=node --log-level=error --outfile=/tmp/verifier-connexion-erp.mjs \
  && node /tmp/verifier-connexion-erp.mjs

# Même chose côté routes /api : compte serveur, réglages d'un espace, passage
# quotidien sur chaque espace, bouton d'un membre, routage des webhooks.
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
# « ce logement n'est pas à moi », invitation par espace, sessions par genre.
node_modules/.bin/esbuild src/erp/data/verifier-operations.ts --bundle --platform=node \
  --define:import.meta.env='{"VITE_ERP_DEMO":"1"}' --log-level=error \
  --outfile=/tmp/verifier-operations.cjs && node /tmp/verifier-operations.cjs

# Auto-contrôle des factures partagées et des relances de paiement.
node_modules/.bin/esbuild src/erp/data/verifier-relances.ts --bundle --format=esm \
  --platform=node --define:import.meta.env='{"VITE_ERP_DEMO":"1"}' --log-level=error \
  --outfile=/tmp/verifier-relances.mjs && node /tmp/verifier-relances.mjs

# Incidents côté ERP : un signalement de l'espace opérations remonte dans le
# « À faire » et sur la fiche du logement (lien de la notification « Urgence »),
# actions du gérant, « pas à moi », remplaçant qui suit déjà les logements.
node_modules/.bin/esbuild src/erp/data/verifier-incidents-erp.ts --bundle --format=esm \
  --platform=node --define:import.meta.env='{"VITE_ERP_DEMO":"1"}' --log-level=error \
  --outfile=/tmp/verifier-incidents-erp.mjs && node /tmp/verifier-incidents-erp.mjs
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
| `ACCES_SECRET` (ou `OPERATIONS_SECRET`) | Vercel (serveur), **Production et Preview** | Sessions de l'espace opérations (`/espace-operations`), 32 caractères au moins. Une seule variable `ACCES_SECRET` suffit pour les deux espaces (propriétaire et opérations) : le genre est signé dans la session, un cookie propriétaire ne vaut pas pour les opérations. `OPERATIONS_SECRET` passe avant si elle existe. Absente : l'espace opérations reste fermé et « Inviter » (Paramètres → Accès) dit ce qu'il manque. Redéployer après ajout. |
| `RESEND_API_KEY`, `CONTACT_FROM_EMAIL` | Vercel (serveur), facultatives | Envoi des liens de connexion aux propriétaires (mêmes variables que le formulaire de contact). Sans : le gérant copie le lien d'invitation et l'envoie par SMS ou WhatsApp. |
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
api/_erp-espaces.ts        réglages d'un espace, espaces actifs, garde « Label Maison seulement »
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
| Accueil | « À faire » (voyageurs qui attendent, synchronisation en échec, avis sous 4,5, infos manquantes pour l'agent, contacts à appeler), arrivées / départs / sur place (aujourd'hui, ou une période choisie au calendrier : `ChoixPeriode.tsx`), 4 repères sur 30 jours (occupation, revenu versé par les plateformes, prix moyen par nuit, note), 2 courbes (revenu par mois sur 12 mois, occupation par semaine) | `/erp` |
| Logements | Cartes (photo, prochain événement, prix par nuit ou occupation, note) ; fiche en 3 onglets : Aperçu (galerie, 3 repères, prochains séjours, l'annonce, couchage, prix des prochaines semaines et prix de base lus sur les plateformes, propriétaire, logement, conditions, plateformes, Administratif), Infos pour l'agent (ce que lit l'agent IA), Historique (séjours et journal) ; Connexions | `/erp/logements` (`/:id?onglet=fiche\|historique`, `/connexions`) |
| Réservations | Planning (2 semaines ou 30 jours, prix des nuits libres), Séjours (À venir · En cours · Passés · Annulés), fiche d'un séjour, réservation directe | `/erp/reservations` (`?vue=liste`, `?q=`, `/:id`) |
| Messagerie | Conversations (filtres À répondre · Toutes · Terminées, « Pas besoin de répondre ») · Activité · Réglages de l'agent | `/erp/messagerie` (`/:filId`, `?q=`), `/activite`, `/agent` |
| CRM | Appels et relances (grille sur ordinateur, cartes par étape sur téléphone), dossier propriétaire, agenda, connecteur Claude | `/erp/crm` |
| Paramètres | Équipe, Plateformes (synchronisation), Application (installer l'app, lien pour l'équipe, notifications de l'appareil), Société (identité et sauvegarde) | `/erp/parametres` (`/plateformes`, `/application`, `/societe`) |

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
(« transmise à l'équipe » plutôt qu'« escaladée », « contrat de gestion »
plutôt que « mandat »...).

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

« Messagerie > Réglages de l'agent » enregistre un élément unique
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
   **Auto Confirm User** → **Create user**. Conseillé : fermer les
   inscriptions publiques (**Authentication → Sign In / Providers → Allow new
   users to sign up** désactivé).
3. **Lui donner l'accès à l'ERP.** Le script de l'étape 1 inscrit déjà
   `equipe@labelmaisoncg.fr` comme gérant dans `erp.membres` (bilan :
   `membres` = 1). Pour changer l'adresse du compte d'équipe : variable
   Vercel `VITE_ERP_EMAIL_EQUIPE`, et la même adresse dans `erp.membres`.
   **Mot de passe oublié :** Authentication → Users → le compte d'équipe →
   nouveau mot de passe (ou lien de récupération).
4. **Adresses de retour des e-mails.** Supabase → **Authentication** →
   **URL Configuration** : **Site URL** = `https://www.labelmaisoncg.fr`, et
   dans **Redirect URLs** ajouter `https://www.labelmaisoncg.fr/erp` → Save.
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

- **Pour l'équipe :** connectez-vous avec votre compte personnel créé dans
  Supabase → Authentication → Users (« Add user », « Auto Confirm User »),
  dont l'adresse figure dans les membres (Paramètres → Équipe).
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
  compte (pendant le passage) la reçoit. Un non-membre est refusé ; une
  demande venue d'un autre site aussi. Un lien reçu par e-mail qui n'est ni
  une récupération ni une invitation demande de confirmer le compte avant
  d'ouvrir l'ERP ; sans JavaScript, rien ne part dans l'adresse.
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
jamais supprimé. Un logement créé à la main se relie à son annonce dans
Logements → fiche → Canaux → **Relier à Repull** (identifiant d'annonce) :
il est alors mis à jour au lieu d'être dupliqué. Chaque passage laisse une
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

- toutes les 30 minutes de 8 h à 23 h, par Supabase (`pg_cron` + `pg_net`) :
  exécuter **une fois** `supabase/erp-agent-cron.sql` dans le SQL Editor du
  projet Label Maison, en remplaçant `REMPLACER_PAR_CRON_SECRET` par la valeur
  de `CRON_SECRET` (rangée dans le coffre chiffré Vault) ;
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
- **Connecteur MCP « Label Maison »** (`/api/crm-mcp`, serveur `label-maison` 2.0.0) : Claude (claude.ai, Claude Desktop, Claude Code) suit tout le channel manager et tient le CRM. Logique : `src/erp/data/crm-mcp.ts` (CRM et protocole), `cm-mcp.ts` (channel manager), `mcp-commun.ts` (contexte, forme d'un outil) ; transport : `api/_crm-mcp-http.ts` (`depotsMcp(base)`, seul point d'entrée vers les données : il deviendra celui de l'espace du jeton) ; contrôles : `verifier-crm-mcp.ts`.
  - **CRM** (six outils, inchangés) : `crm_resume`, `crm_chercher`, `crm_voir`, `crm_ajouter`, `crm_modifier`, `crm_noter_appel` (aucune suppression).
  - **Channel manager** (dix outils) :
    - **Le point du jour** : `cm_resume`, avec les conversations à répondre, les arrivées, départs et voyageurs sur place du jour, les avis sous 4,5 des 14 derniers jours et le nombre d'appels CRM.
    - **Logements** : `logements_lister` (statut, prix de ce soir, prochain événement) et `logement_voir` (fiche, couchage, conditions, infos pratiques, plateformes, prix des 14 prochaines nuits ; par id ou par nom).
    - **Réservations** : `reservations_periode` (du / au compris, 92 jours au plus ; arrivées, départs, sur place ; annulées exclues) et `reservation_voir` (montants, dont « vous recevez » = total − frais de la plateforme ; avis).
    - **Conversations** : `conversations_a_repondre` (même règle que « À répondre » de la Messagerie), `conversation_voir` et `reponse_preparer` (contexte et consignes pour rédiger une réponse, qui n'est **jamais envoyée** par le connecteur : l'équipe la relit et l'envoie depuis la Messagerie).
    - **Chiffres** : `indicateurs`, sur 30 jours ou une période choisie, comparés à la période précédente, avec les mêmes définitions que l'Accueil (`data/selectors`), vérifiées par le test.
  - **Seule écriture du channel manager** : `conversation_pas_besoin_de_repondre`, qui classe la conversation « terminée » dans l'ERP, comme le bouton de la Messagerie. Elle se rouvre si le voyageur réécrit.
  - **Ce qui ne passe jamais par le connecteur** :
    - aucun envoi aux voyageurs, aucune écriture vers les plateformes ;
    - jamais de wifi ni de code d'accès : les e-mails, téléphones et codes du logement présents dans les messages sont masqués ;
    - les voyageurs sont nommés « Prénom N. ».
  - **Une clé par espace** : à faire avec les espaces séparés. `depotsMcp` recevra la base de l'espace porté par le jeton OAuth ou par la clé ; aucun outil n'a à changer.
  1. **Connexion par OAuth 2.1** (ce qu'attend claude.ai) : CRM → Plus → « Connecter à Claude » donne l'adresse `https://www.labelmaisoncg.fr/api/crm-mcp` (aucun secret). Dans claude.ai → Paramètres → Connecteurs → « Ajouter un connecteur personnalisé » (nom « Label Maison », paramètres avancés vides ; un connecteur déjà ajouté sous l'ancien nom « CRM Label Maison » continue de marcher et reçoit les nouveaux outils sans rien refaire), puis se connecter : l'ERP ouvre `/erp/autoriser-claude`, un gérant clique « Autoriser ».
  2. Mécanique : découverte par `/.well-known/oauth-protected-resource[/api/crm-mcp]` et `/.well-known/oauth-authorization-server` (servis par `middleware.ts`, les rewrites de `vercel.json` étant ignorés avec `cleanUrls`), inscription dynamique `/api/oauth-register` (adresses de retour de Claude seulement : claude.ai, claude.com, localhost), code à usage unique de 10 min lié au défi PKCE S256 (route gérant `/api/erp-connecteur-claude`), jetons `/api/oauth-token` (accès 7 jours, rafraîchissement 90 jours avec rotation). Règles d'entrée : `src/erp/data/oauth-regles.ts` ; codes et jetons : `api/_oauth.ts`.
  3. La base (collection technique `connecteurs`) ne garde que des **empreintes** SHA-256 des codes et jetons. « Déconnecter Claude… » (même fenêtre) révoque tous les jetons (effet en 1 min au plus). Pour réserver cette collection aux gérants, lancer une fois `supabase/erp-connecteurs-gerants.sql` dans Supabase → SQL Editor (règle aussi incluse dans `erp-installation.sql`).
  4. Facultatif, pour un outil sans OAuth : `MCP_CRM_TOKEN` (32 caractères au moins) dans Vercel ouvre `/api/crm-mcp/<cette clé>`. Sans la variable, cette adresse est fermée.
  5. RGPD : le connecteur transmet à Claude (Anthropic) des données personnelles du CRM (noms, téléphones, e-mails) et, pour le channel manager, des prénoms et initiales de voyageurs, dates de séjour et messages (e-mails et téléphones masqués) : Anthropic figure parmi les sous-traitants de la politique de confidentialité (`/politique-de-confidentialite`).
- **Relances dans Calendrier** (`/api/crm-agenda/<clé>`) : l'agenda des relances au format iCalendar, pour un abonnement dans Calendrier (iPhone, Mac), Google Agenda ou Outlook. Lecture seule : rien n'est écrit, ni dans le CRM ni ailleurs.
  1. CRM → Plus → « Relances dans Calendrier » (gérants) : choisir « Toute l'équipe », « Abdel » ou « Kamel » (ses contacts, plus ceux que personne ne suit encore), « Créer le lien », puis « Ouvrir dans Calendrier » (lien `webcal://`) → « S'abonner » (emplacement iCloud pour l'avoir sur tous les appareils). Ailleurs : coller le lien `https://` (Calendrier → Fichier → Nouvel abonnement, Google Agenda → Autres agendas → À partir de l'URL).
  2. Contenu (`src/erp/data/agenda-crm.ts`, contrôles `verifier-agenda.ts`) : un événement par contact, sur la journée, avec un rappel à 9 h. Aujourd'hui : chaque « À appeler » et chaque relance échue (« en retard ») ; à sa date : chaque relance prévue ; jamais : « Signé » et « Pas intéressé ». La date suit la relance (UID stable). Rafraîchissement demandé toutes les 15 min (Calendrier d'Apple décide du rythme réel ; Google Agenda relit en quelques heures).
  3. Clés (`api/_agenda.ts`, route gérant `/api/erp-agenda`) : 256 bits, montrées une seule fois ; la collection `connecteurs` n'en garde que l'empreinte SHA-256. « Couper tous les liens… » les révoque (effet en 1 min au plus, l'agenda abonné garde sa dernière copie). Le lien donne noms et téléphones des contacts : à garder pour soi. RGPD : Apple (iCloud) et Google (Agenda) figurent parmi les sous-traitants de la politique de confidentialité.


## App installable et notifications (octobre 2026)

L'ERP s'installe comme une app (sans App Store) : icône sur l'écran d'accueil
du téléphone ou dans le Dock, plein écran, et notifications envoyées par
Apple, Google ou Mozilla selon l'appareil (Web Push).

**Le lien à envoyer à l'équipe : `https://www.labelmaisoncg.fr/erp/installer`**
(aussi dans Paramètres → Application, avec « Copier » et « Partager »).

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
est activé par défaut, sauf le rappel du matin. Un toucher ouvre le bon écran.

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
| Rappel du matin | Arrivées et départs du jour (cron du matin) | l'Accueil |

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
  `/api/erp-notifications` (membres gérant ou opérations ; clés : gérant).
- **Limites** : iPhone et iPad avec iOS / iPadOS 16.4 ou plus récent, app
  ajoutée à l'écran d'accueil (Safari seul ne reçoit pas de notifications).
  Les notifications partent quand l'ERP apprend la nouveauté : webhook Repull
  (quasi immédiat, offre Starter), passage de l'agent, ou synchronisation
  (quotidienne, ou « Synchroniser maintenant »).

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
- Fonctions : `erp.qui_suis_je()` (espaces et rôle du compte),
  `erp.espaces_actifs()`, `erp.secret_espace()` (coffre Vault, serveur
  seulement, pour l'espace de l'en-tête seulement, jamais pour Label Maison),
  `erp.ranger_secret()` (SQL Editor seulement), `erp.recette_espaces()`
  (essai des règles, annulé). Relancer le fichier après la passe 2 ne recrée
  rien en double (`erp.cle_par_espace`).
- `erp.invitations` est préparée pour « Créer un compte » (étape suivante) :
  aucune règle d'accès d'ici là.
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
  Le site public (formulaires, dossier propriétaire), le connecteur Claude,
  OAuth et l'agenda du CRM restent dans Label Maison.
- `configurationEspace(espace)` (`api/_erp-espaces.ts`) : Label Maison garde
  ses variables Vercel. Un autre espace n'en reprend **aucune** :
  Repull par son workspace (`repull_workspace`, en-tête `X-Workspace-Id` sur
  chaque appel, même clé de compte) ou par sa propre clé (coffre) ; sa part
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
  (Label Maison compris, s'il a déclaré le sien) ; tant qu'aucun autre espace
  n'en a déclaré, tout reste à Label Maison comme avant ; ensuite, un
  workspace inconnu est ignoré — jamais versé dans Label Maison. Un espace
  avec son propre compte Repull a son adresse :
  `/api/erp-repull-webhook?espace=<code>`, signée avec SON secret ; un espace
  inconnu, fermé ou sans secret y reçoit la réponse d'une signature fausse.
- Retour en arrière du SQL : la première écriture refusée (colonne `espace`
  inconnue) fait oublier l'état gardé de la base, relue au prochain appel.
- Toujours en lecture seule sur les plateformes : `ecritureRepullPermise` et le
  verrou de l'agent sont inchangés ; l'en-tête de workspace n'ouvre rien.

### Pas encore (étapes suivantes)

- « Créer un compte » et invitations depuis l'ERP (la connexion personnelle,
  elle, est en place : voir « Connexion à l'ERP »), choix de l'espace à
  l'écran.
- Connecteur Claude (MCP, OAuth), clé MCP et agenda du CRM par espace.
- Vérification de types de `api/` : elle passe sans erreur avec `@types/node`,
  qui n'est pas encore dans les dépendances de développement.
- Liens signés des guides déposés en fichier pour un autre espace que Label
  Maison (ses guides en lien https partent déjà).

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
  Maison seul, comme avant. Pour l'instant, photos déposées et documents
  (`stockage://`) ne sont signés que pour Label Maison.
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
  réduit à ses dates (pour l'occupation).
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

### Fonctionnement

- Données : collections `equipe`, `accesOperations`, `affectations`,
  `absences`, `controles`, `signalementsLogement` (+ `incidents`) dans
  `erp.enregistrements`, base de l'espace (`baseErp(c, espace)`).
- `api/espace-operations.ts` : `lien`, `entrer`, `sortir`, `vue`, `agir`,
  `photo` (personne connectée), `etat`, `inviter`, `retirer` (gérant).
  Chaque appel relit l'accès dans la base de l'espace ; la vue et les
  actions sont calculées par `src/erp/data/espace-operations.ts` sur le seul
  périmètre de la personne. Écritures limitées à `incidents`, `controles`,
  `absences`, `affectations`, `signalementsLogement` : jamais de réservation,
  de logement, de prix, de calendrier ni d'appel à Repull.
- Photos : réduites dans le navigateur (JPEG, 1600 px), déposées dans
  `erp-fichiers/operations/<personne>/`, lues par liens signés (Label Maison
  seulement pour l'instant). Une action n'accepte que les photos du dossier
  de la personne connectée, dans son espace (`photoOperations`).
- Variables : `ACCES_SECRET` (ou `OPERATIONS_SECRET`), `ERP_PASSWORD`
  (lecture de la base), `RESEND_API_KEY` et `CONTACT_FROM_EMAIL` pour envoyer
  les liens par e-mail (sans : le lien s'affiche au gérant, qui le transmet).
- Démo : `/espace-operations?apercu=eq-ines` (responsable de pôle),
  `/espace-operations?apercu=eq-yanis` (agent de terrain).
