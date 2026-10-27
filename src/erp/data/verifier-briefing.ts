/**
 * Auto-contrôle du briefing du matin (A12), sans réseau ni IA : texte exact
 * sur un petit jeu d'essai, journée calme, rien à dire, aucun chiffre
 * inventé, aucun nom dans la notification, mêmes nombres que « À faire » de
 * l'Accueil (jeu de démonstration), prix et factures pour le gérant
 * seulement (texte et notification), puis le passage planifié : fenêtre de
 * 7 h à midi à Paris, une seule fois par jour et par espace (même avec deux
 * passages simultanés), rien sans appareil qui le veut, attente des
 * factures du 1er, et rien vers les plateformes.
 *
 * Lancement (Node 18+, depuis la racine du dépôt) :
 *   node_modules/.bin/esbuild src/erp/data/verifier-briefing.ts --bundle --platform=node --format=esm \
 *     --define:import.meta.env='{"VITE_ERP_DEMO":"1"}' --log-level=error --outfile=/tmp/verifier-briefing.mjs \
 *     && node /tmp/verifier-briefing.mjs
 */
import { construireBriefing, journeeDe, liste, notificationBriefing, TITRE_BRIEFING, type Briefing, type EntreesBriefing } from './briefing';
import { fenetreBriefing, ID_ETAT_BRIEFING, passerBriefingDansEspace, type BasePassageBriefing } from './briefing-passage';
import { donneesVides } from './collections';
import { DATE_DEMO, MAINTENANT as MAINTENANT_DEMO } from './format';
import { TYPES_NOTIFICATION, varianteAEnvoyer, type GroupeNotification } from './notifications';
import { envoyerNotifications } from './notifications-envoi';
import { ecritureRepullPermise } from './repull-synchro';
import { creerSeed } from './seed';
import type { ContactCrm, ErpDonnees, FilMessages, Logement, Reservation } from './types';
import { construireATraiter } from '../modules/tableau-de-bord/_composants/aTraiter.js';

let echecs = 0;
let reussis = 0;
function verifier(condition: unknown, message: string, detail?: unknown) {
  if (condition) reussis++;
  else {
    echecs++;
    console.error(`  ✗ ${message}${detail === undefined ? '' : ` — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`}`);
  }
}
const section = (titre: string) => console.log(`\n${titre}`);

/* ------------------------------------------------------------ jeu d'essai */

const J = '2026-10-27'; // mardi (heure d'hiver à Paris : UTC+1)
const MAINTENANT = '2026-10-27T07:30:00+01:00';

const logement = (id: string, nom: string): Logement =>
  ({ id, nom, ville: 'Évry', codePostal: '91000', statut: 'actif', proprietaireId: 'p1', annonces: [], lits: [], fiche: {}, checklistLancement: [], dotationLinge: [] }) as unknown as Logement;

const resa = (id: string, logementId: string, nom: string, arrivee: string, depart: string, x: Partial<Reservation> = {}): Reservation =>
  ({
    id,
    logementId,
    canal: 'booking',
    voyageur: { nom, nbPersonnes: 2 },
    arrivee,
    depart,
    nuits: 2,
    statut: 'confirmee',
    montantBrutCentimes: 30000,
    commissionPlateformeCentimes: 4000,
    fraisMenageCentimes: 5000,
    ...x,
  }) as Reservation;

const fil = (id: string, x: Partial<FilMessages>): FilMessages =>
  ({ id, logementId: 'l1', canal: 'booking', voyageur: 'Voyageur Exemple', statut: 'ouvert', messages: [], dernierMessageLe: `${J}T06:00:00Z`, traitePar: 'agent', ...x }) as FilMessages;

const contact = (id: string, nom: string, x: Partial<ContactCrm> = {}): ContactCrm => ({
  id,
  nom,
  telephone: '06 00 00 00 01',
  email: `${id}@exemple.invalid`,
  source: 'audit',
  statut: 'a_appeler',
  notes: '',
  tentatives: 0,
  historique: [],
  creeLe: `${J}T08:00:00+01:00`,
  ...x,
});

const LOGEMENTS = [logement('l1', 'Cosy F2'), logement('l2', 'Lisses Jardin'), logement('l3', 'Paris 14 Alésia'), logement('l4', 'Le Nid')];

function entrees(x: Partial<ErpDonnees> = {}, o: Partial<EntreesBriefing> = {}): EntreesBriefing {
  return { ...donneesVides(), logements: LOGEMENTS, ...x, aujourdhui: J, maintenant: MAINTENANT, gerant: false, ...o };
}

const JOURNEE = [
  resa('r1', 'l1', 'Léa Martin', J, '2026-10-29'),
  resa('r2', 'l2', 'Marc Petit', J, '2026-10-30'),
  resa('r3', 'l3', 'Hugo Bernard', '2026-10-25', J),
  resa('r4', 'l4', 'Annulé Exemple', J, '2026-10-28', { statut: 'annulee' }),
];
const FILS = [
  fil('f1', { traitePar: 'en_attente' }),
  fil('f2', { statut: 'escalade', raisonEscalade: 'argent' }),
  fil('f3', { statut: 'clos', traitePar: 'en_attente' }),
  fil('f4', { traitePar: 'humain' }),
];
const CONTACTS = [contact('crm-1', 'Sophie Exemple'), contact('crm-2', 'Paul Exemple', { statut: 'contacte', relanceLe: '2026-10-30' })];

/** Chiffres du texte qui ne viennent pas des données (comptes, noms, notes, seuil 4,5, années). */
function chiffresInventes(b: Briefing, d: EntreesBriefing): string[] {
  const permis = new Set<string>();
  for (const s of b.sujets) permis.add(String(s.n));
  const { arrivees, departs, occupes } = journeeDe(d.reservations, d.aujourdhui);
  for (const n of [arrivees.length, departs.length, occupes.length]) permis.add(String(n));
  const textes = [
    ...d.logements.map((l) => l.nom),
    ...(d.crm ?? []).map((c) => c.nom),
    ...(d.proprietaires ?? []).map((p) => p.nom),
    ...d.reservations.map((r) => String(r.noteVoyageur ?? '').replace('.', ',')),
    ...(d.factures ?? []).map((f) => f.mensuelle?.mois ?? ''),
    '4,5',
  ];
  for (const t of textes) for (const x of t.match(/\d+/g) ?? []) permis.add(x);
  // Alertes : le compte de chaque genre d'anomalie (« 2 risques de double réservation »).
  const alertes = b.sujets.find((s) => s.cle === 'alertes');
  for (const x of alertes?.phrase.match(/\d+(?= (?:risques?|départs?|réservations?|logements?) )/g) ?? []) permis.add(x);
  return (b.texte.match(/\d+/g) ?? []).filter((x) => !permis.has(x));
}

/* ------------------------------------------------------------- le texte */

section('Texte du briefing (jeu d’essai)');
{
  const e = entrees({ reservations: JOURNEE, filsMessages: FILS, crm: CONTACTS });
  const b = construireBriefing(e);
  verifier(
    b.texte ===
      'Aujourd’hui : 2 arrivées (Léa à Cosy F2 et Marc à Lisses Jardin), 1 départ (Paris 14 Alésia) et 2 logements occupés ce soir. 2 voyageurs attendent votre réponse, dont 1 confié par votre agent. Une personne à appeler aujourd’hui : Sophie Exemple.',
    'texte exact : journée (annulée exclue), voyageurs qui attendent (terminée exclue), contact du jour',
    b.texte,
  );
  verifier(b.court === '2 arrivées, 1 départ et 2 logements occupés ce soir. 2 voyageurs attendent votre réponse et 1 appel à passer.', 'notification : forme courte, sans nom', b.court);
  verifier(!/Léa|Marc|Sophie|Cosy|Alésia/.test(b.court), 'aucun nom de voyageur, de contact ni de logement sur l’écran verrouillé');
  verifier(construireBriefing(e).texte === b.texte, 'déterministe : mêmes données, même texte');
  verifier(chiffresInventes(b, e).length === 0, 'aucun chiffre qui ne vienne des données', chiffresInventes(b, e));
  verifier(!b.rien && b.sujets[0].cle === 'journee' && b.sujets.map((s) => s.cle).join() === 'journee,messages,crm', 'sujets : la journée d’abord, puis ce qui attend', b.sujets.map((s) => s.cle));
  verifier(/^\S/.test(b.texte) && !/  /.test(b.texte) && !/—/.test(b.texte), 'phrases propres (pas de double espace ni de tiret cadratin)');
  verifier(!/\btu\b|\bton\b|\bta\b/i.test(b.texte) && /votre/.test(b.texte), 'vouvoiement');

  const unSeul = construireBriefing(entrees({ reservations: [JOURNEE[0]], filsMessages: [FILS[1]], crm: [] }));
  verifier(
    unSeul.texte === 'Aujourd’hui : 1 arrivée (Léa à Cosy F2) et 1 logement occupé ce soir. Un voyageur attend votre réponse, confié par votre agent.',
    'singuliers',
    unSeul.texte,
  );
}

section('Journée calme, rien à dire');
{
  const calme = construireBriefing(entrees({ reservations: [resa('r9', 'l4', 'Nina Exemple', '2026-10-25', '2026-10-30')] }));
  verifier(calme.texte === 'Aujourd’hui : ni arrivée ni départ, 1 logement occupé ce soir. Rien ne vous attend : bonne journée.', 'journée calme : une phrase, et « rien ne vous attend »', calme.texte);
  verifier(calme.court === 'Ni arrivée ni départ, 1 logement occupé ce soir.' && !calme.rien, 'journée calme : notification utile', calme.court);
  const vide = construireBriefing(entrees());
  verifier(vide.rien && notificationBriefing(vide, vide) === null, 'rien du tout : pas de notification');
  verifier(vide.texte === 'Aujourd’hui : ni arrivée ni départ, aucun logement occupé ce soir. Rien ne vous attend : bonne journée.', 'rien du tout : le texte le dit simplement', vide.texte);
}

section('Avis, notes, incidents et alertes');
{
  const e = entrees({
    reservations: [
      resa('a1', 'l1', 'Zoé Exemple', '2026-10-20', '2026-10-24', { canal: 'airbnb', statut: 'terminee' }),
      resa('a2', 'l2', 'Noé Exemple', '2026-10-18', '2026-10-21', { statut: 'terminee', noteVoyageur: 4.2 }),
      // Double réservation : deux séjours qui se chevauchent sur Le Nid.
      resa('d1', 'l4', 'Ada Exemple', '2026-11-02', '2026-11-05'),
      resa('d2', 'l4', 'Bob Exemple', '2026-11-03', '2026-11-06', { canal: 'airbnb' }),
    ],
    incidents: [
      { id: 'i1', logementId: 'l3', date: J, categorie: 'autre', gravite: 'haute', description: 'Fuite sous l’évier.', statut: 'ouvert', refacturable: 'non', preuves: [] },
      { id: 'i2', logementId: 'l2', date: J, categorie: 'autre', gravite: 'moyenne', description: 'Ampoule.', statut: 'ouvert', refacturable: 'non', preuves: [] },
      { id: 'i3', logementId: 'l1', date: J, categorie: 'autre', gravite: 'haute', description: 'Réglé.', statut: 'resolu', refacturable: 'non', preuves: [] },
    ] as unknown as ErpDonnees['incidents'],
  });
  const b = construireBriefing(e);
  const cles = b.sujets.map((s) => s.cle).join();
  verifier(cles === 'journee,urgences,incidents,avis_deposer,notes,alertes', 'urgence, incident, avis à déposer, note sous 4,5, double réservation', cles);
  verifier(b.texte.includes('Une urgence signalée : Paris 14 Alésia.') && b.texte.includes('Un incident ouvert : Lisses Jardin.'), 'incidents : urgence à part, résolu ignoré', b.texte);
  verifier(b.texte.includes('Un avis à déposer sur Airbnb (Zoé).') && b.texte.includes('Une note de voyageur sous 4,5 à lire (4,2 à Lisses Jardin).'), 'avis à déposer (Airbnb) et note à lire', b.texte);
  verifier(b.texte.includes('À vérifier : 1 risque de double réservation.'), 'alerte : double réservation', b.texte);
  verifier(b.court === 'Ni arrivée ni départ, aucun logement occupé ce soir. 1 urgence, 1 point à vérifier, 1 avis à déposer, 1 note à lire et 1 incident ouvert.', 'notification : le plus pressant d’abord (urgence, alerte)', b.court);
  verifier(chiffresInventes(b, e).length === 0, 'aucun chiffre inventé (avis, notes, alertes)', chiffresInventes(b, e));
  verifier(b.sujets.find((s) => s.cle === 'urgences')?.lien.startsWith('/erp') && b.sujets.every((s) => s.lien.startsWith('/erp')), 'chaque sujet ouvre un écran de l’ERP');
  const echec = construireBriefing({ ...e, synchroEnEchec: true });
  verifier(echec.texte.includes('À vérifier : la dernière mise à jour Airbnb et Booking a échoué et 1 risque de double réservation.'), 'mise à jour des plateformes en échec : en tête des alertes', echec.texte);
}

/* ---------------------------------------- démonstration : comme « À faire » */

section('Mêmes nombres que « À faire » de l’Accueil (jeu de démonstration)');
const seed = creerSeed();
const demo = (gerant: boolean) => construireBriefing({ ...seed, aujourdhui: DATE_DEMO, maintenant: MAINTENANT_DEMO, gerant });
{
  const g = demo(true);
  const o = demo(false);
  const aFaire = construireATraiter(seed, DATE_DEMO, { gerant: true });
  const n = (b: Briefing, cle: string) => b.sujets.find((s) => s.cle === cle)?.n ?? 0;
  const lignes = (id: string) => aFaire.find((x) => x.id === id)?.details.length ?? 0;
  verifier(n(g, 'messages') === lignes('message') && n(g, 'messages') > 0, 'voyageurs qui attendent : même nombre que « À faire »', [n(g, 'messages'), lignes('message')]);
  verifier(n(g, 'crm') === lignes('crm') && n(g, 'crm') > 0, 'personnes à appeler : même nombre que « À faire »', [n(g, 'crm'), lignes('crm')]);
  verifier(n(g, 'avis_deposer') === lignes('avisHote'), 'avis à déposer : même nombre', [n(g, 'avis_deposer'), lignes('avisHote')]);
  verifier(n(g, 'notes') === lignes('avis'), 'notes sous 4,5 : même nombre', [n(g, 'notes'), lignes('avis')]);
  verifier(n(g, 'urgences') === lignes('urgence') && n(g, 'incidents') === lignes('incident'), 'urgences et incidents : mêmes nombres', [n(g, 'urgences'), lignes('urgence'), n(g, 'incidents'), lignes('incident')]);
  verifier(n(g, 'prix') === lignes('prix') && n(g, 'prix') > 0, 'prix à revoir (gérant) : même nombre de logements', [n(g, 'prix'), lignes('prix')]);
  verifier(n(g, 'factures') === lignes('factures') && n(g, 'factures') > 0, 'factures mensuelles à valider (gérant) : même nombre', [n(g, 'factures'), lignes('factures')]);
  verifier(chiffresInventes(g, { ...seed, aujourdhui: DATE_DEMO, maintenant: MAINTENANT_DEMO, gerant: true }).length === 0, 'démonstration : aucun chiffre inventé', chiffresInventes(g, { ...seed, aujourdhui: DATE_DEMO, maintenant: MAINTENANT_DEMO, gerant: true }));

  section('Rôles : prix et factures pour le gérant seulement');
  verifier(!o.sujets.some((s) => s.cle === 'prix' || s.cle === 'factures') && !/Prix à revoir|facture/i.test(o.texte) && !/prix|facture/i.test(o.court), 'membre non gérant : ni prix conseillés ni factures (texte et notification)', o.texte);
  verifier(g.sujets.filter((s) => s.gerant).every((s) => s.cle === 'prix' || s.cle === 'factures'), 'seuls prix et factures sont marqués « gérant »');
  const aFaireOps = construireATraiter(seed, DATE_DEMO, { gerant: false });
  verifier(!aFaireOps.some((x) => x.type === 'facture' || x.type === 'prix'), '« À faire » d’un non-gérant : ni facture ni prix');
  const notif = notificationBriefing(g, o)!;
  verifier(notif.cle === `briefing-${DATE_DEMO}` && notif.variantes.length === 2 && notif.variantes[0].gerant === true && !notif.variantes[1].gerant, 'notification : version du gérant, puis version de l’équipe', notif.variantes);
  verifier(notif.variantes.every((v) => v.type === 'rappel' && v.titre === TITRE_BRIEFING && v.url === '/erp' && v.corps.length <= 240), '« Briefing du matin », type « rappel » (préférences gardées), ouvre l’Accueil, 240 caractères au plus');
  const pour = (role: string, p: Record<string, boolean>) => varianteAEnvoyer(notif, p, role)?.corps;
  verifier(/factur/i.test(pour('gerant', { rappel: true }) ?? '') && !/factur|prix/i.test(pour('operations', { rappel: true }) ?? 'x') && !/factur|prix/i.test(pour('lecture', { rappel: true }) ?? 'x'), 'chaque appareil reçoit la version de son rôle');
  verifier(pour('gerant', {}) === undefined, 'éteint par défaut (comme l’ancien « Rappel du matin »)');
  verifier(TYPES_NOTIFICATION.find((t) => t.type === 'rappel')?.libelle === TITRE_BRIEFING, 'réglage de l’appareil : « Briefing du matin »');
  const egal = notificationBriefing(o, o)!;
  verifier(egal.variantes.length === 1 && !egal.variantes[0].gerant, 'même texte pour tous : une seule variante');
}

section('Petites règles d’écriture');
{
  verifier(liste(['a']) === 'a' && liste(['a', 'b']) === 'a et b' && liste(['a', 'b', 'c']) === 'a, b et c' && liste(['a', 'b', 'c', 'd', 'e']) === 'a, b, c et 2 autres', 'listes de noms (« et 2 autres »)');
  verifier(liste(['a', 'a', 'b']) === 'a et b', 'pas de nom en double');
}

/* ------------------------------------------------------- passage planifié */

class BaseMemoire implements BasePassageBriefing {
  private lignes = new Map<string, { element: { id: string }; version: number }>();
  private v = 0;
  lectures: string[] = [];
  ecritures: string[] = [];
  constructor(donnees: Record<string, { id: string }[]>) {
    for (const [c, els] of Object.entries(donnees)) for (const e of els) this.lignes.set(`${c}/${e.id}`, { element: e, version: ++this.v });
  }
  private async pause() {
    await Promise.resolve();
    await Promise.resolve();
  }
  async lire<T>(c: string, ids?: string[]): Promise<T[]> {
    return (await this.lireVersions<T>(c, ids)).map((x) => x.element);
  }
  async lireVersions<T>(c: string, ids?: string[]): Promise<{ element: T; version: string }[]> {
    await this.pause();
    this.lectures.push(ids ? `${c}/${ids.join(',')}` : c);
    return [...this.lignes.entries()]
      .filter(([k]) => k.startsWith(`${c}/`) && (!ids || ids.includes(k.slice(c.length + 1))))
      .map(([, x]) => ({ element: structuredClone(x.element) as T, version: String(x.version) }));
  }
  async ecrire(c: string, els: { id: string }[]): Promise<void> {
    await this.pause();
    for (const e of els) {
      this.ecritures.push(`${c}/${e.id}`);
      this.lignes.set(`${c}/${e.id}`, { element: structuredClone(e), version: ++this.v });
    }
  }
  async remplacerSi(c: string, e: { id: string }, version: string): Promise<boolean> {
    await this.pause();
    const x = this.lignes.get(`${c}/${e.id}`);
    if (!x || String(x.version) !== version) return false;
    this.ecritures.push(`${c}/${e.id}`);
    this.lignes.set(`${c}/${e.id}`, { element: structuredClone(e), version: ++this.v });
    return true;
  }
  async ajouterSiAbsent(c: string, els: { id: string }[]): Promise<number> {
    await this.pause();
    let n = 0;
    for (const e of els) {
      if (this.lignes.has(`${c}/${e.id}`)) continue;
      this.ecritures.push(`${c}/${e.id}`);
      this.lignes.set(`${c}/${e.id}`, { element: structuredClone(e), version: ++this.v });
      n++;
    }
    return n;
  }
  get<T>(c: string, id: string): T | undefined {
    return this.lignes.get(`${c}/${id}`)?.element as T | undefined;
  }
}

const appareil = (id: string, role: string | undefined, preferences: Record<string, boolean>) => ({
  id: `notifications-appareil-${id}`,
  type: 'notifications-appareil',
  endpoint: `https://web.push.apple.com/${id}`,
  keys: { p256dh: 'x', auth: 'y' },
  preferences,
  ...(role ? { role } : {}),
  creeLe: '2026-10-01T08:00:00Z',
  majLe: '2026-10-01T08:00:00Z',
});

/** Base d'un espace : le jeu de démonstration, des appareils, la trace des factures du mois. */
function baseEspace(appareils: ReturnType<typeof appareil>[], o: { traceFactures?: string | null } = {}) {
  const d = creerSeed();
  const collections: Record<string, { id: string }[]> = {};
  for (const c of ['logements', 'reservations', 'filsMessages', 'crm', 'incidents', 'avisADeposer', 'controles', 'equipe', 'affectations', 'absences', 'conseilsPrix', 'factures'] as const) {
    collections[c] = (d[c] ?? []) as unknown as { id: string }[];
  }
  collections.connecteurs = appareils;
  if (o.traceFactures !== null) collections.passagesFacturesMensuelles = [{ id: o.traceFactures ?? '2026-09' }];
  return new BaseMemoire(collections);
}

const CLES = { publique: 'cle-publique', privee: 'cle-privee', sujet: 'https://www.exemple.fr' };
const recus: { endpoint: string; corps: string; titre: string }[] = [];
const envoyeur = async (a: { endpoint: string }, contenu: unknown) => {
  const c = contenu as { titre: string; corps: string };
  recus.push({ endpoint: a.endpoint, corps: c.corps, titre: c.titre });
  return { ok: true, statut: 201 } as never;
};
const passer = (base: BaseMemoire, instant: string) =>
  passerBriefingDansEspace(base, {
    maintenant: new Date(instant),
    envoyer: (groupes: GroupeNotification[]) => envoyerNotifications(base, groupes, { cles: CLES, maintenant: new Date(instant), envoyer: envoyeur }),
  });

section('Passage planifié : fenêtre, une fois par jour, qui le reçoit');
{
  verifier(!fenetreBriefing(new Date('2026-10-27T05:59:00Z')) && fenetreBriefing(new Date('2026-10-27T06:00:00Z')) && !fenetreBriefing(new Date('2026-10-27T11:00:00Z')), 'fenêtre : 7 h – midi à Paris (heure d’hiver)');
  verifier(!fenetreBriefing(new Date('2026-07-01T04:59:00Z')) && fenetreBriefing(new Date('2026-07-01T05:00:00Z')), 'fenêtre : 7 h à Paris l’été (UTC+2)');

  const base = baseEspace([appareil('gerant', 'gerant', { rappel: true }), appareil('ops', 'operations', { rappel: true }), appareil('eteint', 'gerant', {}), appareil('ancien', undefined, { rappel: true })]);
  let r = await passer(base, '2026-10-27T05:30:00Z');
  verifier(r.statut === 'hors-fenetre' && base.lectures.length === 0, 'avant 7 h : rien n’est lu', base.lectures);

  recus.length = 0;
  r = await passer(base, '2026-10-27T06:30:00Z');
  verifier(r.statut === 'fait' && recus.length === 3, '7 h 30 : envoyé aux trois appareils qui l’ont activé (pas à celui qui l’a éteint)', { statut: r.statut, recus: recus.map((x) => x.endpoint) });
  const corpsDe = (id: string) => recus.find((x) => x.endpoint.endsWith(`/${id}`))?.corps ?? '';
  verifier(/factur/i.test(corpsDe('gerant')) && !/factur|prix/i.test(corpsDe('ops')) && !/factur|prix/i.test(corpsDe('ancien')), 'gérant : avec prix et factures ; opérations et appareil sans rôle connu : sans', { gerant: corpsDe('gerant'), ops: corpsDe('ops') });
  verifier(recus.every((x) => x.titre === TITRE_BRIEFING), 'titre « Briefing du matin »');
  const etat = base.get<{ dernierJour: string; envoye: boolean }>('connecteurs', ID_ETAT_BRIEFING);
  verifier(etat?.dernierJour === '2026-10-27' && etat.envoye === true, 'état du jour écrit (une seule fois par jour)', etat);
  verifier(base.ecritures.every((x) => x.startsWith('connecteurs/')), 'seules écritures : l’état et le journal des notifications (collection technique)', base.ecritures);

  const lecturesAvant = base.lectures.length;
  recus.length = 0;
  r = await passer(base, '2026-10-27T07:00:00Z');
  verifier(r.statut === 'deja-fait' && recus.length === 0 && base.lectures.length === lecturesAvant + 1, 'passage suivant le même jour : une seule lecture, rien ne repart', { statut: r.statut, lectures: base.lectures.slice(lecturesAvant) });
  r = await passer(base, '2026-10-28T11:30:00Z');
  verifier(r.statut === 'hors-fenetre', 'après midi : plus de briefing ce jour-là');
  recus.length = 0;
  r = await passer(base, '2026-10-28T06:00:00Z');
  verifier(r.statut === 'fait' && recus.length === 3, 'le lendemain à 7 h : le nouveau briefing part');

  const personne = baseEspace([appareil('eteint', 'gerant', {})]);
  r = await passer(personne, '2026-10-27T06:30:00Z');
  verifier(r.statut === 'personne' && personne.lectures.length === 2 && personne.ecritures.length === 0, 'aucun appareil ne le veut : deux lectures, rien d’écrit', personne.lectures);

  const simultanes = baseEspace([appareil('gerant', 'gerant', { rappel: true })]);
  recus.length = 0;
  const [a, b] = await Promise.all([passer(simultanes, '2026-10-27T06:30:00Z'), passer(simultanes, '2026-10-27T06:30:00Z')]);
  verifier([a.statut, b.statut].sort().join() === 'deja-pris,fait' && recus.length === 1, 'deux passages en même temps : une seule notification', { a: a.statut, b: b.statut, recus: recus.length });
}

section('Le 1er du mois : le briefing attend les factures du mois terminé');
{
  const base = baseEspace([appareil('gerant', 'gerant', { rappel: true })], { traceFactures: null });
  recus.length = 0;
  let r = await passer(base, '2026-11-01T06:30:00Z');
  verifier(r.statut === 'attente-factures' && recus.length === 0 && !base.get('connecteurs', ID_ETAT_BRIEFING), '1er à 7 h 30, brouillons pas encore prêts : on attend (rien d’écrit)');
  await base.ecrire('passagesFacturesMensuelles', [{ id: '2026-10' }]);
  r = await passer(base, '2026-11-01T07:00:00Z');
  verifier(r.statut === 'fait' && recus.length === 1, 'brouillons prêts : le briefing part au passage suivant');
  const tard = baseEspace([appareil('gerant', 'gerant', { rappel: true })], { traceFactures: null });
  r = await passer(tard, '2026-11-01T09:00:00Z');
  verifier(r.statut === 'fait', 'à 10 h, il part même sans les brouillons (jamais bloqué)');
  const equipe = baseEspace([appareil('ops', 'operations', { rappel: true })], { traceFactures: null });
  r = await passer(equipe, '2026-11-01T06:30:00Z');
  verifier(r.statut === 'fait', 'sans appareil de gérant : pas d’attente (les factures ne le concernent pas)');
}

section('Lecture seule vis-à-vis des plateformes');
{
  verifier(!ecritureRepullPermise('PUT', '/v1/availability/1') && !ecritureRepullPermise('POST', '/v1/listings/1/pricing'), 'aucune écriture de prix ou de calendrier permise');
  const fs = (await import(/* @vite-ignore */ 'node:' + 'fs')) as { readFileSync(p: string, e: 'utf8'): string; existsSync(p: string): boolean };
  const lire = (p: string) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '');
  const sources = ['src/erp/data/briefing.ts', 'src/erp/data/briefing-passage.ts', 'api/_briefing.ts'].map(lire);
  verifier(sources.every(Boolean), 'sources du briefing lisibles (lancer depuis la racine du dépôt)');
  verifier(sources.every((s) => !/repull|fetch\(|anthropic|messages\.create/i.test(s.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, ''))), 'le briefing n’appelle ni les plateformes, ni l’IA : texte calculé sur la base seule');
}

console.log(`\n${reussis} contrôles réussis, ${echecs} en échec.`);
if (echecs) (globalThis as { process?: { exitCode?: number } }).process!.exitCode = 1;
