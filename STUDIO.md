# Label Maison Studio — mise en service

Produit payant branché sur le site : `/studio` (landing dédiée) et
`/studio/conditions` (CGV, remboursement, RGPD, mentions légales).

Parcours, sous forme de **conversation** : le visiteur envoie une photo dans le
fil, choisit une ambiance ou écrit son envie (« canapé beige, plus de lumière »),
le studio répond avec l'aperçu gratuit flouté et filigrané, puis le paiement
unique Stripe débloque le rendu HD net et la vidéo avant/après 9:16, livrés dans
la même conversation.

## Fichiers

| Rôle | Fichier |
| --- | --- |
| Landing | `src/app/pages/Studio.tsx` |
| Conditions / mentions légales | `src/app/pages/StudioConditions.tsx` |
| Barre + pied de page dédiés | `src/app/components/StudioChrome.tsx` |
| Bibliothèque serveur (scellé, moteurs, aperçu, Stripe, e-mails) | `api/_studio.ts` |
| Aperçu gratuit | `api/studio-generate.ts` |
| Ouverture du paiement | `api/studio-checkout.ts` |
| Livraison du HD après paiement | `api/studio-unlock.ts` |
| Notification Stripe (e-mail + prospect) | `api/studio-webhook.ts` |
| Filigrane embarqué (généré depuis le logo) | `api/_studio-watermark.ts` + `scripts/make-studio-watermark.mjs` |

## État de la mise en service (18 septembre 2026)

| Brique | État |
| --- | --- |
| Stripe Checkout | **opérationnel** — clé live en place, sessions `mode: payment` à 9,99 € et 24,90 € créées et vérifiées |
| Webhook Stripe | à créer dans le tableau de bord (`STRIPE_WEBHOOK_SECRET` manquante) |
| Moteur d'image fal.ai | clé valide mais **compte fal bloqué faute de solde** (`403 User is locked. Reason: TOP_UP`) — créditer le compte sur fal.ai/dashboard/billing |
| Resend | déjà en place pour les formulaires du site |

Ces clés vivent dans `.env` en local (gitigno·é, chmod 600). **Elles doivent être
recréées à la main dans Vercel** (Settings → Environment Variables) pour la
production : rien n'est lu depuis `.env` une fois déployé.

## Variables d'environnement (Vercel → Settings → Environment Variables)

**Indispensables**

| Variable | Rôle |
| --- | --- |
| `STUDIO_SECRET` | 32 caractères aléatoires. Chiffre le « scellé » qui protège le rendu HD. |
| `STRIPE_SECRET_KEY` | Clé secrète Stripe (`sk_live_…`). Sans elle, aucun paiement. |
| `RESEND_API_KEY` | Déjà en place pour les formulaires : sert aussi à envoyer le rendu. |

**Moteur d'image — une seule des trois suffit** (ordre de priorité)

| Variable | Fournisseur | Modèle par défaut (surchargeable) |
| --- | --- | --- |
| `FAL_KEY` | fal.ai | `fal-ai/nano-banana/edit` → `STUDIO_FAL_MODEL` |
| `REPLICATE_API_TOKEN` | Replicate | `black-forest-labs/flux-kontext-pro` → `STUDIO_REPLICATE_MODEL` |
| `GEMINI_API_KEY` | Google AI Studio | `gemini-2.5-flash-image` → `STUDIO_GEMINI_MODEL` |

fal.ai et Replicate renvoient une URL hébergée : rien d'autre à configurer.
Google renvoie les octets de l'image : il faut alors un stockage (ci-dessous).

**Optionnelles**

| Variable | Rôle |
| --- | --- |
| `STRIPE_WEBHOOK_SECRET` | Active `/api/studio-webhook` (envoi du rendu même si le client ferme l'onglet). Sans elle, l'e-mail part au moment du déblocage. |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STUDIO_BUCKET` | Stockage privé des rendus (obligatoire avec Google, facultatif sinon). Bucket privé, par défaut `studio`. |
| `STUDIO_PRIX_UNIQUE_CENTIMES` (999), `STUDIO_PRIX_TRIO_CENTIMES` (2490) | Tarifs. |
| `STUDIO_GRATUIT_PAR_JOUR` (2) | Aperçus gratuits par IP et par jour. |
| `VITE_CLARITY_ID` | Charge Microsoft Clarity sur la page (rien n'est chargé sans). |

## Webhook Stripe

Dans le tableau de bord Stripe : *Developers → Webhooks → Add endpoint*
`https://<domaine>/api/studio-webhook`, événement `checkout.session.completed`,
puis copier le secret dans `STRIPE_WEBHOOK_SECRET`.

## Essayer en local sans clé ni paiement

```bash
STUDIO_MOCK_LOCAL=1 STUDIO_SECRET=une-chaine-de-32-caracteres npm run dev
```

`STUDIO_MOCK_LOCAL` ne fabrique pas un vrai rendu : il se contente de retoucher
la photo pour dérouler le tunnel. Il est **inopérant en production**
(`NODE_ENV=production`). Pour juger la qualité réelle, il faut une clé de moteur.

## Sécurité du paywall

- Le rendu HD n'est jamais renvoyé au navigateur avant vérification du paiement
  directement auprès de Stripe (`payment_status = paid`).
- L'aperçu gratuit est dégradé **côté serveur** : 900 px, flou, filigrane incrusté.
- Le paiement est lié au rendu par `client_reference_id = empreinte(scellé)` :
  une session payée ne peut pas débloquer un autre rendu.
- Aucune donnée bancaire ne transite par le site (Stripe Checkout hébergé).
