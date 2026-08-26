/**
 * Outils d'onboarding : connecter les comptes, décrire les logements.
 *
 * RÈGLE DE SÉCURITÉ CENTRALE : aucun outil n'accepte d'identifiant Channex ou
 * de base venant du modèle. Les `group_id` et `property_id` sont résolus par le
 * code à partir du `chat_id` authentifié. Si Claude pouvait passer un
 * `property_id` en argument, une formulation habile suffirait à lire ou modifier
 * les données d'une autre conciergerie.
 *
 * Le modèle ne manipule que des NOMS ; le code fait la traduction.
 */

import * as channex from '../channex.js';
import * as store from '../store.js';
import type { Outil } from './index.js';

/** Résout la conciergerie de l'appelant, ou explique quoi faire. */
async function laConciergerie(chatId: string | number) {
  const c = await store.conciergerieParChat(chatId);
  if (!c) throw new Error("Aucune conciergerie n'est encore enregistrée pour cette conversation.");
  return c;
}

const creerConciergerie: Outil = {
  definition: {
    name: 'creer_conciergerie',
    description:
      "Enregistre la conciergerie. À appeler une seule fois, dès que la personne " +
      'a donné son nom. Sans elle, aucun autre outil ne fonctionne.',
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
    const existante = await store.conciergerieParChat(ctx.chatId);
    if (existante) return { deja_enregistree: true, nom: existante.nom };

    const groupe = await channex.creerGroupe(String(args.nom));
    const c = await store.creerConciergerie(groupe.titre, groupe.id, ctx.chatId);
    return { cree: true, nom: c.nom };
  },
};

const ajouterLogement: Outil = {
  definition: {
    name: 'ajouter_logement',
    description:
      "Ajoute un logement. Indispensable avant de générer un lien de connexion : " +
      'chaque connexion Airbnb ou Booking se fait logement par logement.',
    input_schema: {
      type: 'object',
      properties: {
        nom: { type: 'string', description: "Nom du logement, tel que la conciergerie l'appelle." },
        ville: { type: 'string', description: 'Ville du logement.' },
      },
      required: ['nom', 'ville'],
      additionalProperties: false,
    },
    strict: true,
  },
  ecriture: true,
  executer: async (args, ctx) => {
    const c = await laConciergerie(ctx.chatId);

    // Idempotence : sans ce garde-fou, un modèle qui rejoue une étape crée un
    // doublon chez Channex — et un doublon de propriété est facturé.
    const deja = await store.logementParNom(c.id, String(args.nom));
    if (deja) return { deja_ajoute: true, nom: deja.nom };

    const propriete = await channex.creerPropriete({
      titre: String(args.nom),
      ville: String(args.ville),
      groupId: c.channexGroupId!,
    });
    const l = await store.creerLogement(c.id, propriete.titre, String(args.ville), propriete.id);
    const tous = await store.logements(c.id);
    return { ajoute: l.nom, total_logements: tous.length };
  },
};

const lienConnexion: Outil = {
  definition: {
    name: 'lien_connexion',
    description:
      "Génère le lien que la conciergerie ouvre pour connecter son compte Airbnb " +
      'ou Booking à un logement. Envoie-lui ce lien tel quel, sans le raccourcir. ' +
      "IMPORTANT : il expire au bout de 15 minutes. Si elle revient plus tard sans " +
      'avoir cliqué, régénère-en un plutôt que de renvoyer le même.',
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
    const c = await laConciergerie(ctx.chatId);
    const l = await store.logementParNom(c.id, String(args.logement));
    if (!l) {
      const tous = await store.logements(c.id);
      return { erreur: `Logement introuvable : ${args.logement}`, logements_connus: tous.map((x) => x.nom) };
    }

    const canal = args.canal as channex.Canal;
    const propId = l.channexPropertyId!;

    // Le canal est créé AVANT l'envoi du lien : la cliente tombe alors
    // directement sur le bouton de connexion, au lieu d'un formulaire vide.
    let canalId: string | undefined;
    try {
      const existants = await channex.canauxDe(propId);
      const attendu = canal === 'airbnb' ? 'AirBNB' : 'BookingCom';
      canalId =
        existants.find((x) => x.code === attendu)?.id ??
        (await channex.creerCanal(propId, c.channexGroupId!, canal)).id;
    } catch (err) {
      // Pas bloquant : sans canal préexistant, le lien mène au formulaire de
      // création. Un clic de plus, mais la connexion reste possible.
      console.warn('[onboarding] création du canal impossible :', err);
    }

    const lien = await channex.lienConnexion(propId, c.channexGroupId!, canal, c.nom, canalId);

    return {
      logement: l.nom,
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
      ...(canal === 'booking'
        ? {
            _note_booking:
              'Booking exige en plus une validation de Channex comme fournisseur de ' +
              'connectivité depuis leur extranet : compter plusieurs jours. Autant lancer tôt.',
          }
        : {}),
    };
  },
};

const verifierConnexion: Outil = {
  definition: {
    name: 'verifier_connexion',
    description:
      "Vérifie quelles plateformes sont réellement connectées à un logement. " +
      "À appeler quand la personne dit avoir cliqué, pour confirmer que ça a abouti.",
    input_schema: {
      type: 'object',
      properties: { logement: { type: 'string', description: 'Nom du logement.' } },
      required: ['logement'],
      additionalProperties: false,
    },
    strict: true,
  },
  executer: async (args, ctx) => {
    const c = await laConciergerie(ctx.chatId);
    const l = await store.logementParNom(c.id, String(args.logement));
    if (!l) return { erreur: `Logement introuvable : ${args.logement}` };

    const canaux = await channex.canauxDe(l.channexPropertyId!);
    const airbnb = canaux.some((x) => x.code === 'AirBNB' && x.actif);
    const booking = canaux.some((x) => x.code === 'BookingCom' && x.actif);
    await store.majLogement(l.id, { airbnbConnecte: airbnb, bookingConnecte: booking });

    return {
      logement: l.nom,
      airbnb: airbnb ? 'connecté' : 'pas encore',
      booking: booking ? 'connecté' : 'pas encore',
      canaux_montes: canaux.map((x) => `${x.titre}${x.actif ? '' : ' (inactif)'}`),
    };
  },
};

const enregistrerInfos: Outil = {
  definition: {
    name: 'enregistrer_infos_logement',
    description:
      "Enregistre ce que l'API des plateformes ne donne pas : code de boîte à clés, " +
      "wifi, horaires d'arrivée et de départ, consignes. Ces informations servent " +
      'ensuite à répondre aux voyageurs — un code périmé ici devient un code périmé ' +
      'envoyé à un voyageur à minuit.',
    input_schema: {
      type: 'object',
      properties: {
        logement: { type: 'string' },
        cle_boite: { type: 'string' },
        wifi_nom: { type: 'string' },
        wifi_code: { type: 'string' },
        heure_arrivee: { type: 'string' },
        heure_depart: { type: 'string' },
        consignes: { type: 'string' },
      },
      required: ['logement'],
      additionalProperties: false,
    },
  },
  ecriture: true,
  executer: async (args, ctx) => {
    const c = await laConciergerie(ctx.chatId);
    const l = await store.logementParNom(c.id, String(args.logement));
    if (!l) return { erreur: `Logement introuvable : ${args.logement}` };

    const champs: Record<string, unknown> = {};
    const corr: Record<string, string> = {
      cle_boite: 'cleBoite',
      wifi_nom: 'wifiNom',
      wifi_code: 'wifiCode',
      heure_arrivee: 'heureArrivee',
      heure_depart: 'heureDepart',
      consignes: 'consignes',
    };
    for (const [entree, interne] of Object.entries(corr)) {
      if (args[entree] != null) champs[interne] = args[entree];
    }
    if (Object.keys(champs).length === 0) return { erreur: 'Aucune information à enregistrer.' };

    await store.majLogement(l.id, champs);
    return { enregistre: l.nom, champs: Object.keys(champs) };
  },
};

const etatConfiguration: Outil = {
  definition: {
    name: 'etat_configuration',
    description:
      'Fait le point : conciergerie, logements, plateformes connectées, fiches ' +
      "remplies, et ce qui manque. À appeler quand tu ne sais pas où tu en es.",
    input_schema: { type: 'object', properties: {}, required: [], additionalProperties: false },
    strict: true,
  },
  executer: async (_args, ctx) => {
    const c = await store.conciergerieParChat(ctx.chatId);
    if (!c) return { etape: 'debut', manque: 'le nom de la conciergerie' };

    const tous = await store.logements(c.id);
    const manque: string[] = [];
    if (tous.length === 0) manque.push('aucun logement ajouté');
    if (tous.some((l) => !l.airbnbConnecte)) manque.push('des connexions Airbnb');
    if (tous.some((l) => !l.bookingConnecte)) manque.push('des connexions Booking');
    if (tous.some((l) => !l.wifiCode || !l.cleBoite)) manque.push('des fiches logement incomplètes');

    return {
      conciergerie: c.nom,
      persistance: store.persistanceReelle() ? 'base de données' : 'MÉMOIRE (perdue au redémarrage)',
      logements: tous.map((l) => ({
        nom: l.nom,
        airbnb: l.airbnbConnecte,
        booking: l.bookingConnecte,
        fiche_complete: Boolean(l.wifiCode && l.cleBoite && l.heureArrivee),
      })),
      manque,
    };
  },
};

export const OUTILS_ONBOARDING: Outil[] = [
  creerConciergerie,
  ajouterLogement,
  lienConnexion,
  verifierConnexion,
  enregistrerInfos,
  etatConfiguration,
];
