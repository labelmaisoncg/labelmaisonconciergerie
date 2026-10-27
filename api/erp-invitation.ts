// =============================================================================
// /api/erp-invitation — « Envoyer l'invitation » (Paramètres → Équipe), pour
// les gérants connectés à l'ERP :
//
//   POST { email } → { ok, envoye, lien }
//
// Le lien « Créer mon compte » (src/erp/data/invitation.ts) ouvre la page
// d'accès du site fixe avec l'adresse et un code à usage unique (32 octets
// au hasard) ; la base n'en garde que l'empreinte SHA-256, 14 jours
// (erp.inviter_membre). C'est ce code qui relie la ligne du membre à SON
// compte, à sa première entrée (erp.activer) : un compte créé avant lui à
// la même adresse, par quelqu'un d'autre, n'obtient rien. Une nouvelle
// invitation remplace la précédente.
//
// Contrôles : rôle gérant DANS l'espace de l'en-tête x-erp-espace
// (verifierMembre), puis la base elle-même, avec la session du gérant
// (gérant de l'espace, adresse déjà dans l'équipe, accès pas encore activé).
// Base d'avant les espaces : pas d'invitation (un gérant crée le compte dans
// Supabase). E-mail au nom de l'espace (expediteurEspace) : sans clé Resend
// ou sans expéditeur pour l'espace, rien ne part et le gérant copie le lien.
// Jamais l'Origin ni le Host de la demande.
// =============================================================================

import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../src/erp/data/config.js';
import { ENTETE_ESPACE, MESSAGE_BASE_PAS_PREPAREE } from '../src/erp/data/espaces.js';
import { EMAIL_VALIDE, emailInvitation, lienCreationCompte, normaliserEmailInvitation } from '../src/erp/data/invitation.js';
import { empreinteJeton, nouveauJeton } from '../src/erp/data/proprietaire-acces.js';
import { lireIdentite, verifierMembre } from '../src/erp/data/repull-synchro.js';
import { lireCorps, repondre } from './_erp-repull.js';
import { espaceDemande } from './_erp-espaces.js';
import { envoyerEmailEspace, ficheEspace } from './_acces-externe.js';

/** Message de la base d'avant les espaces : pas d'invitation par lien. */
export const MESSAGE_INVITATION_HISTORIQUE = 'Disponible après la mise en service des espaces ; en attendant, un gérant crée le compte dans Supabase.';

type Invitation = { ok: true; deja: boolean } | { ok: false; statut: number; erreur: string; code?: string };

/** erp.inviter_membre avec la session du gérant, dans l'espace de l'en-tête. */
async function inviterMembre(jeton: string, espace: string, email: string, empreinte: string): Promise<Invitation> {
  const r = await fetch(`${SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/rpc/inviter_membre`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${jeton}`,
      'Content-Type': 'application/json',
      'Content-Profile': 'erp',
      'Accept-Profile': 'erp',
      [ENTETE_ESPACE]: espace,
    },
    body: JSON.stringify({ p_espace: espace, p_email: email, p_empreinte: empreinte }),
  }).catch(() => null);
  if (!r) return { ok: false, statut: 502, erreur: 'La base de l’ERP ne répond pas. Réessayez dans un instant.' };
  const corps = (await r.json().catch(() => null)) as { deja?: unknown; code?: unknown; message?: unknown } | null;
  if (r.ok) return { ok: true, deja: corps?.deja === true };
  const code = String(corps?.code ?? '');
  if (code === 'PGRST202' || code === '42883') return { ok: false, statut: 503, erreur: MESSAGE_BASE_PAS_PREPAREE };
  if (code === '22023') return { ok: false, statut: 409, code: 'membre', erreur: 'Ajoutez d’abord cette adresse à l’équipe, puis envoyez l’invitation.' };
  if (code === '42501') return { ok: false, statut: 403, erreur: 'Seul un gérant de cet espace peut inviter quelqu’un.' };
  console.warn('[erp-invitation]', r.status, code, String(corps?.message ?? '').slice(0, 200));
  return { ok: false, statut: 502, erreur: 'La base de l’ERP ne répond pas. Réessayez dans un instant.' };
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return repondre(res, 405, { ok: false, erreur: 'Méthode non autorisée.' });
  }
  const entete = String(req.headers?.authorization || '');
  const jeton = /^Bearer\s+/i.test(entete) ? entete.replace(/^Bearer\s+/i, '').trim() : '';
  if (!jeton) return repondre(res, 401, { ok: false, erreur: 'Session expirée : reconnectez-vous à l’ERP.' });
  const membre = await verifierMembre(jeton, { espace: espaceDemande(req) });
  if (!membre.ok || membre.role !== 'gerant') {
    if (!membre.ok) console.warn('[erp-invitation]', membre.statut, membre.erreur);
    return repondre(res, 403, { ok: false, erreur: 'Seul un gérant de cet espace peut inviter quelqu’un.' });
  }
  const email = normaliserEmailInvitation(lireCorps(req).email);
  if (!EMAIL_VALIDE.test(email) || email.length > 200) return repondre(res, 400, { ok: false, erreur: 'Adresse e-mail invalide.' });

  // Base d'avant les espaces (erp.qui_suis_je absente) : rien ne relierait le compte à son invité.
  const identite = await lireIdentite(jeton).catch(() => undefined);
  if (identite === undefined) return repondre(res, 502, { ok: false, erreur: 'La base de l’ERP ne répond pas. Réessayez dans un instant.' });
  if (identite === null) return repondre(res, 409, { ok: false, code: 'historique', erreur: MESSAGE_INVITATION_HISTORIQUE });

  const code = await nouveauJeton();
  const r = await inviterMembre(jeton, membre.espace, email, await empreinteJeton(code));
  if (!r.ok) return repondre(res, r.statut, { ok: false, erreur: r.erreur, ...(r.code ? { code: r.code } : {}) });
  if (r.deja) {
    return repondre(res, 409, {
      ok: false,
      code: 'deja',
      erreur: 'Cette personne a déjà activé son accès : elle se connecte avec son adresse et son mot de passe (« Mot de passe oublié ? » au besoin).',
    });
  }

  const lien = lienCreationCompte(email, code);
  // Fiche de l'espace (nom, expéditeur) ; illisible : pas d'e-mail, jamais au nom de Label Maison par défaut.
  const fiche = await ficheEspace(membre.espace).catch(() => undefined);
  const envoye = fiche ? await envoyerEmailEspace(fiche, { to: email, ...emailInvitation({ email, espace: fiche.nom, code }) }) : false;
  return repondre(res, 200, { ok: true, envoye, lien });
}
