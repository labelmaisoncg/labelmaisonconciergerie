# Audit SEO Label Maison — 2 novembre 2026

Objectif : 300 k€ de CA la première année, 1 M€ ou plus en 2027, le SEO comme premier canal d'acquisition.
Ce document est l'état des lieux mesuré (code du dépôt + site en ligne) et la stratégie recommandée.

## 1. Ce qui a été mesuré

| Point | Mesure | Verdict |
|---|---|---|
| Pages statiques dans `public/` | 1 357 (dont 1 278 pages « conciergerie-… ») | Volume très élevé pour 3 logements en gestion réelle |
| Title / description / canonical / H1 / JSON-LD | Présents sur 100 % des pages, aucun doublon | Bon |
| Longueur des titles | 1 339 pages > 60 caractères (jusqu'à 100) | Tronqués dans Google |
| Longueur des descriptions | 1 336 pages > 160 caractères | Tronquées dans Google |
| Contenu par page | médiane 1 367 mots, 11 pages < 700 mots | Bon volume |
| Similarité entre pages villes (Jaccard 8-grammes, 40 pages) | médiane 0,09 ; max 0,65 (Paris 15e / Paris 17e) | Globalement unique, sauf arrondissements de Paris |
| Sitemap | 3 sitemaps, 1 368 URL, `lastmod` figé au 11 août 2026 | À régénérer à chaque build |
| Redirection non-www → www | 307 (temporaire) | Passer en 308/301 |
| Accueil (SPA React) | HTML brut = 5 Ko, contenu uniquement en `<noscript>` ; titre brut ≠ titre Helmet | Google doit exécuter 590 Ko de JS pour lire la page |
| Pages React (/proprietaires, /studio, …) | HTML brut servi avec `<link rel="canonical" href="https://www.labelmaisoncg.fr/">` | **Canonical erroné** : chaque page se déclare copie de l'accueil avant exécution du JS |
| Lighthouse mobile accueil | Perf 76, LCP 6,5 s, poids 8,4 Mo (7 vidéos mp4 + portrait 621 Ko) | LCP « mauvais » (seuil 2,5 s) |
| Lighthouse mobile page Essonne | Perf 90, LCP 3,5 s, 342 Ko | Correct, LCP à améliorer |
| Mesure d'audience | Aucun outil (ni GA4, ni Plausible) ; Search Console seule | On pilote à l'aveugle |
| Fiche Google Business Profile | Créée le 13 oct. 2026, **non visible** (validation vidéo en attente) | Bloquant pour le SEO local |
| Avis / preuves | Aucun `aggregateRating`, 4 pages mentionnent des témoignages | Normal (règle : pas de faux avis), mais zéro preuve sociale |
| CRM (formulaires du site) | 31 contacts, 1 signé, 16 à appeler aujourd'hui, 11 relances en retard | Les leads SEO arrivent (Dourdan, Brunoy, Fleury-Mérogis, Sainte-Geneviève…) mais le suivi décroche |
| Backlinks | Non mesurés (connecteur Ahrefs non autorisé) | À mesurer |

Chiffre à vérifier avant de le laisser en ligne : « Commission 10 %, +15 biens gérés » apparaît dans 15 pages. Si les 15 biens ne sont pas gérés aujourd'hui, c'est contraire à la règle maison « que des preuves réelles » et c'est un risque de confiance.

## 2. Analyse page par page

### Accueil `/`
- H1 : « Votre patrimoine, géré comme une maison de confiance. » Aucun mot-clé recherché. Personne ne tape ça dans Google.
- Deux titles différents (HTML brut « Paris, Dubaï & Marrakech », Helmet « haut de gamme à Paris »). Google choisit lui-même.
- Positionnement éclaté : conciergerie privée de luxe, Dubaï, Marrakech, montres Rolex, chauffeur, van, love room, studio IA, conciergerie Airbnb dans 1 300 villes. Google ne sait pas de quoi le site est l'expert. C'est le problème numéro un.
- 8,4 Mo au chargement mobile, LCP 6,5 s : les vidéos « lifestyle » se chargent toutes.

### Pages piliers (`/conciergerie-airbnb-essonne`, `/conciergerie-airbnb-paris`, `/conciergerie-privee-paris`)
- Structure solide : H1 ciblé, H2 par intention (marché, réglementation, démarrage, FAQ), FAQ en JSON-LD, formulaire, maillage (127 pages lient vers la page Essonne).
- Il manque ce qui fait signer : photos des biens réellement gérés dans la ville, chiffres réels par bien (taux d'occupation, prix moyen), avis Google, nom et visage du responsable local.
- Title à 80 caractères : « Conciergerie Airbnb Essonne (91) | Gestion Airbnb clé en main – LabelMaison » → tronqué.

### Pages villes nationales (1 278 pages)
- Chaque page est honnêtement rédigée (texte unique, photos Wikimedia créditées, ~1 300 mots), ce qui limite le risque de contenu dupliqué.
- Mais une conciergerie basée à Villabé qui promet « nos équipes de ménage interviennent sur l'ensemble du secteur » à Clermont-Ferrand, Bastia ou Chamonix tombe dans ce que Google appelle depuis mars 2024 le « scaled content abuse » et les « doorway pages ». Le risque n'est pas théorique : il se traduit par des pages jamais indexées ou un déclassement global du domaine, qui entraînerait aussi les pages Essonne.
- Ces pages ont généré des leads hors zone (Gard, Gien, Troyes, Loiret) que l'équipe ne peut pas servir : c'est du temps commercial perdu.

### Blog (`/blog`, 17 guides)
- Bonne base (fiscalité, réglementation, rentabilité). Dernier article : 15 août 2026. Un blog qui ne publie plus depuis 2 mois et demi n'envoie aucun signal de fraîcheur.
- Seulement 8 pages avec `BlogPosting` en JSON-LD alors qu'il y a 17 guides.

### Pages React (/proprietaires, /studio, /cerclelabelmaison…)
- Canonical brut vers l'accueil : à corriger en priorité (une balise par route dans `scripts/spa-shells.mjs`).

## 3. Les 10 constats, du plus grave au moins grave

1. Positionnement dispersé : pas d'autorité thématique lisible par Google.
2. Fiche Google Business Profile non visible : pour une requête « conciergerie airbnb évry », le pack local (carte + 3 fiches) prend la première place. Vous n'y êtes pas.
3. 1 278 pages nationales sans présence réelle : risque algorithmique et leads non servables.
4. Canonical erroné sur toutes les routes React.
5. Aucune preuve sociale (avis Google, études de cas chiffrées, visages).
6. Aucune mesure : pas d'analytics, pas de suivi « quelle page a généré quel lead ».
7. Accueil : 8,4 Mo, LCP 6,5 s, H1 sans mot-clé.
8. Blog arrêté depuis août ; sitemap figé.
9. Titles et descriptions trop longs sur 98 % des pages.
10. Backlinks : inconnus, probablement quasi nuls (le nom « Label Maison » est squatté par une franchise de meubles et par le label « Maisons des illustres » : la requête de marque elle-même n'est pas acquise).

## 4. La stratégie qui a fait ses preuves

C'est le modèle suivi par les conciergeries qui dominent Google en France (Houst, GuestReady, Welkeys, Hostnfly) et par les acteurs locaux qui gagnent sur leur département. Il tient en cinq piliers, dans cet ordre.

### Pilier 1 — Un seul sujet, un seul territoire (« topical authority »)
- Sujet : **gestion locative courte durée pour propriétaires** (conciergerie Airbnb). C'est le seul service où le SEO ramène des mandats récurrents.
- Territoire 2027 : **Essonne + sud de Paris + Paris**, puis Côte d'Azur à l'été 2027 quand l'équipe y sera (décision déjà prise par Kamel).
- Les autres activités (Dubaï, Marrakech, montres, chauffeur, love room, studio) restent en ligne mais sortent de l'accueil et du menu principal ; elles vivent dans leur silo avec leur propre page d'entrée.
- Pages nationales : garder les villes où un partenaire ou une équipe peut réellement intervenir (Île-de-France, Sens, Côte d'Azur, Lyon et Dijon si un relais existe). Pour les autres, deux options : `noindex` + retrait du sitemap (réversible), ou transformation en pages « guide du marché local » sans promesse de service, avec renvoi vers le réseau Label Maison Sens. Ne pas supprimer brutalement 1 000 URL d'un coup.

### Pilier 2 — SEO local (le levier le plus rapide)
- Valider la fiche Google (vidéo à filmer par Kamel : façade/bureau Villabé, véhicule, linge, clés). Sans fiche, aucune première place locale possible.
- Avis Google : demander un avis à chaque propriétaire et chaque voyageur satisfait, avec un lien court. Objectif 30 avis en 6 mois. C'est le facteur n°1 du pack local.
- Posts Google hebdomadaires (photos réelles de biens, avant/après ménage, arrivée de clés).
- Citations cohérentes (même nom, téléphone, site) : Pages Jaunes, Société.com, annuaires conciergerie, mairie/CCI Essonne.
- Une page par ville de l'Essonne réellement couverte (déjà fait pour 15 villes) : y ajouter la preuve locale (bien géré, photo, chiffres réels).

### Pilier 3 — Contenu qui convertit des propriétaires
- Cadence : 1 article par semaine, 52 par an, sur les requêtes que tape un propriétaire avant de signer : « combien rapporte un airbnb à [ville] », « conciergerie airbnb prix », « conciergerie ou gestion classique », « meublé de tourisme déclaration [ville] », « LMNP 2027 ».
- Pages comparatives honnêtes : « Quelle conciergerie Airbnb en Essonne ? » (vous êtes les seuls à pouvoir la faire, personne n'est positionné sur ce département d'après les recherches effectuées).
- Études de cas réelles : 3 biens, 3 pages, avec revenus mensuels, taux d'occupation, photos. Un propriétaire signe sur une preuve, pas sur un adjectif.
- Simulateur de revenus (`/simulateur-revenus-airbnb`) mis en avant partout : c'est l'aimant à leads qui a fait la croissance de Houst et GuestReady.
- Page « Qui sommes-nous » avec Abdel et Kamel, SIRET, parcours : signaux E-E-A-T (expérience, expertise, autorité, fiabilité).

### Pilier 4 — Autorité (backlinks)
- Presse locale : Le Républicain de l'Essonne, Essonne Info, Actu Essonne. Angle : « deux frères créent la conciergerie des propriétaires essonniens », chiffres réels.
- Partenaires qui ont un site : BNB Cleaning, Ba'cam Spa, Label Maison Sens, artisans, photographes, Repull. Un lien chacun, réciproque si besoin.
- Annuaires et comparateurs de conciergeries (ils existent et rankent : « meilleure conciergerie airbnb » est tenu par ces comparatifs). Y figurer.
- Interventions : podcasts immobilier/LMNP, groupes Facebook de propriétaires, LinkedIn d'Abdel avec lien vers les études de cas.
- Objectif : 30 domaines référents de qualité en 12 mois. Pas d'achat de liens.

### Pilier 5 — Technique et mesure
- Corriger canonical/title par route React (`scripts/spa-shells.mjs`), réécrire le H1 de l'accueil (« Conciergerie Airbnb en Essonne et à Paris : votre bien géré de A à Z »), charger les vidéos à la demande avec une affiche fixe, viser LCP < 2,5 s.
- Raccourcir titles (≤ 60) et descriptions (≤ 155) dans `scripts/seo_common.py`, régénérer.
- Sitemap régénéré au build, `lastmod` réel ; redirection non-www en 308.
- Installer une mesure respectueuse (Plausible ou GA4 avec consentement) et surtout **enregistrer la page d'origine de chaque lead dans le CRM** (le formulaire envoie déjà `page` : l'afficher dans la fiche et dans le point du jour).
- Search Console chaque lundi : pages indexées, requêtes, clics ; c'est le tableau de bord du million.

## 5. Plan 90 jours puis 2027

### Novembre — fondations
Fiche Google validée. Canonical et H1 corrigés. Accueil allégé. Titles raccourcis. Analytics + source des leads. Sitemap vivant. Décision sur les pages nationales.

### Décembre — preuves
3 études de cas réelles publiées. Page « Qui sommes-nous ». Première campagne d'avis Google (objectif 10). 4 articles. Dossier de presse local envoyé.

### Janvier — autorité
Article hebdomadaire tenu. 5 premiers backlinks partenaires. Page comparative Essonne. Posts Google hebdomadaires. Premier bilan Search Console : requêtes où le site est en page 2 (positions 11-20) à pousser.

### 2027
- T1 : domination Essonne (top 3 sur « conciergerie airbnb + 15 villes du 91 »), 20 avis Google.
- T2 : Paris sud et petite couronne (92, 94) avec preuves réelles.
- T3 : Côte d'Azur au moment de l'ouverture, même méthode (fiche Google locale, biens réels, presse locale).
- Toute l'année : 1 article/semaine, 2-3 backlinks/mois, revue Search Console hebdomadaire.

## 6. L'arithmétique du million

Le SEO ne fait pas le CA, il fait des rendez-vous. La chaîne est : clics → formulaires → appels → rendez-vous → mandats → CA.

- Aujourd'hui le CRM montre 31 contacts, 4 rendez-vous, 1 signé, 11 relances en retard. Avant de multiplier le trafic, il faut que chaque lead soit appelé le jour même et relancé à date : c'est le gain le moins cher.
- À définir avec vous pour fixer les objectifs mensuels : CA moyen annuel par mandat (commission 10 % affichée) et taux de conversion rendez-vous → mandat. Avec ces deux chiffres on déduit le nombre de leads SEO nécessaires par mois et le nombre de mots-clés à tenir en top 3.
- À 10 % de commission, le million par la seule conciergerie suppose plusieurs centaines de mandats ; soit la grille tarifaire évolue (15-20 % est le marché à Paris), soit le CA 2027 reste un mix conciergerie + services premium, et la stratégie SEO doit alors garder une page d'entrée forte pour ces services sans polluer le sujet principal.

## 7. Ce qui n'a pas pu être vérifié
- Positions réelles dans Google France et pages indexées : seule la Search Console les donne. À exporter (Performance → 16 mois, Pages → couverture) pour la prochaine revue.
- Backlinks existants (connecteur Ahrefs à autoriser, ou export gratuit Search Console → Liens).
- La véracité des « +15 biens gérés ».
