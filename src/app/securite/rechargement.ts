/**
 * Après un déploiement, un onglet resté ouvert réclame des morceaux de code
 * (chunks) de l'ancienne version, qui n'existent plus : le chargement échoue.
 * On recharge alors la page une fois pour récupérer la version en ligne. Le
 * garde-fou en sessionStorage évite toute boucle si l'échec persiste.
 */
const CLE = 'lm-rechargement-apres-deploiement';
const DELAI_MS = 30_000;

export function estErreurDeChargement(erreur: unknown): boolean {
  const message = erreur instanceof Error ? `${erreur.name} ${erreur.message}` : String(erreur);
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported|ChunkLoadError|Loading chunk|preload/i.test(
    message,
  );
}

/** Recharge une fois ; renvoie false si un rechargement vient déjà d'avoir lieu. */
export function rechargerUneFois(): boolean {
  try {
    const dernier = Number(window.sessionStorage.getItem(CLE) || 0);
    if (Date.now() - dernier < DELAI_MS) return false;
    window.sessionStorage.setItem(CLE, String(Date.now()));
  } catch {
    /* sessionStorage indisponible : on recharge quand même, une seule fois par erreur */
  }
  window.location.reload();
  return true;
}
