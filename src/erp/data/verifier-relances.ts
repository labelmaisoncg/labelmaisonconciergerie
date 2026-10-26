/**
 * Vérification des factures partagées et des relances de paiement (pur, sans
 * réseau) : calendrier J+5 / J+15 / J+30, une relance par étape et par
 * facture, idempotence, arrêt dès le paiement, mode « proposer », message,
 * et ce que voit chaque propriétaire (les siennes, partagées seulement).
 * Le serveur (espaces, expéditeur, envoi) : scripts/verifier-espaces-serveur.ts.
 *
 * Lancement :
 *   node_modules/.bin/esbuild src/erp/data/verifier-relances.ts --bundle --platform=node --format=esm \
 *     --define:import.meta.env='{"VITE_ERP_DEMO":"1"}' --log-level=error --outfile=/tmp/verifier-relances.mjs \
 *     && node /tmp/verifier-relances.mjs
 */
import {
  REGLAGES_RELANCES_DEFAUT,
  factureAPayer,
  facturePartagee,
  facturesVue,
  idRelance,
  messageRelance,
  montantTtcFacture,
  partagerFacture,
  planifierRelances,
  reglagesRelances,
  relanceEnvoyable,
  retirerPartageFacture,
  statutFactureVue,
} from './relances';
import { vueProprietaire } from './proprietaire';
import { creerSeed } from './seed';
import type { Facture, Logement, Proprietaire } from './types';
import type { DocumentProprietaire, RelancePaiement } from './types-proprietaire';

let ok = 0;
let ko = 0;
function verifier(condition: boolean, libelle: string) {
  if (condition) ok++;
  else {
    ko++;
    console.log(`  ✗ ${libelle}`);
  }
}

const A = 'pro-a';
const B = 'pro-b';
const facture = (id: string, o: Partial<Facture> = {}): Facture => ({
  id,
  numero: `LM-2026-${id}`,
  type: 'commission',
  destinataire: 'proprietaire',
  proprietaireId: A,
  dateEmission: '2026-09-01',
  echeance: '2026-09-10',
  montantHtCentimes: 100_000,
  tvaPct: 20,
  statut: 'emise',
  lignes: [{ libelle: 'Commission', quantite: 1, puCentimes: 100_000 }],
  partageeLe: '2026-09-01T09:00:00.000Z',
  ...o,
});

const passe = (factures: Facture[], relances: RelancePaiement[], aujourdhui: string, reglages = REGLAGES_RELANCES_DEFAUT) =>
  planifierRelances({ factures, relances, reglages, aujourdhui, maintenant: `${aujourdhui}T05:00:00.000Z` });

/** Applique un plan aux relances existantes (comme le serveur l'écrit). */
const appliquer = (relances: RelancePaiement[], plan: ReturnType<typeof passe>) => {
  const m = new Map(relances.map((r) => [r.id, r]));
  for (const r of [...plan.modifiees, ...plan.nouvelles]) m.set(r.id, r);
  return [...m.values()];
};

function main() {
  /* réglages */
  verifier(reglagesRelances(undefined).mode === 'proposer' && reglagesRelances(undefined).jours.join() === '5,15,30' && reglagesRelances(undefined).actif, 'réglages par défaut : proposer, J+5, J+15, J+30');
  verifier(reglagesRelances({ jours: [30, 5, 5, 0, 500, 2.5] as number[], mode: 'automatique' }).jours.join() === '5,30' && reglagesRelances({ mode: 'n’importe' as never }).mode === 'proposer', 'réglages relus : étapes propres, mode inconnu = proposer');

  /* factures : partage et statut */
  const f = facture('0001');
  verifier(montantTtcFacture(f) === 120_000, 'montant TTC');
  verifier(facturePartagee(f, A) && !facturePartagee(f, B) && !facturePartagee(retirerPartageFacture(f), A), 'partagée : avec son propriétaire seulement, et tant qu’elle l’est');
  verifier(!facturePartagee({ ...f, statut: 'brouillon' }, A) && !facturePartagee({ ...f, statut: 'annulee' }, A), 'brouillon ou annulée : jamais vue');
  verifier(
    !facturePartagee({ ...f, destinataire: 'voyageur' }, A) && !factureAPayer({ ...f, destinataire: 'voyageur' }) && !facturePartagee({ ...f, proprietaireId: undefined }, ''),
    'facture voyageur rattachée au propriétaire, ou sans propriétaire : jamais vue ni relancée',
  );
  verifier(partagerFacture(retirerPartageFacture(f), 'X').partageeLe === 'X' && partagerFacture(f, 'Y').partageeLe === f.partageeLe, 'partager : date gardée si déjà partagée');
  verifier(statutFactureVue(f, '2026-09-05') === 'a_payer' && statutFactureVue(f, '2026-09-11') === 'en_retard' && statutFactureVue({ ...f, statut: 'payee', payeeLe: '2026-09-12' }, '2026-09-20') === 'payee', 'statut vu : à payer, en retard, payée');

  /* calendrier */
  verifier(passe([f], [], '2026-09-14').nouvelles.length === 0, 'avant J+5 : rien');
  let p = passe([f], [], '2026-09-15');
  verifier(p.nouvelles.length === 1 && p.nouvelles[0].id === idRelance(f.id, 1) && p.nouvelles[0].niveau === 1 && p.nouvelles[0].dueLe === '2026-09-15' && p.nouvelles[0].statut === 'proposee', 'J+5 : premier rappel, proposé');
  let relances = appliquer([], p);
  verifier(passe([f], relances, '2026-09-15').nouvelles.length === 0 && passe([f], relances, '2026-09-20').nouvelles.length === 0, 'même jour ou avant J+15 : rien de plus (idempotent)');
  p = passe([f], relances, '2026-09-25');
  verifier(p.nouvelles.map((r) => r.niveau).join() === '2' && p.modifiees.some((r) => r.id === idRelance(f.id, 1) && r.statut === 'annulee' && r.motif === 'remplacee'), 'J+15 : deuxième rappel, le premier encore à valider est remplacé');
  relances = appliquer(relances, p);
  relances = relances.map((r) => (r.niveau === 2 ? { ...r, statut: 'envoyee', envoyeeLe: '2026-09-25T06:00:00.000Z' } : r));
  p = passe([f], relances, '2026-10-10');
  verifier(p.nouvelles.map((r) => r.niveau).join() === '3' && !p.modifiees.some((r) => r.niveau === 2), 'J+30 : troisième rappel ; un rappel envoyé reste envoyé');
  relances = appliquer(relances, p);
  verifier(passe([f], relances, '2026-12-31').nouvelles.length === 0, 'après la dernière étape : plus rien');
  verifier(new Set(relances.map((r) => r.id)).size === relances.length && relances.length === 3, 'une relance par étape et par facture');
  const tard = passe([facture('0002')], [], '2026-10-20');
  verifier(tard.nouvelles.length === 1 && tard.nouvelles[0].niveau === 3, 'déjà très en retard : seule l’étape la plus avancée (pas trois e-mails le même jour)');

  /* arrêt */
  const payee = { ...f, statut: 'payee' as const, payeeLe: '2026-10-11' };
  p = passe([payee], relances, '2026-10-12');
  verifier(p.nouvelles.length === 0 && p.modifiees.some((r) => r.niveau === 3 && r.statut === 'sans_objet'), 'payée : arrêt, la relance à valider devient sans objet');
  verifier(!relanceEnvoyable(relances.find((r) => r.niveau === 3), payee) && relanceEnvoyable(relances.find((r) => r.niveau === 3), f), 'payée : plus rien ne peut partir');
  verifier(passe([retirerPartageFacture(f)], [], '2026-10-12').nouvelles.length === 0 && !factureAPayer(retirerPartageFacture(f)), 'facture non partagée : jamais relancée');
  verifier(passe([facture('0003', { destinataire: 'voyageur', proprietaireId: undefined })], [], '2026-10-12').nouvelles.length === 0, 'facture sans propriétaire : jamais relancée');
  verifier(passe([f], [], '2026-10-12', { ...REGLAGES_RELANCES_DEFAUT, actif: false }).nouvelles.length === 0, 'relances coupées : rien de créé');
  verifier(!relanceEnvoyable({ ...relances[2], statut: 'envoyee' }, f) && !relanceEnvoyable({ ...relances[2], statut: 'annulee' }, f), 'déjà envoyée ou annulée : jamais renvoyée');
  verifier(!relanceEnvoyable({ ...relances[2], proprietaireId: B }, f), 'relance d’un autre propriétaire : refusée');
  const deux = passe([f, facture('0004', { proprietaireId: B })], [], '2026-09-15');
  verifier(deux.nouvelles.map((r) => r.proprietaireId).sort().join() === `${A},${B}` && deux.nouvelles.every((r) => r.statut === 'proposee'), 'le passage ne fait que proposer (aucun envoi dans le calcul)');

  /* message */
  const m = messageRelance({ relance: { niveau: 1 }, facture: f, proprietaire: { nom: 'Alice Martin' }, conciergerie: 'Sens', lienEspace: 'https://exemple.invalid/espace-proprietaire' });
  verifier(/Petit rappel/.test(m.sujet) && m.sujet.includes(f.numero), 'message : sujet poli avec le numéro');
  verifier(m.texte.replace(/\s/g, ' ').includes('1 200,00') && m.texte.includes('10 septembre 2026') && m.texte.includes(f.numero) && /Bonjour Alice Martin/.test(m.texte) && /\nSens$|Sens\n/.test(m.texte), 'message : montant TTC, échéance, numéro, signé de l’espace');
  verifier(/virement/.test(m.texte) && !/IBAN|FR76|BIC|RIB/i.test(m.texte + m.html), 'message : comment payer, sans coordonnées bancaires');
  verifier(!/Label Maison/.test(m.texte + m.html), 'message d’un autre espace : jamais « Label Maison »');
  verifier(messageRelance({ relance: { niveau: 3 }, dernier: true, facture: f, proprietaire: { nom: 'A' }, conciergerie: 'X' }).sujet.startsWith('Dernier rappel'), 'dernière étape : « Dernier rappel »');
  verifier(!/<script/.test(messageRelance({ relance: { niveau: 1 }, facture: f, proprietaire: { nom: '<script>x</script>' }, conciergerie: 'X' }).html), 'message : HTML échappé');

  /* ce que voit le propriétaire */
  const docs: DocumentProprietaire[] = [
    { id: 'pdf-1', proprietaireId: A, factureId: f.id, categorie: 'facture', titre: 'F', fichier: 'stockage://x', nomFichier: 'f.pdf', ajouteLe: '2026-09-01', ajoutePar: 'g' },
    { id: 'pdf-b', proprietaireId: B, factureId: f.id, categorie: 'facture', titre: 'F', fichier: 'stockage://y', nomFichier: 'f.pdf', ajouteLe: '2026-09-01', ajoutePar: 'g' },
  ];
  const envoyee: RelancePaiement = { ...relances[1], statut: 'envoyee', envoyeeLe: '2026-09-25T06:00:00.000Z' };
  const toutes = [f, facture('0005', { proprietaireId: B }), facture('0006', { partageeLe: undefined }), facture('0007', { statut: 'brouillon' })];
  const vues = facturesVue(toutes, A, '2026-09-26', { documents: docs, relances: [envoyee] });
  verifier(vues.map((x) => x.id).join() === f.id, 'vue : ses factures partagées seulement (ni celles d’un autre, ni brouillon, ni non partagées)');
  verifier(vues[0].pdf === 'pdf-1' && vues[0].statut === 'en_retard' && vues[0].montantTtc === 120_000 && vues[0].dernierRappel === '2026-09-25', 'vue : PDF à lui, statut, TTC, dernier rappel');
  verifier(!JSON.stringify(vues).includes('stockage://'), 'vue : jamais le chemin du fichier');

  /* démo et vue complète */
  const seed = creerSeed();
  const demo = vueProprietaire(seed, 'pro-sci-tilleuls', { aujourdhui: '2026-09-24' })!;
  verifier(demo.factures.length >= 2 && demo.factures.some((x) => x.statut === 'en_retard') && demo.factures.some((x) => x.pdf), 'démo : factures partagées, dont une en retard et une avec son PDF');
  const autres = seed.factures.filter((x) => x.proprietaireId !== 'pro-sci-tilleuls').map((x) => x.id);
  verifier(!demo.factures.some((x) => autres.includes(x.id)), 'démo : aucune facture d’un autre propriétaire');
  const nonPartagee = { ...seed, factures: seed.factures.map((x) => retirerPartageFacture(x)) };
  const sansPartage = vueProprietaire(nonPartagee, 'pro-sci-tilleuls', { aujourdhui: '2026-09-24' })!;
  verifier(sansPartage.factures.length === 0 && !sansPartage.documents.some((x) => x.categorie === 'facture'), 'facture plus partagée : ni la facture ni son PDF');
  const logementsDe = (id: string) => seed.logements.filter((l: Logement) => l.proprietaireId === id).length;
  verifier(logementsDe('pro-sci-tilleuls') >= 1 && seed.proprietaires.some((x: Proprietaire) => x.id === 'pro-sci-tilleuls'), 'démo cohérente');

  console.log(`${ok} contrôles réussis, ${ko} en échec.`);
  (globalThis as { process?: { exitCode?: number } }).process!.exitCode = ko ? 1 : 0;
}

main();
