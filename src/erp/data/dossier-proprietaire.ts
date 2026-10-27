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
 * L'essentiel seulement, regroupé par sujet : 6 écrans et le récapitulatif,
 * environ 2 minutes. Le détail (inventaire pièce par pièce, wifi,
 * consommables, documents) se voit à la visite de mise en service.
 */
export const ETAPES_DOSSIER: Etape[] = [
  {
    id: 'vous',
    partie: 'Vous',
    question: 'Qui êtes-vous ?',
    aide: 'Pour vous joindre et rédiger le contrat.',
    champs: [
      { id: 'prop.prenom', libelle: 'Prénom', type: 'texte', requis: true, autocomplete: 'given-name', longueurMax: 80 },
      { id: 'prop.nom', libelle: 'Nom', type: 'texte', requis: true, autocomplete: 'family-name', longueurMax: 80 },
      { id: 'prop.tel', libelle: 'Téléphone', type: 'tel', requis: true, autocomplete: 'tel', longueurMax: 30 },
      { id: 'prop.email', libelle: 'E-mail', type: 'email', requis: true, autocomplete: 'email', longueurMax: 160 },
      {
        id: 'prop.qualite',
        libelle: 'Vous êtes propriétaire',
        type: 'choix',
        requis: true,
        affichage: 'pastilles',
        options: [
          { valeur: 'particulier', libelle: 'En nom propre' },
          { valeur: 'indivision', libelle: 'En indivision' },
          { valeur: 'societe', libelle: 'Via une société' },
        ],
      },
      {
        id: 'prop.societe',
        libelle: 'Nom de la société ou de l’indivision',
        type: 'texte',
        requis: true,
        placeholder: 'SCI Les Tilleuls',
        longueurMax: 120,
        si: egal('prop.qualite', 'societe', 'indivision'),
      },
    ],
  },
  {
    id: 'adresses',
    partie: 'Le logement',
    question: 'Où se trouve le logement ?',
    champs: [
      { id: 'bien.adresse', libelle: 'Adresse', type: 'texte', requis: true, placeholder: 'N° et rue', autocomplete: 'address-line1' },
      { id: 'bien.complement', libelle: 'Complément', type: 'texte', placeholder: 'Bâtiment, étage, porte', autocomplete: 'address-line2' },
      { id: 'bien.cp', libelle: 'Code postal', type: 'texte', requis: true, format: 'code_postal', autocomplete: 'postal-code', longueurMax: 5 },
      { id: 'bien.ville', libelle: 'Ville', type: 'texte', requis: true, autocomplete: 'address-level2', longueurMax: 80 },
      { id: 'prop.adresse', libelle: 'Votre adresse postale, si elle est différente', type: 'texte', placeholder: 'N°, rue, code postal, ville' },
    ],
  },
  {
    id: 'description',
    partie: 'Le logement',
    question: 'Comment est-il ?',
    aide: 'Le nombre de voyageurs fixe la capacité de l’annonce.',
    champs: [
      {
        id: 'bien.type',
        libelle: 'Type',
        type: 'choix',
        requis: true,
        affichage: 'pastilles',
        options: [
          { valeur: 'studio', libelle: 'Studio' },
          { valeur: 'T1', libelle: 'T1' },
          { valeur: 'T2', libelle: 'T2' },
          { valeur: 'T3', libelle: 'T3' },
          { valeur: 'T4', libelle: 'T4 et plus' },
          { valeur: 'maison', libelle: 'Maison' },
        ],
      },
      { id: 'bien.couchages', libelle: 'Voyageurs au maximum', type: 'nombre', requis: true, min: 1, max: 30 },
      { id: 'bien.chambres', libelle: 'Chambres', type: 'nombre', min: 0, max: 30 },
      { id: 'bien.surface', libelle: 'Surface (m²)', type: 'nombre', min: 5, max: 2000 },
      {
        id: 'bien.residence',
        libelle: 'Est-ce votre résidence principale ?',
        type: 'choix',
        requis: true,
        affichage: 'pastilles',
        options: [
          { valeur: 'secondaire', libelle: 'Non' },
          { valeur: 'principale', libelle: 'Oui' },
        ],
      },
    ],
    note: (v) =>
      texte(v, 'bien.residence') === 'principale'
        ? 'Une résidence principale se loue 120 nuits par an au plus (article L.324-1-1 du Code du tourisme). Nous bloquons le calendrier en conséquence.'
        : undefined,
  },
  {
    id: 'sur_place',
    partie: 'Pour démarrer',
    question: 'Comment cela se passe-t-il sur place ?',
    champs: [
      {
        id: 'acces.mode',
        libelle: 'Comment entre-t-on ?',
        type: 'choix',
        requis: true,
        affichage: 'pastilles',
        options: [
          { valeur: 'boite', libelle: 'Boîte à clés' },
          { valeur: 'connectee', libelle: 'Serrure connectée' },
          { valeur: 'cles', libelle: 'Clés à remettre' },
        ],
      },
      {
        id: 'linge.fournisseur',
        libelle: 'Qui fournit le linge ?',
        type: 'choix',
        requis: true,
        affichage: 'pastilles',
        options: [
          { valeur: 'labelmaison', libelle: 'Label Maison' },
          { valeur: 'proprietaire', libelle: 'Moi' },
        ],
      },
      {
        id: 'annonce.compte',
        libelle: 'Déjà sur Airbnb ?',
        type: 'choix',
        requis: true,
        affichage: 'pastilles',
        options: [
          { valeur: 'annonce', libelle: 'Oui, annonce en ligne' },
          { valeur: 'compte', libelle: 'Compte sans annonce' },
          { valeur: 'acreer', libelle: 'Non, à créer' },
        ],
      },
      {
        id: 'annonce.lien',
        libelle: 'Lien de l’annonce',
        type: 'texte',
        placeholder: 'https://www.airbnb.fr/rooms/…',
        longueurMax: 300,
        si: egal('annonce.compte', 'annonce'),
      },
    ],
  },
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
    id: 'fin',
    partie: 'Pour finir',
    question: 'Un dernier mot ?',
    aide: 'Accès, voisinage, travaux, consignes pour les voyageurs…',
    champs: [
      { id: 'notes', libelle: 'Une chose importante à nous dire', type: 'zone', placeholder: 'Le volet de la chambre se bloque, pas d’animaux…' },
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
    adresse: texte(v, 'prop.adresse') || [texte(v, 'bien.adresse'), texte(v, 'bien.complement'), `${texte(v, 'bien.cp')} ${texte(v, 'bien.ville')}`.trim()].filter(Boolean).join(', '),
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
