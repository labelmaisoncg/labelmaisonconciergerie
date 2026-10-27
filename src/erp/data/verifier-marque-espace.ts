/**
 * Vérification de la marque de l'espace (src/erp/data/marque-espace.ts et ce
 * qui s'en sert) : dans Label Maison, les textes d'avant à l'identique ; dans
 * un autre espace (Sens), ni le nom de Label Maison, ni ses associés, ni son
 * dossier propriétaire.
 *
 * Lancement :
 *   node_modules/.bin/esbuild src/erp/data/verifier-marque-espace.ts --bundle --platform=node --format=esm \
 *     --define:import.meta.env='{"VITE_ERP_DEMO":"1"}' --log-level=error --outfile=/tmp/verifier-marque-espace.mjs \
 *     && node /tmp/verifier-marque-espace.mjs
 */
import { GABARITS } from '../modules/messagerie/_composants/logique';
import { filtresAgenda } from './agenda-crm';
import { ESPACE_LABEL_MAISON, ID_LABEL_MAISON } from './espaces';
import {
  aideCrmVide,
  dossierProprietaireDisponible,
  libellesPartProprietaire,
  nomAppAffiche,
  nomConciergerie,
  notificationsIphone,
  optionsSuiviCrm,
  partageInstallation,
  signatureEspace,
  titreCarteApp,
  titreDocument,
  titrePageInstallation,
  titreProposerApp,
} from './marque-espace';
import type { Logement, ReglagesAgent, Utilisateur } from './types';

let ok = 0;
let ko = 0;
function verifier(condition: unknown, libelle: string, detail?: unknown) {
  if (condition) ok++;
  else {
    ko++;
    console.log(`  ✗ ${libelle}`, detail === undefined ? '' : JSON.stringify(detail));
  }
}

const LM = ESPACE_LABEL_MAISON;
/** Label Maison sous un autre nom en base : c'est l'identifiant qui décide. */
const LM_RENOMME = { id: ID_LABEL_MAISON.toUpperCase(), nom: 'Label Maison Conciergerie' };
const SENS = { id: '5e5e0000-0000-4000-8000-000000000002', nom: 'Sens' };
const SANS_NOM = { id: '7a7a0000-0000-4000-8000-000000000003', nom: '  ' };
const sansLM = (t: string) => !/Label Maison|Abdel|Kamel|labelmaisoncg/i.test(t);

const membres: Utilisateur[] = [
  { id: 'zoe@sens.example', nom: 'Zoé Martin', email: 'zoe@sens.example', role: 'operations' },
  { id: 'alix@sens.example', nom: 'Alix Bernard', email: 'alix@sens.example', role: 'gerant' },
  { id: 'compta@sens.example', nom: 'Cabinet Comptable', email: 'compta@sens.example', role: 'lecture' },
  { id: 'menage@sens.example', nom: 'Ménage Express', email: 'menage@sens.example', role: 'prestataire' },
];

function main() {
  // 1. Dossier propriétaire du site : Label Maison seulement.
  verifier(dossierProprietaireDisponible(LM) && dossierProprietaireDisponible(LM_RENOMME), 'dossier propriétaire : proposé dans Label Maison (quel que soit son nom en base)');
  verifier(!dossierProprietaireDisponible(SENS) && !dossierProprietaireDisponible(SANS_NOM), 'dossier propriétaire : jamais dans un autre espace');
  verifier(aideCrmVide(LM) === 'Chaque formulaire envoyé depuis le site arrive ici tout seul, dans « À appeler ».', 'CRM vide de Label Maison : phrase d’avant');
  verifier(!/site|formulaire/i.test(aideCrmVide(SENS)) && sansLM(aideCrmVide(SENS)), 'CRM vide d’un autre espace : rien sur les formulaires du site', aideCrmVide(SENS));

  // 2. Messagerie : « Merci » signé comme l'agent de l'espace.
  const merci = GABARITS.find((g) => g.cle === 'merci')!;
  const l = {} as Logement;
  const reglages = (signature?: string): { reglages: ReglagesAgent[] } => ({
    reglages: signature === undefined ? [] : [{ id: 'agent', signature } as ReglagesAgent],
  });
  verifier(
    merci.texte(l, 'Claire', signatureEspace(reglages(), LM)) === 'Merci Claire pour votre message. Nous restons à votre disposition pendant tout votre séjour. L’équipe Label Maison',
    'Merci, Label Maison sans réglage : le texte d’avant, à l’identique',
  );
  verifier(
    merci.texte(l, 'Claire', signatureEspace(reglages(), SENS)) === 'Merci Claire pour votre message. Nous restons à votre disposition pendant tout votre séjour. L’équipe Sens',
    'Merci, Sens sans réglage : « L’équipe Sens »',
  );
  verifier(merci.texte(l, 'Claire', signatureEspace(reglages('Inès, pour Sens'), SENS)).endsWith('séjour. Inès, pour Sens'), 'Merci : la signature réglée de l’agent');
  verifier(merci.texte(l, 'Claire', signatureEspace(reglages('   '), SENS)).endsWith('séjour.'), 'Merci : signature vide, pas d’espace en trop');
  verifier(signatureEspace(reglages(), SANS_NOM) === 'L’équipe', 'espace sans nom : « L’équipe », jamais celle de Label Maison');
  const logement = { fiche: { heureArrivee: '16:00', heureDepart: '11:00', acces: 'Boîte à clés.', parking: 'Rue', regles: 'Pas de fête.', wifiNom: 'Box', wifiCode: '1234' } } as unknown as Logement;
  verifier(GABARITS.every((g) => sansLM(g.texte(logement, 'Claire', signatureEspace(reglages(), SENS)))), 'aucun modèle de réponse ne nomme Label Maison dans Sens');

  // 3. « Suivi par » : Abdel et Kamel à Label Maison seulement.
  verifier(JSON.stringify(optionsSuiviCrm(LM, membres)) === JSON.stringify([{ valeur: 'abdel', libelle: 'Abdel' }, { valeur: 'kamel', libelle: 'Kamel' }]), 'Suivi par, Label Maison : Abdel et Kamel, comme avant');
  verifier(JSON.stringify(optionsSuiviCrm(LM_RENOMME, [], 'kamel')) === JSON.stringify(optionsSuiviCrm(LM, membres)), 'Suivi par, Label Maison : les valeurs d’avant restent valables');
  const sens = optionsSuiviCrm(SENS, membres);
  verifier(
    JSON.stringify(sens) === JSON.stringify([{ valeur: 'alix@sens.example', libelle: 'Alix Bernard' }, { valeur: 'zoe@sens.example', libelle: 'Zoé Martin' }]),
    'Suivi par, Sens : ses membres gérant et opérations (pas lecture ni prestataire), par ordre alphabétique',
    sens,
  );
  verifier(optionsSuiviCrm(SENS, membres).every((o) => o.valeur !== 'abdel' && o.valeur !== 'kamel' && sansLM(o.libelle)), 'Suivi par, Sens : jamais Abdel ni Kamel');
  const parti = optionsSuiviCrm(SENS, membres, 'ancien@sens.example');
  verifier(parti.length === 3 && parti[2].valeur === 'ancien@sens.example' && parti[2].libelle === 'ancien (plus dans l’équipe)', 'Suivi par, Sens : la personne choisie qui a quitté l’équipe reste affichée', parti);
  verifier(optionsSuiviCrm(SENS, []).length === 0, 'Suivi par, Sens sans membre : rien que « personne »');
  verifier(
    JSON.stringify(optionsSuiviCrm(SENS, membres, 'ancien@sens.example', true).map((o) => o.libelle)) === JSON.stringify(['Alix B.', 'Zoé M.', 'ancien']) &&
      JSON.stringify(optionsSuiviCrm(LM, membres, undefined, true)) === JSON.stringify(optionsSuiviCrm(LM, membres)),
    'Suivi par, grille : « Zoé M. » dans Sens, Abdel et Kamel inchangés à Label Maison',
  );
  verifier(filtresAgenda(ID_LABEL_MAISON).join() === 'tous,abdel,kamel' && filtresAgenda(null).join() === 'tous,abdel,kamel', 'agenda, Label Maison : toute l’équipe, Abdel ou Kamel');
  verifier(filtresAgenda(SENS.id).join() === 'tous', 'agenda, Sens : toute l’équipe seulement');

  // 4. Réservations : la part du propriétaire au nom de la conciergerie.
  verifier(
    JSON.stringify(libellesPartProprietaire(LM, 20)) === JSON.stringify({ menage: 'Ménage (pour Label Maison)', commission: 'Commission Label Maison (20 %)' }) &&
      JSON.stringify(libellesPartProprietaire(LM_RENOMME, 18)) === JSON.stringify({ menage: 'Ménage (pour Label Maison)', commission: 'Commission Label Maison (18 %)' }),
    'part du propriétaire, Label Maison : libellés d’avant',
  );
  verifier(JSON.stringify(libellesPartProprietaire(SENS, 20)) === JSON.stringify({ menage: 'Ménage (pour Sens)', commission: 'Commission Sens (20 %)' }), 'part du propriétaire, Sens : « Commission Sens (20 %) »');
  verifier(sansLM(Object.values(libellesPartProprietaire(SANS_NOM, 20)).join(' ')) && libellesPartProprietaire(SANS_NOM, 20).commission === 'Commission de la conciergerie (20 %)', 'part du propriétaire, espace sans nom : « de la conciergerie »');

  // 5. Coquille et app.
  verifier(titreDocument(LM) === 'ERP · Label Maison' && titreDocument(LM_RENOMME) === 'ERP · Label Maison', 'titre de l’onglet, Label Maison : « ERP · Label Maison »');
  verifier(titreDocument(SENS) === 'ERP · Sens' && titreDocument(SANS_NOM) === 'ERP', 'titre de l’onglet, Sens : « ERP · Sens »');
  verifier(nomConciergerie(LM_RENOMME) === 'Label Maison' && nomConciergerie(SENS) === 'Sens', 'nom de la conciergerie : décidé par l’identifiant');
  verifier(
    titreProposerApp(LM) === 'Installez l’app Label Maison' &&
      titreCarteApp(LM) === 'L’app Label Maison' &&
      titrePageInstallation(LM) === 'Installer l’app Label Maison' &&
      notificationsIphone(LM) === 'Notifications → Label Maison' &&
      nomAppAffiche(LM) === 'Label Maison' &&
      JSON.stringify(partageInstallation(LM)) === JSON.stringify({ title: 'App Label Maison', text: 'Installez l’app Label Maison :' }),
    'app, Label Maison : textes d’avant',
  );
  const textesSens = [titreProposerApp(SENS), titreCarteApp(SENS), titrePageInstallation(SENS), notificationsIphone(SENS), ...Object.values(partageInstallation(SENS))];
  verifier(textesSens.every(sansLM) && nomAppAffiche(SENS) === undefined && titreProposerApp(SENS) === 'Installez l’app', 'app, Sens : textes neutres, sans Label Maison', textesSens);

  console.log(`${ok} contrôles réussis, ${ko} en échec.`);
  (globalThis as { process?: { exitCode?: number } }).process!.exitCode = ko ? 1 : 0;
}

main();
