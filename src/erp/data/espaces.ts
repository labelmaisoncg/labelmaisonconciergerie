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

/**
 * Invitation de Label Maison à ouvrir un espace, en attente pour le compte
 * connecté : nom proposé, fin de validité. Le compte n'est alors membre
 * d'aucun espace : l'ERP lui propose de créer celui de sa conciergerie
 * (erp.creer_espace).
 */
export interface InvitationEspace {
  nom: string;
  expireLe: string;
}

/**
 * Invitation en attente lue dans erp.qui_suis_je →
 * `invitations_espace: [{ nom_espace, expire_le }]` (null : aucune). Mêmes
 * règles que la page d'accès (middleware.ts) : une liste ; un élément vaut
 * s'il est un objet dont l'échéance, quand elle est donnée, se lit et n'est
 * pas passée. Toute autre forme ne vaut rien.
 */
export function lireInvitationEspace(brut: unknown, maintenant: number = Date.now()): InvitationEspace | null {
  const liste = (brut as { invitations_espace?: unknown } | null)?.invitations_espace;
  if (!Array.isArray(liste)) return null;
  for (const i of liste) {
    if (!i || typeof i !== 'object' || Array.isArray(i)) continue;
    const { nom_espace: nom, expire_le: expire } = i as { nom_espace?: unknown; expire_le?: unknown };
    if (expire !== undefined && expire !== null) {
      const t = typeof expire === 'string' ? Date.parse(expire) : NaN;
      if (!Number.isFinite(t) || t <= maintenant) continue;
    }
    return { nom: typeof nom === 'string' ? nom.trim() : '', expireLe: typeof expire === 'string' ? expire : '' };
  }
  return null;
}

/**
 * Pourquoi un compte sans espace n'entre pas, d'après erp.qui_suis_je (rien
 * n'y ouvre l'accès) : `espaces_suspendus: [{ nom }]` (espaces suspendus par
 * Label Maison dont il est membre) et `invitations_espace_closes:
 * [{ nom_espace, motif: 'expiree' | 'annulee' }]`.
 */
export interface RefusAcces {
  suspendus: string[];
  invitationClose: 'expiree' | 'annulee' | null;
}

export function lireRefusAcces(brut: unknown): RefusAcces {
  const d = (brut ?? {}) as { espaces_suspendus?: unknown; invitations_espace_closes?: unknown };
  const suspendus = Array.isArray(d.espaces_suspendus)
    ? d.espaces_suspendus
        .map((e) => (e && typeof e === 'object' && typeof (e as { nom?: unknown }).nom === 'string' ? (e as { nom: string }).nom.trim() : ''))
        .filter((n) => n.length > 0 && n.length <= 80)
    : [];
  const closes = Array.isArray(d.invitations_espace_closes) ? d.invitations_espace_closes : [];
  const motifs = closes.map((i) => (i && typeof i === 'object' ? (i as { motif?: unknown }).motif : undefined));
  const invitationClose = motifs.includes('expiree') ? 'expiree' : motifs.includes('annulee') ? 'annulee' : null;
  return { suspendus, invitationClose };
}

/** Message à montrer (page d'accès et application) ; null : refus ordinaire. */
export function messageRefusAcces(r: RefusAcces): string | null {
  if (r.suspendus.length === 1) return `L’espace ${r.suspendus[0]} est suspendu : contactez Label Maison. Rien n’est effacé.`;
  if (r.suspendus.length > 1) {
    const noms = `${r.suspendus.slice(0, -1).join(', ')} et ${r.suspendus[r.suspendus.length - 1]}`;
    return `Les espaces ${noms} sont suspendus : contactez Label Maison. Rien n’est effacé.`;
  }
  if (r.invitationClose === 'expiree') return 'Votre invitation a expiré : demandez-en une nouvelle à Label Maison.';
  if (r.invitationClose === 'annulee') return 'Votre invitation a été annulée : demandez-en une nouvelle à Label Maison.';
  return null;
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

/** Espace privé (bucket) des fichiers de l'ERP (supabase/erp-installation.sql). */
export const BUCKET_FICHIERS_ERP = 'erp-fichiers';

/**
 * Le fichier « stockage://erp-fichiers/… » est-il à cet espace ? Même règle
 * que la base (erp.espace_du_chemin), en plus strict : un autre espace que
 * Label Maison n'a que les fichiers de son dossier (« <espace>/… ») ; Label
 * Maison a les chemins d'avant, jamais un fichier rangé sous le dossier d'un
 * espace (premier dossier en forme d'identifiant). Autre bucket, dossier
 * vide, « . » ou « .. » : refusé. Le serveur ne signe et ne dépose rien
 * d'autre (api/_erp-repull.ts), quel que soit l'appelant.
 */
export function fichierDeLEspace(fichier: unknown, espace: string | null | undefined): fichier is string {
  const debut = `stockage://${BUCKET_FICHIERS_ERP}/`;
  if (typeof fichier !== 'string' || fichier.length > 1000 || !fichier.startsWith(debut)) return false;
  const dossiers = fichier.slice(debut.length).split('/');
  if (dossiers.some((d) => !d || d === '.' || d === '..')) return false;
  if (estLabelMaison(espace)) return !idEspaceValide(dossiers[0]);
  return idEspaceValide(espace) && dossiers.length > 1 && dossiers[0].toLowerCase() === espace.toLowerCase();
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
