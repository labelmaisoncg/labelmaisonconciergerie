// =============================================================================
// /api/erp-invitation — « Envoyer l'invitation » (Paramètres → Équipe), pour
// les gérants connectés à l'ERP :
//
//   POST { email } → { ok, envoye, lien }
//
// Le lien « Créer mon compte » (src/erp/data/invitation.ts) ouvre la page
// d'accès du site fixe avec l'adresse pré-remplie : il ne contient rien de
// secret et n'ouvre rien seul (confirmation de l'adresse par Supabase, puis
// appartenance à l'espace vérifiée par /erp/connexion).
//
// Contrôles : rôle gérant DANS l'espace de l'en-tête x-erp-espace
// (verifierMembre), et l'adresse doit déjà figurer parmi les membres de cet
// espace (lus avec la session du gérant : les règles de la base s'appliquent).
// E-mail au nom de l'espace (expediteurEspace, comme les accès extérieurs) :
// sans clé Resend ou sans expéditeur pour l'espace, rien ne part et le
// gérant copie le lien. Jamais l'Origin ni le Host de la demande.
// =============================================================================

import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../src/erp/data/config.js';
import { ENTETE_ESPACE, estLabelMaison } from '../src/erp/data/espaces.js';
import { EMAIL_VALIDE, emailInvitation, lienCreationCompte, normaliserEmailInvitation } from '../src/erp/data/invitation.js';
import { lireIdentite, verifierMembre } from '../src/erp/data/repull-synchro.js';
import { lireCorps, repondre } from './_erp-repull.js';
import { espaceDemande } from './_erp-espaces.js';
import { envoyerEmailEspace, ficheEspace } from './_acces-externe.js';

/**
 * L'adresse est-elle membre de l'espace ? Lu avec la session du gérant
 * (règles RLS). Base d'avant les espaces : erp.membres, sans colonne espace.
 * null : la base n'a pas répondu.
 */
async function membreDeLEspace(jeton: string, espace: string, email: string): Promise<boolean | null> {
  const identite = await lireIdentite(jeton).catch(() => undefined);
  if (identite === undefined) return null;
  const historique = identite === null;
  if (historique && !estLabelMaison(espace)) return false;
  // Comparaison sans la casse ; « % » et « _ » échappés, « * » (joker de PostgREST) : comparaison exacte.
  const filtre = email.includes('*') ? `eq.${encodeURIComponent(email)}` : `ilike.${encodeURIComponent(email.replace(/[\\%_]/g, (c) => `\\${c}`))}`;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/membres?select=email&email=${filtre}${historique ? '' : `&espace=eq.${espace}`}&limit=1`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${jeton}`,
      'Accept-Profile': 'erp',
      ...(historique ? {} : { [ENTETE_ESPACE]: espace }),
    },
  }).catch(() => null);
  if (!r || !r.ok) return null;
  const lignes = (await r.json().catch(() => null)) as unknown;
  return Array.isArray(lignes) && lignes.length > 0;
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

  const estMembre = await membreDeLEspace(jeton, membre.espace, email);
  if (estMembre === null) return repondre(res, 502, { ok: false, erreur: 'La base de l’ERP ne répond pas. Réessayez dans un instant.' });
  if (!estMembre) return repondre(res, 409, { ok: false, code: 'membre', erreur: 'Ajoutez d’abord cette adresse à l’équipe, puis envoyez l’invitation.' });

  const lien = lienCreationCompte(email);
  // Fiche de l'espace (nom, expéditeur) ; illisible : pas d'e-mail, jamais au nom de Label Maison par défaut.
  const fiche = await ficheEspace(membre.espace).catch(() => undefined);
  const envoye = fiche ? await envoyerEmailEspace(fiche, { to: email, ...emailInvitation({ email, espace: fiche.nom }) }) : false;
  return repondre(res, 200, { ok: true, envoye, lien });
}
