# Page `/linge` protégée — installation

Décompresser à la **racine du dépôt** `labelmaisonconciergerie`. Les fichiers se
placent d'eux-mêmes au bon endroit, sauf deux lignes à modifier à la main
(voir §3 et §4).

```
middleware.ts                  ← nouveau, à la racine (même niveau que package.json)
scripts/build-linge.mjs        ← nouveau
public/linge/index.html        ← nouveau
public/robots.txt              ← remplace l'existant (ajoute Disallow: /linge)
.gitignore                     ← remplace l'existant (ignore la projection JSON)
```

---

## 1. Ce que ça fait

- `labelmaisoncg.fr/linge` affiche le registre du linge, aux couleurs
  « Ivoire & or », avec les mouvements par logement, les soldes, les alertes et
  l'historique (message d'origine de l'équipe conservé verbatim).
- **Seule cette URL est protégée par mot de passe.** Les 1 357 pages SEO et le
  reste du site restent publics et indexables, inchangés.
- La source de vérité reste `gestion/linge/registre.jsonl`, qui n'est **jamais**
  servi par le site. Le build en génère une projection
  `public/linge/registre.json`, elle-même derrière le mot de passe.

## 2. Créer les variables d'environnement Vercel

Settings → Environment Variables, **pour Production ET Preview** :

| Nom | Valeur | Obligatoire |
|---|---|---|
| `LINGE_PASSWORD` | le mot de passe de ton choix | oui |
| `LINGE_USER` | identifiant | non — défaut `labelmaison` |

Si `LINGE_PASSWORD` n'est pas défini, la page refuse l'accès. Elle ne s'ouvre
jamais par défaut.

## 3. Brancher le script de build

Dans `package.json`, préfixer la commande de build :

```diff
-    "build": "vite build && node scripts/spa-shells.mjs",
+    "build": "node scripts/build-linge.mjs && vite build && node scripts/spa-shells.mjs",
```

L'ordre compte : le script écrit dans `public/` avant que Vite ne copie ce
dossier vers `dist/`.

## 4. Vérifier

```bash
node scripts/build-linge.mjs   # doit afficher : [linge] N entrée(s) → …
npm run build
```

Puis, une fois déployé, ouvrir `labelmaisoncg.fr/linge` : le navigateur demande
identifiant + mot de passe.

---

## Ajouter une intervention

Rien ne change dans le fonctionnement du skill `/linge` : il continue d'ajouter
une ligne à `gestion/linge/registre.jsonl`. Le commit déclenche le déploiement
Vercel, qui régénère la page. Compter une à deux minutes de build.

## Limites à connaître

- **Basic Auth** : un seul mot de passe partagé, pas de comptes individuels, pas
  de journal des accès. Suffisant pour un registre interne, insuffisant le jour
  où plusieurs personnes doivent y accéder avec des droits différents.
- Le mot de passe transite en clair dans l'en-tête HTTP — protégé uniquement par
  le HTTPS du site. Ne pas réutiliser un mot de passe employé ailleurs.
- Le navigateur garde les identifiants en mémoire jusqu'à la fermeture complète.
  Sur un téléphone partagé, ça reste ouvert.
