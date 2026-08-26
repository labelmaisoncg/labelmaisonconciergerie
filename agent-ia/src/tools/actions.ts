/**
 * Outils d'écriture : blocage et déblocage de calendriers.
 *
 * Ces outils N'ÉCRIVENT PAS directement. Ils préparent l'action, la déposent en
 * attente, et laissent le bot demander confirmation par bouton. Une écriture ARI
 * part chez Airbnb en quelques secondes : il n'y a pas de retour en arrière
 * silencieux, et une erreur de date coûte une nuit de location.
 *
 * L'exécution réelle passe par `executerActionConfirmee`, appelée uniquement
 * après le clic sur « Confirmer ».
 */

import * as channex from '../channex.js';
import * as store from '../store.js';
import { enFrancais, estValide } from '../dates.js';
import type { Contexte, Outil } from './index.js';

async function cible(chatId: string | number, nomLogement: string) {
  const c = await store.conciergerieParChat(chatId);
  if (!c) throw new Error('Aucune conciergerie enregistrée.');
  const l = await store.logementParNom(c.id, nomLogement);
  return { c, l };
}

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
    const occupees = await channex.reservations(l.channexPropertyId!, String(args.du), String(args.au));

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

    const recap =
      `Remettre ${l.nom} en vente\n` +
      `du ${enFrancais(String(args.du))} au ${enFrancais(String(args.au))}`;

    return preparer(ctx, 'debloquer_dates', { ...args, logementId: l.id }, recap);
  },
};

/**
 * Exécution réelle, après le clic sur « Confirmer ». Jamais appelée par le modèle.
 */
export async function executerActionConfirmee(
  outil: string,
  args: Record<string, unknown>,
): Promise<string> {
  if (outil !== 'bloquer_dates' && outil !== 'debloquer_dates') {
    return `Action inconnue : ${outil}`;
  }

  const c = await store.conciergerieParChat(String(args.__chatId ?? ''));
  const logements = c ? await store.logements(c.id) : [];
  const l = logements.find((x) => x.id === args.logementId);
  if (!l?.channexPropertyId) return "Logement introuvable, rien n'a été modifié.";

  // Le type de chambre est créé avec le logement ; on ne le redemande à
  // Channex que s'il manque, pour ne pas multiplier les appels.
  let typeId = l.channexRoomTypeId;
  if (!typeId) {
    const types = await channex.typesDeChambre(l.channexPropertyId);
    typeId = types[0]?.id ?? null;
    if (typeId) await store.majLogement(l.id, { channexRoomTypeId: typeId });
  }
  if (!typeId) {
    return `${l.nom} n'est pas encore configuré côté Channex : impossible d'écrire le calendrier.`;
  }

  const quantite = outil === 'bloquer_dates' ? 0 : 1;
  await channex.definirDisponibilite(
    l.channexPropertyId,
    typeId,
    String(args.du),
    String(args.au),
    quantite,
  );

  const verbe = outil === 'bloquer_dates' ? 'bloqué' : 'remis en vente';
  return `${l.nom} ${verbe} du ${enFrancais(String(args.du))} au ${enFrancais(String(args.au))}. La mise à jour part vers les plateformes dans les prochaines minutes.`;
}

export const OUTILS_ACTIONS: Outil[] = [bloquerDates, debloquerDates];
