/**
 * Vérification du dossier propriétaire et du schéma d'étapes (pur, sans réseau).
 *
 * Lancement :
 *   node_modules/.bin/esbuild src/erp/data/verifier-dossier.ts --bundle --platform=node \
 *     --define:import.meta.env='{"VITE_ERP_DEMO":"1"}' --log-level=error --outfile=/tmp/verifier-dossier.cjs \
 *     && node /tmp/verifier-dossier.cjs
 */
import { ETAPES_DOSSIER, nomProprietaire, versLogement, versProprietaire } from './dossier-proprietaire';
import {
  champsVisibles,
  erreurChamp,
  erreursEtape,
  etapeFacultative,
  etapesVisibles,
  lignesRecapitulatif,
  nettoyerValeurs,
  valeurAffichee,
  valeursInitiales,
  type Champ,
  type Valeurs,
} from './etapes-formulaire';

let ok = 0;
let ko = 0;
function verifier(condition: boolean, libelle: string) {
  if (condition) ok++;
  else {
    ko++;
    console.log(`  ✗ ${libelle}`);
  }
}

const COMPLET: Valeurs = {
  'prop.prenom': 'Claire',
  'prop.nom': 'Exemple',
  'prop.tel': '06 00 00 00 99',
  'prop.email': 'claire@exemple.fr',
  'prop.qualite': 'particulier',
  'bien.adresse': '12 avenue des Tests',
  'bien.cp': '91090',
  'bien.ville': 'Lisses',
  'bien.type': 'T2',
  'bien.couchages': '4',
  'bien.chambres': '1',
  'bien.surface': '42',
  'bien.residence': 'secondaire',
  'acces.mode': 'boite',
  'linge.fournisseur': 'labelmaison',
  'annonce.compte': 'annonce',
  'annonce.lien': 'https://www.airbnb.fr/rooms/123',
  'equip.manquants': ['vaisselle', 'literie'],
  notes: 'Pas d’animaux.',
  'decl.certif': true,
};

function main() {
  // Schéma : court, regroupé par sujet
  const ids = ETAPES_DOSSIER.flatMap((e) => e.champs.map((c) => c.id));
  verifier(new Set(ids).size === ids.length, 'identifiants de champ uniques');
  verifier(new Set(ETAPES_DOSSIER.map((e) => e.id)).size === ETAPES_DOSSIER.length, 'identifiants d’étape uniques');
  verifier(ETAPES_DOSSIER.every((e) => e.question.endsWith('?') && e.champs.length >= 1 && e.champs.length <= 6), 'chaque étape : une question, 1 à 6 champs liés');
  verifier(ETAPES_DOSSIER.every((e) => !e.aide || (e.aide.length <= 120 && !e.aide.includes('\n'))), 'aides d’une phrase');
  const n = etapesVisibles(ETAPES_DOSSIER, {}).length;
  verifier(n <= 6 && etapesVisibles(ETAPES_DOSSIER, { 'prop.qualite': 'societe', 'annonce.compte': 'annonce' }).length === n, `essentiel : ${n} écrans, toujours les mêmes`);
  verifier(ETAPES_DOSSIER.flatMap((e) => e.champs).filter((c) => c.requis && !c.si).length <= 15, 'peu de champs obligatoires (15 au plus)');

  // Champs conditionnels, dans le même écran
  const vous = ETAPES_DOSSIER.find((e) => e.id === 'vous')!;
  verifier(!champsVisibles(vous, { 'prop.qualite': 'particulier' }).some((c) => c.id === 'prop.societe'), 'nom de société masqué en nom propre');
  verifier(champsVisibles(vous, { 'prop.qualite': 'societe' }).some((c) => c.id === 'prop.societe'), 'nom de société affiché pour une société');
  const surPlace = ETAPES_DOSSIER.find((e) => e.id === 'sur_place')!;
  verifier(!champsVisibles(surPlace, { 'annonce.compte': 'acreer' }).some((c) => c.id === 'annonce.lien'), 'lien de l’annonce seulement si elle existe');
  verifier(!!erreursEtape(vous, { ...COMPLET, 'prop.qualite': 'societe' })['prop.societe'] && !erreursEtape(vous, COMPLET)['prop.societe'], 'champ conditionnel obligatoire seulement quand il est affiché');
  const description = ETAPES_DOSSIER.find((e) => e.id === 'description')!;
  verifier(!!description.note?.({ 'bien.residence': 'principale' }) && !description.note?.({ 'bien.residence': 'secondaire' }), 'note des 120 nuits pour une résidence principale');

  // Validation par champ
  const champ = (id: string) => ETAPES_DOSSIER.flatMap((e) => e.champs).find((c) => c.id === id) as Champ;
  verifier(!!erreurChamp(champ('prop.email'), 'claire@'), 'e-mail invalide refusé');
  verifier(!!erreurChamp(champ('prop.email'), 'x@y.fr?subject=piege'), 'e-mail piégé refusé');
  verifier(!erreurChamp(champ('prop.tel'), '+33 6 00 00 00 99') && !!erreurChamp(champ('prop.tel'), '12'), 'téléphone : formats français et international');
  verifier(!!erreurChamp(champ('bien.cp'), '9100') && !erreurChamp(champ('bien.cp'), '91000'), 'code postal à 5 chiffres');
  verifier(!!erreurChamp(champ('bien.couchages'), '0') && !erreurChamp(champ('bien.couchages'), '4'), 'voyageurs : au moins 1');
  verifier(!!erreurChamp(champ('decl.certif'), false), 'certification obligatoire');
  verifier(!!erreurChamp(champ('prop.nom'), 'x'.repeat(81)), 'texte trop long refusé');
  verifier(!erreurChamp(champ('bien.surface'), ''), 'champ facultatif vide accepté');
  verifier(Object.keys(erreursEtape(vous, { 'prop.prenom': 'Claire', 'prop.nom': 'Exemple', 'prop.tel': '06 00 00 00 99', 'prop.qualite': 'particulier' })).join() === 'prop.email', 'erreurs d’étape : seulement le champ manquant');
  verifier(etapeFacultative(ETAPES_DOSSIER.find((e) => e.id === 'manquants')!) && !etapeFacultative(vous), 'étapes facultatives (« Plus tard ») repérées');

  // Affichage (le moteur garde aussi l'inventaire et les quantités, pour d'autres formulaires)
  verifier(valeurAffichee(champ('equip.manquants'), ['vaisselle', 'literie']) === 'Vaisselle et ustensiles, Literie', 'liste à cocher : libellés');
  const grille: Champ = { id: 'g', libelle: 'Cuisine', type: 'grille', options: [{ valeur: 'p', libelle: 'Présent' }, { valeur: 'a', libelle: 'À fournir' }], elements: [{ id: 'f', libelle: 'Four' }, { id: 'm', libelle: 'Micro-ondes' }] };
  verifier(valeurAffichee(grille, { f: 'p', m: 'a' }) === 'Présent : Four · À fournir : Micro-ondes', 'grille : regroupée par réponse');
  const qte: Champ = { id: 'q', libelle: 'Linge', type: 'quantites', elements: [{ id: 'd', libelle: 'Draps' }, { id: 't', libelle: 'Taies' }] };
  verifier(valeurAffichee(qte, { d: 6, t: 0 }) === 'Draps : 6', 'quantités non nulles');
  const date: Champ = { id: 'd', libelle: 'Date', type: 'date' };
  verifier(valeurAffichee(date, '2026-11-02') === '2 novembre 2026', 'date en clair');
  const recap = lignesRecapitulatif(ETAPES_DOSSIER, COMPLET);
  verifier(recap.some((l) => l.libelle === 'Prénom' && l.valeur === 'Claire') && !recap.some((l) => l.champ.id === 'prop.societe'), 'récapitulatif : champs visibles seulement');
  verifier(typeof valeursInitiales(ETAPES_DOSSIER) === 'object', 'valeurs de départ');

  // Nettoyage côté serveur
  const net = nettoyerValeurs(ETAPES_DOSSIER, { ...COMPLET, 'champ.inconnu': 'x', 'prop.societe': 'SCI Fantôme', 'equip.manquants': ['vaisselle', 'pirate'] });
  verifier(net.ok, `dossier complet accepté${net.ok ? '' : ` : ${net.erreurs.join(' | ')}`}`);
  if (net.ok) {
    verifier(!('champ.inconnu' in net.valeurs), 'champ inconnu écarté');
    verifier(!('prop.societe' in net.valeurs), 'réponse d’un champ masqué écartée');
    verifier(JSON.stringify(net.valeurs['equip.manquants']) === '["vaisselle"]', 'réponse inconnue écartée');
  }
  const sansLien = nettoyerValeurs(ETAPES_DOSSIER, { ...COMPLET, 'annonce.compte': 'acreer' });
  verifier(sansLien.ok && !('annonce.lien' in sansLien.valeurs), 'lien d’annonce écarté sans annonce');
  const manque = nettoyerValeurs(ETAPES_DOSSIER, { ...COMPLET, 'decl.certif': false, 'prop.email': 'pas-un-email' });
  verifier(!manque.ok && manque.erreurs.length === 2, 'serveur : certification et e-mail vérifiés');
  verifier(!nettoyerValeurs(ETAPES_DOSSIER, { ...COMPLET, 'prop.qualite': 'societe' }).ok, 'serveur : société sans nom refusée');
  verifier(!nettoyerValeurs(ETAPES_DOSSIER, 'texte').ok && !nettoyerValeurs(ETAPES_DOSSIER, [1, 2]).ok, 'corps illisible refusé');
  verifier(!nettoyerValeurs(ETAPES_DOSSIER, { ...COMPLET, 'prop.nom': { $ne: '' } }).ok, 'objet à la place d’un texte refusé');

  // Fiches de l'ERP
  const p = versProprietaire(COMPLET, { id: 'pro-1', aujourdhui: '2026-10-13' });
  verifier(p.nom === 'Claire Exemple' && p.type === 'particulier' && p.contact.email === 'claire@exemple.fr' && /13\/10\/2026/.test(p.notes), 'propriétaire créé');
  verifier(p.adresse === '12 avenue des Tests, 91090 Lisses', 'adresse postale : celle du logement si elle n’est pas différente');
  verifier(versProprietaire({ ...COMPLET, 'prop.adresse': '3 rue Ailleurs, 75001 Paris' }, { id: 'p', aujourdhui: '2026-10-13' }).adresse === '3 rue Ailleurs, 75001 Paris', 'adresse postale différente gardée');
  verifier(nomProprietaire({ ...COMPLET, 'prop.qualite': 'societe', 'prop.societe': 'SCI Les Tilleuls' }) === 'SCI Les Tilleuls', 'société : dénomination');
  verifier(versProprietaire({ ...COMPLET, 'prop.qualite': 'societe', 'prop.societe': 'SCI Les Tilleuls' }, { id: 'p', aujourdhui: '2026-10-13' }).type === 'sci', 'SCI reconnue');
  const existant = versProprietaire(COMPLET, { id: 'pro-2', aujourdhui: '2026-10-13', existant: { ...p, id: 'pro-0', notes: 'Ancienne note' } });
  verifier(existant.id === 'pro-0' && existant.notes.startsWith('Ancienne note\n'), 'propriétaire existant : complété, pas recréé');
  const l = versLogement(COMPLET, { id: 'log-1', proprietaireId: 'pro-1' });
  verifier(l.statut === 'lancement' && l.nom === 'T2 Lisses' && l.capacite === 4 && l.surfaceM2 === 42 && l.serrure === 'boite_a_cles', 'logement en lancement');
  verifier(l.fiche.regles === 'Pas d’animaux.', 'fiche : consignes');
  verifier(l.annonces[0]?.url === 'https://www.airbnb.fr/rooms/123' && !l.repull, 'annonce Airbnb, aucun lien Repull');
  verifier(versLogement({ ...COMPLET, 'annonce.lien': 'javascript:alert(1)' }, { id: 'x', proprietaireId: 'y' }).annonces.length === 0, 'lien d’annonce non Airbnb ignoré');

  console.log(`${ok} contrôles réussis, ${ko} en échec.`);
  (globalThis as { process?: { exitCode?: number } }).process!.exitCode = ko ? 1 : 0;
}

main();
