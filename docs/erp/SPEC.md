# ERP Label Maison — cahier des charges

L'ERP interne de Label Maison Conciergerie, servi sur **labelmaisoncg.fr/erp**,
dans le même projet que le site (Vite + React 18 + react-router 7 + Tailwind 4).

Objectif : sortir l'exploitation de WhatsApp. Chaque information a **un seul
endroit**. Si ce n'est pas dans l'ERP, ça n'existe pas.

Rôles humains :
- **Abdel** — gérant, commercial : propriétaires, mandats, relation client.
- **Kamel** — systèmes et chiffres : opérations, finance, pilotage, conformité.
- **Prestataires** (ménage, linge, maintenance) : à terme, un accès restreint
  à leurs seules missions.

---

## 1. Hiérarchie fonctionnelle (ordre de dépendance)

Un ERP de conciergerie se construit du référentiel vers le pilotage. Chaque
couche dépend de celles du dessus.

| # | Couche | Modules | Question à laquelle il répond |
|---|---|---|---|
| 1 | **Référentiel** | Propriétaires, Mandats, Logements | Qui nous confie quoi, à quelles conditions ? |
| 2 | **Distribution** | Réservations & calendrier, Tarifs | Qui dort où, quand, à quel prix ? |
| 3 | **Relation voyageur** | Messagerie (agent IA) | Qu'a-t-on dit à chaque voyageur ? |
| 4 | **Opérations** | Ménages (missions), Linge, Incidents & maintenance, Inventaires | Le logement est-il prêt, et peut-on le prouver ? |
| 5 | **Prestataires** | Prestataires, conformité, qualité | Qui intervient, est-il en règle, est-il bon ? |
| 6 | **Finance** | Relevés propriétaires, Factures, Paiements prestataires, Charges, Rentabilité | Combien a-t-on gagné, sur quoi, et qui doit quoi ? |
| 7 | **Commercial** | Pipeline propriétaires, Lancement d'un mandat | D'où viennent les prochains logements ? |
| 8 | **Pilotage** | Tableau de bord, indicateurs | Tout va-t-il bien cette semaine ? |
| 9 | **Conformité & administration** | Réglementation, Documents, Utilisateurs, Intégrations | Sommes-nous en règle, et qui a accès à quoi ? |

## 2. Règles métier non négociables (leçons de 2026)

1. **Mandat écrit obligatoire** : un logement ne passe « Actif » que si son
   mandat est signé ET sa checklist de lancement complète.
2. **Checklist de lancement** (bloquante) : mandat signé, inventaire
   contradictoire signé (photos), linge étiqueté (dotation définie), accès
   sécurisé (serrure connectée ou boîte à clés, code par séjour), assurance
   propriétaire, n° d'enregistrement meublé de tourisme, DPE, fiche logement
   complète (wifi, accès, horaires, règles), prestataire ménage affecté sous
   contrat.
3. **Prestataire** : ne peut recevoir de mission que si contrat signé,
   attestation RC Pro valide et attestation de vigilance URSSAF valide
   (< 6 mois). La sous-traitance en cascade est interdite.
4. **Mission de ménage** : créée automatiquement à chaque départ. Elle n'est
   « Validée » que si la checklist est cochée ET photos avant/après
   horodatées présentes. **Pas de validation = pas de paiement.**
5. **Contrôle qualité** : 1 mission sur 10 tirée au sort pour contrôle
   physique ; toute note voyageur < 4,5 déclenche un contrôle.
6. **Linge** : stock par logement (jeux par lit), chaque mouvement tracé
   (sorti sale, blanchisserie, remis propre). Jamais lavé au domicile d'un
   prestataire. Écart d'inventaire = incident.
7. **Relation propriétaire** : relevé mensuel automatique (réservations,
   montants versés, commission, frais de ménage). Le propriétaire ne modifie
   pas l'annonce sans concertation (clause contractuelle).
8. **Argent** : l'agent IA n'engage jamais d'argent. Remboursement, geste
   commercial → humain.
9. **Rémunération** : commission cible 18–20 % (anciens mandats 10 %,
   migration au renouvellement) + frais de ménage.
10. **Conformité** : SASU (jamais « micro-entreprise » dans les documents),
    compteur 120 nuits pour les résidences principales, n° d'enregistrement.

## 3. Modèle de données

Types TypeScript dans `src/erp/data/types.ts` ; schéma Postgres miroir dans
`supabase/migrations/`. Identifiants : chaînes (`uuid` en base). Dates :
chaînes ISO `YYYY-MM-DD`, horodatages ISO complets. Montants : **centimes
entiers** (`number`), jamais de flottants pour l'argent.

- `Proprietaire` : id, type (particulier | sci | societe), nom, contact
  (email, téléphone), adresse, iban_masque, notes, cree_le.
- `Mandat` : id, proprietaireId, logementId, reference, statut
  (brouillon | envoye | signe | resilie), commissionPct, fraisMenageCentimes,
  dateDebut, dateFin?, periodeEssaiFin?, preavisJours, signeLe?, resilieLe?,
  motifResiliation?, documentUrl?.
- `Logement` : id, nom, adresse, ville, codePostal, type (studio | T1 | T2 |
  T3 | T4 | maison | autre), surfaceM2, capacite, chambres, lits (liste
  {type: simple|double|canape, nombre}), statut (lancement | actif | pause |
  sorti), proprietaireId, residencePrincipale (bool), numeroEnregistrement?,
  dpe? (A–G), serrure (connectee | boite_a_cles | cles), fiche (wifiNom,
  wifiCode, heureArrivee, heureDepart, acces, parking, regles, equipements[]),
  dotationLinge (liste {article, quantite}), channexPropertyId?, annonces
  (liste {canal: airbnb|booking|direct, url?, connecte: bool}),
  checklistLancement (liste {cle, libelle, fait: bool, preuve?}),
  photoUrl?.
- `Reservation` : id, logementId, canal (airbnb | booking | direct | autre),
  voyageur (nom, pays?, nbPersonnes), arrivee, depart, nuits, statut
  (confirmee | annulee | en_cours | terminee), montantBrutCentimes,
  commissionPlateformeCentimes, fraisMenageCentimes, noteVoyageur?,
  commentaireVoyageur?, channexBookingId?.
- `FilMessages` : id, reservationId?, logementId, canal, voyageur, statut
  (ouvert | escalade | clos), messages (liste {id, auteur: voyageur | hote |
  agent, texte, envoyeLe}), dernierMessageLe, traitePar (agent | humain |
  en_attente).
- `Mission` (ménage / intervention) : id, type (menage | linge | controle |
  maintenance), logementId, reservationId?, prestataireId?, date,
  heureDebut, heureFinMax, statut (a_attribuer | attribuee | en_cours |
  a_valider | validee | refusee | annulee), checklist (liste {libelle,
  fait}), photos (liste {url, moment: avant | apres, prisLe}), tarifCentimes,
  controleQualite (bool), noteControle?, commentaire?.
- `Prestataire` : id, nom, raisonSociale?, siret?, type (menage | linge |
  maintenance | serrurier | autre), telephone, email?, zone (villes[]),
  statut (actif | suspendu | sorti), tarifs (liste {typeLogement,
  montantCentimes}), documents (liste {type: contrat | rc_pro | urssaf |
  kbis | autre, valideJusquau?, url?, statut: valide | expire | manquant}),
  noteMoyenne?, missionsRealisees.
- `MouvementLinge` : id, logementId, date, type (sortie_sale | envoi_blanchisserie
  | retour_propre | mise_en_place | perte | rebut), articles (liste
  {article, quantite}), prestataireId?, missionId?, note?.
- `Incident` : id, logementId, reservationId?, date, categorie (menage |
  linge | casse | panne | acces | voyageur | autre), gravite (faible |
  moyenne | haute), description, statut (ouvert | en_cours | resolu),
  responsable?, coutCentimes?, refacturable (proprietaire | voyageur |
  prestataire | aucun), preuves (urls), resoluLe?.
- `Facture` : id, numero, type (commission | menage | prestation |
  avoir), destinataire (proprietaire | voyageur | autre), proprietaireId?,
  dateEmission, echeance, montantHtCentimes, tvaPct, statut (brouillon |
  emise | payee | en_retard | annulee), payeeLe?, lignes (liste {libelle,
  quantite, puCentimes}).
- `PaiementPrestataire` : id, prestataireId, periode (YYYY-MM), missions
  (ids), montantCentimes, retenueCentimes, motifRetenue?, statut (a_payer |
  paye | bloque), payeLe?.
- `Charge` : id, date, libelle, categorie (linge | produits | transport |
  logiciel | assurance | serrurerie | autre), montantCentimes, logementId?.
- `Prospect` (pipeline commercial) : id, nom, ville, source (seo |
  parrainage | cercle | reseau | appel_entrant | autre), typeBien,
  revenuEstimeAnnuelCentimes, etape (nouveau | contact | visite |
  proposition | negociation | signe | perdu), prochaineAction?,
  prochaineActionLe?, responsable (abdel | kamel), notes, creeLe.
- `Utilisateur` : id, nom, email, role (gerant | operations | prestataire |
  lecture).
- `Journal` (audit) : id, horodatage, auteur, action, entite, entiteId,
  details.

Les **indicateurs** se calculent à partir de ces entités (voir §6), jamais
saisis à la main.

## 4. Architecture technique

```
src/erp/
  ErpApp.tsx            routeur /erp/*, layout, garde de rôle
  layout/               barre latérale, en-tête, fil d'Ariane, recherche
  ui/                   kit de composants ERP (maison, Tailwind)
  data/
    types.ts            modèle §3
    seed.ts             jeu de démo réaliste (mockup)
    store.tsx           ErpProvider + hooks (useErp, useLogements…) ;
                        mode démo en mémoire, prêt pour Supabase
    selectors.ts        calculs partagés (KPIs, montants, dates)
    format.ts           euros, dates FR, pluriels
  modules/<module>/     un dossier par module, index.tsx = page(s)
supabase/migrations/    schéma SQL (Postgres + RLS)
```

- **Chargement paresseux** : `App.tsx` charge `ErpApp` via `React.lazy` —
  le site public ne télécharge pas l'ERP. Sous `/erp`, ni la navigation ni le
  pied de page du site, ni l'intro animée.
- **Accès** : le middleware Vercel protège `/erp` par mot de passe
  (`ERP_PASSWORD`, cookie signé `erp_session`, sur le modèle de `/linge`) et
  réécrit `/erp/*` vers la coquille SPA (cleanUrls ignore les rewrites).
- **Données** : mode **démo** tant que `VITE_SUPABASE_URL` n'est pas défini
  (bandeau « Données de démonstration »). Les mutations en démo modifient
  l'état en mémoire (et `localStorage`, clé `lm-erp-demo-v1`, avec
  try/catch) pour que la maquette soit manipulable.
- **Intégrations** (écran Paramètres → Intégrations) : Channex (réservations,
  calendrier, messagerie), Anthropic (agent IA, `agent-ia/`), Supabase
  (base), Resend (e-mails). Chaque intégration affiche son état.

## 5. Charte graphique

Identité « Ivoire & or » du site, version outil de travail : dense, lisible,
sobre.

- Fond `#FBFAF8` (ivoire), surfaces blanches, bordures `rgba(20,17,14,.08)`.
- Texte `#14110E` (encre), secondaire `rgba(20,17,14,.6)`.
- Accent or `#A97C30` (actions principales, élément actif), or clair
  `#C39A4A`, brun `#403118`.
- États : succès `#2F7D55`, alerte `#B7791F`, danger `#B42318`, info
  `#2B6CB0` — toujours doublés d'un libellé ou d'une icône.
- Titres : Playfair Display (déjà chargée par le site) ; interface : pile
  système sans empattement. Chiffres tabulaires (`tabular-nums`).
- Icônes : `lucide-react`. Graphiques : `recharts`.
- Barre latérale groupée par couche (§1). Mobile : barre latérale en tiroir,
  tableaux défilants horizontalement dans leur conteneur, jamais la page.
- Tout le texte d'interface est en **français**, sans tiret cadratin (—)
  dans le contenu visible.

## 6. Indicateurs du tableau de bord

- Logements actifs / en lancement ; taux d'occupation 30 j ; revenu brut
  géré du mois ; commission Label Maison du mois ; ADR ; RevPAR.
- Note voyageur moyenne 90 j ; % missions validées avec photos ; missions à
  attribuer < 48 h ; incidents ouverts ; linge : écarts d'inventaire.
- Prestataires : documents expirés ou expirant < 30 j.
- Commercial : prospects par étape, valeur du pipeline, signatures du mois.
- Finance : factures en retard, paiements prestataires à faire.

## 7. Règles de travail entre agents

- Chaque agent n'écrit **que** dans les dossiers qui lui sont attribués.
- Pas de commit : l'orchestrateur commite.
- Pas de nouvelle dépendance npm sans nécessité absolue.
- Vérification : `npx tsc -p tsconfig.erp.json --noEmit` doit passer.
