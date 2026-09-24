/**
 * Calculs du module Annonces : version en ligne, effet sur les réservations,
 * indicateurs et différence mot à mot. Purs, sans date système.
 */
import { AUJOURDHUI, ajouterJours, ecartJours } from '../../../data/format';
import type { ErpDonnees, Id, Reservation, RoleUtilisateur, StatutVersionAnnonce, VersionAnnonce } from '../../../data/types';
import { idVersion } from '../../../annonces/generer';
import type { Ton } from '../../../ui';

export const MOIS_COURANT = AUJOURDHUI.slice(0, 7);
export const FENETRE_EFFET_JOURS = 30;
export const SEUIL_ANCIENNETE_JOURS = 60;

export const LIBELLES_STATUT: Record<StatutVersionAnnonce, string> = {
  proposee: 'À valider',
  validee: 'Validée, à publier',
  publiee: 'Publiée',
  rejetee: 'Rejetée',
};

export const TONS_STATUT: Record<StatutVersionAnnonce, Ton> = {
  proposee: 'or',
  validee: 'info',
  publiee: 'succes',
  rejetee: 'neutre',
};

/** Seuls les gérants et les opérations (Abdel, Kamel) valident et publient. */
export const peutValider = (role: RoleUtilisateur) => role === 'gerant' || role === 'operations';

const parDateDesc = (a: VersionAnnonce, b: VersionAnnonce) =>
  (b.publieeLe ?? b.valideeLe ?? b.creeLe).localeCompare(a.publieeLe ?? a.valideeLe ?? a.creeLe) || b.id.localeCompare(a.id);

export function versionsDu(versions: VersionAnnonce[], logementId: Id): VersionAnnonce[] {
  return versions.filter((v) => v.logementId === logementId).sort(parDateDesc);
}

/** Version actuellement en ligne : la dernière publiée. */
export function versionEnLigne(versions: VersionAnnonce[], logementId: Id): VersionAnnonce | undefined {
  return versions
    .filter((v) => v.logementId === logementId && v.statut === 'publiee' && v.publieeLe)
    .sort((a, b) => (b.publieeLe as string).localeCompare(a.publieeLe as string))[0];
}

export interface Effet {
  avant: number;
  apres: number;
  /** La fenêtre « après » déborde sur le futur : mesure provisoire. */
  provisoire: boolean;
  /** Pas de réservations connues avant la fenêtre « avant » : comparaison biaisée. */
  sansHistorique: boolean;
}

const compte = (rs: Reservation[], logementId: Id, de: string, a: string) =>
  rs.filter((r) => r.logementId === logementId && r.statut !== 'annulee' && r.arrivee >= de && r.arrivee < a).length;

/**
 * Réservations 30 j avant et 30 j après la publication. Les réservations
 * n'ont pas de date de création : on compte les arrivées dans chaque
 * fenêtre (approximation affichée en infobulle).
 */
export function effetPublication(d: Pick<ErpDonnees, 'reservations'>, v: VersionAnnonce): Effet | undefined {
  if (v.statut !== 'publiee' || !v.publieeLe || v.publieeLe > AUJOURDHUI) return undefined;
  const p = v.publieeLe;
  const premiere = d.reservations
    .filter((r) => r.logementId === v.logementId)
    .reduce<string | undefined>((min, r) => (!min || r.arrivee < min ? r.arrivee : min), undefined);
  return {
    avant: compte(d.reservations, v.logementId, ajouterJours(p, -FENETRE_EFFET_JOURS), p),
    apres: compte(d.reservations, v.logementId, p, ajouterJours(p, FENETRE_EFFET_JOURS)),
    provisoire: ajouterJours(p, FENETRE_EFFET_JOURS) > AUJOURDHUI,
    sansHistorique: !premiere || premiere > ajouterJours(p, -FENETRE_EFFET_JOURS),
  };
}

export const AIDE_EFFET =
  'Arrivées dans les 30 jours après la publication, moins les 30 jours avant. Les réservations n’ont pas encore de date de création : les arrivées servent d’approximation. La moyenne ne retient que les mesures complètes (30 jours écoulés, historique disponible avant publication).';

export function indicateurs(d: Pick<ErpDonnees, 'reservations' | 'versionsAnnonce' | 'logements'>) {
  const v = d.versionsAnnonce;
  const actifs = d.logements.filter((l) => l.statut === 'actif');
  const aValider = v.filter((x) => x.statut === 'proposee' || x.statut === 'validee').length;
  const publieesMois = v.filter((x) => x.statut === 'publiee' && x.publieeLe?.startsWith(MOIS_COURANT)).length;
  const anciens = actifs.filter((l) => {
    const e = versionEnLigne(v, l.id);
    return !e?.publieeLe || ecartJours(e.publieeLe, AUJOURDHUI) > SEUIL_ANCIENNETE_JOURS;
  });
  const effets = v.map((x) => effetPublication(d, x)).filter((e): e is Effet => !!e && !e.provisoire && !e.sansHistorique);
  const moyenne = effets.length ? effets.reduce((s, e) => s + (e.apres - e.avant), 0) / effets.length : undefined;
  return { aValider, publieesMois, anciens, effetMoyen: moyenne, nbMesures: effets.length };
}

/** Id libre pour une nouvelle proposition du mois (révision suivante si besoin). */
export function prochainId(versions: VersionAnnonce[], logementId: Id, mois: string): string {
  const ids = new Set(versions.map((v) => v.id));
  let r = 1;
  while (ids.has(idVersion(logementId, mois, r))) r += 1;
  return idVersion(logementId, mois, r);
}

/* ------------------------------------------------------------ diff mots */

export interface Morceau {
  texte: string;
  type: 'commun' | 'ajout' | 'retrait';
}

/** Différence mot à mot (plus longue sous-suite commune). */
export function diffMots(ancien: string, nouveau: string): { avant: Morceau[]; apres: Morceau[] } {
  const a = ancien.split(/\s+/).filter(Boolean);
  const b = nouveau.split(/\s+/).filter(Boolean);
  const n = a.length;
  const m = b.length;
  const t: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) t[i][j] = a[i] === b[j] ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1]);
  }
  const avant: Morceau[] = [];
  const apres: Morceau[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      avant.push({ texte: a[i], type: 'commun' });
      apres.push({ texte: b[j], type: 'commun' });
      i++;
      j++;
    } else if (t[i + 1][j] >= t[i][j + 1]) avant.push({ texte: a[i++], type: 'retrait' });
    else apres.push({ texte: b[j++], type: 'ajout' });
  }
  while (i < n) avant.push({ texte: a[i++], type: 'retrait' });
  while (j < m) apres.push({ texte: b[j++], type: 'ajout' });
  return { avant, apres };
}
