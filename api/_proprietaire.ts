// =============================================================================
// Espace propriétaire — accès à la base pour api/espace-proprietaire.ts.
//
// Le propriétaire ne lit jamais la base : tout passe ici, avec la session du
// compte d'équipe (baseErp), filtré par propriétaire avant tout calcul.
// Un fichier préfixé par « _ » n'est pas exposé comme route par Vercel.
//
// Variables d'environnement (projet Vercel du site) :
//   PROPRIETAIRE_SECRET  secret de signature des sessions (32 caractères au
//                        moins) — sans lui, l'espace propriétaire reste fermé
//   ERP_PASSWORD         mot de passe du compte d'équipe (lecture de la base)
//   RESEND_API_KEY       envoi des liens par e-mail (sans : lien à copier)
//   CONTACT_FROM_EMAIL   expéditeur des e-mails
// =============================================================================

import { Resend } from 'resend';
import type { BaseErp } from '../src/erp/data/repull-synchro.js';
import { adresseWeb, photoCouverture, proprietaireAutorise, type EntreesProprietaire } from '../src/erp/data/proprietaire.js';
import { secretValide } from '../src/erp/data/proprietaire-acces.js';
import type { Logement, Mandat, Proprietaire, Reservation } from '../src/erp/data/types';
import type { AccesProprietaire, BilanProprietaire, DocumentProprietaire } from '../src/erp/data/types-proprietaire';
import { baseErp, configuration, signeurFichiersErp } from './_erp-repull.js';
import { echapperHtml, ORIGINES_SITE } from './_garde-formulaire.js';

export const SITE_PAR_DEFAUT = 'https://labelmaisoncg.fr';
/** Durée des liens signés : photo de couverture (affichée), document (ouvert tout de suite). */
const DUREE_PHOTO_S = 6 * 3600;
export const DUREE_DOCUMENT_S = 120;

export function secretProprietaire(): string {
  return (process.env.PROPRIETAIRE_SECRET || '').trim();
}

/** Espace ouvert ? Sinon, la raison à montrer au gérant. */
export function etatEspace(): { actif: boolean; raison?: string; email: boolean } {
  const email = !!(process.env.RESEND_API_KEY || '').trim();
  if (!secretValide(secretProprietaire())) {
    return {
      actif: false,
      email,
      raison:
        'Espace propriétaire fermé : ajoutez PROPRIETAIRE_SECRET dans Vercel (Settings → Environment Variables, 32 caractères au moins, Production et Preview), puis redéployez.',
    };
  }
  if (!configuration().motDePasse) {
    return { actif: false, email, raison: 'ERP_PASSWORD manquant dans Vercel : l’espace propriétaire lit la base avec le compte d’équipe.' };
  }
  return { actif: true, email };
}

export const base = (): BaseErp => baseErp(configuration());

/** Adresse du site pour les liens envoyés (celle de la page qui appelle, si c'est le site). */
export function adresseSite(req: any): string {
  const origine = String(req.headers?.origin || '').replace(/\/+$/, '');
  return origine && ORIGINES_SITE.test(`${origine}/`) && /^https:\/\//.test(origine) ? origine : SITE_PAR_DEFAUT;
}

export const lienEspace = (site: string, jeton: string): string => `${site}/espace-proprietaire#jeton=${jeton}`;

export async function lireAcces(b: BaseErp, proprietaireId: string): Promise<AccesProprietaire | undefined> {
  return (await b.lire<AccesProprietaire>('accesProprietaires', [proprietaireId]))[0];
}

export const tousLesAcces = (b: BaseErp): Promise<AccesProprietaire[]> => b.lire<AccesProprietaire>('accesProprietaires');

export async function ecrireAcces(b: BaseErp, a: AccesProprietaire): Promise<void> {
  await b.ecrire('accesProprietaires', [a], 'espace-proprietaire');
}

export async function lireProprietaire(b: BaseErp, id: string): Promise<Proprietaire | undefined> {
  if (!proprietaireAutorise(id)) return undefined;
  return (await b.lire<Proprietaire>('proprietaires', [id]))[0];
}

/**
 * Données d'un propriétaire, filtrées dès la lecture : ses logements, leurs
 * réservations et mandats, ses documents et bilans. Rien d'autre ne sort d'ici.
 */
export async function entreesDuProprietaire(b: BaseErp, proprietaireId: string): Promise<EntreesProprietaire> {
  if (!proprietaireAutorise(proprietaireId)) {
    return { proprietaires: [], logements: [], reservations: [], mandats: [], documentsProprietaire: [], bilansProprietaire: [] };
  }
  const [proprietaires, logements, reservations, mandats, documents, bilans] = await Promise.all([
    b.lire<Proprietaire>('proprietaires', [proprietaireId]),
    b.lire<Logement>('logements'),
    b.lire<Reservation>('reservations'),
    b.lire<Mandat>('mandats'),
    b.lire<DocumentProprietaire>('documentsProprietaire'),
    b.lire<BilanProprietaire>('bilansProprietaire'),
  ]);
  const siens = logements.filter((l) => l?.proprietaireId === proprietaireId);
  const ids = new Set(siens.map((l) => l.id));
  return {
    proprietaires: proprietaires.filter((p) => p?.id === proprietaireId),
    logements: siens,
    reservations: reservations.filter((r) => ids.has(r?.logementId)),
    mandats: mandats.filter((m) => ids.has(m?.logementId)),
    documentsProprietaire: documents.filter((d) => d?.proprietaireId === proprietaireId),
    bilansProprietaire: bilans.filter((x) => x?.proprietaireId === proprietaireId),
  };
}

/** Photos de couverture affichables : adresse web telle quelle, fichier de l'équipe signé. */
export async function photosSignees(logements: readonly Logement[]): Promise<Map<string, string>> {
  const signer = signeurFichiersErp(configuration());
  const res = new Map<string, string>();
  await Promise.all(
    logements.map(async (l) => {
      const p = photoCouverture(l);
      if (!p) return;
      if (adresseWeb(p)) res.set(l.id, p);
      else if (p.startsWith('stockage://')) {
        const lien = await signer(p, DUREE_PHOTO_S).catch(() => null);
        if (lien) res.set(l.id, lien);
      }
    }),
  );
  return res;
}

export async function lireDocument(b: BaseErp, id: string): Promise<DocumentProprietaire | undefined> {
  if (!id || id.length > 200) return undefined;
  return (await b.lire<DocumentProprietaire>('documentsProprietaire', [id]))[0];
}

export async function lienDocument(fichier: string): Promise<string | null> {
  if (/^https:\/\//.test(fichier)) return fichier;
  if (!fichier.startsWith('stockage://')) return null;
  return signeurFichiersErp(configuration())(fichier, DUREE_DOCUMENT_S).catch(() => null);
}

/**
 * Lien de connexion par e-mail (Resend). Faux si l'envoi n'a pas pu se
 * faire : le gérant copie alors le lien affiché.
 */
export async function envoyerLien(o: { email: string; nom: string; lien: string; motif: 'invitation' | 'connexion' }): Promise<boolean> {
  const cle = (process.env.RESEND_API_KEY || '').trim();
  if (!cle) return false;
  const invitation = o.motif === 'invitation';
  const sujet = invitation ? 'Votre espace propriétaire Label Maison' : 'Votre lien de connexion · Label Maison';
  const intro = invitation
    ? 'Label Maison vous ouvre votre espace propriétaire : vos logements, le calendrier des réservations, vos bilans mensuels et vos documents, au même endroit.'
    : 'Voici votre lien pour ouvrir votre espace propriétaire.';
  const validite = invitation ? 'Ce lien est valable 7 jours et ne sert qu’une fois.' : 'Ce lien est valable 1 heure et ne sert qu’une fois.';
  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#fbfaf8;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1f1b16">
<div style="max-width:520px;margin:0 auto;padding:32px 20px">
<p style="font-family:Georgia,serif;font-size:22px;color:#4a3828;margin:0 0 20px">Label Maison</p>
<p style="font-size:15px;line-height:1.6;margin:0 0 12px">Bonjour ${echapperHtml(o.nom)},</p>
<p style="font-size:15px;line-height:1.6;margin:0 0 24px">${echapperHtml(intro)}</p>
<p style="margin:0 0 24px"><a href="${echapperHtml(o.lien)}" style="display:inline-block;background:#8a6a2f;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:10px">Ouvrir mon espace</a></p>
<p style="font-size:13px;line-height:1.6;color:#6b6258;margin:0 0 8px">${echapperHtml(validite)} Vous pourrez ensuite demander un nouveau lien avec votre adresse e-mail.</p>
<p style="font-size:13px;line-height:1.6;color:#6b6258;margin:0">Vous n’attendiez pas ce message ? Ignorez-le simplement.</p>
</div></body></html>`;
  const text = `Bonjour ${o.nom},\n\n${intro}\n\nOuvrir mon espace : ${o.lien}\n\n${validite}\n\nLabel Maison Conciergerie`;
  try {
    const { error } = await new Resend(cle).emails.send({
      from: process.env.CONTACT_FROM_EMAIL || 'Label Maison Conciergerie <onboarding@resend.dev>',
      to: [o.email],
      replyTo: 'contact@labelmaisoncgexperience.fr',
      subject: sujet,
      html,
      text,
    });
    if (error) console.error('[espace-proprietaire] Resend :', error.message ?? error);
    return !error;
  } catch (e) {
    console.error('[espace-proprietaire] Resend :', e instanceof Error ? e.message : e);
    return false;
  }
}
