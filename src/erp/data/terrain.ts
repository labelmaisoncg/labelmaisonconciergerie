/**
 * Exploitation terrain d'un logement (onglet « Terrain » de la fiche) :
 * ménage, qui appeler, repères techniques. Règles pures, partagées par
 * l'onglet, le formulaire de modification et les vérificateurs.
 *
 * Cloison : `contacts` et `technique` ne sortent jamais de l'ERP (agent IA,
 * espace propriétaire, livret de séjour, connecteur Claude) ; `menage` est lu
 * par l'équipe seulement. Chaque sortie est une projection explicite champ
 * par champ ; `fuitesTerrain` sert aux vérificateurs à le prouver
 * (verifier-agent, verifier-proprietaire, verifier-sejour, verifier-crm-mcp).
 *
 * Ni React ni réseau (verifier-logements.ts).
 */
import type { ContactLogement, Logement, MenageLogement, RoleContact, TechniqueLogement } from './types';

/* ---------------------------------------------------------------- libellés */

/** Rôles d'un contact, dans l'ordre d'affichage. */
export const ROLES_CONTACT: readonly RoleContact[] = ['menage', 'maintenance', 'serrurier', 'urgence', 'proprietaire', 'autre'];

export const LIBELLE_ROLE_CONTACT: Record<RoleContact, string> = {
  menage: 'Ménage',
  maintenance: 'Maintenance',
  serrurier: 'Serrurier',
  urgence: 'Urgence',
  proprietaire: 'Propriétaire',
  autre: 'Autre',
};

export const CHAMPS_MENAGE: { cle: keyof MenageLogement; libelle: string; aide: string }[] = [
  { cle: 'duree', libelle: 'Durée prévue', aide: 'Ex. 2 h 30' },
  { cle: 'produits', libelle: 'Produits et où ils sont', aide: 'Ex. sous l’évier : multi-surfaces, vitres, sols ; aspirateur dans le placard de l’entrée' },
  { cle: 'consignes', libelle: 'Consignes particulières', aide: 'Ce qui ne doit pas être oublié à chaque ménage.' },
];

/** Repères techniques, dans l'ordre d'affichage (les notes à part). */
export const CHAMPS_TECHNIQUE: { cle: Exclude<keyof TechniqueLogement, 'notes'>; libelle: string }[] = [
  { cle: 'etage', libelle: 'Étage et porte' },
  { cle: 'interphone', libelle: 'Interphone' },
  { cle: 'compteurElectricite', libelle: 'Compteur électrique' },
  { cle: 'disjoncteur', libelle: 'Disjoncteur' },
  { cle: 'compteurEau', libelle: 'Compteur d’eau' },
  { cle: 'arriveeEau', libelle: 'Arrivée d’eau' },
  { cle: 'compteurGaz', libelle: 'Compteur de gaz' },
  { cle: 'chaudiere', libelle: 'Chaudière / chauffe-eau' },
];

/* ------------------------------------------------------------- lecture */

const plein = (v: string | undefined): v is string => !!v && !!v.trim();

/** Le ménage a au moins un champ rempli. */
export const menageRenseigne = (m: MenageLogement | undefined): boolean => !!m && CHAMPS_MENAGE.some((c) => plein(m[c.cle]));

/** Contacts affichables : un nom au moins. */
export const contactsRenseignes = (c: ContactLogement[] | undefined): ContactLogement[] => (c ?? []).filter((x) => x && plein(x.nom));

/** Au moins un repère technique (ou une note). */
export const techniqueRenseignee = (t: TechniqueLogement | undefined): boolean =>
  !!t && (CHAMPS_TECHNIQUE.some((c) => plein(t[c.cle])) || plein(t.notes));

/** Numéro pour un lien `tel:` (chiffres et « + » seulement), undefined si rien d'appelable. */
export function lienTelephone(telephone: string | undefined): string | undefined {
  const n = (telephone ?? '').replace(/[^\d+]/g, '');
  return n.length >= 6 ? `tel:${n}` : undefined;
}

/* --------------------------------------------------------------- saisie */

export interface SaisieContact {
  /** Clé de ligne du formulaire (pas enregistrée). */
  cle: string;
  role: RoleContact;
  nom: string;
  telephone: string;
  note: string;
}

export interface SaisieTerrain {
  menage: Record<keyof MenageLogement, string>;
  contacts: SaisieContact[];
  technique: Record<keyof TechniqueLogement, string>;
}

let compteur = 0;
export const nouveauContactSaisi = (role: RoleContact = 'menage'): SaisieContact => ({ cle: `c${++compteur}`, role, nom: '', telephone: '', note: '' });

const TECHNIQUE_VIDE: Record<keyof TechniqueLogement, string> = {
  etage: '',
  interphone: '',
  compteurElectricite: '',
  compteurEau: '',
  compteurGaz: '',
  disjoncteur: '',
  chaudiere: '',
  arriveeEau: '',
  notes: '',
};

/** Saisie de départ : celle du logement (champs absents : vides). */
export function saisieTerrainInitiale(l?: Pick<Logement, 'menage' | 'contacts' | 'technique'>): SaisieTerrain {
  const t = l?.technique ?? {};
  return {
    menage: { duree: l?.menage?.duree ?? '', produits: l?.menage?.produits ?? '', consignes: l?.menage?.consignes ?? '' },
    contacts: contactsRenseignes(l?.contacts).map((c) => ({ ...nouveauContactSaisi(c.role), nom: c.nom, telephone: c.telephone ?? '', note: c.note ?? '' })),
    technique: Object.fromEntries((Object.keys(TECHNIQUE_VIDE) as (keyof TechniqueLogement)[]).map((k) => [k, t[k] ?? ''])) as Record<keyof TechniqueLogement, string>,
  };
}

/** Erreurs de la saisie : un contact avec un téléphone ou une note mais sans nom. */
export function erreursTerrain(s: SaisieTerrain): { contacts: Record<string, string> } {
  const contacts: Record<string, string> = {};
  for (const c of s.contacts) {
    if (!plein(c.nom) && (plein(c.telephone) || plein(c.note))) contacts[c.cle] = 'Indiquez qui appeler.';
  }
  return { contacts };
}

const nettoye = (v: string): string | undefined => (v.trim() ? v.trim() : undefined);

/**
 * Le volet terrain à enregistrer : textes nettoyés, lignes de contact sans
 * nom ignorées, et une partie entièrement vide retirée du logement (pas de
 * `{}` ni de `[]` en base).
 */
export function terrainDepuisSaisie(s: SaisieTerrain): Pick<Logement, 'menage' | 'contacts' | 'technique'> {
  const menage: MenageLogement = {};
  for (const c of CHAMPS_MENAGE) {
    const v = nettoye(s.menage[c.cle]);
    if (v) menage[c.cle] = v;
  }
  const contacts: ContactLogement[] = s.contacts
    .filter((c) => plein(c.nom))
    .map((c) => ({
      role: ROLES_CONTACT.includes(c.role) ? c.role : 'autre',
      nom: c.nom.trim(),
      ...(nettoye(c.telephone) ? { telephone: nettoye(c.telephone) } : {}),
      ...(nettoye(c.note) ? { note: nettoye(c.note) } : {}),
    }));
  const technique: TechniqueLogement = {};
  for (const k of Object.keys(TECHNIQUE_VIDE) as (keyof TechniqueLogement)[]) {
    const v = nettoye(s.technique[k]);
    if (v) technique[k] = v;
  }
  return {
    ...(Object.keys(menage).length ? { menage } : {}),
    ...(contacts.length ? { contacts } : {}),
    ...(Object.keys(technique).length ? { technique } : {}),
  };
}

/** Le logement avec son volet terrain remplacé (une partie vide disparaît). */
export function appliquerTerrain(l: Logement, s: SaisieTerrain): Logement {
  const { menage: _m, contacts: _c, technique: _t, ...reste } = l;
  return { ...reste, ...terrainDepuisSaisie(s) };
}

/* -------------------------------------------------------------- cloison */

/**
 * Valeurs du volet terrain d'un logement retrouvées dans un texte (une vue,
 * un contexte donné à l'IA, la réponse d'un outil) : noms, téléphones et
 * notes des contacts, repères techniques, ménage. Vide attendu partout
 * hors de l'ERP. Les valeurs de moins de 3 caractères ne comptent pas, et une
 * valeur n'est retrouvée qu'entière : « 3 h » (durée du ménage) n'est pas lu
 * dans « 13 h », ni « 2 h 30 » dans « 12 h 30 » (sinon une heure quelconque
 * ferait échouer un vérificateur).
 */
export function fuitesTerrain(texte: string, l: Pick<Logement, 'menage' | 'contacts' | 'technique'> | undefined): string[] {
  if (!l) return [];
  const valeurs: (string | undefined)[] = [
    ...Object.values(l.menage ?? {}),
    ...(l.contacts ?? []).flatMap((c) => [c?.nom, c?.telephone, c?.note]),
    ...Object.values(l.technique ?? {}),
  ];
  return [...new Set(valeurs.map((v) => String(v ?? '').trim()).filter((v) => v.length >= 3 && valeurEntiere(texte, v)))];
}

const alphanumerique = (c: string | undefined): boolean => !!c && /[\p{L}\p{N}]/u.test(c);

/** La valeur figure dans le texte sans lettre ni chiffre collé devant ou derrière. */
function valeurEntiere(texte: string, valeur: string): boolean {
  let i = texte.indexOf(valeur);
  while (i !== -1) {
    if (!alphanumerique(texte[i - 1]) && !alphanumerique(texte[i + valeur.length])) return true;
    i = texte.indexOf(valeur, i + 1);
  }
  return false;
}
