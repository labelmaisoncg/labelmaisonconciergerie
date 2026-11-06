/**
 * Auto-contrôle des couleurs de logement (data/couleurs-logement.ts) :
 *   - palette : huit teintes distinctes, chacune lisible sous un texte blanc
 *     (contraste 4,5:1 au moins, texte des bandes du calendrier) ;
 *   - attribution d'office : jusqu'à huit logements, jamais deux fois la même
 *     couleur ; les sortis passent après ; au-delà, réparti sans tout
 *     empiler sur une teinte ;
 *   - une couleur choisie est gardée, une valeur inconnue en base est ignorée ;
 *   - la couleur ne dépend pas de l'ordre de la liste reçue ;
 *   - la saisie du logement garde la couleur choisie et n'en invente pas.
 *
 * Lancement (Node 18+) :
 *   node_modules/.bin/esbuild src/erp/data/verifier-couleurs-logement.ts --bundle --platform=node \
 *     --format=esm --log-level=error --outfile=/tmp/verifier-couleurs-logement.mjs && node /tmp/verifier-couleurs-logement.mjs
 */
import { COULEURS_LOGEMENT, couleursDesLogements, teinteConnue } from './couleurs-logement';
import { logementDepuisSaisie, logementVierge, saisieInitiale } from './creation-logement';
import type { CouleurLogement, Logement, StatutLogement } from './types';

let echecs = 0;
let reussis = 0;
function verifier(condition: unknown, message: string) {
  if (condition) reussis++;
  else {
    echecs++;
    console.error(`  ✗ ${message}`);
  }
}
function section(titre: string) {
  console.log(`\n${titre}`);
}

const luminance = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contraste = (a: string, b: string) => {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

type L = { id: string; statut: StatutLogement; couleur?: CouleurLogement };
const l = (id: string, statut: StatutLogement = 'actif', couleur?: string): L => ({ id, statut, ...(couleur ? { couleur: couleur as CouleurLogement } : {}) });

section('1. Palette');
verifier(COULEURS_LOGEMENT.length === 8, 'huit teintes');
verifier(new Set(COULEURS_LOGEMENT.map((c) => c.cle)).size === 8 && new Set(COULEURS_LOGEMENT.map((c) => c.teinte.toLowerCase())).size === 8, 'clés et teintes toutes différentes');
for (const c of COULEURS_LOGEMENT) {
  verifier(/^#[0-9a-f]{6}$/i.test(c.teinte), `${c.nom} : teinte au format #rrggbb`);
  verifier(contraste(c.teinte, '#ffffff') >= 4.5, `${c.nom} : texte blanc lisible (${contraste(c.teinte, '#ffffff').toFixed(2)}:1)`);
  verifier(contraste(c.teinte, '#fbfaf8') >= 3, `${c.nom} : pastille visible sur le fond de page`);
  verifier(c.nom.length > 1 && c.nom[0] === c.nom[0].toUpperCase(), `${c.nom} : nom lisible par un lecteur d'écran`);
}
verifier(!COULEURS_LOGEMENT.some((c) => c.teinte.toLowerCase() === '#8a6424'), 'l’or du bouton principal n’est pas une couleur de logement');
// Couleurs des canaux du Planning (erp.css : --lm-encre, --lm-sarcelle, --lm-or-texte) : une bande de logement ne doit pas s'y confondre.
const teinteDeg = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const M = Math.max(r, g, b);
  const d = M - Math.min(r, g, b);
  if (!d) return -1;
  const h = M === r ? ((g - b) / d) % 6 : M === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
};
const ecartTeinte = (a: string, b: string) => {
  const d = Math.abs(teinteDeg(a) - teinteDeg(b));
  return Math.min(d, 360 - d);
};
for (const [canal, hex] of [['Booking (sarcelle)', '#1c6f6c'], ['réservation directe (or)', '#8a6424']] as const) {
  verifier(COULEURS_LOGEMENT.every((c) => ecartTeinte(c.teinte, hex) >= 15), `aucune couleur de logement proche de ${canal}`);
}
verifier(COULEURS_LOGEMENT.every((c) => contraste(c.teinte, '#14110e') >= 2), 'aucune couleur de logement ne se confond avec l’encre (Airbnb)');

section('2. Attribution d’office');
{
  const quatre = [l('log-a'), l('log-b'), l('log-c'), l('log-d')];
  const m = couleursDesLogements(quatre);
  verifier(new Set([...m.values()].map((c) => c.cle)).size === 4, '4 logements : 4 couleurs différentes');
  verifier(m.get('log-a')?.cle === COULEURS_LOGEMENT[0].cle && m.get('log-d')?.cle === COULEURS_LOGEMENT[3].cle, 'dans l’ordre de la palette, par identifiant');
  const melange = couleursDesLogements([...quatre].reverse());
  verifier(quatre.every((x) => melange.get(x.id)?.cle === m.get(x.id)?.cle), 'même résultat quel que soit l’ordre reçu');

  const huit = Array.from({ length: 8 }, (_, i) => l(`log-${i}`));
  verifier(new Set([...couleursDesLogements(huit).values()].map((c) => c.cle)).size === 8, '8 logements : 8 couleurs différentes');

  const douze = Array.from({ length: 12 }, (_, i) => l(`log-${String(i).padStart(2, '0')}`));
  const usages = new Map<string, number>();
  for (const c of couleursDesLogements(douze).values()) usages.set(c.cle, (usages.get(c.cle) ?? 0) + 1);
  verifier(Math.max(...usages.values()) - Math.min(...[...COULEURS_LOGEMENT].map((c) => usages.get(c.cle) ?? 0)) <= 1, '12 logements : réparti (au plus une couleur d’écart)');

  const avecSorti = couleursDesLogements([l('log-a', 'sorti'), l('log-b'), l('log-c', 'pause'), l('log-d', 'lancement')]);
  verifier(avecSorti.get('log-b')?.cle === COULEURS_LOGEMENT[0].cle && avecSorti.get('log-a')?.cle === COULEURS_LOGEMENT[3].cle, 'les logements en service d’abord, le sorti en dernier');

  const ajout = couleursDesLogements([...quatre, l('log-e')]);
  verifier(quatre.every((x) => ajout.get(x.id)?.cle === m.get(x.id)?.cle) && ajout.get('log-e')?.cle === COULEURS_LOGEMENT[4].cle, 'un logement ajouté (identifiant après) ne change la couleur d’aucun autre');
}

section('3. Couleur choisie');
{
  const m = couleursDesLogements([l('log-a'), l('log-b', 'actif', 'bleu'), l('log-c')]);
  verifier(m.get('log-b')?.cle === 'bleu', 'la couleur choisie est gardée');
  verifier(m.get('log-a')?.cle !== 'bleu' && m.get('log-c')?.cle !== 'bleu', 'les autres prennent une couleur libre');
  verifier(new Set([...m.values()].map((c) => c.cle)).size === 3, 'toujours trois couleurs différentes');
  const deuxFois = couleursDesLogements([l('log-a', 'actif', 'vert'), l('log-b', 'actif', 'vert'), l('log-c')]);
  verifier(deuxFois.get('log-a')?.cle === 'vert' && deuxFois.get('log-b')?.cle === 'vert', 'deux logements peuvent choisir la même couleur');
  const inconnue = couleursDesLogements([l('log-a', 'actif', 'fuchsia'), l('log-b')]);
  verifier(inconnue.get('log-a')?.cle === COULEURS_LOGEMENT[0].cle, 'une valeur inconnue en base est ignorée (couleur d’office)');
  verifier(teinteConnue('bleu')?.nom === 'Bleu' && teinteConnue('rouge') === undefined && teinteConnue(42) === undefined && teinteConnue(undefined) === undefined, 'teinteConnue : seulement les clés de la palette');
}

section('4. Saisie du logement');
{
  const base: Logement = { ...logementVierge('log-x'), nom: 'Test', adresse: '1 rue A', codePostal: '91100', ville: 'Corbeil', capacite: 2, proprietaireId: 'pro-1' };
  const s = saisieInitiale(base);
  verifier(!('couleur' in s), 'sans couleur enregistrée : la saisie n’en invente pas');
  const sansChoix = logementDepuisSaisie(s, base, '2026-11-06');
  verifier(!('couleur' in sansChoix), 'enregistré sans choix : toujours attribuée d’office');
  const choisi = logementDepuisSaisie({ ...s, couleur: 'prune' }, base, '2026-11-06');
  verifier(choisi.couleur === 'prune', 'couleur choisie enregistrée');
  verifier(saisieInitiale(choisi).couleur === 'prune', 'rouvert : la couleur choisie revient');
  const renomme = logementDepuisSaisie({ ...saisieInitiale(choisi), nom: 'Autre nom' }, choisi, '2026-11-06');
  verifier(renomme.couleur === 'prune', 'modifier autre chose garde la couleur');
}

console.log(`\n${reussis} contrôles réussis, ${echecs} en échec.`);
if (echecs) throw new Error(`${echecs} contrôle(s) en échec`);
