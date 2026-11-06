/**
 * Auto-contrôle des couleurs de logement (data/couleurs-logement.ts) :
 *   - palette : huit jetons `--lm-logement-*` déclarés dans erp.css, lisibles
 *     sous un texte blanc, distincts entre eux et loin (ΔE2000 ≥ 10) des
 *     couleurs qui ont déjà un sens : encre (Airbnb), sarcelle (Booking), or
 *     (direct), violet (« Autre »), info, succès, danger, alerte, orange ;
 *   - stabilité : la couleur d'un logement ne change que si on la change pour
 *     lui (choisir celle d'un autre, en sortir un, l'ordre reçu : sans effet ;
 *     « repull-1000 » se classe après « repull-101 ») ;
 *   - enregistrement : un nouveau logement prend la couleur la moins portée,
 *     la synchronisation enregistre pour un logement importé celle qu'il
 *     affiche déjà, et rien d'autre ;
 *   - la saisie du logement garde la couleur choisie et n'en invente pas.
 *
 * Lancement (Node 18+) :
 *   node_modules/.bin/esbuild src/erp/data/verifier-couleurs-logement.ts --bundle --platform=node \
 *     --format=esm --log-level=error --outfile=/tmp/verifier-couleurs-logement.mjs && node /tmp/verifier-couleurs-logement.mjs
 */
import { COULEURS_LOGEMENT, couleurLibre, couleursAEnregistrer, couleursDesLogements, teinteConnue } from './couleurs-logement';
import { logementDepuisSaisie, logementVierge, saisieInitiale } from './creation-logement';
import type { CouleurLogement, Logement } from './types';

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

/* ------------------------------------------------------------ couleurs */

const rvb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const lineaire = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const luminance = (hex: string) => {
  const [r, g, b] = rvb(hex).map(lineaire);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contraste = (a: string, b: string) => {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
function lab(hex: string): [number, number, number] {
  const [r, g, b] = rvb(hex).map(lineaire);
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047);
  const y = f(r * 0.2126 + g * 0.7152 + b * 0.0722);
  const z = f((r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
/** Écart perçu entre deux couleurs (CIEDE2000). */
function deltaE(h1: string, h2: string): number {
  const rad = Math.PI / 180;
  const [L1, a1, b1] = lab(h1);
  const [L2, a2, b2] = lab(h2);
  const Cm = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)));
  const a1p = a1 * (1 + G);
  const a2p = a2 * (1 + G);
  const C1 = Math.hypot(a1p, b1);
  const C2 = Math.hypot(a2p, b2);
  const angle = (a: number, b: number) => (a === 0 && b === 0 ? 0 : (Math.atan2(b, a) / rad + 360) % 360);
  const h1p = angle(a1p, b1);
  const h2p = angle(a2p, b2);
  let dh = 0;
  if (C1 * C2 !== 0) {
    dh = h2p - h1p;
    if (dh > 180) dh -= 360;
    else if (dh < -180) dh += 360;
  }
  const dH = 2 * Math.sqrt(C1 * C2) * Math.sin((dh / 2) * rad);
  const Lm = (L1 + L2) / 2;
  const Cmp = (C1 + C2) / 2;
  let hm = h1p + h2p;
  if (C1 * C2 !== 0) hm = Math.abs(h1p - h2p) > 180 ? (h1p + h2p + (h1p + h2p < 360 ? 360 : -360)) / 2 : (h1p + h2p) / 2;
  const T = 1 - 0.17 * Math.cos((hm - 30) * rad) + 0.24 * Math.cos(2 * hm * rad) + 0.32 * Math.cos((3 * hm + 6) * rad) - 0.2 * Math.cos((4 * hm - 63) * rad);
  const dTheta = 30 * Math.exp(-(((hm - 275) / 25) ** 2));
  const RC = 2 * Math.sqrt(Cmp ** 7 / (Cmp ** 7 + 25 ** 7));
  const SL = 1 + (0.015 * (Lm - 50) ** 2) / Math.sqrt(20 + (Lm - 50) ** 2);
  const SC = 1 + 0.045 * Cmp;
  const SH = 1 + 0.015 * Cmp * T;
  const RT = -Math.sin(2 * dTheta * rad) * RC;
  return Math.sqrt(((L2 - L1) / SL) ** 2 + ((C2 - C1) / SC) ** 2 + (dH / SH) ** 2 + RT * ((C2 - C1) / SC) * (dH / SH));
}

type Fs = { readFileSync: (p: string, e: string) => string; existsSync: (p: string) => boolean };
type Chemins = { join: (...p: string[]) => string; dirname: (p: string) => string };

type L = Pick<Logement, 'id' | 'statut' | 'couleur' | 'repull'>;
const l = (id: string, x: Partial<L> = {}): L => ({ id, statut: 'actif', ...x });
const cle = (m: Map<string, { cle: CouleurLogement }>, id: string) => m.get(id)?.cle;

async function principal() {
  const proc = (globalThis as { process?: { versions?: { node?: string }; cwd(): string } }).process;
  if (!proc?.versions?.node) throw new Error('Node requis pour lire erp.css');
  const nomFs = 'node:fs';
  const nomChemins = 'node:path';
  const fs = (await import(/* @vite-ignore */ nomFs)) as unknown as Fs;
  const chemins = (await import(/* @vite-ignore */ nomChemins)) as unknown as Chemins;
  let dossier = proc.cwd();
  for (let i = 0; i < 6 && !fs.existsSync(chemins.join(dossier, 'src/erp/erp.css')); i++) dossier = chemins.dirname(dossier);
  const css = fs.readFileSync(chemins.join(dossier, 'src/erp/erp.css'), 'utf8');
  const jeton = (nom: string) => new RegExp(`--${nom}:\\s*(#[0-9a-fA-F]{6})\\s*;`).exec(css)?.[1]?.toLowerCase() ?? '';

  section('1. Palette');
  verifier(COULEURS_LOGEMENT.length === 8 && new Set(COULEURS_LOGEMENT.map((c) => c.cle)).size === 8, 'huit couleurs, clés toutes différentes');
  const valeurs = new Map<string, string>();
  for (const c of COULEURS_LOGEMENT) {
    const nomJeton = /^var\(--(lm-logement-[a-z]+)\)$/.exec(c.teinte)?.[1];
    verifier(nomJeton === `lm-logement-${c.cle}`, `${c.nom} : jeton --lm-logement-${c.cle} (pas de couleur en dur)`);
    const hex = nomJeton ? jeton(nomJeton) : '';
    verifier(/^#[0-9a-f]{6}$/.test(hex), `${c.nom} : jeton déclaré dans erp.css`);
    if (!hex) continue;
    valeurs.set(c.cle, hex);
    verifier(contraste(hex, '#ffffff') >= 4.5, `${c.nom} : texte blanc lisible (${contraste(hex, '#ffffff').toFixed(2)}:1)`);
    verifier(contraste(hex, jeton('lm-fond')) >= 3, `${c.nom} : pastille visible sur le fond de page`);
    verifier(c.nom.length > 1 && c.nom[0] === c.nom[0].toUpperCase(), `${c.nom} : nom lisible par un lecteur d'écran`);
  }
  const SENS = ['lm-encre', 'lm-sarcelle', 'lm-or-texte', 'lm-violet', 'lm-info', 'lm-succes', 'lm-danger', 'lm-alerte', 'lm-orange'];
  for (const nom of SENS) {
    const ref = jeton(nom);
    verifier(!!ref, `--${nom} lu dans erp.css`);
    if (!ref) continue;
    const proche = [...valeurs].map(([k, v]) => [k, deltaE(v, ref)] as const).sort((a, b) => a[1] - b[1])[0];
    verifier(proche && proche[1] >= 10, `aucune couleur de logement ne se confond avec --${nom} (la plus proche : ${proche?.[0]}, ΔE ${proche?.[1].toFixed(1)})`);
  }
  const liste = [...valeurs];
  let ecartMin = Infinity;
  let paire = '';
  for (let i = 0; i < liste.length; i++)
    for (let j = i + 1; j < liste.length; j++) {
      const d = deltaE(liste[i][1], liste[j][1]);
      if (d < ecartMin) [ecartMin, paire] = [d, `${liste[i][0]}/${liste[j][0]}`];
    }
  verifier(ecartMin >= 10, `huit couleurs bien distinctes entre elles (la paire la plus proche : ${paire}, ΔE ${ecartMin.toFixed(1)})`);

  section('2. Couleur d’office, stable');
  {
    const quatre = [l('repull-4'), l('repull-1'), l('repull-3'), l('repull-2')];
    const m = couleursDesLogements(quatre);
    verifier(new Set([...m.values()].map((c) => c.cle)).size === 4, '4 logements : 4 couleurs différentes');
    verifier(cle(m, 'repull-1') === COULEURS_LOGEMENT[0].cle && cle(m, 'repull-4') === COULEURS_LOGEMENT[3].cle, 'dans l’ordre de la palette, par identifiant');
    const melange = couleursDesLogements([...quatre].reverse());
    verifier(quatre.every((x) => cle(melange, x.id) === cle(m, x.id)), 'même résultat quel que soit l’ordre reçu');

    const choix = couleursDesLogements(quatre.map((x) => (x.id === 'repull-2' ? { ...x, couleur: 'framboise' as const } : x)));
    verifier(cle(choix, 'repull-2') === 'framboise' && ['repull-1', 'repull-3', 'repull-4'].every((id) => cle(choix, id) === cle(m, id)), 'choisir la couleur d’un logement ne change celle d’aucun autre');
    const sorti = couleursDesLogements(quatre.map((x) => (x.id === 'repull-1' ? { ...x, statut: 'sorti' as const } : x)));
    verifier(quatre.every((x) => cle(sorti, x.id) === cle(m, x.id)), 'sortir un logement ne change la couleur d’aucun autre');

    const numerique = couleursDesLogements([l('repull-101'), l('repull-99'), l('repull-1000')]);
    verifier(cle(numerique, 'repull-99') === COULEURS_LOGEMENT[0].cle && cle(numerique, 'repull-101') === COULEURS_LOGEMENT[1].cle && cle(numerique, 'repull-1000') === COULEURS_LOGEMENT[2].cle, 'tri numérique : repull-99, repull-101, repull-1000');

    const huit = Array.from({ length: 8 }, (_, i) => l(`log-${i}`));
    verifier(new Set([...couleursDesLogements(huit).values()].map((c) => c.cle)).size === 8, '8 logements : 8 couleurs différentes');
    const neuf = couleursDesLogements(Array.from({ length: 9 }, (_, i) => l(`log-${i}`)));
    verifier(cle(neuf, 'log-8') === COULEURS_LOGEMENT[0].cle, 'au-delà de 8 : on recommence la palette');
    const inconnue = couleursDesLogements([l('log-a', { couleur: 'fuchsia' as CouleurLogement }), l('log-b')]);
    verifier(cle(inconnue, 'log-a') === COULEURS_LOGEMENT[0].cle, 'une valeur inconnue en base est ignorée (couleur d’office)');
    verifier(teinteConnue('prune')?.nom === 'Prune' && teinteConnue('rouge') === undefined && teinteConnue(42) === undefined && teinteConnue(undefined) === undefined, 'teinteConnue : seulement les clés de la palette');
  }

  section('3. Enregistrement');
  {
    const parc = [l('repull-1', { couleur: 'ardoise' }), l('repull-2', { couleur: 'prune' }), l('repull-3', { couleur: 'olive' })];
    verifier(couleurLibre(parc) === 'cacao', `nouveau logement : la couleur la moins portée (${couleurLibre(parc)})`);
    verifier(couleurLibre([]) === COULEURS_LOGEMENT[0].cle, 'premier logement : la première couleur');
    const plein = COULEURS_LOGEMENT.map((c, i) => l(`log-${i}`, { couleur: c.cle }));
    verifier(couleurLibre([...plein, l('log-z', { couleur: 'ardoise' })]) === 'prune', 'toutes portées : la moins portée, dans l’ordre de la palette');

    const melange = [
      l('repull-7', { repull: { id: '7' } as Logement['repull'] }),
      l('log-a'),
      l('log-b', { repull: { id: '9' } as Logement['repull'] }),
      l('repull-8', { couleur: 'sapin', repull: { id: '8' } as Logement['repull'] }),
    ];
    const importe = (x: L) => !!x.repull && x.id === `repull-${x.repull.id}`;
    const affichees = couleursDesLogements(melange);
    const aEnregistrer = couleursAEnregistrer(melange, importe);
    verifier(aEnregistrer.size === 1 && aEnregistrer.get('repull-7') === cle(affichees, 'repull-7'), 'synchronisation : seul le logement importé sans couleur, avec celle qu’il affiche déjà');
    verifier(!aEnregistrer.has('log-a') && !aEnregistrer.has('log-b') && !aEnregistrer.has('repull-8'), 'ni un logement créé à la main (même relié à une annonce), ni une couleur déjà enregistrée');
    const apres = melange.map((x) => (aEnregistrer.has(x.id) ? { ...x, couleur: aEnregistrer.get(x.id) } : x));
    verifier(couleursAEnregistrer(apres, importe).size === 0, 'une seule fois : la synchronisation suivante n’écrit plus rien');
    verifier(melange.every((x) => cle(couleursDesLogements(apres), x.id) === cle(affichees, x.id)), 'rien ne change à l’écran après l’enregistrement');

    // Le code qui enregistre : création dans l'app, premier import et rattrapage par la synchronisation.
    const enregistrer = fs.readFileSync(chemins.join(dossier, 'src/erp/modules/logements/_composants/enregistrerLogement.ts'), 'utf8');
    verifier(/nouveau && !teinteConnue\(logement\.couleur\) \? \{ \.\.\.logement, couleur: couleurLibre\(d\.logements\) \}/.test(enregistrer), 'création dans l’app : la couleur la moins portée, enregistrée');
    const synchro = fs.readFileSync(chemins.join(dossier, 'src/erp/data/repull-synchro.ts'), 'utf8');
    verifier(/if \(!existant && !teinteConnue\(logement\.couleur\)\) logement\.couleur = couleurLibre\(/.test(synchro), 'premier import : couleur enregistrée');
    verifier(/couleursAEnregistrer\(\[\.\.\.logements\.elements\.values\(\)\], importe\)/.test(synchro) && /const importe = \(l: Logement\) => !!l\.repull && l\.id === idRepull\(l\.repull\.id\);/.test(synchro), 'synchronisation : rattrapage des seuls logements importés sans couleur');
    const permise = /export function ecritureRepullPermise[\s\S]*?\n}\n/.exec(synchro)?.[0] ?? '';
    verifier(permise !== '' && !/couleur/.test(permise), 'la couleur ne touche pas aux écritures permises vers Repull');
  }

  section('4. Saisie du logement');
  {
    const base: Logement = { ...logementVierge('log-x'), nom: 'Test', adresse: '1 rue A', codePostal: '91100', ville: 'Corbeil', capacite: 2, proprietaireId: 'pro-1' };
    const s = saisieInitiale(base);
    verifier(!('couleur' in s), 'sans couleur enregistrée : la saisie n’en invente pas');
    verifier(!('couleur' in logementDepuisSaisie(s, base, '2026-11-06')), 'enregistré sans choix : rien d’ajouté par la saisie');
    const choisi = logementDepuisSaisie({ ...s, couleur: 'prune' }, base, '2026-11-06');
    verifier(choisi.couleur === 'prune', 'couleur choisie enregistrée');
    verifier(saisieInitiale(choisi).couleur === 'prune', 'rouvert : la couleur choisie revient');
    verifier(logementDepuisSaisie({ ...saisieInitiale(choisi), nom: 'Autre nom' }, choisi, '2026-11-06').couleur === 'prune', 'modifier autre chose garde la couleur');
  }

  console.log(`\n${reussis} contrôles réussis, ${echecs} en échec.`);
  if (echecs) throw new Error(`${echecs} contrôle(s) en échec`);
}

void principal();
