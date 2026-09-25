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
| `CHANNEX_API_KEY`, `CHANNEX_BASE_URL`, `CHANNEX_WEBHOOK_SECRET` | serveur | Channel manager (à la mise en production réelle). |
| `ANTHROPIC_API_KEY` | serveur | Agent IA de la messagerie (`agent-ia/`), jamais côté navigateur. |

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
    seed*.ts          jeu de démonstration déterministe (chargé seulement en démo)
  automatisations/    moteur pur (sans React) + une règle par automatisation
  analyse/            analyse des biens (SPEC §10), moteur pur
  ui/                 kit de composants (Button, Table, Drawer, Stat...)
  layout/             barre latérale, en-tête, recherche, connexion (Connexion.tsx),
                      état d'enregistrement (EtatSynchro.tsx), bandeau démo
  modules/
    registry.tsx      liste des modules : route, menu, groupe, composant
    <module>/index.tsx
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

| Couche | Module | Route |
|---|---|---|
| Pilotage | Tableau de bord (vue unique pour tous) | `/erp` |
| Pilotage | Performance des biens (analyse, décisions, suivi des recommandations) | `/erp/performance` |
| Pilotage | Automatisations (règles, interrupteurs, journal, exceptions à traiter) | `/erp/automatisations` |
| Commercial | Pipeline, simulateur de revenus, lancement d'un mandat | `/erp/commercial` (`/simulateur`, `/lancement`) |
| Référentiel | Propriétaires | `/erp/proprietaires` (`/:id`) |
| Référentiel | Mandats | `/erp/mandats` |
| Référentiel | Logements | `/erp/logements` (`/:id?onglet=performance\|lancement\|fiche\|linge\|canaux\|historique`) |
| Distribution | Réservations (calendrier, `?vue=liste`) | `/erp/reservations` (`/:id`) |
| Distribution | Annonces (rafraîchissement mensuel, validation, historique, effet mesuré) | `/erp/annonces` (`?logement=`) |
| Relation voyageur | Messagerie | `/erp/messagerie` (`/:filId`) |
| Opérations | Ménages | `/erp/menages` (`/:id`) |
| Opérations | Linge | `/erp/linge` (`?vue=ecarts\|journal`) |
| Opérations | Incidents | `/erp/incidents` (`?id=`) |
| Prestataires | Prestataires | `/erp/prestataires` (`/:id`) |
| Finance | Finance | `/erp/finance` (`/releves`, `/factures`, `/paiements`, `/charges`, `/rentabilite`) |
| Conformité & admin | Conformité | `/erp/conformite` |
| Conformité & admin | Paramètres | `/erp/parametres` (`/integrations`, `/donnees`, `/entreprise`) |

Sur chaque logement, deux chiffres sont visibles partout où il apparaît
(liste en cartes et en tableau, en-tête de la fiche logement, fiche
propriétaire) : la **commission** du mandat (« sous la cible » sous 18 %,
« Pas de mandat » sinon) et la **rentabilité pour Label Maison** (marge par
mois sur 90 jours, même calcul que `/erp/performance`). Composants dans
`modules/logements/_composants/EconomieBien.tsx`.

Chaque module est monté sur `<segment>/*` et gère ses sous-routes avec un
`<Routes>` relatif. La recherche globale renvoie vers `/erp/logements/:id`,
`/erp/proprietaires/:id` et `/erp/reservations/:id`.

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
   (même vue pour tous) : l'écran de connexion ne demande que le mot de
   passe. Supabase → **Authentication** → **Users** → **Add user** →
   **Create new user** : e-mail `equipe@labelmaisoncg.fr` (adresse technique,
   aucune boîte mail n'est nécessaire), mot de passe de l'équipe, cocher
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
   site, puis le mot de passe de l'équipe. Si l'écran « La base de données
   n'est pas encore installée » reste affiché après l'étape 1 : Supabase →
   **Project Settings** → **Data API** (parfois **Settings → API**) →
   **Exposed schemas** → ajouter `erp` → Save, puis « Réessayer ».
   « Votre compte n'est pas autorisé » : l'e-mail n'est pas (ou mal écrit)
   dans `erp.membres` (étape 3).

Sauvegarde : Paramètres → Données → **Exporter en JSON** télécharge toute la
base à l'instant T. Les anciennes versions de chaque élément restent dans
`erp.historique` (Table Editor, schéma `erp`).

### Ensuite

1. **Channex** : ouvrir le compte production (environ 140 USD par mois pour 10
   logements : socle + prix par logement + module messagerie), terminer la
   certification, relier chaque logement (`channexPropertyId`) et pointer les
   webhooks réservations et messages vers l'ERP (`CHANNEX_*`). En attendant,
   les réservations se saisissent à la main (Réservations → Nouvelle
   réservation) et le ménage de chaque départ se crée tout seul.
2. **Anthropic** : recharger les crédits de l'agent IA (`agent-ia/`), poser un
   plafond de dépense mensuel dans la console, `ANTHROPIC_API_KEY` côté serveur
   uniquement. L'agent n'engage jamais d'argent.
3. **Moteur hors navigateur** : aujourd'hui le moteur d'automatisations tourne
   dans le navigateur à chaque ouverture et après chaque action (résultat
   enregistré dans la base). Les tâches du jour se font donc dès que quelqu'un
   ouvre l'ERP. Pour qu'elles tournent même si personne ne l'ouvre : fonction
   Vercel planifiée (cron quotidien protégé par `CRON_SECRET`, plus un appel
   après chaque webhook Channex) qui lit `erp.enregistrements` avec la clé
   `service_role` (côté serveur uniquement), exécute `executerAutomatisations`
   avec la date du jour à Paris et écrit la différence, exactement comme
   `synchro.ts`.
4. **Accès prestataires** : règles RLS dédiées (leurs seules missions) avant
   de donner le rôle `prestataire` à qui que ce soit.
