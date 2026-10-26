# Espaces séparés : mise en service

Ce guide s'adresse aux gérants. Il n'y a rien à programmer : seulement des
copier-coller dans Supabase et Vercel, dans l'ordre ci-dessous.

## Ce que ça change

Le même ERP pourra servir plusieurs équipes, chacune dans son **espace** :
Label Maison d'un côté, Sens de l'autre. Chaque espace a ses logements, ses
réservations, ses messages, son Repull. Rien ne passe de l'un à l'autre.

**Pour Label Maison, rien ne change** : même adresse, même mot de passe,
personne n'est déconnecté, toutes les données restent où elles sont.

Comptez 15 minutes aujourd'hui, puis 5 minutes au moins 24 heures plus tard
(voir l'étape 4 pour le point de départ exact de ces 24 heures).

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

## Plus tard — ouvrir l'espace de Sens

**Seulement après la passe 2.** Avant, la base refuse de créer un autre espace
(message « Passe 2 d'abord ») : c'est voulu, sinon les réglages techniques de
Sens se mélangeraient à ceux de Label Maison.

Avec l'étape suivante (connexion personnelle et « Créer un compte »), l'espace
de Sens s'ouvrira depuis l'ERP. D'ici là, voici ce qui se prépare dans le SQL
Editor (une requête à la fois) :

- Créer l'espace :
  `insert into erp.espaces (code, nom) values ('sens', 'Sens');`
- Repull, voie principale (le workspace que Repull ouvre pour Sens sur votre
  compte, même facture) : quand Repull vous donne son numéro,
  `update erp.espaces set repull_workspace = 'NUMÉRO' where code = 'sens';`
  Demandez aussi à Repull si les événements de Label Maison portent un numéro
  de workspace. Si oui, renseignez-le AVANT celui de Sens :
  `update erp.espaces set repull_workspace = 'NUMÉRO' where code = 'label-maison';`
  (sinon, une fois Sens relié, ces événements seraient ignorés ; la
  synchronisation quotidienne et le bouton, eux, continuent).
- Repull, autre voie (Sens a son propre compte Repull et sa propre clé) : la
  clé se range dans le coffre chiffré de Supabase, jamais dans Vercel :
  `select erp.ranger_secret('sens', 'repull_cle', 'LA_CLÉ');`
- Appels Repull de Sens : 150 par mois par défaut (sa propre part, celle de
  Label Maison n'est pas entamée). Pour la changer :
  `update erp.espaces set config = jsonb_set(config, '{repull}', coalesce(config->'repull', '{}') || '{"budgetMois": 200}') where code = 'sens';`
- Plafond de l'agent IA de Sens (il utilise la clé Claude de Label Maison) :
  300 décisions par mois par défaut. Pour le changer :
  `update erp.espaces set config = jsonb_set(config, '{agent}', coalesce(config->'agent', '{}') || '{"plafondMois": 150}') where code = 'sens';`

L'agent de Sens démarre **en pause** : il ne répond à personne tant que
l'équipe de Sens ne l'a pas allumé. Les alertes Telegram restent celles de
Label Maison uniquement.

## En cas de problème

L'ERP continue de fonctionner : tant que la base n'est pas prête, il se
comporte comme avant. Un retour en arrière complet existe (bloc en
commentaire tout en bas de `supabase/erp-espaces.sql`) ; ne l'utilisez
qu'avec l'équipe technique.
