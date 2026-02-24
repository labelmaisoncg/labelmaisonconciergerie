# Déploiement - Label Maison

## Prérequis

- Node.js 18+
- Compte [Vercel](https://vercel.com) ou [Netlify](https://netlify.com)

## Build local

```bash
npm install
npm run build
```

Le dossier `dist/` contient les fichiers prêts pour le déploiement.

## Option 1 : Vercel (recommandé)

1. Poussez votre code sur GitHub
2. Allez sur [vercel.com](https://vercel.com) et connectez votre repo
3. Vercel détecte automatiquement Vite — cliquez sur **Deploy**
4. Votre site sera en ligne en quelques secondes

**CLI :**
```bash
npx vercel
```

## Option 2 : Netlify

1. Poussez votre code sur GitHub
2. Allez sur [netlify.com](https://netlify.com) → **Add new site** → **Import from Git**
3. Sélectionnez votre repo — la config `netlify.toml` est déjà en place
4. Cliquez sur **Deploy**

**CLI :**
```bash
npm install -g netlify-cli
netlify deploy --prod
```

## Option 3 : Hébergement statique (OVH, o2switch, etc.)

1. Exécutez `npm run build`
2. Uploadez tout le contenu du dossier `dist/` sur votre serveur
3. Configurez votre serveur pour rediriger toutes les routes vers `index.html` (SPA)

## Images Airbnb (page Propriétaires)

Les images de revenus Airbnb utilisent actuellement des placeholders. Pour les remplacer par vos captures d'écran réelles :

1. Placez vos images dans `public/images/`
2. Modifiez `src/app/pages/Proprietaires.tsx` pour utiliser `/images/votre-image.png`
