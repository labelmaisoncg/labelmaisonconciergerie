/**
 * Outils d'onboarding.
 *
 * RÈGLE DE SÉCURITÉ CENTRALE : aucun de ces outils n'accepte d'identifiant
 * Channex venant du modèle. Les `group_id` et `property_id` sont résolus par le
 * code à partir du `chat_id` authentifié. Si Claude pouvait passer un
 * `property_id` en argument, une formulation habile suffirait à lire ou modifier
 * les données d'une autre conciergerie.
 *
 * Le modèle ne manipule que des NOMS ; le code fait la traduction.
 */

import * as channex from '../channex.js';
import { conciergerieDe, enregistrerConciergerie, logementPar } from '../etat.js';
import type { Outil } from './index.js';

const creerConciergerie: Outil = {
  definition: {
    name: 'creer_conciergerie',
    description:
      "Enregistre une nouvelle conciergerie. À appeler une seule fois, au tout " +
      'début, dès que la personne a donné le nom de sa conciergerie.',
    input_schema: {
      type: 'object',
      properties: { nom: { type: 'string', description: 'Nom de la conciergerie.' } },
      required: ['nom'],
      additionalProperties: false,
    },
    strict: true,
  },
  ecriture: true,
  executer: async (args, ctx) => {
    const existante = conciergerieDe(ctx.chatId);
    if (existante) return { deja_enregistree: true, nom: existante.nom };

    const groupe = await channex.creerGroupe(String(args.nom));
    enregistrerConciergerie({
      chatId: String(ctx.chatId),
      nom: groupe.titre,
      groupId: groupe.id,
      logements: [],
    });
    return { cree: true, nom: groupe.titre };
  },
};

const ajouterLogement: Outil = {
  definition: {
    name: 'ajouter_logement',
    description:
      "Ajoute un logement à la conciergerie. Nécessaire avant de pouvoir générer " +
      'un lien de connexion Airbnb ou Booking, car chaque connexion se fait ' +
      'logement par logement.',
    input_schema: {
      type: 'object',
      properties: {
        nom: { type: 'string', description: 'Nom du logement, tel que la conciergerie l\'appelle.' },
        ville: { type: 'string', description: 'Ville du logement.' },
      },
      required: ['nom', 'ville'],
      additionalProperties: false,
    },
    strict: true,
  },
  ecriture: true,
  executer: async (args, ctx) => {
    const c = conciergerieDe(ctx.chatId);
    if (!c) return { erreur: "Enregistre d'abord la conciergerie avec creer_conciergerie." };

    // Idempotence. Sans ce garde-fou, un modèle qui rejoue une étape crée un
    // doublon chez Channex — et un doublon de propriété est facturé.
    const deja = logementPar(c, String(args.nom));
    if (deja) return { deja_ajoute: true, nom: deja.titre, total_logements: c.logements.length };

    const propriete = await channex.creerPropriete({
      titre: String(args.nom),
      ville: String(args.ville),
      groupId: c.groupId,
    });
    c.logements.push({
      id: propriete.id,
      titre: propriete.titre,
      airbnbConnecte: false,
      bookingConnecte: false,
    });
    return { ajoute: propriete.titre, total_logements: c.logements.length };
  },
};

const lienConnexion: Outil = {
  definition: {
    name: 'lien_connexion',
    description:
      "Génère le lien que la conciergerie doit ouvrir pour connecter son compte " +
      'Airbnb ou Booking à un logement. Envoie-lui ce lien tel quel. ' +
      'IMPORTANT : le lien expire au bout de 15 minutes — si elle revient plus ' +
      'tard sans avoir cliqué, régénère-en un au lieu de renvoyer le même.',
    input_schema: {
      type: 'object',
      properties: {
        logement: { type: 'string', description: 'Nom du logement concerné.' },
        canal: { type: 'string', enum: ['airbnb', 'booking'], description: 'Plateforme à connecter.' },
      },
      required: ['logement', 'canal'],
      additionalProperties: false,
    },
    strict: true,
  },
  executer: async (args, ctx) => {
    const c = conciergerieDe(ctx.chatId);
    if (!c) return { erreur: "Conciergerie inconnue." };

    const l = logementPar(c, String(args.logement));
    if (!l) {
      return {
        erreur: `Logement introuvable : ${args.logement}`,
        logements_connus: c.logements.map((x) => x.titre),
      };
    }

    const canal = args.canal === 'booking' ? channex.BOOKING : channex.AIRBNB;
    const lien = await channex.lienConnexion(l.id, c.groupId, canal, c.nom);

    return {
      logement: l.titre,
      canal: args.canal,
      lien,
      valide_minutes: 15,
      ...(channex.enProduction()
        ? {}
        : {
            _avertissement:
              'ENVIRONNEMENT DE TEST (staging Channex). Ce lien NE connectera PAS ' +
              "un vrai compte Airbnb ou Booking. Préviens-en l'utilisateur.",
          }),
      ...(args.canal === 'booking'
        ? {
            _note_booking:
              'Booking exige en plus une validation de Channex comme fournisseur ' +
              'de connectivité depuis leur extranet : compter plusieurs jours.',
          }
        : {}),
    };
  },
};

const verifierConnexion: Outil = {
  definition: {
    name: 'verifier_connexion',
    description:
      "Vérifie quelles plateformes sont effectivement connectées à un logement. " +
      "À appeler après que la personne dit avoir cliqué sur le lien, pour confirmer " +
      'que la connexion a bien abouti.',
    input_schema: {
      type: 'object',
      properties: { logement: { type: 'string', description: 'Nom du logement.' } },
      required: ['logement'],
      additionalProperties: false,
    },
    strict: true,
  },
  executer: async (args, ctx) => {
    const c = conciergerieDe(ctx.chatId);
    if (!c) return { erreur: 'Conciergerie inconnue.' };
    const l = logementPar(c, String(args.logement));
    if (!l) return { erreur: `Logement introuvable : ${args.logement}` };

    const canaux = await channex.listerCanaux(l.id);
    l.airbnbConnecte = canaux.some((x) => x.canal === channex.AIRBNB && x.actif);
    l.bookingConnecte = canaux.some((x) => x.canal === channex.BOOKING && x.actif);

    return {
      logement: l.titre,
      airbnb: l.airbnbConnecte ? 'connecté' : 'pas encore',
      booking: l.bookingConnecte ? 'connecté' : 'pas encore',
      canaux: canaux.map((x) => x.titre),
    };
  },
};

const etatConfiguration: Outil = {
  definition: {
    name: 'etat_configuration',
    description:
      "Fait le point sur la configuration : conciergerie enregistrée, logements " +
      'ajoutés, plateformes connectées, et ce qui manque encore.',
    input_schema: { type: 'object', properties: {}, required: [], additionalProperties: false },
    strict: true,
  },
  executer: async (_args, ctx) => {
    const c = conciergerieDe(ctx.chatId);
    if (!c) return { etape: 'debut', manque: 'le nom de la conciergerie' };

    return {
      conciergerie: c.nom,
      logements: c.logements.map((l) => ({
        nom: l.titre,
        airbnb: l.airbnbConnecte,
        booking: l.bookingConnecte,
      })),
      manque: [
        c.logements.length === 0 ? 'aucun logement ajouté' : null,
        c.logements.some((l) => !l.airbnbConnecte) ? 'des connexions Airbnb' : null,
        c.logements.some((l) => !l.bookingConnecte) ? 'des connexions Booking' : null,
      ].filter(Boolean),
    };
  },
};

export const OUTILS_ONBOARDING: Outil[] = [
  creerConciergerie,
  ajouterLogement,
  lienConnexion,
  verifierConnexion,
  etatConfiguration,
];
