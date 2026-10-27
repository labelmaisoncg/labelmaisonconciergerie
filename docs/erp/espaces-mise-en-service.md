# Espaces séparés : mise en service

Ce guide s'adresse aux gérants. Il n'y a rien à programmer : seulement des
copier-coller dans Supabase et Vercel, dans l'ordre ci-dessous.

## Ce que ça change

Le même ERP pourra servir plusieurs conciergeries, chacune dans son
**espace** : Label Maison d'un côté, Sens (ou une autre) de l'autre. Chaque
espace a ses logements, ses réservations, ses messages, son équipe, ses
propriétaires, ses fichiers et son compte Repull. Rien ne passe de l'un à
l'autre. Une conciergerie n'entre que **sur invitation de Label Maison**, puis
crée et gère son espace seule.

**Pour Label Maison, rien ne change** : même adresse, même mot de passe,
personne n'est déconnecté, toutes les données restent où elles sont.

Comptez 15 minutes aujourd'hui, puis 5 minutes au moins 24 heures plus tard
(voir l'étape 4 pour le point de départ exact de ces 24 heures). Les étapes 1
à 5 ne se font qu'une fois ; ensuite, chaque nouvelle conciergerie ne demande
qu'une invitation (« Inviter une conciergerie »).

## Étape 1 — Créer le compte du serveur (5 min)

Le serveur de l'ERP (synchronisations, agent, notifications) aura son propre
compte, qui ne voit un espace que lorsqu'on le lui nomme.

1. Supabase → projet Label Maison → **Authentication** → **Users** →
   **Add user** → **Create new user**.
2. E-mail : `serveur@labelmaisoncg.fr` (aucune boîte mail n'est nécessaire).
3. Mot de passe : un mot de passe long et unique (au moins 24 caractères, par
   exemple généré par votre gestionnaire de mots de passe). Cochez **Auto
   Confirm User**, puis **Create user**.
4. Vercel → projet du site → **Settings** → **Environment Variables** →
   **Add New** : nom `ERP_SERVEUR_MOT_DE_PASSE`, valeur : ce même mot de
   passe, environnements **Production** et **Preview** → **Save**.
5. Vercel → **Deployments** → sur le dernier déploiement, **⋯** →
   **Redeploy**.

Ce mot de passe ne s'écrit nulle part ailleurs : ni dans un message, ni dans
un document, ni dans le code.

## Étape 2 — Préparer la base, passe 1 (5 min)

1. Supabase → **SQL Editor** → **New query**.
2. Ouvrez le fichier `supabase/erp-espaces.sql`, copiez **tout** son contenu
   et collez-le dans la requête.
3. Vérifiez la ligne marquée ▼▼▼ en haut : elle doit dire `'1'`.
4. **Run**.

En bas, l'onglet **Results** affiche une ligne. Attendu :

| Colonne | Valeur attendue |
|---|---|
| passe | 1 |
| espaces | 1 |
| colonnes_espace | 4 |
| cles_par_espace | 0 |
| compte_serveur | prêt |
| recette | ok |

Si ce n'est pas le cas :

- **compte_serveur = « à créer… »** : faites l'étape 1, puis relancez ce même
  fichier (sans rien changer). Relancer ne casse rien.
- **compte_serveur = « rôle absent… »** : relancez ce même fichier.
- **recette différente de « ok »** : ne faites rien d'autre et envoyez une
  capture de l'onglet Results à l'équipe technique (elle ne contient aucun mot
  de passe). L'ERP continue de fonctionner normalement en attendant.

## Étape 3 — Mise en ligne du nouveau code

C'est l'équipe technique qui la fait. L'ordre avec l'étape 2 n'a pas
d'importance : le nouveau code reconnaît une base pas encore préparée et
fonctionne alors exactement comme avant. L'app se met à jour à chaque
ouverture, et chaque nuit quand elle reste ouverte : rien à faire de votre côté.

## Étape 4 — Passe 2, au moins 24 heures après la DERNIÈRE des étapes 2 et 3 (5 min)

Les 24 heures se comptent à partir de la plus tardive de ces deux dates : la
mise en ligne du code (étape 3) et la passe 1 (étape 2). Exemple : code en
ligne lundi, passe 1 mercredi à 10 h → passe 2 jeudi à 10 h au plus tôt.

Pourquoi attendre : après la passe 2, ne sauraient plus enregistrer une
ancienne version de l'app restée ouverte quelque part, ni une page du nouveau
code ouverte avant la passe 1 (elle se croit encore sur la base d'avant
jusqu'à son rechargement). Toutes les apps se rechargent seules chaque nuit :
24 heures suffisent.

1. Supabase → **SQL Editor** → **New query** → collez de nouveau tout
   `supabase/erp-espaces.sql`.
2. À la ligne marquée ▼▼▼, remplacez `'1'` par `'2'`.
3. **Run**.

Attendu : la même ligne qu'à l'étape 2, avec **passe = 2** et
**cles_par_espace = 3**, **recette = ok**.

## Étape 5 — Avant la première invitation (une fois, 5 min)

**Seulement après la passe 2.** Avant, « Inviter une conciergerie » répond
« Passe 2 d'abord » : c'est voulu.

1. **Adresses confirmées.** Supabase → **Authentication** → **Sign In /
   Providers** → **Email** : l'option **Confirm email** doit être activée.
   C'est elle qui garantit qu'une invitation ne sert qu'à la personne qui lit
   cette boîte mail.
   Attendu : « Confirm email » est activé.
2. **Workspace Repull de Label Maison (recommandé).** Demandez à Repull :
   « Quel est l'identifiant du workspace de Label Maison, celui de l'en-tête
   X-Workspace-Id, et est-ce le même que le champ workspaceId des
   webhooks ? ». Puis Vercel → projet du site → **Settings** →
   **Environment Variables** → **Add New** : nom `REPULL_WORKSPACE_LM`,
   valeur : ce numéro seul, environnements **Production** et **Preview** →
   **Save** ; **Deployments** → **⋯** → **Redeploy**.
   Attendu : ERP de Label Maison → Paramètres → Plateformes → **Synchroniser
   maintenant** répond « Synchronisé… », et le nombre de logements ne change
   pas. Sinon : supprimez la variable, redéployez (tout redevient comme avant)
   et écrivez à Repull.
   Pourquoi : les appels de Label Maison ne lisent alors que son workspace, et
   un événement venu d'un autre workspace de votre compte n'est jamais versé
   chez Label Maison. **Obligatoire** avant d'ouvrir, sur votre propre compte
   Repull, un workspace pour une autre conciergerie (voir « Cas particulier »).

## Inviter une conciergerie

1. ERP de Label Maison → Paramètres → **Espaces** → « Inviter une
   conciergerie » : son nom, l'adresse e-mail de la personne qui ouvrira
   l'espace → **Inviter**.
2. L'e-mail part au nom de Label Maison. Sans envoi d'e-mail configuré, le
   lien s'affiche : **Copier le lien**, puis envoyez-le (SMS, WhatsApp).
3. L'invitation vaut 14 jours, une seule fois, pour cette adresse seulement.
   « Renvoyer » la prolonge, « Annuler » la retire. Une adresse qui a déjà
   accès à un espace ne peut pas être invitée : il faut une adresse propre à
   la conciergerie.

## Ce que fait la conciergerie invitée

Rien dans Supabase ni dans Vercel :

1. Elle ouvre le lien, touche **Créer mon compte** avec l'adresse invitée,
   choisit son mot de passe, puis confirme son adresse avec l'e-mail reçu.
2. Elle se connecte : l'ERP affiche « Créez l'espace de votre conciergerie »,
   le nom déjà rempli → **Créer l'espace**. Elle en devient la gérante ;
   l'espace est vide.
3. L'accueil lui montre « Démarrage », dans l'ordre :
   - **Reliez votre compte Repull** : Paramètres → Plateformes → « Votre
     compte Repull » → la clé API de son compte (Repull → Settings → API
     keys) et, s'il en a plusieurs, son workspace → **Enregistrer**.
     Attendu : « Clé enregistrée ». La clé va dans le coffre chiffré de
     Supabase : personne ne peut la relire, on peut seulement la remplacer.
   - **Connectez Airbnb, Booking…** : Logements → Connexions, puis le choix
     des logements.
   - **Renseignez les infos pour l'agent** sur chaque logement.
   - **Invitez votre équipe** : Paramètres → Équipe → adresse et rôle →
     **Envoyer l'invitation**.
   - **Invitez propriétaires et responsables** : Paramètres → Accès.
   - **Allumez l'agent quand vous êtes prêt** : Messagerie → Agent. Il
     démarre en pause ; il répond avec la clé Claude de Label Maison, au plus
     300 décisions par mois, signé « L'équipe <nom de la conciergerie> ».
   - Facultatif, le temps réel : Plateformes → « Avancé : temps réel » →
     l'adresse de son webhook à ajouter dans Repull, puis le secret donné par
     Repull → **Enregistrer le secret**.

## Suspendre ou rouvrir un espace

Paramètres → Espaces → **Suspendre** : son équipe, ses propriétaires et ses
responsables n'y entrent plus, l'agent et les mises à jour s'arrêtent. Rien
n'est effacé : **Rouvrir** rend tout.

## Réglages réservés à Label Maison (facultatif, SQL Editor)

Le code de l'espace est affiché dans Paramètres → Espaces (« code … ») ;
remplacez `CODE` ci-dessous. Une requête à la fois.

- Part mensuelle d'appels Repull (150 par défaut) :
  `update erp.espaces set config = jsonb_set(config, '{repull}', coalesce(config->'repull', '{}') || '{"budgetMois": 300}') where code = 'CODE';`
- Plafond de l'agent (300 décisions par mois par défaut, clé Claude de Label
  Maison) :
  `update erp.espaces set config = jsonb_set(config, '{agent}', coalesce(config->'agent', '{}') || '{"plafondMois": 150}') where code = 'CODE';`
- Contacts montrés à ses propriétaires :
  `update erp.espaces set config = jsonb_set(config, '{contacts}', '{"email": "contact@DOMAINE", "telephone": "+33 6 00 00 00 00"}') where code = 'CODE';`
- Expéditeur de ses e-mails : voir « E-mail au nom de Sens » plus bas.
- Nom de l'espace :
  `update erp.espaces set nom = 'Nouveau nom' where code = 'CODE';`
- **Cas particulier** : un workspace sur le compte Repull **de Label Maison**
  au lieu de sa propre clé (même facture). D'abord l'étape 5.2
  (`REPULL_WORKSPACE_LM`), puis :
  `update erp.espaces set repull_workspace = 'NUMÉRO' where code = 'CODE';`
  Sans `REPULL_WORKSPACE_LM`, la synchronisation de cet espace refuse avec un
  message clair ; le numéro de Label Maison est refusé pour un autre espace.

## Limites à connaître

- **Choix de l'espace à l'écran** : pas encore. Une adresse membre de
  plusieurs espaces ouvre le dernier utilisé sur l'appareil (Label Maison
  d'abord). D'où une adresse par conciergerie.
- **Identité légale** : dans l'ERP d'une autre conciergerie, les documents
  faits côté gérant (contrat de mandat, relevés et factures de Finance,
  Paramètres → Société, Conformité) portent encore la raison sociale, le
  SIRET et l'adresse de Label Maison. Ne les envoyez pas tels quels : la
  conciergerie joint ses propres documents. L'espace propriétaire, lui,
  imprime le nom de la conciergerie, jamais l'identité de Label Maison.
- **Fichiers** (documents, photos, guides) d'un autre espace : signés et
  déposés par le compte serveur, dans le dossier de cet espace seulement. À
  vérifier une fois, avec la première conciergerie : un document déposé pour
  un de ses propriétaires s'ouvre depuis l'espace propriétaire. S'il affiche
  « Document introuvable », écrivez à l'équipe technique.
- **Telegram** : alertes de l'agent pour Label Maison seulement.
- **Notifications de l'app** : leurs clés (Paramètres → Application →
  Avancé) sont créées par un gérant de Label Maison et servent à toute l'app ;
  chaque espace abonne ses propres appareils.
- **Part d'appels Repull** : 150 par mois par défaut, même avec sa propre clé
  (réglable ci-dessus) ; « Avancé » affiche pour repère le quota du compte de
  Label Maison.
- **Site public** (formulaires, dossier propriétaire) : Label Maison seulement.

## Comptes de l'équipe et Claude, dans chaque espace

- **Ajouter quelqu'un** : un gérant de l'espace, dans Paramètres → Équipe,
  ajoute l'adresse, puis touche **Envoyer l'invitation**. La personne ouvre
  le lien, choisit son mot de passe, confirme son adresse par l'e-mail reçu :
  c'est tout (plus rien à faire dans Supabase).
- **E-mail au nom de Sens** : sans réglage, rien ne part et le gérant copie
  le lien (SMS, WhatsApp). Pour envoyer au nom de Sens (domaine vérifié dans
  Resend) :
  `update erp.espaces set config = jsonb_set(config, '{email}', coalesce(config->'email', '{}') || '{"expediteur": "Sens <bonjour@DOMAINE>"}') where code = 'sens';`
- **Claude** : chaque espace a sa propre connexion. Un gérant de Sens, dans
  l'espace de Sens, ouvre CRM → Plus → Connecter à Claude et suit les
  étapes : Claude ne verra que Sens. « Déconnecter Claude » dans Sens ne
  touche pas à la connexion de Label Maison, et inversement. Même chose pour
  « Relances dans Calendrier ».

## En cas de problème

L'ERP continue de fonctionner : tant que la base n'est pas prête, il se
comporte comme avant. Un retour en arrière complet existe (bloc en
commentaire tout en bas de `supabase/erp-espaces.sql`) ; ne l'utilisez
qu'avec l'équipe technique.
