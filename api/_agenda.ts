// =============================================================================
// Liens d'abonnement à l'agenda des relances du CRM (/api/crm-agenda/<clé>).
//
// Un calendrier abonné (Calendrier d'Apple, Google Agenda, Outlook) ne sait
// pas se connecter : la clé est dans l'adresse. Clé aléatoire de 256 bits ;
// la base (collection technique `connecteurs`, réservée aux gérants) n'en
// garde que l'EMPREINTE SHA-256. Le lien n'est donc montré qu'à sa création ;
// « Couper les liens » les révoque tous.
//
// Un fichier préfixé par « _ » n'est pas exposé comme route par Vercel.
// =============================================================================

import crypto from 'node:crypto';
import type { FiltreAgenda } from '../src/erp/data/agenda-crm.js';
import type { BaseErp } from '../src/erp/data/repull-synchro.js';

const COLLECTION = 'connecteurs';
const AUTEUR = 'ERP';
const HOTE = 'www.labelmaisoncg.fr';

interface LienAgenda {
  id: string;
  type: 'agenda';
  filtre: FiltreAgenda;
  par: string;
  creeLe: string;
  revoque?: boolean;
}

const idLien = (cle: string) => `agenda-${crypto.createHash('sha256').update(cle).digest('hex')}`;

export const FILTRES: FiltreAgenda[] = ['tous', 'abdel', 'kamel'];

export const adressesAgenda = (cle: string) => ({
  /** Ouvre directement « S'abonner » dans Calendrier (iPhone, Mac). */
  webcal: `webcal://${HOTE}/api/crm-agenda/${cle}`,
  /** Pour Google Agenda ou Outlook (« À partir de l'URL »). */
  https: `https://${HOTE}/api/crm-agenda/${cle}`,
});

export async function creerLienAgenda(base: BaseErp, filtre: FiltreAgenda, par: string): Promise<string> {
  const cle = crypto.randomBytes(32).toString('base64url');
  const lien: LienAgenda = { id: idLien(cle), type: 'agenda', filtre, par, creeLe: new Date().toISOString() };
  await base.ecrire(COLLECTION, [lien], AUTEUR);
  return cle;
}

// Liens gardés 1 min par instance (valides comme refusés) : un agenda qui se
// recharge ne relit pas la base à chaque fois ; une coupure prend effet en 1 min.
const cache = new Map<string, { lien: LienAgenda | null; jusqua: number }>();

export async function lienAgendaValide(base: BaseErp, cle: string): Promise<LienAgenda | null> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(cle)) return null;
  const id = idLien(cle);
  const enCache = cache.get(id);
  if (enCache && enCache.jusqua > Date.now()) return enCache.lien;
  const [lu] = await base.lire<LienAgenda>(COLLECTION, [id]);
  const lien = lu && lu.type === 'agenda' && !lu.revoque && FILTRES.includes(lu.filtre) ? lu : null;
  if (cache.size > 500) cache.clear();
  cache.set(id, { lien, jusqua: Date.now() + 60_000 });
  return lien;
}

async function liensActifs(base: BaseErp): Promise<LienAgenda[]> {
  const tous = await base.lire<Partial<LienAgenda> & { id: string }>(COLLECTION);
  return tous.filter((l): l is LienAgenda => l.type === 'agenda' && !l.revoque);
}

export async function etatAgenda(base: BaseErp): Promise<{ liens: number }> {
  return { liens: (await liensActifs(base)).length };
}

/** « Couper tous les liens » : chaque agenda abonné cesse de se mettre à jour. */
export async function couperLiensAgenda(base: BaseErp): Promise<void> {
  const actifs = await liensActifs(base);
  if (actifs.length) await base.ecrire(COLLECTION, actifs.map((l) => ({ ...l, revoque: true })), AUTEUR);
  cache.clear();
}
