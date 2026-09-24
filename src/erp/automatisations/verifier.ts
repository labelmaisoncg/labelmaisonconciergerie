/**
 * Auto-contrôle du moteur sur le jeu de démo : exécute deux fois et vérifie
 * l'idempotence (la seconde exécution ne produit aucun changement), puis
 * affiche un résumé par règle.
 *
 * Lancement : npx esbuild src/erp/automatisations/verifier.ts --bundle --platform=node --outfile=/tmp/verifier.cjs && node /tmp/verifier.cjs
 */
import { MAINTENANT } from '../data/format';
import { AUJOURDHUI, creerSeed } from '../data/seed';
import { executerAutomatisations } from './moteur';
import { REGLES } from './regles';

export interface BilanVerification {
  ok: boolean;
  changements1: number;
  changements2: number;
  evenements: number;
  lignes: { regle: string; nom: string; changements: number; evenements: number; alertes: number }[];
}

export function verifierMoteur(): BilanVerification {
  const seed = creerSeed();
  const figee = JSON.stringify(seed);
  const options = { date: AUJOURDHUI, maintenant: MAINTENANT };
  const r1 = executerAutomatisations(seed, options);
  const r2 = executerAutomatisations(r1.donnees, options);
  const intact = JSON.stringify(seed) === figee;
  const lignes = REGLES.map((r) => ({
    regle: r.cle,
    nom: r.nom,
    changements: r1.changements.filter((c) => c.regle === r.cle).length,
    evenements: r1.evenements.filter((e) => e.regle === r.cle).length,
    alertes: r1.evenements.filter((e) => e.regle === r.cle && e.niveau === 'alerte').length,
  }));
  const idsEvenements2 = new Set(r2.evenements.map((e) => e.id));
  const nouveauxEvenements = r1.evenements.filter((e) => !idsEvenements2.has(e.id)).length;
  const ids = r1.donnees.missions.map((m) => m.id);
  const sansDoublon = new Set(ids).size === ids.length;
  const ok = intact && r2.changements.length === 0 && sansDoublon && r1.passes <= 3;
  if (typeof console !== 'undefined') {
    console.table(lignes);
    console.log(`Passe 1 : ${r1.changements.length} changements en ${r1.passes} passes, ${r1.evenements.length} événements.`);
    console.log(`Passe 2 : ${r2.changements.length} changements, ${r2.evenements.length} événements (${nouveauxEvenements} constats résolus entre-temps).`);
    console.log(`Seed intact : ${intact}. Ids de missions uniques : ${sansDoublon}. Résultat : ${ok ? 'OK' : 'ÉCHEC'}.`);
    if (r2.changements.length) console.log(r2.changements.slice(0, 10));
  }
  return { ok, changements1: r1.changements.length, changements2: r2.changements.length, evenements: r1.evenements.length, lignes };
}

verifierMoteur();
