// =============================================================================
// Espace opérations — accès à la base pour api/espace-operations.ts.
//
// La personne de terrain ne lit jamais la base : tout passe ici, dans la base
// de l'espace de l'ERP qui l'a invitée (baseAcces(espace)), réduit à ses
// logements avant tout calcul (src/erp/data/espace-operations.ts). Liens,
// sessions et e-mails : api/_acces-externe.ts, communs avec les propriétaires.
// Un fichier préfixé par « _ » n'est pas exposé comme route par Vercel.
//
// Variables d'environnement (projet Vercel du site) :
//   OPERATIONS_SECRET ou ACCES_SECRET  signature des sessions (32 caractères
//                        au moins) — sans, l'espace opérations reste fermé
//   ERP_PASSWORD         compte d'équipe (lecture de la base, photos)
//   RESEND_API_KEY       envoi des liens par e-mail (sans : lien à copier)
// =============================================================================

import type { BaseErp } from '../src/erp/data/repull-synchro.js';
import { verifierMembre } from '../src/erp/data/repull-synchro.js';
import { espaceDe } from '../src/erp/data/acces-externe.js';
import { prefixeFichiers } from '../src/erp/data/espaces.js';
import { COLLECTIONS_OPS, type EntreesOperations, type Ecriture } from '../src/erp/data/espace-operations.js';
import { DOSSIER_OPERATIONS } from '../src/erp/data/operations-fichiers.js';
import { notificationUrgence, type GroupeNotification } from '../src/erp/data/notifications.js';
import { envoyerNotifications } from '../src/erp/data/notifications-envoi.js';
import type { Id, Incident, Logement, Mission, Reservation } from '../src/erp/data/types';
import type { AbsenceMembre, AccesOperations, AffectationLogement, ControleQualite, MembreEquipe, SignalementLogement } from '../src/erp/data/types-operations';
import { configuration, deposeurFichiersErp, signeurFichiersErp } from './_erp-repull.js';
import { espaceDemande, type FicheEspace } from './_erp-espaces.js';
import { clesServeur } from './_erp-notifications.js';
import { GENRES, envoyerEmailEspace, secretAcces } from './_acces-externe.js';
import { echapperHtml } from './_garde-formulaire.js';

/** Durée des liens signés des photos (affichées dans l'espace). */
const DUREE_PHOTO_S = 6 * 3600;
const AUTEUR = 'espace-operations';
const COLLECTION_ACCES = GENRES.operations.collection;

/** Espace ouvert ? Sinon, la raison à montrer au gérant. */
export function etatEspaceOps(): { actif: boolean; raison?: string; email: boolean } {
  const email = !!(process.env.RESEND_API_KEY || '').trim();
  if (!secretAcces('operations')) {
    return {
      actif: false,
      email,
      raison:
        'Espace opérations fermé : ajoutez ACCES_SECRET (ou OPERATIONS_SECRET) dans Vercel (Settings → Environment Variables, 32 caractères au moins, Production et Preview), puis redéployez.',
    };
  }
  if (!configuration().motDePasse) {
    return { actif: false, email, raison: 'ERP_PASSWORD manquant dans Vercel : l’espace opérations lit la base avec le compte d’équipe.' };
  }
  return { actif: true, email };
}

/** Gérant de l'ERP, dans l'espace de l'appel (en-tête x-erp-espace). */
export async function gerantDeLEspace(req: any): Promise<{ ok: true; email: string; espace: string } | { ok: false; statut: number; erreur: string }> {
  const entete = String(req.headers?.authorization || '');
  const jeton = /^Bearer\s+/i.test(entete) ? entete.replace(/^Bearer\s+/i, '').trim() : '';
  if (!jeton) return { ok: false, statut: 401, erreur: 'Authentification requise.' };
  const m = await verifierMembre(jeton, { espace: espaceDemande(req) });
  if (!m.ok) return m;
  if (m.role !== 'gerant') return { ok: false, statut: 403, erreur: 'Réservé au gérant.' };
  return { ok: true, email: m.email, espace: espaceDe(m.espace) };
}

export async function lireAccesOps(b: BaseErp, membreId: Id): Promise<AccesOperations | undefined> {
  return (await b.lire<AccesOperations>(COLLECTION_ACCES, [membreId]))[0];
}
export const ecrireAccesOps = (b: BaseErp, a: AccesOperations): Promise<void> => b.ecrire(COLLECTION_ACCES, [a], AUTEUR);

export async function lireMembre(b: BaseErp, id: Id): Promise<MembreEquipe | undefined> {
  if (!/^[\w-]{1,80}$/.test(id)) return undefined;
  return (await b.lire<MembreEquipe>('equipe', [id]))[0];
}

/** Ce que l'espace lit ; la réduction au périmètre se fait dans espace-operations.ts, avant tout calcul. */
export async function entreesOps(b: BaseErp): Promise<EntreesOperations> {
  const [logements, reservations, incidents, missions, equipe, affectations, absences, controles, signalementsLogement] = await Promise.all([
    b.lire<Logement>('logements'),
    b.lire<Reservation>('reservations'),
    b.lire<Incident>('incidents'),
    b.lire<Mission>('missions'),
    b.lire<MembreEquipe>('equipe'),
    b.lire<AffectationLogement>('affectations'),
    b.lire<AbsenceMembre>('absences'),
    b.lire<ControleQualite>('controles'),
    b.lire<SignalementLogement>('signalementsLogement'),
  ]);
  return { logements, reservations, incidents, missions, equipe, affectations, absences, controles, signalementsLogement };
}

/** Version actuelle des enregistrements qu'une action va réécrire (clé « collection/id »). */
export async function relireOps(b: BaseErp, ecritures: readonly Ecriture[]): Promise<Map<string, { id: Id } & object>> {
  const relus = new Map<string, { id: Id } & object>();
  for (const collection of COLLECTIONS_OPS) {
    const ids = [...new Set(ecritures.filter((x) => x.collection === collection).map((x) => x.element.id))];
    if (!ids.length) continue;
    for (const element of await b.lire<{ id: Id } & object>(collection, ids)) relus.set(`${collection}/${element.id}`, element);
  }
  return relus;
}

/** Écrit ce qu'une action a produit : collections opérations seulement, regroupées. */
export async function ecrireOps(b: BaseErp, ecritures: readonly Ecriture[]): Promise<void> {
  for (const collection of COLLECTIONS_OPS) {
    const elements = ecritures.filter((x) => x.collection === collection).map((x) => x.element);
    if (elements.length) await b.ecrire(collection, elements, AUTEUR);
  }
}

/** Photos affichables : adresse web telle quelle, fichier de l'équipe signé (Label Maison pour l'instant), sinon rien. */
export async function signeurPhotos(espace: string, urls: readonly string[]): Promise<(u: string) => string | undefined> {
  const signer = signeurFichiersErp({ ...configuration(), espace });
  const liens = new Map<string, string>();
  await Promise.all(
    [...new Set(urls)].filter((u) => u.startsWith('stockage://')).map(async (u) => {
      const l = signer ? await signer(u, DUREE_PHOTO_S).catch(() => null) : null;
      if (l) liens.set(u, l);
    }),
  );
  return (u) => (/^https:\/\//.test(u) ? u : liens.get(u));
}

/** Dossier de stockage des photos d'un espace (« operations/… », sous le dossier de l'espace hors Label Maison). */
export const prefixePhotos = (espace: string): string => prefixeFichiers(espace);

/** Dépose une photo prise dans l'espace ; null si impossible (autre espace que Label Maison pour l'instant). */
export async function deposerPhoto(espace: string, membreId: Id, octets: Uint8Array, type: string, extension: string): Promise<string | null> {
  const deposer = deposeurFichiersErp({ ...configuration(), espace });
  if (!deposer) return null;
  const nom = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
  return deposer(`${prefixePhotos(espace)}${DOSSIER_OPERATIONS}/${membreId}/${nom}`, octets, type);
}

/** Prévient le gérant (notification « Urgence » de l'app de l'ERP) ; sans clés, rien. */
export async function prevenirGerant(b: BaseErp, e: EntreesOperations, ids: readonly Id[]): Promise<void> {
  const cles = clesServeur();
  if (!cles || !ids.length) return;
  const groupes = ids
    .map((id) => e.incidents.find((i) => i.id === id))
    .filter((i): i is Incident => !!i)
    .map((i) => notificationUrgence(i, e.logements.find((l) => l.id === i.logementId)?.nom ?? '', e.equipe.find((m) => m.id === i.assigneA)?.nom))
    .filter((g): g is GroupeNotification => !!g);
  if (groupes.length) await envoyerNotifications(b, groupes, { cles }).catch((err) => console.error('[espace-operations] notification', err instanceof Error ? err.message : err));
}

/** Lien de connexion par e-mail, au nom de l'espace. Faux : le gérant copie le lien affiché. */
export function envoyerLienOps(fiche: FicheEspace | undefined, o: { email: string; nom: string; lien: string; motif: 'invitation' | 'connexion' }): Promise<boolean> {
  const conciergerie = fiche?.nom || 'Label Maison';
  const invitation = o.motif === 'invitation';
  const sujet = invitation ? `Votre espace opérations · ${conciergerie}` : `Votre lien de connexion · ${conciergerie}`;
  const intro = invitation
    ? `${conciergerie} vous ouvre votre espace opérations : vos logements, le programme du jour, les incidents et les contrôles qualité, au même endroit, sur votre téléphone.`
    : 'Voici votre lien pour ouvrir votre espace opérations.';
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
  return envoyerEmailEspace(fiche, { to: o.email, sujet, html, text });
}
