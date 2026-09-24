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
  Le sélecteur Abdel / Kamel ne sert qu'à signer les actions au journal.

## Lancer en local

```bash
npm install
npm run dev
# puis http://localhost:5173/erp
```

En local, pas de mot de passe : le middleware Vercel ne tourne pas sous Vite.
Les données sont celles du jeu de démonstration (voir plus bas).

Vérifications à faire passer avant toute livraison :

```bash
npx tsc -p tsconfig.erp.json --noEmit     # types de l'ERP
npm run build                             # build complet du site + ERP

# Auto-contrôle du moteur d'automatisations (idempotence sur le jeu de démo)
node_modules/.bin/esbuild src/erp/automatisations/verifier.ts --bundle \
  --platform=node --outfile=/tmp/verifier.cjs && node /tmp/verifier.cjs
```

Le vérificateur exécute le moteur deux fois sur la démo : la seconde passe doit
produire **0 changement**, le seed doit rester intact et les ids uniques.

## Variables d'environnement

| Variable | Où | Rôle |
|---|---|---|
| `ERP_PASSWORD` | Vercel, **Production ET Preview** (obligatoire) | Mot de passe de `/erp`. Absent : accès refusé (page 503), jamais ouvert. Redéployer après modification. |
| `LINGE_PASSWORD` | Vercel | Mot de passe du registre `/linge` (inchangé). |
| `VITE_SUPABASE_URL` | build (Vercel) | Active le mode `supabase`. Tant qu'il est absent, l'ERP reste en mode démo. |
| `VITE_SUPABASE_ANON_KEY` | build (Vercel) | Clé publique Supabase (à brancher avec le mode `supabase`, voir plus bas). |
| `CHANNEX_API_KEY`, `CHANNEX_BASE_URL`, `CHANNEX_WEBHOOK_SECRET` | serveur | Channel manager (à la mise en production réelle). |
| `ANTHROPIC_API_KEY` | serveur | Agent IA de la messagerie (`agent-ia/`), jamais côté navigateur. |

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
    store.tsx         ErpProvider + useErp() : état, mutations, journal, moteur
    seed*.ts          jeu de démonstration déterministe
  automatisations/    moteur pur (sans React) + une règle par automatisation
  analyse/            analyse des biens (SPEC §10), moteur pur
  ui/                 kit de composants (Button, Table, Drawer, Stat...)
  layout/             barre latérale, en-tête, recherche, bandeau démo
  modules/
    registry.tsx      liste des modules : route, menu, groupe, composant
    <module>/index.tsx
supabase/migrations/  schéma Postgres miroir (schéma erp, RLS), à appliquer dans l'ordre
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

## Démo ou réel

| | Aujourd'hui |
|---|---|
| Données | Jeu de démo réaliste (11 logements en Essonne et à Paris, réservations de juin à novembre 2026, missions, linge, factures...). Noms et adresses fictifs. Date de référence figée au 24 septembre 2026. |
| Persistance | Mémoire du navigateur + `localStorage` (clés `lm-erp-demo-v1` pour les données, `lm-erp-auto-v1` pour les automatisations). « Réinitialiser » dans le bandeau recharge la démo. |
| Plateformes | Rien n'est envoyé à Airbnb, Booking ni Channex. |
| Supabase | Schéma prêt (migrations ci-dessous). Le mode `supabase` est détecté mais retombe encore sur la démo (TODO dans `store.tsx`). |
| Utilisateurs | Sélecteur Abdel / Kamel pour signer les actions ; l'authentification réelle reste le mot de passe du middleware. |

## Mise en production réelle

Dans l'ordre :

1. **Supabase** : créer un projet dans une région **UE** (Paris ou Francfort),
   puis appliquer les migrations **dans l'ordre des noms** :
   1. `supabase/migrations/20260924000000_erp_schema.sql` (schéma `erp`,
      tables, fonctions de rôle, RLS) ;
   2. `supabase/migrations/20260925000000_erp_recommandations.sql` (suivi des
      améliorations, SPEC §10) ;
   3. `supabase/migrations/20260926000000_erp_incidents_recupere.sql`
      (colonne `recupere_le` des incidents).

   Créer les comptes Abdel et Kamel dans Supabase Auth, puis leurs lignes dans
   `erp.utilisateurs` (même `id` que `auth.users`, rôles `gerant` et
   `operations`). Renseigner `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`
   dans Vercel.
2. **Channex** : ouvrir le compte production (environ 140 USD par mois pour 10
   logements : socle + prix par logement + module messagerie), terminer la
   certification, relier chaque logement (`channexPropertyId`) et pointer les
   webhooks réservations et messages vers l'ERP (`CHANNEX_*`).
3. **Anthropic** : recharger les crédits de l'agent IA (`agent-ia/`), poser un
   plafond de dépense mensuel dans la console, `ANTHROPIC_API_KEY` côté serveur
   uniquement. L'agent n'engage jamais d'argent.
4. **Basculer le store en mode `supabase`.** C'est le travail qui reste à
   coder, précisément :
   - **Couche d'accès aux données** (`src/erp/data/supabase.ts`, nouveau) :
     client `@supabase/supabase-js` sur le schéma `erp` (ou appels REST
     PostgREST avec `fetch` pour ne pas ajouter de dépendance), lecture de
     toutes les collections au chargement, correspondance camelCase
     (TypeScript) vers snake_case (SQL), montants en `bigint` de centimes,
     objets imbriqués (`fiche`, `lits`, `checklist`, `photos`, `lignes`...) en
     `jsonb`.
   - **Écritures** : `appliquer()` dans `store.tsx` calcule déjà l'état suivant ;
     il faut en déduire les lignes créées ou modifiées (y compris celles du
     moteur, listées dans `ResultatMoteur.changements`) et les envoyer en
     `upsert`, avec mise à jour optimiste et retour arrière en cas d'erreur.
     Le journal va dans `erp.journal` (insertion seule, déjà prévu par la RLS).
   - **Authentification et RLS** : remplacer le sélecteur Abdel / Kamel par une
     session Supabase Auth (lien magique ou mot de passe) ; l'utilisateur
     courant vient de `auth.uid()`. Les politiques du schéma donnent tout à
     l'équipe (`gerant`, `operations`), la lecture seule au rôle `lecture` et
     aux prestataires leurs seules missions. Le mot de passe du middleware
     peut rester en première barrière.
   - **Identifiants** : la démo utilise des ids texte, et les automatisations
     des ids déterministes (`auto-lin-envoi-...`, `auto-inc-linge-...`,
     `reco-...`, contrôles qualité...) qui garantissent l'idempotence. Les
     tables en `uuid` doivent soit passer en `text` pour ces entités, soit
     recevoir un uuid v5 dérivé de la clé déterministe (même clé, même uuid).
   - **Où tourne le moteur** : en production il ne doit pas dépendre d'un
     navigateur ouvert. Le déplacer dans une fonction Vercel planifiée (cron
     quotidien protégé par `CRON_SECRET`, plus un appel après chaque webhook
     Channex) qui lit la base, exécute `executerAutomatisations` avec la date
     du jour réelle à la place de `AUJOURDHUI`, et écrit les changements. Le
     navigateur garde l'exécution locale pour l'affichage immédiat.
   - **Date du jour** : remplacer la constante `AUJOURDHUI` (figée pour la
     démo) par la date réelle en fuseau Europe/Paris.
   - **Fichiers** : photos de ménage, preuves d'incident et documents
     prestataires dans Supabase Storage (bucket privé, URLs signées) au lieu
     des `demo://`.
   - Retirer le bandeau « Données de démonstration » quand `mode === 'supabase'`
     (`demo: false` dans le contexte).
