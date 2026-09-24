/**
 * Tarifs et restrictions.
 *
 * Comme les blocages de calendrier, ces outils N'ÉCRIVENT PAS directement :
 * ils préparent l'action et attendent la confirmation par bouton. Un prix
 * erroné parti chez Airbnb, c'est une nuit vendue à 20 € ou un logement qui ne
 * se vend plus.
 *
 * Le GROUPAGE est central : un seul appel Channex quel que soit le nombre de
 * plages. La certification vérifie ce point sur la moitié de ses tests, et
 * « appels par date au lieu de regroupement » figure dans ses critères de rejet.
 */

import * as channex from '../channex.js';
import * as store from '../store.js';
import { enFrancais, estValide } from '../dates.js';
import type { Contexte, Outil } from './index.js';

type Plage = {
  du: string;
  au: string;
  prix?: number;
  sejour_minimum?: number;
  ferme_a_la_vente?: boolean;
  arrivee_interdite?: boolean;
  depart_interdit?: boolean;
};

const PLAGE_SCHEMA = {
  type: 'object' as const,
  properties: {
    du: { type: 'string', description: 'AAAA-MM-JJ, premier jour concerné.' },
    au: { type: 'string', description: 'AAAA-MM-JJ, dernier jour concerné.' },
    prix: { type: 'number', description: 'Prix par nuit en euros.' },
    sejour_minimum: { type: 'number', description: 'Nombre de nuits minimum à l’arrivée.' },
    ferme_a_la_vente: { type: 'boolean', description: 'true = le logement ne se vend plus.' },
    arrivee_interdite: { type: 'boolean', description: 'Aucune arrivée possible ces jours-là.' },
    depart_interdit: { type: 'boolean', description: 'Aucun départ possible ces jours-là.' },
  },
  required: ['du', 'au'],
  additionalProperties: false,
};

const decrire = (p: Plage): string => {
  const quoi = [
    p.prix != null && `${p.prix} € la nuit`,
    p.sejour_minimum != null && `minimum ${p.sejour_minimum} nuit(s)`,
    p.ferme_a_la_vente === true && 'fermé à la vente',
    p.ferme_a_la_vente === false && 'remis en vente',
    p.arrivee_interdite && 'arrivées interdites',
    p.depart_interdit && 'départs interdits',
  ]
    .filter(Boolean)
    .join(', ');
  const quand =
    p.du === p.au ? `le ${enFrancais(p.du)}` : `du ${enFrancais(p.du)} au ${enFrancais(p.au)}`;
  return `${quand} : ${quoi}`;
};

const modifierTarifs: Outil = {
  definition: {
    name: 'modifier_tarifs',
    description:
      "Change les prix et les conditions de vente d'un logement sur une ou " +
      'plusieurs périodes : prix par nuit, durée minimale de séjour, fermeture à ' +
      'la vente, interdiction d’arrivée ou de départ.\n\n' +
      'REGROUPE TOUJOURS en un seul appel. Si on te demande trois changements de ' +
      'prix sur trois dates, passe les trois plages d’un coup — n’appelle pas ' +
      'l’outil trois fois.\n\n' +
      "NE S'EXÉCUTE PAS immédiatement : l'utilisateur devra confirmer par bouton.",
    input_schema: {
      type: 'object',
      properties: {
        logement: { type: 'string', description: 'Nom du logement.' },
        plages: {
          type: 'array',
          description: 'Les périodes à modifier, toutes en une fois.',
          items: PLAGE_SCHEMA,
        },
      },
      required: ['logement', 'plages'],
      additionalProperties: false,
    },
  },
  ecriture: true,
  executer: async (args, ctx) => {
    const c = await store.conciergerieParChat(ctx.chatId);
    if (!c) return { erreur: 'Aucune conciergerie enregistrée.' };

    const l = await store.logementParNom(c.id, String(args.logement));
    if (!l) {
      const tous = await store.logements(c.id);
      return { erreur: `Logement introuvable : ${args.logement}`, logements_connus: tous.map((x) => x.nom) };
    }
    if (!l.channexRatePlanId) {
      return { erreur: `${l.nom} n'a pas encore de plan tarifaire côté Channex.` };
    }

    const plages = (args.plages as Plage[]) ?? [];
    if (plages.length === 0) return { erreur: 'Aucune période fournie.' };

    for (const p of plages) {
      if (!estValide(p.du) || !estValide(p.au)) {
        return { erreur: `Dates attendues au format AAAA-MM-JJ : ${p.du} → ${p.au}` };
      }
      if (p.au < p.du) return { erreur: `La fin précède le début : ${p.du} → ${p.au}` };
      if (p.prix != null && (p.prix <= 0 || p.prix > 10000)) {
        return { erreur: `Prix invraisemblable : ${p.prix} €. Vérifie avant de confirmer.` };
      }
    }

    const recap =
      `Modifier ${l.nom}\n` + plages.map((p) => `— ${decrire(p)}`).join('\n');

    const id = await store.deposerAction({
      conciergerieId: c.id,
      chatId: String(ctx.chatId),
      outil: 'modifier_tarifs',
      arguments: { logementId: l.id, plages },
      recap,
    });
    ctx.actionEnAttente = { id, recap };

    return {
      _confirmation_requise: true,
      recap,
      plages_groupees: plages.length,
      consigne:
        "Reprends le récapitulatif mot pour mot et demande de confirmer avec le " +
        "bouton. Ne prétends pas que c'est fait.",
    };
  },
};

/** Exécution réelle, après confirmation. Jamais appelée par le modèle. */
export async function appliquerTarifs(args: Record<string, unknown>): Promise<string> {
  const c = await store.conciergerieParChat(String(args.__chatId ?? ''));
  const logements = c ? await store.logements(c.id) : [];
  const l = logements.find((x) => x.id === args.logementId);
  if (!l?.channexPropertyId || !l.channexRatePlanId) {
    return "Logement introuvable ou incomplet, rien n'a été modifié.";
  }

  const plages = (args.plages as Plage[]) ?? [];

  // UN SEUL appel Channex, quel que soit le nombre de plages.
  await channex.definirTarifs(
    plages.map((p) => ({
      proprieteId: l.channexPropertyId!,
      planTarifaireId: l.channexRatePlanId!,
      du: p.du,
      au: p.au,
      prixParNuit: p.prix,
      sejourMinimum: p.sejour_minimum,
      venteArretee: p.ferme_a_la_vente,
      arriveeInterdite: p.arrivee_interdite,
      departInterdit: p.depart_interdit,
    })),
  );

  return (
    `${l.nom} mis à jour :\n` +
    plages.map((p) => `— ${decrire(p)}`).join('\n') +
    '\n\nLa mise à jour part vers les plateformes dans les prochaines minutes.'
  );
}

export const OUTILS_TARIFS: Outil[] = [modifierTarifs];
