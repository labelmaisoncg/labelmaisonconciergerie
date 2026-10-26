/**
 * Espaces de l'ERP (supabase/erp-espaces.sql) : la même application sert
 * plusieurs équipes, chacune avec ses données (Label Maison, puis Sens…).
 *
 * Chaque ligne de la base porte la colonne `espace`. Tant que le SQL n'est
 * pas passé, la base est « historique » : une seule équipe, Label Maison, et
 * le code fait exactement comme avant (aucune colonne, aucun en-tête).
 *
 * Module pur, partagé par le navigateur et le serveur ; l'espace ouvert dans
 * le navigateur est retenu ici (ouvrirEspace) pour les appels aux routes /api.
 */

/** Espace de Label Maison : reçoit toutes les données d'avant les espaces. */
export const ID_LABEL_MAISON = '4c4d0000-0000-4000-8000-000000000001';
export const CODE_LABEL_MAISON = 'label-maison';

/** En-tête qui nomme l'espace (routes /api, et requêtes du serveur à la base). */
export const ENTETE_ESPACE = 'x-erp-espace';

/** Compte technique du serveur : ne voit que l'espace que l'en-tête nomme. */
export const EMAIL_SERVEUR = 'serveur@labelmaisoncg.fr';

export const MESSAGE_BASE_PAS_PREPAREE = 'Base pas encore préparée : lancez supabase/erp-espaces.sql.';

export interface Espace {
  id: string;
  code: string;
  nom: string;
}

/** Espace dont un compte est membre, avec son rôle (erp.qui_suis_je). */
export interface EspaceMembre extends Espace {
  role: string;
}

export const ESPACE_LABEL_MAISON: Espace = { id: ID_LABEL_MAISON, code: CODE_LABEL_MAISON, nom: 'Label Maison' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const idEspaceValide = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);

export const estLabelMaison = (espace: string | Pick<Espace, 'id'> | null | undefined): boolean =>
  !espace || (typeof espace === 'string' ? espace : espace.id).toLowerCase() === ID_LABEL_MAISON;

/**
 * Erreur d'une base pas encore passée aux espaces : colonne `espace` inconnue
 * (42703, PGRST204) ou fonction des espaces absente (PGRST202, 42883).
 */
export function erreurBaseHistorique(e: unknown): boolean {
  const x = (e ?? {}) as { code?: unknown; message?: unknown };
  const code = String(x.code ?? '');
  const message = String(x.message ?? e ?? '');
  if (code === 'PGRST202' || code === '42883') return true;
  if (code === '42703' || code === 'PGRST204') return /espace/i.test(message);
  return /could not find the function erp\.(qui_suis_je|espaces_actifs)/i.test(message);
}

/** Lecture tolérante de la réponse de erp.qui_suis_je(). */
export function lireEspacesMembre(brut: unknown): EspaceMembre[] {
  const liste = (brut as { espaces?: unknown } | null)?.espaces;
  if (!Array.isArray(liste)) return [];
  return liste
    .filter((e): e is EspaceMembre => !!e && idEspaceValide((e as EspaceMembre).id) && typeof (e as EspaceMembre).role === 'string')
    .map((e) => ({ id: e.id.toLowerCase(), code: String(e.code ?? ''), nom: String(e.nom ?? ''), role: e.role }));
}

/** Espace à ouvrir : celui demandé s'il en est membre, sinon Label Maison, sinon le premier. */
export function choisirEspace<T extends Pick<Espace, 'id'>>(espaces: T[], demande?: string | null): T | null {
  const voulu = demande?.toLowerCase();
  return (voulu && espaces.find((e) => e.id === voulu)) || espaces.find((e) => estLabelMaison(e)) || espaces[0] || null;
}

/* ------------------------------------------------- espace ouvert (navigateur) */

/** null : base historique (Label Maison, sans colonne espace). */
let ouvert: Espace | null = null;

/** Retient l'espace de la session (null : base d'avant les espaces). */
export function ouvrirEspace(e: Espace | null) {
  ouvert = e;
}

/** Espace affiché (Label Maison tant que la base est historique). */
export function espaceOuvert(): Espace {
  return ouvert ?? ESPACE_LABEL_MAISON;
}

/** Identifiant à écrire dans la colonne espace ; null : base historique. */
export function espaceDesDonnees(): string | null {
  return ouvert?.id ?? null;
}

/** Préfixe des fichiers de l'espace dans le stockage (rien pour Label Maison : chemins d'avant). */
export function prefixeFichiers(espace: string | null = espaceDesDonnees()): string {
  return espace && !estLabelMaison(espace) ? `${espace}/` : '';
}

/** Clé de stockage local propre à l'espace (inchangée pour Label Maison). */
export function cleLocale(base: string, espace: string | null = espaceDesDonnees()): string {
  return espace && !estLabelMaison(espace) ? `${base}@${espace}` : base;
}

/** En-têtes d'une route /api de l'ERP : la session du compte et l'espace ouvert. */
export function entetesServeur(jeton: string, json = true): Record<string, string> {
  return {
    Authorization: `Bearer ${jeton}`,
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    ...(ouvert ? { [ENTETE_ESPACE]: ouvert.id } : {}),
  };
}
