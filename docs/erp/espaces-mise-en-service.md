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

Les nouveaux comptes, eux, s'ouvrent **avec le lien de leur invitation** :
il porte un code à usage unique (14 jours) que l'ERP demande à la première
entrée. Quelqu'un qui créerait d'avance un compte à l'adresse d'un futur
membre n'obtient donc rien. Les membres d'aujourd'hui ne sont pas concernés :
la passe 1 relie chacun à son compte, une fois pour toutes.

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

**Avant de lancer (2 min) :**

- Supabase → **Authentication** → **Sign In / Providers** → **Email** :
  **Allow new users to sign up** **désactivé** → **Save**. Avant la passe 1,
  la base reconnaît un membre à sa seule adresse : n'importe qui pourrait
  créer le compte d'un membre qui n'en a pas encore. Vous le réactiverez
  juste après la passe 1 (« Juste après » ci-dessous).
- **Authentication** → **Users** : la passe 1 relie chaque membre au compte
  confirmé de même adresse, pour de bon. Regardez la liste : un compte que
  vous ne reconnaissez pas, à l'adresse d'un membre de l'équipe, se supprime
  **avant** la passe (**⋯** → **Delete user**) ; la personne recevra ensuite
  une invitation. Dans le doute, demandez à l'équipe technique.

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

La passe 1 relie aussi chaque membre d'aujourd'hui à son compte (même
adresse, adresse confirmée) : ils entrent comme avant, sans code. Un membre
qui n'avait pas encore de compte confirmé recevra une invitation (Paramètres
→ Équipe → **Envoyer l'invitation**).

**Juste après (recette = ok)** : Supabase → **Authentication** → **Sign In /
Providers** → **Email** → **Allow new users to sign up** **activé** →
**Save** (c'est « Créer mon compte » ; désormais, un compte ne s'ouvre
qu'avec le code de son invitation).

**Vous aviez déjà passé ce fichier (passe 1, ou passes 1 et 2) avec une
version précédente ?** Relancez-le maintenant, avec la même ligne ▼▼▼ que la
dernière passe faite (`'2'` si la passe 2 est faite) : il ajoute les
nouveautés (liens des membres à leur compte, codes d'invitation, raison d'un
refus) sans rien casser. Attendu : la même ligne de résultat, **recette = ok**.

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

1. **E-mails de Supabase par Resend (avant tout le reste).** Sans cela,
   Supabase refuse d'envoyer l'e-mail de confirmation aux adresses
   extérieures à son équipe, et la personne invitée reste bloquée.
   Supabase → **Authentication** → **Emails** → **SMTP Settings** → activer
   **Custom SMTP** : hôte `smtp.resend.com`, port `465`, utilisateur
   `resend`, mot de passe = une clé API Resend, expéditeur = une adresse du
   domaine vérifié dans Resend (par exemple `ERP <erp@labelmaisoncg.fr>`) →
   **Save**.
   Attendu : « Créer mon compte » avec une adresse de test extérieure reçoit
   l'e-mail de confirmation en moins d'une minute.
2. **E-mail de confirmation en français.** **Authentication** → **Emails** →
   **Templates** → **Confirm signup** :
   - Sujet : `Confirmez votre adresse pour l’ERP`
   - Message :
     ```html
     <p>Bonjour,</p>
     <p>Pour finir de créer votre compte, confirmez votre adresse :</p>
     <p><a href="{{ .ConfirmationURL }}">Confirmer mon adresse</a></p>
     <p>Ouvrez ce lien sur l’appareil où vous avez créé votre compte : l’ERP
     vous demandera ensuite votre mot de passe.</p>
     <p>Vous n’avez rien demandé ? Ignorez ce message.</p>
     ```
   → **Save**.
3. **Réglages de sécurité des comptes.**
   - **Sign In / Providers** → **Email** : **Confirm email** activé, et
     **Secure email change** activé. Attendu : les deux sont activés.
   - **Sign In / Providers** : **Phone** désactivé, **Allow anonymous
     sign-ins** désactivé, **Allow manual linking** désactivé, et aucun autre
     fournisseur (Google, Apple…) activé. Ce sont les réglages par défaut :
     vérifiez seulement qu'ils n'ont pas changé.
   - **URL Configuration** → **Redirect URLs** : exactement
     `https://www.labelmaisoncg.fr/erp`, **sans joker** (`*` ou `**`) ;
     retirez toute autre ligne en `*`. Attendu : une seule ligne, sans `*`.
   - **Rate Limits** : gardez les valeurs par défaut. Si des inscriptions en
     rafale apparaissent (Authentication → Users), baissez « Sign-ups and
     sign-ins » et « Emails ».
   - **Attack Protection** (captcha) : à n'activer qu'avec l'équipe
     technique (la page « Créer mon compte » doit d'abord envoyer le jeton du
     captcha, sinon les inscriptions sont refusées).
4. **Workspace Repull de Label Maison (recommandé).** Demandez à Repull :
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
   lien s'affiche : **Copier le lien** (« Lien copié »), puis envoyez-le
   (SMS, WhatsApp). Le lien contient un code : ne le publiez nulle part.
3. L'invitation vaut 14 jours, une seule fois, pour cette adresse seulement.
   « Renvoyer » envoie un nouveau lien (l'ancien ne sert plus) et la
   prolonge, « Annuler » la retire. Une adresse qui a déjà accès à un espace
   ne peut pas être invitée : il faut une adresse propre à la conciergerie.
   Le nom donné ici est celui de l'espace : il ne se change plus ensuite
   (sauf par le SQL plus bas).
4. Expirée ou annulée : la personne qui se connecte lit « Votre invitation a
   expiré (ou a été annulée) : demandez-en une nouvelle à Label Maison. »

## Ce que fait la conciergerie invitée

Rien dans Supabase ni dans Vercel :

1. Elle ouvre le lien **sur l'appareil où elle utilisera l'ERP** : la page
   s'ouvre sur **Créer mon compte**, l'adresse invitée déjà fixée ; elle
   choisit son mot de passe, puis confirme son adresse avec l'e-mail reçu.
2. En ouvrant le lien de confirmation, elle saisit son mot de passe
   (« Dernière étape ») : l'invitation est activée. L'ERP affiche « Créez
   l'espace de votre conciergerie », au nom de l'invitation → **Créer
   l'espace**. Elle en devient la gérante ; l'espace est vide.
   Elle avait déjà un compte ? Elle ouvre le lien de l'invitation, touche
   « J'ai déjà un compte » et se connecte : même résultat.
3. L'accueil lui montre « Démarrage », dans l'ordre :
   - **Reliez votre compte Repull** : Paramètres → Plateformes → « Votre
     compte Repull » → la clé de son compte Repull (Repull → Settings → API
     keys) → **Enregistrer**. L'ERP l'essaie d'abord chez Repull (une simple
     lecture) : une clé refusée n'est pas enregistrée. Attendu : « Clé
     enregistrée ». La clé va dans le coffre chiffré de Supabase : personne
     ne peut la relire, on peut seulement la remplacer (« Remplacer la
     clé »). S'il a plusieurs espaces de travail Repull : « Avancé : mises à
     jour en temps réel » → « Espace de travail Repull ».
   - **Connectez Airbnb, Booking…** : Logements → Connexions, puis le choix
     des logements.
   - **Renseignez les infos pour l'agent** sur chaque logement.
   - **Invitez votre équipe** : Paramètres → Équipe → ajoutez son adresse
     et son rôle, puis **Envoyer l'invitation**.
   - **Invitez propriétaires et responsables** : Paramètres → Accès.
   - **Allumez l'agent quand tout est prêt** : Messagerie → Agent. Il
     démarre en pause ; il répond avec la clé Claude de Label Maison, au plus
     300 décisions par mois, signé « L'équipe <nom de la conciergerie> ».
   - Facultatif, le temps réel : Plateformes → « Avancé : mises à jour en
     temps réel » →
     l'adresse de son webhook à ajouter dans Repull, puis le secret donné par
     Repull → **Enregistrer le secret**.

## Suspendre ou rouvrir un espace

Paramètres → Espaces → **Suspendre** (une confirmation est demandée) : son
équipe, ses propriétaires et ses responsables n'y entrent plus, l'agent et
les mises à jour s'arrêtent. Ses membres lisent « L'espace … est suspendu :
contactez Label Maison. Rien n'est effacé. » **Rouvrir** rend tout.

## Réglages réservés à Label Maison (facultatif, SQL Editor)

Le code de l'espace s'affiche au survol de son nom dans Paramètres → Espaces
(ou : `select code, nom from erp.espaces;`) ; remplacez `CODE` ci-dessous.
Une requête à la fois.

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
  Conformité) portent encore la raison sociale, le SIRET et l'adresse de
  Label Maison : ne les envoyez pas tels quels, la conciergerie joint ses
  propres documents. Paramètres → Société n'affiche que le nom de l'espace
  (raison sociale, SIRET et siège pas encore réglables). L'espace
  propriétaire, lui, imprime le nom de la conciergerie, jamais l'identité
  de Label Maison.
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
  Le CRM d'une autre conciergerie ne propose donc pas « Envoyer le dossier ».
- **Relances dans Calendrier** : un agenda pour toute l'équipe (pas encore
  un agenda par personne).
- **Claude** ne voit ni ne règle « Suivi par » : on le choisit dans l'ERP.

## Comptes de l'équipe et Claude, dans chaque espace

- **Ajouter quelqu'un** : un gérant de l'espace, dans Paramètres → Équipe,
  ajoute l'adresse et le rôle, puis touche **Envoyer l'invitation** (ou plus
  tard, sur la ligne de la personne : e-mail perdu, lien jamais ouvert). La
  personne ouvre le lien sur son appareil, choisit son mot de passe, confirme
  son adresse par l'e-mail reçu, puis saisit son mot de passe : c'est tout
  (plus rien à faire dans Supabase). Le lien sert une fois, 14 jours ; une
  nouvelle invitation remplace la précédente. Une personne qui a déjà activé
  son accès n'a pas besoin d'invitation : elle se connecte.
- **Compte créé à la main dans Supabase** (**Add user**, **Auto Confirm
  User**, sans invitation) : reliez-le à sa ligne de membre dans le SQL
  Editor : `select erp.lier_compte('prenom@exemple.fr', 'CODE');`. Jamais
  pour un compte venu de « Créer mon compte » : la liaison ne change ni son
  mot de passe ni ses sessions ; envoyez plutôt une invitation.
- **Avant la passe 1** (base d'avant les espaces) : « Créer mon compte » et
  « Envoyer l'invitation » sont fermés (« La création de compte n'est pas
  encore ouverte : demandez à un gérant de vous ajouter. »). Le gérant crée
  alors le compte dans Supabase (**Add user**, **Auto Confirm User**).
- **Lien refusé** (déjà servi, remplacé par « Envoyer l'invitation », ou
  expiré) : la personne lit « Ce lien d'invitation n'est plus valable (déjà
  utilisé, remplacé ou expiré) : demandez qu'on vous le renvoie. » ; renvoyez
  l'invitation depuis sa ligne.
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
