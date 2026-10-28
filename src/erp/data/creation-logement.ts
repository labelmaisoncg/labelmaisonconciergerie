/**
 * Créer un logement à la main : règles pures partagées par le formulaire
 * (modules/logements/EditionLogement.tsx, création et modification), par
 * l'assistant pas à pas (_composants/AssistantLogement.tsx, création
 * seulement) et par la fiche propriétaire (proprietaires/FormProprietaire.tsx).
 *
 * L'assistant ne fabrique pas son propre logement : ses réponses deviennent
 * la saisie du formulaire (saisieDepuisBrouillon), contrôlée par les mêmes
 * règles (erreursSaisieLogement) et transformée par la même fonction
 * (logementDepuisSaisie, à partir du même logementVierge). Les deux écrans
 * ne peuvent donc pas diverger : mêmes valeurs par défaut, statut « En
 * préparation », même traitement du propriétaire.
 *
 * Ni React ni réseau (verifier-creation-logement.ts). Rien n'est écrit sur
 * les plateformes : un logement créé ici vit dans l'ERP, puis se relie à son
 * annonce depuis sa fiche (liaison-annonce.ts).
 */
import { CHECKLIST_LANCEMENT, PLAFOND_NUITS_RESIDENCE_PRINCIPALE } from './constantes';
import { LIBELLES } from './libelles';
import { changerProprietaire } from './proprietaire';
import { positionAJour, texteAdresse } from './carte';
import type { DateISO, Dpe, Id, Logement, Proprietaire, Serrure, StatutLogement, TypeLit, TypeLogement, TypeProprietaire } from './types';

/* --------------------------------------------------------------- formulaire */

/** Saisie du formulaire d'un logement, telle que tapée (texte). */
export interface SaisieLogement {
  nom: string;
  adresse: string;
  codePostal: string;
  ville: string;
  type: TypeLogement;
  surfaceM2: string;
  capacite: string;
  chambres: string;
  lits: Record<TypeLit, string>;
  dpe: string;
  numeroEnregistrement: string;
  residencePrincipale: boolean;
  serrure: Serrure;
  proprietaireId: string;
  statut: StatutLogement;
}

export type ErreursLogement = Partial<Record<keyof SaisieLogement, string>>;

/** Ordre d'affichage des lits (formulaire, assistant, récapitulatif). */
export const TYPES_LIT: TypeLit[] = ['double', 'simple', 'canape'];

/** Nombre entier positif tapé (« 12 ») ; NaN sinon. */
export const entier = (s: string): number => (/^\d+$/.test(s.trim()) ? Number(s) : NaN);

/**
 * Logement vierge : valeurs par défaut de toute création à la main. Il
 * démarre « En préparation », avec ses trois annonces non connectées et la
 * checklist de lancement à faire.
 */
export function logementVierge(id: Id): Logement {
  return {
    id,
    nom: '',
    adresse: '',
    ville: '',
    codePostal: '',
    type: 'T2',
    surfaceM2: 0,
    capacite: 0,
    chambres: 0,
    lits: [],
    statut: 'lancement',
    proprietaireId: '',
    residencePrincipale: false,
    serrure: 'boite_a_cles',
    fiche: { wifiNom: '', wifiCode: '', heureArrivee: '16:00', heureDepart: '11:00', acces: '', parking: '', regles: '', equipements: [] },
    dotationLinge: [],
    annonces: [
      { canal: 'airbnb', connecte: false },
      { canal: 'booking', connecte: false },
      { canal: 'direct', connecte: false },
    ],
    checklistLancement: CHECKLIST_LANCEMENT.map((c) => ({ ...c, fait: false })),
  };
}

/** Saisie de départ : celle du logement modifié, ou d'un nouveau logement. */
export function saisieInitiale(l?: Logement): SaisieLogement {
  const lits = (t: TypeLit) => String(l?.lits.find((x) => x.type === t)?.nombre ?? 0);
  return {
    nom: l?.nom ?? '',
    adresse: l?.adresse ?? '',
    codePostal: l?.codePostal ?? '',
    ville: l?.ville ?? '',
    type: l?.type ?? 'T2',
    surfaceM2: l ? String(l.surfaceM2) : '',
    capacite: l ? String(l.capacite) : '',
    chambres: l ? String(l.chambres) : '1',
    lits: { double: lits('double'), simple: lits('simple'), canape: lits('canape') },
    dpe: l?.dpe ?? '',
    numeroEnregistrement: l?.numeroEnregistrement ?? '',
    residencePrincipale: l?.residencePrincipale ?? false,
    serrure: l?.serrure ?? 'boite_a_cles',
    proprietaireId: l?.proprietaireId ?? '',
    statut: l?.statut ?? 'lancement',
  };
}

/**
 * Erreurs de la saisie, par champ, en une phrase chacune.
 * - `surfaceFacultative` : l'assistant laisse la surface vide (0, à compléter
 *   dans la fiche) ; le formulaire la demande toujours.
 * - `nomsPris` : noms que ce logement ne peut pas prendre (nomsInterdits) ;
 *   comparés sans casse, accents ni espaces en trop.
 */
export function erreursSaisieLogement(s: SaisieLogement, o: { surfaceFacultative?: boolean; nomsPris?: readonly string[] } = {}): ErreursLogement {
  const e: ErreursLogement = {};
  const pris = o.nomsPris ? nomDejaPris(s.nom, o.nomsPris) : undefined;
  if (!s.nom.trim()) e.nom = 'Le nom est obligatoire.';
  else if (pris) e.nom = messageNomPris(pris);
  if (!s.adresse.trim()) e.adresse = 'L’adresse est obligatoire.';
  if (!/^\d{5}$/.test(s.codePostal.trim())) e.codePostal = 'Code postal à 5 chiffres.';
  if (!s.ville.trim()) e.ville = 'La ville est obligatoire.';
  if (!(entier(s.surfaceM2) > 0) && !(o.surfaceFacultative && !s.surfaceM2.trim())) e.surfaceM2 = 'Surface en m², nombre entier.';
  if (!(entier(s.capacite) > 0)) e.capacite = 'Au moins 1 voyageur.';
  if (Number.isNaN(entier(s.chambres))) e.chambres = 'Nombre entier.';
  if (Object.values(s.lits).some((n) => Number.isNaN(entier(n)))) e.lits = 'Nombres entiers.';
  if (!s.proprietaireId) e.proprietaireId = 'Choisissez le propriétaire.';
  if (s.numeroEnregistrement && !/^[0-9A-Z]{13}$/i.test(s.numeroEnregistrement.trim()))
    e.numeroEnregistrement = 'Format attendu : 13 caractères (ex. 91174000125RX).';
  return e;
}

/**
 * Le logement à enregistrer d'après une saisie valide. `cible` : le logement
 * modifié, ou l'identifiant du nouveau (logement vierge, « En préparation » ;
 * le statut saisi ne vaut qu'en modification).
 *
 * Carte de l'accueil : une adresse changée retire l'ancienne position (elle
 * ne vaut plus) ; le logement est ensuite placé d'après sa nouvelle adresse
 * (aPlacerSurCarte). Autre propriétaire : l'ancien garde ses chiffres
 * jusqu'à hier, le nouveau commence aujourd'hui (changerProprietaire).
 */
export function logementDepuisSaisie(s: SaisieLogement, cible: Logement | Id, aujourdhui: DateISO): Logement {
  const existant = typeof cible === 'string' ? undefined : cible;
  const base = existant ?? logementVierge(cible as Id);
  const lits = (Object.entries(s.lits) as [TypeLit, string][])
    .map(([type, n]) => ({ type, nombre: entier(n) }))
    .filter((x) => x.nombre > 0);
  const suivant: Logement = {
    ...base,
    nom: s.nom.trim(),
    adresse: s.adresse.trim(),
    codePostal: s.codePostal.trim(),
    ville: s.ville.trim(),
    type: s.type,
    // Vide (assistant) : 0, comme un logement importé sans surface.
    surfaceM2: s.surfaceM2.trim() ? entier(s.surfaceM2) : 0,
    capacite: entier(s.capacite),
    chambres: entier(s.chambres),
    lits,
    dpe: (s.dpe || undefined) as Dpe | undefined,
    numeroEnregistrement: s.numeroEnregistrement.trim().toUpperCase() || undefined,
    residencePrincipale: s.residencePrincipale,
    serrure: s.serrure,
    statut: existant ? s.statut : base.statut,
  };
  const adresseChangee = !existant || texteAdresse(suivant) !== texteAdresse(existant);
  const { position: _ancienne, ...sansPosition } = suivant;
  const aEnregistrer: Logement = adresseChangee ? sansPosition : suivant;
  return changerProprietaire(aEnregistrer, s.proprietaireId, aujourdhui);
}

/**
 * Géocoder après l'enregistrement ? Gérant seulement (data/geocodage.ts) : un
 * compte « opérations » laisse le logement « à placer ». Jamais un logement
 * sorti, ni un logement déjà placé à cette adresse.
 */
export function aPlacerSurCarte(l: Pick<Logement, 'adresse' | 'codePostal' | 'ville' | 'position' | 'statut'>, role: string | undefined, lectureSeule: boolean): boolean {
  return role === 'gerant' && !lectureSeule && l.statut !== 'sorti' && !positionAJour(l);
}

/* ------------------------------------------------------------- propriétaire */

export interface SaisieProprietaire {
  type: TypeProprietaire;
  nom: string;
  email: string;
  telephone: string;
  adresse: string;
  notes: string;
}

export type ErreursProprietaire = Partial<Record<keyof SaisieProprietaire, string>>;

export function saisieProprietaireInitiale(p?: Proprietaire): SaisieProprietaire {
  return {
    type: p?.type ?? 'particulier',
    nom: p?.nom ?? '',
    email: p?.contact.email ?? '',
    telephone: p?.contact.telephone ?? '',
    adresse: p?.adresse ?? '',
    notes: p?.notes ?? '',
  };
}

export function erreursProprietaire(s: SaisieProprietaire): ErreursProprietaire {
  const e: ErreursProprietaire = {};
  if (s.nom.trim().length < 2) e.nom = 'Le nom est obligatoire.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email.trim())) e.email = 'Adresse e-mail invalide.';
  if (s.telephone.replace(/\D/g, '').length < 10) e.telephone = 'Numéro à 10 chiffres minimum.';
  if (!s.adresse.trim()) e.adresse = 'L’adresse est obligatoire.';
  return e;
}

/**
 * Fiche propriétaire d'après une saisie valide. `cible` : la fiche modifiée,
 * ou l'identifiant de la nouvelle. Un ancien IBAN masqué n'est pas recopié
 * (types.ts : effacé au prochain enregistrement).
 */
export function proprietaireDepuisSaisie(s: SaisieProprietaire, cible: Proprietaire | Id, aujourdhui: DateISO): Proprietaire {
  const existant = typeof cible === 'string' ? undefined : cible;
  return {
    id: existant?.id ?? (cible as Id),
    creeLe: existant?.creeLe ?? aujourdhui,
    type: s.type,
    nom: s.nom.trim(),
    contact: { email: s.email.trim(), telephone: s.telephone.trim() },
    adresse: s.adresse.trim(),
    notes: s.notes.trim(),
  };
}

/* ---------------------------------------------------------------- assistant */

/** Les écrans de l'assistant, dans l'ordre : une question par écran, puis le récapitulatif. */
export const ETAPES_ASSISTANT = ['type', 'adresse', 'capacite', 'nom', 'proprietaire', 'recapitulatif'] as const;
export type EtapeAssistant = (typeof ETAPES_ASSISTANT)[number];

/** Grandes familles proposées en cartes ; « Appartement » se précise ensuite en T1 à T4. */
export type FamilleLogement = 'appartement' | 'maison' | 'studio' | 'autre';
export const PIECES = ['T1', 'T2', 'T3', 'T4'] as const satisfies readonly TypeLogement[];

export const familleDuType = (t: TypeLogement): FamilleLogement => ((PIECES as readonly string[]).includes(t) ? 'appartement' : (t as FamilleLogement));

/** Type choisi en touchant une famille : un appartement garde ses pièces, sinon T2. */
export function typeDeLaFamille(f: FamilleLogement, actuel?: TypeLogement): TypeLogement {
  if (f !== 'appartement') return f;
  return actuel && familleDuType(actuel) === 'appartement' ? actuel : 'T2';
}

/** Réponses de l'assistant (rien n'est enregistré avant « Créer le logement »). */
export interface BrouillonLogement {
  /** Absent tant qu'aucune carte n'est touchée. */
  type?: TypeLogement;
  adresse: string;
  codePostal: string;
  ville: string;
  capacite: number;
  chambres: number;
  lits: Record<TypeLit, number>;
  /** Tapée (texte) : la surface n'a pas de « − / + ». Facultative : vide, elle se complète dans la fiche. */
  surfaceM2: string;
  nom: string;
  /**
   * Résidence principale du propriétaire (plafond légal de nuits par an) :
   * absent tant que personne n'a répondu, jamais supposé.
   */
  residencePrincipale?: boolean;
  /** Propriétaire déjà enregistré (« liste ») ou nouveau, créé avec le logement. */
  modeProprietaire: 'liste' | 'nouveau';
  proprietaireId: Id;
  nouveauProprietaire: SaisieProprietaire;
}

/** Bornes des compteurs « − / + » (« lits » : le total comme chaque type de lit). */
export const BORNES = { capacite: [1, 30], chambres: [0, 20], lits: [0, 20] } as const;

export const totalLits = (lits: Record<TypeLit, number>): number => TYPES_LIT.reduce((n, t) => n + lits[t], 0);

/**
 * Compteur « Lits » (le détail par type est replié) : un lit de plus est un
 * lit double ; un lit de moins retire d'abord un lit double, puis un lit
 * simple, puis un canapé-lit. Le détail se précise dans « Préciser les lits ».
 */
export function changerTotalLits(lits: Record<TypeLit, number>, total: number): Record<TypeLit, number> {
  const r = { ...lits };
  let ecart = Math.max(0, total) - totalLits(lits);
  if (ecart > 0) {
    r.double += ecart;
    return r;
  }
  for (const t of TYPES_LIT) {
    const retire = Math.min(r[t], -ecart);
    r[t] -= retire;
    ecart += retire;
  }
  return r;
}

/** Capacité proposée d'après le type, tant que l'utilisateur n'y a pas touché. */
export function capaciteSuggeree(t: TypeLogement): Pick<BrouillonLogement, 'capacite' | 'chambres' | 'lits'> {
  const chambres = ({ studio: 0, T1: 0, T2: 1, T3: 2, T4: 3, maison: 3, autre: 1 } satisfies Record<TypeLogement, number>)[t];
  return { capacite: Math.max(2, chambres * 2), chambres, lits: { double: Math.max(1, chambres), simple: 0, canape: 0 } };
}

export function brouillonInitial(avecProprietaires: boolean): BrouillonLogement {
  return {
    adresse: '',
    codePostal: '',
    ville: '',
    capacite: 2,
    chambres: 1,
    lits: { double: 1, simple: 0, canape: 0 },
    surfaceM2: '',
    nom: '',
    // Aucun propriétaire encore : on en crée un, sans passer par la liste vide.
    modeProprietaire: avecProprietaires ? 'liste' : 'nouveau',
    proprietaireId: '',
    nouveauProprietaire: saisieProprietaireInitiale(),
  };
}

/** Mot du type dans un nom proposé (« T2 Corbeil-Essonnes », « Maison Évry »). */
const MOT_TYPE: Record<TypeLogement, string> = { studio: 'Studio', T1: 'T1', T2: 'T2', T3: 'T3', T4: 'T4', maison: 'Maison', autre: 'Logement' };

/**
 * Clé de comparaison d'un nom : sans casse, sans accents, espaces resserrés,
 * apostrophes unifiées (« Maison de Linas » = « maison  de linás »).
 */
export const cleNom = (nom: string): string =>
  nom
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’‘`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('fr');

/** Le logement qui porte déjà ce nom (tel qu'il est écrit), s'il y en a un. */
export function nomDejaPris(nom: string, nomsPris: readonly string[]): string | undefined {
  const cle = cleNom(nom);
  return cle ? nomsPris.find((n) => cleNom(n) === cle) : undefined;
}

/** Même phrase dans l'assistant et le formulaire. */
export const messageNomPris = (existant: string): string => `Un logement s’appelle déjà « ${existant} ». Choisissez un autre nom.`;

/**
 * Noms qu'un logement ne peut pas prendre : ceux des autres logements de
 * l'espace (le logement modifié est exclu). Garder son nom reste toujours
 * possible, même si un autre logement le porte déjà (deux annonces importées
 * homonymes, dont le nom revient de la plateforme à chaque synchronisation) :
 * seul un nom nouveau ou changé est comparé.
 */
export function nomsInterdits(logements: readonly Pick<Logement, 'id' | 'nom'>[], existant: Pick<Logement, 'id' | 'nom'> | undefined, nom: string): string[] {
  if (existant && cleNom(nom) === cleNom(existant.nom)) return [];
  return logements.filter((l) => l.id !== existant?.id).map((l) => l.nom);
}

/** Nom proposé d'après le type et la ville ; numéroté s'il est déjà pris. */
export function nomSuggere(type: TypeLogement | undefined, ville: string, nomsPris: readonly string[]): string {
  const base = [MOT_TYPE[type ?? 'autre'], ville.trim().replace(/\s+/g, ' ')].filter(Boolean).join(' ');
  let nom = base;
  for (let k = 2; nomDejaPris(nom, nomsPris) && k < 100; k++) nom = `${base} ${k}`;
  return nom;
}

/**
 * Saisie du formulaire d'après les réponses : les champs que l'assistant ne
 * demande pas (DPE, serrure, numéro d'enregistrement, résidence principale)
 * gardent les valeurs de départ du formulaire.
 */
export function saisieDepuisBrouillon(b: BrouillonLogement, proprietaireId: Id): SaisieLogement {
  return {
    ...saisieInitiale(),
    nom: b.nom,
    adresse: b.adresse,
    codePostal: b.codePostal,
    ville: b.ville,
    type: b.type ?? 'T2',
    surfaceM2: b.surfaceM2,
    capacite: String(b.capacite),
    chambres: String(b.chambres),
    lits: { double: String(b.lits.double), simple: String(b.lits.simple), canape: String(b.lits.canape) },
    // Sans réponse, rien n'est créé (erreursEtape) ; « Non » vaut false, comme dans le formulaire.
    residencePrincipale: b.residencePrincipale === true,
    proprietaireId,
  };
}

/** Champs du formulaire posés à chaque écran (leurs erreurs bloquent cet écran). */
export const CHAMPS_ETAPE: Record<Exclude<EtapeAssistant, 'recapitulatif'>, (keyof SaisieLogement)[]> = {
  type: ['type'],
  adresse: ['adresse', 'codePostal', 'ville'],
  capacite: ['capacite', 'chambres', 'lits', 'surfaceM2'],
  nom: ['nom'],
  proprietaire: ['proprietaireId', 'residencePrincipale'],
};

/** Champ vide : on dit ce qu'il faut faire plutôt que ce qui ne va pas. */
const A_REMPLIR: Partial<Record<keyof SaisieLogement, string>> = {
  adresse: 'Indiquez l’adresse.',
  codePostal: 'Indiquez le code postal.',
  ville: 'Indiquez la ville.',
  nom: 'Donnez un nom au logement.',
};
const A_REMPLIR_PROPRIETAIRE: Partial<Record<keyof SaisieProprietaire, string>> = {
  nom: 'Indiquez le nom du propriétaire.',
  email: 'Indiquez son e-mail.',
  telephone: 'Indiquez son téléphone.',
  adresse: 'Indiquez son adresse postale.',
};

export interface ContexteAssistant {
  proprietaires: readonly Pick<Proprietaire, 'id'>[];
  /** Noms des logements de l'espace : un nouveau logement n'en reprend aucun. */
  nomsPris: readonly string[];
}

/**
 * Erreurs d'un écran, par champ (clés du formulaire ; « proprietaire.nom »…
 * pour un nouveau propriétaire), dans l'ordre de l'écran. Vide : « Continuer »
 * est permis. Le récapitulatif réunit celles de tous les écrans.
 */
export function erreursEtape(etape: EtapeAssistant, b: BrouillonLogement, ctx: ContexteAssistant): Record<string, string> {
  if (etape === 'recapitulatif') {
    return Object.assign({}, ...ETAPES_ASSISTANT.filter((e) => e !== 'recapitulatif').map((e) => erreursEtape(e, b, ctx)));
  }
  const r: Record<string, string> = {};
  if (etape === 'type') {
    if (!b.type) r.type = 'Choisissez un type de logement.';
    return r;
  }
  if (etape === 'proprietaire') {
    if (b.modeProprietaire === 'liste') {
      if (!ctx.proprietaires.some((p) => p.id === b.proprietaireId)) r.proprietaireId = 'Choisissez le propriétaire.';
    } else {
      const s = b.nouveauProprietaire;
      const e = erreursProprietaire(s);
      for (const k of ['nom', 'email', 'telephone', 'adresse'] as const) {
        if (e[k]) r[`proprietaire.${k}`] = (!s[k].trim() && A_REMPLIR_PROPRIETAIRE[k]) || e[k]!;
      }
    }
    if (b.residencePrincipale === undefined) r.residencePrincipale = 'Dites si c’est la résidence principale du propriétaire.';
    return r;
  }
  // Mêmes règles que le formulaire, sur les champs de cet écran (surface facultative ici, nom jamais en double).
  const saisie = saisieDepuisBrouillon(b, b.proprietaireId);
  const e = erreursSaisieLogement(saisie, { surfaceFacultative: true, nomsPris: ctx.nomsPris });
  for (const k of CHAMPS_ETAPE[etape]) {
    if (!e[k]) continue;
    const vide = typeof saisie[k] === 'string' && !(saisie[k] as string).trim();
    r[k] = (vide && A_REMPLIR[k]) || e[k]!;
  }
  return r;
}

/** Écran où se corrige une erreur (clé rendue par erreursEtape). */
export function etapeDuChamp(cle: string): EtapeAssistant {
  if (cle.startsWith('proprietaire')) return 'proprietaire';
  for (const [etape, champs] of Object.entries(CHAMPS_ETAPE)) if ((champs as string[]).includes(cle)) return etape as EtapeAssistant;
  return 'recapitulatif';
}

export type ResultatAssistant =
  | { ok: true; logement: Logement; proprietaire?: Proprietaire }
  | { ok: false; etape: EtapeAssistant; erreur: string };

/**
 * Ce que « Créer le logement » enregistre : le nouveau propriétaire s'il y en
 * a un, puis le logement, construit exactement comme par le formulaire.
 */
export function creationDepuisAssistant(
  b: BrouillonLogement,
  o: ContexteAssistant & { idLogement: Id; idProprietaire: Id; aujourdhui: DateISO },
): ResultatAssistant {
  const erreurs = Object.entries(erreursEtape('recapitulatif', b, o));
  if (erreurs.length) return { ok: false, etape: etapeDuChamp(erreurs[0][0]), erreur: erreurs[0][1] };
  const proprietaire = b.modeProprietaire === 'nouveau' ? proprietaireDepuisSaisie(b.nouveauProprietaire, o.idProprietaire, o.aujourdhui) : undefined;
  const saisie = saisieDepuisBrouillon(b, proprietaire?.id ?? b.proprietaireId);
  const reste = Object.entries(erreursSaisieLogement(saisie, { surfaceFacultative: true, nomsPris: o.nomsPris }));
  if (reste.length) return { ok: false, etape: etapeDuChamp(reste[0][0]), erreur: reste[0][1] };
  return { ok: true, logement: logementDepuisSaisie(saisie, o.idLogement, o.aujourdhui), ...(proprietaire ? { proprietaire } : {}) };
}

/* ------------------------------------------------------------ récapitulatif */

const LITS_MOTS: Record<TypeLit, [string, string]> = {
  double: ['lit double', 'lits doubles'],
  simple: ['lit simple', 'lits simples'],
  canape: ['canapé-lit', 'canapés-lits'],
};
const compte = (n: number, [un, plusieurs]: [string, string]) => `${n} ${n > 1 ? plusieurs : un}`;

/** « Appartement T2 », « Maison »… */
export const libelleType = (t: TypeLogement): string => (familleDuType(t) === 'appartement' ? `Appartement ${t}` : LIBELLES.typeLogement[t]);

/** « 2 lits doubles, 1 canapé-lit » ; vide sans lit. */
export const texteLits = (lits: Record<TypeLit, number>): string =>
  TYPES_LIT.filter((t) => lits[t] > 0)
    .map((t) => compte(lits[t], LITS_MOTS[t]))
    .join(', ');

/** « 4 voyageurs · 2 chambres · 2 lits doubles, 1 canapé-lit · 45 m² » */
export function texteCapacite(b: Pick<BrouillonLogement, 'capacite' | 'chambres' | 'lits' | 'surfaceM2'>): string {
  return [
    compte(b.capacite, ['voyageur', 'voyageurs']),
    b.chambres > 0 ? compte(b.chambres, ['chambre', 'chambres']) : 'Pas de chambre séparée',
    texteLits(b.lits),
    b.surfaceM2.trim() ? `${b.surfaceM2.trim()} m²` : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

export interface LigneRecap {
  /** Unique dans le récapitulatif (un écran peut donner deux lignes). */
  cle: string;
  etape: Exclude<EtapeAssistant, 'recapitulatif'>;
  libelle: string;
  valeur: string;
}

/** Une ligne par écran, avec « Modifier » qui y ramène. */
export function lignesRecap(b: BrouillonLogement, proprietaires: readonly Pick<Proprietaire, 'id' | 'nom'>[]): LigneRecap[] {
  const proprietaire =
    b.modeProprietaire === 'nouveau'
      ? `${b.nouveauProprietaire.nom.trim()} (nouveau)`
      : (proprietaires.find((p) => p.id === b.proprietaireId)?.nom ?? '');
  const residence =
    b.residencePrincipale === undefined ? '' : b.residencePrincipale ? `Oui, ${PLAFOND_NUITS_RESIDENCE_PRINCIPALE} nuits par an au plus` : 'Non';
  return [
    { cle: 'type', etape: 'type', libelle: 'Type', valeur: b.type ? libelleType(b.type) : '' },
    { cle: 'adresse', etape: 'adresse', libelle: 'Adresse', valeur: [b.adresse.trim(), [b.codePostal.trim(), b.ville.trim()].filter(Boolean).join(' ')].filter(Boolean).join(', ') },
    { cle: 'capacite', etape: 'capacite', libelle: 'Capacité', valeur: texteCapacite(b) },
    { cle: 'nom', etape: 'nom', libelle: 'Nom', valeur: b.nom.trim() },
    { cle: 'proprietaire', etape: 'proprietaire', libelle: 'Propriétaire', valeur: proprietaire },
    { cle: 'residencePrincipale', etape: 'proprietaire', libelle: 'Résidence principale', valeur: residence },
  ];
}
