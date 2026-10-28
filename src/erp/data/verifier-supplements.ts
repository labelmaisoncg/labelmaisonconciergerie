/**
 * Auto-contrôle des suppléments (cahier B7), sans réseau :
 *   - réglages : lecture tolérante (éteints par défaut, jamais allumés sans
 *     prix lisible), heures et prix contrôlés, écriture réservée au gérant
 *     (navigateur et les trois fichiers SQL, avec leurs recettes) ;
 *   - disponibilité sur les réservations (départ ou arrivée le même jour qui
 *     bloque, « selon le planning » ou à vérifier, annulées ignorées) et les
 *     ménages prévus ;
 *   - proposition : texte au ton de la marque, prix réglé, français ou
 *     anglais, jamais de lien de paiement ; message automatique : seulement
 *     les suppléments possibles ;
 *   - l'agent IA ne vend jamais seul un supplément : verdict « à valider » à
 *     tous les niveaux d'autonomie (demande lue par l'IA, mots du voyageur
 *     sous la forme d'une demande et encore sans réponse, réponse qui accorde
 *     un supplément ou une heure hors des horaires, réponse à « Proposer les
 *     suppléments »), argent transmis ; les questions simples partent
 *     seules ; passage complet simulé (faux Claude, fausse base, fausse
 *     plateforme) : rien ne part ;
 *   - message automatique « Proposer les suppléments » : éteint par défaut,
 *     3 jours avant l'arrivée, seulement les logements qui en proposent,
 *     passage simulé (le supplément bloqué par le planning n'est pas cité,
 *     rien de possible : pas envoyé, moment gardé sur le message) ; un « Non
 *     merci » ne retient pas les infos d'arrivée, une vraie demande oui ;
 *   - aucun paiement, aucune écriture vers les plateformes.
 *
 * Lancement (Node 18+, depuis la racine du dépôt) :
 *   node_modules/.bin/esbuild src/erp/data/verifier-supplements.ts --bundle --platform=node --format=esm \
 *     --define:import.meta.env='{"VITE_ERP_DEMO":"1"}' --log-level=error --outfile=/tmp/verifier-supplements.mjs \
 *     && node /tmp/verifier-supplements.mjs
 */
import type Anthropic from '@anthropic-ai/sdk';
import { lancerAgent, type ClientIA, type OptionsAgent } from './agent-messagerie';
import { CONSIGNES_CONTROLE } from './controle-reponse';
import { ecritureGerantSeulement, operationReserveeAuGerant } from './ecritures-gerant';
import { attendEquipe } from './attente-equipe';
import {
  MOTIF_REPONSE_PROPOSITION,
  MOTIF_SUPPLEMENT,
  apresPropositionSupplements,
  explicationNiveau,
  messagesVerdict,
  offreSupplement,
  politiqueEnvoi,
  reponseSansDemandeAuxSupplements,
  sujetSensible,
  sujetSensibleMessages,
  supplementDansTexte,
  verdictEnvoi,
  type DecisionNotee,
} from './messagerie-ia';
import {
  COLLECTION_ENVOIS_PROGRAMMES,
  DECLENCHEURS,
  JOURS_AVANT_SUPPLEMENTS,
  LIBELLES_DECLENCHEURS,
  PAR_MESSAGE_AUTO,
  RAISONS,
  TEXTES_DEFAUT,
  VARIABLES,
  deciderEnvoi,
  fenetreEnvoi,
  idEnvoi,
  instantParis,
  reglagesProgrammes,
  rendreMessage,
  texteAffiche,
  texteStocke,
} from './messages-programmes';
import { lancerProgrammes, type OptionsProgrammes } from './passage-programmes';
import { REGLAGES_AGENT_DEFAUT } from './reglages';
import { BaseErp, ecritureRepullPermise } from './repull-synchro';
import { creerSeed } from './seed';
import {
  CLES_SUPPLEMENTS,
  ID_REGLAGES_SUPPLEMENTS,
  aDesSupplements,
  avecReglagesLogement,
  disponibiliteSupplement,
  erreursReglage,
  ligneSupplement,
  prixLisible,
  reglagesSupplements,
  supplementDemande,
  supplementsActifs,
  supplementsDuLogement,
  texteProposition,
  texteSupplementsSejour,
  type ReglageSupplement,
  type ReglagesSupplements,
} from './supplements';
import type { FilMessages, Logement, Message, Mission, ReglagesAgent, Reservation } from './types';
import type { EnvoiProgramme, ReglagesMessagesProgrammes } from './types-programmes';

let echecs = 0;
let reussis = 0;
function verifier(condition: unknown, message: string, detail?: unknown) {
  if (condition) reussis++;
  else {
    echecs++;
    console.error(`  ✗ ${message}${detail === undefined ? '' : ` : ${JSON.stringify(detail).slice(0, 500)}`}`);
  }
}
function section(titre: string) {
  console.log(`\n${titre}`);
}
const json = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status, headers: { 'Content-Type': 'application/json' } });

type Fs = { readFileSync: (p: string, e: string) => string; existsSync: (p: string) => boolean };
type Chemins = { join: (...p: string[]) => string; dirname: (p: string) => string };
let fs: Fs;
let chemins: Chemins;
let racine = '';
const source = (f: string) => (racine ? fs.readFileSync(chemins.join(racine, f), 'utf8') : '');

/* -------------------------------------------------------------- données */

const LOGEMENT: Logement = {
  id: 'log-1',
  nom: 'Corbeil Rives de Seine',
  adresse: '',
  ville: 'Corbeil-Essonnes',
  codePostal: '91100',
  type: 'T2',
  surfaceM2: 40,
  capacite: 4,
  chambres: 1,
  lits: [],
  statut: 'actif',
  proprietaireId: 'p1',
  residencePrincipale: false,
  serrure: 'boite_a_cles',
  fiche: { wifiNom: 'LM-Corbeil', wifiCode: 'soleil2026', heureArrivee: '16:00', heureDepart: '11:00', acces: 'Boîte à clés 4821.', parking: 'Rue', regles: 'Pas de fête.', equipements: ['Lave-linge'] },
  dotationLinge: [],
  annonces: [],
  checklistLancement: [],
  repull: { id: '201' },
};
const AUTRE: Logement = { ...LOGEMENT, id: 'log-2', nom: 'Studio sans supplément', repull: { id: '202' } };

function resa(id: string, p: Partial<Reservation> = {}): Reservation {
  return {
    id,
    logementId: 'log-1',
    canal: 'airbnb',
    voyageur: { nom: 'Emily Carter', nbPersonnes: 2 },
    arrivee: '2026-10-29',
    depart: '2026-11-01',
    nuits: 3,
    statut: 'confirmee',
    montantBrutCentimes: 30000,
    commissionPlateformeCentimes: 3000,
    fraisMenageCentimes: 4000,
    ...p,
  };
}
const msg = (id: string, auteur: Message['auteur'], texte: string, envoyeLe = '2026-10-20T10:00:00+02:00'): Message => ({ id, auteur, texte, envoyeLe });
function fil(id: string, reservationId: string, p: Partial<FilMessages> = {}): FilMessages {
  return {
    id,
    reservationId,
    logementId: 'log-1',
    canal: 'airbnb',
    voyageur: 'Emily Carter',
    statut: 'ouvert',
    messages: [msg(`${id}-m1`, 'voyageur', 'Hello, we arrive on Thursday.'), msg(`${id}-m2`, 'agent', 'Wonderful, see you on Thursday!', '2026-10-20T10:05:00+02:00')],
    dernierMessageLe: '2026-10-20T10:05:00+02:00',
    traitePar: 'agent',
    repull: { id: id.replace(/\D/g, '') || '9' },
    ...p,
  };
}
const mission = (date: string, p: Partial<Mission> = {}): Mission => ({
  id: `m-${date}`,
  type: 'menage',
  logementId: 'log-1',
  date,
  heureDebut: '11:00',
  heureFinMax: '15:00',
  statut: 'attribuee',
  checklist: [],
  photos: [],
  tarifCentimes: 3500,
  controleQualite: false,
  ...p,
});

const regle = (p: Partial<ReglageSupplement> = {}): ReglageSupplement => ({ actif: true, prixCentimes: 2000, heure: '12:00', selonPlanning: true, ...p });

/* ------------------------------------------------------ fausses API */

class FausseBase {
  lignes = new Map<string, { collection: string; id: string; donnees: unknown; maj: number }>();
  private n = 0;
  cle = (c: string, id: string) => `${c}\u0000${id}`;
  fetch = async (entree: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(typeof entree === 'string' ? entree : entree instanceof URL ? entree.href : entree.url);
    const methode = (init?.method ?? 'GET').toUpperCase();
    const eq = (k: string) => (url.searchParams.get(k) ?? '').replace(/^eq\./, '');
    if (methode === 'GET') {
      const collection = eq('collection');
      const filtre = url.searchParams.get('id');
      const ids = filtre ? new Set(filtre.replace(/^in\.\(|\)$/g, '').split(',').map((x) => x.replace(/^"|"$/g, ''))) : null;
      const offset = Number(url.searchParams.get('offset') ?? 0);
      return json(
        [...this.lignes.values()]
          .filter((l) => l.collection === collection && (!ids || ids.has(l.id)))
          .sort((a, b) => a.id.localeCompare(b.id))
          .slice(offset, offset + 1000)
          .map((l) => ({ id: l.id, donnees: JSON.parse(JSON.stringify(l.donnees)), maj_le: String(l.maj) })),
      );
    }
    if (methode === 'PATCH') {
      const l = this.lignes.get(this.cle(eq('collection'), eq('id')));
      if (!l || String(l.maj) !== eq('maj_le')) return json([]);
      l.donnees = JSON.parse(JSON.stringify((JSON.parse(String(init?.body)) as { donnees: unknown }).donnees));
      l.maj = ++this.n;
      return json([{ id: l.id }]);
    }
    const lot = JSON.parse(String(init?.body)) as { collection: string; id: string; donnees: unknown }[];
    if (/ignore-duplicates/.test(new Headers(init?.headers).get('prefer') ?? '')) {
      const ajoutees = lot.filter((l) => !this.lignes.has(this.cle(l.collection, l.id)));
      for (const l of ajoutees) this.lignes.set(this.cle(l.collection, l.id), { collection: l.collection, id: l.id, donnees: JSON.parse(JSON.stringify(l.donnees)), maj: ++this.n });
      return json(ajoutees.map((l) => ({ id: l.id })));
    }
    for (const l of lot) this.lignes.set(this.cle(l.collection, l.id), { collection: l.collection, id: l.id, donnees: JSON.parse(JSON.stringify(l.donnees)), maj: ++this.n });
    return new Response(null, { status: 201 });
  };
  get<T>(c: string, id: string): T | undefined {
    return this.lignes.get(this.cle(c, id))?.donnees as T | undefined;
  }
  poser<T extends { id: string }>(c: string, e: T) {
    this.lignes.set(this.cle(c, e.id), { collection: c, id: e.id, donnees: JSON.parse(JSON.stringify(e)), maj: ++this.n });
  }
}

/** Fausse plateforme : envoi de messages seulement (compté) ; tout autre appel en écriture est noté. */
class FauxRepull {
  envois: { conversation: string; message: string }[] = [];
  ecritures: string[] = [];
  fetch = async (entree: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(typeof entree === 'string' ? entree : entree instanceof URL ? entree.href : entree.url);
    const methode = (init?.method ?? 'GET').toUpperCase();
    const m = /^\/v1\/conversations\/([^/]+)\/messages$/.exec(url.pathname);
    if (m && methode === 'POST') {
      const corps = JSON.parse(String(init?.body)) as { message: string };
      this.envois.push({ conversation: m[1], message: corps.message });
      return json({ id: String(900000 + this.envois.length), conversationId: Number(m[1]), channel: 'airbnb', status: 'sent', contentRewritten: false, deliveredContent: corps.message });
    }
    if (methode !== 'GET') this.ecritures.push(`${methode} ${url.pathname}`);
    return json({ data: [], pagination: { hasMore: false, nextCursor: null } });
  };
}

class FausseIA implements ClientIA {
  appels = 0;
  reponses: Record<string, unknown>[] = [];
  messages = {
    create: async (p: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message> => {
      // Second contrôle (controle-reponse.ts) : rien à signaler.
      const texte =
        p.system === CONSIGNES_CONTROLE
          ? JSON.stringify({ engage: false, argent: false, exception: false, donneesPerso: false })
          : JSON.stringify(this.reponses.shift() ?? { action: 'transmettre', raison: 'autre', langue: 'fr', texte: '', resume: '' });
      if (p.system !== CONSIGNES_CONTROLE) this.appels++;
      return { id: 'msg', type: 'message', role: 'assistant', model: p.model, content: [{ type: 'text', text: texte, citations: null }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 500, output_tokens: 80 } } as unknown as Anthropic.Message;
    },
  };
}

const decision = (x: Record<string, unknown>) => ({ action: 'repondre', raison: 'aucune', langue: 'en', texte: '', resume: '', guides: [], intention: 'infos', sentiment: 'neutre', confiance: 0.99, texte_fr: '', ...x });

/* ================================================================ contrôles */

async function principal() {
  // Fichiers du dépôt (Node seulement ; noms en variables : rien n'entre dans le lot du site).
  const proc = (globalThis as { process?: { versions?: { node?: string }; cwd(): string } }).process;
  if (proc?.versions?.node) {
    const nomFs = 'node:fs';
    const nomChemins = 'node:path';
    fs = (await import(/* @vite-ignore */ nomFs)) as unknown as Fs;
    chemins = (await import(/* @vite-ignore */ nomChemins)) as unknown as Chemins;
    let dossier = proc.cwd();
    for (let i = 0; i < 6 && !fs.existsSync(chemins.join(dossier, 'package.json')); i++) dossier = chemins.dirname(dossier);
    racine = fs.existsSync(chemins.join(dossier, 'src/erp/data/supplements.ts')) ? dossier : '';
  }

  section('1. Réglages : éteints par défaut, lecture tolérante, gérant seulement');
  {
    const vide = reglagesSupplements({ reglages: [] });
    verifier(CLES_SUPPLEMENTS.join() === 'arrivee_anticipee,depart_tardif,menage_supplementaire,navette', 'quatre suppléments : arrivée plus tôt, départ plus tard, ménage, navette');
    verifier(CLES_SUPPLEMENTS.every((k) => !supplementsDuLogement(vide, 'log-1')[k].actif) && !aDesSupplements(vide, 'log-1'), 'sans réglage : rien n’est proposé');
    const lu = reglagesSupplements({
      reglages: [
        {
          id: ID_REGLAGES_SUPPLEMENTS,
          logements: {
            'log-1': {
              arrivee_anticipee: { actif: true, prixCentimes: 2000, heure: '25:99' },
              depart_tardif: { actif: true, prixCentimes: -5 },
              menage_supplementaire: { actif: 'oui', prixCentimes: 4500 },
              navette: { actif: true, prixCentimes: 3000.5 },
            },
          },
        } as unknown as ReglagesSupplements,
      ],
    });
    const s = supplementsDuLogement(lu, 'log-1');
    verifier(s.arrivee_anticipee.actif && s.arrivee_anticipee.heure === '12:00' && s.arrivee_anticipee.selonPlanning === true, 'heure illisible : heure par défaut ; « selon le planning » par défaut');
    verifier(!s.depart_tardif.actif && !s.navette.actif, 'prix négatif ou pas en centimes entiers : jamais proposé (pas de prix faux)');
    verifier(!s.menage_supplementaire.actif, 'allumé seulement si c’est écrit noir sur blanc (true)');
    verifier(supplementsActifs(lu, 'log-1').join() === 'arrivee_anticipee', 'suppléments allumés lus dans l’ordre');
    const f = LOGEMENT.fiche;
    verifier(erreursReglage('arrivee_anticipee', regle({ heure: '16:00' }), f).length === 1 && !erreursReglage('arrivee_anticipee', regle({ heure: '12:00' }), f).length, 'arrivée plus tôt : l’heure précède l’arrivée habituelle (16:00)');
    verifier(erreursReglage('depart_tardif', regle({ heure: '11:00' }), f).length === 1 && !erreursReglage('depart_tardif', regle({ heure: '14:00' }), f).length, 'départ plus tard : l’heure suit le départ habituel (11:00)');
    verifier(erreursReglage('navette', regle({ prixCentimes: -1 })).length === 1 && !erreursReglage('navette', regle({ prixCentimes: 0 })).length && !erreursReglage('navette', regle({ actif: false, prixCentimes: -1 })).length, 'prix : obligatoire (0 € si offert), rien à vérifier si éteint');
    const enreg = avecReglagesLogement(vide, 'log-1', { ...supplementsDuLogement(vide, 'log-1'), navette: regle({ heure: undefined, conditions: '  Depuis   la gare  ' }) }, { le: '2026-10-27T10:00:00+01:00', nom: 'Abdel' });
    verifier(enreg.majPar === 'Abdel' && enreg.logements['log-1'].navette?.conditions === 'Depuis la gare' && supplementsActifs(enreg, 'log-1').join() === 'navette', 'enregistrement : précision nettoyée, qui et quand notés');
    verifier(ecritureGerantSeulement('reglages', ID_REGLAGES_SUPPLEMENTS), 'écriture réservée au gérant (navigateur)');
    const d0 = creerSeed();
    verifier(operationReserveeAuGerant({ type: 'ecrire', collection: 'reglages', id: ID_REGLAGES_SUPPLEMENTS, donnees: enreg } as never, d0), 'un compte « opérations » ne met pas ce réglage en file');
    if (racine) {
      for (const f of ['supabase/erp-espaces.sql', 'supabase/erp-acces-gerants.sql', 'supabase/erp-installation.sql']) {
        verifier(/p_id in \('messages-programmes', 'societe', 'numerotation-factures', 'alerte-controle-agent', 'supplements'\)/.test(source(f)), `${f} : « supplements » dans erp.ecriture_gerant_seulement`);
      }
      verifier(/\(lm, 'reglages', 'supplements', '\{"id": "supplements"\}'\)/.test(source('supabase/erp-espaces.sql')) && /id in \('messages-programmes', 'societe', 'supplements'\)/.test(source('supabase/erp-espaces.sql')) && /6 lignes réservées/.test(source('supabase/erp-espaces.sql')), 'recette SQL (espaces) : refusé au compte « opérations », permis au gérant');
      verifier(/\('reglages', 'supplements', '\{"id": "supplements"\}'\)/.test(source('supabase/erp-acces-gerants.sql')) && /4 lignes réservées/.test(source('supabase/erp-acces-gerants.sql')), 'recette SQL (accès des gérants) : idem');
    }
    const demo = reglagesSupplements(creerSeed());
    verifier(Object.keys(demo.logements).length > 0 && demo.majPar === 'Abdel', 'démonstration : suppléments réglés par le gérant');
  }

  section('2. Disponibilité sur les réservations et les ménages');
  {
    const r = resa('r1');
    const fiche = LOGEMENT.fiche;
    const libre = { reservations: [r] };
    const dispo = (cle: Parameters<typeof disponibiliteSupplement>[0], planning: Parameters<typeof disponibiliteSupplement>[2], reglage = regle(cle === 'depart_tardif' ? { heure: '14:00' } : {}), jour = '2026-10-27', sejour = r) =>
      disponibiliteSupplement(cle, sejour, planning, reglage, fiche, jour);
    verifier(dispo('arrivee_anticipee', libre).statut === 'possible' && /Personne ne part/.test(dispo('arrivee_anticipee', libre).constats.join()), 'arrivée plus tôt, personne ne part ce jour-là : possible');
    const part = { reservations: [r, resa('p', { arrivee: '2026-10-26', depart: '2026-10-29' })] };
    verifier(dispo('arrivee_anticipee', part).statut === 'impossible' && /Un voyageur part ce jour-là \(avant 11:00\)/.test(dispo('arrivee_anticipee', part).constats.join()), 'un voyageur part le jour de l’arrivée : impossible (selon le planning)');
    verifier(dispo('arrivee_anticipee', part, regle({ selonPlanning: false })).statut === 'a_verifier', 'sans « selon le planning » : à vérifier');
    const annule = { reservations: [r, resa('x', { arrivee: '2026-10-26', depart: '2026-10-29', statut: 'annulee' })] };
    verifier(dispo('arrivee_anticipee', annule).statut === 'possible', 'réservation annulée : ne bloque rien');
    const autreLogement = { reservations: [r, resa('y', { logementId: 'log-2', arrivee: '2026-10-26', depart: '2026-10-29' })] };
    verifier(dispo('arrivee_anticipee', autreLogement).statut === 'possible', 'un départ dans un autre logement : ne bloque rien');
    const menageTard = { reservations: [r], missions: [mission('2026-10-29', { heureFinMax: '15:00' })] };
    verifier(dispo('arrivee_anticipee', menageTard).statut === 'a_verifier' && /Ménage prévu ce jour-là, de 11:00 à 15:00/.test(dispo('arrivee_anticipee', menageTard).constats.join()), 'ménage prévu le jour même jusqu’à 15:00 (arrivée dès 12:00) : à vérifier');
    const menageVeille = { reservations: [r, resa('q', { arrivee: '2026-10-24', depart: '2026-10-27' })], missions: [mission('2026-10-27')] };
    verifier(dispo('arrivee_anticipee', menageVeille).statut === 'possible' && /Ménage déjà prévu le 27 octobre/.test(dispo('arrivee_anticipee', menageVeille).constats.join()), 'ménage déjà fait après le départ précédent : possible, et dit');
    verifier(dispo('arrivee_anticipee', { reservations: [r], missions: [mission('2026-10-29', { statut: 'annulee' })] }).statut === 'possible', 'ménage annulé : ignoré');
    verifier(dispo('arrivee_anticipee', libre, regle(), '2026-10-30').statut === 'impossible', 'voyageur déjà arrivé : impossible');
    const arrive = { reservations: [r, resa('n', { arrivee: '2026-11-01', depart: '2026-11-04' })] };
    verifier(dispo('depart_tardif', libre).statut === 'possible' && dispo('depart_tardif', arrive).statut === 'impossible' && /Un voyageur arrive ce jour-là \(dès 16:00\)/.test(dispo('depart_tardif', arrive).constats.join()), 'départ plus tard : bloqué par une arrivée le même jour');
    // Personne n'arrive : le ménage de ce départ se décale après l'heure tardive, tant qu'il tient avant sa fin au plus tard.
    const menageMatin = { reservations: [r], missions: [mission('2026-11-01', { heureDebut: '11:00', heureFinMax: '16:00' })] };
    const decale = dispo('depart_tardif', menageMatin);
    verifier(decale.statut === 'possible' && decale.constats.includes('Ménage décalé après 14:00.'), 'ménage prévu à 11:00, départ jusqu’à 14:00, personne n’arrive : possible, « Ménage décalé après 14:00 »', decale);
    const serre = dispo('depart_tardif', { reservations: [r], missions: [mission('2026-11-01', { heureDebut: '11:00', heureFinMax: '15:00' })] });
    verifier(serre.statut === 'a_verifier' && /il finirait après 15:00/.test(serre.constats.join()), 'ménage décalé qui ne tient plus avant sa fin au plus tard (15:00) : à vérifier', serre);
    const arriveMenage = { reservations: [r, resa('n', { arrivee: '2026-11-01', depart: '2026-11-04' })], missions: [mission('2026-11-01', { heureDebut: '11:00', heureFinMax: '16:00' })] };
    verifier(dispo('depart_tardif', arriveMenage).statut === 'impossible' && dispo('depart_tardif', arriveMenage, regle({ heure: '14:00', selonPlanning: false })).statut === 'a_verifier', 'arrivée le même jour : pas possible (selon le planning), sinon à vérifier');
    verifier(dispo('depart_tardif', { reservations: [r], missions: [mission('2026-11-01', { heureDebut: '15:00' })] }).statut === 'possible', 'ménage prévu après l’heure tardive : rien à décaler, possible');
    verifier(dispo('menage_supplementaire', libre).statut === 'possible' && dispo('menage_supplementaire', { reservations: [r], missions: [mission('2026-10-30')] }).statut === 'a_verifier', 'ménage supplémentaire : un ménage déjà prévu pendant le séjour est signalé');
    verifier(dispo('menage_supplementaire', libre, regle(), '2026-10-27', resa('r9', { nuits: 1, depart: '2026-10-30' })).statut === 'impossible', 'séjour d’une nuit : pas de ménage pendant le séjour');
    verifier(dispo('navette', libre).statut === 'possible' && dispo('navette', libre, regle(), '2026-10-27', resa('rx', { statut: 'annulee' })).statut === 'impossible', 'navette : possible ; séjour annulé : rien');
  }

  section('3. Proposition prête et message automatique');
  {
    const r = resa('r1');
    const ctx = (cle: 'arrivee_anticipee' | 'depart_tardif' | 'menage_supplementaire' | 'navette', langue: 'fr' | 'en', statut: 'possible' | 'a_verifier' | 'impossible' = 'possible', reglage = regle(cle === 'depart_tardif' ? { heure: '14:00' } : {})) =>
      texteProposition(cle, { reservation: r, fiche: LOGEMENT.fiche, reglage, disponibilite: { statut, constats: [] }, prenom: 'Emily', signature: 'L’équipe Label Maison', langue });
    const fr = ctx('arrivee_anticipee', 'fr');
    verifier(/^Bonjour Emily,/.test(fr) && /jeudi 29 octobre/.test(fr) && /dès 12 h au lieu de 16 h/.test(fr) && fr.includes(prixLisible(2000)) && fr.endsWith('L’équipe Label Maison'), 'arrivée plus tôt : prénom, date, heure, prix réglé, signature', fr);
    const en = ctx('depart_tardif', 'en');
    verifier(/^Hello Emily,/.test(en) && /Sunday 1 November/.test(en) && /until 14:00 instead of 11:00/.test(en) && /€20/.test(en), 'départ plus tard en anglais : date, heure, prix', en);
    const non = ctx('arrivee_anticipee', 'fr', 'impossible');
    verifier(/ne peut pas être prêt plus tôt/.test(non) && /16 h/.test(non) && !/€/.test(non), 'pas possible : réponse polie, l’heure habituelle, aucun prix', non);
    const tous = [ctx('arrivee_anticipee', 'fr'), ctx('depart_tardif', 'fr'), ctx('menage_supplementaire', 'fr'), ctx('navette', 'en'), non, en];
    verifier(tous.every((t) => !/https?:|www\.|paiement|payment link|lien/i.test(t)), 'jamais de lien ni de paiement dans une proposition');
    verifier(/sans supplément/.test(ctx('navette', 'fr', 'possible', regle({ prixCentimes: 0, heure: undefined }))) && prixLisible(2250) === '22,50 €', 'offert : « sans supplément » ; centimes affichés seulement s’il y en a');
    verifier(/Précision/.test('Précision') && ctx('navette', 'fr', 'possible', regle({ heure: undefined, conditions: 'depuis la gare d’Évry' })).includes('Depuis la gare d’Évry.'), 'précision du gérant ajoutée en une phrase');
    // À vérifier : au conditionnel, jamais « Bonne nouvelle », l'équipe confirme ensuite.
    const v20 = prixLisible(2000);
    const vfr = ctx('arrivee_anticipee', 'fr', 'a_verifier');
    verifier(vfr.includes(`Le jeudi 29 octobre, une arrivée dès 12 h devrait être possible, pour ${v20} : nous vérifions avec l’équipe ménage et vous confirmons très vite.`), 'à vérifier (fr) : « devrait être possible », « nous vérifions avec l’équipe ménage »', vfr);
    const ven = ctx('arrivee_anticipee', 'en', 'a_verifier');
    verifier(ven.includes(`On Thursday 29 October, an early check-in from 12:00 should be possible, for ${prixLisible(2000, 'en')}: we are checking with our housekeeping team and will confirm shortly.`), 'à vérifier (en) : « should be possible », « we are checking with our housekeeping team »', ven);
    const vdep = ctx('depart_tardif', 'fr', 'a_verifier');
    const vmen = ctx('menage_supplementaire', 'en', 'a_verifier');
    verifier(/le dimanche 1 novembre, un départ jusqu’à 14 h devrait être possible/i.test(vdep) && /cleaning during your stay should be possible/.test(vmen), 'à vérifier : départ plus tard et ménage aussi au conditionnel', [vdep, vmen]);
    verifier(
      [vfr, ven, vdep, vmen, ctx('depart_tardif', 'en', 'a_verifier'), ctx('menage_supplementaire', 'fr', 'a_verifier')].every((t) => !/Bonne nouvelle|Good news|vous pouvez arriver|you can check|répondez-nous simplement|just reply here/i.test(t)),
      'à vérifier : jamais « Bonne nouvelle », rien d’affirmé, pas de « répondez-nous » (l’équipe confirme)',
    );
    verifier(/^Bonne nouvelle/m.test(ctx('arrivee_anticipee', 'fr')) && /^Good news/m.test(ctx('depart_tardif', 'en')), 'possible : « Bonne nouvelle » seulement quand c’est sûr');
    verifier(ligneSupplement('arrivee_anticipee', regle()) === `• Arrivée plus tôt, dès 12 h : ${prixLisible(2000)}`, 'ligne du message automatique', ligneSupplement('arrivee_anticipee', regle()));
    const reglages = avecReglagesLogement(reglagesSupplements({ reglages: [] }), 'log-1', { arrivee_anticipee: regle(), depart_tardif: regle({ heure: '14:00' }), menage_supplementaire: regle({ actif: false, heure: undefined }), navette: regle({ actif: false, heure: undefined }) }, { le: 'x', nom: 'Abdel' });
    const bloque = { reservations: [r, resa('p', { arrivee: '2026-10-26', depart: '2026-10-29' })] };
    const lignes = texteSupplementsSejour(reglages, r, bloque, LOGEMENT.fiche, '2026-10-26');
    verifier(!/Arrivée plus tôt/.test(lignes) && /Départ plus tard, jusqu’à 14 h/.test(lignes), 'message automatique : seulement les suppléments possibles (arrivée bloquée par le planning)', lignes);
    verifier(texteSupplementsSejour(reglages, resa('r2', { logementId: 'log-2' }), bloque, LOGEMENT.fiche, '2026-10-26') === '', 'logement sans supplément : rien à proposer');
  }

  section('4. Demande du voyageur repérée');
  {
    const cas: [string, string | undefined][] = [
      ['Could we check in a bit earlier, around 1pm?', 'arrivee_anticipee'],
      ['Est-il possible d’arriver plus tôt ?', 'arrivee_anticipee'],
      ['Can we leave later on Sunday?', 'depart_tardif'],
      ['Un late check-out est possible ?', 'depart_tardif'],
      ['Pourriez-vous faire un ménage pendant notre séjour ?', 'menage_supplementaire'],
      ['Is there a shuttle from the airport?', 'navette'],
      ['Pouvez-vous venir nous chercher à la gare ?', 'navette'],
      ['Could you pick us up at the station?', 'navette'],
      ['Where should we pick up the keys?', undefined],
      ['Où est le parking ?', undefined],
      ['Il nous faudrait un lit supplémentaire pour le bébé.', undefined],
    ];
    // Une heure dite n'est pas une demande : il faut la forme d'une demande (« possible », « peut-on », « could we… earlier »).
    cas.push(
      ['We will arrive early evening, where is the key box?', undefined],
      ['Nous arriverons vers 15 h, est-ce trop tôt ?', undefined],
      ['Nous arriverons peut-être plus tôt que prévu.', undefined],
      ['Hello! Our flight lands at 10am. Would it be possible to check in a bit earlier, around 1pm?', 'arrivee_anticipee'],
      ['Pourrions-nous partir plus tard dimanche ?', 'depart_tardif'],
      ['Early check-in please!', 'arrivee_anticipee'],
    );
    for (const [t, attendu] of cas) verifier(supplementDansTexte(t) === attendu, `« ${t} » → ${attendu ?? 'rien'}`, supplementDansTexte(t));
    const f = fil('fil-7', 'r1', { messages: [msg('a', 'voyageur', 'Hello!')], analyse: { messageId: 'a', intention: 'arrivee_anticipee', le: 'x' } });
    verifier(supplementDemande(f) === 'arrivee_anticipee', 'demande lue par l’IA (arrivée plus tôt) : reprise telle quelle');
    const traitee = fil('fil-8', 'r1', {
      messages: [msg('a', 'voyageur', 'Could we check in earlier, around 1pm?'), msg('b', 'hote', 'Hi Emily, yes, from 1pm for €20.'), msg('c', 'voyageur', 'What is the wifi name?')],
    });
    verifier(supplementDemande(traitee) === undefined && supplementDemande(fil('fil-9', 'r1', { messages: [msg('a', 'voyageur', 'We will arrive early evening, where is the key box?')] })) === undefined, 'demande déjà traitée, ou heure seulement dite : pas de bandeau de supplément');
  }

  section('5. L’agent ne vend jamais seul un supplément (verdict)');
  {
    const niveaux = (['valider', 'simples', 'autonome'] as const).map((n) => politiqueEnvoi({ autonomie: n }, false));
    niveaux.push(politiqueEnvoi({}, true)); // Label Maison sans choix : autonome
    const jamaisSeul = (d: DecisionNotee, voyageur: string) => niveaux.map((p) => verdictEnvoi(d, p, voyageur).verdict);
    const v1 = jamaisSeul({ action: 'repondre', raison: 'aucune', confiance: 1, intention: 'arrivee_anticipee', langue: 'en', texte: 'Hi Emily, I am checking with our team and will get back to you.' }, 'Could we check in a bit earlier?');
    verifier(v1.every((x) => x === 'valider'), 'arrivée plus tôt, confiance 1 : à valider à tous les niveaux', v1);
    const v2 = jamaisSeul({ action: 'repondre', raison: 'aucune', confiance: 1, intention: 'infos', langue: 'en', texte: 'Hi Emily, sure!' }, 'Can we leave later on Sunday?');
    verifier(v2.every((x) => x === 'valider'), 'demande mal lue par l’IA (« infos ») mais mots du voyageur : à valider', v2);
    const v3 = jamaisSeul({ action: 'repondre', raison: 'aucune', confiance: 1, intention: 'autre', langue: 'en', texte: 'Hi Emily, a late check-out until 2pm is fine.' }, 'Thanks for everything!');
    verifier(v3.every((x) => x === 'valider'), 'réponse qui accorde un départ plus tard : à valider', v3);
    const v4 = jamaisSeul({ action: 'repondre', raison: 'aucune', confiance: 1, intention: 'navette', langue: 'fr', texte: 'Bonjour, nous pouvons organiser une navette.' } as unknown as DecisionNotee, 'Merci !');
    verifier(v4.every((x) => x === 'valider'), 'réponse qui propose une navette : à valider', v4);
    const v5 = jamaisSeul({ action: 'repondre', raison: 'aucune', confiance: 1, intention: 'arrivee_anticipee', langue: 'en', texte: 'Early check-in is possible for 20 €.' }, 'Could we check in early?');
    verifier(v5.every((x) => x === 'transmettre'), 'réponse avec un prix : transmise (argent)', v5);
    verifier(sujetSensible('Is there a supplement for an extra cleaning?')?.raison === 'argent' && sujetSensible('Quel est le prix du supplément ?')?.raison === 'argent', '« supplément » dans le message du voyageur : question d’argent');
    verifier(sujetSensible('Il nous faudrait une couverture supplémentaire.') === null, '« supplémentaire » n’est pas un supplément payant');
    const simple = verdictEnvoi({ action: 'repondre', raison: 'aucune', confiance: 0.95, intention: 'infos', langue: 'en', texte: 'Hi Emily, the hair dryer is in the bathroom.' }, politiqueEnvoi({ autonomie: 'autonome' }, false), 'Is there a hair dryer?');
    verifier(simple.verdict === 'envoyer', 'question simple : l’agent répond toujours seul (le garde-fou ne bloque que les suppléments)');

    // Questions simples qui repartent seules (autonome), avec les horaires du logement (16:00, 11:00).
    const autonome = politiqueEnvoi({ autonomie: 'autonome' }, false);
    const simples = politiqueEnvoi({ autonomie: 'simples' }, false);
    const fiche = LOGEMENT.fiche;
    const seul = (texte: string, voyageur: string[], langue: 'fr' | 'en', intention: DecisionNotee['intention'] = 'arrivee', sansReponse = voyageur.slice(-1)) =>
      [autonome, simples].map((p) => verdictEnvoi({ action: 'repondre', raison: 'aucune', confiance: 0.95, intention, langue, texte }, p, { sujets: voyageur, recents: voyageur, sansReponse, fiche }).verdict);
    const simplesCas: [string, string[], 'fr' | 'en', DecisionNotee['intention']][] = [
      ['Hi Tom, the key box is on the left of the door, the code is sent 48h before.', ['We will arrive early evening, where is the key box?'], 'en', 'arrivee'],
      ['Bonjour Claire, l’arrivée est possible à partir de 16 h ; la boîte à clés est à droite de la porte.', ['Nous arriverons vers 15 h, est-ce trop tôt ?'], 'fr', 'arrivee'],
      ['Hi Tom, the wifi is LM-Corbeil, the password is on the fridge.', ['Could we check in earlier, around 1pm?', 'Great, thanks a lot!', 'What is the wifi name?'], 'en', 'infos'],
      ['Bonjour Claire, l’arrivée se fait à partir de 16 h. Si vous souhaitez arriver plus tôt, dites-le-nous.', ['À quelle heure peut-on arriver ?'], 'fr', 'arrivee'],
      ['Hi Tom, check-out is at 11am. If you need a late check-out, just let us know.', ['What time is check-out?'], 'en', 'depart'],
      ['Hi Tom, you can check in from 4pm and check out by 11am.', ['What are the check-in and check-out times?'], 'en', 'arrivee'],
    ];
    for (const [texte, voyageur, langue, intention] of simplesCas) {
      const v = seul(texte, voyageur, langue, intention);
      verifier(v.every((x) => x === 'envoyer'), `question simple, part seule : « ${voyageur[voyageur.length - 1]} » → « ${texte.slice(0, 50)}… »`, v);
    }
    // Wifi après une demande déjà traitée, lu sur la vraie conversation (messages sans réponse).
    const filTraite = fil('fil-60', 'r1', {
      messages: [msg('a', 'voyageur', 'Could we check in earlier, around 1pm?'), msg('b', 'hote', 'Hi Emily, we will confirm with our team.'), msg('c', 'voyageur', 'Great, thanks!'), msg('d', 'voyageur', 'What is the wifi name?')],
    });
    const lus = messagesVerdict(filTraite, new Date('2026-10-27T10:00:00Z'), fiche);
    verifier(lus.sansReponse?.join('|') === 'Great, thanks!|What is the wifi name?' && !lus.apresProposition && lus.fiche?.heureArrivee === '16:00', 'conversation : messages sans réponse et horaires du logement lus', lus);
    verifier(verdictEnvoi({ action: 'repondre', raison: 'aucune', confiance: 0.95, intention: 'infos', langue: 'en', texte: 'Hi Emily, the wifi is LM-Corbeil.' }, autonome, lus).verdict === 'envoyer', 'wifi après une demande déjà traitée : part seul');

    // Vraies demandes, ou réponse qui accorde : à valider.
    const aValider: [string, string[], 'fr' | 'en', DecisionNotee['intention']][] = [
      ['Hi Emily, I am checking with our team and will get back to you.', ['Could we check in a bit earlier, around 1pm?'], 'en', 'infos'],
      ['Bonjour Claire, je vérifie avec l’équipe et je reviens vers vous.', ['Est-il possible d’arriver plus tôt ?'], 'fr', 'arrivee'],
      ['Bonjour Claire, vous pourrez arriver dès 12 h jeudi.', ['À quelle heure peut-on arriver ?'], 'fr', 'arrivee'],
      ['Great, Tom! You can check in from 12:00 on Thursday.', ['What time can we arrive?'], 'en', 'arrivee'],
      ['Hi Tom, no problem, you can stay until 2pm on Sunday.', ['What time is check-out?'], 'en', 'depart'],
      ['Bonjour, le logement sera prêt dès 13 h, vous pouvez venir.', ['Le logement sera prêt à quelle heure ?'], 'fr', 'arrivee'],
    ];
    for (const [texte, voyageur, langue, intention] of aValider) {
      const v = seul(texte, voyageur, langue, intention);
      verifier(v.every((x) => x === 'valider'), `demande ou heure accordée : à valider (« ${texte.slice(0, 50)}… »)`, v);
    }
    verifier(offreSupplement('Hi Tom, you can check in from 4pm.', fiche) === false && offreSupplement('Hi Tom, you can check in from 1pm.', fiche) === true, 'une heure accordée compte comme offre seulement hors des horaires du logement (16:00)');
    verifier(offreSupplement('Bonjour, nous pouvons vérifier si une arrivée plus tôt est possible.') === false && offreSupplement('Très bien, nous organisons le ménage mercredi.') === true && offreSupplement('C’est noté, nous viendrons vous chercher à la gare à 15 h.') === true, 'offre : accorder (ménage, navette), pas « nous pouvons vérifier »');

    // Réponse à « Proposer les suppléments » : jamais envoyée seule, à aucun niveau, en français comme en anglais.
    const auto = (texte: string, langue: 'fr' | 'en') =>
      fil('fil-61', 'r1', {
        messages: [
          { ...msg('p', 'hote', langue === 'fr' ? 'Bonjour Emily, nous pouvons vous proposer : • Arrivée plus tôt, dès 12 h : 20 €' : 'Hello Emily, we can offer: early check-in from 12:00, €20'), envoi: { par: PAR_MESSAGE_AUTO, moment: 'proposer_supplements' } },
          msg('v', 'voyageur', texte),
        ],
      });
    const reponses: [string, string, 'fr' | 'en'][] = [
      ['Oui pour la première option, merci !', 'Parfait Emily, c’est noté : vous pourrez arriver dès 12 h jeudi. À très vite !', 'fr'],
      ['Yes please, the first one!', 'Great, Emily! You can check in from 12:00 on Thursday. See you soon!', 'en'],
      ['Non merci, à jeudi !', 'Très bien Emily, à jeudi !', 'fr'],
      ['No thanks, see you Thursday', 'Perfect, see you on Thursday!', 'en'],
    ];
    for (const [voyageur, texte, langue] of reponses) {
      const f = auto(voyageur, langue);
      const v = niveaux.map((p) => verdictEnvoi({ action: 'repondre', raison: 'aucune', confiance: 0.99, intention: 'arrivee', langue, texte }, p, messagesVerdict(f, new Date('2026-10-27T10:00:00Z'), fiche)));
      verifier(apresPropositionSupplements(f) && v.every((x) => x.verdict === 'valider' && x.motif === MOTIF_REPONSE_PROPOSITION), `réponse à « Proposer les suppléments » (« ${voyageur} ») : à valider à tous les niveaux`, v);
    }
    // Proposition envoyée par l'équipe (« Insérer », un prix) : même règle pour la réponse du voyageur.
    const propEquipe = fil('fil-62', 'r1', { messages: [msg('p', 'hote', 'Bonne nouvelle : le jeudi 29 octobre, vous pouvez arriver dès 12 h, pour 20 €.'), msg('v', 'voyageur', 'Oui merci !')] });
    verifier(apresPropositionSupplements(propEquipe) && verdictEnvoi({ action: 'repondre', raison: 'aucune', confiance: 0.99, intention: 'avis', langue: 'fr', texte: 'Merci Emily, à jeudi !' }, autonome, messagesVerdict(propEquipe, new Date('2026-10-27T10:00:00Z'), fiche)).verdict === 'valider', 'réponse à une proposition de l’équipe avec un prix : à valider');
    verifier(!apresPropositionSupplements(fil('fil-63', 'r1', { messages: [msg('p', 'hote', 'Bonjour Emily, le parking est devant la résidence.'), msg('v', 'voyageur', 'Merci !')] })), 'réponse à un autre message de l’équipe : règle ordinaire');
    // Proposition, puis un autre message automatique (infos d'arrivée), puis « Oui » : toujours une réponse à la proposition.
    const deuxAuto = fil('fil-64', 'r1', {
      messages: [
        { ...msg('p', 'hote', 'Bonjour Emily, nous pouvons vous proposer : • Arrivée plus tôt, dès 12 h : 20 €'), envoi: { par: PAR_MESSAGE_AUTO, moment: 'proposer_supplements' } },
        { ...msg('i', 'hote', 'Bonjour Emily, voici les infos d’arrivée.'), envoi: { par: PAR_MESSAGE_AUTO, moment: 'veille_arrivee' } },
        msg('v', 'voyageur', 'Oui pour la première option'),
      ],
    });
    verifier(apresPropositionSupplements(deuxAuto) && verdictEnvoi({ action: 'repondre', raison: 'aucune', confiance: 0.99, intention: 'avis', langue: 'fr', texte: 'C’est noté, à jeudi !' }, autonome, messagesVerdict(deuxAuto, new Date('2026-10-27T10:00:00Z'), fiche)).verdict === 'valider', 'proposition puis infos d’arrivée, puis « Oui » : toujours à valider');
    // Une simple question après la proposition suit la règle ordinaire : elle repart seule.
    const question = fil('fil-66', 'r1', {
      messages: [
        { ...msg('p', 'hote', 'Bonjour Emily, nous pouvons vous proposer : • Arrivée plus tôt, dès 12 h : 20 €'), envoi: { par: PAR_MESSAGE_AUTO, moment: 'proposer_supplements' } },
        msg('v', 'voyageur', 'Où peut-on se garer ?'),
      ],
    });
    verifier(!apresPropositionSupplements(question), 'question simple après la proposition (« Où peut-on se garer ? ») : pas une réponse à la proposition');
    // Questions ordinaires (« please », « second » sans « option ») : pas des réponses à la proposition.
    for (const q of ['Could you tell me where the nearest bakery is, please?', 'Is the second bedroom heated?', 'Ok, and is there a hairdryer?']) {
      verifier(!apresPropositionSupplements(auto(q, 'en')), `question ordinaire après la proposition (« ${q} ») : règle ordinaire`);
    }
    // Question qui accepte, ou réponse longtemps après : une réponse de l'agent qui s'engage n'est jamais envoyée seule.
    for (const [voyageur, texte, langue] of [
      ['Super, c’est possible pour 12h ?', 'Oui, c’est noté pour 12 h !', 'fr'],
      ['Est-ce encore possible ?', 'Oui, c’est réservé pour vous.', 'fr'],
      ['Ok please, can we have it?', 'Of course, it’s booked!', 'en'],
      ['Merci ! Et pour le ménage, c’est le mercredi ?', 'Oui, c’est noté pour mercredi.', 'fr'],
    ] as [string, string, 'fr' | 'en'][]) {
      const f = auto(voyageur, langue);
      const v = niveaux.map((p) => verdictEnvoi({ action: 'repondre', raison: 'aucune', confiance: 0.99, intention: 'infos', langue, texte }, p, messagesVerdict(f, new Date('2026-10-27T10:00:00Z'), fiche)).verdict);
      verifier(v.every((x) => x === 'valider'), `proposition en cours, réponse qui s’engage (« ${texte} ») : à valider`, v);
    }
    // Heure redemandée sans mot d'arrivée, après une réponse de l'équipe : toujours hors horaires.
    const relance = fil('fil-68', 'r1', { messages: [msg('v1', 'voyageur', 'Oui pour l’arrivée à 12 h'), msg('h', 'hote', 'Je vérifie avec l’équipe ménage.'), msg('v2', 'voyageur', 'Alors, c’est bon pour 12 h ?')] });
    verifier(
      verdictEnvoi({ action: 'repondre', raison: 'aucune', confiance: 0.99, intention: 'arrivee', langue: 'fr', texte: 'Oui, c’est noté pour 12 h.' }, autonome, messagesVerdict(relance, new Date('2026-10-27T10:00:00Z'), fiche)).verdict === 'valider',
      '« c’est bon pour 12 h ? » puis « c’est noté pour 12 h » : à valider (12 h est hors des horaires)',
    );
    // Pendant le séjour, une réponse neutre de l'agent repart seule, même si la proposition attend toujours.
    const sejour = fil('fil-69', 'r1', {
      messages: [
        { ...msg('p', 'hote', 'Bonjour Emily, nous pouvons vous proposer : • Arrivée plus tôt, dès 12 h : 20 €', '2026-10-20T11:00:00+02:00'), envoi: { par: PAR_MESSAGE_AUTO, moment: 'proposer_supplements' } },
        msg('v', 'voyageur', 'Where can we leave the bags when we check out?', '2026-10-26T10:00:00+01:00'),
      ],
    });
    for (const texte of ['Once you are done, leave the bags in the hallway.', 'Done! The guide link is in your app.', 'Déposez-les dans l’entrée, et c’est bon !']) {
      verifier(verdictEnvoi({ action: 'repondre', raison: 'aucune', confiance: 0.99, intention: 'depart', langue: 'en', texte }, autonome, messagesVerdict(sejour, new Date('2026-10-27T10:00:00Z'), fiche)).verdict === 'envoyer', `réponse neutre pendant le séjour (« ${texte} ») : part seule`);
    }
    // Au-delà de 72 h, la proposition ne compte plus.
    const tard = fil('fil-67', 'r1', {
      messages: [
        { ...msg('p', 'hote', 'Bonjour Emily, nous pouvons vous proposer : • Arrivée plus tôt, dès 12 h : 20 €', '2026-10-20T11:00:00+02:00'), envoi: { par: PAR_MESSAGE_AUTO, moment: 'proposer_supplements' } },
        msg('v', 'voyageur', 'Parfait, merci pour le séjour !', '2026-10-26T10:00:00+01:00'),
      ],
    });
    verifier(!apresPropositionSupplements(tard), 'message arrivé plus de 72 h après la proposition : règle ordinaire');
    verifier(
      verdictEnvoi({ action: 'repondre', raison: 'aucune', confiance: 0.99, intention: 'avis', langue: 'fr', texte: 'C’est noté, à très vite !' }, autonome, messagesVerdict(tard, new Date('2026-10-27T10:00:00Z'), fiche)).verdict === 'valider',
      'plus de 72 h après, une réponse qui s’engage reste à valider (proposition toujours en cours)',
    );
    // Acceptations courtes, sans « oui » ni option : toujours des réponses à la proposition, jamais envoyées seules.
    for (const [voyageur, texte, langue] of [
      ['Parfait, merci !', 'Parfait Emily, c’est noté. À jeudi !', 'fr'],
      ['Je confirme', 'Merci Emily, c’est confirmé.', 'fr'],
      ['Ça nous va très bien', 'Très bien, c’est noté pour vous.', 'fr'],
      ['Sounds great!', 'Great, it’s booked!', 'en'],
      ['Perfect, thanks!', 'You are all set, see you soon!', 'en'],
      ["Let's do it", 'Done! See you Thursday.', 'en'],
    ] as [string, string, 'fr' | 'en'][]) {
      const f = auto(voyageur, langue);
      const v = niveaux.map((p) => verdictEnvoi({ action: 'repondre', raison: 'aucune', confiance: 0.99, intention: 'avis', langue, texte }, p, messagesVerdict(f, new Date('2026-10-27T10:00:00Z'), fiche)).verdict);
      verifier(apresPropositionSupplements(f) && v.every((x) => x === 'valider'), `acceptation courte (« ${voyageur} ») : à valider à tous les niveaux`, v);
    }
    verifier(
      verdictEnvoi({ action: 'repondre', raison: 'aucune', confiance: 0.99, intention: 'infos', langue: 'fr', texte: 'Bonjour Emily, le parking est devant la résidence, place 12 réservée.' }, autonome, messagesVerdict(question, new Date('2026-10-27T10:00:00Z'), fiche)).verdict === 'envoyer',
      'question simple après la proposition : la réponse part seule en autonome',
    );
    // « supplementary » n'est pas un supplément ; « Non merci pour les suppléments » ne rend pas sensibles les messages suivants.
    verifier(!sujetSensibleMessages(['Are there supplementary blankets?']) && !sujetSensibleMessages(['Non merci pour les suppléments', 'Quel est le nom du wifi ?']), '« supplementary » et un refus des suppléments : pas une question d’argent');
    // Le voyageur demande une heure hors des horaires : une réponse qui la reprend l'accorde, même mal classée par l'IA.
    for (const [voyageur, texte, langue] of [
      ['Can we arrive at 1pm?', 'Hi Tom, yes, 1 pm works. See you then!', 'en'],
      ['Arrivée à 14h possible ?', 'Bonjour, oui ! Rendez-vous à 14 h.', 'fr'],
    ] as [string, string, 'fr' | 'en'][]) {
      const f = fil('fil-65', 'r1', { messages: [msg('v', 'voyageur', voyageur)] });
      const v = niveaux.map((p) => verdictEnvoi({ action: 'repondre', raison: 'aucune', confiance: 0.99, intention: 'infos', langue, texte }, p, messagesVerdict(f, new Date('2026-10-27T10:00:00Z'), fiche)).verdict);
      verifier(v.every((x) => x === 'valider'), `heure demandée hors des horaires reprise dans la réponse (« ${voyageur} ») : à valider`, v);
    }
    verifier(/proposition de suppléments/.test(MOTIF_REPONSE_PROPOSITION) && /question d’argent/.test(MOTIF_SUPPLEMENT), 'motif propre à une réponse à une proposition');
    verifier(['simples', 'autonome'].every((n) => /ne vend jamais seul un supplément/.test(explicationNiveau(n as 'simples', { horsFiche: true }).regles.join())) && /ne vend jamais seul un supplément/.test(explicationNiveau('valider', { horsFiche: true }).regles.join()), 'écran « Votre agent » : la règle est dite à chaque niveau');
  }

  section('6. L’agent ne vend jamais seul un supplément (passage simulé)');
  {
    const b = new FausseBase();
    const repull = new FauxRepull();
    const ia = new FausseIA();
    const maintenant = new Date('2026-10-27T10:00:00Z');
    const options = (extra: Partial<OptionsAgent> = {}): OptionsAgent => ({
      cle: 'sk_test',
      base: new BaseErp({ url: 'https://base.test', cleAnon: 'anon', fetch: b.fetch as typeof fetch, jeton: async () => 'jeton' }),
      echeance: Date.now() + 50_000,
      budgetMois: 400,
      fetch: repull.fetch as typeof fetch,
      attendre: async () => undefined,
      maintenant: () => maintenant,
      declencheur: 'planifie',
      releve: 'non',
      ia,
      telegram: null,
      ...extra,
    });
    b.poser<ReglagesAgent>('reglages', { ...REGLAGES_AGENT_DEFAUT, actif: true, autonomie: 'autonome' });
    b.poser('logements', LOGEMENT);
    b.poser('reservations', resa('r1'));
    let n = 0;
    const question = (texte: string) => {
      n++;
      const id = `q${n}`;
      b.poser<FilMessages>('filsMessages', fil('fil-80', 'r1', { messages: [msg(id, 'voyageur', texte, '2026-10-27T10:55:00+01:00')], dernierMessageLe: '2026-10-27T10:55:00+01:00', traitePar: 'en_attente' }));
    };
    const filActuel = () => b.get<FilMessages>('filsMessages', 'fil-80')!;

    question('Hello! Our flight lands at 10am. Could we check in a bit earlier, around 1pm?');
    ia.reponses.push(decision({ texte: 'Hi Emily, I am checking with our team whether the apartment can be ready earlier, and I will get back to you very soon.', intention: 'arrivee_anticipee' }));
    let p = await lancerAgent(options());
    let f = filActuel();
    verifier(repull.envois.length === 0 && p.repondus === 0 && p.aValider === 1, 'arrivée plus tôt, autonome, confiance 0,99 : rien n’est envoyé', { envois: repull.envois.length, p: p.message });
    verifier(f.agent?.decision === 'a_valider' && /supplément/.test(f.agent.brouillon?.motif ?? '') && f.traitePar === 'en_attente', 'réponse gardée « à valider », motif : supplément (l’équipe propose le prix)', f.agent);

    question('Can we leave later on Sunday, around 2pm?');
    ia.reponses.push(decision({ texte: 'Hi Emily, of course, a late check-out until 2pm is fine!', intention: 'infos' }));
    p = await lancerAgent(options());
    verifier(repull.envois.length === 0 && filActuel().agent?.decision === 'a_valider', 'départ plus tard accordé par l’IA (demande mal lue) : rien n’est envoyé');

    question('Could we check in early? We can pay.');
    ia.reponses.push(decision({ texte: 'Hi Emily, early check-in is possible for 20 €.', intention: 'arrivee_anticipee' }));
    p = await lancerAgent(options());
    f = filActuel();
    verifier(repull.envois.length === 0 && f.statut === 'escalade' && !f.agent?.brouillon, 'réponse avec un prix : transmise, ni envoyée ni proposée en un clic');

    // Label Maison sans choix (autonome par défaut) : même règle.
    b.poser<ReglagesAgent>('reglages', { ...REGLAGES_AGENT_DEFAUT, actif: true });
    question('Is a mid-stay cleaning possible?');
    ia.reponses.push(decision({ texte: 'Hi Emily, yes, we can arrange a cleaning during your stay.', intention: 'autre' }));
    p = await lancerAgent(options());
    verifier(repull.envois.length === 0 && filActuel().agent?.decision === 'a_valider', 'Label Maison sans choix : ménage en plus jamais promis seul');

    // Réponse du voyageur au message automatique « Proposer les suppléments » : l'agent ne confirme rien seul (fr et en).
    b.poser<ReglagesAgent>('reglages', { ...REGLAGES_AGENT_DEFAUT, actif: true, autonomie: 'autonome' });
    const apresAuto = (texte: string, proposition: string) => {
      n++;
      b.poser<FilMessages>(
        'filsMessages',
        fil('fil-80', 'r1', {
          messages: [
            { ...msg(`auto${n}`, 'hote', proposition, '2026-10-26T11:00:00+01:00'), envoi: { canal: 'airbnb', par: PAR_MESSAGE_AUTO, moment: 'proposer_supplements' } },
            msg(`q${n}`, 'voyageur', texte, '2026-10-27T10:55:00+01:00'),
          ],
          dernierMessageLe: '2026-10-27T10:55:00+01:00',
          traitePar: 'agent',
        }),
      );
    };
    apresAuto('Oui pour la première option, merci !', 'Bonjour Emily, nous pouvons vous proposer :\n• Arrivée plus tôt, dès 12 h : 20 €');
    ia.reponses.push(decision({ texte: 'Parfait Emily, c’est noté : vous pourrez arriver dès 12 h jeudi. À très vite !', langue: 'fr', intention: 'arrivee', confiance: 0.99 }));
    p = await lancerAgent(options());
    f = filActuel();
    verifier(repull.envois.length === 0 && p.repondus === 0 && f.agent?.decision === 'a_valider' && f.agent.brouillon?.motif === MOTIF_REPONSE_PROPOSITION, 'autonome : « Oui pour la première option » → réponse gardée à valider, rien n’est envoyé', f.agent);
    apresAuto('Yes please, the first one!', 'Hello Emily, we can offer: early check-in from 12:00, €20');
    ia.reponses.push(decision({ texte: 'Great, Emily! You can check in from 12:00 on Thursday. See you soon!', intention: 'arrivee', confiance: 0.99 }));
    p = await lancerAgent(options());
    verifier(repull.envois.length === 0 && filActuel().agent?.decision === 'a_valider', 'autonome, en anglais : « Yes please, the first one! » → à valider, rien n’est envoyé');

    // Témoin : une question simple part toujours seule (le passage simulé envoie bien).
    b.poser<ReglagesAgent>('reglages', { ...REGLAGES_AGENT_DEFAUT, actif: true, autonomie: 'autonome' });
    question('Is there a hair dryer?');
    ia.reponses.push(decision({ texte: 'Hi Emily, yes, the hair dryer is in the bathroom.', intention: 'infos', confiance: 0.95 }));
    p = await lancerAgent(options());
    verifier(repull.envois.length === 1 && p.repondus === 1, 'témoin : une question simple part seule');
    verifier(repull.ecritures.length === 0, 'aucune autre écriture vers la plateforme', repull.ecritures);
  }

  section('7. Message automatique « Proposer les suppléments »');
  {
    verifier(DECLENCHEURS.includes('proposer_supplements') && LIBELLES_DECLENCHEURS.proposer_supplements.titre === 'Proposer les suppléments', 'moment « Proposer les suppléments »');
    const r0 = reglagesProgrammes({ reglages: [] });
    verifier(!r0.modeles.proposer_supplements.actif && r0.modeles.proposer_supplements.heure === '11:00', 'éteint par défaut, 11:00 par défaut, réglable comme les autres');
    verifier(JOURS_AVANT_SUPPLEMENTS === 3, '3 jours avant l’arrivée');
    const f = fenetreEnvoi('proposer_supplements', resa('r1'), { heure: '11:00' });
    verifier(f?.debut === instantParis('2026-10-26', '11:00') && f.fin === instantParis('2026-10-26', '21:00'), 'fenêtre : le 26 octobre de 11:00 à 21:00 (arrivée le 29)');
    verifier(texteStocke(texteAffiche(TEXTES_DEFAUT.proposer_supplements)) === TEXTES_DEFAUT.proposer_supplements && texteAffiche(TEXTES_DEFAUT.proposer_supplements).includes('{Suppléments proposés}'), 'texte par défaut : variable « Suppléments proposés »');
    verifier(VARIABLES.find((v) => v.cle === 'supplements')?.moments?.join() === 'proposer_supplements', 'la variable n’est proposée que pour ce moment');
    const rendu = rendreMessage(TEXTES_DEFAUT.proposer_supplements, { reservation: resa('r1'), logement: LOGEMENT, signature: 'L’équipe Label Maison', aujourdhui: '2026-10-26', supplements: '• Départ plus tard, jusqu’à 14 h : 20 €' });
    verifier(rendu.texte.includes('• Départ plus tard, jusqu’à 14 h : 20 €') && !rendu.codes && !/4821|soleil/.test(rendu.texte), 'texte rendu : la liste, sans code ni wifi');

    const allume = (): ReglagesMessagesProgrammes => {
      const r = reglagesProgrammes({ reglages: [] });
      r.modeles.proposer_supplements = { ...r.modeles.proposer_supplements, actif: true, activeLe: '2026-10-01T10:00:00+02:00' };
      return r;
    };
    const sup = avecReglagesLogement(reglagesSupplements({ reglages: [] }), 'log-1', { arrivee_anticipee: regle(), depart_tardif: regle({ heure: '14:00' }), menage_supplementaire: regle({ actif: false, heure: undefined }), navette: regle({ actif: false, heure: undefined }) }, { le: 'x', nom: 'Abdel' });
    const quand = new Date('2026-10-26T10:30:00Z'); // 11:30 à Paris (heure d'hiver)
    const sansSup = deciderEnvoi({ declencheur: 'proposer_supplements', reservation: resa('r2', { logementId: 'log-2' }), reglages: allume(), fils: [fil('fil-2', 'r2', { logementId: 'log-2' })], maintenant: quand, supplements: sup });
    verifier(sansSup.genre === 'rien', 'logement sans supplément : rien (ni envoi, ni ligne)');
    const avec = deciderEnvoi({ declencheur: 'proposer_supplements', reservation: resa('r1'), reglages: allume(), fils: [fil('fil-1', 'r1')], maintenant: quand, supplements: sup });
    verifier(avec.genre === 'envoyer', 'logement avec suppléments, 3 jours avant : à envoyer', avec);
    verifier(deciderEnvoi({ declencheur: 'proposer_supplements', reservation: resa('r1'), reglages: reglagesProgrammes({ reglages: [] }), fils: [fil('fil-1', 'r1')], maintenant: quand, supplements: sup }).genre === 'rien', 'éteint : rien');

    // Passage serveur simulé.
    const b = new FausseBase();
    const repull = new FauxRepull();
    const options = (): OptionsProgrammes => ({
      cle: 'sk_test',
      base: new BaseErp({ url: 'https://base.test', cleAnon: 'anon', fetch: b.fetch as typeof fetch, jeton: async () => 'jeton' }),
      echeance: Date.now() + 50_000,
      budgetMois: 400,
      fetch: repull.fetch as typeof fetch,
      attendre: async () => undefined,
      maintenant: () => quand,
      ia: null,
    });
    b.poser('logements', LOGEMENT);
    b.poser('logements', AUTRE);
    b.poser('reglages', { ...REGLAGES_AGENT_DEFAUT, actif: true });
    b.poser('reglages', allume());
    b.poser('reglages', sup);
    // r1 : un voyageur part le jour de son arrivée (arrivée plus tôt bloquée) ; r3 : arrivée et départ bloqués ; r2 : logement sans supplément.
    b.poser('reservations', resa('r1'));
    b.poser('reservations', resa('p1', { arrivee: '2026-10-26', depart: '2026-10-29', voyageur: { nom: 'Paul Leroy', nbPersonnes: 1 } }));
    b.poser('reservations', resa('r2', { logementId: 'log-2' }));
    b.poser('filsMessages', fil('fil-1', 'r1'));
    b.poser('filsMessages', fil('fil-2', 'r2', { logementId: 'log-2' }));
    const bilan = await lancerProgrammes(options());
    const parti = repull.envois.find((e) => e.conversation === '1')?.message ?? '';
    verifier(bilan.envoyes === 1 && repull.envois.length === 1 && /Départ plus tard, jusqu’à 14 h/.test(parti) && !/Arrivée plus tôt/.test(parti), 'un seul message : le départ plus tard, pas l’arrivée bloquée par le planning', { bilan, parti });
    verifier(/^Bonjour Emily,/.test(parti) && parti.endsWith('L’équipe Label Maison') && !/4821|soleil2026|https?:/.test(parti), 'texte : prénom, signature, ni code, ni wifi, ni lien');
    const dansLeFil = b.get<FilMessages>('filsMessages', 'fil-1')?.messages.at(-1);
    verifier(dansLeFil?.envoi?.par === PAR_MESSAGE_AUTO && dansLeFil.envoi.moment === 'proposer_supplements', 'le message garde son moment (envoi.moment) : une réponse du voyageur se reconnaît', dansLeFil?.envoi);
    verifier(!b.get(COLLECTION_ENVOIS_PROGRAMMES, idEnvoi('r2', 'proposer_supplements')), 'logement sans supplément : aucune ligne');
    // Tout bloqué : pas envoyé, noté.
    b.poser('reservations', resa('r3', { arrivee: '2026-10-29', depart: '2026-11-01' }));
    b.poser('reservations', resa('n3', { arrivee: '2026-11-01', depart: '2026-11-03' }));
    b.poser('filsMessages', fil('fil-3', 'r3'));
    // r1 a déjà reçu le sien ; r3 : arrivée bloquée (p1 part le 29) et départ bloqué (n3 arrive le 1er).
    await lancerProgrammes(options());
    const e3 = b.get<EnvoiProgramme>(COLLECTION_ENVOIS_PROGRAMMES, idEnvoi('r3', 'proposer_supplements'));
    verifier(e3?.statut === 'ignore' && e3.raison === RAISONS.sansSupplement && repull.envois.length === 1, 'rien de possible pour ce séjour : pas envoyé, noté une fois', e3);
    verifier(repull.ecritures.length === 0, 'aucune écriture vers la plateforme (ni offre, ni réservation, ni calendrier)', repull.ecritures);

    // Une réponse à « Proposer les suppléments » ne retient les infos d'arrivée que si elle demande vraiment quelque chose.
    const veille = (): ReglagesMessagesProgrammes => {
      const r = reglagesProgrammes({ reglages: [] });
      r.modeles.veille_arrivee = { ...r.modeles.veille_arrivee, actif: true, activeLe: '2026-10-01T10:00:00+02:00' };
      return r;
    };
    const soir = new Date('2026-10-28T17:30:00Z'); // 18:30 à Paris, la veille de l'arrivée du 29
    const reponseA = (texte: string, p: Partial<FilMessages> = {}) =>
      fil('fil-90', 'r1', {
        messages: [
          { ...msg('auto', 'hote', 'Bonjour Emily, nous pouvons vous proposer : …', '2026-10-26T11:00:00+01:00'), envoi: { canal: 'airbnb', par: PAR_MESSAGE_AUTO, moment: 'proposer_supplements' } },
          msg('v', 'voyageur', texte, '2026-10-26T12:00:00+01:00'),
        ],
        dernierMessageLe: '2026-10-26T12:00:00+01:00',
        traitePar: 'en_attente',
        ...p,
      });
    const infos = (f: FilMessages) => deciderEnvoi({ declencheur: 'veille_arrivee', reservation: resa('r1'), reglages: veille(), fils: [f], maintenant: soir, logement: LOGEMENT }).genre;
    const nonMerci = reponseA('Non merci, à jeudi !');
    verifier(infos(nonMerci) === 'envoyer' && infos(reponseA('No thanks, see you Thursday')) === 'envoyer', '« Non merci, à jeudi » : les infos d’arrivée de la veille partent quand même');
    verifier(attendEquipe(nonMerci) && reponseSansDemandeAuxSupplements(nonMerci), 'la conversation reste dans « À répondre » (règle unique inchangée)');
    for (const t of ['Pourrions-nous partir plus tard dimanche ?', 'Oui pour la première option, merci !', 'Yes please, the first one!', 'Non merci. Où peut-on se garer ?', 'Non merci. Nous devons annuler', 'Ce serait top l’arrivée à 12 h, merci', 'Late checkout would be great, thanks.', 'Je confirme pour l’arrivée anticipée.', 'Super, la première option.']) {
      verifier(infos(reponseA(t)) === 'attendre', `« ${t} » : vraie demande, les infos d’arrivée attendent l’équipe`);
    }
    verifier(infos(reponseA('Non merci, à jeudi !', { statut: 'escalade' })) === 'attendre', 'conversation transmise par l’agent : les infos d’arrivée attendent');
    const ordinaire = fil('fil-91', 'r1', { messages: [msg('h', 'hote', 'Bonjour Emily, à jeudi !'), msg('v', 'voyageur', 'Non merci, à jeudi !')], traitePar: 'en_attente' });
    verifier(infos(ordinaire) === 'attendre', 'après un autre message de l’équipe : la règle reste la même (le voyageur attend)');
    verifier(!VARIABLES.some((v) => v.sensible && (!v.moments || v.moments.includes('proposer_supplements'))) && VARIABLES.filter((v) => v.sensible).every((v) => v.moments?.includes('veille_arrivee')), 'éditeur : ni « Accès et clés » ni « Wifi » pour « Proposer les suppléments »');
  }

  section('8. Aucun paiement, aucune écriture vers les plateformes');
  {
    verifier(
      !ecritureRepullPermise('POST', '/v1/reservations/123/special-offer', { price: 20 }) &&
        !ecritureRepullPermise('PATCH', '/v1/reservations/123', { checkOut: '2026-11-01T14:00' }) &&
        !ecritureRepullPermise('PUT', '/v1/availability/123', { price: 90 }),
      'le verrou refuse offre spéciale, changement de réservation et calendrier',
    );
    if (racine) {
      for (const f of ['src/erp/data/supplements.ts', 'src/erp/modules/messagerie/_composants/PropositionSupplement.tsx', 'src/erp/modules/logements/_composants/SupplementsLogement.tsx']) {
        const s = source(f).replace(/^\s*(\*|\/\/).*$/gm, '');
        // Du code, pas les mots de l'aide (« ni lien de paiement ») : aucun appel réseau, aucun prestataire de paiement.
        verifier(!/fetch\(|appelerServeur|\/v1\/|stripe|paypal\.|paymentLink|special[-_]?offer|specialOffer/i.test(s), `${f} : ni appel, ni paiement, ni plateforme`);
      }
      const relatifs = [...source('src/erp/data/supplements.ts').matchAll(/^import (?!type )[^;]*?from '(\.[^']+)'/gm)].map((m) => m[1]);
      verifier(relatifs.every((i) => i.endsWith('.js')), 'supplements.ts : imports relatifs en .js (serveur)', relatifs);
      verifier(/L’ERP n’encaisse rien\./.test(source('src/erp/modules/logements/_composants/SupplementsLogement.tsx')) && /encaisse en dehors de l’ERP/.test(source('src/erp/modules/messagerie/_composants/MessagesAutomatiques.tsx')), 'l’aide le dit : l’ERP n’encaisse rien, l’encaissement se fait hors ERP');
      verifier(/n’accorde rien, ne donne aucun prix/.test(source('src/erp/data/agent-messagerie.ts')), 'consigne de l’agent : n’accorde rien, aucun prix');
      verifier(/Ne propose jamais de toi-même une arrivée plus tôt ni un départ plus tard/.test(source('src/erp/data/agent-messagerie.ts')), 'consigne de l’agent : ne propose jamais de lui-même une arrivée plus tôt ni un départ plus tard');
      verifier(/Non merci/.test(source('src/erp/modules/messagerie/_composants/EditeurMessageAuto.tsx')), 'aide de l’éditeur : un « Non merci » ne retient pas les infos d’arrivée');
    }
  }

  console.log(`\n${reussis} contrôles réussis, ${echecs} en échec.`);
  (globalThis as { process?: { exitCode?: number } }).process!.exitCode = echecs ? 1 : 0;
}

void principal();
