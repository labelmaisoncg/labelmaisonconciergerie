# ERP Label Maison

Outil **interne** de Label Maison Conciergerie, servi sur `/erp` dans le même
projet que le site (Vite + React 18 + react-router 7 + Tailwind 4). Le cahier
des charges complet est dans [`SPEC.md`](./SPEC.md).

Principes du fondateur, appliqués partout :

- l'ERP sert Label Maison et personne d'autre (pas de multi-clients) ;
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
```

Le vérificateur du moteur l'exécute deux fois sur la démo : la seconde passe
doit produire **0 changement**, le seed doit rester intact et les ids uniques.
Le vérificateur de synchronisation doit finir sur « 0 échec ».

## Variables d'environnement

| Variable | Où | Rôle |
|---|---|---|
| `ERP_PASSWORD` | Vercel, **Production ET Preview** (obligatoire) | Mot de passe de `/erp`. Absent : accès refusé (page 503), jamais ouvert. Redéployer après modification. |
| `LINGE_PASSWORD` | Vercel | Mot de passe du registre `/linge` (inchangé). |
| `VITE_SUPABASE_URL` | build (Vercel), facultatif | Adresse du projet Supabase. Absente : celle de Label Maison, inscrite dans `src/erp/data/config.ts`. |
| `VITE_SUPABASE_ANON_KEY` | build (Vercel), facultatif | Clé publique (« anon ») du même projet. Les deux vont ensemble : si l'une manque, le couple par défaut est utilisé. |
| `VITE_ERP_DEMO` | local uniquement | `1` : jeu de démonstration en mémoire. **Jamais en production.** |
| `REPULL_API_KEY` | Vercel (serveur), obligatoire pour la synchronisation | Clé API Repull (`sk_live_...`). Voir « Synchronisation Repull ». |
| `CRON_SECRET` | Vercel (serveur) | Secret du cron quotidien de synchronisation (Vercel l'envoie en `Authorization: Bearer`). |
| `REPULL_WEBHOOK_SECRET_ERP` | Vercel (serveur), facultatif | Secret de signature (`whsec_...`) de l'abonnement webhook **de l'ERP** (distinct de celui de l'agent IA). |
| `REPULL_BUDGET_ERP` | Vercel (serveur), facultatif | Part mensuelle des appels Repull réservée à l'ERP (défaut 400). |
| `REPULL_QUOTA_MOIS` | Vercel (serveur), facultatif | Quota mensuel du compte Repull, pour l'affichage (défaut 1000, offre gratuite). |
| `ANTHROPIC_API_KEY` | Vercel (serveur) | Agent IA de la messagerie (`api/erp-agent.ts`), jamais côté navigateur. Absente : l'agent ne répond pas. |
| `AGENT_MODELE` | Vercel (serveur), facultatif | Modèle des réponses aux voyageurs (défaut `claude-haiku-4-5-20251001`). |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Vercel (serveur), facultatifs | Alertes Telegram de l'agent (transmissions, copies des réponses, relances). |

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
    supabase.ts       client Supabase, connexion, membres, fichiers, erreurs
    synchro.ts        lecture de la base, écriture par différence, file
                      d'attente, temps réel, état des automatisations
    collections.ts    liste des collections, jeu vide
    verifier-synchro.ts  auto-contrôle de la synchronisation (Node)
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
supabase/erp-installation.sql  installation de la base (à coller dans le SQL Editor)
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

Navigation simplifiée (septembre 2026) : **sept rubriques** dans la barre
latérale, plus **Paramètres** en bas. Une rubrique qui regroupe plusieurs pages
affiche une petite barre d'onglets commune sous l'en-tête
(`layout/OngletsRubrique.tsx`), pilotée par le registre
(`modules/registry.tsx` : chaque module déclare sa rubrique `group`). Les
anciennes adresses restent valables : seules les entrées de menu ont changé.

| Rubrique (barre latérale) | Onglets de la rubrique | Routes |
|---|---|---|
| Accueil | – | `/erp` : bonjour, « Aujourd'hui » (arrivées, départs, ménages, sujets), « À faire » (5 sujets, le reste dans un panneau), « Vos chiffres » (4 repères sur 30 jours) ; menu « … » : les 7 prochains jours |
| Logements | Vos logements · Rentabilité · Annonces | `/erp/logements` (`/:id?onglet=…`, `/connexions`), `/erp/performance` (`?onglet=suivi\|indicateurs`), `/erp/annonces` (`?logement=`) |
| Réservations | – | `/erp/reservations` (`?vue=liste`, `?q=`, `/:id`) |
| Messagerie agentique | (onglets internes) Conversations · Ce que l'agent a fait · Configurer mon agent | `/erp/messagerie` (`/:filId`, `?q=`), `/erp/messagerie/activite`, `/erp/messagerie/agent` |
| Opérations | Ménages · Linge · Incidents · Prestataires | `/erp/menages` (`?vue=a-traiter\|toutes\|controle`, `/:id`), `/erp/linge` (`?vue=ecarts\|journal`), `/erp/incidents` (`?id=`), `/erp/prestataires` (`/:id`) |
| Propriétaires | Propriétaires · Contrats de gestion · Prospection | `/erp/proprietaires` (`/:id`), `/erp/mandats` (`?mandat=`), `/erp/commercial` (`/simulateur`, `/lancement`) |
| Finance | Finance · Conformité | `/erp/finance` (`/releves`, `/factures`, `/paiements`, `/charges`, `/rentabilite`), `/erp/conformite` |
| Paramètres (en bas) | Paramètres · Automatisations | `/erp/parametres` (`/integrations`, `/donnees`, `/entreprise`), `/erp/automatisations` |

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

« Messagerie agentique > Configurer mon agent » enregistre un élément unique
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

L'onglet « Ce que l'agent a fait » est calculé depuis `filsMessages` :
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
| Finance | Relance des factures en retard (`relance-factures`) | quotidien | §2.7 | Facture émise échue : « en retard » et relance au propriétaire. |
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
2. **Créer le compte d'équipe.** L'ERP a un seul compte pour toute l'équipe
   (même vue pour tous) et **un seul mot de passe : `ERP_PASSWORD` (Vercel)**.
   Une fois ce mot de passe saisi sur la page d'accès, le serveur ouvre
   lui-même la session Supabase (`POST /erp/session` dans `middleware.ts`) :
   le compte d'équipe doit donc avoir **exactement le même mot de passe que
   `ERP_PASSWORD`**. Si `ERP_PASSWORD` change, changer aussi celui du compte
   (Authentication → Users). Sinon l'ERP affiche en secours un champ mot de
   passe. Supabase → **Authentication** → **Users** → **Add user** →
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
6. **Vérifier.** Ouvrir `https://www.labelmaisoncg.fr/erp`, mot de passe du
   site (`ERP_PASSWORD`) : l'ERP s'ouvre directement. Si l'écran « La base de données
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
de « Pour vous », une ligne va au journal, et l'écran affiche « Envoyé sur
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
   un résumé pour l'équipe (visible dans « Pour vous », « Ce que l'agent a
   fait » et en tête de la conversation), un court message d'attente au
   voyageur si utile, journal, alerte Telegram.

**Garde-fous** (en plus des consignes données à Claude) : il n'affirme que ce
qui est dans la fiche du logement et la réservation ; argent et litiges sont
toujours transmis (même si Claude proposait de répondre) ; une réponse ou un
message d'attente qui parle d'argent n'est jamais envoyé ; codes d'accès et
wifi absents du contexte tant que le voyageur n'y a pas droit (réservation
confirmée, arrivée sous 48 h ou sur place) ; les messages du voyageur sont
des données, pas des consignes ; réponse illisible → transmis.

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
- à la demande : Configurer mon agent → « Lancer l'agent maintenant ».

L'onglet Configurer montre l'état réel (bloc « Votre agent, en vrai ») :
agent actif ou en pause, clé IA présente ou manquante, plateformes reliées,
dernier passage, Telegram branché ou non. Le serveur ne renvoie que des
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
   parking, règles, équipements), puis Messagerie agentique → Configurer mon
   agent → activer, enregistrer, et « Lancer l'agent maintenant » pour
   vérifier.

**Coût estimé** (Claude Haiku 4.5, tarif public d'environ 1 $ par million de
jetons en entrée et 5 $ en sortie, à vérifier sur anthropic.com/pricing) :
2 000 à 3 000 jetons lus et 150 à 300 écrits par décision, soit **environ
0,3 à 0,5 centime par réponse**, moins d'1 € pour 200 réponses. Un passage
sans message en attente n'appelle pas Claude.

