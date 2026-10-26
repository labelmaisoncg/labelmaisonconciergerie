// =============================================================================
// Notifications de l'app installable : clés serveur (variables Vercel) et
// raccourcis pour les routes. La logique (appareils, envoi, surveillance) est
// dans src/erp/data/notifications-envoi.ts ; le chiffrement dans web-push.ts.
//
// Variables Vercel (Production et Preview), puis redéployer :
//   VAPID_PUBLIC_KEY   clé publique (base64url, 65 octets)
//   VAPID_PRIVATE_KEY  clé privée (base64url, 32 octets) — secrète
//   VAPID_SUBJECT      facultative : mailto:… ou https://… (par défaut, le site)
// Sans elles, rien n'est envoyé et aucune lecture de plus n'est faite.
// Le gérant peut générer une paire dans Paramètres → Application (Avancé).
//
// Un fichier préfixé par « _ » n'est pas exposé comme route par Vercel.
// =============================================================================

import { surveiller as surveillerAvec, type BaseNotifications } from '../src/erp/data/notifications-envoi.js';
import type { GroupeNotification, Instantane } from '../src/erp/data/notifications.js';
import { clesValides, type ClesVapid } from '../src/erp/data/web-push.js';

let avertie = false;

/** Clés serveur (null : notifications pas encore activées). */
export function clesServeur(): ClesVapid | null {
  const publique = (process.env.VAPID_PUBLIC_KEY || '').trim();
  const privee = (process.env.VAPID_PRIVATE_KEY || '').trim();
  if (!publique || !privee) return null;
  if (!clesValides({ publique, privee })) {
    if (!avertie) console.warn('[notifications] VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY illisibles : notifications coupées.');
    avertie = true;
    return null;
  }
  return { publique, privee, sujet: (process.env.VAPID_SUBJECT || '').trim() || 'https://www.labelmaisoncg.fr' };
}

/** `surveiller` avec les clés de Vercel : notifications de ce que `travail` change. */
export function surveiller<T>(
  base: BaseNotifications,
  travail: () => Promise<T>,
  o: {
    apres?: (resultat: T, instantane: Instantane | null) => GroupeNotification[];
    enEchec?: (erreur: unknown) => GroupeNotification[];
    limite?: number;
  } = {},
): Promise<T> {
  return surveillerAvec(base, travail, { ...o, cles: clesServeur() });
}
