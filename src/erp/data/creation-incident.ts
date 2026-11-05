/**
 * Signaler un incident, pas à pas (modules/incidents/_composants/NouvelIncident.tsx) :
 * le logement, la date du constat (et le séjour concerné), le type et
 * l'urgence, ce qui s'est passé, les preuves, qui paiera, qui suit, puis le
 * récapitulatif.
 *
 * Mêmes règles et même incident que l'ancien formulaire (creerIncident du
 * store : statut « ouvert », trace d'historique « Incident créé ») : un
 * logement, une description de 10 caractères au moins, des preuves en
 * adresses (https://, ou les fichiers joints), un coût lisible en euros.
 * La date du constat est demandée, jamais dans le futur.
 *
 * Ni React ni réseau (verifier-assistants.ts).
 */
import { LIBELLES } from './libelles';
import { dateCourte, dateJour, euros, pluriel, versCentimes } from './format';
import type { NouvelIncident } from './store';
import type { CategorieIncident, DateISO, GraviteIncident, Id, Logement, Refacturable, Reservation } from './types';

export const ECRANS_INCIDENT = ['logement', 'quand', 'nature', 'description', 'preuves', 'cout', 'suivi', 'recapitulatif'] as const;
export type EcranIncident = (typeof ECRANS_INCIDENT)[number];

export interface BrouillonIncident {
  logementId: Id;
  reservationId: Id;
  date: DateISO | '';
  categorie: CategorieIncident;
  gravite: GraviteIncident;
  description: string;
  /** Nom de la personne qui suit ; vide : personne pour l'instant. */
  responsable: string;
  /** Adresses des preuves, une par ligne (fichiers joints compris). */
  preuves: string;
  refacturable: Refacturable;
  /** Coût estimé en euros, tel que tapé ; vide : inconnu. */
  cout: string;
}

/** Valeurs de départ de l'ancien formulaire : constat du jour, ménage, gravité normale, non refacturé. */
export const brouillonIncident = (aujourdhui: DateISO): BrouillonIncident => ({
  logementId: '',
  reservationId: '',
  date: aujourdhui,
  categorie: 'menage',
  gravite: 'moyenne',
  description: '',
  responsable: '',
  preuves: '',
  refacturable: 'aucun',
  cout: '',
});

/** Séjours proposés : ceux du logement, non annulés, arrivés au plus tard le jour du constat ; les 6 plus récents. */
export function sejoursConcernes(reservations: readonly Reservation[], b: Pick<BrouillonIncident, 'logementId' | 'date'>): Reservation[] {
  return reservations
    .filter((r) => r.logementId === b.logementId && r.statut !== 'annulee' && !!b.date && r.arrivee <= b.date)
    .sort((a, c) => c.arrivee.localeCompare(a.arrivee))
    .slice(0, 6);
}

/** Adresses des preuves (espaces et retours à la ligne séparent). */
export const listePreuves = (preuves: string): string[] => preuves.split(/\s+/).map((u) => u.trim()).filter(Boolean);

const PREUVE = /^(https?:\/\/|demo:\/\/|stockage:\/\/)/;

/** Erreurs sans champ à elles (choix) : dites au-dessus de « Continuer ». */
export const SANS_CHAMP_INCIDENT = new Set(['logementId']);

export interface ContexteIncident {
  logements: readonly Pick<Logement, 'id'>[];
  aujourdhui: DateISO;
}

/** Erreurs d'un écran, par champ ; le récapitulatif réunit celles de tous les écrans. */
export function erreursIncident(ecran: EcranIncident, b: BrouillonIncident, ctx: ContexteIncident): Record<string, string> {
  if (ecran === 'recapitulatif') {
    return Object.assign({}, ...ECRANS_INCIDENT.filter((e) => e !== 'recapitulatif').map((e) => erreursIncident(e, b, ctx)));
  }
  const r: Record<string, string> = {};
  if (ecran === 'logement' && !ctx.logements.some((l) => l.id === b.logementId)) r.logementId = 'Choisissez le logement.';
  if (ecran === 'quand') {
    if (!b.date) r.date = 'Indiquez la date du constat.';
    else if (b.date > ctx.aujourdhui) r.date = 'La date du constat ne peut pas être dans le futur.';
  }
  if (ecran === 'description') {
    if (!b.description.trim()) r.description = 'Décrivez ce qui s’est passé.';
    else if (b.description.trim().length < 10) r.description = 'Décrivez l’incident (10 caractères minimum).';
  }
  if (ecran === 'preuves' && listePreuves(b.preuves).some((u) => !PREUVE.test(u))) r.preuves = 'Chaque preuve doit être une adresse commençant par https://';
  if (ecran === 'cout' && b.cout.trim()) {
    const c = versCentimes(b.cout);
    if (Number.isNaN(c) || c < 0) r.cout = 'Montant invalide.';
  }
  return r;
}

const ECRAN_DE_LA_CLE: Record<string, EcranIncident> = { logementId: 'logement', date: 'quand', description: 'description', preuves: 'preuves', cout: 'cout' };
export const ecranDeLaCleIncident = (cle: string): EcranIncident => ECRAN_DE_LA_CLE[cle] ?? 'recapitulatif';

export type ResultatIncident = { ok: true; incident: NouvelIncident } | { ok: false; ecran: EcranIncident; erreur: string };

/** Ce que « Créer l'incident » transmet à creerIncident : le même objet que l'ancien formulaire. */
export function incidentDepuisBrouillon(b: BrouillonIncident, ctx: ContexteIncident): ResultatIncident {
  const erreurs = Object.entries(erreursIncident('recapitulatif', b, ctx));
  if (erreurs.length || !b.date) {
    const [cle, erreur] = erreurs[0] ?? ['date', 'Indiquez la date du constat.'];
    return { ok: false, ecran: ecranDeLaCleIncident(cle), erreur };
  }
  return {
    ok: true,
    incident: {
      logementId: b.logementId,
      reservationId: b.reservationId || undefined,
      date: b.date,
      categorie: b.categorie,
      gravite: b.gravite,
      description: b.description.trim(),
      responsable: b.responsable || undefined,
      preuves: listePreuves(b.preuves),
      refacturable: b.refacturable,
      coutCentimes: b.cout.trim() ? versCentimes(b.cout) : undefined,
    },
  };
}

/** Lignes du récapitulatif. */
export function recapIncident(
  b: BrouillonIncident,
  o: { logements: readonly Pick<Logement, 'id' | 'nom'>[]; reservations: readonly Reservation[] },
): { cle: string; ecran: Exclude<EcranIncident, 'recapitulatif'>; libelle: string; valeur: string }[] {
  const sejour = o.reservations.find((r) => r.id === b.reservationId);
  const preuves = listePreuves(b.preuves).length;
  const cout = b.cout.trim() ? versCentimes(b.cout) : undefined;
  return [
    { cle: 'logement', ecran: 'logement', libelle: 'Logement', valeur: o.logements.find((l) => l.id === b.logementId)?.nom ?? '' },
    {
      cle: 'quand',
      ecran: 'quand',
      libelle: 'Constaté le',
      valeur: b.date ? [dateJour(b.date), sejour ? `séjour de ${sejour.voyageur.nom} (${dateCourte(sejour.arrivee)} au ${dateCourte(sejour.depart)})` : ''].filter(Boolean).join(', ') : '',
    },
    { cle: 'nature', ecran: 'nature', libelle: 'Type', valeur: `${LIBELLES.categorieIncident[b.categorie]} · ${LIBELLES.gravite[b.gravite]}` },
    { cle: 'description', ecran: 'description', libelle: 'Ce qui s’est passé', valeur: b.description.trim() },
    { cle: 'preuves', ecran: 'preuves', libelle: 'Preuves', valeur: preuves ? pluriel(preuves, 'preuve') : 'Aucune pour l’instant' },
    {
      cle: 'cout',
      ecran: 'cout',
      libelle: 'Coût',
      valeur: [cout !== undefined && Number.isFinite(cout) ? `${euros(cout)} estimés` : 'Coût inconnu', b.refacturable === 'aucun' ? 'non refacturé' : `refacturé au ${LIBELLES.refacturable[b.refacturable].toLocaleLowerCase('fr')}`].join(', '),
    },
    { cle: 'suivi', ecran: 'suivi', libelle: 'Suivi', valeur: b.responsable || 'Personne pour l’instant' },
  ];
}
