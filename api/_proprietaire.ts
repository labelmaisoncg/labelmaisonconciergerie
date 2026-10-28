// =============================================================================
// Espace propriétaire — accès à la base pour api/espace-proprietaire.ts.
//
// Le propriétaire ne lit jamais la base : tout passe ici, dans la base de
// l'espace de son accès (api/_acces-externe.ts), filtré par propriétaire
// avant tout calcul. Un fichier préfixé par « _ » n'est pas exposé comme
// route par Vercel.
//
// Variables d'environnement : voir api/_acces-externe.ts (PROPRIETAIRE_SECRET,
// RESEND_API_KEY, CONTACT_FROM_EMAIL), ERP_PASSWORD (compte d'équipe, Label
// Maison) et ERP_SERVEUR_MOT_DE_PASSE (compte serveur : un autre espace, ses
// fichiers compris).
// =============================================================================

import type { BaseErp } from '../src/erp/data/repull-synchro.js';
import { espaceDe } from '../src/erp/data/acces-externe.js';
import { CONTENU_ESPACE, adresseWeb, donneesDuProprietaire, photoCouverture, proprietaireAutorise, type EntreesProprietaire } from '../src/erp/data/proprietaire.js';
import { COLLECTION_RELANCES, facturePartagee } from '../src/erp/data/relances.js';
import { ID_REGLAGE_SOCIETE } from '../src/erp/data/identite-conciergerie.js';
import type { Facture, Incident, Logement, Mandat, Mission, Proprietaire, Reglage, Reservation } from '../src/erp/data/types';
import type { ControleQualite } from '../src/erp/data/types-operations';
import type { AccesProprietaire, BilanProprietaire, DocumentProprietaire, RelancePaiement } from '../src/erp/data/types-proprietaire';
import { configuration, signeurFichiersErp, stockageFerme } from './_erp-repull.js';
import { GENRES, envoyerEmailEspace, secretAcces } from './_acces-externe.js';
import type { FicheEspace } from './_erp-espaces.js';
import { echapperHtml } from './_garde-formulaire.js';

/** Durée des liens signés : photo de couverture (affichée), document (ouvert tout de suite). */
const DUREE_PHOTO_S = 6 * 3600;
export const DUREE_DOCUMENT_S = 120;
const COLLECTION = GENRES.proprietaire.collection;

/** Espace ouvert ? Sinon, la raison à montrer au gérant. */
export function etatEspace(): { actif: boolean; raison?: string; email: boolean } {
  const email = !!(process.env.RESEND_API_KEY || '').trim();
  if (!secretAcces('proprietaire')) {
    return {
      actif: false,
      email,
      raison:
        'Espace propriétaire fermé : ajoutez PROPRIETAIRE_SECRET dans Vercel (Settings → Environment Variables, 32 caractères au moins, Production et Preview), puis redéployez.',
    };
  }
  const c = configuration();
  if (!c.motDePasse && !c.motDePasseServeur) {
    return { actif: false, email, raison: 'ERP_PASSWORD manquant dans Vercel : l’espace propriétaire lit la base avec le compte d’équipe.' };
  }
  return { actif: true, email };
}

export async function lireAcces(b: BaseErp, proprietaireId: string): Promise<AccesProprietaire | undefined> {
  return (await b.lire<AccesProprietaire>(COLLECTION, [proprietaireId]))[0];
}

export async function ecrireAcces(b: BaseErp, a: AccesProprietaire): Promise<void> {
  await b.ecrire(COLLECTION, [a], 'espace-proprietaire');
}

export async function lireProprietaire(b: BaseErp, id: string): Promise<Proprietaire | undefined> {
  if (!proprietaireAutorise(id)) return undefined;
  return (await b.lire<Proprietaire>('proprietaires', [id]))[0];
}

/**
 * Données d'un propriétaire, dans la base de son espace, filtrées dès la
 * lecture : ses logements, leurs réservations et mandats (logement changé
 * de propriétaire : ses périodes seulement, donneesDuProprietaire), ses
 * documents, bilans, factures partagées et leurs relances, l'identité
 * légale de son espace (ligne imprimée en tête des bilans), et pour la carte
 * de l'accueil les ménages, incidents et contrôles de ses logements actuels
 * (réduits à l'état du jour par vueProprietaire). Rien d'autre ne sort d'ici.
 */
export async function entreesDuProprietaire(b: BaseErp, proprietaireId: string): Promise<EntreesProprietaire> {
  if (!proprietaireAutorise(proprietaireId)) {
    return { proprietaires: [], logements: [], reservations: [], mandats: [], documentsProprietaire: [], bilansProprietaire: [], factures: [], relancesPaiement: [] };
  }
  const [proprietaires, logements, reservations, mandats, documents, bilans, factures, relances, reglages, missions, incidents, controles] = await Promise.all([
    b.lire<Proprietaire>('proprietaires', [proprietaireId]),
    b.lire<Logement>('logements'),
    b.lire<Reservation>('reservations'),
    b.lire<Mandat>('mandats'),
    b.lire<DocumentProprietaire>('documentsProprietaire'),
    b.lire<BilanProprietaire>('bilansProprietaire'),
    b.lire<Facture>('factures'),
    b.lire<RelancePaiement>(COLLECTION_RELANCES).catch(() => []),
    b.lire<Reglage>('reglages', [ID_REGLAGE_SOCIETE]).catch(() => []),
    // Carte de l'accueil : sans ces collections, l'état du jour se lit sur les seuls séjours.
    b.lire<Mission>('missions').catch(() => []),
    b.lire<Incident>('incidents').catch(() => []),
    b.lire<ControleQualite>('controles').catch(() => []),
  ]);
  const siens = donneesDuProprietaire({ logements, reservations, mandats }, proprietaireId);
  // Ses logements actuels seulement (pas ceux qu'il a cédés) : ménages, incidents et contrôles du jour.
  const actuels = new Set(siens.logements.filter((l) => l.proprietaireId === proprietaireId).map((l) => l.id));
  const deSesLogements = <T extends { logementId?: string }>(x: readonly T[]): T[] => x.filter((y) => !!y && actuels.has(String(y.logementId)));
  return {
    proprietaires: proprietaires.filter((p) => p?.id === proprietaireId),
    logements: siens.logements,
    reservations: siens.reservations,
    mandats: siens.mandats,
    documentsProprietaire: documents.filter((d) => d?.proprietaireId === proprietaireId),
    bilansProprietaire: bilans.filter((x) => x?.proprietaireId === proprietaireId),
    factures: factures.filter((f) => facturePartagee(f, proprietaireId)),
    relancesPaiement: relances.filter((r) => r?.proprietaireId === proprietaireId && r.statut === 'envoyee'),
    reglages: reglages.filter((r) => r?.id === ID_REGLAGE_SOCIETE),
    missions: deSesLogements(missions),
    incidents: deSesLogements(incidents),
    controles: deSesLogements(controles),
  };
}

/** Signature des fichiers de l'espace de l'accès (jamais ceux d'un autre espace : signeurFichiersErp). */
const signeurDeLEspace = (espace: string) => signeurFichiersErp({ ...configuration(), espace: espaceDe(espace) });

/**
 * Photos de couverture affichables : adresse web telle quelle ; fichier de
 * l'équipe signé dans l'espace de l'accès (un fichier d'un autre espace :
 * rien).
 */
export async function photosSignees(logements: readonly Logement[], espace: string): Promise<Map<string, string>> {
  const signer = signeurDeLEspace(espace);
  const res = new Map<string, string>();
  await Promise.all(
    logements.map(async (l) => {
      const p = photoCouverture(l);
      if (!p) return;
      if (adresseWeb(p)) res.set(l.id, p);
      else if (p.startsWith('stockage://') && signer) {
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

/** Lien d'un document : adresse web telle quelle, fichier de l'espace de l'accès signé 2 minutes, sinon null. */
export async function lienDocument(fichier: string, espace: string): Promise<string | null> {
  if (/^https:\/\//.test(fichier)) return fichier;
  if (!fichier.startsWith('stockage://')) return null;
  const signer = signeurDeLEspace(espace);
  return signer ? signer(fichier, DUREE_DOCUMENT_S).catch(() => null) : null;
}

/** Documents déposés impossibles à ouvrir dans cet espace (compte serveur pas prêt…) : la raison, sinon null. */
export const documentsFermes = (espace: string): Promise<string | null> => stockageFerme({ ...configuration(), espace: espaceDe(espace) });

/**
 * Lien de connexion par e-mail, au nom de l'espace (« Label Maison »,
 * « Sens »…). Faux si l'envoi n'a pas pu se faire : le gérant copie alors
 * le lien affiché.
 */
export async function envoyerLien(o: { fiche: FicheEspace | undefined; email: string; nom: string; lien: string; motif: 'invitation' | 'connexion' }): Promise<boolean> {
  // Sans fiche d'espace, rien ne part (envoyerEmailEspace) : jamais au nom de Label Maison par défaut.
  const conciergerie = o.fiche?.nom || 'Votre conciergerie';
  const invitation = o.motif === 'invitation';
  const sujet = invitation ? `Votre espace propriétaire ${conciergerie}` : `Votre lien de connexion · ${conciergerie}`;
  const intro = invitation
    ? `${conciergerie} vous ouvre votre espace propriétaire : ${CONTENU_ESPACE.vous}, au même endroit.`
    : 'Voici votre lien pour ouvrir votre espace propriétaire.';
  const validite = invitation ? 'Ce lien est valable 7 jours et ne sert qu’une fois.' : 'Ce lien est valable 1 heure et ne sert qu’une fois.';
  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#fbfaf8;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1f1b16">
<div style="max-width:520px;margin:0 auto;padding:32px 20px">
<p style="font-family:Georgia,serif;font-size:22px;color:#4a3828;margin:0 0 20px">${echapperHtml(conciergerie)}</p>
<p style="font-size:15px;line-height:1.6;margin:0 0 12px">Bonjour ${echapperHtml(o.nom)},</p>
<p style="font-size:15px;line-height:1.6;margin:0 0 24px">${echapperHtml(intro)}</p>
<p style="margin:0 0 24px"><a href="${echapperHtml(o.lien)}" style="display:inline-block;background:#8a6a2f;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:10px">Ouvrir mon espace</a></p>
<p style="font-size:13px;line-height:1.6;color:#6b6258;margin:0 0 8px">${echapperHtml(validite)} Vous pourrez ensuite demander un nouveau lien avec votre adresse e-mail.</p>
<p style="font-size:13px;line-height:1.6;color:#6b6258;margin:0">Vous n’attendiez pas ce message ? Ignorez-le simplement.</p>
</div></body></html>`;
  const text = `Bonjour ${o.nom},\n\n${intro}\n\nOuvrir mon espace : ${o.lien}\n\n${validite}\n\n${conciergerie}`;
  return envoyerEmailEspace(o.fiche, { to: o.email, sujet, html, text });
}
