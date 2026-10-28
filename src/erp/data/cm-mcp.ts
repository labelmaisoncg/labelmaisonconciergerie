/**
 * Outils « channel manager » du connecteur Claude (MCP) : logements,
 * réservations, conversations et indicateurs de l'utilisateur connecté.
 *
 * Lecture, plus un seul changement : classer une conversation « terminée »
 * dans l'ERP (comme « Pas besoin de répondre » dans la Messagerie). Rien n'est
 * envoyé aux voyageurs ni écrit vers les plateformes : Claude prépare une
 * réponse, l'équipe l'envoie depuis l'ERP. Jamais de code d'accès, de wifi,
 * d'e-mail ni de téléphone de voyageur ; voyageurs nommés « Prénom N. ».
 *
 * Calculs alignés sur l'Accueil (data/selectors, tableau-de-bord/calculs) mais
 * écrits ici avec une date du jour explicite : ce module tourne côté serveur,
 * où « aujourd'hui » ne peut pas être figé au chargement.
 */
import { attendEquipe } from './attente-equipe.js';
import { aTraiterLe } from './crm.js';
import { SEUIL_NOTE_CONTROLE } from './constantes.js';
import { LIBELLES } from './libelles.js';
import { date, ECRITURE, ErreurOutil, LECTURE, texte, type Args, type ContexteMcp, type Outil } from './mcp-commun.js';
import { mesurerOccupation } from './occupation.js';
import type { FilMessages, Logement, RaisonEscalade, Reservation } from './types';

const ERP = 'https://www.labelmaisoncg.fr/erp';
const ID = /^[a-z0-9_-]{1,100}$/i;
const JOUR_MS = 86_400_000;

/* ------------------------------------------------------------ dates */

const enMs = (d: string) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
export const plusJours = (d: string, n: number) => new Date(enMs(d) + n * JOUR_MS).toISOString().slice(0, 10);
const ecart = (de: string, a: string) => Math.round((enMs(a) - enMs(de)) / JOUR_MS);

/** Fenêtre [debut, fin[ (comme data/selectors). */
interface Fenetre {
  debut: string;
  fin: string;
}

const nuitsDans = (r: Reservation, f: Fenetre) => Math.max(0, ecart(r.arrivee > f.debut ? r.arrivee : f.debut, r.depart < f.fin ? r.depart : f.fin));
const prorata = (montant: number, r: Reservation, f: Fenetre) => (r.nuits ? Math.round((montant * nuitsDans(r, f)) / r.nuits) : 0);
const active = (r: Reservation) => r.statut !== 'annulee';

/* ------------------------------------------------------- présentation */

/** « Daniel Arnaud » → « Daniel A. » ; « Daniel A. » reste tel quel. */
export function prenomInitiale(nom: string | undefined): string {
  const mots = (nom ?? '').trim().split(/\s+/).filter(Boolean);
  if (!mots.length) return 'Voyageur';
  if (mots.length === 1) return mots[0];
  return `${mots[0]} ${mots[mots.length - 1].charAt(0).toUpperCase()}.`;
}

const euros = (centimes: number) => `${(centimes / 100).toLocaleString('fr-FR', { minimumFractionDigits: centimes % 100 ? 2 : 0, maximumFractionDigits: 2 })} €`;
const pourcent = (x: number) => `${Math.round(x * 100)} %`;
const note = (n: number | undefined) => (n === undefined ? undefined : Math.round(n * 10) / 10);

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const TELEPHONE = /(?:\+|00)\d{1,3}[\s.-]?\d(?:[\s.-]?\d{2,3}){3,5}|\b0[1-9](?:[\s.-]?\d{2}){4}\b/g;

/** Retire d'un message les e-mails, téléphones et codes du logement (wifi, accès). */
export function masquer(t: string, l: Logement | undefined): string {
  let s = t.replace(EMAIL, '[e-mail masqué]').replace(TELEPHONE, '[téléphone masqué]');
  const codes = [l?.fiche?.wifiCode ?? '', ...((l?.fiche?.acces ?? '').match(/\d{4,}/g) ?? [])].map((c) => c.trim()).filter((c) => c.length >= 4);
  for (const c of codes) s = s.split(c).join('••••');
  return s;
}

const RAISON: Record<RaisonEscalade, string> = {
  argent: 'question d’argent',
  litige: 'problème ou litige',
  hors_fiche: 'information absente de la fiche',
  exception: 'demande d’exception',
  autre: 'autre',
};

const AUTEUR = { voyageur: 'Voyageur', hote: 'Équipe', agent: 'Agent' } as const;

/** Une conversation attend-elle l'équipe ? (même règle que « À répondre » de la Messagerie : attente-equipe.ts) */
export { attendEquipe };

/** Prix de la nuit de ce soir (sinon de la prochaine nuit connue, sinon prix de base) ; rien pour un logement qui n'est pas en location. */
function prixNuit(l: Logement, j: string) {
  if (l.statut !== 'actif') return undefined;
  const t = (l.tarifs?.jours ?? []).find((x) => x.date >= j && x.prixCentimes > 0);
  if (t) return { prix: euros(t.prixCentimes), nuit_du: t.date, source: t.date === j ? 'ce soir' : 'prochaine nuit connue' };
  const base = l.descriptif?.prix?.nuit;
  return base ? { prix: euros(base), source: 'prix de base de l’annonce' } : undefined;
}

function prochainEvenement(l: Logement, resas: Reservation[], j: string): string {
  const siens = resas.filter((r) => r.logementId === l.id && active(r));
  if (siens.some((r) => r.depart === j)) return 'Départ aujourd’hui';
  const enCours = siens.find((r) => r.arrivee <= j && r.depart > j);
  if (enCours) return enCours.arrivee === j ? `Arrivée aujourd’hui, jusqu’au ${enCours.depart}` : `Occupé jusqu’au ${enCours.depart}`;
  const suivante = siens.filter((r) => r.arrivee > j).sort((a, b) => a.arrivee.localeCompare(b.arrivee))[0];
  return suivante ? `Prochaine arrivée le ${suivante.arrivee}` : 'Aucune arrivée prévue';
}

function sejourCourt(r: Reservation, logements: Logement[]) {
  return {
    id: r.id,
    voyageur: prenomInitiale(r.voyageur?.nom),
    logement: logements.find((l) => l.id === r.logementId)?.nom ?? 'logement inconnu',
    arrivee: r.arrivee,
    depart: r.depart,
    nuits: r.nuits,
    voyageurs: r.voyageur?.nbPersonnes,
    plateforme: LIBELLES.canal[r.canal],
    statut: LIBELLES.statutReservation[r.statut],
    vous_recevez: euros(r.montantBrutCentimes - r.commissionPlateformeCentimes),
  };
}

function filCourt(f: FilMessages, logements: Logement[]) {
  const l = logements.find((x) => x.id === f.logementId);
  const dernier = f.messages[f.messages.length - 1];
  return {
    id: f.id,
    voyageur: prenomInitiale(f.voyageur),
    logement: l?.nom ?? 'logement inconnu',
    plateforme: LIBELLES.canal[f.canal],
    dernier_message_le: f.dernierMessageLe,
    ...(f.statut === 'escalade' ? { confiee_par_l_agent: true, raison: RAISON[f.raisonEscalade ?? 'autre'] } : {}),
    ...(dernier ? { dernier_message: { de: AUTEUR[dernier.auteur], texte: masquer(dernier.texte, l).slice(0, 300) } } : {}),
    lien_erp: `${ERP}/messagerie/${encodeURIComponent(f.id)}`,
  };
}

/* ---------------------------------------------------------- recherches */

export const idValide = (v: unknown, nom: string, aide: string): string => {
  const id = texte(v, nom, 100);
  if (!id) throw new ErreurOutil(`« ${nom} » est obligatoire (${aide}).`);
  if (!ID.test(id)) throw new ErreurOutil(`Identifiant invalide « ${id.slice(0, 40)} » (${aide}).`);
  return id;
};

/** Logement désigné par `id` ou par `recherche` (un seul doit correspondre). Aussi pour copilote-mcp.ts. */
export async function logementVise(a: Args, ctx: ContexteMcp): Promise<Logement> {
  const logements = await ctx.cm.logements();
  if (a.id !== undefined && a.id !== null && a.id !== '') {
    const id = idValide(a.id, 'id', 'voir logements_lister');
    const l = logements.find((x) => x.id === id);
    if (!l) throw new ErreurOutil(`Aucun logement avec l’id « ${id} ». Utilisez logements_lister.`);
    return l;
  }
  const q = (texte(a.recherche, 'recherche', 120) ?? '').toLowerCase();
  if (!q) throw new ErreurOutil('Indiquez « id » (voir logements_lister) ou « recherche » (nom, ville).');
  const trouves = logements.filter((l) => [l.nom, l.ville, l.adresse].some((v) => (v ?? '').toLowerCase().includes(q)));
  if (trouves.length === 1) return trouves[0];
  if (!trouves.length) throw new ErreurOutil(`Aucun logement ne correspond à « ${q} ». Utilisez logements_lister.`);
  throw new ErreurOutil(`${trouves.length} logements correspondent : ${trouves.slice(0, 8).map((l) => `${l.nom} (id ${l.id})`).join(' ; ')}. Précisez l’id.`);
}

/** Conversation désignée par `id`. Aussi pour copilote-mcp.ts. */
export async function filVise(a: Args, ctx: ContexteMcp): Promise<FilMessages> {
  const id = idValide(a.id, 'id', 'voir conversations_a_repondre');
  const f = await ctx.cm.fil(id);
  if (!f) throw new ErreurOutil(`Aucune conversation avec l’id « ${id} ». Utilisez conversations_a_repondre.`);
  return f;
}

/* --------------------------------------------------------- indicateurs */

/** Les quatre repères de l'Accueil sur une fenêtre (mêmes définitions que data/selectors). */
export function mesurer(logements: Logement[], reservations: Reservation[], f: Fenetre) {
  // Logements actifs, ou réservés sur la période (data/occupation, comme l'Accueil).
  const occ = mesurerOccupation(logements, reservations, f);
  const actives = reservations.filter(active);
  const nuits = actives.reduce((s, r) => s + nuitsDans(r, f), 0);
  const hebergement = actives.reduce((s, r) => s + prorata(r.montantBrutCentimes - r.fraisMenageCentimes, r, f), 0);
  const notes = reservations.filter((r) => r.noteVoyageur !== undefined && r.depart >= f.debut && r.depart < f.fin).map((r) => r.noteVoyageur!);
  return {
    occupation: occ.taux,
    logements: occ.logements,
    revenu: actives.reduce((s, r) => s + prorata(r.montantBrutCentimes - r.commissionPlateformeCentimes, r, f), 0),
    adr: nuits ? Math.round(hebergement / nuits) : 0,
    note: notes.length ? notes.reduce((s, n) => s + n, 0) / notes.length : undefined,
  };
}

/* ---------------------------------------------------------------- outils */

const proprietesLogement = {
  id: { type: 'string', description: 'Identifiant du logement (donné par logements_lister).' },
  recherche: { type: 'string', description: 'Ou une partie du nom ou de la ville, si un seul logement correspond.' },
};

export const OUTILS_CM: Outil[] = [
  {
    name: 'cm_resume',
    title: 'À faire maintenant (channel manager)',
    description:
      "Point du jour du channel manager : voyageurs qui attendent une réponse, arrivées, départs et voyageurs sur place aujourd'hui, avis sous 4,5 à lire (14 derniers jours), contacts du CRM à appeler. À appeler en premier.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: LECTURE,
    executer: async (_a, ctx) => {
      const j = ctx.aujourdhui();
      const [logements, resas, fils, contacts] = await Promise.all([ctx.cm.logements(), ctx.cm.reservations(), ctx.cm.fils(), ctx.depot.tous()]);
      const actives = resas.filter(active);
      const attente = fils.filter(attendEquipe).sort((a, b) => b.dernierMessageLe.localeCompare(a.dernierMessageLe));
      const depuis = plusJours(j, -14);
      const avis = resas
        .filter((r) => r.noteVoyageur !== undefined && r.noteVoyageur < SEUIL_NOTE_CONTROLE && r.depart >= depuis && r.depart <= j)
        .sort((a, b) => b.depart.localeCompare(a.depart));
      const appels = contacts.filter((c) => aTraiterLe(c, j));
      return {
        date: j,
        conversations_a_repondre: attente.length,
        conversations: attente.slice(0, 10).map((f) => filCourt(f, logements)),
        arrivees_aujourdhui: actives.filter((r) => r.arrivee === j).map((r) => sejourCourt(r, logements)),
        departs_aujourdhui: actives.filter((r) => r.depart === j).map((r) => sejourCourt(r, logements)),
        sur_place_ce_soir: actives.filter((r) => r.arrivee <= j && r.depart > j).length,
        avis_a_lire: avis.map((r) => ({ ...sejourCourt(r, logements), note: r.noteVoyageur, ...(r.commentaireVoyageur ? { commentaire: r.commentaireVoyageur.slice(0, 400) } : {}) })),
        contacts_a_appeler: appels.length,
        conseil: appels.length ? 'Le détail des appels : crm_resume.' : undefined,
      };
    },
  },
  {
    name: 'logements_lister',
    title: 'Lister les logements',
    description:
      'Tous les logements : statut (Actif, En pause, En préparation, Sorti), ville, capacité, prix de la nuit de ce soir s’il est connu, prochain événement (arrivée, départ, occupé jusqu’au…). Utiliser logement_voir pour la fiche complète.',
    inputSchema: {
      type: 'object',
      properties: { statut: { type: 'string', enum: ['actif', 'pause', 'lancement', 'sorti'], description: 'Ne garder que ce statut (lancement = En préparation).' } },
      additionalProperties: false,
    },
    annotations: LECTURE,
    executer: async (a, ctx) => {
      const j = ctx.aujourdhui();
      const statut = typeof a.statut === 'string' && a.statut ? a.statut : undefined;
      if (statut && !['actif', 'pause', 'lancement', 'sorti'].includes(statut)) throw new ErreurOutil('« statut » doit valoir : actif, pause, lancement, sorti.');
      const [logements, resas] = await Promise.all([ctx.cm.logements(), ctx.cm.reservations()]);
      const liste = logements.filter((l) => !statut || l.statut === statut).sort((x, y) => Number(y.statut === 'actif') - Number(x.statut === 'actif') || x.nom.localeCompare(y.nom));
      return {
        total: liste.length,
        logements: liste.map((l) => ({
          id: l.id,
          nom: l.nom,
          statut: LIBELLES.statutLogement[l.statut],
          ville: l.ville,
          ...(l.capacite ? { voyageurs_max: l.capacite } : {}),
          ...(l.chambres ? { chambres: l.chambres } : {}),
          ...(prixNuit(l, j) ? { prix_nuit: prixNuit(l, j) } : {}),
          prochain_evenement: prochainEvenement(l, resas, j),
          plateformes: l.annonces.filter((x) => x.connecte).map((x) => LIBELLES.canal[x.canal]),
        })),
      };
    },
  },
  {
    name: 'logement_voir',
    title: 'Fiche d’un logement',
    description:
      'Fiche complète d’un logement : adresse, capacité, couchage, conditions de l’annonce, infos pratiques pour les voyageurs (horaires, parking, règles, équipements, à savoir — sans wifi ni codes d’accès), plateformes, prix des 14 prochaines nuits et prochains séjours.',
    inputSchema: { type: 'object', properties: proprietesLogement, additionalProperties: false },
    annotations: LECTURE,
    executer: async (a, ctx) => {
      const j = ctx.aujourdhui();
      const l = await logementVise(a, ctx);
      const resas = await ctx.cm.reservations();
      const fin = plusJours(j, 14);
      const f = l.fiche ?? ({} as Logement['fiche']);
      const d = l.descriptif;
      return {
        id: l.id,
        nom: l.nom,
        statut: LIBELLES.statutLogement[l.statut],
        adresse: [l.adresse, [l.codePostal, l.ville].filter(Boolean).join(' ')].filter(Boolean).join(', '),
        type: LIBELLES.typeLogement[l.type],
        ...(l.capacite ? { voyageurs_max: l.capacite } : {}),
        ...(l.chambres ? { chambres: l.chambres } : {}),
        ...(l.surfaceM2 ? { surface_m2: l.surfaceM2 } : {}),
        ...(d?.couchage?.length ? { couchage: d.couchage.map((c) => `${c.piece} : ${c.lits}`) } : {}),
        infos_pratiques: {
          arrivee_a_partir_de: f.heureArrivee || undefined,
          depart_avant: f.heureDepart || undefined,
          acces: LIBELLES.serrure?.[l.serrure] ?? undefined,
          parking: f.parking || undefined,
          regles: f.regles || undefined,
          equipements: f.equipements?.length ? f.equipements : undefined,
          a_savoir: f.aSavoir || undefined,
          note: 'Wifi et codes d’accès ne sont pas transmis par ce connecteur.',
        },
        ...(d?.conditions || d?.sejour
          ? {
              conditions: {
                ...(d.conditions ?? {}),
                ...(d.sejour?.nuitsMin ? { nuits_minimum: d.sejour.nuitsMin } : {}),
                ...(d.sejour?.nuitsMax ? { nuits_maximum: d.sejour.nuitsMax } : {}),
              },
            }
          : {}),
        ...(d?.textes?.resume || d?.textes?.description ? { annonce: [d.titre, d.textes?.resume, d.textes?.description].filter(Boolean).join('\n\n').slice(0, 1500) } : {}),
        plateformes: l.annonces.map((x) => ({ plateforme: LIBELLES.canal[x.canal], en_ligne: x.connecte, ...(x.url && /^https:\/\//.test(x.url) ? { lien: x.url } : {}) })),
        prix_14_nuits: (l.tarifs?.jours ?? [])
          .filter((x) => x.date >= j && x.date < fin)
          .map((x) => ({ nuit_du: x.date, prix: euros(x.prixCentimes), libre: x.libre })),
        ...(prixNuit(l, j) ? { prix_nuit: prixNuit(l, j) } : {}),
        prochains_sejours: resas
          .filter((r) => r.logementId === l.id && active(r) && r.depart >= j)
          .sort((x, y) => x.arrivee.localeCompare(y.arrivee))
          .slice(0, 5)
          .map((r) => sejourCourt(r, [l])),
        lien_erp: `${ERP}/logements/${encodeURIComponent(l.id)}`,
      };
    },
  },
  {
    name: 'reservations_periode',
    title: 'Arrivées, départs et voyageurs sur place',
    description:
      'Pour une période (du / au compris, aujourd’hui par défaut, 92 jours au plus) : les arrivées, les départs et les séjours avec au moins une nuit dans la période (sur place). Réservations annulées exclues. Filtre facultatif sur un logement.',
    inputSchema: {
      type: 'object',
      properties: {
        du: { type: 'string', description: 'Premier jour, AAAA-MM-JJ (aujourd’hui par défaut).' },
        au: { type: 'string', description: 'Dernier jour, AAAA-MM-JJ (égal à « du » par défaut).' },
        logement_id: { type: 'string', description: 'Ne garder que ce logement (id de logements_lister).' },
      },
      additionalProperties: false,
    },
    annotations: LECTURE,
    executer: async (a, ctx) => {
      const j = ctx.aujourdhui();
      const du = date(a.du, 'du') || j;
      const au = date(a.au, 'au') || du;
      if (au < du) throw new ErreurOutil('« au » doit être le même jour que « du » ou après.');
      if (ecart(du, au) > 92) throw new ErreurOutil('Période trop longue : 92 jours au plus.');
      const logementId = a.logement_id ? idValide(a.logement_id, 'logement_id', 'voir logements_lister') : undefined;
      const [logements, resas] = await Promise.all([ctx.cm.logements(), ctx.cm.reservations()]);
      const actives = resas.filter((r) => active(r) && (!logementId || r.logementId === logementId)).sort((x, y) => x.arrivee.localeCompare(y.arrivee));
      const dans = (d: string) => d >= du && d <= au;
      return {
        du,
        au,
        arrivees: actives.filter((r) => dans(r.arrivee)).map((r) => sejourCourt(r, logements)),
        departs: actives.filter((r) => dans(r.depart)).map((r) => sejourCourt(r, logements)),
        sur_place: actives.filter((r) => r.arrivee <= au && r.depart > du).map((r) => sejourCourt(r, logements)),
      };
    },
  },
  {
    name: 'reservation_voir',
    title: 'Fiche d’une réservation',
    description: 'Détail d’un séjour : logement, dates, voyageurs, plateforme et référence, montants (total, ménage, frais de la plateforme, ce que vous recevez), avis du voyageur.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Identifiant de la réservation (donné par reservations_periode ou cm_resume).' } },
      required: ['id'],
      additionalProperties: false,
    },
    annotations: LECTURE,
    executer: async (a, ctx) => {
      const id = idValide(a.id, 'id', 'voir reservations_periode');
      const [logements, resas] = await Promise.all([ctx.cm.logements(), ctx.cm.reservations()]);
      const r = resas.find((x) => x.id === id);
      if (!r) throw new ErreurOutil(`Aucune réservation avec l’id « ${id} ». Utilisez reservations_periode.`);
      return {
        ...sejourCourt(r, logements),
        ...(r.voyageur?.pays ? { pays: r.voyageur.pays } : {}),
        ...(r.repull?.code ? { reference_plateforme: r.repull.code } : {}),
        montants: {
          total_du_sejour: euros(r.montantBrutCentimes),
          dont_menage: euros(r.fraisMenageCentimes),
          frais_de_la_plateforme: euros(r.commissionPlateformeCentimes),
          vous_recevez: euros(r.montantBrutCentimes - r.commissionPlateformeCentimes),
        },
        ...(r.noteVoyageur !== undefined || r.commentaireVoyageur
          ? { avis: { ...(r.noteVoyageur !== undefined ? { note: note(r.noteVoyageur) } : {}), ...(r.commentaireVoyageur ? { commentaire: r.commentaireVoyageur.slice(0, 1500) } : {}) } }
          : {}),
        lien_erp: `${ERP}/reservations/${encodeURIComponent(r.id)}`,
      };
    },
  },
  {
    name: 'conversations_a_repondre',
    title: 'Conversations à répondre',
    description:
      'Les voyageurs qui attendent une réponse de l’équipe (y compris ceux que l’agent a confiés, avec la raison), du plus récent au plus ancien, avec le dernier message.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: LECTURE,
    executer: async (_a, ctx) => {
      const [logements, fils] = await Promise.all([ctx.cm.logements(), ctx.cm.fils()]);
      const attente = fils.filter(attendEquipe).sort((a, b) => b.dernierMessageLe.localeCompare(a.dernierMessageLe));
      return { total: attente.length, conversations: attente.map((f) => filCourt(f, logements)) };
    },
  },
  {
    name: 'conversation_voir',
    title: 'Lire une conversation',
    description: 'Les derniers messages d’une conversation (voyageur, équipe, agent), avec le logement et le séjour. E-mails, téléphones et codes sont masqués.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Identifiant de la conversation (donné par conversations_a_repondre).' },
        nombre: { type: 'integer', minimum: 1, maximum: 50, default: 20, description: 'Nombre de derniers messages.' },
      },
      required: ['id'],
      additionalProperties: false,
    },
    annotations: LECTURE,
    executer: async (a, ctx) => {
      const f = await filVise(a, ctx);
      const n = Math.min(50, Math.max(1, Number.isInteger(a.nombre) ? (a.nombre as number) : 20));
      const [logements, resas] = await Promise.all([ctx.cm.logements(), ctx.cm.reservations()]);
      const l = logements.find((x) => x.id === f.logementId);
      const r = f.reservationId ? resas.find((x) => x.id === f.reservationId) : undefined;
      return {
        ...filCourt(f, logements),
        attend_une_reponse: attendEquipe(f),
        statut: f.statut === 'clos' ? 'Terminée' : f.statut === 'escalade' ? 'Confiée à l’équipe par l’agent' : 'Ouverte',
        ...(r ? { sejour: sejourCourt(r, logements) } : {}),
        messages: f.messages.slice(-n).map((m) => ({ de: AUTEUR[m.auteur], le: m.envoyeLe, texte: masquer(m.texte, l).slice(0, 1500) })),
      };
    },
  },
  {
    name: 'conversation_pas_besoin_de_repondre',
    title: 'Pas besoin de répondre',
    description:
      'Classe une conversation « terminée » dans l’ERP quand l’équipe a décidé de ne pas répondre (comme le bouton de la Messagerie) : elle sort de « À répondre » et se rouvre toute seule si le voyageur réécrit. Rien n’est envoyé au voyageur ni à la plateforme.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Identifiant de la conversation (donné par conversations_a_repondre).' } },
      required: ['id'],
      additionalProperties: false,
    },
    annotations: { ...ECRITURE, idempotentHint: true },
    executer: async (a, ctx) => {
      const f = await filVise(a, ctx);
      const logements = await ctx.cm.logements();
      if (!attendEquipe(f)) return { modifie: false, raison: 'Cette conversation n’attend pas de réponse de l’équipe.', conversation: filCourt(f, logements) };
      const suivant: FilMessages = { ...f, statut: 'clos', traitePar: f.traitePar === 'en_attente' ? 'humain' : f.traitePar };
      await ctx.cm.enregistrerFil(suivant);
      return { modifie: true, conversation: { ...filCourt(suivant, logements), attend_une_reponse: false } };
    },
  },
  {
    name: 'reponse_preparer',
    title: 'Préparer une réponse',
    description:
      'Rassemble tout ce qu’il faut pour rédiger une réponse à un voyageur : ses derniers messages, son séjour et les informations du logement. Proposez ensuite la réponse : ce connecteur ne l’envoie PAS, l’équipe la relit et l’envoie depuis la Messagerie de l’ERP (lien fourni).',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Identifiant de la conversation (donné par conversations_a_repondre).' } },
      required: ['id'],
      additionalProperties: false,
    },
    annotations: LECTURE,
    executer: async (a, ctx) => {
      const f = await filVise(a, ctx);
      const [logements, resas] = await Promise.all([ctx.cm.logements(), ctx.cm.reservations()]);
      const l = logements.find((x) => x.id === f.logementId);
      const r = f.reservationId ? resas.find((x) => x.id === f.reservationId) : undefined;
      const fi = l?.fiche;
      const d = l?.descriptif;
      return {
        voyageur: prenomInitiale(f.voyageur),
        logement: l?.nom ?? 'logement inconnu',
        ...(r ? { sejour: sejourCourt(r, logements) } : {}),
        ...(f.statut === 'escalade' ? { confiee_par_l_agent: RAISON[f.raisonEscalade ?? 'autre'] } : {}),
        derniers_messages: f.messages.slice(-10).map((m) => ({ de: AUTEUR[m.auteur], le: m.envoyeLe, texte: masquer(m.texte, l).slice(0, 1500) })),
        infos_du_logement: {
          arrivee_a_partir_de: fi?.heureArrivee || undefined,
          depart_avant: fi?.heureDepart || undefined,
          parking: fi?.parking || undefined,
          regles: fi?.regles || undefined,
          equipements: fi?.equipements?.length ? fi.equipements : undefined,
          a_savoir: fi?.aSavoir || undefined,
          ...(d?.couchage?.length ? { couchage: d.couchage.map((c) => `${c.piece} : ${c.lits}`) } : {}),
          ...(d?.conditions ? { conditions: d.conditions } : {}),
        },
        consignes: [
          'Proposez une réponse courte, chaleureuse, dans la langue du voyageur.',
          'Ne donnez ni code d’accès ni wifi : l’équipe les envoie depuis l’ERP au bon moment.',
          'Ne promettez ni remboursement, ni geste commercial, ni exception : l’équipe décide.',
          'La réponse n’est pas envoyée par ce connecteur : l’équipe la relit et l’envoie depuis la Messagerie.',
        ],
        lien_erp: `${ERP}/messagerie/${encodeURIComponent(f.id)}`,
      };
    },
  },
  {
    name: 'indicateurs',
    title: 'Indicateurs',
    description:
      'Les quatre repères de l’Accueil sur les 30 derniers jours (ou une période donnée), comparés à la période précédente de même durée : occupation (logements actifs, ou réservés sur la période), revenu versé par les plateformes (total payé moins leur commission), prix moyen par nuit (hors ménage), note moyenne des voyageurs.',
    inputSchema: {
      type: 'object',
      properties: {
        du: { type: 'string', description: 'Premier jour, AAAA-MM-JJ (par défaut : il y a 30 jours).' },
        au: { type: 'string', description: 'Dernier jour inclus, AAAA-MM-JJ (par défaut : hier).' },
      },
      additionalProperties: false,
    },
    annotations: LECTURE,
    executer: async (a, ctx) => {
      const j = ctx.aujourdhui();
      const du = date(a.du, 'du') || plusJours(j, -30);
      const fin = date(a.au, 'au') ? plusJours(date(a.au, 'au') as string, 1) : j;
      if (fin <= du) throw new ErreurOutil('« au » doit être le même jour que « du » ou après.');
      if (ecart(du, fin) > 366) throw new ErreurOutil('Période trop longue : 366 jours au plus.');
      const duree = ecart(du, fin);
      const [logements, resas] = await Promise.all([ctx.cm.logements(), ctx.cm.reservations()]);
      const m = mesurer(logements, resas, { debut: du, fin });
      const p = mesurer(logements, resas, { debut: plusJours(du, -duree), fin: du });
      return {
        periode: { du, au: plusJours(fin, -1), jours: duree },
        logements_actifs: logements.filter((l) => l.statut === 'actif').length,
        logements_comptes_dans_l_occupation: m.logements,
        occupation: pourcent(m.occupation),
        revenu_verse_par_les_plateformes: euros(m.revenu),
        prix_moyen_par_nuit: euros(m.adr),
        note_moyenne: note(m.note) ?? 'aucun avis sur la période',
        periode_precedente: {
          occupation: pourcent(p.occupation),
          revenu_verse_par_les_plateformes: euros(p.revenu),
          prix_moyen_par_nuit: euros(p.adr),
          note_moyenne: note(p.note) ?? 'aucun avis',
        },
      };
    },
  },
];
