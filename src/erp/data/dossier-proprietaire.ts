/**
 * Dossier propriétaire (mise en service d'un logement) : le formulaire que le
 * propriétaire remplit après l'appel, sur /dossier-proprietaire. Ses réponses
 * deviennent l'Annexe 1 du contrat de gestion (inventaire de référence).
 *
 * Partagé par la page du site, l'API (/api/dossier-proprietaire) et l'ERP.
 * Imports en `.js` : ce module est aussi chargé par les fonctions Vercel (ESM).
 */
import { CHECKLIST_LANCEMENT } from './constantes.js';
import type { Champ, Etape, Valeurs } from './etapes-formulaire.js';
import type { DossierProprietaire, Id, Logement, Proprietaire, Serrure, TypeLogement, TypeProprietaire } from './types.js';

/** Adresse publique du dossier, la même pour tous les propriétaires. */
export const ADRESSE_DOSSIER = 'https://www.labelmaisoncg.fr/dossier-proprietaire';
export const CHEMIN_DOSSIER = '/dossier-proprietaire';

const texte = (v: Valeurs, k: string) => String(v[k] ?? '').trim();
const egal = (k: string, ...valeurs: string[]) => (v: Valeurs) => valeurs.includes(texte(v, k));

/**
 * L'essentiel seulement : 13 écrans (15 au plus), environ 3 minutes. Le
 * détail (inventaire pièce par pièce, consommables, documents) se fait à la
 * visite de mise en service.
 */
export const ETAPES_DOSSIER: Etape[] = [
  /* ------------------------------------------------------------- Vous */
  {
    id: 'coordonnees',
    partie: 'Vous',
    question: 'Qui êtes-vous ?',
    aide: 'Pour vous joindre et vous envoyer le contrat.',
    champs: [
      { id: 'prop.prenom', libelle: 'Prénom', type: 'texte', requis: true, autocomplete: 'given-name', longueurMax: 80 },
      { id: 'prop.nom', libelle: 'Nom', type: 'texte', requis: true, autocomplete: 'family-name', longueurMax: 80 },
      { id: 'prop.tel', libelle: 'Téléphone', type: 'tel', requis: true, autocomplete: 'tel', longueurMax: 30 },
      { id: 'prop.email', libelle: 'E-mail', type: 'email', requis: true, autocomplete: 'email', longueurMax: 160 },
    ],
  },
  {
    id: 'qualite',
    partie: 'Vous',
    question: 'À quel titre êtes-vous propriétaire ?',
    champs: [
      {
        id: 'prop.qualite',
        libelle: 'Qualité',
        type: 'choix',
        requis: true,
        options: [
          { valeur: 'particulier', libelle: 'En nom propre' },
          { valeur: 'indivision', libelle: 'En indivision', aide: 'Plusieurs propriétaires' },
          { valeur: 'societe', libelle: 'Via une société', aide: 'SCI, SARL…' },
        ],
      },
    ],
  },
  {
    id: 'societe',
    partie: 'Vous',
    question: 'Au nom de quelle société ou indivision ?',
    aide: 'Pour rédiger le contrat au bon nom.',
    si: egal('prop.qualite', 'societe', 'indivision'),
    champs: [{ id: 'prop.societe', libelle: 'Dénomination', type: 'texte', requis: true, placeholder: 'SCI Les Tilleuls', longueurMax: 120 }],
  },
  {
    id: 'adresse_postale',
    partie: 'Vous',
    question: 'Quelle est votre adresse postale ?',
    aide: 'Celle qui figurera sur le contrat.',
    champs: [{ id: 'prop.adresse', libelle: 'Adresse postale', type: 'texte', requis: true, autocomplete: 'street-address', placeholder: 'N°, rue, code postal, ville' }],
  },

  /* ------------------------------------------------------- Le logement */
  {
    id: 'bien_adresse',
    partie: 'Le logement',
    question: 'Où se trouve le logement ?',
    champs: [
      { id: 'bien.adresse', libelle: 'Adresse', type: 'texte', requis: true, placeholder: 'N° et rue', autocomplete: 'address-line1' },
      { id: 'bien.complement', libelle: 'Complément', type: 'texte', placeholder: 'Bâtiment, étage, porte', autocomplete: 'address-line2' },
      { id: 'bien.cp', libelle: 'Code postal', type: 'texte', requis: true, format: 'code_postal', autocomplete: 'postal-code', longueurMax: 5 },
      { id: 'bien.ville', libelle: 'Ville', type: 'texte', requis: true, autocomplete: 'address-level2', longueurMax: 80 },
    ],
  },
  {
    id: 'bien_type',
    partie: 'Le logement',
    question: 'Quel type de logement est-ce ?',
    champs: [
      {
        id: 'bien.type',
        libelle: 'Type',
        type: 'choix',
        requis: true,
        options: [
          { valeur: 'studio', libelle: 'Studio' },
          { valeur: 'T1', libelle: 'T1' },
          { valeur: 'T2', libelle: 'T2' },
          { valeur: 'T3', libelle: 'T3' },
          { valeur: 'T4', libelle: 'T4 ou plus' },
          { valeur: 'maison', libelle: 'Maison' },
        ],
      },
    ],
  },
  {
    id: 'bien_taille',
    partie: 'Le logement',
    question: 'Combien de voyageurs peut-il accueillir ?',
    aide: 'Le nombre de couchages fixe la capacité de l’annonce.',
    champs: [
      { id: 'bien.couchages', libelle: 'Voyageurs au maximum', type: 'nombre', requis: true, min: 1, max: 30 },
      { id: 'bien.chambres', libelle: 'Chambres', type: 'nombre', min: 0, max: 30 },
      { id: 'bien.surface', libelle: 'Surface (m²)', type: 'nombre', min: 5, max: 2000 },
    ],
  },
  {
    id: 'bien_residence',
    partie: 'Le logement',
    question: 'Est-ce votre résidence principale ?',
    champs: [
      {
        id: 'bien.residence',
        libelle: 'Résidence principale',
        type: 'choix',
        requis: true,
        options: [
          { valeur: 'secondaire', libelle: 'Non, il est dédié à la location', aide: 'Résidence secondaire ou investissement' },
          { valeur: 'principale', libelle: 'Oui, c’est ma résidence principale' },
        ],
      },
    ],
    note: (v) =>
      texte(v, 'bien.residence') === 'principale'
        ? 'Une résidence principale se loue 120 nuits par an au plus (article L.324-1-1 du Code du tourisme). Nous bloquons le calendrier en conséquence.'
        : undefined,
  },
  {
    id: 'acces',
    partie: 'Le logement',
    question: 'Comment entre-t-on dans le logement ?',
    champs: [
      {
        id: 'acces.mode',
        libelle: 'Accès',
        type: 'choix',
        requis: true,
        options: [
          { valeur: 'boite', libelle: 'Boîte à clés à code' },
          { valeur: 'connectee', libelle: 'Serrure connectée' },
          { valeur: 'cles', libelle: 'Clés à remettre' },
        ],
      },
    ],
  },

  /* ------------------------------------------------------ Pour démarrer */
  {
    id: 'manquants',
    partie: 'Pour démarrer',
    question: 'Que manque-t-il dans le logement ?',
    aide: 'Cochez seulement ce qui manque. Nous vérifions le reste à la visite.',
    champs: [
      {
        id: 'equip.manquants',
        libelle: 'À fournir',
        type: 'multi',
        options: [
          { valeur: 'rien', libelle: 'Rien, tout est là' },
          { valeur: 'vaisselle', libelle: 'Vaisselle et ustensiles' },
          { valeur: 'casseroles', libelle: 'Casseroles et poêles' },
          { valeur: 'electromenager', libelle: 'Petit électroménager', aide: 'Micro-ondes, bouilloire, cafetière' },
          { valeur: 'literie', libelle: 'Literie', aide: 'Oreillers, couettes, protège-matelas' },
          { valeur: 'securite', libelle: 'Détecteur de fumée et trousse de secours' },
          { valeur: 'menage', libelle: 'Aspirateur et matériel de ménage' },
          { valeur: 'wifi', libelle: 'Box internet' },
        ],
      },
    ],
  },
  {
    id: 'linge',
    partie: 'Pour démarrer',
    question: 'Qui fournit le linge ?',
    aide: 'Draps, serviettes et torchons.',
    champs: [
      {
        id: 'linge.fournisseur',
        libelle: 'Linge fourni par',
        type: 'choix',
        requis: true,
        options: [
          { valeur: 'labelmaison', libelle: 'Label Maison', aide: 'Géré et renouvelé par nos soins' },
          { valeur: 'proprietaire', libelle: 'Moi, le propriétaire' },
        ],
      },
    ],
  },
  {
    id: 'airbnb',
    partie: 'Pour démarrer',
    question: 'Le logement est-il déjà sur Airbnb ?',
    champs: [
      {
        id: 'annonce.compte',
        libelle: 'Airbnb',
        type: 'choix',
        requis: true,
        options: [
          { valeur: 'annonce', libelle: 'Oui, une annonce existe' },
          { valeur: 'compte', libelle: 'J’ai un compte, sans annonce' },
          { valeur: 'acreer', libelle: 'Non, tout est à créer', aide: 'Nous vous guidons' },
        ],
      },
    ],
  },
  {
    id: 'airbnb_lien',
    partie: 'Pour démarrer',
    question: 'Quel est le lien de l’annonce ?',
    aide: 'Dans l’application Airbnb : votre annonce, puis « Partager ».',
    si: egal('annonce.compte', 'annonce'),
    champs: [{ id: 'annonce.lien', libelle: 'Lien de l’annonce', type: 'texte', placeholder: 'https://www.airbnb.fr/rooms/…', longueurMax: 300 }],
  },
  {
    id: 'particularites',
    partie: 'Pour démarrer',
    question: 'Une chose importante à nous dire ?',
    aide: 'Accès, voisinage, travaux, consignes pour les voyageurs…',
    champs: [{ id: 'notes', libelle: 'À savoir', type: 'zone', placeholder: 'Le volet de la chambre se bloque, pas d’animaux…' }],
  },
  {
    id: 'declaration',
    partie: 'Pour démarrer',
    question: 'Tout est exact ?',
    champs: [
      {
        id: 'decl.certif',
        libelle: 'Je certifie l’exactitude de ces informations et je signalerai toute modification.',
        type: 'case',
        requis: true,
      },
    ],
  },
];

/** Un champ du dossier par son identifiant. */
export const CHAMP_DOSSIER: ReadonlyMap<string, Champ> = new Map(ETAPES_DOSSIER.flatMap((e) => e.champs.map((c) => [c.id, c] as const)));

/* ----------------------------------------------- vers les fiches de l'ERP */

export type { DossierProprietaire };

/** Nom affiché du propriétaire. */
export function nomProprietaire(v: Valeurs): string {
  const personne = [texte(v, 'prop.prenom'), texte(v, 'prop.nom')].filter(Boolean).join(' ');
  const societe = texte(v, 'prop.societe');
  if (texte(v, 'prop.qualite') === 'indivision') return societe || `Indivision ${texte(v, 'prop.nom')}`.trim();
  if (texte(v, 'prop.qualite') === 'societe') return societe || personne;
  return personne;
}

function typeProprietaire(v: Valeurs): TypeProprietaire {
  if (texte(v, 'prop.qualite') !== 'societe') return 'particulier';
  return /\bSCI\b/i.test(texte(v, 'prop.societe')) ? 'sci' : 'societe';
}

function typeLogement(v: Valeurs): TypeLogement {
  const t = texte(v, 'bien.type');
  if (t === 'studio' || t === 'T1' || t === 'T2' || t === 'T3' || t === 'T4' || t === 'maison') return t;
  return 'autre';
}

function serrure(v: Valeurs): Serrure {
  const m = texte(v, 'acces.mode');
  return m === 'boite' ? 'boite_a_cles' : m === 'connectee' ? 'connectee' : 'cles';
}

const entier = (v: Valeurs, k: string) => {
  const n = Math.round(Number(String(v[k] ?? '').replace(',', '.')));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** Fiche propriétaire créée depuis le dossier (ou l'existante, complétée). */
export function versProprietaire(v: Valeurs, o: { id: Id; aujourdhui: string; existant?: Proprietaire }): Proprietaire {
  const note = [
    `Dossier propriétaire reçu le ${o.aujourdhui.split('-').reverse().join('/')} (formulaire en ligne).`,
    texte(v, 'prop.qualite') !== 'particulier' && texte(v, 'prop.societe') && `Représentant : ${texte(v, 'prop.prenom')} ${texte(v, 'prop.nom')}.`,
  ]
    .filter(Boolean)
    .join(' ');
  if (o.existant) {
    return { ...o.existant, notes: [o.existant.notes, note].filter(Boolean).join('\n') };
  }
  return {
    id: o.id,
    type: typeProprietaire(v),
    nom: nomProprietaire(v),
    contact: { email: texte(v, 'prop.email'), telephone: texte(v, 'prop.tel') },
    adresse: texte(v, 'prop.adresse'),
    ibanMasque: '',
    notes: note,
    creeLe: o.aujourdhui,
  };
}

const LIBELLE_TYPE: Record<string, string> = { studio: 'Studio', maison: 'Maison' };

/** Logement « en lancement » créé depuis le dossier. */
export function versLogement(v: Valeurs, o: { id: Id; proprietaireId: Id }): Logement {
  const lien = texte(v, 'annonce.lien');
  const type = texte(v, 'bien.type');
  return {
    id: o.id,
    nom: `${LIBELLE_TYPE[type] ?? type} ${texte(v, 'bien.ville')}`.trim(),
    adresse: [texte(v, 'bien.adresse'), texte(v, 'bien.complement')].filter(Boolean).join(', '),
    ville: texte(v, 'bien.ville'),
    codePostal: texte(v, 'bien.cp'),
    type: typeLogement(v),
    surfaceM2: entier(v, 'bien.surface'),
    capacite: entier(v, 'bien.couchages'),
    chambres: entier(v, 'bien.chambres'),
    lits: [],
    statut: 'lancement',
    proprietaireId: o.proprietaireId,
    residencePrincipale: texte(v, 'bien.residence') === 'principale',
    serrure: serrure(v),
    fiche: {
      wifiNom: texte(v, 'acces.wifi'),
      wifiCode: texte(v, 'acces.wifipass'),
      heureArrivee: '16:00',
      heureDepart: '11:00',
      acces: '',
      parking: '',
      regles: texte(v, 'notes'),
      equipements: [],
    },
    dotationLinge: [],
    annonces: /^https:\/\/(www\.)?airbnb\.[a-z.]+\//i.test(lien) ? [{ canal: 'airbnb', url: lien, connecte: false }] : [],
    checklistLancement: CHECKLIST_LANCEMENT.map((c) => ({ cle: c.cle, libelle: c.libelle, fait: false })),
  };
}
