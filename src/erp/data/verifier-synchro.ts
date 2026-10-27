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
import { executerAutomatisations, REGLES } from '../automatisations';
import { COLLECTIONS_SYNCHRONISEES, donneesVides } from './collections';
import {
  COLLECTIONS_GERANT_SEULEMENT,
  ELEMENTS_GERANT_SEULEMENT,
  ID_REGLAGES_AGENT,
  MESSAGE_REFUS_FACTURE,
  MESSAGE_REFUS_GERANT,
  ecritureGerantSeulement,
  messageRefus,
  operationReserveeAuGerant,
  traceRefus,
} from './ecritures-gerant';
import { AUJOURDHUI, MAINTENANT, ajouterJours } from './format';
import { REGLAGES_AGENT_GERANT } from './messagerie-ia';
import { clesActives, REGLES_CHANNEL_MANAGER } from './regles-actives';
import { creerSeed } from './seed';
import { CODES_REFUS_BASE, ErreurSynchro, Synchro, differences, erreurDeLigne, refusParLaBase, type ChangementDistant, type EtatSynchro, type RefusBase } from './synchro';
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
  /**
   * Refus de la base pour une ligne (règle RLS, déclencheur) : toute la
   * requête échoue, comme une instruction Postgres. null : acceptée.
   */
  refus: ((methode: 'POST' | 'DELETE', collection: string, id: string) => { status: number; corps: Record<string, unknown> | string } | null) | null = null;
  /** Lecture d'une ligne en panne (503) : relecture impossible. */
  lectureEnPanne = false;

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
        if (this.lectureEnPanne) return json(503, { message: 'Service Unavailable' });
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
        for (const l of corps as Ligne[]) {
          const r = this.refus?.('POST', l.collection, l.id);
          if (r) return reponseRefus(r);
        }
        for (const l of corps as Ligne[]) this.enregistrements.set(this.cle(l.collection, l.id), { ...l });
        return new Response(null, { status: 201 });
      }
      if (methode === 'DELETE') {
        const collection = url.searchParams.get('collection')?.replace(/^eq\./, '');
        const brut = url.searchParams.get('id') ?? '';
        const ids = brut.startsWith('eq.')
          ? [brut.slice(3)]
          : brut
              .replace(/^in\.\(/, '')
              .replace(/\)$/, '')
              .split(',')
              .map((x) => x.replace(/^"|"$/g, ''));
        for (const id of ids) {
          const r = this.refus?.('DELETE', collection ?? '', id);
          if (r) return reponseRefus(r);
        }
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

/** Refus simulé : erreur PostgREST (JSON), ou page HTML d'un pare-feu (texte). */
function reponseRefus(r: { status: number; corps: Record<string, unknown> | string }): Response {
  return typeof r.corps === 'string'
    ? new Response(r.corps, { status: r.status, headers: { 'Content-Type': 'text/html' } })
    : json(r.status, { details: null, hint: null, ...r.corps });
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

  console.log('8. Écriture refusée par la base : retirée de la file, signalée une fois, jamais réessayée sans fin');
  {
    const RLS = { status: 403, corps: { code: '42501', message: 'new row violates row-level security policy "ecritures reservees aux gerants (ajout)" for table "enregistrements"' } };
    verifier(
      refusParLaBase(RLS.corps, 403) &&
        refusParLaBase({ code: 'LMF01', message: 'Facture numérotée : seuls le paiement et le partage changent encore.' }, 400) &&
        refusParLaBase({ code: 'LMF02', message: 'Facture : son numéro est attribué par la base à la validation.' }, 400) &&
        refusParLaBase({ code: '42501', message: 'Seul un gérant change ces réglages de l’agent.' }, 403),
      'refus définitifs reconnus : règle RLS, déclencheurs (42501, LMF01, LMF02)',
    );
    verifier(
      !refusParLaBase({ message: 'fetch failed' }, 0) &&
        !refusParLaBase({ message: 'Service Unavailable' }, 503) &&
        !refusParLaBase({ code: 'PGRST301', message: 'JWT expired' }, 401) &&
        !refusParLaBase({ code: '42501', message: 'new row violates row-level security policy for table "enregistrements"' }, 401) &&
        !refusParLaBase({ code: '42501', message: 'permission denied for table enregistrements' }, 403) &&
        !refusParLaBase({ message: '<html><body>403 Forbidden</body></html>' }, 403) &&
        !refusParLaBase({ message: 'Forbidden' }, 403) &&
        !refusParLaBase(null),
      'réessayés comme avant : réseau, 5xx, session expirée, droit manquant sur la table, 403 sans code (pare-feu, proxy)',
    );
    verifier(
      erreurDeLigne({ code: '22P05', message: 'unsupported Unicode escape sequence' }, 400) &&
        erreurDeLigne({ code: '23505', message: 'duplicate key value' }, 409) &&
        erreurDeLigne({ message: 'Payload Too Large' }, 413) &&
        erreurDeLigne({ code: 'LMF01', message: 'Facture numérotée' }, 400),
      'données refusées pour une ligne : caractère nul, doublon, trop gros, facture figée',
    );
    verifier(
      !erreurDeLigne({ message: 'Forbidden' }, 403) &&
        !erreurDeLigne({ code: 'PGRST204', message: 'Could not find the \'espace\' column of \'enregistrements\' in the schema cache' }, 400) &&
        !erreurDeLigne({ code: '42703', message: 'column "espace" does not exist' }, 400) &&
        !erreurDeLigne({ message: 'Too Many Requests' }, 429) &&
        !erreurDeLigne({ message: 'Request Timeout' }, 408) &&
        !erreurDeLigne({ code: 'PGRST301', message: 'JWT expired' }, 401) &&
        !erreurDeLigne({ message: 'Bad Request' }, 400),
      'jamais une erreur de ligne : 403 sans code, schéma (PGRST, 42703), 429, 408, 401, 400 sans code',
    );

    // Un lot de trois lignes : facture figée (LMF01), réglage réservé au gérant (RLS), logement accepté.
    const base = new FausseBase();
    const refus: RefusBase[][] = [];
    const { s, etats, distants } = nouvelleSynchro(base, { surRefus: (r) => refus.push(r), enLigne: () => true });
    s.activerDistant();
    base.enregistrements.set(base.cle('factures', 'fac-figee'), { collection: 'factures', id: 'fac-figee', donnees: { id: 'fac-figee', numero: '2026-0001', montantHtCentimes: 100 }, maj_par: 'g#numerotation' });
    base.refus = (methode, c, id) =>
      c === 'factures' && id === 'fac-figee'
        ? { status: 400, corps: { code: 'LMF01', message: methode === 'DELETE' ? 'Facture numérotée : elle ne se supprime pas (faites un avoir).' : 'Facture numérotée : seuls le paiement et le partage changent encore.' } }
        : c === 'reglages' && id === 'societe'
          ? RLS
          : null;
    const avant = donneesVides();
    const apres = {
      ...avant,
      factures: [{ id: 'fac-figee', numero: '2026-0001', montantHtCentimes: 1 }],
      reglages: [{ id: 'societe', raisonSociale: 'Autre' }],
      logements: [logementTest('log-ok')],
    } as unknown as ErpDonnees;
    base.reinitialiserCompteurs();
    const ok = await s.sauvegarderDifferences(avant, apres, 'Abdel');
    await attendre(40);
    verifier(ok && s.enAttente === 0, 'lot refusé en partie : file vidée', s.lireEtat());
    verifier(base.enregistrements.has(base.cle('logements', 'log-ok')), 'les lignes acceptées du lot sont enregistrées');
    verifier(
      (base.enregistrements.get(base.cle('factures', 'fac-figee'))!.donnees as { montantHtCentimes: number }).montantHtCentimes === 100 && !base.enregistrements.has(base.cle('reglages', 'societe')),
      'les lignes refusées ne sont pas écrites',
    );
    verifier(refus.length === 1 && refus[0].map((r) => r.id).sort().join() === 'fac-figee,societe', 'signalé une seule fois, avec les deux lignes refusées', refus);
    verifier(base.compter('POST') === 4, 'un envoi groupé, puis ligne par ligne (3 lignes)', base.requetes);
    verifier(etats[etats.length - 1].statut === 'a_jour', 'statut « à jour » : pas d’erreur affichée en boucle', etats[etats.length - 1]);
    const recus = distants.flat();
    verifier(
      recus.some((c) => c.id === 'fac-figee' && (c.donnees as { montantHtCentimes?: number } | null)?.montantHtCentimes === 100) && recus.some((c) => c.id === 'societe' && c.donnees === null),
      'version de la base relue et reposée (facture d’origine, réglage absent retiré)',
      recus,
    );
    verifier(
      messageRefus(refus[0]) === MESSAGE_REFUS_GERANT && messageRefus([{ collection: 'factures', id: 'f', message: '', code: 'LMF01' }]) === MESSAGE_REFUS_FACTURE,
      'message : « réservée au gérant ou facture déjà validée », ou facture validée entre-temps',
    );
    const trace = traceRefus(refus[0], { auteur: 'Abdel', id: 'jrn-1', horodatage: MAINTENANT });
    verifier(
      trace.action === 'Modification non enregistrée' && trace.entite === 'factures' && trace.entiteId === 'fac-figee' && !/fac-figee|Autre/.test(trace.details),
      'ligne de journal : la fiche concernée (entité), un détail lisible sans identifiant ni contenu',
      trace,
    );
    await attendre(1300);
    verifier(base.compter('POST') === 4, 'aucun nouvel essai ensuite', base.requetes);

    // Suppression d'une facture numérotée : refusée par le déclencheur, la facture revient.
    const avecFacture = { ...donneesVides(), factures: [{ id: 'fac-figee', numero: '2026-0001', montantHtCentimes: 100 }] } as unknown as ErpDonnees;
    await s.sauvegarderDifferences(avecFacture, donneesVides(), 'Abdel');
    await attendre(40);
    verifier(
      s.enAttente === 0 && base.enregistrements.has(base.cle('factures', 'fac-figee')) && refus.length === 2 && refus[1][0].code === 'LMF01' && distants.flat().filter((c) => c.id === 'fac-figee' && c.donnees).length >= 2,
      'suppression refusée : retirée de la file, facture reposée dans l’ERP',
      refus,
    );
    s.arreter();

    // Pare-feu ou proxy : 403 en HTML, sans code Postgres, sur chaque ligne. Rien n'est retiré : nouvel essai.
    {
      const b = new FausseBase();
      const r403: RefusBase[][] = [];
      const { s: s4, etats: e4 } = nouvelleSynchro(b, { surRefus: (r) => r403.push(r), enLigne: () => true });
      let pareFeu = true;
      b.refus = () => (pareFeu ? { status: 403, corps: '<html><body><h1>403 Forbidden</h1>Request blocked.</body></html>' } : null);
      const deux = { ...avant, logements: [logementTest('log-pf-1'), logementTest('log-pf-2')] } as unknown as ErpDonnees;
      const ok4 = await s4.sauvegarderDifferences(avant, deux, 'Abdel');
      verifier(
        !ok4 && s4.enAttente === 2 && !r403.length && e4[e4.length - 1].statut === 'erreur' && b.compter('POST') === 1,
        '403 sans code (page HTML d’un pare-feu) : rien retiré de la file, aucun « réservée au gérant », nouvel essai programmé',
        { enAttente: s4.enAttente, refus: r403, etat: e4[e4.length - 1], requetes: b.requetes },
      );
      pareFeu = false;
      await attendre(1300);
      verifier(s4.enAttente === 0 && b.enregistrements.has(b.cle('logements', 'log-pf-1')) && b.enregistrements.has(b.cle('logements', 'log-pf-2')), 'pare-feu levé : les deux lignes enregistrées au nouvel essai');
      s4.arreter();
    }

    // Données refusées pour une seule ligne (22P05) : elle seule est retirée, les autres partent ; PGRST204 : tout réessayé.
    {
      const b = new FausseBase();
      const r22: RefusBase[][] = [];
      const { s: s5, etats: e5 } = nouvelleSynchro(b, { surRefus: (r) => r22.push(r), enLigne: () => true });
      b.refus = (_m, _c, id) => (id === 'log-nul' ? { status: 400, corps: { code: '22P05', message: 'unsupported Unicode escape sequence' } } : null);
      const ok5 = await s5.sauvegarderDifferences(avant, { ...avant, logements: [logementTest('log-nul'), logementTest('log-sain')] } as unknown as ErpDonnees, 'Abdel');
      await attendre(40);
      verifier(
        ok5 && s5.enAttente === 0 && b.enregistrements.has(b.cle('logements', 'log-sain')) && !b.enregistrements.has(b.cle('logements', 'log-nul')) && r22.length === 1 && r22[0][0].code === '22P05',
        'ligne aux données refusées (22P05) : retirée seule, l’autre enregistrée, signalé une fois, file débloquée',
        r22,
      );
      verifier(e5[e5.length - 1].statut === 'a_jour', 'puis statut « à jour »');
      s5.arreter();

      const b2 = new FausseBase();
      const rSchema: RefusBase[][] = [];
      const { s: s6 } = nouvelleSynchro(b2, { surRefus: (r) => rSchema.push(r), enLigne: () => true });
      b2.refus = () => ({ status: 400, corps: { code: 'PGRST204', message: 'Could not find the \'espace\' column of \'enregistrements\' in the schema cache' } });
      const ok6 = await s6.sauvegarderDifferences(avant, { ...avant, logements: [logementTest('log-schema')] } as unknown as ErpDonnees, 'Abdel');
      verifier(!ok6 && s6.enAttente === 1 && !rSchema.length && b2.compter('POST') === 1, 'erreur de schéma (PGRST204) : rien retiré, nouvel essai (toutes les lignes y passeraient)');
      s6.arreter();

      const b3 = new FausseBase();
      const r429: RefusBase[][] = [];
      const { s: s7 } = nouvelleSynchro(b3, { surRefus: (r) => r429.push(r), enLigne: () => true });
      b3.refus = () => ({ status: 429, corps: { message: 'Too Many Requests' } });
      const ok7 = await s7.sauvegarderDifferences(avant, { ...avant, logements: [logementTest('log-429')] } as unknown as ErpDonnees, 'Abdel');
      verifier(!ok7 && s7.enAttente === 1 && !r429.length, '429 (trop de requêtes) : rien retiré, nouvel essai');
      s7.arreter();
    }

    // v1 acceptée puis v2 refusée sur la même ligne : une relecture complète lue avant v1 rejoue v1, pas v2.
    {
      const b = new FausseBase();
      let resynchros = 0;
      const { s: s8 } = nouvelleSynchro(b, { enLigne: () => true, surResynchro: () => (resynchros += 1) });
      s8.activerDistant();
      const repere = s8.repere();
      const v1 = { ...logementTest('log-v'), nom: 'Version 1' };
      const avecV1 = { ...avant, logements: [v1] } as unknown as ErpDonnees;
      await s8.sauvegarderDifferences(avant, avecV1, 'Abdel');
      b.refus = (_m, _c, id) => (id === 'log-v' ? { status: 403, corps: { code: '42501', message: 'new row violates row-level security policy for table "enregistrements"' } } : null);
      b.lectureEnPanne = true;
      await s8.sauvegarderDifferences(avecV1, { ...avant, logements: [{ ...v1, nom: 'Version 2' }] } as unknown as ErpDonnees, 'Abdel');
      await attendre(40);
      const rejoue = s8.appliquerFile(donneesVides(), repere);
      verifier(
        (b.enregistrements.get(b.cle('logements', 'log-v'))!.donnees as { nom: string }).nom === 'Version 1' && rejoue.logements.find((l) => l.id === 'log-v')?.nom === 'Version 1',
        'relecture complète : la version acceptée (v1) est rejouée, jamais la version refusée (v2)',
        rejoue.logements,
      );
      // Le client réessaie lui-même une lecture en 503 quelques fois avant de rendre l'erreur.
      for (let i = 0; i < 100 && !resynchros; i++) await attendre(100);
      verifier(resynchros >= 1, 'relecture de la ligne refusée impossible : relecture complète demandée', resynchros);
      s8.arreter();
    }

    // Panne du serveur (5xx) : comportement d'avant, gardé en file et réessayé.
    const base2 = new FausseBase();
    const refus2: RefusBase[][] = [];
    const { s: s2, etats: etats2 } = nouvelleSynchro(base2, { surRefus: (r) => refus2.push(r), enLigne: () => true });
    let panne = true;
    base2.refus = () => (panne ? { status: 503, corps: { message: 'Service Unavailable' } } : null);
    const ok2 = await s2.sauvegarderDifferences(avant, { ...avant, logements: [logementTest('log-5xx')] }, 'Abdel');
    verifier(!ok2 && s2.enAttente === 1 && etats2[etats2.length - 1].statut === 'erreur' && !refus2.length, 'erreur 5xx : gardée en file, nouvel essai programmé, pas un refus');
    panne = false;
    await attendre(1300);
    verifier(s2.enAttente === 0 && base2.enregistrements.has(base2.cle('logements', 'log-5xx')), 'nouvel essai réussi après la panne');
    s2.arreter();

    // Compte qui n'est pas gérant : ce que la base lui refuserait n'entre pas dans la file.
    verifier(
      ecritureGerantSeulement('factures', 'fm-x') &&
        ecritureGerantSeulement('conseilsPrix', 'etat') &&
        ecritureGerantSeulement('reglages', 'societe') &&
        ecritureGerantSeulement('reglages', 'alerte-controle-agent') &&
        !ecritureGerantSeulement('conseilsPrix', 'decision-1') &&
        !ecritureGerantSeulement('reglages', 'agent') &&
        !ecritureGerantSeulement('avisADeposer', 'a1'),
      'écritures réservées : factures, état et réglages des prix, société, alerte de l’agent ; pas les décisions ni les avis',
    );
    const base3 = new FausseBase();
    const refus3: RefusBase[][] = [];
    const agent = { id: 'agent', autonomie: 'valider', ton: 'a' };
    const societe = { id: 'societe', raisonSociale: 'LM' };
    base3.enregistrements.set(base3.cle('reglages', 'agent'), { collection: 'reglages', id: 'agent', donnees: agent });
    base3.enregistrements.set(base3.cle('reglages', 'societe'), { collection: 'reglages', id: 'societe', donnees: societe });
    const { s: s3, distants: d3 } = nouvelleSynchro(base3, { surRefus: (r) => refus3.push(r), ecritureInterdite: operationReserveeAuGerant, enLigne: () => true });
    s3.activerDistant();
    const av = { ...donneesVides(), reglages: [agent, societe] } as unknown as ErpDonnees;
    const ap = {
      ...av,
      reglages: [{ ...agent, autonomie: 'autonome' }, { ...societe, raisonSociale: 'Autre' }],
      factures: [{ id: 'fac-ops', numero: '' }],
      avisADeposer: [{ id: 'avis-1', statut: 'fait' }],
    } as unknown as ErpDonnees;
    verifier(
      differences(av, ap).filter((op) => operationReserveeAuGerant(op, av)).length === 3 && !operationReserveeAuGerant({ type: 'ecrire', collection: 'reglages', id: 'agent', donnees: { ...agent, ton: 'b' } }, av),
      'opérations écartées : autonomie changée, société, facture ; le ton de l’agent reste permis',
    );
    const ecrireAgent = (donnees: Record<string, unknown>) => ({ type: 'ecrire' as const, collection: 'reglages' as const, id: 'agent', donnees: { id: 'agent', ...donnees } });
    verifier(
      ['actif', 'horaires', 'transmettre', 'delaiAlerteMinutes'].every((k) => operationReserveeAuGerant(ecrireAgent({ ...agent, [k]: 'autre' }), av)),
      'marche, horaires, ce qu’il confie, délai : écartés comme le niveau d’autonomie (même liste que la base)',
    );
    const sansLigne = { ...donneesVides() } as unknown as ErpDonnees;
    verifier(
      operationReserveeAuGerant(ecrireAgent({ ton: 'a', horaires: { mode: 'toujours' } }), sansLigne) && !operationReserveeAuGerant(ecrireAgent({ ton: 'a', signature: 'Inès' }), sansLigne),
      'pas encore de réglages de l’agent : l’équipe les crée avec le ton et la signature, jamais avec les horaires',
    );
    verifier(
      !operationReserveeAuGerant(ecrireAgent({ ...agent, horaires: { fin: '22:00', debut: '08:00', mode: 'plage' } }), { ...av, reglages: [{ ...agent, horaires: { mode: 'plage', debut: '08:00', fin: '22:00' } }] } as unknown as ErpDonnees),
      'mêmes horaires dans un autre ordre de clés : pas un changement (comme en base)',
    );
    base3.reinitialiserCompteurs();
    await s3.sauvegarderDifferences(av, ap, 'Ops');
    await attendre(40);
    verifier(
      base3.compter('POST') === 1 && base3.requetes.find((r) => r.methode === 'POST')?.lignes === 1 && base3.enregistrements.has(base3.cle('avisADeposer', 'avis-1')),
      'compte « opérations » : seule l’écriture permise part (avis à déposer)',
      base3.requetes,
    );
    verifier(
      refus3.length === 1 && refus3[0].map((r) => `${r.collection}/${r.id}`).sort().join() === 'factures/fac-ops,reglages/agent,reglages/societe',
      'écritures réservées au gérant : jamais mises en file, signalées une fois',
      refus3,
    );
    verifier(
      d3.flat().some((c) => c.id === 'agent' && (c.donnees as { autonomie?: string } | null)?.autonomie === 'valider') && d3.flat().some((c) => c.id === 'fac-ops' && c.donnees === null),
      'version de la base reposée (niveau d’autonomie d’origine, facture retirée)',
      d3,
    );
    await s3.sauvegarderDifferences(av, { ...av, reglages: [{ ...agent, ton: 'b' }, societe] } as unknown as ErpDonnees, 'Ops');
    verifier((base3.enregistrements.get(base3.cle('reglages', 'agent'))!.donnees as { ton: string }).ton === 'b', 'réglages de l’agent sans l’autonomie : permis à l’équipe');
    await s3.sauvegarderDifferences(av, { ...av, reglages: [] } as unknown as ErpDonnees, 'Ops');
    verifier(
      base3.enregistrements.has(base3.cle('reglages', 'agent')) && base3.enregistrements.has(base3.cle('reglages', 'societe')) && base3.compter('DELETE') === 0 && refus3.length === 2,
      'suppression des réglages de l’agent ou de la société : écartée avant l’envoi',
    );
    s3.arreter();
  }

  // Modules de Node chargés à l'exécution (l'ERP n'a pas les types de Node).
  const nomFs = 'node:fs';
  const nomChemins = 'node:path';
  const fs = (await import(/* @vite-ignore */ nomFs)) as {
    existsSync(p: string): boolean;
    readFileSync(p: string, e: 'utf8'): string;
    readdirSync(p: string, o: { withFileTypes: true }): { name: string; isDirectory(): boolean }[];
  };
  const chemins = (await import(/* @vite-ignore */ nomChemins)) as { join(...p: string[]): string; dirname(p: string): string; resolve(...p: string[]): string };
  /** Racine du dépôt : le dossier courant ou un parent qui contient supabase/erp-espaces.sql. */
  const racine = (() => {
    let dossier = (globalThis as { process?: { cwd(): string } }).process!.cwd();
    for (let i = 0; i < 6; i++) {
      if (fs.existsSync(chemins.join(dossier, 'supabase', 'erp-espaces.sql'))) return dossier;
      dossier = chemins.dirname(chemins.resolve(dossier));
    }
    return null;
  })();
  const lire = (chemin: string) => (racine && fs.existsSync(chemins.join(racine, chemin)) ? fs.readFileSync(chemins.join(racine, chemin), 'utf8') : '');

  console.log('9. Écritures réservées aux gérants : mêmes listes dans le navigateur et dans la base');
  {
    verifier(!!racine, 'dépôt trouvé (lancer depuis la racine du dépôt)');
    const valeurs = (s: string) => [...s.matchAll(/'([^']*)'/g)].map((x) => x[1]).sort();
    const tsElements = Object.fromEntries(Object.entries(ELEMENTS_GERANT_SEULEMENT).map(([c, ids]) => [c, [...ids].sort()]));
    for (const fichier of ['supabase/erp-espaces.sql', 'supabase/erp-installation.sql', 'supabase/erp-acces-gerants.sql']) {
      const sql = lire(fichier);
      const corps = /create or replace function erp\.ecriture_gerant_seulement[\s\S]*?\$\$([\s\S]*?)\$\$/.exec(sql)?.[1] ?? '';
      const collections = valeurs(/p_collection in \(([^)]*)\)/.exec(corps)?.[1] ?? '');
      const elements: Record<string, string[]> = {};
      for (const e of corps.matchAll(/\(p_collection = '([^']+)' and p_id in \(([^)]*)\)\)/g)) elements[e[1]] = valeurs(e[2]);
      verifier(!!corps, `${fichier} : erp.ecriture_gerant_seulement présente`);
      verifier(JSON.stringify(collections) === JSON.stringify([...COLLECTIONS_GERANT_SEULEMENT].sort()), `${fichier} : mêmes collections réservées que ecritures-gerant.ts`, collections);
      verifier(JSON.stringify(elements) === JSON.stringify(tsElements), `${fichier} : mêmes éléments réservés que ecritures-gerant.ts`, elements);
      verifier(sql.includes(`not (collection = 'reglages' and id = '${ID_REGLAGES_AGENT}')`), `${fichier} : suppression des réglages de l’agent réservée, comme dans le navigateur`);
      verifier(CODES_REFUS_BASE.every((code) => sql.includes(`errcode = '${code}'`)), `${fichier} : codes ${CODES_REFUS_BASE.join(', ')} posés par les déclencheurs`);
      const garde = /create or replace function erp\.garder_autonomie_agent[\s\S]*?\$\$([\s\S]*?)\$\$/.exec(sql)?.[1] ?? '';
      const clesAgent = valeurs(/cles constant text\[\] := array\[([^\]]*)\]/.exec(garde)?.[1] ?? '');
      verifier(
        JSON.stringify(clesAgent) === JSON.stringify([...REGLAGES_AGENT_GERANT].sort()),
        `${fichier} : réglages de l’agent gardés par la base = REGLAGES_AGENT_GERANT (messagerie-ia.ts)`,
        clesAgent,
      );
    }
  }

  console.log('10. Règles des finances : jamais lancées depuis l’ERP');
  {
    const finance = REGLES.filter((r) => r.domaine === 'finance').map((r) => r.cle);
    verifier(finance.includes('relance-factures') && finance.includes('facturation-mensuelle'), 'règles des finances connues', finance);
    const tournent = clesActives(Object.fromEntries(REGLES.map((r) => [r.cle, true])));
    verifier(tournent.every((c) => REGLES_CHANNEL_MANAGER.has(c)) && !tournent.some((c) => finance.includes(c)), 'même toutes allumées, aucune règle des finances ne tourne', tournent);
    verifier([...REGLES_CHANNEL_MANAGER].every((c) => REGLES.some((r) => r.cle === c && r.domaine !== 'finance')), 'règles du channel manager : existantes, hors finances');
    const r = executerAutomatisations(creerSeed(), { date: AUJOURDHUI, maintenant: MAINTENANT, reglesActives: tournent });
    const reservees = r.changements.filter((c) => ecritureGerantSeulement(c.collection, c.id));
    verifier(reservees.length === 0, 'les règles qui tournent n’écrivent rien de réservé au gérant (factures, réglages…)', reservees);
    // Qui lance le moteur ? Le store et la page Automatisations, toujours avec clesActives (regles-actives.ts).
    const fichiers: string[] = [];
    const parcourir = (dossier: string) => {
      for (const e of fs.readdirSync(chemins.join(racine ?? '.', dossier), { withFileTypes: true })) {
        const chemin = `${dossier}/${e.name}`;
        if (e.isDirectory()) parcourir(chemin);
        else if (/\.tsx?$/.test(e.name) && !/^verifier/.test(e.name) && !chemin.startsWith('src/erp/automatisations/')) fichiers.push(chemin);
      }
    };
    if (racine) parcourir('src/erp');
    const lanceurs = fichiers.filter((f) => /executerAutomatisations\(/.test(lire(f))).sort();
    verifier(JSON.stringify(lanceurs) === JSON.stringify(['src/erp/data/store.tsx', 'src/erp/modules/automatisations/index.tsx']), 'moteur lancé seulement par le store et la page Automatisations', lanceurs);
    for (const f of lanceurs) {
      const s = lire(f);
      const appels = [...s.matchAll(/executerAutomatisations\(([\s\S]*?)\}\)/g)].map((m) => m[1]);
      verifier(appels.length > 0 && appels.every((a) => /reglesActives:\s*clesActives\b/.test(a)), `${f} : chaque passage du moteur limité par clesActives`, appels);
    }
    const store = lire('src/erp/data/store.tsx');
    verifier(/from '\.\/regles-actives'/.test(store) && !/new Set\(\[\s*'activation-logement'/.test(store), 'store : règles actives prises dans regles-actives.ts, sans copie locale');
    verifier(/from '\.\.\/\.\.\/\.\.\/data\/regles-actives'/.test(lire('src/erp/modules/automatisations/_composants/useEtatAuto.ts')), 'page Automatisations : mêmes règles actives que le store');
  }

  console.log(`\n${reussites} vérifications réussies, ${echecs} échec${echecs > 1 ? 's' : ''}.`);
  (globalThis as { process?: { exitCode?: number } }).process!.exitCode = echecs ? 1 : 0;
}

void principal();
