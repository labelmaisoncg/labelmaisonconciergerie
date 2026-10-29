/**
 * Auto-contrôle de la suppression d'une fiche propriétaire et d'un membre de
 * l'équipe (suppression-personnes.ts), sans réseau : personne sans historique
 * supprimée avec ce qui n'appartient qu'à elle, refus pour chaque trace
 * d'historique, accès encore ouvert, gérant seulement (et jamais en lecture
 * seule), données d'un seul espace, mêmes règles dans les fichiers SQL, textes
 * des écrans.
 *
 * Lancement (Node 18+), depuis la racine du dépôt :
 *   node_modules/.bin/esbuild src/erp/data/verifier-suppression-personnes.ts --bundle --platform=node --format=esm \
 *     --define:import.meta.env='{"VITE_ERP_DEMO":"1"}' --log-level=error --outfile=/tmp/verifier-suppression-personnes.mjs \
 *     && node /tmp/verifier-suppression-personnes.mjs
 */
import { completer, donneesVides } from './collections';
import { SUPPRESSIONS_GERANT_SEULEMENT, operationReserveeAuGerant } from './ecritures-gerant';
import { creerSeed } from './seed';
import { resumeHistorique } from './suppression-logement';
import {
  PHRASE_DEJA_HORS_EQUIPE,
  PHRASE_LOGEMENTS_PROPRIETAIRE,
  PHRASE_RETIRER_DE_LEQUIPE,
  accesOuvert,
  historiqueDuMembre,
  historiqueDuProprietaire,
  peutSupprimerPersonne,
  phraseConfirmation,
  supprimerMembreDe,
  supprimerProprietaireDe,
  verdictSuppressionMembre,
  verdictSuppressionProprietaire,
  type CleHistoriqueMembre,
  type CleHistoriqueProprietaire,
} from './suppression-personnes';
import { differences } from './synchro';
import type { ErpDonnees, Proprietaire } from './types';
import type { MembreEquipe } from './types-operations';

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
const ops = (avant: ErpDonnees, apres: ErpDonnees) => differences(avant, apres).map((o) => `${o.type} ${o.collection}/${o.id}`).sort();

/* ============================================================ propriétaire */

const PROP = 'pro-essai';
const proprietaire = (x: Partial<Proprietaire> = {}): Proprietaire => ({ id: PROP, type: 'particulier', nom: 'Essai Dupont', contact: { email: '', telephone: '' }, adresse: '', notes: '', creeLe: '2026-10-01', ...x });

/** Jeu d'un espace : ce propriétaire (fiche d'essai), un autre avec sa vie, et ce qui part avec le premier. */
function jeuProprietaire(): ErpDonnees {
  return {
    ...donneesVides(),
    proprietaires: [proprietaire(), proprietaire({ id: 'pro-autre', nom: 'Autre Martin' })],
    logements: [{ id: 'log-autre', nom: 'Maison voisine', proprietaireId: 'pro-autre', statut: 'actif' } as never],
    mandats: [
      { id: 'man-brouillon', proprietaireId: PROP, logementId: 'log-x', statut: 'brouillon' } as never,
      { id: 'man-autre', proprietaireId: 'pro-autre', logementId: 'log-autre', statut: 'signe' } as never,
    ],
    accesProprietaires: [
      { id: PROP, proprietaireId: PROP, email: 'essai@exemple.invalid', statut: 'retire', inviteLe: '2026-10-01T10:00:00Z', invitePar: 'g', retireLe: '2026-10-02T10:00:00Z', version: 2, liens: [] },
      { id: 'pro-autre', proprietaireId: 'pro-autre', email: 'autre@exemple.invalid', statut: 'actif', inviteLe: '2026-10-01T10:00:00Z', invitePar: 'g', version: 1, liens: [] },
    ],
    recommandations: [
      { id: 'reco-essai', proprietaireId: PROP, logementId: 'log-x', statut: 'a_proposer' } as never,
      { id: 'reco-autre', proprietaireId: 'pro-autre', logementId: 'log-autre', statut: 'a_proposer' } as never,
    ],
    factures: [{ id: 'fac-autre', proprietaireId: 'pro-autre', numero: '2026-0001' } as never],
    journal: [{ id: 'jrn-1', horodatage: '2026-10-01T10:00:00+02:00', auteur: 'Démo', action: 'Création', entite: 'proprietaire', entiteId: PROP, details: '' }],
  };
}
const gerantProp = (d: ErpDonnees, id = PROP) => verdictSuppressionProprietaire({ role: 'gerant', proprietaireId: id, donnees: d });

section('Propriétaire sans historique : supprimé, avec ce qui n’appartient qu’à lui');
{
  const d = jeuProprietaire();
  const v = gerantProp(d);
  verifier(v.ok, 'verdict : permis', v);
  verifier(v.ok && v.avecLui.join(' | ') === 'son mandat en préparation | son ancien accès', 'la confirmation dit le mandat en préparation et l’ancien accès', v);
  verifier(phraseConfirmation(v.ok ? v.avecLui : []) === 'Il disparaît de l’ERP, avec son mandat en préparation et son ancien accès. C’est définitif.', 'phrase de confirmation');
  verifier(phraseConfirmation([]) === 'Il disparaît de l’ERP. C’est définitif.', 'phrase de confirmation sans rien d’autre');
  const apres = supprimerProprietaireDe(d, PROP);
  verifier(apres.proprietaires.map((p) => p.id).join() === 'pro-autre', 'la fiche n’est plus là, l’autre reste');
  verifier(apres.mandats.map((m) => m.id).join() === 'man-autre', 'mandat en préparation retiré, celui de l’autre reste');
  verifier(apres.accesProprietaires.map((a) => a.id).join() === 'pro-autre', 'ancien accès (retiré) parti avec lui ; celui de l’autre reste');
  verifier(apres.recommandations.map((r) => r.id).join() === 'reco-autre', 'améliorations « à proposer » retirées, celles de l’autre restent');
  verifier(apres.logements === d.logements && apres.factures === d.factures && apres.journal === d.journal, 'logements, factures et journal : intacts (mêmes listes)');
  verifier(
    JSON.stringify(ops(d, apres)) ===
      JSON.stringify(['supprimer proprietaires/pro-essai', 'supprimer mandats/man-brouillon', 'supprimer accesProprietaires/pro-essai', 'supprimer recommandations/reco-essai'].sort()),
    'enregistrement : exactement ces changements, rien d’autre n’est réécrit',
    ops(d, apres),
  );
  const seul = { ...donneesVides(), proprietaires: [proprietaire()] };
  verifier(JSON.stringify(differences(seul, supprimerProprietaireDe(seul, PROP))) === JSON.stringify([{ type: 'supprimer', collection: 'proprietaires', id: PROP }]), 'fiche seule : une seule suppression');
  verifier(gerantProp(seul).ok && (gerantProp(seul) as { avecLui: string[] }).avecLui.length === 0, 'fiche seule : rien d’autre n’est annoncé');
  verifier(differences(seul, supprimerProprietaireDe(seul, 'inconnu')).length === 0, 'propriétaire inconnu : rien ne change');
}

section('Propriétaire : chaque trace d’historique refuse la suppression');
{
  const base = jeuProprietaire();
  const cas: { nom: string; cle: CleHistoriqueProprietaire; ajout: (d: ErpDonnees) => Partial<ErpDonnees> }[] = [
    { nom: 'logement actuel', cle: 'logements', ajout: (d) => ({ logements: [...d.logements, { id: 'log-1', nom: 'Studio', proprietaireId: PROP, statut: 'sorti' } as never] }) },
    {
      nom: 'ancien propriétaire d’un logement',
      cle: 'anciensLogements',
      ajout: (d) => ({ logements: [...d.logements, { id: 'log-2', nom: 'Cédé', proprietaireId: 'pro-autre', proprietairesPrecedents: [{ proprietaireId: PROP, jusquAu: '2026-09-01' }] } as never] }),
    },
    { nom: 'mandat envoyé', cle: 'mandats', ajout: (d) => ({ mandats: [...d.mandats, { id: 'man-e', proprietaireId: PROP, logementId: 'log-x', statut: 'envoye' } as never] }) },
    { nom: 'mandat signé', cle: 'mandats', ajout: (d) => ({ mandats: [...d.mandats, { id: 'man-s', proprietaireId: PROP, logementId: 'log-x', statut: 'signe' } as never] }) },
    { nom: 'mandat résilié', cle: 'mandats', ajout: (d) => ({ mandats: [...d.mandats, { id: 'man-r', proprietaireId: PROP, logementId: 'log-x', statut: 'resilie' } as never] }) },
    { nom: 'facture (même en brouillon)', cle: 'factures', ajout: (d) => ({ factures: [...d.factures, { id: 'fac-b', proprietaireId: PROP, numero: '', statut: 'brouillon' } as never] }) },
    { nom: 'bilan en brouillon', cle: 'bilans', ajout: () => ({ bilansProprietaire: [{ id: `${PROP}-2026-09`, proprietaireId: PROP, statut: 'brouillon' } as never] }) },
    { nom: 'bilan publié', cle: 'bilans', ajout: () => ({ bilansProprietaire: [{ id: `${PROP}-2026-08`, proprietaireId: PROP, statut: 'publie' } as never] }) },
    { nom: 'document partagé', cle: 'documents', ajout: () => ({ documentsProprietaire: [{ id: 'doc-1', proprietaireId: PROP, categorie: 'contrat' } as never] }) },
    { nom: 'dossier propriétaire', cle: 'dossiers', ajout: () => ({ dossiers: [{ id: 'dos-1', proprietaireId: PROP, logementId: 'log-x', recuLe: '2026-10-01', valeurs: {} }] }) },
    { nom: 'amélioration proposée', cle: 'ameliorations', ajout: (d) => ({ recommandations: [...d.recommandations, { id: 'reco-p', proprietaireId: PROP, logementId: 'log-x', statut: 'proposee' } as never] }) },
    { nom: 'action de l’IA ciblant la fiche', cle: 'actionsIA', ajout: () => ({ actionsAgent: [{ id: 'act-1', collection: 'crm', cibleId: PROP } as never] }) },
    { nom: 'action de l’IA menant à la fiche', cle: 'actionsIA', ajout: () => ({ actionsAgent: [{ id: 'act-2', collection: 'factures', cibleId: 'fm-x', lien: `/erp/proprietaires/${PROP}?onglet=factures` } as never] }) },
  ];
  for (const c of cas) {
    const d = { ...base, ...c.ajout(base) };
    const v = gerantProp(d);
    verifier(!v.ok && v.motif === 'historique' && v.historique.length === 1 && v.historique[0].cle === c.cle, `${c.nom} : refusé (${c.cle})`, v);
    verifier(!v.ok && v.motif === 'historique' && !v.accesOuvert, `${c.nom} : son accès est retiré, rien à retirer`);
    verifier(!v.ok && (c.cle === 'logements') === v.message.includes(PHRASE_LOGEMENTS_PROPRIETAIRE), `${c.nom} : « Rattachez d’abord ses logements » seulement avec un logement actuel`, !v.ok && v.message);
  }
  const neutres: { nom: string; ajout: Partial<ErpDonnees> }[] = [
    { nom: 'traces d’un autre propriétaire', ajout: { bilansProprietaire: [{ id: 'b', proprietaireId: 'pro-autre', statut: 'publie' } as never], dossiers: [{ id: 'd', proprietaireId: 'pro-autre', logementId: 'log-autre', recuLe: '2026-10-01', valeurs: {} }] } },
    { nom: 'action de l’IA vers une fiche au préfixe proche', ajout: { actionsAgent: [{ id: 'a9', cibleId: 'x', lien: `/erp/proprietaires/${PROP}-bis` } as never] } },
    { nom: 'logement d’un autre dont il n’a jamais été propriétaire', ajout: { logements: [{ id: 'l9', proprietaireId: 'pro-autre', proprietairesPrecedents: [{ proprietaireId: 'pro-tiers', jusquAu: '2026-01-01' }] } as never] } },
  ];
  for (const n of neutres) verifier(gerantProp({ ...base, ...n.ajout }).ok, `${n.nom} : ne bloque pas`);

  // Plusieurs traces : comptées et dites dans l'ordre ; « Rattachez d'abord… » avec les logements.
  const plein = {
    ...base,
    logements: [...base.logements, { id: 'l1', proprietaireId: PROP } as never, { id: 'l2', proprietaireId: PROP } as never],
    mandats: [...base.mandats, { id: 'm1', proprietaireId: PROP, statut: 'signe' } as never],
    bilansProprietaire: Array.from({ length: 3 }, (_, i) => ({ id: `b${i}`, proprietaireId: PROP, statut: 'publie' }) as never),
  };
  const v = gerantProp(plein);
  verifier(!v.ok && v.motif === 'historique' && resumeHistorique(v.historique) === '2 logements, 1 mandat et 3 bilans', 'résumé : « 2 logements, 1 mandat et 3 bilans »', v);
  verifier(!v.ok && v.message === `« Essai Dupont » a 2 logements, 1 mandat et 3 bilans : il ne peut pas être supprimé. ${PHRASE_LOGEMENTS_PROPRIETAIRE}`, 'message du store : résumé et marche à suivre', v);
}

section('Propriétaire : un accès encore ouvert bloque ; retiré, il part avec lui');
{
  const base = jeuProprietaire();
  for (const statut of ['invite', 'actif'] as const) {
    const d = { ...base, accesProprietaires: [{ ...base.accesProprietaires[0], statut, retireLe: undefined }] };
    const v = gerantProp(d);
    verifier(!v.ok && v.motif === 'acces' && /retirez-le d’abord, puis supprimez la fiche/.test(v.message), `accès ${statut} sans historique : refusé, « retirez-le d’abord »`, v);
    verifier(JSON.stringify(ops(d, supprimerProprietaireDe(d, PROP))) === JSON.stringify(['supprimer proprietaires/pro-essai', 'supprimer mandats/man-brouillon', 'supprimer recommandations/reco-essai'].sort()), `accès ${statut} : jamais retiré par le nettoyage (le verdict l’a refusé avant)`);
    const avecHistorique = { ...d, logements: [...d.logements, { id: 'l1', proprietaireId: PROP } as never] };
    const h = gerantProp(avecHistorique);
    verifier(!h.ok && h.motif === 'historique' && h.accesOuvert, `accès ${statut} ET historique : on dit l’historique, et que l’accès est ouvert (« Retirer l’accès »)`, h);
  }
  const sansAcces = { ...base, accesProprietaires: [base.accesProprietaires[1]] };
  const v = gerantProp(sansAcces);
  verifier(v.ok && v.avecLui.join() === 'son mandat en préparation', 'jamais invité : rien d’annoncé sur l’accès', v);
  verifier(accesOuvert({ statut: 'invite' }) && accesOuvert({ statut: 'actif' }) && !accesOuvert({ statut: 'retire' }) && !accesOuvert(undefined), 'accès ouvert : invité ou actif seulement');
}

/* ================================================================= membre */

const MEM = 'eq-essai';
const membre = (x: Partial<MembreEquipe> = {}): MembreEquipe => ({ id: MEM, nom: 'Essai Martin', role: 'agent', logementIds: ['log-a', 'log-b'], actif: true, ...x });

/** Jeu d'un espace : ce membre (fiche d'essai), un autre avec sa vie, qui suit quoi. */
function jeuMembre(): ErpDonnees {
  return {
    ...donneesVides(),
    logements: ['log-a', 'log-b', 'log-c', 'log-d'].map((id) => ({ id, nom: id.toUpperCase(), statut: 'actif' }) as never),
    equipe: [membre(), membre({ id: 'eq-autre', nom: 'Autre Durand', role: 'pole', logementIds: ['log-a', 'log-c', 'log-d'] })],
    affectations: [
      { id: 'log-a', responsableId: MEM, remplacantId: 'eq-autre' },
      { id: 'log-b', responsableId: MEM },
      { id: 'log-c', responsableId: 'eq-autre', remplacantId: MEM, pointsControle: ['Propreté'] },
      { id: 'log-d', remplacantId: MEM },
      { id: 'log-e', responsableId: 'eq-autre' },
    ],
    accesOperations: [
      { id: MEM, membreId: MEM, email: 'essai@exemple.invalid', statut: 'retire', inviteLe: '2026-10-01T10:00:00Z', invitePar: 'g', retireLe: '2026-10-02T10:00:00Z', version: 2, liens: [] },
      { id: 'eq-autre', membreId: 'eq-autre', email: 'autre@exemple.invalid', statut: 'actif', inviteLe: '2026-10-01T10:00:00Z', invitePar: 'g', version: 1, liens: [] },
    ],
    absences: [{ id: 'abs-autre', membreId: 'eq-autre', du: '2026-10-10', au: '2026-10-12' }],
    incidents: [{ id: 'inc-autre', logementId: 'log-c', assigneA: 'eq-autre', signalePar: 'eq-autre' } as never],
    controles: [{ id: 'ctl-autre', logementId: 'log-c', parId: 'eq-autre', statut: 'fait' } as never],
    signalementsLogement: [{ id: 'sig-autre', logementId: 'log-c', membreId: 'eq-autre', le: '2026-10-01T10:00:00+02:00', statut: 'ouvert' }],
    journal: [{ id: 'jrn-1', horodatage: '2026-10-01T10:00:00+02:00', auteur: 'Démo', action: 'Création', entite: 'membre', entiteId: MEM, details: '' }],
  };
}
const gerantMem = (d: ErpDonnees, id = MEM) => verdictSuppressionMembre({ role: 'gerant', membreId: id, donnees: d });

section('Membre sans historique : supprimé, avec sa place dans « qui suit quoi » et son ancien accès');
{
  const d = jeuMembre();
  const v = gerantMem(d);
  verifier(v.ok, 'verdict : permis', v);
  verifier(v.ok && v.avecLui.join() === 'son ancien accès', 'la confirmation dit l’ancien accès', v);
  const apres = supprimerMembreDe(d, MEM);
  verifier(apres.equipe.map((m) => m.id).join() === 'eq-autre', 'la fiche n’est plus là (ses logements avec), l’autre reste');
  verifier(apres.accesOperations.map((a) => a.id).join() === 'eq-autre', 'ancien accès parti avec lui ; celui de l’autre reste');
  verifier(
    JSON.stringify(apres.affectations) === JSON.stringify([{ id: 'log-a', remplacantId: 'eq-autre' }, { id: 'log-c', pointsControle: ['Propreté'], responsableId: 'eq-autre' }, { id: 'log-e', responsableId: 'eq-autre' }]),
    'affectations : plus responsable ni remplaçant ; celles qui ne disent plus rien sont retirées, les points de contrôle gardés',
    apres.affectations,
  );
  verifier(apres.absences === d.absences && apres.incidents === d.incidents && apres.controles === d.controles && apres.journal === d.journal, 'absences, incidents, contrôles, journal : intacts (mêmes listes)');
  verifier(
    JSON.stringify(ops(d, apres)) ===
      JSON.stringify(['supprimer equipe/eq-essai', 'supprimer accesOperations/eq-essai', 'ecrire affectations/log-a', 'supprimer affectations/log-b', 'ecrire affectations/log-c', 'supprimer affectations/log-d'].sort()),
    'enregistrement : exactement ces changements, rien d’autre n’est réécrit',
    ops(d, apres),
  );
  const seul = { ...donneesVides(), equipe: [membre()] };
  verifier(JSON.stringify(differences(seul, supprimerMembreDe(seul, MEM))) === JSON.stringify([{ type: 'supprimer', collection: 'equipe', id: MEM }]), 'fiche seule : une seule suppression');
  verifier(gerantMem(seul).ok && (gerantMem(seul) as { avecLui: string[] }).avecLui.length === 0, 'fiche seule, jamais invitée : rien d’autre n’est annoncé');
  verifier(differences(seul, supprimerMembreDe(seul, 'inconnu')).length === 0, 'membre inconnu : rien ne change');
}

section('Membre : chaque trace d’historique refuse la suppression');
{
  const base = jeuMembre();
  const cas: { nom: string; cle: CleHistoriqueMembre; ajout: (d: ErpDonnees) => Partial<ErpDonnees> }[] = [
    { nom: 'incident confié', cle: 'incidents', ajout: (d) => ({ incidents: [...d.incidents, { id: 'i1', logementId: 'log-a', assigneA: MEM, statut: 'resolu' } as never] }) },
    { nom: 'incident signalé', cle: 'incidents', ajout: (d) => ({ incidents: [...d.incidents, { id: 'i2', logementId: 'log-a', signalePar: MEM } as never] }) },
    { nom: 'contrôle qualité fait', cle: 'controles', ajout: (d) => ({ controles: [...d.controles, { id: 'c1', logementId: 'log-a', parId: MEM, statut: 'fait' } as never] }) },
    { nom: 'absence (même annulée)', cle: 'absences', ajout: (d) => ({ absences: [...d.absences, { id: 'a1', membreId: MEM, du: '2026-10-01', au: '2026-10-02', annuleeLe: '2026-09-30T10:00:00Z' }] }) },
    { nom: 'remplaçant d’une absence', cle: 'absences', ajout: (d) => ({ absences: [...d.absences, { id: 'a2', membreId: 'eq-autre', remplacantId: MEM, du: '2026-11-01', au: '2026-11-02' }] }) },
    { nom: 'absence notée par lui (pôle)', cle: 'absences', ajout: (d) => ({ absences: [...d.absences, { id: 'a3', membreId: 'eq-autre', parMembreId: MEM, du: '2026-11-01', au: '2026-11-02' }] }) },
    { nom: '« pas à moi » ouvert', cle: 'signalements', ajout: (d) => ({ signalementsLogement: [...d.signalementsLogement, { id: 's1', logementId: 'log-a', membreId: MEM, le: '2026-10-01T10:00:00+02:00', statut: 'ouvert' }] }) },
    { nom: '« pas à moi » traité', cle: 'signalements', ajout: (d) => ({ signalementsLogement: [...d.signalementsLogement, { id: 's2', logementId: 'log-a', membreId: MEM, le: '2026-10-01T10:00:00+02:00', statut: 'traite', decision: 'retire' }] }) },
    { nom: 'action de l’IA ciblant la fiche', cle: 'actionsIA', ajout: () => ({ actionsAgent: [{ id: 'act-1', collection: 'missions', cibleId: MEM } as never] }) },
    { nom: 'action de l’IA menant à la fiche', cle: 'actionsIA', ajout: () => ({ actionsAgent: [{ id: 'act-2', collection: 'missions', cibleId: 'm-x', lien: `/erp/parametres/acces?personne=${MEM}` } as never] }) },
  ];
  for (const c of cas) {
    const d = { ...base, ...c.ajout(base) };
    const v = gerantMem(d);
    verifier(!v.ok && v.motif === 'historique' && v.historique.length === 1 && v.historique[0].cle === c.cle, `${c.nom} : refusé (${c.cle})`, v);
    verifier(!v.ok && v.motif === 'historique' && v.dansLEquipe && v.message.endsWith(PHRASE_RETIRER_DE_LEQUIPE), `${c.nom} : dans l’équipe, le refus propose « Retirer de l’équipe »`, !v.ok && v.message);
    const hors = { ...d, equipe: d.equipe.map((m) => (m.id === MEM ? { ...m, actif: false } : m)) };
    const h = gerantMem(hors);
    verifier(!h.ok && h.motif === 'historique' && !h.dansLEquipe && h.message.endsWith(PHRASE_DEJA_HORS_EQUIPE), `${c.nom} : déjà hors de l’équipe, le refus le dit`, !h.ok && h.message);
  }
  const neutres: { nom: string; ajout: Partial<ErpDonnees> }[] = [
    { nom: 'ménages et linge (prestataires, aucun membre)', ajout: { missions: [{ id: 'm1', logementId: 'log-a', type: 'menage', prestataireId: 'pre-1' } as never], mouvementsLinge: [{ id: 'lin-1', logementId: 'log-a', prestataireId: 'pre-1' } as never] } },
    { nom: 'action de l’IA vers une fiche au préfixe proche', ajout: { actionsAgent: [{ id: 'a9', cibleId: 'x', lien: `/erp/parametres/acces?personne=${MEM}-bis` } as never] } },
    { nom: 'affectations et logements suivis (ils partent avec lui)', ajout: {} },
  ];
  for (const n of neutres) verifier(gerantMem({ ...base, ...n.ajout }).ok, `${n.nom} : ne bloque pas`);
  const plein = {
    ...base,
    incidents: [...base.incidents, ...Array.from({ length: 4 }, (_, i) => ({ id: `i${i}`, logementId: 'log-a', assigneA: MEM }) as never)],
    controles: [...base.controles, { id: 'c9', logementId: 'log-a', parId: MEM } as never],
    absences: [...base.absences, { id: 'a9', membreId: MEM, du: '2026-10-01', au: '2026-10-02' }],
  };
  const v = gerantMem(plein);
  verifier(!v.ok && v.motif === 'historique' && resumeHistorique(v.historique) === '4 incidents, 1 contrôle qualité et 1 absence', 'résumé : « 4 incidents, 1 contrôle qualité et 1 absence »', v);
}

section('Membre : un accès encore ouvert bloque ; retiré, il part avec lui');
{
  const base = jeuMembre();
  for (const statut of ['invite', 'actif'] as const) {
    const d = { ...base, accesOperations: [{ ...base.accesOperations[0], statut, retireLe: undefined }, base.accesOperations[1]] };
    const v = gerantMem(d);
    verifier(!v.ok && v.motif === 'acces' && /retirez-le d’abord, puis supprimez la fiche/.test(v.message), `accès ${statut} sans historique : refusé, « retirez-le d’abord »`, v);
    verifier(supprimerMembreDe(d, MEM).accesOperations.length === 2, `accès ${statut} : jamais retiré par le nettoyage (le verdict l’a refusé avant)`);
    const h = gerantMem({ ...d, controles: [...d.controles, { id: 'c1', logementId: 'log-a', parId: MEM } as never] });
    verifier(!h.ok && h.motif === 'historique' && h.dansLEquipe, `accès ${statut} ET historique : on dit l’historique (« Retirer de l’équipe »)`, h);
  }
  const jamaisInvite = { ...base, accesOperations: [base.accesOperations[1]] };
  verifier(gerantMem(jamaisInvite).ok && (gerantMem(jamaisInvite) as { avecLui: string[] }).avecLui.length === 0, 'jamais invité : rien d’annoncé sur l’accès');
}

section('Droits : un gérant, jamais en lecture seule ; suppressions réservées par la base');
{
  const dp = jeuProprietaire();
  const dm = jeuMembre();
  for (const role of ['operations', 'lecture', 'prestataire', undefined]) {
    const vp = verdictSuppressionProprietaire({ role, proprietaireId: PROP, donnees: dp });
    const vm = verdictSuppressionMembre({ role, membreId: MEM, donnees: dm });
    verifier(!vp.ok && vp.motif === 'droits' && !vm.ok && vm.motif === 'droits', `rôle ${role ?? 'inconnu'} : refusé pour les deux`, [vp, vm]);
  }
  const lp = verdictSuppressionProprietaire({ role: 'gerant', lectureSeule: true, proprietaireId: PROP, donnees: dp });
  const lm = verdictSuppressionMembre({ role: 'gerant', lectureSeule: true, membreId: MEM, donnees: dm });
  verifier(!lp.ok && lp.motif === 'droits' && !lm.ok && lm.motif === 'droits', 'gérant en lecture seule : refusé pour les deux');
  verifier(peutSupprimerPersonne('gerant') && !peutSupprimerPersonne('gerant', true) && !peutSupprimerPersonne('operations'), 'bouton : gérant seulement, hors lecture seule');
  const ip = gerantProp(dp, 'pro-disparu');
  const im = gerantMem(dm, 'eq-disparu');
  verifier(!ip.ok && ip.motif === 'introuvable' && !im.ok && im.motif === 'introuvable', 'propriétaire ou membre disparu entre-temps : refusé', [ip, im]);

  verifier(SUPPRESSIONS_GERANT_SEULEMENT.includes('proprietaires') && SUPPRESSIONS_GERANT_SEULEMENT.includes('equipe'), 'proprietaires et equipe dans SUPPRESSIONS_GERANT_SEULEMENT');
  verifier(operationReserveeAuGerant({ type: 'supprimer', collection: 'proprietaires', id: PROP }, dp), 'suppression d’un propriétaire : réservée au gérant (écartée avant l’envoi pour les autres)');
  verifier(operationReserveeAuGerant({ type: 'supprimer', collection: 'equipe', id: MEM }, dm), 'suppression d’un membre : réservée au gérant');
  verifier(!operationReserveeAuGerant({ type: 'ecrire', collection: 'proprietaires', id: PROP, donnees: { ...proprietaire(), nom: 'Renommé' } }, dp), 'modifier une fiche propriétaire reste permis à l’équipe');
  verifier(!operationReserveeAuGerant({ type: 'ecrire', collection: 'equipe', id: MEM, donnees: { ...membre(), nom: 'Renommé' } }, dm), 'modifier une fiche membre reste permis à l’équipe');
  verifier(!operationReserveeAuGerant({ type: 'supprimer', collection: 'affectations', id: 'log-b' }, dm), 'retirer une affectation reste permis à l’équipe');
}

section('Un espace à la fois : seules les données de l’espace ouvert comptent');
{
  const ici = jeuProprietaire();
  const ailleurs = { ...jeuProprietaire(), logements: [{ id: 'l-ailleurs', proprietaireId: PROP } as never] };
  verifier(gerantProp(ici).ok && !gerantProp(ailleurs).ok, 'même id dans un autre espace : chacun son verdict, sur ses données');
  const avant = JSON.stringify(ailleurs);
  supprimerProprietaireDe(ici, PROP);
  supprimerMembreDe(jeuMembre(), MEM);
  verifier(JSON.stringify(ailleurs) === avant, 'supprimer ici ne change rien au jeu de l’autre espace');
  verifier(historiqueDuProprietaire(PROP, {}).length === 0 && historiqueDuMembre(MEM, {}).length === 0, 'données absentes : aucune trace (pas d’erreur)');
}

section('Démonstration : chaque propriétaire et chaque membre de la démo a un historique ou un accès (refus montré tel quel)');
{
  // La démo n'a pas de fiche « créée par erreur » : les captures en ajoutent une dans le navigateur.
  const d = completer(creerSeed());
  const proprietaires = d.proprietaires.map((p) => ({ p, v: gerantProp(d, p.id) }));
  verifier(proprietaires.length > 0 && proprietaires.every((x) => !x.v.ok), 'propriétaires de la démo : suppression refusée', proprietaires.map((x) => `${x.p.id}: ${x.v.ok ? 'ok' : x.v.motif}`));
  for (const x of proprietaires.slice(0, 3)) if (!x.v.ok && x.v.motif === 'historique') console.log(`  ${x.p.nom} : ${resumeHistorique(x.v.historique)}${x.v.accesOuvert ? ' · accès ouvert' : ''}`);
  const membres = d.equipe.map((m) => ({ m, v: gerantMem(d, m.id) }));
  verifier(membres.length > 0 && membres.every((x) => !x.v.ok), 'membres de la démo : suppression refusée', membres.map((x) => `${x.m.id}: ${x.v.ok ? 'ok' : x.v.motif}`));
  for (const x of membres) console.log(`  ${x.m.nom} : ${x.v.ok ? 'permis' : x.v.motif === 'historique' ? resumeHistorique(x.v.historique) : x.v.motif}`);
}

// Modules de Node chargés à l'exécution (l'ERP n'a pas les types de Node).
async function fichiersSql() {
  section('Base : suppressions réservées au gérant et déclencheurs, dans les trois fichiers SQL');
  const nomFs = 'node:fs';
  const fs = (await import(/* @vite-ignore */ nomFs)) as { existsSync(p: string): boolean; readFileSync(p: string, e: 'utf8'): string };
  const racine = (globalThis as { process?: { cwd(): string } }).process!.cwd();
  const lire = (f: string) => (fs.existsSync(`${racine}/${f}`) ? fs.readFileSync(`${racine}/${f}`, 'utf8') : '');
  const corpsDe = (sql: string, fonction: string) => new RegExp(`create or replace function erp\\.${fonction}\\(\\)[\\s\\S]*?\\$\\$([\\s\\S]*?)\\$\\$`).exec(sql)?.[1] ?? '';
  for (const fichier of ['supabase/erp-espaces.sql', 'supabase/erp-installation.sql', 'supabase/erp-acces-gerants.sql']) {
    const sql = lire(fichier);
    verifier(!!sql, `${fichier} : lu (lancer depuis la racine du dépôt)`);
    const regle = /create policy "ecritures reservees aux gerants \(suppression\)"[\s\S]*?;/.exec(sql)?.[0] ?? '';
    const liste = [...(/collection not in \(([^)]*)\)/.exec(regle)?.[1] ?? '').matchAll(/'([^']*)'/g)].map((m) => m[1]).sort();
    verifier(JSON.stringify(liste) === JSON.stringify([...SUPPRESSIONS_GERANT_SEULEMENT].sort()), `${fichier} : mêmes suppressions réservées que ecritures-gerant.ts`, liste);

    const prop = corpsDe(sql, 'garder_proprietaire_avec_historique');
    verifier(!!prop && sql.includes("for each row when (old.collection = 'proprietaires') execute function erp.garder_proprietaire_avec_historique();"), `${fichier} : déclencheur erp.garder_proprietaire_avec_historique sur les propriétaires`);
    for (const attendu of ["'logements'", "'proprietairesPrecedents'", "'factures'", "'bilansProprietaire'", "'documentsProprietaire'", "'dossiers'", "'relancesPaiement'", "'mandats'", "'brouillon'", "'recommandations'", "'a_proposer'", "'accesProprietaires'", "in ('invite', 'actif')", "'actionsAgent'", "'/erp/proprietaires/'", "errcode = '42501'"]) {
      verifier(prop.includes(attendu), `${fichier} : le déclencheur propriétaire regarde ${attendu}`);
    }
    const mem = corpsDe(sql, 'garder_membre_avec_historique');
    verifier(!!mem && sql.includes("for each row when (old.collection = 'equipe') execute function erp.garder_membre_avec_historique();"), `${fichier} : déclencheur erp.garder_membre_avec_historique sur l’équipe`);
    for (const attendu of ["'accesOperations'", "'membreId'", "in ('invite', 'actif')", "'incidents'", "'assigneA'", "'signalePar'", "'controles'", "'parId'", "'absences'", "'remplacantId'", "'parMembreId'", "'signalementsLogement'", "'actionsAgent'", "'/erp/parametres/acces?personne='", "errcode = '42501'"]) {
      verifier(mem.includes(attendu), `${fichier} : le déclencheur membre regarde ${attendu}`);
    }
    for (const corps of [prop, mem]) verifier(corps.includes("current_user <> 'authenticated'"), `${fichier} : déclencheur limité au rôle authenticated (la maintenance n’est pas concernée)`);
    const parEspace = fichier === 'supabase/erp-espaces.sql';
    verifier((prop.includes('e.espace = old.espace') && mem.includes('e.espace = old.espace')) === parEspace, `${fichier} : ${parEspace ? 'limité à l’espace de la personne' : 'sans colonne espace (version d’avant les espaces)'}`);
  }
  const espaces = lire('supabase/erp-espaces.sql');
  const acces = lire('supabase/erp-acces-gerants.sql');
  for (const cas of [
    'un compte « opérations » supprime un propriétaire',
    "un compte « opérations » supprime un membre de l''équipe",
    'un gérant ne supprime pas un propriétaire sans historique',
    "un gérant ne supprime pas un membre de l''équipe sans historique",
    "un propriétaire ou un membre supprimé ne reste pas dans l''historique",
    'un gérant supprime un propriétaire qui a un logement',
    "un gérant supprime un propriétaire dont l''accès est encore ouvert",
    'un gérant supprime un membre qui a fait un contrôle',
    "un gérant supprime un membre dont l''accès est encore ouvert",
  ]) {
    verifier(espaces.includes(cas) && acces.includes(cas), `recettes (erp-espaces.sql, erp-acces-gerants.sql) : « ${cas.replace(/''/g, '’')} »`);
  }
  verifier(espaces.includes("le gérant d''un autre espace supprime un propriétaire de Label Maison") && espaces.includes("un logement de Label Maison empêche de supprimer un propriétaire d''un autre espace"), 'erp-espaces.sql : la recette vérifie la cloison des espaces pour les propriétaires');
  verifier(espaces.includes('erp.garder_proprietaire_avec_historique(), erp.garder_membre_avec_historique()'), 'erp-espaces.sql : les deux fonctions sont dans la liste de retour arrière (commentaire de fin)');

  section('Écrans et store : textes et ordre des contrôles');
  const ecranProp = lire('src/erp/modules/logements/_composants/SupprimerProprietaire.tsx');
  verifier(
    /label="Supprimer le propriétaire"/.test(ecranProp) && /Impossible de supprimer « \$\{p\.nom\} »/.test(ecranProp) && /Retirer l’accès/.test(ecranProp) && /phraseConfirmation\(verdict\.avecLui\)/.test(ecranProp) && ecranProp.includes('PHRASE_LOGEMENTS_PROPRIETAIRE'),
    'propriétaire : corbeille, refus, « Retirer l’accès », « Rattachez d’abord ses logements », phrase de confirmation commune',
  );
  verifier(/const RETOUR = '\/erp\/parametres\/acces';[\s\S]*naviguer\(RETOUR, \{ state: \{ message: `« \$\{nom\} » a été supprimé\.` \} \}\);\n\s*onSupprime\?\.\(\);/.test(ecranProp), 'propriétaire : retour à Paramètres → Accès avec le message « « Nom » a été supprimé. », le panneau fermé');
  // Le module Propriétaires est sorti du menu (/erp/proprietaires redirige vers les logements) : le propriétaire se gère
  // dans le panneau « Espace propriétaire », ouvert par « Gérer » dans Paramètres → Accès (sans logement) ou depuis la fiche d'un logement.
  verifier(
    /actions=\{!logement \? <SupprimerProprietaire proprietaire=\{p\} size="sm" onSupprime=\{onFermer\} \/> : undefined\}/.test(lire('src/erp/modules/logements/_composants/EspaceProprietaireGerant.tsx')),
    'propriétaire : la corbeille est en haut à droite du panneau « Espace propriétaire », seulement depuis Paramètres → Accès',
  );
  verifier(/coin=\{peutSupprimerPersonne\(d\.utilisateur\.role, d\.lectureSeule\) \? <SupprimerProprietaire proprietaire=\{p\} \/> : undefined\}/.test(lire('src/erp/modules/proprietaires/DetailProprietaire.tsx')), 'ancienne fiche propriétaire (hors menu) : la corbeille est dans le coin de l’en-tête, gérant seulement');
  const ecranMem = lire('src/erp/modules/parametres/SupprimerMembre.tsx');
  verifier(/label="Supprimer la fiche"/.test(ecranMem) && /Impossible de supprimer « \$\{m\.nom\} »/.test(ecranMem) && /Retirer de l’équipe/.test(ecranMem) && /Retirer l’accès/.test(ecranMem) && /Plus personne ne suivra/.test(ecranMem), 'tiroir du membre : corbeille, refus, « Retirer de l’équipe », « Retirer l’accès », logements sans personne');
  verifier(/naviguer\('\/erp\/parametres\/acces', \{ state: \{ message: `« \$\{nom\} » a été supprimé\.` \} \}\)/.test(ecranMem), 'tiroir du membre : retour à la liste des responsables avec le message');
  verifier(/affectationsSans\(d\.donnees\.affectations, m\.id, m\.logementIds\)/.test(ecranMem), 'tiroir du membre : « Retirer de l’équipe » retire aussi sa place dans « qui suit quoi », comme l’interrupteur');
  verifier(/actions=\{gerant \? <SupprimerMembre membre=\{m\} onRetirerAcces=\{retirer\}/.test(lire('src/erp/modules/parametres/Acces.tsx')), 'tiroir du membre : la corbeille est en haut à droite du tiroir, gérant seulement, avec le geste « Retirer l’accès » du tiroir');
  const store = lire('src/erp/data/store.tsx');
  verifier(/const supprimerProprietaire = [\s\S]*?verdictSuppressionProprietaire\([\s\S]*?if \(!verdict\.ok\) return echec[\s\S]*?supprimerProprietaireDe[\s\S]*?'Propriétaire supprimé', 'proprietaire', id, nom\)/.test(store), 'store : verdict avant la suppression du propriétaire ; journal « Propriétaire supprimé » avec le nom seulement');
  verifier(/const supprimerMembre = [\s\S]*?verdictSuppressionMembre\([\s\S]*?if \(!verdict\.ok\) return echec[\s\S]*?supprimerMembreDe[\s\S]*?'Membre supprimé', 'membre', id, nom\)/.test(store), 'store : verdict avant la suppression du membre ; journal « Membre supprimé » avec le nom seulement');
  verifier(/Supprimer un propriétaire ou un membre de l'équipe/.test(lire('docs/erp/README.md')), 'README : le paragraphe est là');
}

void fichiersSql().then(() => {
  console.log(`\n${reussis} contrôles réussis, ${echecs} en échec.`);
  (globalThis as { process?: { exitCode?: number } }).process!.exitCode = echecs ? 1 : 0;
});
