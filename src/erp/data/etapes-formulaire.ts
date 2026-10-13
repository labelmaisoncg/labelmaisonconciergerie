/**
 * Formulaire « une question par écran » : schéma d'étapes partagé par
 * l'assistant du site (src/app/ui/Wizard.tsx), la fiche modifiable de l'ERP
 * (src/erp/ui/FicheEtapes.tsx) et la validation côté serveur (api/). Module
 * pur : ni React, ni Node.
 *
 * Une étape = une question (titre), une phrase d'aide, un seul champ ou un
 * groupe très lié (l'adresse). Les réponses vivent dans un seul objet
 * `Valeurs`, indexé par l'identifiant de chaque champ.
 */
import { EMAIL_SUR } from './crm.js';

export type Valeurs = Record<string, unknown>;

export type TypeChamp =
  | 'texte'
  | 'email'
  | 'tel'
  | 'nombre'
  | 'date'
  | 'zone'
  /** Une réponse parmi plusieurs. */
  | 'choix'
  /** Plusieurs réponses possibles. */
  | 'multi'
  /** Une case à cocher (accord, certification). */
  | 'case'
  /** Une liste d'éléments, une réponse par élément (inventaire). */
  | 'grille'
  /** Une liste d'éléments, un nombre par élément (linge). */
  | 'quantites';

export interface OptionChamp {
  valeur: string;
  libelle: string;
  aide?: string;
}

export interface ElementListe {
  id: string;
  libelle: string;
  /** Indispensable (repère affiché, pas une obligation de réponse). */
  essentiel?: boolean;
}

export interface Champ {
  /** Clé de la réponse dans `Valeurs`. */
  id: string;
  /** Libellé court : groupe de champs, récapitulatif, e-mail, fiche de l'ERP. */
  libelle: string;
  type: TypeChamp;
  requis?: boolean;
  options?: OptionChamp[];
  elements?: ElementListe[];
  placeholder?: string;
  min?: number;
  max?: number;
  /** Longueur maximale d'un texte (200 par défaut, 2 000 pour une zone). */
  longueurMax?: number;
  format?: 'code_postal' | 'siren';
  autocomplete?: string;
  /** Valeur proposée au départ (ex. un plafond en euros). */
  defaut?: unknown;
}

export interface Etape {
  id: string;
  /** Chapitre affiché au-dessus de la question (« Vous », « Le logement »…). */
  partie: string;
  question: string;
  aide?: string;
  champs: Champ[];
  /** Étape affichée seulement si la condition est vraie. */
  si?: (v: Valeurs) => boolean;
  /** Information affichée sous les champs selon les réponses. */
  note?: (v: Valeurs) => string | undefined;
}

const LONGUEUR_TEXTE = 200;
const LONGUEUR_ZONE = 2000;

export const longueurMax = (c: Champ) => c.longueurMax ?? (c.type === 'zone' ? LONGUEUR_ZONE : LONGUEUR_TEXTE);

/** Étapes à parcourir avec les réponses actuelles (les conditions écartent les autres). */
export function etapesVisibles(etapes: Etape[], v: Valeurs): Etape[] {
  return etapes.filter((e) => !e.si || e.si(v));
}

/** Une étape sans champ obligatoire se passe (« Plus tard »). */
export function etapeFacultative(e: Etape): boolean {
  return !e.champs.some((c) => c.requis);
}

/** Valeurs de départ (champs avec une valeur proposée). */
export function valeursInitiales(etapes: Etape[]): Valeurs {
  const v: Valeurs = {};
  for (const e of etapes) for (const c of e.champs) if (c.defaut !== undefined) v[c.id] = c.defaut;
  return v;
}

export function estVide(c: Champ, valeur: unknown): boolean {
  switch (c.type) {
    case 'multi':
      return !Array.isArray(valeur) || valeur.length === 0;
    case 'case':
      return valeur !== true;
    case 'grille':
    case 'quantites':
      return !valeur || typeof valeur !== 'object' || Object.keys(valeur as object).length === 0;
    case 'nombre':
      return valeur === undefined || valeur === null || String(valeur).trim() === '';
    default:
      return String(valeur ?? '').trim() === '';
  }
}

function messageRequis(c: Champ): string {
  if (c.type === 'case') return 'Cochez la case pour continuer.';
  if (c.type === 'choix' || c.type === 'multi' || c.type === 'grille') return 'Choisissez une réponse.';
  return 'Ce champ est requis.';
}

const chiffres = (s: string) => s.replace(/\D/g, '');

/** Erreur d'un champ, en une phrase (undefined : rien à redire). */
export function erreurChamp(c: Champ, valeur: unknown): string | undefined {
  if (estVide(c, valeur)) return c.requis ? messageRequis(c) : undefined;
  const texte = String(valeur).trim();
  const options = new Set((c.options ?? []).map((o) => o.valeur));
  const elements = new Set((c.elements ?? []).map((e) => e.id));
  if (['texte', 'zone', 'email', 'tel', 'date', 'choix', 'nombre'].includes(c.type) && texte.length > longueurMax(c)) {
    return `Trop long : ${longueurMax(c)} caractères au plus.`;
  }
  switch (c.type) {
    case 'email':
      return EMAIL_SUR.test(texte) ? undefined : 'Adresse e-mail invalide, par exemple nom@exemple.fr.';
    case 'tel': {
      const n = chiffres(texte).length;
      return n >= 9 && n <= 15 && /^[+\d\s.()-]+$/.test(texte) ? undefined : 'Numéro de téléphone invalide, par exemple 06 12 34 56 78.';
    }
    case 'nombre': {
      const n = Number(String(valeur).replace(',', '.'));
      if (!Number.isFinite(n)) return 'Entrez un nombre.';
      if (c.min !== undefined && n < c.min) return `Au moins ${c.min}.`;
      if (c.max !== undefined && n > c.max) return `Au plus ${c.max}.`;
      return undefined;
    }
    case 'date':
      return /^\d{4}-\d{2}-\d{2}$/.test(texte) && !Number.isNaN(Date.parse(texte)) ? undefined : 'Date invalide.';
    case 'choix':
      return options.has(texte) ? undefined : 'Choisissez une réponse proposée.';
    case 'multi':
      return (valeur as unknown[]).every((x) => options.has(String(x))) ? undefined : 'Réponse inconnue.';
    case 'case':
      return undefined;
    case 'grille':
      return Object.entries(valeur as Record<string, unknown>).every(([k, x]) => elements.has(k) && options.has(String(x)))
        ? undefined
        : 'Réponse inconnue.';
    case 'quantites':
      return Object.entries(valeur as Record<string, unknown>).every(
        ([k, x]) => elements.has(k) && Number.isInteger(Number(x)) && Number(x) >= 0 && Number(x) <= (c.max ?? 999),
      )
        ? undefined
        : `Des nombres entiers entre 0 et ${c.max ?? 999}.`;
  }
  if (c.format === 'code_postal' && !/^\d{5}$/.test(texte)) return 'Code postal à 5 chiffres.';
  if (c.format === 'siren' && chiffres(texte).length !== 9) return 'Le SIREN compte 9 chiffres.';
  return undefined;
}

/** Erreurs d'une étape, par champ. */
export function erreursEtape(e: Etape, v: Valeurs): Record<string, string> {
  const r: Record<string, string> = {};
  for (const c of e.champs) {
    const err = erreurChamp(c, v[c.id]);
    if (err) r[c.id] = err;
  }
  return r;
}

/** Réponse lisible (récapitulatif, e-mail, fiche de l'ERP). Chaîne vide : sans réponse. */
export function valeurAffichee(c: Champ, valeur: unknown): string {
  if (estVide(c, valeur)) return '';
  const libelleOption = (x: unknown) => c.options?.find((o) => o.valeur === String(x))?.libelle ?? String(x);
  switch (c.type) {
    case 'choix':
      return libelleOption(valeur);
    case 'multi':
      return (valeur as unknown[]).map(libelleOption).join(', ');
    case 'case':
      return 'Oui';
    case 'date': {
      const d = new Date(`${String(valeur)}T12:00:00`);
      return Number.isNaN(d.getTime()) ? String(valeur) : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    }
    case 'grille': {
      const r = valeur as Record<string, string>;
      return (c.options ?? [])
        .map((o) => {
          const noms = (c.elements ?? []).filter((e) => r[e.id] === o.valeur).map((e) => e.libelle);
          return noms.length ? `${o.libelle} : ${noms.join(', ')}` : '';
        })
        .filter(Boolean)
        .join(' · ');
    }
    case 'quantites': {
      const r = valeur as Record<string, number>;
      return (c.elements ?? [])
        .filter((e) => Number(r[e.id]) > 0)
        .map((e) => `${e.libelle} : ${r[e.id]}`)
        .join(' · ');
    }
    default:
      return String(valeur).trim();
  }
}

export interface LigneRecapitulatif {
  etape: Etape;
  champ: Champ;
  partie: string;
  /** La question si l'étape n'a qu'un champ, sinon le libellé du champ. */
  libelle: string;
  valeur: string;
}

/** Toutes les réponses des étapes visibles, dans l'ordre (récapitulatif, e-mail, ERP). */
export function lignesRecapitulatif(etapes: Etape[], v: Valeurs): LigneRecapitulatif[] {
  return etapesVisibles(etapes, v).flatMap((etape) =>
    etape.champs.map((champ) => ({
      etape,
      champ,
      partie: etape.partie,
      libelle: champ.libelle,
      valeur: valeurAffichee(champ, v[champ.id]),
    })),
  );
}

/** Remet une réponse reçue au bon type ; undefined si elle ne vaut rien. */
function coercer(c: Champ, brut: unknown): unknown {
  if (brut === undefined || brut === null) return undefined;
  const options = new Set((c.options ?? []).map((o) => o.valeur));
  const elements = new Set((c.elements ?? []).map((e) => e.id));
  switch (c.type) {
    case 'case':
      return brut === true ? true : undefined;
    case 'nombre': {
      if (typeof brut !== 'number' && typeof brut !== 'string') return undefined;
      const t = String(brut).trim();
      return t === '' ? undefined : t.slice(0, 20);
    }
    case 'multi':
      return Array.isArray(brut) ? [...new Set(brut.map(String).filter((x) => options.has(x)))] : undefined;
    case 'grille':
    case 'quantites': {
      if (typeof brut !== 'object' || Array.isArray(brut)) return undefined;
      const r: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(brut as Record<string, unknown>)) {
        if (!elements.has(k)) continue;
        if (c.type === 'grille' && options.has(String(x))) r[k] = String(x);
        if (c.type === 'quantites' && String(x).trim() !== '' && Number.isFinite(Number(x))) r[k] = Number(x);
      }
      return Object.keys(r).length ? r : undefined;
    }
    default:
      return typeof brut === 'string' || typeof brut === 'number' ? String(brut).trim() : undefined;
  }
}

/**
 * Côté serveur : ne garde que les champs connus des étapes visibles, au bon
 * type, puis vérifie chaque étape. Une réponse d'une étape masquée par une
 * condition est écartée.
 */
export function nettoyerValeurs(etapes: Etape[], brut: unknown): { ok: true; valeurs: Valeurs } | { ok: false; erreurs: string[] } {
  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return { ok: false, erreurs: ['Réponses illisibles.'] };
  const source = brut as Record<string, unknown>;
  const tout: Valeurs = {};
  for (const e of etapes) {
    for (const c of e.champs) {
      const x = coercer(c, source[c.id]);
      if (x !== undefined && !estVide(c, x)) tout[c.id] = x;
    }
  }
  const valeurs: Valeurs = {};
  const erreurs: string[] = [];
  for (const e of etapesVisibles(etapes, tout)) {
    for (const c of e.champs) {
      if (tout[c.id] !== undefined) valeurs[c.id] = tout[c.id];
      const err = erreurChamp(c, tout[c.id]);
      if (err) erreurs.push(`${e.question} (${c.libelle}) : ${err}`);
    }
  }
  return erreurs.length ? { ok: false, erreurs } : { ok: true, valeurs };
}
