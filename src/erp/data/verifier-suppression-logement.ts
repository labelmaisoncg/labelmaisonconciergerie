/**
 * Auto-contrôle de la suppression d'un logement (suppression-logement.ts),
 * sans réseau : logement vide supprimé avec ce qui n'appartient qu'à lui,
 * refus pour chaque trace d'historique, gérant seulement (et jamais en
 * lecture seule), annonce encore suivie, données d'un seul espace, mêmes
 * règles dans les fichiers SQL.
 *
 * Lancement (Node 18+), depuis la racine du dépôt :
 *   node_modules/.bin/esbuild src/erp/data/verifier-suppression-logement.ts --bundle --platform=node --format=esm \
 *     --define:import.meta.env='{"VITE_ERP_DEMO":"1"}' --log-level=error --outfile=/tmp/verifier-suppression-logement.mjs \
 *     && node /tmp/verifier-suppression-logement.mjs
 */
import { completer, donneesVides } from './collections';
import { SUPPRESSIONS_GERANT_SEULEMENT, operationReserveeAuGerant } from './ecritures-gerant';
import { creerSeed } from './seed';
import {
  annonceSuivie,
  historiqueDuLogement,
  peutSupprimerLogement,
  resumeHistorique,
  supprimerLogementDe,
  verdictSuppression,
  type CleHistorique,
} from './suppression-logement';
import { differences } from './synchro';
import type { ErpDonnees, Logement } from './types';

let echecs = 0;
let reussis = 0;
function verifier(condition: unknown, message: string, detail?: unknown) {
  if (condition) reussis++;
  else {
    echecs++;
    console.error(`  ✗ ${message}${detail === undefined ? '' : ` : ${JSON.stringify(detail)}`}`);
  }
}
const section = (titre: string) => console.log(`\n${titre}`);

const ID = 'log-essai';
const logement = (x: Partial<Logement> = {}): Logement =>
  ({
    id: ID,
    nom: 'Studio essai',
    adresse: '',
    ville: 'Évry',
    codePostal: '',
    type: 'studio',
    surfaceM2: 0,
    capacite: 2,
    chambres: 0,
    lits: [],
    statut: 'lancement',
    proprietaireId: 'prop-1',
    residencePrincipale: false,
    serrure: 'cles',
    fiche: { wifiNom: '', wifiCode: '', heureArrivee: '', heureDepart: '', acces: '', parking: '', regles: '', equipements: [], guides: [] },
    dotationLinge: [],
    annonces: [],
    checklistLancement: [],
    ...x,
  }) as Logement;

/** Jeu d'un espace : ce logement, un autre logement avec sa propre vie, et ce que l'espace règle. */
function jeu(l: Logement = logement()): ErpDonnees {
  const d = donneesVides();
  const autre = logement({ id: 'log-autre', nom: 'Maison voisine', statut: 'actif' });
  return {
    ...d,
    logements: [l, autre],
    reservations: [{ id: 'res-autre', logementId: 'log-autre', statut: 'confirmee' } as never],
    affectations: [{ id: ID, responsableId: 'mem-1' }, { id: 'log-autre', responsableId: 'mem-1' }],
    equipe: [
      { id: 'mem-1', nom: 'Inès', role: 'agent', logementIds: [ID, 'log-autre'], actif: true },
      { id: 'mem-2', nom: 'Paul', role: 'agent', logementIds: ['log-autre'], actif: true },
    ],
    reglages: [
      { id: 'supplements', logements: { [ID]: { arrivee_anticipee: { actif: true } }, 'log-autre': {} } } as never,
      {
        id: 'messages-programmes',
        modeles: {
          confirmation: { actif: true, texte: 'Bonjour', logements: { [ID]: { texte: 'Propre' }, 'log-autre': { actif: false } } },
          veille_arrivee: { actif: false, texte: 'Demain' },
        },
      } as never,
      { id: 'agent', actif: true } as never,
    ],
    conseilsPrix: [{ id: 'reglages', genre: 'reglages', parLogement: { [ID]: { plancher: 5000 }, 'log-autre': { plafond: 20000 } } } as never],
    recommandations: [
      { id: 'reco-1', logementId: ID, statut: 'a_proposer' } as never,
      { id: 'reco-autre', logementId: 'log-autre', statut: 'a_proposer' } as never,
    ],
    versionsAnnonce: [
      { id: 'ann-1', logementId: ID, statut: 'proposee' } as never,
      { id: 'ann-2', logementId: ID, statut: 'rejetee' } as never,
    ],
    mandats: [{ id: 'man-brouillon', logementId: ID, proprietaireId: 'prop-1', statut: 'brouillon' } as never],
    signalementsLogement: [{ id: 'sig-1', logementId: ID, membreId: 'mem-1', le: '2026-10-01T10:00:00+02:00', statut: 'ouvert' }],
    journal: [{ id: 'jrn-1', horodatage: '2026-10-01T10:00:00+02:00', auteur: 'Démo', action: 'Création', entite: 'logements', entiteId: ID, details: '' }],
  };
}

const gerant = (d: ErpDonnees, id = ID) => verdictSuppression({ role: 'gerant', logementId: id, donnees: d });

section('Logement sans historique : supprimé, avec ce qui n’appartient qu’à lui');
{
  const d = jeu();
  const v = gerant(d);
  verifier(v.ok, 'verdict : permis', v);
  verifier(v.ok && v.avecLui.join() === 'son mandat en préparation', 'la confirmation dit que le mandat en préparation part avec lui', v);
  const apres = supprimerLogementDe(d, ID);
  verifier(!apres.logements.some((l) => l.id === ID) && apres.logements.length === 1, 'le logement n’est plus là, l’autre reste');
  verifier(apres.affectations.map((a) => a.id).join() === 'log-autre', 'qui le suit : retiré (affectations)');
  verifier(apres.equipe[0].logementIds.join() === 'log-autre' && apres.equipe[1] === d.equipe[1], 'retiré de la liste du membre qui le suivait ; les autres membres intacts');
  const supp = apres.reglages.find((r) => r.id === 'supplements') as unknown as { logements: Record<string, unknown> };
  verifier(Object.keys(supp.logements).join() === 'log-autre', 'suppléments : son réglage retiré, celui de l’autre logement reste');
  const prog = apres.reglages.find((r) => r.id === 'messages-programmes') as unknown as { modeles: Record<string, { logements?: Record<string, unknown> }> };
  verifier(Object.keys(prog.modeles.confirmation.logements ?? {}).join() === 'log-autre' && prog.modeles.veille_arrivee === (d.reglages[1] as unknown as typeof prog).modeles.veille_arrivee, 'messages automatiques : son texte propre retiré, le reste intact');
  verifier(apres.reglages[2] === d.reglages[2], 'réglages de l’agent : intacts (même objet)');
  const prix = apres.conseilsPrix[0] as unknown as { parLogement: Record<string, unknown> };
  verifier(Object.keys(prix.parLogement).join() === 'log-autre', 'prix conseillés : plancher et plafond retirés');
  verifier(apres.recommandations.map((r) => r.id).join() === 'reco-autre', 'améliorations « à proposer » retirées (celles d’un autre logement restent)');
  verifier(apres.versionsAnnonce.length === 0 && apres.mandats.length === 0 && apres.signalementsLogement.length === 0, 'textes proposés ou rejetés, mandat en préparation et « pas à moi » retirés');
  verifier(apres.reservations === d.reservations && apres.journal === d.journal, 'réservations et journal : intacts (mêmes listes)');
  const ops = differences(d, apres).map((o) => `${o.type} ${o.collection}/${o.id}`).sort();
  verifier(
    JSON.stringify(ops) ===
      JSON.stringify(
        [
          'supprimer logements/log-essai',
          'supprimer affectations/log-essai',
          'ecrire equipe/mem-1',
          'ecrire reglages/supplements',
          'ecrire reglages/messages-programmes',
          'ecrire conseilsPrix/reglages',
          'supprimer recommandations/reco-1',
          'supprimer versionsAnnonce/ann-1',
          'supprimer versionsAnnonce/ann-2',
          'supprimer mandats/man-brouillon',
          'supprimer signalementsLogement/sig-1',
        ].sort(),
      ),
    'enregistrement : exactement ces changements, rien d’autre n’est réécrit',
    ops,
  );
  // Rien d'autre que le logement à retirer : rien d'autre n'est touché.
  const seul = { ...donneesVides(), logements: [logement()] };
  const sans = supprimerLogementDe(seul, ID);
  verifier(JSON.stringify(differences(seul, sans)) === JSON.stringify([{ type: 'supprimer', collection: 'logements', id: ID }]), 'logement seul : une seule suppression');
  verifier(gerant(seul).ok && (gerant(seul) as { avecLui: string[] }).avecLui.length === 0, 'logement seul : rien d’autre n’est annoncé dans la confirmation');
  verifier(supprimerLogementDe(seul, 'inconnu') === seul || differences(seul, supprimerLogementDe(seul, 'inconnu')).length === 0, 'logement inconnu : rien ne change');
}

section('Historique : chaque trace refuse la suppression');
{
  const base = jeu();
  const cas: { nom: string; cle: CleHistorique; ajout: (d: ErpDonnees) => Partial<ErpDonnees> }[] = [
    { nom: 'réservation annulée', cle: 'reservations', ajout: (d) => ({ reservations: [...d.reservations, { id: 'r1', logementId: ID, statut: 'annulee' } as never] }) },
    { nom: 'conversation', cle: 'conversations', ajout: () => ({ filsMessages: [{ id: 'f1', logementId: ID } as never] }) },
    {
      nom: 'facture mensuelle numérotée qui le nomme',
      cle: 'factures',
      ajout: () => ({ factures: [{ id: 'fac-1', numero: '2026-0012', proprietaireId: 'prop-1', statut: 'payee', mensuelle: { mois: '2026-09', logements: ['studio  ESSAI'] } } as never] }),
    },
    {
      nom: 'bilan publié qui le compte',
      cle: 'bilans',
      ajout: () => ({ bilansProprietaire: [{ id: 'prop-1-2026-09', proprietaireId: 'prop-1', statut: 'publie', chiffres: { logements: [{ logementId: ID }], sejours: [] } } as never] }),
    },
    { nom: 'document partagé au propriétaire', cle: 'documents', ajout: () => ({ documentsProprietaire: [{ id: 'doc-1', proprietaireId: 'prop-1', logementId: ID, categorie: 'contrat' } as never] }) },
    { nom: 'mandat signé', cle: 'mandats', ajout: (d) => ({ mandats: [...d.mandats, { id: 'man-s', logementId: ID, statut: 'signe' } as never] }) },
    { nom: 'mandat envoyé', cle: 'mandats', ajout: () => ({ mandats: [{ id: 'man-e', logementId: ID, statut: 'envoye' } as never] }) },
    { nom: 'mandat résilié', cle: 'mandats', ajout: () => ({ mandats: [{ id: 'man-r', logementId: ID, statut: 'resilie' } as never] }) },
    { nom: 'dossier du propriétaire', cle: 'dossiers', ajout: () => ({ dossiers: [{ id: 'dos-1', proprietaireId: 'prop-1', logementId: ID, recuLe: '2026-10-01', valeurs: {} }] }) },
    { nom: 'ménage annulé', cle: 'menages', ajout: () => ({ missions: [{ id: 'm1', logementId: ID, type: 'menage', statut: 'annulee' } as never] }) },
    { nom: 'mission de maintenance', cle: 'missions', ajout: () => ({ missions: [{ id: 'm2', logementId: ID, type: 'maintenance', statut: 'a_attribuer' } as never] }) },
    { nom: 'mouvement de linge', cle: 'linge', ajout: () => ({ mouvementsLinge: [{ id: 'lin-1', logementId: ID } as never] }) },
    { nom: 'incident', cle: 'incidents', ajout: () => ({ incidents: [{ id: 'inc-1', logementId: ID } as never] }) },
    { nom: 'contrôle qualité', cle: 'controles', ajout: () => ({ controles: [{ id: 'ctl-1', logementId: ID } as never] }) },
    { nom: 'charge', cle: 'charges', ajout: () => ({ charges: [{ id: 'ch-1', logementId: ID } as never] }) },
    { nom: 'avis à déposer', cle: 'avis', ajout: () => ({ avisADeposer: [{ id: 'av-1', logementId: ID } as never] }) },
    { nom: 'message automatique', cle: 'messagesAuto', ajout: () => ({ envoisProgrammes: [{ id: 'r1~confirmation', logementId: ID } as never] }) },
    { nom: 'amélioration proposée au propriétaire', cle: 'ameliorations', ajout: () => ({ recommandations: [{ id: 'reco-p', logementId: ID, statut: 'proposee' } as never] }) },
    { nom: 'texte d’annonce publié', cle: 'textesAnnonce', ajout: () => ({ versionsAnnonce: [{ id: 'ann-p', logementId: ID, statut: 'publiee' } as never] }) },
    { nom: 'texte d’annonce validé', cle: 'textesAnnonce', ajout: () => ({ versionsAnnonce: [{ id: 'ann-v', logementId: ID, statut: 'validee' } as never] }) },
    { nom: 'prix conseillé traité', cle: 'prix', ajout: (d) => ({ conseilsPrix: [...d.conseilsPrix, { id: 'decision-1', genre: 'decision', logementId: ID } as never] }) },
    { nom: 'action de l’IA (ménage prévu puis annulé)', cle: 'actionsIA', ajout: () => ({ actionsAgent: [{ id: 'act-1', collection: 'missions', cibleId: 'm-x', lien: `/erp/logements/${ID}` } as never] }) },
    { nom: 'action de l’IA ciblant le logement', cle: 'actionsIA', ajout: () => ({ actionsAgent: [{ id: 'act-2', collection: 'missions', cibleId: ID } as never] }) },
  ];
  for (const c of cas) {
    const d = { ...base, ...c.ajout(base) };
    const v = gerant(d);
    verifier(!v.ok && v.motif === 'historique' && v.historique.length === 1 && v.historique[0].cle === c.cle, `${c.nom} : refusé (${c.cle})`, v);
    verifier(!v.ok && /Sorti/.test(v.message), `${c.nom} : le refus propose « Sorti »`);
  }
  // Ce qui ne compte pas : brouillons, autre propriétaire, autre logement, homonyme.
  const neutres: { nom: string; ajout: Partial<ErpDonnees> }[] = [
    { nom: 'facture en brouillon (sans numéro)', ajout: { factures: [{ id: 'fb', numero: '', proprietaireId: 'prop-1', statut: 'brouillon', mensuelle: { mois: '2026-10', logements: ['Studio essai'] } } as never] } },
    { nom: 'facture d’un autre propriétaire', ajout: { factures: [{ id: 'fo', numero: '2026-0001', proprietaireId: 'prop-9', mensuelle: { mois: '2026-09', logements: ['Studio essai'] } } as never] } },
    { nom: 'bilan en brouillon', ajout: { bilansProprietaire: [{ id: 'b', proprietaireId: 'prop-1', statut: 'brouillon', chiffres: { logements: [{ logementId: ID }], sejours: [] } } as never] } },
    { nom: 'traces d’un autre logement', ajout: { reservations: [{ id: 'r9', logementId: 'log-autre' } as never], missions: [{ id: 'm9', logementId: 'log-autre', type: 'menage' } as never] } },
    { nom: 'action de l’IA sur un autre logement au préfixe proche', ajout: { actionsAgent: [{ id: 'a9', cibleId: 'x', lien: `/erp/logements/${ID}-bis` } as never] } },
  ];
  for (const n of neutres) verifier(gerant({ ...base, ...n.ajout }).ok, `${n.nom} : ne bloque pas`);
  // Doublon d'un logement importé, même nom et même propriétaire : la facture de l'importé ne bloque pas le doublon.
  const doublon = {
    ...base,
    logements: [...base.logements, logement({ id: 'repull-77', nom: 'Studio Essai', repull: { id: '77' } })],
    factures: [{ id: 'fac-i', numero: '2026-0007', proprietaireId: 'prop-1', mensuelle: { mois: '2026-09', logements: ['Studio Essai'] } } as never],
  };
  verifier(gerant(doublon).ok, 'doublon d’un logement importé du même nom : la facture de l’importé ne bloque pas', gerant(doublon));
  // Ancien propriétaire : sa facture compte aussi.
  const cede = {
    ...base,
    logements: [logement({ proprietaireId: 'prop-2', proprietairesPrecedents: [{ proprietaireId: 'prop-1', jusquAu: '2026-09-01' }] })],
    factures: [{ id: 'fac-a', numero: '2026-0003', proprietaireId: 'prop-1', mensuelle: { mois: '2026-08', logements: ['Studio essai'] } } as never],
  };
  verifier(!gerant(cede).ok, 'facture de l’ancien propriétaire qui le nomme : compte aussi');

  // Plusieurs traces : comptées et dites dans l'ordre.
  const plein = {
    ...base,
    reservations: Array.from({ length: 12 }, (_, i) => ({ id: `r${i}`, logementId: ID, statut: 'terminee' }) as never),
    factures: Array.from({ length: 3 }, (_, i) => ({ id: `f${i}`, numero: `2026-00${i + 1}`, proprietaireId: 'prop-1', mensuelle: { mois: `2026-0${i + 1}`, logements: ['Studio essai'] } }) as never),
    incidents: [{ id: 'i1', logementId: ID } as never],
  };
  const v = gerant(plein);
  verifier(!v.ok && v.motif === 'historique' && resumeHistorique(v.historique) === '12 réservations, 3 factures et 1 incident', 'résumé : « 12 réservations, 3 factures et 1 incident »', v);
  verifier(!v.ok && v.message.startsWith('« Studio essai » a 12 réservations, 3 factures et 1 incident'), 'message du store : le résumé et la marche à suivre', v);
  verifier(resumeHistorique([]) === '' && resumeHistorique([{ libelle: '1 incident' }]) === '1 incident', 'résumé : vide, un seul élément');
  const cinq = ['36 réservations', '1 conversation', '1 mandat', '35 ménages', '2 avis à déposer'].map((libelle) => ({ libelle }));
  verifier(resumeHistorique(cinq) === '36 réservations, 1 conversation, 1 mandat et d’autres éléments', 'résumé : au-delà de quatre sortes, les trois premières et « d’autres éléments »', resumeHistorique(cinq));
  verifier(resumeHistorique(cinq.slice(0, 4)) === '36 réservations, 1 conversation, 1 mandat et 35 ménages', 'résumé : quatre sortes, toutes dites');
}

section('Droits : un gérant, jamais en lecture seule');
{
  const d = jeu();
  for (const role of ['operations', 'lecture', 'prestataire', undefined]) {
    const v = verdictSuppression({ role, logementId: ID, donnees: d });
    verifier(!v.ok && v.motif === 'droits', `rôle ${role ?? 'inconnu'} : refusé`, v);
  }
  const lecture = verdictSuppression({ role: 'gerant', lectureSeule: true, logementId: ID, donnees: d });
  verifier(!lecture.ok && lecture.motif === 'droits', 'gérant en lecture seule : refusé', lecture);
  verifier(peutSupprimerLogement('gerant') && !peutSupprimerLogement('gerant', true) && !peutSupprimerLogement('operations'), 'bouton : gérant seulement, hors lecture seule');
  const introuvable = gerant(d, 'log-disparu');
  verifier(!introuvable.ok && introuvable.motif === 'introuvable', 'logement disparu entre-temps : refusé', introuvable);

  // Le navigateur d'un compte qui n'est pas gérant n'envoie jamais la suppression (la base la refuserait).
  const supprimer = { type: 'supprimer' as const, collection: 'logements' as const, id: ID };
  verifier(operationReserveeAuGerant(supprimer, d), 'suppression d’un logement : réservée au gérant (écartée avant l’envoi pour les autres)');
  verifier(!operationReserveeAuGerant({ type: 'ecrire', collection: 'logements', id: ID, donnees: { ...logement(), nom: 'Renommé' } }, d), 'modifier la fiche reste permis à l’équipe');
  verifier(!operationReserveeAuGerant({ type: 'supprimer', collection: 'charges', id: 'ch-1' }, d), 'supprimer une charge reste permis à l’équipe');
  const ops = differences(d, supprimerLogementDe(d, ID));
  verifier(
    ops.filter((o) => operationReserveeAuGerant(o, d)).map((o) => `${o.collection}/${o.id}`).includes(`logements/${ID}`),
    'dans l’envoi d’une suppression, la ligne du logement est bien celle que la base réserve au gérant',
  );
}

section('Annonce encore suivie : refus, Connexions d’abord');
{
  const lie = logement({ repull: { id: '555' }, liaison: { annonce: '555', le: '2026-10-01T10:00:00+02:00', par: 'gerant@exemple.invalid', avant: {} } });
  const v1 = gerant(jeu(lie));
  verifier(!v1.ok && v1.motif === 'annonce' && /Connexions/.test(v1.message), 'relié à la main, annonce suivie : refusé, décocher dans Connexions', v1);
  const importe = logement({ id: 'repull-555', repull: { id: '555' } });
  const v2 = gerant({ ...jeu(), logements: [importe] }, 'repull-555');
  verifier(!v2.ok && v2.motif === 'annonce', 'importé, annonce suivie : refusé', v2);
  const sansTrace = logement({ id: 'repull-556' });
  verifier(annonceSuivie(sansTrace), 'logement « repull-… » sans trace de l’annonce : considéré comme suivi (prudence)');
  const decoche = logement({ id: 'repull-555', statut: 'pause', repull: { id: '555', horsSelection: true, statutAvantPause: 'actif' } });
  verifier(gerant({ ...jeu(), logements: [decoche] }, 'repull-555').ok, 'annonce décochée dans Connexions (en pause) : permis, plus rien ne le recrée');
  const lieDecoche = logement({ ...lie, repull: { id: '555', horsSelection: true } });
  verifier(gerant(jeu(lieDecoche)).ok, 'relié à la main puis décoché : permis');
  const avecHistorique = { ...jeu(lie), reservations: [{ id: 'r', logementId: ID, statut: 'confirmee' } as never] };
  const v3 = gerant(avecHistorique);
  verifier(!v3.ok && v3.motif === 'historique', 'suivi ET historique : on dit l’historique (seul « Sorti » reste possible)', v3);
  verifier(!annonceSuivie(logement()), 'créé à la main, jamais relié : pas suivi');
}

section('Un espace à la fois : seules les données de l’espace ouvert comptent');
{
  // Deux espaces, chacun son jeu (le navigateur ne charge que celui de l'espace ouvert) : un logement
  // de même id ailleurs, avec toute une vie, ne bloque rien ici, et rien d'ici n'est touché là-bas.
  const ici = jeu();
  const ailleurs = { ...jeu(), reservations: [{ id: 'r-ailleurs', logementId: ID, statut: 'terminee' } as never], filsMessages: [{ id: 'f-ailleurs', logementId: ID } as never] };
  verifier(gerant(ici).ok && !gerant(ailleurs).ok, 'même id dans un autre espace : chacun son verdict, sur ses données');
  const avant = JSON.stringify(ailleurs);
  supprimerLogementDe(ici, ID);
  verifier(JSON.stringify(ailleurs) === avant, 'supprimer ici ne change rien au jeu de l’autre espace');
  verifier(historiqueDuLogement(logement(), {}).length === 0, 'données absentes : aucune trace (pas d’erreur)');
}

section('Démonstration : chaque logement de la démo a un historique (refus montré tel quel)');
{
  // La démo n'a pas de logement « créé par erreur » : les captures en ajoutent un dans le navigateur.
  const d = completer(creerSeed());
  const verdicts = d.logements.map((l) => ({ l, v: gerant(d, l.id) }));
  verifier(verdicts.length > 0 && verdicts.every((x) => !x.v.ok && x.v.motif === 'historique'), 'logements de la démo : historique, suppression refusée', verdicts.map((x) => `${x.l.id}: ${x.v.ok ? 'ok' : x.v.motif}`));
  for (const x of verdicts.slice(0, 3)) if (!x.v.ok && x.v.motif === 'historique') console.log(`  ${x.l.nom} : ${resumeHistorique(x.v.historique)}`);
  const linas = verdicts.find((x) => x.l.id === 'log-linas');
  if (linas && !linas.v.ok && linas.v.motif === 'historique') console.log(`  ${linas.l.nom} : ${resumeHistorique(linas.v.historique)}`);
}

// Modules de Node chargés à l'exécution (l'ERP n'a pas les types de Node).
async function fichiersSql() {
  section('Base : la suppression d’un logement est réservée au gérant, dans les trois fichiers SQL');
  const nomFs = 'node:fs';
  const fs = (await import(/* @vite-ignore */ nomFs)) as { existsSync(p: string): boolean; readFileSync(p: string, e: 'utf8'): string };
  const racine = (globalThis as { process?: { cwd(): string } }).process!.cwd();
  const lire = (f: string) => (fs.existsSync(`${racine}/${f}`) ? fs.readFileSync(`${racine}/${f}`, 'utf8') : '');
  for (const fichier of ['supabase/erp-espaces.sql', 'supabase/erp-installation.sql', 'supabase/erp-acces-gerants.sql']) {
    const sql = lire(fichier);
    verifier(!!sql, `${fichier} : lu (lancer depuis la racine du dépôt)`);
    const regle = /create policy "ecritures reservees aux gerants \(suppression\)"[\s\S]*?;/.exec(sql)?.[0] ?? '';
    const liste = [...(/collection not in \(([^)]*)\)/.exec(regle)?.[1] ?? '').matchAll(/'([^']*)'/g)].map((m) => m[1]).sort();
    verifier(JSON.stringify(liste) === JSON.stringify([...SUPPRESSIONS_GERANT_SEULEMENT].sort()), `${fichier} : mêmes suppressions réservées que ecritures-gerant.ts`, liste);
  }
  const espaces = lire('supabase/erp-espaces.sql');
  for (const cas of ['un compte « opérations » supprime un logement', 'un gérant ne supprime pas un logement', "le gérant d''un autre espace supprime un logement de Label Maison", "un logement supprimé ne reste pas dans l''historique"]) {
    verifier(espaces.includes(cas), `erp-espaces.sql : la recette vérifie « ${cas.replace(/''/g, '’')} »`);
  }
  const acces = lire('supabase/erp-acces-gerants.sql');
  verifier(acces.includes('un compte « opérations » supprime un logement') && acces.includes('un gérant ne supprime pas un logement'), 'erp-acces-gerants.sql : la recette vérifie gérant et opérations');
  const store = lire('src/erp/data/store.tsx');
  verifier(/const supprimerLogement = [\s\S]*?verdictSuppression\([\s\S]*?if \(!verdict\.ok\) return echec[\s\S]*?supprimerLogementDe/.test(store), 'store : le verdict (droits, lecture seule, historique, annonce) passe avant toute suppression');
}

void fichiersSql().then(() => {
  console.log(`\n${reussis} contrôles réussis, ${echecs} en échec.`);
  (globalThis as { process?: { exitCode?: number } }).process!.exitCode = echecs ? 1 : 0;
});
