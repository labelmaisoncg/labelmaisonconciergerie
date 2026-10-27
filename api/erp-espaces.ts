// =============================================================================
// /api/erp-espaces — espaces ouverts par invitation (supabase/erp-espaces.sql).
//
// Gérant de Label Maison, la plateforme (Authorization: Bearer <session
// Supabase>, en-tête x-erp-espace de Label Maison) :
//   GET  ?action=plateforme                     espaces (suspendus compris) et
//                                               invitations en attente
//   POST { action: 'inviter', nom, email }       invitation de 14 jours, liée à
//                                               l'adresse ; e-mail avec l'expéditeur
//                                               de Label Maison, sinon lien à copier
//   POST { action: 'annuler', id }               invitation retirée
//   POST { action: 'suspendre', espace, actif }  espace suspendu (false) ou rouvert
//
// Gérant d'un autre espace (en-tête x-erp-espace de son espace) :
//   GET  ?action=repull                          clé et secret du webhook enregistrés
//                                               (oui / non, jamais leur valeur),
//                                               workspace de sa clé, adresse du webhook
//   POST { action: 'repull', cle?, secretWebhook?, workspace? }
//                                               rangés dans le coffre de Supabase
//
// Chaque appel à la base passe avec la session de la personne : la base
// revérifie ses droits (erp.gerant_plateforme, erp.acces_gerant), le serveur
// ne les élargit jamais. La création de l'espace se fait depuis l'ERP
// (navigateur, erp.creer_espace). Rien n'est écrit vers les plateformes.
// =============================================================================

import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../src/erp/data/config.js';
import { ENTETE_ESPACE, ESPACE_LABEL_MAISON, ID_LABEL_MAISON, MESSAGE_BASE_PAS_PREPAREE, estLabelMaison, idEspaceValide } from '../src/erp/data/espaces.js';
import { emailValide, normaliserEmail } from '../src/erp/data/proprietaire-acces.js';
import { verifierMembre } from '../src/erp/data/repull-synchro.js';
import { lireCorps, repondre } from './_erp-repull.js';
import { espaceDemande, type FicheEspace } from './_erp-espaces.js';
import { adresseSite, envoyerEmailEspace } from './_acces-externe.js';
import { echapperHtml } from './_garde-formulaire.js';
import { lienCreationCompte } from '../src/erp/data/invitation.js';

/**
 * Fiche de Label Maison : l'expéditeur des invitations, selon les règles des
 * expéditeurs d'espace (expediteurEspace) ; jamais celui d'un autre espace.
 */
const FICHE_LABEL_MAISON: FicheEspace = { ...ESPACE_LABEL_MAISON, repull_workspace: null, config: {} };

type Retour<T> = { ok: true; donnees: T } | { ok: false; statut: number; erreur: string };

/**
 * Fonction de la base appelée avec la session de la personne, dans un
 * espace (en-tête x-erp-espace). Les refus de la base (42501) et ses
 * messages (P0001, écrits pour être lus) passent tels quels.
 */
export async function rpcDuCompte<T>(jeton: string, espace: string, nom: string, args: Record<string, unknown>): Promise<Retour<T>> {
  let r: Response;
  try {
    r = await fetch(`${SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/rpc/${nom}`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${jeton}`,
        'Content-Type': 'application/json',
        'Content-Profile': 'erp',
        'Accept-Profile': 'erp',
        [ENTETE_ESPACE]: espace,
      },
      body: JSON.stringify(args),
    });
  } catch {
    return { ok: false, statut: 503, erreur: 'Base de l’ERP injoignable : réessayez dans un instant.' };
  }
  const corps = (await r.json().catch(() => null)) as unknown;
  if (r.ok) return { ok: true, donnees: corps as T };
  const e = (corps ?? {}) as { code?: unknown; message?: unknown };
  const message = typeof e.message === 'string' ? e.message : '';
  if (e.code === 'PGRST202' || e.code === '42883') return { ok: false, statut: 503, erreur: MESSAGE_BASE_PAS_PREPAREE };
  if (e.code === '42501') return { ok: false, statut: 403, erreur: message || 'Accès refusé.' };
  // Messages écrits pour être lus : refus d'une valeur (adresse déjà membre…), contrôles de la base.
  if ((e.code === 'P0001' || e.code === '22023') && message) return { ok: false, statut: 400, erreur: message };
  console.error('[erp-espaces]', nom, r.status, String(e.code ?? ''), message.slice(0, 200));
  return { ok: false, statut: 500, erreur: 'Une erreur est survenue. Réessayez dans un instant.' };
}

/** Invitation par e-mail, au nom de Label Maison. Faux : pas d'envoi (le gérant copie le lien). */
async function envoyerInvitation(o: { email: string; nom: string; lien: string; expireLe: string }): Promise<boolean> {
  const fin = /^\d{4}-\d{2}-\d{2}/.test(o.expireLe)
    ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', timeZone: 'Europe/Paris' }).format(new Date(o.expireLe))
    : '';
  const sujet = `Ouvrez l’espace de ${o.nom}`;
  const etapes = [
    `Créer mon compte : ${o.lien}`,
    `Utilisez cette adresse (${o.email}), choisissez votre mot de passe, puis confirmez l’adresse avec le lien reçu.`,
    'Donnez le nom de votre conciergerie : votre espace est prêt.',
  ];
  const validite = fin ? `Cette invitation est valable jusqu’au ${fin}.` : 'Cette invitation est valable 14 jours.';
  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#fbfaf8;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1f1b16">
<div style="max-width:520px;margin:0 auto;padding:32px 20px">
<p style="font-family:Georgia,serif;font-size:22px;color:#4a3828;margin:0 0 20px">Label Maison</p>
<p style="font-size:15px;line-height:1.6;margin:0 0 12px">Bonjour,</p>
<p style="font-size:15px;line-height:1.6;margin:0 0 16px">Label Maison vous invite à ouvrir l’espace de ${echapperHtml(o.nom)} dans son application de gestion : logements, réservations, messages des voyageurs, équipe et propriétaires, rien qu’à vous.</p>
<ol style="font-size:15px;line-height:1.6;margin:0 0 24px;padding-left:20px">
<li>Touchez « Créer mon compte » ci-dessous.</li>
<li>Utilisez cette adresse (${echapperHtml(o.email)}), choisissez votre mot de passe, puis confirmez l’adresse avec le lien reçu.</li>
<li>Donnez le nom de votre conciergerie : votre espace est prêt.</li>
</ol>
<p style="margin:0 0 24px"><a href="${echapperHtml(o.lien)}" style="display:inline-block;background:#8a6a2f;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:10px">Créer mon compte</a></p>
<p style="font-size:13px;line-height:1.6;color:#6b6258;margin:0 0 8px">${echapperHtml(validite)}</p>
<p style="font-size:13px;line-height:1.6;color:#6b6258;margin:0">Vous n’attendiez pas ce message ? Ignorez-le simplement.</p>
</div></body></html>`;
  const text = `Bonjour,\n\nLabel Maison vous invite à ouvrir l’espace de ${o.nom} dans son application de gestion.\n\n${etapes.map((e, i) => `${i + 1}. ${e}`).join('\n')}\n\n${validite}\n\nLabel Maison`;
  return envoyerEmailEspace(FICHE_LABEL_MAISON, { to: o.email, sujet, html, text });
}

const texte = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
/** Clé ou secret collé : sans espace, d'une longueur raisonnable. */
const secretLisible = (v: string): boolean => v.length >= 8 && v.length <= 300 && !/\s/.test(v);

interface ReglagesRepull {
  code: string;
  workspace: string | null;
  cle: boolean;
  webhook: boolean;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return repondre(res, 405, { ok: false, erreur: 'Méthode non autorisée.' });
  }
  const entete = String(req.headers?.authorization || '');
  const jeton = /^Bearer\s+/i.test(entete) ? entete.replace(/^Bearer\s+/i, '').trim() : '';
  if (!jeton) return repondre(res, 401, { ok: false, erreur: 'Session expirée : reconnectez-vous à l’ERP.' });
  const m = await verifierMembre(jeton, { espace: espaceDemande(req) });
  if (!m.ok) return repondre(res, m.statut, { ok: false, erreur: m.erreur });
  if (m.role !== 'gerant') return repondre(res, 403, { ok: false, erreur: 'Réservé au gérant.' });

  const corps = req.method === 'POST' ? lireCorps(req) : {};
  const action = String((req.method === 'GET' ? req.query?.action : corps.action) ?? '');
  const echec = (r: { statut: number; erreur: string }) => repondre(res, r.statut, { ok: false, erreur: r.erreur });

  try {
    /* ---------------------------------------------- Label Maison (plateforme) */
    if (action === 'plateforme' || action === 'inviter' || action === 'annuler' || action === 'suspendre') {
      if (!estLabelMaison(m.espace)) return repondre(res, 403, { ok: false, erreur: 'Réservé aux gérants de Label Maison.' });
      if (action === 'plateforme') {
        if (req.method !== 'GET') return repondre(res, 405, { ok: false, erreur: 'Méthode non autorisée.' });
        const r = await rpcDuCompte<{ espaces?: unknown; invitations?: unknown }>(jeton, ID_LABEL_MAISON, 'espaces_plateforme', {});
        if (!r.ok) return echec(r);
        return repondre(res, 200, {
          ok: true,
          espaces: Array.isArray(r.donnees?.espaces) ? r.donnees.espaces : [],
          invitations: Array.isArray(r.donnees?.invitations) ? r.donnees.invitations : [],
          email: !!(process.env.RESEND_API_KEY || '').trim(),
        });
      }
      if (req.method !== 'POST') return repondre(res, 405, { ok: false, erreur: 'Méthode non autorisée.' });
      if (action === 'inviter') {
        const nom = texte(corps.nom);
        const email = normaliserEmail(corps.email);
        if (!nom || nom.length > 80) return repondre(res, 400, { ok: false, erreur: 'Nom de la conciergerie : entre 1 et 80 caractères.' });
        if (!emailValide(email)) return repondre(res, 400, { ok: false, erreur: 'Adresse e-mail invalide.' });
        const r = await rpcDuCompte<{ id: string; email: string; nom: string; expire_le: string }>(jeton, ID_LABEL_MAISON, 'inviter_espace', { p_nom: nom, p_email: email });
        if (!r.ok) return echec(r);
        // « Créer mon compte » sur le site fixe, adresse pré-remplie ; jamais l'adresse de la page qui appelle.
        const lien = lienCreationCompte(email);
        const envoye = await envoyerInvitation({ email, nom, lien, expireLe: String(r.donnees?.expire_le ?? '') });
        return repondre(res, 200, { ok: true, invitation: r.donnees, lien, envoye });
      }
      if (action === 'annuler') {
        if (!idEspaceValide(corps.id)) return repondre(res, 400, { ok: false, erreur: 'Invitation inconnue.' });
        const r = await rpcDuCompte<boolean>(jeton, ID_LABEL_MAISON, 'annuler_invitation_espace', { p_id: corps.id });
        return r.ok ? repondre(res, 200, { ok: true, annulee: r.donnees === true }) : echec(r);
      }
      if (!idEspaceValide(corps.espace) || typeof corps.actif !== 'boolean') return repondre(res, 400, { ok: false, erreur: 'Espace inconnu.' });
      if (estLabelMaison(corps.espace)) return repondre(res, 400, { ok: false, erreur: 'L’espace de Label Maison ne se suspend pas.' });
      const r = await rpcDuCompte<boolean>(jeton, ID_LABEL_MAISON, 'suspendre_espace', { p_espace: corps.espace.toLowerCase(), p_actif: corps.actif });
      return r.ok ? repondre(res, 200, { ok: true, actif: corps.actif }) : echec(r);
    }

    /* -------------------------------------------- Repull d'un autre espace */
    if (action === 'repull') {
      // Label Maison garde REPULL_API_KEY et REPULL_WORKSPACE_LM dans Vercel.
      if (estLabelMaison(m.espace)) {
        if (req.method === 'GET') return repondre(res, 200, { ok: true, labelMaison: true });
        return repondre(res, 400, { ok: false, erreur: 'Label Maison garde ses clés Repull dans Vercel.' });
      }
      const lire = async () => {
        const r = await rpcDuCompte<ReglagesRepull>(jeton, m.espace, 'reglages_repull_espace', { p_espace: m.espace });
        if (!r.ok) return r;
        const d = r.donnees ?? ({} as ReglagesRepull);
        return {
          ok: true as const,
          donnees: {
            cle: d.cle === true,
            webhook: d.webhook === true,
            workspace: typeof d.workspace === 'string' ? d.workspace : '',
            adresseWebhook: d.code ? `${adresseSite()}/api/erp-repull-webhook?espace=${encodeURIComponent(d.code)}` : '',
          },
        };
      };
      if (req.method === 'POST') {
        const cle = texte(corps.cle);
        const secretWebhook = texte(corps.secretWebhook);
        if (cle && !secretLisible(cle)) return repondre(res, 400, { ok: false, erreur: 'Clé Repull illisible : collez-la telle que Repull la donne, sans espace.' });
        if (secretWebhook && !secretLisible(secretWebhook)) return repondre(res, 400, { ok: false, erreur: 'Secret du webhook illisible : collez-le tel que Repull le donne, sans espace.' });
        if (cle) {
          const r = await rpcDuCompte<boolean>(jeton, m.espace, 'enregistrer_secret_espace', { p_espace: m.espace, p_nom: 'repull_cle', p_valeur: cle });
          if (!r.ok) return echec(r);
        }
        if (secretWebhook) {
          const r = await rpcDuCompte<boolean>(jeton, m.espace, 'enregistrer_secret_espace', { p_espace: m.espace, p_nom: 'repull_webhook', p_valeur: secretWebhook });
          if (!r.ok) return echec(r);
        }
        if (typeof corps.workspace === 'string') {
          const r = await rpcDuCompte<boolean>(jeton, m.espace, 'regler_repull_espace', { p_espace: m.espace, p_workspace: corps.workspace.trim() });
          if (!r.ok) return echec(r);
        }
      } else if (req.method !== 'GET') {
        return repondre(res, 405, { ok: false, erreur: 'Méthode non autorisée.' });
      }
      // Jamais la valeur d'une clé dans la réponse : seulement « enregistrée » ou non.
      const etat = await lire();
      return etat.ok ? repondre(res, 200, { ok: true, ...etat.donnees }) : echec(etat);
    }

    return repondre(res, 400, { ok: false, erreur: 'Action inconnue.' });
  } catch (e) {
    console.error('[erp-espaces] échec', action, e instanceof Error ? e.message : e);
    return repondre(res, 500, { ok: false, erreur: 'Une erreur est survenue. Réessayez dans un instant.' });
  }
}
