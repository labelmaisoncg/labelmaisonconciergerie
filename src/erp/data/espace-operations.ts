/**
 * Espace opérations : ce que voit une personne de l'équipe de terrain et ce
 * qu'elle peut faire. Pur (ni réseau ni écran) : le serveur
 * (api/espace-operations.ts) lit la base, appelle `vueOperations` ou
 * `appliquerAction`, puis écrit les `ecritures` rendues ; la démo fait de
 * même sur le jeu de démonstration.
 *
 * Règles :
 * - périmètre strict : seuls les logements que le gérant a confiés à la
 *   personne (MembreEquipe.logementIds), encore gérés ; rien d'autre n'entre
 *   dans la vue ni n'est accepté dans une action ;
 * - voyageurs : « Prénom N. », nombre de personnes, dates ; jamais de
 *   contact, de montant ni d'avis. Les consignes d'accès d'un logement ne
 *   sont montrées que le jour où la personne y a quelque chose à faire ;
 * - responsable de pôle : tout son périmètre (urgences, incidents, contrôles,
 *   équipe, remplacements) ; il confie, priorise et clôt. Agent de terrain :
 *   les incidents qui lui sont confiés ou qu'il a signalés, les contrôles de
 *   ses logements ; il signale et remplit les contrôles ;
 * - écritures limitées aux collections opérations (incidents, contrôles,
 *   absences, affectations, signalements) ; jamais de prix, calendrier,
 *   disponibilité ni annonce, et rien vers les plateformes.
 *
 * Imports en « .js » : ce module tourne aussi sous Node (fonctions Vercel).
 */
import {
  absenceLe,
  ajouterJours,
  assigneLe,
  controlesAFaire,
  court,
  estUrgent,
  graviteDe,
  historiqueControles,
  incidentDepuisPoint,
  pointsDuLogement,
  programmeDuJour,
  responsableLe,
  trierIncidents,
  verifierAbsence,
  verifierControle,
  type DonneesOps,
} from './operations.js';
import type { CategorieIncident, DateISO, Horodatage, Id, Incident, Logement } from './types';
import type {
  AbsenceMembre,
  AffectationLogement,
  ControleQualite,
  ControleOps,
  IncidentOps,
  LogementOps,
  MembreEquipe,
  MembreOps,
  PointControle,
  SejourOps,
  SignalementLogement,
  VueOperations,
} from './types-operations';

export interface EntreesOperations extends DonneesOps {
  signalementsLogement: SignalementLogement[];
}

/** Ce que l'espace a le droit d'écrire. */
export type CollectionOps = 'incidents' | 'controles' | 'absences' | 'affectations' | 'signalementsLogement';
export const COLLECTIONS_OPS: readonly CollectionOps[] = ['incidents', 'controles', 'absences', 'affectations', 'signalementsLogement'];

/** Un enregistrement à écrire (ajout ou remplacement : rien ne se supprime, une absence annulée reste notée). */
export interface Ecriture {
  collection: CollectionOps;
  element: { id: Id } & object;
}

const CATEGORIES: CategorieIncident[] = ['menage', 'linge', 'casse', 'panne', 'acces', 'voyageur', 'autre'];
const PHOTOS_MAX = 6;
/** Séjours montrés : des 2 derniers jours aux 14 prochains. */
const SEJOURS_AVANT = 2;
const SEJOURS_APRES = 14;

const texte = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const idValide = (v: unknown): v is Id => typeof v === 'string' && /^[\w-]{1,80}$/.test(v);

/* --------------------------------------------------------------- périmètre */

/** La personne connectée, si elle fait encore partie de l'équipe. */
export const membreConnecte = (e: Pick<EntreesOperations, 'equipe'>, membreId: Id): MembreEquipe | undefined =>
  e.equipe.find((m) => m?.id === membreId && m.actif);

/** Logements visibles : confiés par le gérant et encore gérés. */
export function perimetre(e: Pick<EntreesOperations, 'equipe' | 'logements'>, membreId: Id): Set<Id> {
  const m = membreConnecte(e, membreId);
  if (!m) return new Set();
  const confies = new Set(Array.isArray(m.logementIds) ? m.logementIds : []);
  return new Set(e.logements.filter((l) => l && confies.has(l.id) && l.statut !== 'sorti').map((l) => l.id));
}

/**
 * Entrées réduites au périmètre de la personne (le serveur les réduit avant
 * tout calcul) : ses logements, leurs séjours, incidents, contrôles et
 * affectations ; l'équipe limitée aux personnes qui partagent un de ses
 * logements, sans adresse e-mail et sans leurs autres logements.
 */
export function restreindre(e: EntreesOperations, membreId: Id): EntreesOperations {
  const ids = perimetre(e, membreId);
  const dans = (id?: Id) => !!id && ids.has(id);
  const equipe = e.equipe
    .filter((m) => m?.actif && (m.id === membreId || (m.logementIds ?? []).some((l) => ids.has(l))))
    .map((m) => ({ id: m.id, nom: m.nom, role: m.role, actif: true, logementIds: (m.logementIds ?? []).filter((l) => ids.has(l)), ...(m.telephone ? { telephone: m.telephone } : {}) }));
  const membres = new Set(equipe.map((m) => m.id));
  return {
    logements: e.logements.filter((l) => dans(l?.id)),
    reservations: e.reservations.filter((r) => dans(r?.logementId)),
    incidents: e.incidents.filter((i) => dans(i?.logementId)),
    missions: e.missions.filter((m) => dans(m?.logementId)),
    controles: e.controles.filter((c) => dans(c?.logementId)),
    affectations: e.affectations.filter((a) => dans(a?.id)),
    absences: e.absences.filter((a) => membres.has(a?.membreId)),
    equipe,
    signalementsLogement: e.signalementsLogement.filter((s) => dans(s?.logementId) && s.membreId === membreId),
  };
}

/* -------------------------------------------------------------------- vue */

export interface OptionsVueOps {
  aujourdhui: DateISO;
  /** Nom de la conciergerie (espace qui a invité) ; Label Maison par défaut. */
  conciergerie?: string;
  /** Adresse affichable d'une photo (lien signé côté serveur) ; sans : telle quelle. */
  photo?: (url: string) => string | undefined;
}

const sejourOps = (r: EntreesOperations['reservations'][number], l?: Logement): SejourOps => ({
  id: r.id,
  logementId: r.logementId,
  arrivee: r.arrivee,
  depart: r.depart,
  voyageur: court(r.voyageur?.nom) || 'Voyageur',
  nbPersonnes: Math.max(0, Math.round(Number(r.voyageur?.nbPersonnes) || 0)),
  canal: r.canal,
  ...(l?.fiche?.heureArrivee ? { heureArrivee: l.fiche.heureArrivee } : {}),
  ...(l?.fiche?.heureDepart ? { heureDepart: l.fiche.heureDepart } : {}),
});

/** Incidents que la personne voit : tout son périmètre (pôle), ou ceux qui la concernent (agent). */
function incidentsVisibles(e: EntreesOperations, moi: MembreEquipe, aujourdhui: DateISO): Incident[] {
  if (moi.role === 'pole') return e.incidents;
  return e.incidents.filter((i) => i.signalePar === moi.id || i.assigneA === moi.id || assigneLe(e, i, aujourdhui).membreId === moi.id);
}

/**
 * Tout ce que voit la personne. `null` : pas (ou plus) dans l'équipe. Rien
 * d'un logement hors de son périmètre n'y entre, quelles que soient les
 * entrées (le serveur les réduit aussi avant).
 */
export function vueOperations(brutes: EntreesOperations, membreId: Id, o: OptionsVueOps): VueOperations | null {
  const moi = membreConnecte(brutes, membreId);
  if (!moi) return null;
  const e = restreindre(brutes, membreId);
  const { aujourdhui } = o;
  const pole = moi.role === 'pole';
  const nomDe = (id?: Id) => e.equipe.find((m) => m.id === id)?.nom;
  const photo = (u: string) => (o.photo ? o.photo(u) : u);
  const photos = (liste: unknown) => (Array.isArray(liste) ? liste : []).map((u) => photo(String(u))).filter((u): u is string => !!u);

  const incidents = trierIncidents(incidentsVisibles(e, moi, aujourdhui));
  const aFaire = controlesAFaire(e, aujourdhui);
  const programme = programmeDuJour(e, aujourdhui);

  // Consignes d'accès : seulement là où la personne a quelque chose à faire aujourd'hui.
  const aujourdhuiLa = new Set<Id>([
    ...programme.map((p) => p.logementId),
    ...aFaire.filter((c) => c.echeance <= aujourdhui).map((c) => c.logementId),
    ...incidents.filter((i) => i.statut !== 'resolu' && assigneLe(e, i, aujourdhui).membreId === moi.id).map((i) => i.logementId),
  ]);
  const signales = new Set(e.signalementsLogement.filter((s) => s.statut === 'ouvert').map((s) => s.logementId));

  const logements: LogementOps[] = e.logements
    .slice()
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
    .map((l) => {
      const suivi = responsableLe(e, l.id, aujourdhui);
      const couverture = (l.photosEquipe ?? [])[0] ?? (l.photos ?? [])[0] ?? l.photoUrl;
      const acces = aujourdhuiLa.has(l.id) ? texte(l.fiche?.acces, 1500) : '';
      return {
        id: l.id,
        nom: l.nom,
        ville: l.ville,
        ...(couverture && photo(couverture) ? { photo: photo(couverture) } : {}),
        ...(suivi.membreId ? { suiviPar: nomDe(suivi.membreId) } : {}),
        ...(signales.has(l.id) ? { signale: true } : {}),
        ...(acces ? { acces } : {}),
      };
    });

  const debut = ajouterJours(aujourdhui, -SEJOURS_AVANT);
  const fin = ajouterJours(aujourdhui, SEJOURS_APRES);
  const sejours = e.reservations
    .filter((r) => r.statut !== 'annulee' && r.depart >= debut && r.arrivee <= fin)
    .sort((a, b) => a.arrivee.localeCompare(b.arrivee))
    .map((r) => sejourOps(r, e.logements.find((l) => l.id === r.logementId)));

  const incidentsOps: IncidentOps[] = incidents.map((i) => {
    const s = assigneLe(e, i, aujourdhui);
    return {
      id: i.id,
      logementId: i.logementId,
      ...(i.reservationId ? { reservationId: i.reservationId } : {}),
      date: i.date,
      categorie: i.categorie,
      urgent: estUrgent(i),
      description: i.description,
      statut: i.statut,
      ...(i.assigneA ? { assigneA: i.assigneA } : {}),
      ...(s.membreId ? { suiviPar: s.membreId } : {}),
      ...(s.remplace ? { remplace: s.remplace } : {}),
      photos: photos(i.preuves),
      historique: (i.historique ?? []).map((h) => ({ le: h.le, par: h.par, texte: h.texte })),
      ...(i.resoluLe ? { resoluLe: i.resoluLe } : {}),
      ...(i.controleId ? { controleId: i.controleId } : {}),
    };
  });

  const avecPhotos = (c: ControleQualite): ControleQualite => ({
    ...c,
    points: c.points.map((p) => {
      const u = p.photo ? photo(p.photo) : undefined;
      const { photo: _p, ...reste } = p;
      return u ? { ...reste, photo: u } : reste;
    }),
  });
  const controles: ControleOps[] = aFaire.map((c) => ({
    cle: c.cle,
    ...(c.controle ? { controle: avecPhotos(c.controle) } : {}),
    logementId: c.logementId,
    ...(c.reservationId ? { reservationId: c.reservationId } : {}),
    echeance: c.echeance,
    enRetard: c.enRetard,
    points: c.controle ? c.controle.points.map((p) => p.libelle) : pointsDuLogement(e, c.logementId),
  }));

  const equipe: MembreOps[] = pole
    ? e.equipe
        .map((m) => {
          const a = e.absences.filter((x) => !x.annuleeLe && x.membreId === m.id && x.au >= aujourdhui).sort((x, y) => x.du.localeCompare(y.du))[0];
          return { id: m.id, nom: m.nom, role: m.role, logementIds: m.logementIds, ...(m.telephone ? { telephone: m.telephone } : {}), ...(a ? { absence: { du: a.du, au: a.au } } : {}) };
        })
        .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
    : e.equipe.filter((m) => m.id === moi.id).map((m) => ({ id: m.id, nom: m.nom, role: m.role, logementIds: m.logementIds }));

  return {
    moi: { id: moi.id, nom: moi.nom, role: moi.role },
    conciergerie: { nom: o.conciergerie || 'Label Maison' },
    aujourdhui,
    logements,
    sejours,
    incidents: incidentsOps,
    controles,
    historiqueControles: historiqueControles(e.controles).slice(0, 30).map(avecPhotos),
    programme: programme.map((p) => ({
      cle: p.cle,
      type: p.type,
      ...(p.heure ? { heure: p.heure } : {}),
      logementId: p.logementId,
      ...(p.reservationId ? { reservationId: p.reservationId } : {}),
      ...(p.controle ? { controleCle: p.controle.cle } : {}),
    })),
    equipe,
    absences: pole ? e.absences.filter((a) => !a.annuleeLe && a.au >= aujourdhui).sort((a, b) => a.du.localeCompare(b.du)) : [],
    affectations: pole ? e.affectations : [],
  };
}

/* ---------------------------------------------------------------- actions */

/** Un point tel que saisi : absent = inchangé (photo : '' pour la retirer). */
export interface PointSaisi {
  id: string;
  etat?: 'ok' | 'a_revoir';
  commentaire?: string;
  photo?: string;
}

export type ActionOperations =
  | { type: 'signaler'; logementId: Id; description: string; urgent: boolean; reservationId?: Id; categorie?: CategorieIncident; photos?: string[] }
  | { type: 'pas-a-moi'; logementId: Id; motif?: string }
  | { type: 'prendre'; incidentId: Id }
  | { type: 'noter'; incidentId: Id; texte?: string; photos?: string[] }
  | { type: 'assigner'; incidentId: Id; membreId?: Id }
  | { type: 'priorite'; incidentId: Id; urgent: boolean }
  | { type: 'resoudre'; incidentId: Id; texte?: string }
  | { type: 'rouvrir'; incidentId: Id }
  | {
      type: 'controle';
      /** Clé de ControleOps (contrôle enregistré ou proposé après un départ). */
      cle: string;
      points: PointSaisi[];
      note?: number;
      commentaire?: string;
      terminer: boolean;
      /** Points « à revoir » pour lesquels créer un incident. */
      incidentsPour?: string[];
    }
  | { type: 'absence'; id?: Id; membreId: Id; du: DateISO; au: DateISO; remplacantId?: Id; motif?: string }
  | { type: 'absence-annuler'; id: Id }
  | { type: 'affectation'; logementId: Id; responsableId?: Id; remplacantId?: Id; pointsControle?: string[] };

export interface ContexteAction {
  aujourdhui: DateISO;
  maintenant: Horodatage;
  nouvelId: (prefixe: string) => Id;
  /** Adresse de photo acceptée (déposée par l'espace) ; sans : toutes refusées. */
  photoAcceptee?: (url: string) => boolean;
}

export type ResultatAction =
  | { ok: true; ecritures: Ecriture[]; message: string; id?: Id; aNotifier: Id[] }
  | { ok: false; statut: number; erreur: string };

const refus = (erreur: string, statut = 400): ResultatAction => ({ ok: false, statut, erreur });
const POLE_SEUL = 'Réservé au responsable de pôle.';

/** Ajoute une ligne à l'historique d'un incident. */
const historiser = (i: Incident, le: Horodatage, par: string, t: string): Incident => ({ ...i, historique: [...(i.historique ?? []), { le, par, texte: t }] });

/**
 * Applique une action de la personne connectée, dans son périmètre. Rend les
 * enregistrements à écrire (collections opérations seulement) ou un refus.
 */
export function appliquerAction(brutes: EntreesOperations, membreId: Id, action: ActionOperations, ctx: ContexteAction): ResultatAction {
  const moi = membreConnecte(brutes, membreId);
  if (!moi) return refus('Votre accès n’est plus actif. Contactez Label Maison.', 403);
  const e = restreindre(brutes, membreId);
  const ids = new Set(e.logements.map((l) => l.id));
  const pole = moi.role === 'pole';
  const { aujourdhui, maintenant } = ctx;
  const photosAction = (liste: unknown): string[] | null => {
    const l = (Array.isArray(liste) ? liste : []).map(String);
    if (l.length > PHOTOS_MAX) return null;
    return l.every((u) => ctx.photoAcceptee?.(u)) ? l : null;
  };
  const membreDuLogement = (id: Id | undefined, logementId: Id) => !!id && e.equipe.some((m) => m.id === id && m.logementIds.includes(logementId));
  const nomLogement = (id: Id) => e.logements.find((l) => l.id === id)?.nom ?? 'le logement';
  const titulaire = (logementId: Id) => {
    const r = responsableLe(e, logementId, aujourdhui).membreId ?? e.affectations.find((a) => a.id === logementId)?.responsableId;
    return r && membreDuLogement(r, logementId) ? r : undefined;
  };
  const incidentVu = (id: unknown): Incident | undefined => {
    if (!idValide(id)) return undefined;
    const i = e.incidents.find((x) => x.id === id);
    if (!i) return undefined;
    return incidentsVisibles(e, moi, aujourdhui).some((x) => x.id === i.id) ? i : undefined;
  };
  const ok = (ecritures: Ecriture[], message: string, extra: { id?: Id; aNotifier?: Id[] } = {}): ResultatAction => ({ ok: true, ecritures, message, aNotifier: extra.aNotifier ?? [], ...(extra.id ? { id: extra.id } : {}) });

  switch (action?.type) {
    case 'signaler': {
      if (!idValide(action.logementId) || !ids.has(action.logementId)) return refus('Ce logement ne fait pas partie des vôtres.', 403);
      const description = texte(action.description, 2000);
      if (description.length < 10) return refus('Décrivez ce qui se passe (10 caractères au moins).');
      const photos = photosAction(action.photos);
      if (!photos) return refus('Photos refusées : ajoutez-les depuis cet écran, 6 au plus.');
      const reservationId = idValide(action.reservationId) && e.reservations.some((r) => r.id === action.reservationId && r.logementId === action.logementId) ? action.reservationId : undefined;
      const assigneA = titulaire(action.logementId);
      const nom = e.equipe.find((m) => m.id === assigneA)?.nom;
      const incident: Incident = {
        id: ctx.nouvelId('inc'),
        logementId: action.logementId,
        ...(reservationId ? { reservationId } : {}),
        date: aujourdhui,
        categorie: CATEGORIES.includes(action.categorie as CategorieIncident) ? (action.categorie as CategorieIncident) : 'autre',
        gravite: graviteDe(action.urgent ? 'urgente' : 'normale'),
        description,
        statut: 'ouvert',
        refacturable: 'aucun',
        preuves: photos,
        signalePar: moi.id,
        ...(assigneA ? { assigneA, responsable: nom } : {}),
        historique: [
          { le: maintenant, par: moi.nom, texte: 'Signalé depuis l’espace opérations.' },
          ...(assigneA ? [{ le: maintenant, par: moi.nom, texte: `Confié à ${court(nom)}.` }] : []),
        ],
      };
      return ok([{ collection: 'incidents', element: incident }], action.urgent ? 'Urgence signalée : l’équipe est prévenue.' : 'Incident signalé.', {
        id: incident.id,
        aNotifier: action.urgent || assigneA ? [incident.id] : [],
      });
    }

    case 'pas-a-moi': {
      if (!idValide(action.logementId) || !ids.has(action.logementId)) return refus('Ce logement ne fait pas partie des vôtres.', 403);
      if (e.signalementsLogement.some((s) => s.logementId === action.logementId && s.statut === 'ouvert')) return ok([], 'Déjà signalé : le gérant va regarder.');
      const s: SignalementLogement = { id: ctx.nouvelId('sig'), logementId: action.logementId, membreId: moi.id, le: maintenant, statut: 'ouvert', ...(texte(action.motif, 500) ? { motif: texte(action.motif, 500) } : {}) };
      return ok([{ collection: 'signalementsLogement', element: s }], `C’est noté : le gérant sait que ${nomLogement(action.logementId)} n’est pas à vous. Le logement reste ici jusqu’à sa réponse.`, { id: s.id });
    }

    case 'prendre':
    case 'noter':
    case 'assigner':
    case 'priorite':
    case 'resoudre':
    case 'rouvrir': {
      const i = incidentVu(action.incidentId);
      if (!i) return refus('Incident introuvable.', 404);
      let suivant = i;
      let message = '';
      const aNotifier: Id[] = [];
      if (action.type === 'prendre') {
        if (i.statut !== 'ouvert') return refus('Cet incident est déjà pris en charge.');
        suivant = historiser({ ...i, statut: 'en_cours', ...(i.assigneA ? {} : { assigneA: moi.id, responsable: moi.nom }) }, maintenant, moi.nom, 'Pris en charge.');
        message = 'Incident pris en charge.';
      } else if (action.type === 'noter') {
        const t = texte(action.texte, 1000);
        const photos = photosAction(action.photos);
        if (!photos) return refus('Photos refusées : ajoutez-les depuis cet écran, 6 au plus.');
        if (!t && !photos.length) return refus('Écrivez un mot ou ajoutez une photo.');
        suivant = historiser({ ...i, preuves: [...(i.preuves ?? []), ...photos] }, maintenant, moi.nom, t || (photos.length > 1 ? `${photos.length} photos ajoutées.` : 'Photo ajoutée.'));
        message = 'Ajouté à l’incident.';
      } else if (!pole) {
        return refus(POLE_SEUL, 403);
      } else if (action.type === 'assigner') {
        if (action.membreId && !membreDuLogement(action.membreId, i.logementId)) return refus('Cette personne ne suit pas ce logement.');
        const nom = e.equipe.find((m) => m.id === action.membreId)?.nom;
        const { assigneA: _a, responsable: _r, ...reste } = i;
        suivant = historiser(action.membreId ? { ...reste, assigneA: action.membreId, responsable: nom } : reste, maintenant, moi.nom, action.membreId ? `Confié à ${court(nom)}.` : 'Plus personne dessus.');
        message = action.membreId ? `Confié à ${court(nom)}.` : 'Personne ne s’en occupe pour l’instant.';
        if (action.membreId) aNotifier.push(i.id);
      } else if (action.type === 'priorite') {
        if (estUrgent(i) === !!action.urgent) return ok([], 'Rien à changer.');
        suivant = historiser({ ...i, gravite: graviteDe(action.urgent ? 'urgente' : 'normale', i.gravite) }, maintenant, moi.nom, action.urgent ? 'Passé en urgent.' : 'Passé en normal.');
        message = action.urgent ? 'Passé en urgent : l’équipe est prévenue.' : 'Passé en normal.';
        if (action.urgent) aNotifier.push(i.id);
      } else if (action.type === 'resoudre') {
        if (i.statut === 'resolu') return refus('Incident déjà résolu.');
        const t = texte(action.texte, 1000);
        suivant = historiser({ ...i, statut: 'resolu', resoluLe: aujourdhui }, maintenant, moi.nom, t ? `Résolu : ${t}` : 'Résolu.');
        message = 'Incident résolu.';
      } else {
        if (i.statut !== 'resolu') return refus('Cet incident n’est pas résolu.');
        const { resoluLe: _r, recupereLe: _x, ...reste } = i;
        suivant = historiser({ ...reste, statut: 'en_cours' }, maintenant, moi.nom, 'Rouvert.');
        message = 'Incident rouvert.';
      }
      return ok([{ collection: 'incidents', element: suivant }], message, { id: i.id, aNotifier });
    }

    case 'controle': {
      const cle = String(action.cle ?? '');
      let base: ControleQualite | undefined;
      if (cle.startsWith('depart-')) {
        const r = e.reservations.find((x) => `depart-${x.id}` === cle);
        if (!r || !ids.has(r.logementId)) return refus('Contrôle introuvable.', 404);
        const propose = controlesAFaire(e, aujourdhui).find((c) => c.cle === cle);
        const deja = e.controles.find((c) => c.reservationId === r.id);
        base = deja ?? (propose ? { id: ctx.nouvelId('ctl'), logementId: r.logementId, reservationId: r.id, echeance: propose.echeance, statut: 'a_faire', points: pointsDuLogement(e, r.logementId).map((libelle, k) => ({ id: `p${k + 1}`, libelle })) } : undefined);
      } else if (idValide(cle)) {
        base = e.controles.find((c) => c.id === cle);
      }
      if (!base) return refus('Contrôle introuvable.', 404);
      const saisis = new Map((Array.isArray(action.points) ? action.points : []).map((p) => [String(p?.id), p]));
      let points: PointControle[] = [];
      for (const p of base.points) {
        const s = saisis.get(p.id);
        if (!s) {
          points.push(p);
          continue;
        }
        // Absent : inchangé ; vide : retiré ; sinon une photo déposée par l'espace.
        const photo = s.photo === undefined ? p.photo : s.photo === '' ? undefined : String(s.photo);
        if (photo && photo !== p.photo && !ctx.photoAcceptee?.(photo)) return refus('Photo refusée : ajoutez-la depuis cet écran.');
        const commentaire = s.commentaire === undefined ? (p.commentaire ?? '') : texte(s.commentaire, 500);
        const { etat: _e, commentaire: _c, photo: _p, ...reste } = p;
        points.push({
          ...reste,
          ...(s.etat === 'ok' || s.etat === 'a_revoir' ? { etat: s.etat } : {}),
          ...(commentaire ? { commentaire } : {}),
          ...(photo ? { photo } : {}),
        });
      }
      const note = Number(action.note);
      const commentaire = texte(action.commentaire, 1000);
      const { note: _n, commentaire: _c, ...resteBase } = base;
      let controle: ControleQualite = {
        ...resteBase,
        points,
        ...(Number.isInteger(note) && note >= 1 && note <= 5 ? { note } : {}),
        ...(commentaire ? { commentaire } : {}),
      };
      const ecritures: Ecriture[] = [];
      const aNotifier: Id[] = [];
      if (action.terminer) {
        const manque = verifierControle(controle);
        if (manque) return refus(manque);
        controle = { ...controle, statut: 'fait', parId: moi.id, realiseLe: controle.statut === 'fait' && controle.realiseLe ? controle.realiseLe : maintenant };
        const pour = new Set((action.incidentsPour ?? []).map(String));
        const assigneA = titulaire(controle.logementId);
        const nom = e.equipe.find((m) => m.id === assigneA)?.nom;
        points = controle.points.map((p) => {
          if (!pour.has(p.id) || p.etat !== 'a_revoir' || p.incidentId) return p;
          const incident: Incident = {
            ...incidentDepuisPoint(controle, p, aujourdhui),
            id: ctx.nouvelId('inc'),
            statut: 'ouvert',
            refacturable: 'aucun',
            signalePar: moi.id,
            ...(assigneA ? { assigneA, responsable: nom } : {}),
            historique: [
              { le: maintenant, par: moi.nom, texte: 'Créé depuis le contrôle qualité.' },
              ...(assigneA ? [{ le: maintenant, par: moi.nom, texte: `Confié à ${court(nom)}.` }] : []),
            ],
          };
          ecritures.push({ collection: 'incidents', element: incident });
          if (assigneA) aNotifier.push(incident.id);
          return { ...p, incidentId: incident.id };
        });
        controle = { ...controle, points };
      }
      const nb = ecritures.length;
      return ok(
        [{ collection: 'controles', element: controle }, ...ecritures],
        action.terminer
          ? nb
            ? `Contrôle enregistré, ${nb > 1 ? `${nb} incidents créés` : 'un incident créé'}.`
            : 'Contrôle enregistré.'
          : 'Contrôle gardé : vous pourrez le finir plus tard.',
        { id: controle.id, aNotifier },
      );
    }

    case 'absence': {
      if (!pole) return refus(POLE_SEUL, 403);
      if (!e.equipe.some((m) => m.id === action.membreId)) return refus('Cette personne ne fait pas partie de votre équipe.');
      if (action.remplacantId && !e.equipe.some((m) => m.id === action.remplacantId)) return refus('Le remplaçant doit faire partie de votre équipe.');
      const existante = idValide(action.id) ? e.absences.find((a) => a.id === action.id) : undefined;
      if (action.id && !existante) return refus('Absence introuvable.', 404);
      const motif = texte(action.motif, 200);
      const absence: AbsenceMembre = {
        id: existante?.id ?? ctx.nouvelId('abs'),
        membreId: action.membreId,
        du: String(action.du ?? ''),
        au: String(action.au ?? ''),
        ...(action.remplacantId ? { remplacantId: action.remplacantId } : {}),
        ...(motif ? { motif } : {}),
        creeLe: existante?.creeLe ?? maintenant,
        par: existante?.par ?? moi.nom,
      };
      const probleme = verifierAbsence(absence, brutes.absences);
      if (probleme) return refus(probleme);
      return ok([{ collection: 'absences', element: absence }], 'Absence enregistrée : les remplacements s’appliquent sur la période.', { id: absence.id });
    }

    case 'absence-annuler': {
      if (!pole) return refus(POLE_SEUL, 403);
      const a = idValide(action.id) ? e.absences.find((x) => x.id === action.id && !x.annuleeLe) : undefined;
      if (!a) return refus('Absence introuvable.', 404);
      const annulee: AbsenceMembre = { ...a, annuleeLe: maintenant };
      return ok([{ collection: 'absences', element: annulee }], 'Absence annulée : chacun retrouve ses logements.');
    }

    case 'affectation': {
      if (!pole) return refus(POLE_SEUL, 403);
      if (!idValide(action.logementId) || !ids.has(action.logementId)) return refus('Ce logement ne fait pas partie des vôtres.', 403);
      for (const m of [action.responsableId, action.remplacantId]) if (m && !membreDuLogement(m, action.logementId)) return refus('Choisissez une personne qui suit ce logement.');
      if (action.responsableId && action.responsableId === action.remplacantId) return refus('Le remplaçant doit être une autre personne.');
      const precedent = e.affectations.find((a) => a.id === action.logementId);
      const points = Array.isArray(action.pointsControle) ? action.pointsControle.map((p) => texte(p, 80)).filter(Boolean).slice(0, 20) : precedent?.pointsControle;
      const affectation: AffectationLogement = {
        id: action.logementId,
        ...(action.responsableId ? { responsableId: action.responsableId } : {}),
        ...(action.remplacantId ? { remplacantId: action.remplacantId } : {}),
        ...(points?.length ? { pointsControle: points } : {}),
      };
      return ok([{ collection: 'affectations', element: affectation }], 'Enregistré.', { id: affectation.id });
    }

    default:
      return refus('Action inconnue.');
  }
}

/** Applique des écritures à des entrées (démo, et vérification). */
export function avecEcritures<E extends EntreesOperations>(e: E, ecritures: readonly Ecriture[]): E {
  const suivant = { ...e } as E & Record<CollectionOps, { id: Id }[]>;
  for (const x of ecritures) {
    const liste = [...((suivant[x.collection] as { id: Id }[]) ?? [])];
    const i = liste.findIndex((y) => y.id === x.element.id);
    if (i >= 0) liste[i] = x.element;
    else liste.push(x.element);
    suivant[x.collection] = liste as never;
  }
  return suivant;
}

/** Une absence de la personne, en cours aujourd'hui (pour le dire en haut de son espace). */
export const monAbsence = (e: Pick<EntreesOperations, 'absences'>, membreId: Id, aujourdhui: DateISO) => absenceLe(e.absences, membreId, aujourdhui);
