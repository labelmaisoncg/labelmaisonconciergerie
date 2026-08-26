/**
 * Outils de connexion et de configuration.
 *
 * PRINCIPE : la connexion d'abord, les questions ensuite. On ne demande jamais
 * le nom de la conciergerie ni celui des logements avant d'avoir branché un
 * compte — l'essentiel viendra des annonces elles-mêmes.
 *
 * Contrainte Channex : fabriquer un lien exige un `group` et une `property`
 * existants. On les crée donc en silence, sous un nom provisoire, et on les
 * renomme plus tard. L'utilisateur ne voit que le lien.
 *
 * RÈGLE DE SÉCURITÉ CENTRALE : aucun outil n'accepte d'identifiant Channex ou
 * de base venant du modèle. Tout est résolu par le code depuis le `chatId`
 * authentifié. Si Claude pouvait passer un `property_id`, une formulation
 * habile suffirait à atteindre les données d'une autre conciergerie.
 */

import * as channex from '../channex.js';
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

  // Une conciergerie enrôlée par invitation existe en base mais n'a pas encore
  // de groupe Channex : on le crée au premier besoin réel, pas à l'inscription.
  if (existante?.channexGroupId) return existante;
  if (existante) {
    const groupe = await channex.creerGroupe(existante.nom);
    await store.definirGroupeChannex(existante.id, groupe.id);
    return { ...existante, channexGroupId: groupe.id };
  }

  const groupe = await channex.creerGroupe(NOM_PROVISOIRE);
  return store.creerConciergerie(NOM_PROVISOIRE, groupe.id, ctx.chatId);
}

const connecterCompte: Outil = {
  definition: {
    name: 'connecter_compte',
    description:
      "Génère le lien de connexion d'un compte Airbnb ou Booking. C'est LE premier " +
      "outil à appeler, dès qu'on te parle de connexion — tu n'as besoin de RIEN " +
      "savoir au préalable, ni le nom de la conciergerie ni celui des logements. " +
      "Appelle-le autant de fois que nécessaire : une conciergerie peut avoir " +
      'plusieurs comptes Airbnb, chacun donnant lieu à un lien distinct. ' +
      'Envoie le lien tel quel. Il expire au bout de 15 minutes — au-delà, ' +
      "régénère-en un plutôt que de renvoyer le même.",
    input_schema: {
      type: 'object',
      properties: {
        canal: {
          type: 'string',
          enum: ['airbnb', 'booking'],
          description: 'Plateforme à connecter.',
        },
        etiquette: {
          type: 'string',
          description:
            "Nom donné à ce compte quand la conciergerie en a plusieurs " +
            "(« compte perso », « compte agence »). Facultatif.",
        },
        logement: {
          type: 'string',
          description:
            'Rattacher ce compte à un logement déjà connu. Facultatif : sans lui, ' +
            'un emplacement provisoire est créé et sera nommé plus tard.',
        },
        nouveau_compte: {
          type: 'boolean',
          description:
            "true quand on te demande d'AJOUTER un compte supplémentaire " +
            "(« je veux ajouter un autre compte Airbnb »). false quand il s'agit de " +
            'régénérer un lien pour un compte déjà entamé (lien expiré, clic raté). ' +
            'La différence compte : un nouveau compte a ses propres annonces et ne ' +
            "doit pas écraser le précédent.",
        },
      },
      required: ['canal'],
      additionalProperties: false,
    },
  },
  ecriture: true,
  executer: async (args, ctx) => {
    const c = await conciergerieOuCreation(ctx);
    const canal = args.canal as channex.Canal;
    const nouveau = args.nouveau_compte === true;

    // Choix de la propriété support. Un compte supplémentaire a ses propres
    // annonces : il lui faut son propre emplacement, sinon le second compte
    // écrase le premier sur la même propriété Channex.
    let logement: store.Logement | null = null;
    if (args.logement) {
      logement = await store.logementParNom(c.id, String(args.logement));
      if (!logement) return { erreur: `Logement introuvable : ${args.logement}` };
    } else if (!nouveau) {
      const tous = await store.logements(c.id);
      logement = tous[0] ?? null;
    }

    if (!logement) {
      const tous = await store.logements(c.id);
      const titre = String(args.etiquette || `Logement ${tous.length + 1} (à nommer)`);
      const provisoire = await channex.creerPropriete({
        titre,
        ville: 'France',
        groupId: c.channexGroupId!,
      });
      logement = await store.creerLogement(c.id, provisoire.titre, 'France', provisoire.id);
    }

    const propId = logement.channexPropertyId!;
    const attendu = canal === 'airbnb' ? 'AirBNB' : 'BookingCom';

    // On ne réutilise un canal que pour reprendre une connexion inachevée.
    // Pour un compte supplémentaire, on en crée toujours un nouveau.
    let canalId: string | undefined;
    try {
      const existants = nouveau ? [] : await channex.canauxDe(propId);
      const inacheve = existants.find((x) => x.code === attendu && !x.actif);
      canalId = inacheve?.id ?? (await channex.creerCanal(propId, c.channexGroupId!, canal)).id;
    } catch (err) {
      // Pas bloquant : sans canal préexistant, le lien mène au formulaire de
      // création. Un clic de plus, mais la connexion reste possible.
      console.warn('[onboarding] création du canal impossible :', err);
    }

    // Le lien pointe sur NOTRE page, pas sur Channex : la conciergerie reste
    // chez Label Maison, et le jeton Channex — qui ne vit que 15 minutes — sera
    // fabriqué à l'ouverture de la page, pas maintenant. Un lien reçu lundi et
    // ouvert jeudi fonctionne donc encore.
    const lienId = await store.creerLien(c.id, logement.id, canal, canalId ?? null);
    const base = (process.env.APP_URL || 'https://agent-ia-ochre.vercel.app').replace(/\/$/, '');
    const lien = `${base}/connexion/${lienId}`;

    return {
      canal: args.canal,
      etiquette: args.etiquette ?? null,
      lien,
      valide_jours: 7,
      consigne:
        "Envoie le lien tel quel. La page qui s'ouvre est la nôtre et explique " +
        'déjà quoi faire : inutile de détailler la marche à suivre, une phrase ' +
        "suffit. Demande de te prévenir une fois l'autorisation donnée, et " +
        "n'aborde aucun autre sujet pour le moment.",
      ...(channex.enProduction()
        ? {}
        : {
            _avertissement:
              'ENVIRONNEMENT DE TEST (staging Channex). Ce lien NE connectera PAS un ' +
              "vrai compte. Préviens-en l'utilisateur.",
          }),
      ...(canal === 'booking'
        ? {
            _note_booking:
              'Booking exige en plus une validation de Channex comme fournisseur de ' +
              'connectivité depuis leur extranet : compter plusieurs jours.',
          }
        : {}),
    };
  },
};

const comptesConnectes: Outil = {
  definition: {
    name: 'comptes_connectes',
    description:
      'Liste les comptes Airbnb et Booking rattachés, et lesquels ont réellement ' +
      "abouti. À appeler quand on te dit avoir cliqué sur un lien, ou quand on te " +
      'demande où en est la connexion.',
    input_schema: { type: 'object', properties: {}, required: [], additionalProperties: false },
    strict: true,
  },
  executer: async (_args, ctx) => {
    const c = await store.conciergerieParChat(ctx.chatId);
    if (!c) return { aucun_compte: true, consigne: 'Propose de connecter un compte Airbnb.' };

    const logements = await store.logements(c.id);
    const lignes = [];
    for (const l of logements) {
      if (!l.channexPropertyId) continue;
      const canaux = await channex.canauxDe(l.channexPropertyId);
      const airbnb = canaux.some((x) => x.code === 'AirBNB' && x.actif);
      const booking = canaux.some((x) => x.code === 'BookingCom' && x.actif);
      await store.majLogement(l.id, { airbnbConnecte: airbnb, bookingConnecte: booking });
      lignes.push({
        logement: l.nom,
        airbnb: airbnb ? 'connecté' : 'pas encore',
        booking: booking ? 'connecté' : 'pas encore',
        canaux: canaux.map((x) => `${x.titre}${x.actif ? '' : ' (en attente)'}`),
      });
    }

    return {
      conciergerie: c.nom === NOM_PROVISOIRE ? null : c.nom,
      comptes: lignes,
      ...(c.nom === NOM_PROVISOIRE
        ? { _a_faire: 'Le nom de la conciergerie reste à demander, une fois la connexion faite.' }
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
      'Ajoute un logement supplémentaire. Utile quand la conciergerie en gère ' +
      "plusieurs et qu'ils ne sont pas tous couverts par les comptes connectés.",
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
