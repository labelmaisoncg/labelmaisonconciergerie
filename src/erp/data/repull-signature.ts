/**
 * Vérification de l'en-tête X-Repull-Signature des webhooks Repull (doc
 * Repull « Verify Webhook Signatures ») : « t=<unix>,v1=<hex> », où
 * v1 = HMAC-SHA256(secret de l'abonnement, `${t}.${corps brut}`) en hexadécimal.
 * Comparaison à temps constant ; horodatage refusé au-delà de 5 minutes
 * (rejeu) ; plusieurs v1 acceptés (rotation du secret).
 *
 * Sans dépendance à Node : le calcul HMAC et la comparaison sont fournis par
 * l'appelant (node:crypto dans api/erp-repull-webhook.ts).
 */

export interface OutilsSignature {
  /** HMAC-SHA256 hexadécimal. */
  hmacHex: (secret: string, message: string) => string;
  /** Comparaison à temps constant de deux chaînes de même longueur. */
  egal: (a: string, b: string) => boolean;
}

export const TOLERANCE_SIGNATURE_S = 5 * 60;

export function signatureValide(
  brut: string,
  entete: unknown,
  secret: string,
  outils: OutilsSignature,
  maintenantS = Math.floor(Date.now() / 1000),
): boolean {
  if (!secret) return false;
  let t = '';
  const v1: string[] = [];
  for (const morceau of String(entete ?? '').split(',')) {
    const i = morceau.indexOf('=');
    if (i <= 0) continue;
    const k = morceau.slice(0, i).trim();
    const v = morceau.slice(i + 1).trim();
    if (k === 't') t = v;
    else if (k === 'v1') v1.push(v);
  }
  if (!/^\d+$/.test(t) || !v1.length) return false;
  if (Math.abs(maintenantS - Number(t)) > TOLERANCE_SIGNATURE_S) return false;
  const attendue = outils.hmacHex(secret, `${t}.${brut}`);
  let ok = false;
  // Toutes les valeurs sont comparées (pas d'arrêt au premier succès).
  for (const s of v1) if (s.length === attendue.length && outils.egal(s, attendue)) ok = true;
  return ok;
}
