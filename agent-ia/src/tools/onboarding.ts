/**
 * Outils de connexion et de configuration.
 *
 * PRINCIPE : la connexion d'abord, les questions ensuite. On ne demande jamais
 * le nom de la conciergerie ni celui des logements avant d'avoir branché un
 * compte — l'essentiel viendra des annonces elles-mêmes, que Repull importe
 * dès que le compte Airbnb ou Booking est autorisé.
 *
 * RÈGLE DE SÉCURITÉ CENTRALE : aucun outil n'accepte d'identifiant Repull ou
 * de base venant du modèle. Tout est résolu par le code depuis le `chatId`
 * authentifié. Si Claude pouvait passer un identifiant d'annonce, une
 * formulation habile suffirait à atteindre les données d'une autre conciergerie.
 */

import { finaliserConnexion, synchroniserAnnonces, urlPublique } from '../comptes.js';
import type { Canal } from '../repull.js';
import * as store from '../store.js';
import type { Contexte, Outil } from './index.js';

const NOM_PROVISOIRE = 'Conciergerie (à nommer)';

/**
 * Renvoie la conciergerie de l'appelant, en la créant à la volée si besoin.
 * C'est ce qui permet d'envoyer un lien dès le premier message, sans interroger
 * l'utilisateur sur son nom.
 */
async function conciergerieOuCreation(ctx: Contexte): Promise<store.Conciergerie> {
  const existante = await store.conciergerieParChat(ctx.chatId);
  if (existante) return existante;
  return store.creerConciergerie(NOM_PROVISOIRE, ctx.chatId);
}

const connecterCompte: Outil = {
  definition: {
    name: 'connecter_compte',
    description:
      "Génère le lien de connexion d'un compte Airbnb ou Booking. C'est LE premier " +
      "outil à appeler, dès qu'on te parle de connexion — tu n'as besoin de RIEN " +
      "savoir au préalable, ni le nom de la conciergerie ni celui des logements : " +
      'les annonces du compte seront importées automatiquement. Un lien = un compte. ' +
      'Appelle-le autant de fois que nécessaire : une conciergerie peut avoir ' +
      'plusieurs comptes Airbnb, chacun donnant lieu à un lien distinct, à ouvrir ' +
      "l'un après l'autre. Le lien reste valable 7 jours.",
    input_schema: {
      type: 'object',
      properties: {
        canal: {
          type: 'string',
          enum: ['airbnb', 'booking'],
          description: 'Plateforme à connecter.',
        },
      },
      required: ['canal'],
      additionalProperties: false,
    },
    strict: true,
  },
  ecriture: true,
  executer: async (args, ctx) => {
    const c = await conciergerieOuCreation(ctx);
    const canal = args.canal as Canal;

    // Le lien pointe sur NOTRE page, pas sur Repull : la conciergerie part de
    // chez Label Maison et y revient. La session Repull est fabriquée au clic,
    // pas maintenant — un lien reçu lundi et ouvert jeudi fonctionne donc encore.
    const lienId = await store.creerLien(c.id, canal);

    return {
      canal,
      lien: `${urlPublique()}/connexion/${lienId}`,
      valide_jours: 7,
      consigne:
        "Envoie le lien tel quel. La page qui s'ouvre est la nôtre et explique " +
        'déjà quoi faire : inutile de détailler la marche à suivre, une phrase ' +
        "suffit. Demande de te prévenir une fois l'autorisation donnée, et " +
        "n'aborde aucun autre sujet pour le moment.",
      ...(canal === 'booking'
        ? {
            _note_booking:
              "Côté Booking.com, il faut désigner le fournisseur de connectivité indiqué " +
              "sur la page depuis l'extranet, puis saisir l'identifiant de l'établissement. " +
              'La validation par Booking peut prendre du temps.',
          }
        : {}),
    };
  },
};

const comptesConnectes: Outil = {
  definition: {
    name: 'comptes_connectes',
    description:
      'Fait le point sur les comptes Airbnb et Booking rattachés, importe les ' +
      "annonces arrivées depuis, et dit ce qui a réellement abouti. À appeler quand " +
      "on te dit avoir cliqué sur un lien, ou quand on te demande où en est la connexion.",
    input_schema: { type: 'object', properties: {}, required: [], additionalProperties: false },
    strict: true,
  },
  executer: async (_args, ctx) => {
    const c = await store.conciergerieParChat(ctx.chatId);
    if (!c) return { aucun_compte: true, consigne: 'Propose de connecter un compte Airbnb.' };

    // Un parcours dont la page de retour n'a pas été vue (onglet fermé trop
    // tôt) est rattrapé ici.
    const suspendus: string[] = [];
    for (const lien of await store.liensEnCoursDe(c.id)) {
      const issue = await finaliserConnexion(lien);
      if (issue.statut === 'ambigu' || issue.statut === 'deja_pris') suspendus.push(lien.canal);
    }

    const importees = await synchroniserAnnonces(c.id);
    const comptes = await store.comptesDe(c.id);
    const logements = await store.logements(c.id);

    return {
      conciergerie: c.nom === NOM_PROVISOIRE ? null : c.nom,
      comptes: comptes.map((x) => (x.canal === 'airbnb' ? 'Airbnb' : 'Booking.com')),
      annonces_importees_a_l_instant: importees,
      logements: logements.map((l) => ({
        logement: l.nom,
        relie_a_une_annonce: Boolean(l.repullListingId),
        airbnb: l.airbnbConnecte ? 'connecté' : 'pas encore',
        booking: l.bookingConnecte ? 'connecté' : 'pas encore',
      })),
      ...(suspendus.length
        ? {
            _verification_en_cours:
              "Une connexion n'a pas pu être rattachée automatiquement à cette conciergerie " +
              '(plusieurs connexions simultanées, ou compte déjà rattaché ailleurs). ' +
              'Dis-le simplement et propose de réessayer dans quelques minutes ; si cela ' +
              'persiste, Label Maison doit vérifier.',
          }
        : {}),
      ...(comptes.length === 0 && suspendus.length === 0
        ? {
            _a_faire:
              "Aucun compte n'a encore abouti. Si la personne dit avoir terminé, " +
              "c'est peut-être que Booking.com n'a pas encore validé, ou que le parcours a " +
              'été interrompu : propose un nouveau lien.',
          }
        : {}),
      ...(c.nom === NOM_PROVISOIRE
        ? { _a_faire_ensuite: 'Le nom de la conciergerie reste à demander, une fois la connexion faite.' }
        : {}),
    };
  },
};

const nommer: Outil = {
  definition: {
    name: 'nommer',
    description:
      "Donne son vrai nom à la conciergerie ou à un logement créé sous un nom " +
      'provisoire. À utiliser une fois la connexion établie, quand on te donne ' +
      "les noms — jamais en les demandant avant d'avoir connecté un compte.",
    input_schema: {
      type: 'object',
      properties: {
        conciergerie: { type: 'string', description: 'Nouveau nom de la conciergerie.' },
        logement_actuel: { type: 'string', description: 'Nom actuel du logement à renommer.' },
        logement_nouveau: { type: 'string', description: 'Son vrai nom.' },
        ville: { type: 'string', description: 'Ville du logement.' },
      },
      required: [],
      additionalProperties: false,
    },
  },
  ecriture: true,
  executer: async (args, ctx) => {
    const c = await store.conciergerieParChat(ctx.chatId);
    if (!c) return { erreur: 'Rien à nommer : aucun compte connecté pour le moment.' };

    const fait: string[] = [];

    if (args.conciergerie) {
      await store.renommerConciergerie(c.id, String(args.conciergerie));
      fait.push(`conciergerie → ${args.conciergerie}`);
    }

    if (args.logement_actuel && args.logement_nouveau) {
      const l = await store.logementParNom(c.id, String(args.logement_actuel));
      if (!l) return { erreur: `Logement introuvable : ${args.logement_actuel}` };
      await store.renommerLogement(l.id, String(args.logement_nouveau), args.ville ? String(args.ville) : null);
      fait.push(`logement → ${args.logement_nouveau}`);
    }

    return fait.length ? { renomme: fait } : { erreur: 'Rien à renommer.' };
  },
};

const ajouterLogement: Outil = {
  definition: {
    name: 'ajouter_logement',
    description:
      'Ajoute un logement dont on veut tenir la fiche (codes, wifi, consignes) sans ' +
      "qu'il soit encore relié à une annonce. Les logements des comptes connectés " +
      "sont créés automatiquement : ne l'utilise pas pour eux. Si une annonce du " +
      'même nom arrive plus tard, elle se rattache à ce logement.',
    input_schema: {
      type: 'object',
      properties: {
        nom: { type: 'string' },
        ville: { type: 'string' },
      },
      required: ['nom', 'ville'],
      additionalProperties: false,
    },
    strict: true,
  },
  ecriture: true,
  executer: async (args, ctx) => {
    const c = await conciergerieOuCreation(ctx);

    // Idempotence : un modèle qui rejoue une étape ne doit pas créer de doublon.
    const deja = await store.logementParNom(c.id, String(args.nom));
    if (deja) return { deja_ajoute: true, nom: deja.nom };

    const l = await store.creerLogement(c.id, String(args.nom), String(args.ville), null);
    const tous = await store.logements(c.id);
    return { ajoute: l.nom, total_logements: tous.length };
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
    const c = await store.conciergerieParChat(ctx.chatId);
    if (!c) return { erreur: 'Aucun compte connecté pour le moment.' };
    const l = await store.logementParNom(c.id, String(args.logement));
    if (!l) return { erreur: `Logement introuvable : ${args.logement}` };

    const corr: Record<string, string> = {
      cle_boite: 'cleBoite',
      wifi_nom: 'wifiNom',
      wifi_code: 'wifiCode',
      heure_arrivee: 'heureArrivee',
      heure_depart: 'heureDepart',
      consignes: 'consignes',
    };
    const champs: Record<string, unknown> = {};
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
      'Fait le point : comptes connectés, logements, fiches remplies, et ce qui ' +
      "manque. À appeler quand tu ne sais pas où tu en es.",
    input_schema: { type: 'object', properties: {}, required: [], additionalProperties: false },
    strict: true,
  },
  executer: async (_args, ctx) => {
    const c = await store.conciergerieParChat(ctx.chatId);
    if (!c) {
      return {
        etape: 'rien_de_connecte',
        consigne: 'Commence par proposer de connecter un compte Airbnb.',
      };
    }

    const tous = await store.logements(c.id);
    const manque: string[] = [];
    if (!tous.some((l) => l.airbnbConnecte || l.bookingConnecte)) manque.push('aucun compte connecté');
    if (c.nom === NOM_PROVISOIRE) manque.push('le nom de la conciergerie');
    if (tous.some((l) => l.nom.includes('à nommer'))) manque.push('le nom des logements');
    if (tous.some((l) => !l.wifiCode || !l.cleBoite)) manque.push('des fiches logement incomplètes');

    return {
      conciergerie: c.nom === NOM_PROVISOIRE ? null : c.nom,
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
  connecterCompte,
  comptesConnectes,
  nommer,
  ajouterLogement,
  enregistrerInfos,
  etatConfiguration,
];
