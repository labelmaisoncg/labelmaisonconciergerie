# Agent IA — le bras droit des conciergeries

Un agent conversationnel que des conciergeries adoptent comme assistant
d'exploitation. Chacune le configure **en lui parlant** : le bot pose les
questions, récupère les accès Airbnb et Booking, apprend les logements, puis
répond au quotidien — « combien de ménages aujourd'hui ? », « bloque Massy du 3
au 7 », « qui arrive ce week-end ? ».

**Ce n'est pas un outil interne.** C'est un produit multi-clients, édité par Label
Maison, dans le prolongement de la marque-réseau.

Statut : **étape 1 codée** (squelette Telegram + boucle Claude). Cadrage produit
ci-dessous.

---

## 1. Les rôles

```
        TOI — l'éditeur                    ELLES — les conciergeries clientes
        ──────────────────                 ──────────────────────────────────
        1 compte Channex                   0 compte Channex
        1 bot Telegram                     leur propre compte Airbnb / Booking
        1 clé Anthropic                    un fil Telegram avec le bot
        la facture d'infrastructure        un abonnement chez toi
```

Le point de bascule du modèle : **tes clientes n'ont aucun compte Channex à
créer**. Elles autorisent Airbnb depuis un lien que le bot leur envoie, et c'est
tout. Channex reste invisible — c'est exactement ce pour quoi son offre
white-label est conçue.

---

## 2. L'onboarding conversationnel — le cœur du produit

C'est la partie qui fait la différence avec un simple tableau de bord.

**Principe directeur : les accès d'abord, les questions ensuite.** Le bot ne
demande jamais ce qu'il peut déduire. Dès qu'Airbnb est connecté, il voit les
annonces et les réservations — l'entretien se réduit à confirmer et à combler
les trous.

```
Bot   Bonjour. Je vais devenir votre assistant. Comment s'appelle
      votre conciergerie ?
Elle  Conciergerie du Lac
Bot   Avant tout, connectons vos comptes. Airbnb d'abord — ce lien
      est valable 15 minutes :
      https://secure.channex.io/auth/exchange?...
Elle  [clique, autorise Airbnb, revient]
Bot   Connecté. Je vois 4 annonces :
      · Studio des Halles 32m²  · T2 Gare
      · Maison Vieux Port       · Loft Sens
      Je les reprends telles quelles ?     [✅ Oui]  [Renommer]
Elle  [✅]
Bot   Fait. Booking maintenant : sa validation prend plusieurs jours,
      autant la lancer tout de suite.      [Lancer la demande]
...
Bot   Il me reste ce que l'API ne donne pas : le livret d'accueil.
      Envoyez-moi vos réponses types, un PDF, un tableur, ce que
      vous avez — j'en fais ma base de connaissances.
```

**Pourquoi cet ordre.** Connecter Airbnb livre les annonces, les réservations et
les messages. Ça ne livre **pas** le code de la boîte à clés, l'heure du
check-out ni les consignes d'usage : tout cela vit dans le livret d'accueil, pas
dans l'API. D'où la base de connaissances ci-dessous, qui comble exactement ce
trou.

**Conséquences techniques, à ne pas sous-estimer :**

- **Une conversation d'onboarding s'étale sur plusieurs jours.** Elle démarre le
  lundi, s'interrompt, reprend le jeudi. Elle doit être **reprenable** : le bot
  sait où il en est, ce qui manque, et relance. D'où la persistance dès l'étape 1.
- **Le jeton Channex ne vit que 15 minutes.** Si elle clique deux jours plus tard,
  le lien est mort. Le bot doit détecter l'échec et en régénérer un.
- **Rien ne garantit qu'elle répond dans l'ordre.** « en fait le code c'est
  plutôt 4589 » trois messages plus tard doit corriger la bonne fiche. C'est
  précisément ce qu'un agent fait bien et qu'un formulaire fait mal.

---

## 3. Comment une cliente connecte son Airbnb

Le mécanisme confirmé dans la doc Channex, et il est fait pour du chat.

```
1. POST /api/v1/auth/one_time_token
      { property_id, group_id, username }   →  jeton, valable 15 min

2. Le bot envoie ce lien dans la conversation :
   https://secure.channex.io/auth/exchange
      ?oauth_session_key=<jeton>
      &app_mode=headless
      &redirect_to=/channels
      &property_id=<id>
      &channels=ABB          ← ABB = Airbnb, filtre l'écran

3. Elle clique depuis son téléphone. Elle arrive déjà authentifiée chez
   Channex — sans compte Channex — sur l'écran de connexion Airbnb.
   Elle autorise avec SES identifiants Airbnb.

4. Le bot interroge GET /api/v1/channels et confirme que le canal est monté,
   puis fait mapper les annonces aux logements par boutons.
```

Aucune interface web à développer. Le produit tient entièrement dans la
conversation.

Booking.com suit le même principe côté Channex, mais la validation en tant que
fournisseur de connectivité se compte en jours côté Booking : à lancer tôt dans
l'onboarding de chaque cliente.

Références : [Channel IFrame](https://docs.channex.io/api-v.1-documentation/channel-iframe) ·
[Groups](https://docs.channex.io/api-v.1-documentation/groups-collection) ·
[connexion Airbnb](https://help.channex.io/en/articles/8225359-how-to-connect-with-airbnb)

---

## 4. Architecture

```
   Conciergerie A          Conciergerie B          Conciergerie C
        │                       │                       │
        └───────────────┬───────┴───────────────────────┘
                        ▼
                 Bot Telegram unique
                        │  webhook + secret
                        ▼
              Vercel — /api/telegram  (région cdg1)
                        │
                        ├─ 1. secret vérifié
                        ├─ 2. chat_id → conciergerie (sinon : rejet)
                        ├─ 3. historique + config de CETTE conciergerie
                        ├─ 4. Claude, outils filtrés sur SON group_id
                        └─ 5. réponse dans son fil
                        │
        ┌───────────────┴────────────────┐
        ▼                                ▼
   Supabase (Postgres)            API Channex — 1 compte
   conciergeries, logements,      ├─ group A ─ propriétés A ─ Airbnb A
   ménages, conversations,        ├─ group B ─ propriétés B ─ Airbnb B
   prestataires, onboarding       └─ group C ─ …

   Channex ──webhook──► /api/channex-webhook
                              └─► route vers la bonne conciergerie
                                  puis notifie son fil Telegram
```

Un seul bot, un seul déploiement, un seul compte Channex. La séparation est
logique, jamais physique — ce qui déplace tout le risque sur l'isolation.

---

## 5. Isolation des données — le risque numéro un

Sur un produit multi-clients, la faute grave n'est pas la panne : c'est que la
Conciergerie A voie le planning de la Conciergerie B. Trois règles, non négociables.

1. **Aucun outil ne reçoit d'identifiant venant du modèle.** Le `group_id` et les
   `property_id` sont injectés par le code, à partir du `chat_id` authentifié.
   Si Claude pouvait passer un `property_id` en argument, une formulation habile
   suffirait à lire les données d'une autre cliente.
2. **Toute requête Channex est filtrée par `group_id`** au niveau du client API,
   pas au niveau de l'appelant. Le filtre ne doit pas pouvoir être oublié.
3. **Row Level Security activée sur Supabase**, et chaque table métier porte une
   colonne `conciergerie_id`. Une requête sans filtre doit renvoyer zéro ligne,
   pas toutes les lignes.

Un `chat_id` inconnu n'obtient aucune réponse et n'apprend rien de l'existence
des autres.

---

## 6. Les choix techniques, et pourquoi

### Channex plutôt que les liens iCal

| | iCal Airbnb | **Channex** |
|---|---|---|
| Nom et nombre de voyageurs | ❌ | ✅ |
| Montant + commission OTA | ❌ | ✅ |
| Temps réel | ❌ (1–3 h) | ✅ webhooks |
| Modifications / annulations | ❌ | ✅ |
| Bloquer des dates, changer un tarif | ❌ | ✅ (push ARI) |
| Onboarding délégué d'une cliente | ❌ | ✅ (lien one-time) |

La dernière ligne est décisive : sans elle, il n'y a pas de produit, seulement un
outil interne.

### Telegram plutôt que WhatsApp

| | WhatsApp (Meta / Twilio) | **Telegram** |
|---|---|---|
| Numéro dédié | obligatoire | aucun |
| Vérification Meta Business | plusieurs jours | aucune |
| Coût par message | ~0,005 € | 0 € |
| **Écrire spontanément** | template payant, pré-validé | libre et gratuit |
| Boutons | limités | inline keyboard natif |

Les deux lignes qui décident : **les notifications spontanées** — sans elles, pas
de résumé du matin ni d'alerte annulation, et c'est là qu'est la valeur — et **les
boutons**, indispensables pour confirmer une action sans ambiguïté.

WhatsApp redeviendra pertinent pour joindre les **femmes de ménage**, qui n'ont
pas Telegram. Le connecteur est isolé : l'ajouter ne touchera ni les outils ni le
prompt.

### Claude plutôt qu'un modèle open source

| | Claude (Opus 5 + Haiku 4.5) | Modèle open chez un provider | Auto-hébergé |
|---|---|---|---|
| Coût, usage quotidien intensif | ~5–10 €/mois | ~1,5 €/mois | 300–1 500 €/mois de GPU |

L'écart est de quelques euros. En face, le travail réel de l'agent est d'enchaîner
« le week-end du 14 » → dates → bon logement → bon outil, et surtout de **refuser
d'agir quand c'est ambigu**. C'est là que les modèles open décrochent, en
particulier sur la retenue. Sur un produit multi-clients, une erreur ne coûte pas
une nuit : elle coûte une cliente.

- `claude-opus-5` — onboarding et toute action en écriture
- `claude-haiku-4-5` — lectures simples, 5× moins cher et plus rapide

**La couche outils est agnostique** : changer de modèle = changer un fichier.

### Messages vocaux

Claude ne traite pas l'audio. Transcription par Whisper en amont, ~0,003 € par
vocal de 30 s — seule brique non-Anthropic du projet.

Deux règles :
- **Biaiser le vocabulaire.** Sans ça, « Etigny » et « Ba'cam » ressortent
  déformés. On injecte les noms des logements et prestataires de **cette**
  conciergerie dans le paramètre `prompt` de Whisper.
- **Au vocal, la confirmation par bouton devient obligatoire.** L'agent réaffiche
  son interprétation — « Bloquer **Etigny**, du **3** au **7 septembre** ? »
  `[✅] [❌]` — avant toute écriture.

---

## 7. Hébergement : disponible en permanence, sans serveur

**Aucune machine ne tourne 24/24**, et c'est ce qui rend le montage fiable. En
serverless, le code dort mais l'infrastructure de Vercel ne dort jamais : un
message arrive, la fonction se réveille en ~200 ms, répond, s'éteint.

| Route | Déclencheur | Usage |
|---|---|---|
| `/api/telegram` | une cliente écrit | questions, commandes, onboarding |
| `/api/channex-webhook` | Channex | résa, annulation → alerte ciblée |
| `/api/cron-matin` | Vercel Cron, 8 h | résumé du jour, pour chaque cliente |

**Points de vigilance :**

- **Région `cdg1` forcée** dans `vercel.json`. Par défaut Vercel déploie aux
  États-Unis : latence inutile et données voyageurs hors UE.
- **Répondre 200 à Telegram immédiatement**, traiter derrière via `waitUntil`.
  Sinon Telegram rejoue le message et l'agent répond deux fois.
- **Cron Hobby : un déclenchement par jour.** Suffisant pour le résumé de 8 h.
  Au-delà : Vercel Pro, ou le cron Supabase qui n'a pas cette limite.
- **Le résumé matinal boucle sur toutes les clientes** — à surveiller quand elles
  se compteront en dizaines : découper en lots plutôt que tout envoyer d'un coup.

---

## 8. Modèle de données (Supabase)

Channex reste la source de vérité pour réservations et calendriers. Supabase
porte le métier et le multi-tenant.

```sql
conciergeries    id, nom, channex_group_id, statut, abonnement, cree_le
membres          id, conciergerie_id, chat_id_telegram, prenom, role
                 -- role : proprietaire | equipe | prestataire

logements        id, conciergerie_id, nom, ville,
                 channex_property_id, channex_room_type_id,
                 adresse, cle_boite, wifi, consignes, actif
prestataires     id, conciergerie_id, nom, telephone, logements[]
menages          id, conciergerie_id, logement_id, date, heure,
                 statut, prestataire_id, booking_ref_channex, notes

onboarding       id, conciergerie_id, etape, attendu, donnees_partielles
                 -- permet de reprendre une configuration interrompue
conversations    id, conciergerie_id, chat_id, role, contenu, cree_le
actions_log      id, conciergerie_id, chat_id, outil, arguments,
                 resultat, cree_le
```

`conciergerie_id` sur **chaque** table métier, avec Row Level Security. C'est ce
qui empêche une requête mal écrite de traverser les cloisons.

---

## 9. Les outils exposés à l'agent

### Onboarding — étape 1

| Outil | Rôle |
|---|---|
| `creer_conciergerie(nom)` | crée le `group` Channex + la ligne Supabase |
| `ajouter_logement(nom, ville)` | crée la `property` + `room_type` Channex |
| `lien_connexion_airbnb(logement)` | jeton one-time → lien à envoyer |
| `verifier_connexion(logement)` | le canal est-il monté ? quelles annonces ? |
| `mapper_annonce(logement, annonce_id)` | associe l'annonce OTA au logement |
| `enregistrer_infos(logement, champ, valeur)` | code, wifi, consignes |
| `ajouter_prestataire(nom, telephone, logements)` | |
| `etat_configuration()` | ce qui est fait, ce qui manque |

### Exploitation — étape 2, lecture

| Outil | Exemple |
|---|---|
| `menages_du_jour(date?)` | « combien de ménages aujourd'hui ? » |
| `arrivees_departs(date?)` | « qui arrive ce week-end ? » |
| `detail_reservation(ref)` | « ils sont combien vendredi ? » |
| `planning_semaine(logement?)` | |
| `disponibilites(logement, du, au)` | « libre le 12 ? » |
| `revenus(mois, logement?)` | « on a fait combien en juillet ? » |
| `fiche_logement(nom)` | « le code de la boîte à clés ? » |

### Actions — étape 4, confirmation par bouton obligatoire

| Outil | Exemple |
|---|---|
| `bloquer_dates(logement, du, au, raison)` | « bloque Etigny du 3 au 7 » |
| `debloquer_dates(...)` | |
| `modifier_tarif(logement, du, au, prix)` | |
| `assigner_menage(menage_id, prestataire)` | |
| `prevenir_prestataire(prestataire, message)` | |
| `noter_incident(logement, texte)` | |

### Notifications spontanées

- Nouvelle résa → « Airbnb au Studio des Halles, 12→15 sept, 2 pers, 340 €. Ménage créé le 15. »
- Annulation → « Annulation le 8. Je supprime le ménage ? » `[✅] [❌]`
- Résumé 8 h → ménages du jour, arrivées, départs, ce qui n'est pas assigné.
- Onboarding en suspens → relance au bout de 48 h.

---

## 9 bis. Répondre aux messages voyageurs

C'est probablement **la** fonctionnalité qui fera acheter le produit : répondre
aux voyageurs est la tâche la plus chronophage d'une conciergerie, et Airbnb
récompense la vitesse de réponse dans son classement. Un agent qui répond en
30 secondes à 2 h du matin, dans la langue du voyageur, a une valeur immédiate.

### Le mécanisme

Channex expose une API de messagerie unifiée sur **Airbnb, Booking.com et
Expedia** — à ne pas confondre avec la synchronisation d'inventaire.

```
GET  /api/v1/message_threads               les conversations
GET  /api/v1/message_threads/:id/messages  l'historique d'un fil
POST /api/v1/message_threads/:id/messages  répondre
POST /api/v1/attachments                   pièce jointe (texte et images)
POST /api/v1/message_threads/:id/close     clore un fil
```

Prérequis : installer l'app **Messaging & Reviews** dans Channex
(Applications → Manage Apps).

Cas particulier utile : les **inquiries Airbnb** créent un fil *sans réservation*.
C'est un voyageur qui pose une question avant de réserver — donc une vente en
jeu. À traiter en priorité, pas comme un message de service.

### Deux contraintes qui coûtent

- **Aucun webhook documenté sur les nouveaux messages.** Il faut interroger
  l'API en boucle, toutes les 1 à 2 minutes. Le cron Vercel Hobby (un
  déclenchement par jour) est inutilisable ici : ce sera **Supabase `pg_cron`**
  ou Vercel Pro. C'est aussi le seul composant du système qui tourne en
  permanence, donc le seul dont le coût croît avec le nombre de clientes.
- **Tarif à confirmer.** La grille Channex indique « mêmes tarifs que le
  gestionnaire de canaux » pour le module Chat & Reviews. Si cela signifie un
  second forfait de 130 $/mois, le socle fixe du produit double. **À vérifier
  auprès de Channex avant de le vendre.**

### Niveau d'autonomie retenu : complet

L'agent gère la conversation voyageur de bout en bout, sans validation préalable.
Décision assumée : le gain de temps prime.

Deux garde-fous conservés, qui ne bloquent aucun envoi :

1. **Copie systématique au propriétaire.** Chaque réponse envoyée est répercutée
   dans son fil Telegram. Il voit tout en temps réel et peut reprendre la main —
   sans jamais avoir à valider.
2. **Interdiction d'engager de l'argent.** Remboursement, geste commercial,
   remise, modification de prix : l'agent ne promet rien et prévient le
   propriétaire. Il peut tout dire d'autre.

### Ce qui rend la chose possible — ou dangereuse

Le point unique de défaillance, c'est **la fiche logement**. En autonomie
complète, elle n'est plus une note interne : c'est la source de vérité que
l'agent récite à des clients payants. Un code wifi périmé dans Supabase devient
un code wifi périmé envoyé à un voyageur à minuit.

Conséquences sur la conception :

- **L'onboarding doit être exigeant sur la fiche.** Wifi, accès, horaires,
  parking, équipements, règles, contacts d'urgence. Une fiche incomplète doit
  bloquer l'activation de la messagerie pour ce logement — pas la dégrader
  silencieusement.
- **Interdiction absolue d'inventer.** Si l'information n'est pas dans la fiche,
  l'agent dit qu'il vérifie et alerte le propriétaire. Jamais de supposition
  plausible sur un horaire ou un équipement.
- **Multilingue par défaut.** Les voyageurs écrivent dans toutes les langues ;
  l'agent répond dans celle du message reçu. C'est un des rares points où le
  modèle apporte un avantage net sur un humain pressé.
- **Journalisation intégrale** dans `actions_log` : quel message reçu, quelle
  réponse envoyée, sur quel fil, à quelle heure. Indispensable le jour où une
  cliente conteste une réponse.

### Outils correspondants

| Outil | Rôle |
|---|---|
| `messages_en_attente()` | fils avec un message voyageur sans réponse |
| `lire_fil(thread_id)` | historique complet d'une conversation |
| `repondre_voyageur(thread_id, texte)` | envoie, puis copie au propriétaire |
| `escalader(thread_id, raison)` | passe la main : argent, litige, hors fiche |
| `cloturer_fil(thread_id)` | |

---

## 10. Sécurité

1. **`chat_id` → conciergerie.** Un identifiant non rattaché n'obtient aucune
   réponse et est journalisé. Pas de whitelist statique : une table.
2. **`secret_token` Telegram** vérifié à chaque requête, comparaison à temps
   constant.
3. **Webhook Channex authentifié** par secret partagé — sinon on peut fabriquer
   de fausses réservations.
4. **Identifiants jamais fournis par le modèle** (cf. section 5).
5. **Rôles** : propriétaire = tout ; équipe = lecture + ménages ; prestataire =
   son seul planning.
6. **Confirmation par bouton avant toute écriture**, journalisée dans
   `actions_log`. Une écriture ARI part chez Airbnb en quelques secondes.
7. **Secrets en variables d'environnement Vercel uniquement.** `.env.local` est
   ignoré par git — vérifié.
8. **RGPD** : données de voyageurs (noms, dates, montants) hébergées en UE
   (`cdg1`, Supabase région EU). Prévoir la suppression sur départ d'une cliente.

---

## 11. Économie du produit

**Coûts fixes** (indépendants du nombre de clientes)

| Poste | Coût |
|---|---|
| Channex, frais de plateforme | 130 $/mois |
| Channex, module Chat & Reviews | **à confirmer** — « mêmes tarifs », donc potentiellement +130 $/mois |
| Vercel Hobby | 0 € |
| Supabase Free | 0 € |
| Telegram | 0 € |

**Coûts variables, par conciergerie**

| Poste | Coût |
|---|---|
| Channex, par unité (courte durée) | 0,50 $/mois |
| Claude + Whisper, usage quotidien | ~5–10 €/mois |

Soit de l'ordre de **10 à 15 € par cliente et par mois**, au-dessus d'un socle
fixe d'environ 120 €. Le modèle ne devient viable qu'à partir de quelques
clientes — c'est la caractéristique d'une offre white-label, et c'est aussi ce
qui la rend défendable une fois le seuil passé.

Le tarif de revente est ta décision ; ces chiffres ne servent qu'à situer le
plancher. Le contrôle des coûts est déjà en place côté modèle : compteur de
tokens par appel, plafond quotidien dans le code, et surtout **plafond de dépense
à poser dans la Console Anthropic sur un workspace dédié** — la seule protection
qu'aucun bug ne peut contourner.

Poste de dépense principal, à surveiller : **l'API est sans mémoire**, tout
l'historique est renvoyé à chaque message. Le 20ᵉ message coûte bien plus que le
1ᵉʳ. Tronquer l'historique est le levier n°1, loin devant le choix du modèle.

---

## 12. Limites connues

- **Messagerie voyageur : pas de webhook.** Il faut interroger l'API en boucle
  (cf. 9 bis) — d'où une dépendance à `pg_cron` et un coût qui croît avec le
  nombre de clientes. Le tarif du module Chat & Reviews reste à confirmer.
- **Propagation ARI** : instantanée vers Channex, quelques secondes à quelques
  minutes vers l'OTA. Risque résiduel de surbooking sur une résa simultanée.
- **Jeton d'onboarding : 15 minutes.** À régénérer si la cliente tarde.
- **Booking.com** : validation en tant que fournisseur de connectivité, plusieurs
  jours, à lancer tôt pour chaque cliente.
- **Compte Channex actuel : staging, et vide.** 0 propriété, 0 canal. Parfait
  pour développer gratuitement, incapable de voir de vraies annonces Airbnb.

---

## 13. Le code

```
agent-ia/
├── api/telegram.ts        webhook : secret, identification, ack, waitUntil
├── src/
│   ├── config.ts          env + garde-fous
│   ├── telegram.ts        sendMessage, typing, getFile, découpe 4096
│   ├── agent.ts           boucle « tool use » Claude, écrite à la main
│   ├── cout.ts            compteur de tokens + plafond quotidien
│   ├── transcription.ts   Whisper + vocabulaire métier
│   └── tools/index.ts     registre des outils
├── scripts/               chat-id, set-webhook
├── vercel.json            région cdg1, maxDuration 60 s
└── .env.local             secrets — ignoré par git
```

Bot : **@Labelmaison_bot**. Dépendances installées, `npm run typecheck` passe,
envoi de message vers Telegram vérifié de bout en bout.

**Trois choix d'implémentation à connaître :**

- **Boucle d'outils écrite à la main** plutôt que le tool runner du SDK : la
  confirmation par bouton devra s'insérer au milieu (intercepter un appel en
  écriture → attendre le clic → reprendre), et ce point d'accroche est bien plus
  simple à tenir dans une boucle qu'on contrôle.
- **Texte brut, jamais de markdown.** Le MarkdownV2 de Telegram exige d'échapper
  une quinzaine de caractères et fait échouer tout le message à la moindre
  erreur.
- **Fail closed partout.** Pas de conciergerie rattachée = pas de réponse.

### Exploitation — deux pièges qui font perdre une heure

**Le domaine doit être rattaché au PROJET, pas à un déploiement.**
`vercel alias set <url-de-déploiement> <domaine>` épingle le domaine sur CE
déploiement : les suivants mettent bien à jour l'URL `.vercel.app`, mais le
domaine reste figé sur l'ancien build. Les correctifs semblent alors sans effet
alors que le build réussit — symptôme trompeur s'il en est. La bonne méthode est
d'ajouter le domaine aux *Domains* du projet (ou `POST /v10/projects/:id/domains`).

**La protection de déploiement Vercel bloque Telegram.**
Réglée sur « all_except_custom_domains », elle laisse quand même passer un
domaine ajouté APRÈS : Telegram reçoit une redirection vers la page de connexion
Vercel et le webhook échoue en 401, sans message explicite. À revérifier après
toute manipulation d'alias.

**Sonder ce qui tourne vraiment.** En cas de doute, ajouter temporairement une
route `/api/version` renvoyant un marqueur et la liste des outils : c'est ce qui
a permis de comprendre que le domaine servait un vieux build. À retirer ensuite,
elle expose la surface interne.

### Commandes

```bash
npm run chat-id       # relève un chat_id (avant de poser le webhook)
npm run set-webhook -- https://mon-agent.vercel.app
npm run webhook-info
npm run typecheck
```

---

## 14. Plan de route

**Étape 1 — Le squelette qui parle** ✅ *écrit*
Bot Telegram, webhook sécurisé, boucle Claude, compteur de coûts, vocaux.

**Étape 1 bis — Persistance et multi-tenant** ← *prochaine*
Supabase, tables `conciergeries` / `membres`, Row Level Security, résolution
`chat_id` → conciergerie, mémoire de conversation.

**Étape 2 — L'onboarding conversationnel**
Client API Channex sur le staging, les 8 outils d'onboarding, génération du lien
Airbnb, mapping par boutons, reprise d'une configuration interrompue.

**Étape 3 — L'exploitation**
Les 7 outils de lecture sur données Channex réelles. Passage en production.

**Étape 4 — Le proactif**
Webhooks Channex, création automatique des ménages, alertes annulation, résumé
de 8 h.

**Étape 5 — La messagerie voyageur** (cf. 9 bis)
App Messaging & Reviews, boucle d'interrogation via `pg_cron`, réponse autonome
multilingue adossée à la fiche logement, copie au propriétaire, escalade sur
tout ce qui engage de l'argent. **Prérequis : une fiche logement complète par
logement** — c'est elle qui empêche l'agent d'inventer.

**Étape 6 — Les actions sur les calendriers**
Push ARI avec confirmation par bouton. Connecteur WhatsApp pour les prestataires.

---

## 15. Ce qu'il reste à fournir

| Élément | Statut |
|---|---|
| Token bot Telegram | ✅ en place |
| `chat_id` propriétaire | ✅ 5333006287, envoi vérifié |
| Secret du webhook | ✅ généré |
| Clé API Channex | ✅ staging (production à décider) |
| Clé API Anthropic | ✅ `agent-telegram-prod`, workspace dédié `Agent IA Conciergerie` (`wrkspc_01MPUNtqDN7WmNtfoY83Mg4V`), plafond 50 $/mois, alerte à 25 $, sans expiration — authentification vérifiée |
| **Crédits Anthropic** | ❌ **solde à 0 $ — bloque l'étape 1** |
| Clé API OpenAI (vocaux) | ❌ optionnelle |
| Projet Supabase | ❌ bloque l'étape 1 bis |
| Compte Channex production | ❌ bloque l'étape 3 |
