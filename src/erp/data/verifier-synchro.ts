/**
 * Auto-contrôle de la synchronisation (synchro.ts) sans base réelle : le vrai
 * client @supabase/supabase-js parle à une fausse API PostgREST en mémoire
 * (fetch simulé). On vérifie le chargement, les écritures par différence,
 * les suppressions, la persistance du travail du moteur, l'écho temps réel,
 * la file d'attente (échec réseau, reprise, reprise par un autre onglet) et la
 * détection « base non installée ».
 *
 * Lancement (Node 18+) :
 *   node_modules/.bin/esbuild src/erp/data/verifier-synchro.ts --bundle --platform=node \
 *     --define:import.meta.env='{"VITE_ERP_DEMO":"1"}' --log-level=error --outfile=/tmp/verifier-synchro.cjs \
 *     && node /tmp/verifier-synchro.cjs
 */
import { createClient } from '@supabase/supabase-js';
import { executerAutomatisations } from '../automatisations';
import { COLLECTIONS_SYNCHRONISEES, donneesVides } from './collections';
import { AUJOURDHUI, MAINTENANT, ajouterJours } from './format';
import { creerSeed } from './seed';
import { ErreurSynchro, Synchro, differences, type ChangementDistant, type EtatSynchro } from './synchro';
import type { ClientErp } from './supabase';
import type { ErpDonnees, Logement, Reservation } from './types';

/* ------------------------------------------------------ fausse API PostgREST */

interface Ligne {
  collection: string;
  id: string;
  donnees: unknown;
  maj_par?: string | null;
}

interface Requete {
  methode: string;
  table: string;
  lignes?: number;
}

class FausseBase {
  enregistrements = new Map<string, Ligne>();
  etatAuto: Record<string, unknown> | null = null;
  requetes: Requete[] = [];
  /** Nombre de prochaines requêtes à faire échouer (réseau coupé). */
  pannes = 0;
  /** Schéma erp non exposé (SQL pas encore lancé). */
  schemaAbsent = false;

  cle = (c: string, id: string) => `${c}\u0000${id}`;

  reinitialiserCompteurs() {
    this.requetes = [];
  }
  compter(methode: string, table = 'enregistrements') {
    return this.requetes.filter((r) => r.methode === methode && r.table === table).length;
  }

  fetch = async (entree: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(typeof entree === 'string' ? entree : entree instanceof URL ? entree.href : entree.url);
    const methode = (init?.method ?? 'GET').toUpperCase();
    const entetes = new Headers(init?.headers);
    const table = url.pathname.replace(/^\/rest\/v1\//, '');
    if (this.pannes > 0) {
      this.pannes -= 1;
      throw new TypeError('fetch failed');
    }
    const profil = entetes.get('Accept-Profile') ?? entetes.get('Content-Profile');
    if (this.schemaAbsent || profil !== 'erp') {
      return json(406, { code: 'PGRST106', message: 'The schema must be one of the following: public, graphql_public', details: null, hint: null });
    }
    const corps = init?.body ? JSON.parse(String(init.body)) : undefined;
    this.requetes.push({ methode, table, lignes: Array.isArray(corps) ? corps.length : corps ? 1 : 0 });
    const filtres = [...url.searchParams.entries()];

    if (table === 'enregistrements') {
      if (methode === 'GET') {
        let lignes = [...this.enregistrements.values()].sort((a, b) =>
          a.collection === b.collection ? (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) : a.collection < b.collection ? -1 : 1,
        );
        for (const [k, v] of filtres) {
          if (k === 'collection' || k === 'id') lignes = lignes.filter((l) => `eq.${l[k]}` === v);
        }
        const offset = Number(url.searchParams.get('offset') ?? 0);
        const limit = Number(url.searchParams.get('limit') ?? 1000);
        return json(200, lignes.slice(offset, offset + limit));
      }
      if (methode === 'POST') {
        const prefer = entetes.get('Prefer') ?? '';
        if (!prefer.includes('resolution=merge-duplicates')) return json(400, { message: 'upsert attendu' });
        for (const l of corps as Ligne[]) this.enregistrements.set(this.cle(l.collection, l.id), { ...l });
        return new Response(null, { status: 201 });
      }
      if (methode === 'DELETE') {
        const collection = url.searchParams.get('collection')?.replace(/^eq\./, '');
        const ids = (url.searchParams.get('id') ?? '')
          .replace(/^in\.\(/, '')
          .replace(/\)$/, '')
          .split(',')
          .map((x) => x.replace(/^"|"$/g, ''));
        for (const id of ids) this.enregistrements.delete(this.cle(collection ?? '', id));
        return new Response(null, { status: 204 });
      }
    }
    if (table === 'etat_automatisations') {
      if (methode === 'GET') return json(200, this.etatAuto ? [this.etatAuto] : []);
      if (methode === 'POST') {
        this.etatAuto = { actives: {}, evenements: [], ...(this.etatAuto ?? {}), ...(corps as object) };
        return new Response(null, { status: 201 });
      }
    }
    return json(404, { code: 'PGRST205', message: `Could not find the table 'erp.${table}' in the schema cache` });
  };
}

function json(status: number, corps: unknown): Response {
  return new Response(JSON.stringify(corps), { status, headers: { 'Content-Type': 'application/json' } });
}

class FauxStockage {
  valeurs = new Map<string, string>();
  getItem(k: string) {
    return this.valeurs.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.valeurs.set(k, v);
  }
}

/* ------------------------------------------------------------------ outils */

let echecs = 0;
let reussites = 0;
function verifier(condition: boolean, libelle: string, detail?: unknown) {
  if (condition) {
    reussites += 1;
    console.log(`  ok  ${libelle}`);
  } else {
    echecs += 1;
    console.log(`  ÉCHEC  ${libelle}`, detail ?? '');
  }
}

const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));

function nouveauClient(base: FausseBase): ClientErp {
  return createClient('https://exemple.supabase.co', 'cle-anon-de-test', {
    db: { schema: 'erp' },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: base.fetch as typeof fetch },
  }) as ClientErp;
}

function nouvelleSynchro(base: FausseBase, extra: Partial<ConstructorParameters<typeof Synchro>[0]> = {}) {
  const etats: EtatSynchro[] = [];
  const distants: ChangementDistant[][] = [];
  const s = new Synchro({
    client: nouveauClient(base),
    stockage: new FauxStockage(),
    ecouterNavigateur: false,
    delaiRegroupement: 1,
    surEtat: (e) => etats.push(e),
    surDistant: (c) => distants.push(c),
    ...extra,
  });
  return { s, etats, distants };
}

const ligneDe = (d: ErpDonnees) =>
  COLLECTIONS_SYNCHRONISEES.reduce((n, c) => n + (d[c] as unknown[]).length, 0);

/** Comparaison indépendante de l'ordre (le journal est trié, les autres non). */
function memesDonnees(a: ErpDonnees, b: ErpDonnees): boolean {
  return COLLECTIONS_SYNCHRONISEES.every((c) => {
    const tri = (x: unknown[]) => (x as { id: string }[]).map((e) => JSON.stringify(e)).sort();
    return JSON.stringify(tri(a[c] as unknown[])) === JSON.stringify(tri(b[c] as unknown[]));
  });
}

function logementTest(id: string): Logement {
  const seed = creerSeed();
  const modele = seed.logements.find((l) => l.statut === 'actif')!;
  return { ...structuredClone(modele), id, nom: `Logement test ${id}`, proprietaireId: 'pro-test' };
}

/* ------------------------------------------------------------------ scénarios */

async function principal() {
  // Les échecs simulés sont attendus : on garde la sortie lisible.
  console.warn = () => undefined;
  console.log('1. Base vide');
  {
    const base = new FausseBase();
    const { s } = nouvelleSynchro(base);
    const d = await s.chargerTout();
    verifier(ligneDe(d) === 0 && Object.keys(donneesVides()).every((c) => Array.isArray((d as unknown as Record<string, unknown>)[c])), 'toutes les collections présentes et vides');
    const r = executerAutomatisations(d, { date: AUJOURDHUI, maintenant: MAINTENANT });
    verifier(r.changements.length === 0, 'le moteur ne fabrique rien sur une base vide', r.changements);
    base.reinitialiserCompteurs();
    await s.sauvegarderDifferences(d, r.donnees, 'Automatisation');
    verifier(base.requetes.length === 0, 'aucune requête quand rien ne change', base.requetes);

    console.log('2. Création, modification, suppression d’un logement');
    const l = logementTest('log-test-1');
    const apresCreation = { ...d, logements: [l] };
    base.reinitialiserCompteurs();
    const ok1 = await s.sauvegarderDifferences(d, apresCreation, 'Kamel');
    verifier(ok1 && base.compter('POST') === 1 && base.requetes.length === 1, 'création : une seule écriture (upsert)', base.requetes);
    verifier(JSON.stringify(base.enregistrements.get(base.cle('logements', 'log-test-1'))?.donnees) === JSON.stringify(l), 'contenu complet enregistré dans donnees');
    verifier(String(base.enregistrements.get(base.cle('logements', 'log-test-1'))?.maj_par).startsWith('Kamel#'), 'maj_par signé auteur + onglet');

    const modifie = { ...l, nom: 'Nouveau nom' };
    const apresModif = { ...apresCreation, logements: [modifie] };
    base.reinitialiserCompteurs();
    await s.sauvegarderDifferences(apresCreation, apresModif, 'Kamel');
    verifier(base.compter('POST') === 1 && base.requetes.length === 1 && base.requetes[0].lignes === 1, 'modification : une écriture d’une ligne', base.requetes);
    verifier((base.enregistrements.get(base.cle('logements', 'log-test-1'))?.donnees as Logement).nom === 'Nouveau nom', 'nouvelle valeur en base');

    const copieIdentique = { ...apresModif, logements: [structuredClone(modifie)] };
    base.reinitialiserCompteurs();
    await s.sauvegarderDifferences(apresModif, copieIdentique, 'Kamel');
    verifier(base.requetes.length === 0, 'objet recopié à l’identique : aucune écriture');

    base.reinitialiserCompteurs();
    await s.sauvegarderDifferences(copieIdentique, { ...copieIdentique, logements: [] }, 'Kamel');
    verifier(base.compter('DELETE') === 1 && base.requetes.length === 1, 'suppression : une seule requête DELETE', base.requetes);
    verifier(!base.enregistrements.has(base.cle('logements', 'log-test-1')), 'ligne supprimée en base');
    verifier(s.enAttente === 0, 'file vide après envoi');
    s.arreter();
  }

  console.log('3. Jeu complet et travail du moteur');
  {
    const base = new FausseBase();
    const { s } = nouvelleSynchro(base);
    const vide = await s.chargerTout();
    const seed = { ...creerSeed(), utilisateurs: [] };
    await s.sauvegarderDifferences(vide, seed, 'Import');
    const relu = await s.chargerTout();
    verifier(memesDonnees(relu, seed), `aller-retour du jeu complet (${ligneDe(seed)} éléments)`);

    const r = executerAutomatisations(relu, { date: AUJOURDHUI, maintenant: MAINTENANT });
    base.reinitialiserCompteurs();
    await s.sauvegarderDifferences(relu, r.donnees, 'Automatisation');
    const apresMoteur = await s.chargerTout();
    verifier(r.changements.length > 0 && memesDonnees(apresMoteur, r.donnees), `créations du moteur enregistrées (${r.changements.length} changements)`);
    const ecritures = base.requetes.filter((q) => q.methode === 'POST').reduce((n, q) => n + (q.lignes ?? 0), 0);
    const attendues = differences(relu, r.donnees).length;
    verifier(ecritures === attendues, `seules les différences partent (${ecritures} lignes)`, { ecritures, attendues });

    // Réservation créée par un membre : le ménage automatique doit être enregistré avec elle.
    const logement = apresMoteur.logements.find((l) => l.statut === 'actif')!;
    const depart = ajouterJours(AUJOURDHUI, 40);
    const resa: Reservation = {
      ...structuredClone(apresMoteur.reservations[0]),
      id: 'res-test-auto',
      logementId: logement.id,
      canal: 'direct',
      statut: 'confirmee',
      arrivee: ajouterJours(AUJOURDHUI, 37),
      depart,
      nuits: 3,
    };
    const avant = apresMoteur;
    const r2 = executerAutomatisations({ ...avant, reservations: [...avant.reservations, resa] }, { date: AUJOURDHUI, maintenant: MAINTENANT });
    const menage = r2.donnees.missions.find((m) => m.reservationId === 'res-test-auto');
    await s.sauvegarderDifferences(avant, r2.donnees, 'Abdel');
    verifier(!!menage && base.enregistrements.has(base.cle('missions', menage.id)), 'ménage créé par le moteur enregistré en base', menage?.id);
    verifier(base.enregistrements.has(base.cle('reservations', 'res-test-auto')), 'réservation enregistrée');
    s.arreter();
  }

  console.log('3 bis. Pagination');
  {
    const base = new FausseBase();
    for (let i = 0; i < 2500; i++) {
      const id = `jrn-${String(i).padStart(5, '0')}`;
      base.enregistrements.set(base.cle('journal', id), { collection: 'journal', id, donnees: { id, horodatage: `2026-09-01T10:${String(i % 60).padStart(2, '0')}:00+02:00` } });
    }
    const { s } = nouvelleSynchro(base);
    base.reinitialiserCompteurs();
    const d = await s.chargerTout();
    verifier(d.journal.length === 2500 && base.compter('GET') === 3, '2 500 lignes lues en 3 pages de 1 000', { lignes: d.journal.length, pages: base.compter('GET') });
    verifier(d.journal[0].horodatage >= d.journal[d.journal.length - 1].horodatage, 'journal du plus récent au plus ancien');
    s.arreter();
  }

  console.log('4. Temps réel');
  {
    const base = new FausseBase();
    const { s, distants } = nouvelleSynchro(base);
    s.activerDistant();
    const donnees = { id: 'log-x', nom: 'X' };
    s.recevoir({ eventType: 'UPDATE', table: 'enregistrements', new: { collection: 'logements', id: 'log-x', donnees, maj_par: `Kamel#${s.idOnglet}` } });
    await attendre(10);
    verifier(distants.length === 0, 'écho de nos propres écritures ignoré');
    s.recevoir({ eventType: 'INSERT', table: 'enregistrements', new: { collection: 'logements', id: 'log-x', donnees, maj_par: 'Abdel#autre-onglet' } });
    s.recevoir({ eventType: 'DELETE', table: 'enregistrements', old: { collection: 'charges', id: 'chg-1' } });
    s.recevoir({ eventType: 'INSERT', table: 'enregistrements', new: { collection: 'inconnue', id: 'z', donnees: {} } });
    await attendre(10);
    const lot = distants.flat();
    verifier(lot.length === 2 && lot[0].donnees?.nom === 'X' && lot[1].donnees === null, 'changement d’un autre membre et suppression livrés (regroupés)', lot);

    // Modification locale en attente (réseau coupé) : la version distante ne l'écrase pas.
    base.pannes = 100;
    const d0 = donneesVides();
    const d1 = { ...d0, logements: [{ ...logementTest('log-y') }] };
    await s.sauvegarderDifferences(d0, d1, 'Kamel');
    distants.length = 0;
    s.recevoir({ eventType: 'UPDATE', table: 'enregistrements', new: { collection: 'logements', id: 'log-y', donnees: { id: 'log-y' }, maj_par: 'Abdel#autre' } });
    await attendre(10);
    verifier(distants.length === 0, 'modification locale en attente prioritaire sur la version distante');
    s.arreter();
  }

  console.log('4 bis. Relecture complète pendant des modifications');
  {
    const base = new FausseBase();
    const { s } = nouvelleSynchro(base);
    s.activerDistant();
    const d0 = donneesVides();
    const repere = s.repere();
    const instantane = await s.chargerTout(); // lu AVANT les deux changements ci-dessous
    const d1 = { ...d0, logements: [logementTest('log-pendant')] };
    await s.sauvegarderDifferences(d0, d1, 'Kamel'); // écrit et confirmé pendant la lecture
    s.recevoir({ eventType: 'INSERT', table: 'enregistrements', new: { collection: 'charges', id: 'chg-distante', donnees: { id: 'chg-distante', libelle: 'Distante' }, maj_par: 'Abdel#autre' } });
    await attendre(10);
    const rejoue = s.appliquerFile(instantane, repere);
    verifier(rejoue.logements.some((l) => l.id === 'log-pendant'), 'écriture confirmée pendant la lecture conservée à l’écran');
    verifier(rejoue.charges.some((c) => c.id === 'chg-distante'), 'changement distant reçu pendant la lecture conservé');
    s.arreter();
  }

  console.log('5. Échec réseau, nouvel essai, file persistante');
  {
    const base = new FausseBase();
    const stockage = new FauxStockage();
    const { s, etats } = nouvelleSynchro(base, { stockage });
    const d0 = donneesVides();
    const d1 = { ...d0, logements: [logementTest('log-z')] };
    base.pannes = 1;
    const ok = await s.sauvegarderDifferences(d0, d1, 'Kamel');
    const etat = etats[etats.length - 1];
    verifier(!ok && etat.statut === 'erreur' && etat.enAttente === 1 && !!etat.prochainEssai, 'échec signalé (statut erreur, 1 en attente, essai programmé)', etat);
    verifier((stockage.getItem('lm-erp-file-attente') ?? '').includes('log-z'), 'modification recopiée dans localStorage');
    await attendre(1300);
    verifier(base.enregistrements.has(base.cle('logements', 'log-z')) && s.enAttente === 0, 'nouvel essai automatique réussi');
    verifier(etats[etats.length - 1].statut === 'a_jour', 'statut revenu à « à jour »');
    const slots = JSON.parse(stockage.getItem('lm-erp-file-attente') ?? '{}');
    verifier(Object.keys(slots).length === 0, 'file locale effacée une fois tout enregistré', slots);

    // Onglet fermé hors ligne : la session suivante reprend sa file.
    const { s: a } = nouvelleSynchro(base, { stockage });
    base.pannes = 100;
    const d2 = { ...d0, charges: [{ id: 'chg-hors-ligne', date: AUJOURDHUI, libelle: 'Test', categorie: 'autre' as const, montantCentimes: 1200 }] };
    await a.sauvegarderDifferences(d0, d2, 'Abdel');
    a.arreter();
    base.pannes = 0;
    const { s: b } = nouvelleSynchro(base, { stockage });
    verifier(b.enAttente === 1, 'file d’un onglet fermé reprise par la session suivante');
    const relu = b.appliquerFile(await b.chargerTout());
    verifier(relu.charges.some((c) => c.id === 'chg-hors-ligne'), 'modification en attente visible à l’écran avant envoi');
    await b.envoyer();
    verifier(base.enregistrements.has(base.cle('charges', 'chg-hors-ligne')) && b.enAttente === 0, 'modification hors ligne finalement enregistrée');
    b.arreter();
    s.arreter();
  }

  console.log('6. État des automatisations');
  {
    const base = new FausseBase();
    const { s } = nouvelleSynchro(base);
    verifier((await s.lireEtatAuto()) === null, 'aucun état au départ');
    await s.enregistrerEtatAuto('actives', { 'attribution-auto': false });
    await s.enregistrerEtatAuto('evenements', [{ id: 'e1' }]);
    const e = await s.lireEtatAuto();
    verifier(JSON.stringify(e?.actives) === '{"attribution-auto":false}' && Array.isArray(e?.evenements) && e!.evenements.length === 1, 'chaque champ écrit sans écraser l’autre', e);
    s.arreter();
  }

  console.log('7. Base non installée');
  {
    const base = new FausseBase();
    base.schemaAbsent = true;
    const { s } = nouvelleSynchro(base);
    try {
      await s.chargerTout();
      verifier(false, 'une erreur était attendue');
    } catch (e) {
      verifier(e instanceof ErreurSynchro && e.genre === 'base_absente', 'schéma absent reconnu : « base non installée »', e);
    }
    s.arreter();
  }

  console.log(`\n${reussites} vérifications réussies, ${echecs} échec${echecs > 1 ? 's' : ''}.`);
  (globalThis as { process?: { exitCode?: number } }).process!.exitCode = echecs ? 1 : 0;
}

void principal();
