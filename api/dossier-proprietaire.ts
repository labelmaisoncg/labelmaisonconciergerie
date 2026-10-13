// =============================================================================
// /api/dossier-proprietaire — envoi du dossier propriétaire (page
// /dossier-proprietaire). Réponses revérifiées avec le même schéma que la page
// (src/erp/data/dossier-proprietaire.ts), puis, en parallèle :
//   - enregistrement dans l'ERP (api/_dossier.ts) ;
//   - e-mail récapitulatif à l'équipe (Resend).
// Réussi si l'un des deux aboutit, comme le formulaire de contact.
//
// Variables : RESEND_API_KEY ; CONTACT_TO_EMAIL (destinataire, comme le
// formulaire de contact) ; DOSSIER_TO_EMAIL (facultatif, destinataires en plus,
// séparés par des virgules) ; CONTACT_FROM_EMAIL ; ERP_PASSWORD.
// =============================================================================

import { Resend } from 'resend';
import { EMAIL_SUR } from '../src/erp/data/crm.js';
import { ETAPES_DOSSIER } from '../src/erp/data/dossier-proprietaire.js';
import { nettoyerValeurs } from '../src/erp/data/etapes-formulaire.js';
import { emailDossier, enregistrerDossier, type DossierEnregistre } from './_dossier.js';
import { avecDelai } from './_erp-crm.js';
import { lireCorps } from './_erp-repull.js';
import { adresseIp, freinEnvois, provenanceSite } from './_garde-formulaire.js';

/** Au plus 3 dossiers par adresse IP et par heure (par instance du serveur). */
const tropDEnvois = freinEnvois(3, 60 * 60_000);
const TAILLE_MAX = 100_000;

const destinataires = () =>
  [process.env.CONTACT_TO_EMAIL || 'labelmaisonconciergerie@gmail.com', ...(process.env.DOSSIER_TO_EMAIL || '').split(',')]
    .map((x) => x.trim())
    .filter((x, i, t) => x && EMAIL_SUR.test(x) && t.indexOf(x) === i);

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  const repondre = (statut: number, corps: unknown) => res.status(statut).json(corps);
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return repondre(405, { ok: false, erreur: 'Méthode non autorisée.' });
  }
  if (!provenanceSite(req)) return repondre(403, { ok: false, erreur: 'Envoi refusé : utilisez la page du dossier sur labelmaisoncg.fr.' });
  if (tropDEnvois(adresseIp(req))) {
    return repondre(429, { ok: false, erreur: 'Trop d’envois en peu de temps. Réessayez plus tard ou appelez-nous au 07 49 54 83 55.' });
  }

  const corps = lireCorps(req);
  if (JSON.stringify(corps).length > TAILLE_MAX) return repondre(413, { ok: false, erreur: 'Dossier trop volumineux.' });
  // Leurre : un robot remplit le champ caché ; on répond comme si tout allait bien.
  if (String(corps.site_web ?? '').trim()) return repondre(200, { ok: true });

  const lu = nettoyerValeurs(ETAPES_DOSSIER, corps.valeurs);
  if (!lu.ok) {
    console.warn('[dossier-proprietaire] refusé :', lu.erreurs.slice(0, 5).join(' | '));
    return repondre(400, { ok: false, erreur: `Une réponse est à revoir : ${lu.erreurs[0]}` });
  }
  const v = lu.valeurs;

  // ERP d'abord (le lien de la fiche part dans l'e-mail), coupé au bout de 8 s.
  let enregistre: DossierEnregistre | null = null;
  try {
    enregistre = await avecDelai(enregistrerDossier(v), 8_000);
  } catch (e) {
    console.error('[dossier-proprietaire] ERP :', e);
  }

  let emailOk = false;
  const cle = process.env.RESEND_API_KEY;
  if (cle) {
    try {
      const { sujet, html, texte } = emailDossier(v, enregistre);
      const { error } = await new Resend(cle).emails.send({
        from: process.env.CONTACT_FROM_EMAIL || 'Label Maison Conciergerie <onboarding@resend.dev>',
        to: destinataires(),
        replyTo: String(v['prop.email']),
        subject: sujet,
        html,
        text: texte,
      });
      if (error) console.error('[dossier-proprietaire] Resend :', error);
      else emailOk = true;
    } catch (e) {
      console.error('[dossier-proprietaire] e-mail :', e);
    }
  } else console.error('[dossier-proprietaire] RESEND_API_KEY absente : pas d’e-mail.');

  if (!enregistre && !emailOk) {
    return repondre(502, { ok: false, erreur: 'Envoi impossible pour le moment. Vos réponses restent sur cet appareil : réessayez dans quelques minutes.' });
  }
  return repondre(200, { ok: true });
}
