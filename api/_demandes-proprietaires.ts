// =============================================================================
// Demandes des propriétaires, côté serveur : une fois la demande enregistrée
// (api/espace-proprietaire.ts, action « demande » ; règles :
// src/erp/data/demandes-proprietaires.ts), prévenir les gérants de l'espace
// du propriétaire, et eux seuls :
//   - la notification d'app « Demande d’un propriétaire » (type réservé au
//     gérant, plafonnée : notifications.ts), envoyée aux appareils de CET
//     espace (la base de la session : jamais un autre espace) ;
//   - si l'envoi d'e-mails est configuré pour cet espace (RESEND_API_KEY et
//     un expéditeur : CONTACT_FROM_EMAIL pour Label Maison, config.email de
//     la fiche pour un autre espace), un e-mail à chacun de ses gérants
//     (erp.membres, rôle gérant, compte activé ; jamais un compte technique).
// Sans clés ni configuration : rien, et rien ne casse. Rien ici ne lève : un
// échec n'enlève jamais la demande, déjà enregistrée. Le texte du propriétaire
// ne part ni vers l'agent IA, ni vers le connecteur Claude, ni vers une
// plateforme ; dans l'e-mail, il est échappé et tronqué.
//
// Un fichier préfixé par « _ » n'est pas exposé comme route par Vercel.
// =============================================================================

import { espaceDe } from '../src/erp/data/acces-externe.js';
import { libelleDemande, lienDemande, ouPorteLaDemande } from '../src/erp/data/demandes-proprietaires.js';
import { envoyeesDepuis, envoyerNotifications } from '../src/erp/data/notifications-envoi.js';
import { extrait, notificationDemandePlafonnee } from '../src/erp/data/notifications.js';
import { estCompteTechnique } from '../src/erp/data/oauth-regles.js';
import type { BaseErp } from '../src/erp/data/repull-synchro.js';
import type { DemandeProprietaire } from '../src/erp/data/types';
import { adresseSite, envoyerEmailEspace, expediteurEspace, ficheEspace } from './_acces-externe.js';
import { avecDelai } from './_erp-crm.js';
import { clesServeur } from './_erp-notifications.js';
import { configuration } from './_erp-repull.js';
import { echapperHtml } from './_garde-formulaire.js';

/** Gérants prévenus par e-mail au plus (une adresse par envoi). */
const GERANTS_MAX = 5;
/** Caractères du message repris dans l'e-mail. */
const EXTRAIT_EMAIL = 600;
/** Délai total accordé aux envois (la réponse au propriétaire n'attend pas plus). */
const DELAI_MS = 6_000;
const NBSP = ' ';

/** Témoin de la base relu toutes les 5 minutes par espace (comme checkinPret, api/_sejour.ts). */
const PROTEGEES_MS = 5 * 60_000;
const protegees = new Map<string, { valeur: boolean; jusqua: number }>();

/**
 * La base réserve-t-elle les demandes aux gérants (erp.demandes_proprietaires_protegees,
 * posée par supabase/erp-espaces.sql ou erp-acces-gerants.sql avec les règles) ?
 * Sans elle, une demande serait lisible par toute l'équipe et un compte
 * « opérations » pourrait y glisser une réponse : aucune n'est enregistrée ni
 * lue. Gardé 5 minutes par espace ; une erreur vaut « non ».
 */
export async function demandesProtegees(base: BaseErp, espace: string): Promise<boolean> {
  const id = espaceDe(espace);
  const lu = protegees.get(id);
  if (lu && lu.jusqua > Date.now()) return lu.valeur;
  const valeur = await base.rpc<unknown>('demandes_proprietaires_protegees').then((v) => v === true, () => false);
  protegees.set(id, { valeur, jusqua: Date.now() + PROTEGEES_MS });
  return valeur;
}

/** Tests : oublie l'état gardé. */
export const oublierDemandesProtegees = () => protegees.clear();

/** Notification aux appareils des gérants de l'espace (plafonnée). Ne lève jamais. */
export async function notifierDemande(base: BaseErp, demande: DemandeProprietaire, o: { logement?: string }): Promise<void> {
  try {
    const cles = clesServeur();
    if (!cles) return;
    const maintenant = new Date();
    const recentes = await envoyeesDepuis(base, 'demande-proprio-', new Date(maintenant.getTime() - 3_600_000)).catch(() => 0);
    await envoyerNotifications(base, [notificationDemandePlafonnee(demande, { logement: o.logement, recentes, maintenant })], { cles, maintenant });
  } catch (e) {
    console.warn('[demandes-proprietaires] notification impossible', e instanceof Error ? e.message : e);
  }
}

/** E-mail « Demande d’un propriétaire » : sujet, corps HTML et texte (message échappé, tronqué). */
export function emailDemande(o: { conciergerie: string; proprietaire: string; logement?: string; demande: DemandeProprietaire; lien: string }) {
  const ou = ouPorteLaDemande({ ...(o.logement ? { logement: { nom: o.logement } } : {}), tousLogements: o.demande.tousLogements }, 'gerant');
  const quoi = `${libelleDemande(o.demande)} · ${ou}`;
  // Lignes gardées (white-space: pre-wrap), tronqué au caractère près.
  const brut = Array.from(String(o.demande.echanges[0]?.texte ?? ''));
  const message = brut.length > EXTRAIT_EMAIL ? `${brut.slice(0, EXTRAIT_EMAIL - 1).join('').trimEnd()}…` : brut.join('');
  const sujet = `Demande d’un propriétaire · ${extrait(ou, 60)}`;
  const intro = `${o.proprietaire} vous a écrit depuis son espace propriétaire.`;
  const suite = `Répondez depuis l’ERP${NBSP}: votre réponse s’affichera dans son espace.`;
  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#fbfaf8;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1f1b16">
<div style="max-width:520px;margin:0 auto;padding:32px 20px">
<p style="font-family:Georgia,serif;font-size:22px;color:#4a3828;margin:0 0 20px">${echapperHtml(o.conciergerie)}</p>
<p style="font-size:15px;line-height:1.6;margin:0 0 8px">${echapperHtml(intro)}</p>
<p style="font-size:14px;line-height:1.6;color:#6b6258;margin:0 0 16px">${echapperHtml(quoi)}</p>
<p style="font-size:15px;line-height:1.6;margin:0 0 24px;padding:12px 14px;background:#ffffff;border:1px solid #e8e2d8;border-radius:8px;white-space:pre-wrap">${echapperHtml(message)}</p>
<p style="margin:0 0 24px"><a href="${echapperHtml(o.lien)}" style="display:inline-block;background:#8a6424;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:8px">Ouvrir la demande</a></p>
<p style="font-size:13px;line-height:1.6;color:#6b6258;margin:0">${echapperHtml(suite)}</p>
</div></body></html>`;
  const text = `${intro}\n\n${quoi}\n\n${message}\n\nOuvrir la demande${NBSP}: ${o.lien}\n\n${suite}\n\n${o.conciergerie}`;
  return { sujet, html, text };
}

/** E-mail à chaque gérant de l'espace, si l'envoi est configuré pour lui ; le nombre d'e-mails partis. Ne lève jamais. */
export async function envoyerEmailDemande(base: BaseErp, espace: string, demande: DemandeProprietaire, o: { logement?: string; proprietaire: string }): Promise<number> {
  try {
    if (!(process.env.RESEND_API_KEY || '').trim()) return 0;
    const fiche = await ficheEspace(espace).catch(() => undefined);
    // Sans fiche ni expéditeur pour cet espace : aucun e-mail (jamais au nom de Label Maison par défaut).
    if (!expediteurEspace(fiche)) return 0;
    const equipe = configuration().email;
    const gerants = (await base.emailsDesGerants()).filter((e) => !estCompteTechnique(e, equipe)).slice(0, GERANTS_MAX);
    if (!gerants.length) return 0;
    const m = emailDemande({ conciergerie: fiche?.nom || 'Votre conciergerie', proprietaire: o.proprietaire, logement: o.logement, demande, lien: `${adresseSite()}${lienDemande(demande.id)}` });
    let n = 0;
    for (const to of gerants) if (await envoyerEmailEspace(fiche, { to, sujet: m.sujet, html: m.html, text: m.text })) n++;
    return n;
  } catch (e) {
    console.warn('[demandes-proprietaires] e-mail impossible', e instanceof Error ? e.message : e);
    return 0;
  }
}

/** Notification et e-mail, en parallèle, bornés dans le temps. Ne lève jamais. */
export async function prevenirGerants(base: BaseErp, espace: string, demande: DemandeProprietaire, o: { logement?: string; proprietaire: string }): Promise<void> {
  await avecDelai(Promise.allSettled([notifierDemande(base, demande, o), envoyerEmailDemande(base, espace, demande, o)]), DELAI_MS).catch((e) => {
    console.warn('[demandes-proprietaires] envois coupés', e instanceof Error ? e.message : e);
  });
}
