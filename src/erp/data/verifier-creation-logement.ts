/**
 * Auto-contrôle de la création d'un logement à la main, sans réseau :
 * logement vierge (statut « En préparation »), règles du formulaire, écrans
 * de l'assistant pas à pas, et surtout l'égalité des deux chemins (le
 * formulaire et l'assistant enregistrent exactement le même logement).
 *
 * Lancement (Node 18+) :
 *   node_modules/.bin/esbuild src/erp/data/verifier-creation-logement.ts --bundle --platform=node --format=esm \
 *     --define:import.meta.env='{"VITE_ERP_DEMO":"1"}' --log-level=error --outfile=/tmp/verifier-creation-logement.mjs \
 *     && node /tmp/verifier-creation-logement.mjs
 */
import {
  ETAPES_ASSISTANT,
  aPlacerSurCarte,
  brouillonInitial,
  capaciteSuggeree,
  creationDepuisAssistant,
  erreursEtape,
  erreursProprietaire,
  erreursSaisieLogement,
  etapeDuChamp,
  familleDuType,
  lignesRecap,
  logementDepuisSaisie,
  logementVierge,
  nomSuggere,
  proprietaireDepuisSaisie,
  saisieDepuisBrouillon,
  saisieInitiale,
  saisieProprietaireInitiale,
  texteCapacite,
  typeDeLaFamille,
  type BrouillonLogement,
  type SaisieLogement,
} from './creation-logement';
import { CHECKLIST_LANCEMENT } from './constantes';
import { texteAdresse } from './carte';
import type { Logement, Proprietaire } from './types';

let echecs = 0;
let reussis = 0;
function verifier(condition: unknown, message: string) {
  if (condition) reussis++;
  else {
    echecs++;
    console.error(`  ✗ ${message}`);
  }
}
const section = (titre: string) => console.log(`\n${titre}`);

/** JSON aux clés triées : deux logements égaux champ pour champ ont la même empreinte. */
const empreinte = (x: unknown): string =>
  JSON.stringify(x, (_k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v));

const JOUR = '2026-10-28';
const A = 'pro-alice';
const B = 'pro-bruno';
const proprietaires: Proprietaire[] = [
  { id: A, type: 'particulier', nom: 'Alice Martin', contact: { email: 'alice@exemple.fr', telephone: '06 00 00 00 01' }, adresse: '1 rue A, 91100 Corbeil', notes: '', creeLe: '2026-01-01' },
  { id: B, type: 'sci', nom: 'SCI Bruno', contact: { email: 'sci@exemple.fr', telephone: '06 00 00 00 02' }, adresse: '2 rue B, 91000 Évry', notes: '', creeLe: '2026-01-01' },
];

/** Réponses complètes de l'assistant (propriétaire de la liste). */
const brouillon = (x: Partial<BrouillonLogement> = {}): BrouillonLogement => ({
  ...brouillonInitial(true),
  type: 'T3',
  adresse: '  12 rue de la Gare ',
  codePostal: '91100',
  ville: 'Corbeil-Essonnes',
  capacite: 4,
  chambres: 2,
  lits: { double: 2, simple: 0, canape: 1 },
  surfaceM2: '58',
  nom: 'T3 Corbeil-Essonnes',
  proprietaireId: A,
  ...x,
});

section('Logement vierge : valeurs par défaut de toute création à la main');
{
  const l = logementVierge('log-1');
  verifier(l.id === 'log-1' && l.statut === 'lancement', 'statut « En préparation »');
  verifier(empreinte(l.annonces) === empreinte([{ canal: 'airbnb', connecte: false }, { canal: 'booking', connecte: false }, { canal: 'direct', connecte: false }]), 'trois annonces, aucune connectée');
  verifier(l.checklistLancement.length === CHECKLIST_LANCEMENT.length && l.checklistLancement.every((c, i) => c.cle === CHECKLIST_LANCEMENT[i].cle && !c.fait), 'checklist de lancement entière, rien de fait');
  verifier(l.fiche.heureArrivee === '16:00' && l.fiche.heureDepart === '11:00' && l.fiche.equipements.length === 0, 'fiche : arrivée 16 h, départ 11 h, rien d’autre');
  verifier(l.serrure === 'boite_a_cles' && !l.residencePrincipale && !l.repull && !l.position && !l.photoUrl, 'boîte à clés, pas de plateforme, pas de position ni de photo');
  verifier(logementVierge('log-2').checklistLancement !== l.checklistLancement, 'chaque logement a sa propre checklist (pas de partage d’objet)');
}

section('Formulaire : règles de saisie');
{
  const e = erreursSaisieLogement(saisieInitiale());
  verifier(
    empreinte(Object.keys(e).sort()) === empreinte(['adresse', 'capacite', 'codePostal', 'nom', 'proprietaireId', 'surfaceM2', 'ville']),
    `saisie vide : nom, adresse, code postal, ville, surface, capacité, propriétaire (${Object.keys(e).join(', ')})`,
  );
  const ok: SaisieLogement = { ...saisieInitiale(), nom: 'X', adresse: '1 rue', codePostal: '91100', ville: 'Évry', surfaceM2: '30', capacite: '2', proprietaireId: A };
  verifier(Object.keys(erreursSaisieLogement(ok)).length === 0, 'saisie complète : aucune erreur');
  verifier(erreursSaisieLogement({ ...ok, codePostal: '9100' }).codePostal === 'Code postal à 5 chiffres.', 'code postal à 4 chiffres refusé');
  verifier(erreursSaisieLogement({ ...ok, surfaceM2: '0' }).surfaceM2 !== undefined && erreursSaisieLogement({ ...ok, surfaceM2: '30,5' }).surfaceM2 !== undefined, 'surface nulle ou décimale refusée');
  verifier(erreursSaisieLogement({ ...ok, numeroEnregistrement: '123' }).numeroEnregistrement !== undefined, 'numéro d’enregistrement mal formé refusé');
  verifier(erreursSaisieLogement({ ...ok, numeroEnregistrement: '91174000125rx' }).numeroEnregistrement === undefined, 'numéro d’enregistrement en minuscules accepté');
}

section('Formulaire : création et modification');
{
  const s: SaisieLogement = {
    ...saisieInitiale(),
    nom: ' Studio Gare ',
    adresse: ' 3 rue Haute ',
    codePostal: '91000',
    ville: ' Évry ',
    type: 'studio',
    surfaceM2: '22',
    capacite: '2',
    chambres: '0',
    lits: { double: '1', simple: '0', canape: '0' },
    numeroEnregistrement: '91174000125rx',
    proprietaireId: A,
    statut: 'actif',
  };
  const l = logementDepuisSaisie(s, 'log-n', JOUR);
  verifier(l.id === 'log-n' && l.statut === 'lancement', 'création : « En préparation », quel que soit le statut saisi');
  verifier(l.nom === 'Studio Gare' && l.adresse === '3 rue Haute' && l.ville === 'Évry', 'textes nettoyés des espaces');
  verifier(empreinte(l.lits) === empreinte([{ type: 'double', nombre: 1 }]), 'seuls les lits présents sont gardés');
  verifier(l.numeroEnregistrement === '91174000125RX' && l.dpe === undefined, 'numéro en majuscules, DPE absent');
  verifier(l.proprietaireId === A && !l.proprietaireDepuis && !l.proprietairesPrecedents, 'premier propriétaire : ni « depuis », ni précédent');

  const place: Logement = { ...l, position: { lat: 48.6, lng: 2.44, precision: 'adresse', adresse: texteAdresse(l), le: '2026-10-28T10:00:00+01:00' } } as Logement;
  const relu = logementDepuisSaisie(saisieInitiale(place), place, JOUR);
  verifier(empreinte(relu) === empreinte(place), 'modification sans changement : logement identique, position gardée');
  const deplace = logementDepuisSaisie({ ...saisieInitiale(place), adresse: '5 rue Basse' }, place, JOUR);
  verifier(!deplace.position && deplace.adresse === '5 rue Basse', 'adresse changée : l’ancienne position est retirée');
  verifier(logementDepuisSaisie({ ...saisieInitiale(place), statut: 'pause' }, place, JOUR).statut === 'pause', 'modification : le statut saisi compte');
  const cede = logementDepuisSaisie({ ...saisieInitiale(place), proprietaireId: B }, { ...place, proprietaireDepuis: '2026-01-01' }, JOUR);
  verifier(
    cede.proprietaireId === B && cede.proprietaireDepuis === JOUR && cede.proprietairesPrecedents?.[0]?.proprietaireId === A && cede.proprietairesPrecedents[0].jusquAu === JOUR,
    'autre propriétaire : l’ancien garde sa période jusqu’à aujourd’hui',
  );
}

section('Carte : placer après l’enregistrement (gérant seulement)');
{
  const l = logementDepuisSaisie({ ...saisieInitiale(), nom: 'X', adresse: '1 rue', codePostal: '91100', ville: 'Évry', surfaceM2: '30', capacite: '2', proprietaireId: A }, 'log-c', JOUR);
  verifier(aPlacerSurCarte(l, 'gerant', false), 'gérant : le nouveau logement est placé');
  verifier(!aPlacerSurCarte(l, 'operations', false) && !aPlacerSurCarte(l, 'lecture', false), 'opérations, lecture : jamais de géocodage');
  verifier(!aPlacerSurCarte(l, 'gerant', true), 'lecture seule : pas de géocodage');
  verifier(!aPlacerSurCarte({ ...l, statut: 'sorti' }, 'gerant', false), 'logement sorti : pas de géocodage');
  verifier(
    !aPlacerSurCarte({ ...l, position: { lat: 48.6, lng: 2.44, precision: 'adresse', adresse: texteAdresse(l), le: '2026-10-28T10:00:00+01:00' } } as Logement, 'gerant', false),
    'déjà placé à cette adresse : rien à refaire',
  );
}

section('Propriétaire : mêmes règles que sa fiche');
{
  const e = erreursProprietaire(saisieProprietaireInitiale());
  verifier(empreinte(Object.keys(e).sort()) === empreinte(['adresse', 'email', 'nom', 'telephone']), 'nom, e-mail, téléphone et adresse demandés');
  verifier(erreursProprietaire({ ...saisieProprietaireInitiale(), nom: 'Léa Roy', email: 'lea@exemple.fr', telephone: '06 12 34 56 78', adresse: '4 rue C' }).email === undefined, 'saisie complète acceptée');
  verifier(erreursProprietaire({ ...saisieProprietaireInitiale(), telephone: '06 12' }).telephone === 'Numéro à 10 chiffres minimum.', 'téléphone trop court refusé');
  const ancien = { ...proprietaires[0], ibanMasque: 'FR76 •••• 1234', notes: 'note' };
  const p = proprietaireDepuisSaisie({ ...saisieProprietaireInitiale(ancien), nom: ' Alice M. ' }, ancien, JOUR);
  verifier(p.id === A && p.creeLe === '2026-01-01' && p.nom === 'Alice M.' && p.notes === 'note' && !('ibanMasque' in p), 'modification : même id, même date, ancien IBAN effacé');
  const n = proprietaireDepuisSaisie(saisieProprietaireInitiale(), 'pro-n', JOUR);
  verifier(n.id === 'pro-n' && n.creeLe === JOUR && n.type === 'particulier', 'création : nouvel id, créé aujourd’hui');
}

section('Assistant : six écrans, une question chacun');
{
  verifier(empreinte(ETAPES_ASSISTANT) === empreinte(['type', 'adresse', 'capacite', 'nom', 'proprietaire', 'recapitulatif']), 'type, adresse, capacité, nom, propriétaire, récapitulatif');
  const b = brouillonInitial(true);
  const ctx = { proprietaires };
  verifier(erreursEtape('type', b, ctx).type === 'Choisissez un type de logement.', 'type : rien de choisi, « Continuer » grisé');
  verifier(Object.keys(erreursEtape('type', { ...b, type: 'maison' }, ctx)).length === 0, 'type choisi : on continue');
  verifier(
    empreinte(erreursEtape('adresse', b, ctx)) === empreinte({ adresse: 'Indiquez l’adresse.', codePostal: 'Indiquez le code postal.', ville: 'Indiquez la ville.' }),
    'adresse vide : ce qu’il faut faire, en toutes lettres',
  );
  verifier(erreursEtape('adresse', { ...b, adresse: '1 rue', codePostal: '911', ville: 'Évry' }, ctx).codePostal === 'Code postal à 5 chiffres.', 'code postal incomplet : la règle du formulaire');
  verifier(empreinte(erreursEtape('capacite', b, ctx)) === empreinte({ surfaceM2: 'Indiquez la surface en m².' }), 'capacité : seuls les m² manquent au départ');
  verifier(erreursEtape('capacite', { ...b, surfaceM2: '0' }, ctx).surfaceM2 === 'Surface en m², nombre entier.', 'surface à 0 refusée');
  verifier(erreursEtape('capacite', { ...b, surfaceM2: '30', capacite: 0 }, ctx).capacite === 'Au moins 1 voyageur.', 'zéro voyageur refusé');
  verifier(erreursEtape('nom', b, ctx).nom === 'Donnez un nom au logement.' && !erreursEtape('nom', { ...b, nom: 'X' }, ctx).nom, 'nom : obligatoire');
  verifier(erreursEtape('proprietaire', b, ctx).proprietaireId === 'Choisissez le propriétaire.', 'propriétaire : à choisir dans la liste');
  verifier(!erreursEtape('proprietaire', { ...b, proprietaireId: B }, ctx).proprietaireId, 'propriétaire choisi : on continue');
  verifier(erreursEtape('proprietaire', { ...b, proprietaireId: 'pro-supprime' }, ctx).proprietaireId !== undefined, 'propriétaire retiré entre-temps : refusé');
  const nouveau = erreursEtape('proprietaire', { ...b, modeProprietaire: 'nouveau', nouveauProprietaire: { ...saisieProprietaireInitiale(), email: 'pas-un-mail' } }, ctx);
  verifier(nouveau['proprietaire.nom'] === 'Indiquez le nom du propriétaire.' && nouveau['proprietaire.email'] === 'Adresse e-mail invalide.', 'nouveau propriétaire : vide dit quoi faire, mal saisi dit pourquoi');
  verifier(brouillonInitial(false).modeProprietaire === 'nouveau' && brouillonInitial(true).modeProprietaire === 'liste', 'aucun propriétaire encore : on en crée un directement');
  verifier(Object.keys(erreursEtape('recapitulatif', brouillon(), ctx)).length === 0, 'réponses complètes : « Créer le logement » permis');
  verifier(Object.keys(erreursEtape('recapitulatif', brouillon({ ville: '' }), ctx)).length === 1, 'récapitulatif : reprend les erreurs de chaque écran');
  // Toute erreur possible du formulaire se corrige sur un écran de l'assistant.
  for (const cle of Object.keys(erreursSaisieLogement(saisieInitiale()))) verifier(etapeDuChamp(cle) !== 'recapitulatif', `« ${cle} » se corrige sur un écran (${etapeDuChamp(cle)})`);
  const s = saisieDepuisBrouillon(brouillon(), A);
  verifier(s.numeroEnregistrement === '' && s.dpe === '' && s.serrure === 'boite_a_cles' && !s.residencePrincipale, 'ce que l’assistant ne demande pas garde les valeurs de départ du formulaire');
}

section('Assistant : suggestions');
{
  verifier(empreinte(capaciteSuggeree('studio')) === empreinte({ capacite: 2, chambres: 0, lits: { double: 1, simple: 0, canape: 0 } }), 'studio : 2 voyageurs, pas de chambre, 1 lit double');
  verifier(capaciteSuggeree('T3').chambres === 2 && capaciteSuggeree('T3').capacite === 4 && capaciteSuggeree('T3').lits.double === 2, 'T3 : 2 chambres, 4 voyageurs');
  verifier(typeDeLaFamille('appartement') === 'T2' && typeDeLaFamille('appartement', 'T4') === 'T4' && typeDeLaFamille('appartement', 'maison') === 'T2', 'appartement : T2 par défaut, garde ses pièces');
  verifier(typeDeLaFamille('maison', 'T3') === 'maison' && familleDuType('T1') === 'appartement' && familleDuType('studio') === 'studio', 'familles et types');
  verifier(nomSuggere('T2', '  Corbeil-Essonnes ', []) === 'T2 Corbeil-Essonnes', 'nom proposé : type et ville');
  verifier(nomSuggere('T2', 'Évry', ['t2 évry', 'T2 Évry 2']) === 'T2 Évry 3', 'nom déjà pris : numéroté');
  verifier(nomSuggere('autre', 'Évry', []) === 'Logement Évry' && nomSuggere('maison', 'Saint  Germain', []) === 'Maison Saint Germain', '« Autre » devient « Logement » ; espaces resserrés');
}

section('Assistant : récapitulatif');
{
  verifier(texteCapacite(brouillon()) === '4 voyageurs · 2 chambres · 2 lits doubles, 1 canapé-lit · 58 m²', `capacité en une ligne (${texteCapacite(brouillon())})`);
  verifier(texteCapacite({ capacite: 1, chambres: 0, lits: { double: 0, simple: 1, canape: 0 }, surfaceM2: '' }) === '1 voyageur · Pas de chambre séparée · 1 lit simple', 'singulier, studio sans surface');
  const lignes = lignesRecap(brouillon(), proprietaires);
  verifier(empreinte(lignes.map((l) => l.etape)) === empreinte(['type', 'adresse', 'capacite', 'nom', 'proprietaire']), 'une ligne par écran, dans l’ordre');
  verifier(lignes[0].valeur === 'Appartement T3' && lignes[1].valeur === '12 rue de la Gare, 91100 Corbeil-Essonnes' && lignes[4].valeur === 'Alice Martin', 'type, adresse et propriétaire lisibles');
  const avecNouveau = lignesRecap(brouillon({ modeProprietaire: 'nouveau', nouveauProprietaire: { ...saisieProprietaireInitiale(), nom: ' Léa Roy ' } }), proprietaires);
  verifier(avecNouveau[4].valeur === 'Léa Roy (nouveau)', 'nouveau propriétaire signalé');
}

section('Formulaire et assistant : exactement le même logement');
{
  const r = creationDepuisAssistant(brouillon(), { proprietaires, idLogement: 'log-a', idProprietaire: 'pro-inutile', aujourdhui: JOUR });
  // La même chose tapée dans le formulaire.
  const parFormulaire = logementDepuisSaisie(
    {
      ...saisieInitiale(),
      nom: 'T3 Corbeil-Essonnes',
      adresse: '12 rue de la Gare',
      codePostal: '91100',
      ville: 'Corbeil-Essonnes',
      type: 'T3',
      surfaceM2: '58',
      capacite: '4',
      chambres: '2',
      lits: { double: '2', simple: '0', canape: '1' },
      proprietaireId: A,
    },
    'log-a',
    JOUR,
  );
  verifier(r.ok && empreinte(r.logement) === empreinte(parFormulaire), 'mêmes réponses : logement identique champ pour champ');
  verifier(r.ok && !r.proprietaire, 'propriétaire de la liste : aucune fiche créée');
  verifier(r.ok && empreinte(Object.keys(r.logement).sort()) === empreinte(Object.keys(parFormulaire).sort()), 'mêmes champs présents');
  verifier(r.ok && r.logement.statut === 'lancement' && r.logement.annonces.every((a) => !a.connecte), 'créé « En préparation », sans annonce connectée');

  const n = creationDepuisAssistant(
    brouillon({ modeProprietaire: 'nouveau', proprietaireId: '', nouveauProprietaire: { type: 'societe', nom: 'Gîtes SAS', email: 'contact@gites.fr', telephone: '01 23 45 67 89', adresse: '9 av. D', notes: '' } }),
    { proprietaires, idLogement: 'log-b', idProprietaire: 'pro-nouveau', aujourdhui: JOUR },
  );
  verifier(n.ok && n.proprietaire?.id === 'pro-nouveau' && n.logement.proprietaireId === 'pro-nouveau', 'nouveau propriétaire : créé avec le logement, qui le désigne');
  verifier(
    n.ok && empreinte(n.proprietaire) === empreinte(proprietaireDepuisSaisie({ type: 'societe', nom: 'Gîtes SAS', email: 'contact@gites.fr', telephone: '01 23 45 67 89', adresse: '9 av. D', notes: '' }, 'pro-nouveau', JOUR)),
    'fiche du nouveau propriétaire identique à celle de sa fenêtre',
  );
  const refus = creationDepuisAssistant(brouillon({ proprietaireId: 'pro-supprime' }), { proprietaires, idLogement: 'log-c', idProprietaire: 'pro-x', aujourdhui: JOUR });
  verifier(!refus.ok && refus.etape === 'proprietaire', 'propriétaire disparu : rien n’est créé, retour à son écran');
  const incomplet = creationDepuisAssistant(brouillon({ type: undefined }), { proprietaires, idLogement: 'log-d', idProprietaire: 'pro-x', aujourdhui: JOUR });
  verifier(!incomplet.ok && incomplet.etape === 'type', 'type manquant : retour au premier écran');
}

console.log(`\n${reussis} contrôles réussis, ${echecs} en échec.`);
(globalThis as { process?: { exitCode?: number } }).process!.exitCode = echecs ? 1 : 0;
