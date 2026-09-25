/**
 * Outils d'écriture : blocage et déblocage de calendriers.
 *
 * Ces outils N'ÉCRIVENT PAS directement. Ils préparent l'action, la déposent en
 * attente, et laissent le bot demander confirmation par bouton. Une écriture de calendrier
 * part chez Airbnb en quelques secondes : il n'y a pas de retour en arrière
 * silencieux, et une erreur de date coûte une nuit de location.
 *
 * L'exécution réelle passe par `executerActionConfirmee`, appelée uniquement
 * après le clic sur « Confirmer ».
 */

import * as repull from '../repull.js';
import * as store from '../store.js';
import { ajouterJours, enFrancais, estValide } from '../dates.js';
import { appliquerTarifs, NON_RELIE } from './tarifs.js';
import type { Contexte, Outil } from './index.js';

async function cible(chatId: string | number, nomLogement: string) {
  const c = await store.conciergerieParChat(chatId);
  if (!c) throw new Error('Aucune conciergerie enregistrée.');
  const l = await store.logementParNom(c.id, nomLogement);
  return { c, l };
}

type Plage = { du: string; au: string };

const decrirePlage = (p: Plage): string =>
  p.du === p.au ? `la nuit du ${enFrancais(p.du)}` : `du ${enFrancais(p.du)} au ${enFrancais(p.au)}`;

/**
 * Découpe [du, au] (nuits, bornes incluses) en sous-plages LIBRES, en retirant
 * les nuits déjà vendues. Une réservation occupe les nuits arrivée..départ-1 :
 * la nuit du départ reste libre.
 *
 * Rouvrir une nuit vendue la remettrait en vente sur Airbnb et Booking :
 * c'est un surbooking garanti. Ce calcul est refait à la confirmation, car une
 * réservation peut tomber dans l'heure qui sépare la demande du clic.
 */
async function nuitsLibres(
  annonceId: string,
  du: string,
  au: string,
): Promise<{ libres: Plage[]; occupees: Plage[] }> {
  const resas = await repull.reservationsChevauchant(annonceId, du, au);
  const vendues = new Set<string>();
  for (const r of resas) {
    if (!r.arrivee || !r.depart) continue;
    for (let n = r.arrivee; n < r.depart; n = ajouterJours(n, 1)) vendues.add(n);
  }

  const libres: Plage[] = [];
  const occupees: Plage[] = [];
  let courante: Plage | null = null;
  let courantEstLibre = false;
  for (let n = du; n <= au; n = ajouterJours(n, 1)) {
    const libre = !vendues.has(n);
    if (courante && libre === courantEstLibre) {
      courante.au = n;
    } else {
      if (courante) (courantEstLibre ? libres : occupees).push(courante);
      courante = { du: n, au: n };
      courantEstLibre = libre;
    }
  }
  if (courante) (courantEstLibre ? libres : occupees).push(courante);
  return { libres, occupees };
}

/** Repull pousse la mise à jour vers les plateformes ; leur refus éventuel est rapporté. */
const suite = (avertissement: string | null): string =>
  avertissement
    ? `\n\nAttention : ${avertissement}. Vérifie le calendrier sur la plateforme concernée.`
    : '\n\nLa mise à jour part vers les plateformes connectées.';

/** Plafond de la plage débloquable d'un coup : borne la boucle nuit par nuit. */
const NUITS_MAX = 366;

/** Prépare une action et la met en attente de confirmation. */
async function preparer(
  ctx: Contexte,
  outil: string,
  args: Record<string, unknown>,
  recap: string,
): Promise<unknown> {
  const c = await store.conciergerieParChat(ctx.chatId);
  if (!c) return { erreur: 'Aucune conciergerie enregistrée.' };

  const id = await store.deposerAction({
    conciergerieId: c.id,
    chatId: String(ctx.chatId),
    outil,
    arguments: args,
    recap,
  });

  // Signale à la couche Telegram qu'il faut afficher les boutons.
  ctx.actionEnAttente = { id, recap };

  return {
    _confirmation_requise: true,
    recap,
    consigne:
      "Annonce l'action à l'utilisateur en reprenant le récapitulatif mot pour mot, " +
      'puis dis-lui de confirmer avec le bouton. Ne prétends pas que c\'est fait.',
  };
}

const bloquerDates: Outil = {
  definition: {
    name: 'bloquer_dates',
    description:
      "Bloque un logement sur une période : il devient indisponible sur toutes les " +
      "plateformes connectées. NE S'EXÉCUTE PAS immédiatement — l'utilisateur devra " +
      'confirmer par un bouton.',
    input_schema: {
      type: 'object',
      properties: {
        logement: { type: 'string' },
        du: { type: 'string', description: 'AAAA-MM-JJ, premier jour bloqué.' },
        au: { type: 'string', description: 'AAAA-MM-JJ, dernier jour bloqué.' },
        raison: { type: 'string', description: 'Travaux, usage personnel, entretien…' },
      },
      required: ['logement', 'du', 'au'],
      additionalProperties: false,
    },
  },
  ecriture: true,
  executer: async (args, ctx) => {
    const { l } = await cible(ctx.chatId, String(args.logement));
    if (!l) return { erreur: `Logement introuvable : ${args.logement}` };
    if (!estValide(args.du) || !estValide(args.au)) return { erreur: 'Dates attendues au format AAAA-MM-JJ.' };
    if (args.au < args.du) return { erreur: 'La date de fin précède la date de début.' };

    // On avertit si des voyageurs sont déjà là : bloquer ne les annule pas,
    // mais l'utilisateur se trompe peut-être de dates.
    if (!l.repullListingId) return { erreur: NON_RELIE(l.nom) };
    const occupees = await repull.reservationsChevauchant(l.repullListingId, String(args.du), String(args.au));

    const recap =
      `Bloquer ${l.nom}\n` +
      `du ${enFrancais(String(args.du))} au ${enFrancais(String(args.au))}` +
      (args.raison ? `\nRaison : ${args.raison}` : '') +
      (occupees.length
        ? `\n\nAttention : ${occupees.length} réservation(s) existent déjà sur cette période. ` +
          'Le blocage ne les annule pas.'
        : '');

    return preparer(ctx, 'bloquer_dates', { ...args, logementId: l.id }, recap);
  },
};

const debloquerDates: Outil = {
  definition: {
    name: 'debloquer_dates',
    description:
      'Remet un logement en vente sur une période précédemment bloquée. ' +
      "NE S'EXÉCUTE PAS immédiatement : confirmation par bouton requise.",
    input_schema: {
      type: 'object',
      properties: {
        logement: { type: 'string' },
        du: { type: 'string', description: 'AAAA-MM-JJ' },
        au: { type: 'string', description: 'AAAA-MM-JJ' },
      },
      required: ['logement', 'du', 'au'],
      additionalProperties: false,
    },
    strict: true,
  },
  ecriture: true,
  executer: async (args, ctx) => {
    const { l } = await cible(ctx.chatId, String(args.logement));
    if (!l) return { erreur: `Logement introuvable : ${args.logement}` };
    if (!estValide(args.du) || !estValide(args.au)) return { erreur: 'Dates attendues au format AAAA-MM-JJ.' };
    if (args.au < args.du) return { erreur: 'La date de fin précède la date de début.' };
    if (ajouterJours(args.du, NUITS_MAX) <= args.au) {
      return { erreur: `Plage trop longue : ${NUITS_MAX} nuits au maximum en une fois.` };
    }
    if (!l.repullListingId) return { erreur: NON_RELIE(l.nom) };

    // Jamais de réouverture d'une nuit déjà vendue : on ne remet en vente que
    // les trous, et le récapitulatif dit EXACTEMENT ce qui sera rouvert.
    const { libres, occupees } = await nuitsLibres(l.repullListingId, args.du, args.au);
    if (libres.length === 0) {
      return {
        erreur:
          `Rien à remettre en vente : toutes les nuits demandées sont déjà réservées ` +
          `(${occupees.map(decrirePlage).join(' ; ')}).`,
      };
    }

    const recap =
      `Remettre ${l.nom} en vente :\n` +
      libres.map((p) => `— ${decrirePlage(p)}`).join('\n') +
      (occupees.length
        ? `\n\nNuits déjà réservées, laissées fermées :\n` +
          occupees.map((p) => `— ${decrirePlage(p)}`).join('\n')
        : '');

    return preparer(ctx, 'debloquer_dates', { ...args, logementId: l.id, plages: libres }, recap);
  },
};

/**
 * Exécution réelle, après le clic sur « Confirmer ». Jamais appelée par le modèle.
 */
export async function executerActionConfirmee(
  outil: string,
  args: Record<string, unknown>,
): Promise<string> {
  if (outil === 'modifier_tarifs') return appliquerTarifs(args);

  if (outil !== 'bloquer_dates' && outil !== 'debloquer_dates') {
    return `Action inconnue : ${outil}`;
  }

  const c = await store.conciergerieParChat(String(args.__chatId ?? ''));
  const logements = c ? await store.logements(c.id) : [];
  const l = logements.find((x) => x.id === args.logementId);
  if (!l) return "Logement introuvable, rien n'a été modifié.";
  if (!l.repullListingId) return NON_RELIE(l.nom);
  const annonceId = l.repullListingId;

  if (outil === 'bloquer_dates') {
    if (!estValide(args.du) || !estValide(args.au)) return "Dates invalides, rien n'a été modifié.";
    const avertissement = await repull.definirDisponibilites([
      { annonceId, du: args.du, au: args.au, disponible: false },
    ]);
    return `${l.nom} bloqué du ${enFrancais(args.du)} au ${enFrancais(args.au)}.` + suite(avertissement);
  }

  // Déblocage : on REVÉRIFIE les réservations. Une résa a pu tomber pendant
  // l'heure où l'action attendait le clic ; rouvrir sa nuit serait un surbooking.
  if (!estValide(args.du) || !estValide(args.au)) return "Dates invalides, rien n'a été modifié.";
  const { libres, occupees } = await nuitsLibres(annonceId, args.du, args.au);
  if (libres.length === 0) {
    return `Rien n'a été remis en vente : toutes les nuits de ${l.nom} sur cette période sont désormais réservées.`;
  }

  // Toutes les sous-plages partent dans une seule écriture.
  const avertissement = await repull.definirDisponibilites(
    libres.map((p) => ({ annonceId, du: p.du, au: p.au, disponible: true })),
  );

  const prevues = JSON.stringify((args.plages as Plage[] | undefined) ?? null);
  const changement = prevues !== 'null' && prevues !== JSON.stringify(libres);
  return (
    `${l.nom} remis en vente :\n` +
    libres.map((p) => `— ${decrirePlage(p)}`).join('\n') +
    (occupees.length
      ? `\n\nLaissées fermées car réservées :\n` + occupees.map((p) => `— ${decrirePlage(p)}`).join('\n')
      : '') +
    (changement ? '\n\nAttention : une réservation est arrivée depuis ta demande, la plage a été ajustée.' : '') +
    suite(avertissement)
  );
}

export const OUTILS_ACTIONS: Outil[] = [bloquerDates, debloquerDates];
