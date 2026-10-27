/**
 * Ce que l'ERP dit de la conciergerie, selon l'espace ouvert : Label Maison
 * garde exactement ses textes d'avant ; un autre espace (Sens…) n'y voit ni
 * le nom de Label Maison, ni ses associés, ni ses formulaires publics.
 *
 * Décidé par l'identifiant de l'espace (estLabelMaison), jamais par son nom.
 * Ce qui décrit la plateforme elle-même (le domaine labelmaisoncg.fr, le nom
 * de l'app installée tant que son manifeste est commun) n'est pas concerné.
 *
 * Module pur, contrôlé par verifier-marque-espace.ts.
 */
import { estLabelMaison, type Espace } from './espaces.js';
import { nomPourSignature, reglagesAgent } from './reglages.js';
import type { ErpDonnees, Responsable, RoleUtilisateur } from './types';

type EspaceVu = Pick<Espace, 'id' | 'nom'>;

const nomPropre = (e: EspaceVu): string => (e.nom ?? '').trim();

/** Nom de la conciergerie : « Label Maison » pour Label Maison (quel que soit son nom en base), le nom de l'espace sinon ('' s'il n'en a pas). */
export function nomConciergerie(e: EspaceVu): string {
  return estLabelMaison(e) ? 'Label Maison' : nomPropre(e);
}

/** Titre de l'onglet du navigateur : « ERP · Label Maison », « ERP · Sens ». */
export function titreDocument(e: EspaceVu): string {
  const nom = nomConciergerie(e);
  return nom ? `ERP · ${nom}` : 'ERP';
}

/* ------------------------------------------------------------ réservations */

/** « Part du propriétaire » d'un séjour : ménage et commission au nom de la conciergerie de l'espace. */
export function libellesPartProprietaire(e: EspaceVu, commissionPct: number): { menage: string; commission: string } {
  const nom = nomConciergerie(e);
  return nom
    ? { menage: `Ménage (pour ${nom})`, commission: `Commission ${nom} (${commissionPct} %)` }
    : { menage: 'Ménage (pour la conciergerie)', commission: `Commission de la conciergerie (${commissionPct} %)` };
}

/* --------------------------------------------------------------------- CRM */

/**
 * Dossier propriétaire du site (labelmaisoncg.fr/dossier-proprietaire) : ses
 * réponses arrivent dans le CRM et la boîte de Label Maison
 * (api/dossier-proprietaire.ts). Proposé dans Label Maison seulement : jamais
 * les données d'un prospect d'une autre conciergerie chez Label Maison.
 */
export const dossierProprietaireDisponible = (e: Pick<Espace, 'id'>): boolean => estLabelMaison(e);

/** Phrase du CRM vide : les formulaires du site n'alimentent que le CRM de Label Maison. */
export function aideCrmVide(e: Pick<Espace, 'id'>): string {
  return estLabelMaison(e)
    ? 'Chaque formulaire envoyé depuis le site arrive ici tout seul, dans « À appeler ».'
    : 'Ajoutez les propriétaires à appeler : chacun avance d’étape en étape, de « À appeler » à « Signé ».';
}

/** Les associés de Label Maison, valeurs d'avant les espaces (inchangées). */
export const SUIVIS_LABEL_MAISON: { valeur: Responsable; libelle: string }[] = [
  { valeur: 'abdel', libelle: 'Abdel' },
  { valeur: 'kamel', libelle: 'Kamel' },
];

/** Rôles qui peuvent suivre un contact du CRM (un compte en lecture seule ne le fait pas). */
const ROLES_SUIVI: RoleUtilisateur[] = ['gerant', 'operations'];

export interface OptionSuivi {
  valeur: string;
  libelle: string;
}

/** « Zoé Martin » → « Zoé M. » (colonne étroite de la grille). */
function prenomInitiale(nom: string): string {
  const [prenom, suite] = nom.trim().split(/\s+/);
  return prenom ? `${prenom}${suite ? ` ${suite[0]}.` : ''}` : nom;
}

/**
 * Personnes proposées dans « Suivi par » (fiche, grille du CRM), sans le
 * choix « personne ». Label Maison : Abdel et Kamel, comme avant. Un autre
 * espace : ses membres (gérant, opérations), par l'identifiant du membre
 * (son adresse) ; la personne déjà choisie reste affichée si elle a quitté
 * l'équipe, pour ne jamais changer le suivi sans le vouloir. `court` : pour
 * la grille (« Zoé M. »).
 */
export function optionsSuiviCrm(
  e: Pick<Espace, 'id'>,
  membres: { id: string; nom: string; role: RoleUtilisateur }[],
  actuel?: string,
  court = false,
): OptionSuivi[] {
  if (estLabelMaison(e)) return SUIVIS_LABEL_MAISON;
  const options = membres
    .filter((m) => ROLES_SUIVI.includes(m.role))
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
    .map((m) => ({ valeur: m.id, libelle: court ? prenomInitiale(m.nom) : m.nom }));
  if (actuel && !options.some((o) => o.valeur === actuel)) {
    const local = actuel.split('@')[0] || actuel;
    options.push({ valeur: actuel, libelle: court ? local : `${local} (plus dans l’équipe)` });
  }
  return options;
}

/* -------------------------------------------------------------- messagerie */

/**
 * Signature des réponses rapides : celle de l'agent de l'espace (réglée dans
 * Messagerie → Configurer mon agent ; par défaut « L’équipe Label Maison »,
 * « L’équipe Sens »).
 */
export function signatureEspace(d: Pick<ErpDonnees, 'reglages'>, e: EspaceVu): string {
  return reglagesAgent(d, nomPourSignature(e)).signature.trim();
}

/* -------------------------------------------------------------------- app */

/*
 * L'app installée garde le nom de son manifeste, commun à tous les espaces
 * (public/erp-app/manifest.webmanifest). Label Maison garde ses textes ;
 * un autre espace lit des textes neutres, sans nom.
 */

/** Carte d'installation de l'accueil. */
export const titreProposerApp = (e: Pick<Espace, 'id'>): string => (estLabelMaison(e) ? 'Installez l’app Label Maison' : 'Installez l’app');

/** Titre de la carte « Application » (Paramètres). */
export const titreCarteApp = (e: Pick<Espace, 'id'>): string => (estLabelMaison(e) ? 'L’app Label Maison' : 'L’app de l’ERP');

/** Titre de la page d'installation (/erp/installer). */
export const titrePageInstallation = (e: Pick<Espace, 'id'>): string => (estLabelMaison(e) ? 'Installer l’app Label Maison' : 'Installer l’app');

/**
 * Où réactiver les notifications sur iPhone, après « Réglages → » (« Notifications → Label Maison »).
 * L'app installée garde le nom de son manifeste : ailleurs, on renvoie au nom sous son icône.
 */
export const notificationsIphone = (e: Pick<Espace, 'id'>): string =>
  estLabelMaison(e) ? 'Notifications → Label Maison' : 'Notifications, puis le nom affiché sous l’icône de l’app';

/** Nom de l'app dans « Ouvrez l’app … » (undefined : sans nom). */
export const nomAppAffiche = (e: Pick<Espace, 'id'>): string | undefined => (estLabelMaison(e) ? 'Label Maison' : undefined);

/** Partage du lien d'installation (navigator.share). */
export function partageInstallation(e: Pick<Espace, 'id'>): { title: string; text: string } {
  return estLabelMaison(e) ? { title: 'App Label Maison', text: 'Installez l’app Label Maison :' } : { title: 'App de l’ERP', text: 'Installez l’app de l’ERP :' };
}
