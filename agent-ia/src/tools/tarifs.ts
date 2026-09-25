/**
 * Tarifs et restrictions.
 *
 * Comme les blocages de calendrier, ces outils N'ÉCRIVENT PAS directement :
 * ils préparent l'action et attendent la confirmation par bouton. Un prix
 * erroné parti chez Airbnb, c'est une nuit vendue à 20 € ou un logement qui ne
 * se vend plus.
 *
 * Le GROUPAGE reste la règle : le modèle passe toutes les plages d'un coup, et
 * le client Repull regroupe les plages aux réglages identiques en une seule
 * écriture. Chaque appel compte dans le quota mensuel Repull.
 *
 * Les interdictions d'arrivée ou de départ ne sont pas proposées : le
 * calendrier unifié de Repull ne les porte pas.
 */

import * as repull from '../repull.js';
import * as store from '../store.js';
import { ajouterJours, enFrancais, estValide } from '../dates.js';
import type { Contexte, Outil } from './index.js';

/** Logement sans annonce Repull : rien à écrire. Partagé avec les blocages. */
export const NON_RELIE = (nom: string): string =>
  `${nom} n'est relié à aucune annonce Airbnb ou Booking : impossible d'écrire le calendrier. ` +
  "Connecte d'abord le compte (outil connecter_compte).";

type Plage = {
  du: string;
  au: string;
  prix?: number;
  sejour_minimum?: number;
  ferme_a_la_vente?: boolean;
};

const PLAGE_SCHEMA = {
  type: 'object' as const,
  properties: {
    du: { type: 'string', description: 'AAAA-MM-JJ, premier jour concerné.' },
    au: { type: 'string', description: 'AAAA-MM-JJ, dernier jour concerné.' },
    prix: { type: 'number', description: 'Prix par nuit en euros.' },
    sejour_minimum: { type: 'number', description: 'Nombre de nuits minimum à l’arrivée.' },
    ferme_a_la_vente: {
      type: 'boolean',
      description: 'true = le logement ne se vend plus. Pour remettre en vente, utilise debloquer_dates.',
    },
  },
  required: ['du', 'au'],
  additionalProperties: false,
};

const decrire = (p: Plage): string => {
  const quoi = [
    p.prix != null && `${p.prix} € la nuit`,
    p.sejour_minimum != null && `minimum ${p.sejour_minimum} nuit(s)`,
    p.ferme_a_la_vente === true && 'fermé à la vente',
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
      'la vente. Les interdictions d’arrivée ou de départ ne sont pas gérées : ' +
      'dis-le si on te les demande. Pour remettre des dates en vente, utilise ' +
      'debloquer_dates, qui protège les nuits déjà réservées.\n\n' +
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
    if (!l.repullListingId) return { erreur: NON_RELIE(l.nom) };

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
      if (p.sejour_minimum != null && (!Number.isInteger(p.sejour_minimum) || p.sejour_minimum < 1)) {
        return { erreur: `Séjour minimum invalide : ${p.sejour_minimum}. Un nombre entier de nuits, au moins 1.` };
      }
      if (p.ferme_a_la_vente === false) {
        return { erreur: 'Pour remettre des dates en vente, utilise debloquer_dates : il protège les nuits déjà réservées.' };
      }
      if (p.prix == null && p.sejour_minimum == null && p.ferme_a_la_vente !== true) {
        return { erreur: `Rien à changer sur ${p.du} → ${p.au} : indique un prix, un séjour minimum ou une fermeture.` };
      }
      if (ajouterJours(p.du, 731) <= p.au) {
        return { erreur: 'Plage trop longue : 731 jours au maximum.' };
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
  if (!l) return "Logement introuvable, rien n'a été modifié.";
  if (!l.repullListingId) return NON_RELIE(l.nom);
  const annonceId = l.repullListingId;

  const plages = (args.plages as Plage[]) ?? [];

  const avertissement = await repull.definirTarifs(
    plages.map((p) => ({
      annonceId,
      du: p.du,
      au: p.au,
      prixParNuit: p.prix,
      sejourMinimum: p.sejour_minimum,
      venteArretee: p.ferme_a_la_vente === true,
    })),
  );

  return (
    `${l.nom} mis à jour :\n` +
    plages.map((p) => `— ${decrire(p)}`).join('\n') +
    (avertissement
      ? `\n\nAttention : ${avertissement}. Vérifie le calendrier sur la plateforme concernée.`
      : '\n\nLa mise à jour part vers les plateformes connectées.')
  );
}

export const OUTILS_TARIFS: Outil[] = [modifierTarifs];
