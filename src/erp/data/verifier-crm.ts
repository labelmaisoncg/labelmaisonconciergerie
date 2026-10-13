/**
 * Vérification des règles du CRM (src/erp/data/crm.ts), sans base ni réseau.
 *
 * Lancement :
 *   node_modules/.bin/esbuild src/erp/data/verifier-crm.ts --bundle --platform=node \
 *     --define:import.meta.env='{"VITE_ERP_DEMO":"1"}' --log-level=error --outfile=/tmp/verifier-crm.cjs \
 *     && node /tmp/verifier-crm.cjs
 */
import {
  aTraiterLe,
  contactDepuisDemande,
  fusionnerDemande,
  idContactCrm,
  noterAppel,
  sourceDemande,
  telephoneNormalise,
  trouverDoublon,
} from './crm';
import type { ContactCrm } from './types';

let ok = 0;
let ko = 0;
function verifier(condition: boolean, libelle: string) {
  if (condition) ok++;
  else {
    ko++;
    console.log(`  ✗ ${libelle}`);
  }
}

const T0 = '2026-10-13T09:00:00+02:00';
const T1 = '2026-10-14T18:30:00+02:00';

// Formulaire d'audit → ligne « À appeler »
const a = contactDepuisDemande(
  { type: 'audit', prenom: 'Sophie', email: 'Sophie@Exemple.fr ', tel: '+33 6 12 34 56 78', ville: 'Massy', typeBien: 'T2', message: 'Bonjour', page: '/conciergerie-airbnb-massy' },
  'crm-1',
  T0,
);
verifier(a.statut === 'a_appeler' && a.source === 'audit' && a.nom === 'Sophie', 'formulaire audit → « À appeler », source audit, nom = prénom');
verifier(a.email === 'sophie@exemple.fr', 'e-mail nettoyé (espaces, minuscules)');
verifier(a.historique.length === 1 && a.historique[0].resultat === 'formulaire' && a.historique[0].le === T0, 'trace « demande reçue » horodatée');
verifier(a.tentatives === 0 && a.notes === '', 'compteur et notes à zéro');

// Sources
verifier(sourceDemande('lead') === 'accueil' && sourceDemande('cercle') === 'cercle' && sourceDemande('n’importe quoi') === 'contact', 'source déduite du type de formulaire');

// Champs tronqués (formulaire public : jamais de texte démesuré en base)
const long = contactDepuisDemande({ type: 'contact', nom: 'x'.repeat(500), email: 'a@b.fr', message: 'y'.repeat(9000) }, 'crm-2', T0);
verifier(long.nom.length === 120 && (long.message ?? '').length <= 2000, 'nom et message tronqués');
const sansNom = contactDepuisDemande({ type: 'contact', email: 'anonyme@exemple.fr' }, 'crm-3', T0);
verifier(sansNom.nom === 'anonyme@exemple.fr', 'sans nom ni prénom : l’e-mail sert de nom');

// Téléphones
verifier(telephoneNormalise('+33 6 12 34 56 78') === '0612345678' && telephoneNormalise('06.12.34.56.78') === '0612345678', 'téléphone normalisé (+33 → 0)');

// Doublons
const liste: ContactCrm[] = [a];
verifier(trouverDoublon(liste, { email: 'SOPHIE@exemple.fr' })?.id === 'crm-1', 'doublon trouvé par e-mail (casse ignorée)');
verifier(trouverDoublon(liste, { telephone: '06 12 34 56 78' })?.id === 'crm-1', 'doublon trouvé par téléphone (+33 et 06 identiques)');
verifier(!trouverDoublon(liste, { email: 'autre@exemple.fr', telephone: '0700000000' }), 'pas de faux doublon');
verifier(!trouverDoublon([{ ...a, statut: 'signe' }], { email: 'sophie@exemple.fr' }), 'contact clos (signé) : nouvelle ligne, pas de fusion');
verifier(!trouverDoublon(liste, { telephone: '12' }), 'numéro trop court ignoré');

// Fusion d'une nouvelle demande
const contacte = { ...a, statut: 'contacte' as const, notes: 'Rappeler après 18 h' };
const nouvelle = contactDepuisDemande({ type: 'lead', email: 'sophie@exemple.fr', adresse: '1 rue Exemple', message: 'Je relance' }, 'crm-9', T1);
const fusion = fusionnerDemande(contacte, nouvelle, T1);
verifier(fusion.id === 'crm-1' && fusion.statut === 'contacte', 'nouvelle demande : même ligne, étape inchangée (un formulaire public ne réécrit pas la fiche)');
verifier(fusion.relanceLe === '2026-10-14', 'nouvelle demande : la fiche passe dans les appels du jour');
verifier(fusion.notes === 'Rappeler après 18 h' && fusion.adresse === '1 rue Exemple' && fusion.message === 'Bonjour', 'notes et message existants gardés, champs vides complétés');
verifier(fusion.historique.length === 2 && fusion.historique[0].le === T1 && fusion.historique[0].texte === 'Je relance', 'historique : nouvelle demande en tête, avec son message');
verifier(fusionnerDemande({ ...contacte, relanceLe: '2026-10-01' }, nouvelle, T1).relanceLe === '2026-10-01', 'relance déjà en retard : gardée');
const avancee = fusionnerDemande({ ...contacte, relanceLe: '2026-11-30' }, nouvelle, T1);
verifier(avancee.relanceLe === '2026-10-14' && /2026-11-30 avancée/.test(avancee.historique[0].texte ?? ''), 'relance future avancée à aujourd’hui, ancienne date notée dans l’historique');
verifier(contactDepuisDemande({ type: 'contact', nom: 'X', email: "o'neil@exemple.fr" }, 'crm-7', T0).email === "o'neil@exemple.fr", 'apostrophe acceptée dans un e-mail');

// E-mails qui détourneraient un lien mailto:
verifier(contactDepuisDemande({ type: 'contact', nom: 'X', email: 'x@y.fr?bcc=pirate%40z.com' }, 'crm-5', T0).email === undefined, 'e-mail piégé (?bcc=) écarté');
verifier(contactDepuisDemande({ type: 'contact', nom: 'X', email: 'a,b@y.fr' }, 'crm-6', T0).email === undefined, 'e-mail à virgule écarté');

// Appels
const sansReponse = noterAppel(a, 'pas_de_reponse', 'Kamel', T1);
verifier(sansReponse.statut === 'a_rappeler' && sansReponse.tentatives === 1, 'pas de réponse : « À rappeler », tentative comptée');
const joint = noterAppel(sansReponse, 'joint', 'Kamel', T1, 'Intéressée');
verifier(joint.statut === 'contacte' && joint.tentatives === 1 && joint.historique[0].texte === 'Intéressée', 'joint : « Contacté », note gardée');
const attente = noterAppel({ ...a, statut: 'en_attente' }, 'pas_de_reponse', 'Abdel', T1);
verifier(attente.statut === 'en_attente', 'en attente : un appel sans réponse ne change pas l’étape');
verifier(noterAppel(a, 'note', 'Abdel', T1, '  ').historique[0].texte === undefined, 'note vide non enregistrée');

// À traiter aujourd'hui
verifier(aTraiterLe(a, '2026-10-13'), 'nouvelle demande à traiter');
verifier(aTraiterLe({ ...a, statut: 'contacte', relanceLe: '2026-10-12' }, '2026-10-13'), 'relance échue à traiter');
verifier(!aTraiterLe({ ...a, statut: 'contacte', relanceLe: '2026-10-20' }, '2026-10-13'), 'relance future pas encore à traiter');
verifier(!aTraiterLe({ ...a, statut: 'signe', relanceLe: '2026-10-01' }, '2026-10-13'), 'contact signé jamais à traiter');

// Identifiants
verifier(idContactCrm(1, 0.5) !== idContactCrm(1, 0.6) && /^crm-[a-z0-9]+-[a-z0-9]+$/.test(idContactCrm()), 'identifiants distincts et bien formés');

console.log(`${ok} contrôles réussis, ${ko} en échec.`);
(globalThis as { process?: { exitCode?: number } }).process!.exitCode = ko ? 1 : 0;
