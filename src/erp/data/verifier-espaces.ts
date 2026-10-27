/**
 * Auto-contrôle des espaces (espaces.ts et le code qui en dépend) sans base
 * réelle : fausse API Supabase (comptes, PostgREST avec la colonne espace et
 * ses règles, fonctions erp.qui_suis_je…) et fausse API Repull, en mémoire.
 *
 * Vérifie : outils purs (choix de l'espace, préfixe des fichiers, clés
 * locales, en-têtes), workspace Repull sur chaque appel, BaseErp avec ou sans
 * espace (en-tête, filtre, clé), base pas encore préparée, identité et
 * vérification d'un membre (espace demandé, rôle), synchronisation du
 * navigateur (filtres, clés, temps réel, file locale par espace et par
 * compte), plafond mensuel de l'agent IA d'un autre espace.
 * Le côté serveur (routes /api) : scripts/verifier-espaces-serveur.ts.
 *
 * Lancement (Node 18+) :
 *   node_modules/.bin/esbuild src/erp/data/verifier-espaces.ts --bundle --platform=node --format=esm \
 *     --define:import.meta.env='{}' --log-level=error --outfile=/tmp/verifier-espaces.mjs \
 *     && node /tmp/verifier-espaces.mjs
 */
import type Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import {
  ENTETE_ESPACE,
  ESPACE_LABEL_MAISON,
  ID_LABEL_MAISON,
  MESSAGE_BASE_PAS_PREPAREE,
  choisirEspace,
  cleLocale,
  entetesServeur,
  erreurBaseHistorique,
  espaceDesDonnees,
  espaceOuvert,
  estLabelMaison,
  fichierDeLEspace,
  idEspaceValide,
  lireEspacesMembre,
  lireInvitationEspace,
  ouvrirEspace,
  prefixeFichiers,
} from './espaces';
import { SIGNATURE_LABEL_MAISON, nomPourSignature, reglagesAgent, signatureParDefaut } from './reglages';
import { notificationTest } from './notifications';
import { BaseErp, ClientRepull, lireIdentite, verifierMembre } from './repull-synchro';
import { avecClient } from './repull-connexion';
import { COLLECTION_AGENT, ID_ETAT_AGENT, lancerAgent, type ClientIA, type EtatAgent } from './agent-messagerie';
import { REGLAGES_AGENT_DEFAUT } from './reglages';
import { Synchro, type ChangementDistant } from './synchro';
import type { ClientErp } from './supabase';
import type { FilMessages, ReglagesAgent } from './types';

/* ------------------------------------------------------------ assertions */

let echecs = 0;
let reussis = 0;
function verifier(condition: unknown, message: string, detail?: unknown) {
  if (condition) reussis++;
  else {
    echecs++;
    console.error(`  ✗ ${message}`, detail === undefined ? '' : JSON.stringify(detail));
  }
}
function section(titre: string) {
  console.log(`\n${titre}`);
}
const json = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status, headers: { 'Content-Type': 'application/json' } });
const urlDe = (entree: RequestInfo | URL) => new URL(typeof entree === 'string' ? entree : entree instanceof URL ? entree.href : entree.url);

const LM = ID_LABEL_MAISON;
const SENS = '5e5e0000-0000-4000-8000-000000000002';

/* ------------------------------------------------- fausse API Supabase */

interface Ligne {
  espace: string;
  collection: string;
  id: string;
  donnees: unknown;
}

interface Requete {
  methode: string;
  chemin: string;
  url: URL;
  jeton: string;
  espace: string | null;
  corps: unknown;
}

/** Comptes : jeton → adresse. Le compte serveur a son rôle (app_metadata) si `serveurPret`. */
class FausseSupabase {
  historique = false;
  serveurPret = true;
  jetons = new Map<string, string>([
    ['jeton-equipe', 'equipe@labelmaisoncg.fr'],
    ['jeton-serveur', 'serveur@labelmaisoncg.fr'],
    ['jeton-sens', 'gerant-b@exemple.invalid'],
    ['jeton-lecture', 'lecture-b@exemple.invalid'],
  ]);
  membres = [
    { espace: LM, email: 'equipe@labelmaisoncg.fr', role: 'gerant' },
    { espace: SENS, email: 'gerant-b@exemple.invalid', role: 'gerant' },
    { espace: SENS, email: 'lecture-b@exemple.invalid', role: 'lecture' },
  ];
  noms: Record<string, string> = { [LM]: 'Label Maison', [SENS]: 'Sens' };
  lignes = new Map<string, Ligne>();
  requetes: Requete[] = [];

  cle = (e: string, c: string, id: string) => `${e}\u0000${c}\u0000${id}`;
  poser(espace: string, collection: string, e: { id: string }) {
    this.lignes.set(this.cle(espace, collection, e.id), { espace, collection, id: e.id, donnees: JSON.parse(JSON.stringify(e)) });
  }
  get<T>(espace: string, collection: string, id: string): T | undefined {
    return this.lignes.get(this.cle(espace, collection, id))?.donnees as T | undefined;
  }

  /** Espaces lisibles ou modifiables par ce jeton (règles de erp-espaces.sql), en-tête compris. */
  permis(jeton: string, entete: string | null, ecriture: boolean): string[] {
    const email = this.jetons.get(jeton);
    if (!email) return [];
    if (email === 'serveur@labelmaisoncg.fr') return this.serveurPret && entete ? [entete] : [];
    return this.membres
      .filter((m) => m.email === email && (!entete || m.espace === entete) && (ecriture ? m.role !== 'lecture' : true))
      .map((m) => m.espace);
  }

  fetch = async (entree: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = urlDe(entree);
    const h = new Headers(init?.headers);
    const jeton = (h.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
    const methode = (init?.method ?? 'GET').toUpperCase();
    const chemin = url.pathname.replace(/^\/rest\/v1\//, '');
    const corps = init?.body ? JSON.parse(String(init.body)) : undefined;
    const entete = h.get(ENTETE_ESPACE);
    this.requetes.push({ methode, chemin, url, jeton, espace: entete, corps });
    if (url.pathname === '/auth/v1/user') {
      const email = this.jetons.get(jeton);
      return email ? json({ email }) : json({ msg: 'invalid' }, 401);
    }
    if (!this.jetons.has(jeton)) return json({ code: 'PGRST301', message: 'JWT invalide' }, 401);
    if (chemin.startsWith('rpc/')) {
      if (this.historique) return json({ code: 'PGRST202', message: `Could not find the function erp.${chemin.slice(4)} without parameters in the schema cache` }, 404);
      const email = this.jetons.get(jeton)!;
      if (chemin === 'rpc/qui_suis_je') {
        const serveur = email === 'serveur@labelmaisoncg.fr' && this.serveurPret;
        const espaces = serveur ? [] : this.membres.filter((m) => m.email === email).map((m) => ({ id: m.espace, code: m.espace === LM ? 'label-maison' : 'sens', nom: this.noms[m.espace], role: m.role }));
        return json({ email, serveur, espaces });
      }
      return json({ code: 'PGRST202', message: 'inconnue' }, 404);
    }
    if (chemin === 'membres' && methode === 'GET') {
      const email = this.jetons.get(jeton)!;
      return json(this.membres.filter((m) => m.espace === LM && (m.email === email || this.permis(jeton, null, false).includes(LM))).map(({ email: e, role }) => ({ email: e, role })));
    }
    if (chemin !== 'enregistrements' && chemin !== 'etat_automatisations') return json({ code: 'PGRST205', message: chemin }, 404);
    const avecEspace = url.searchParams.has('espace') || (Array.isArray(corps) ? corps.some((l) => 'espace' in l) : !!corps && 'espace' in corps);
    if (this.historique && avecEspace) return json({ code: '42703', message: `column ${chemin}.espace does not exist` }, 400);
    // Base d'avant les espaces : le compte d'équipe voit Label Maison, rien d'autre.
    const lisibles = this.historique ? (this.jetons.get(jeton) === 'equipe@labelmaisoncg.fr' ? [LM] : []) : this.permis(jeton, entete, false);
    const modifiables = this.historique ? lisibles : this.permis(jeton, entete, true);
    const p = url.searchParams;
    const egal = (k: string) => p.get(k)?.replace(/^eq\./, '');
    if (methode === 'GET') {
      const ids = p.get('id')?.startsWith('in.') ? new Set(p.get('id')!.replace(/^in\.\(|\)$/g, '').split(',').map((x) => x.replace(/^"|"$/g, ''))) : null;
      const lignes = [...this.lignes.values()]
        .filter((l) => lisibles.includes(l.espace) && (!egal('espace') || l.espace === egal('espace')) && (!egal('collection') || l.collection === egal('collection')))
        .filter((l) => (!ids || ids.has(l.id)) && (!p.get('id')?.startsWith('eq.') || l.id === egal('id')))
        .sort((a, b) => (a.collection + a.id).localeCompare(b.collection + b.id));
      return json(lignes.map((l) => ({ collection: l.collection, id: l.id, donnees: l.donnees })));
    }
    if (methode === 'POST') {
      const liste = (Array.isArray(corps) ? corps : [corps]) as (Partial<Ligne> & { maj_par?: string })[];
      for (const l of liste) {
        const espace = l.espace ?? LM;
        if (!modifiables.includes(espace)) return json({ code: '42501', message: 'new row violates row-level security policy' }, 403);
        this.lignes.set(this.cle(espace, l.collection ?? 'etat', l.id ?? 'global'), { espace, collection: l.collection ?? 'etat', id: l.id ?? 'global', donnees: l.donnees ?? l });
      }
      return new Response(null, { status: 201 });
    }
    if (methode === 'DELETE') return new Response(null, { status: 204 });
    return json({ message: 'méthode' }, 405);
  };
}

/* ------------------------------------------------------- fausse API Repull */

class FauxRepull {
  appels: { chemin: string; methode: string; workspace: string | null }[] = [];
  fetch = async (entree: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = urlDe(entree);
    const h = new Headers(init?.headers);
    this.appels.push({ chemin: url.pathname, methode: (init?.method ?? 'GET').toUpperCase(), workspace: h.get('x-workspace-id') });
    return json({ data: [], pagination: { hasMore: false, nextCursor: null } });
  };
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

/* --------------------------------------------------------------- scénarios */

async function principal() {
  console.warn = () => undefined;

  section('Outils purs');
  verifier(idEspaceValide(SENS) && !idEspaceValide('sens') && !idEspaceValide(undefined), 'identifiant d’espace : uuid seulement');
  verifier(estLabelMaison(LM) && estLabelMaison(LM.toUpperCase()) && estLabelMaison(null) && !estLabelMaison(SENS), 'Label Maison reconnu (et par défaut)');
  verifier(erreurBaseHistorique({ code: 'PGRST202' }) && erreurBaseHistorique({ code: '42703', message: 'column enregistrements.espace does not exist' }), 'base historique : fonction ou colonne espace absente');
  verifier(!erreurBaseHistorique({ code: '42703', message: 'column x.nom does not exist' }) && !erreurBaseHistorique({ code: 'PGRST106' }), 'autres erreurs : pas « historique »');
  const lus = lireEspacesMembre({ espaces: [{ id: SENS.toUpperCase(), code: 'sens', nom: 'Sens', role: 'gerant' }, { id: 'pas-un-uuid', role: 'gerant' }, null] });
  verifier(lus.length === 1 && lus[0].id === SENS, 'espaces du membre : lecture tolérante', lus);
  const deux = [{ id: SENS }, { id: LM }];
  verifier(choisirEspace(deux, SENS)?.id === SENS && choisirEspace(deux, 'autre')?.id === LM && choisirEspace([{ id: SENS }])?.id === SENS && choisirEspace([]) === null, 'choix de l’espace : demandé, sinon Label Maison, sinon le premier');
  ouvrirEspace(null);
  verifier(espaceDesDonnees() === null && espaceOuvert().id === LM && prefixeFichiers() === '' && cleLocale('cle') === 'cle', 'base historique : rien ne change (Label Maison)');
  verifier(!(ENTETE_ESPACE in entetesServeur('j')) && entetesServeur('j').Authorization === 'Bearer j', 'en-têtes sans espace avant les espaces');
  ouvrirEspace(ESPACE_LABEL_MAISON);
  verifier(prefixeFichiers() === '' && cleLocale('cle') === 'cle' && entetesServeur('j')[ENTETE_ESPACE] === LM, 'Label Maison : mêmes chemins et clés qu’avant, en-tête envoyé');
  ouvrirEspace({ id: SENS, code: 'sens', nom: 'Sens' });
  verifier(prefixeFichiers() === `${SENS}/` && cleLocale('cle') === `cle@${SENS}` && entetesServeur('j', false)[ENTETE_ESPACE] === SENS && !('Content-Type' in entetesServeur('j', false)), 'autre espace : dossier, clés locales et en-tête propres');
  ouvrirEspace(null);

  section('Fichiers d’un espace (signature et dépôt côté serveur)');
  {
    const AUTRE = '7a7a0000-0000-4000-8000-000000000003';
    const lm = 'stockage://erp-fichiers/proprietaires/pro-a/x.pdf';
    const sens = `stockage://erp-fichiers/${SENS}/proprietaires/pro-s/m.pdf`;
    verifier(fichierDeLEspace(lm, LM) && fichierDeLEspace(lm, null) && !fichierDeLEspace(lm, SENS), 'chemin d’avant : à Label Maison seulement');
    verifier(fichierDeLEspace(sens, SENS) && fichierDeLEspace(sens.replace(SENS, SENS.toUpperCase()), SENS) && !fichierDeLEspace(sens, LM) && !fichierDeLEspace(sens, AUTRE), 'dossier de Sens : à Sens seulement (jamais à Label Maison ni à un autre)');
    verifier(!fichierDeLEspace(`stockage://erp-fichiers/${AUTRE}/x.pdf`, LM), 'Label Maison : jamais un fichier rangé sous le dossier d’un espace');
    verifier(
      !fichierDeLEspace(`stockage://erp-fichiers/${SENS}`, SENS) &&
        !fichierDeLEspace(`stockage://erp-fichiers/${SENS}/../proprietaires/x.pdf`, SENS) &&
        !fichierDeLEspace('stockage://erp-fichiers/proprietaires//x.pdf', LM) &&
        !fichierDeLEspace('stockage://erp-fichiers/./x.pdf', LM) &&
        !fichierDeLEspace(`stockage://autre/${SENS}/x.pdf`, SENS) &&
        !fichierDeLEspace('https://exemple.fr/x.pdf', LM) &&
        !fichierDeLEspace(42, LM) &&
        !fichierDeLEspace(sens, 'sens'),
      'dossier vide, « .. », « . », autre bucket, adresse web, espace illisible : refusés',
    );
  }

  section('Invitation à ouvrir un espace (erp.qui_suis_je)');
  {
    const maintenant = Date.parse('2026-10-27T10:00:00Z');
    const lire = (v: unknown) => lireInvitationEspace({ invitations_espace: v }, maintenant);
    verifier(lire([{ nom_espace: 'Sens', expire_le: '2026-11-03T10:00:00.123456+00:00' }])?.nom === 'Sens', 'invitation valable : retenue (échéance à la microseconde)');
    verifier(lire([{ nom_espace: 'Sens' }])?.nom === 'Sens' && lire([{}])?.nom === '', 'sans échéance : retenue (nom vide permis, prérempli plus tard)');
    verifier(
      lire([]) === null &&
        lire(null) === null &&
        lire({ nom_espace: 'Sens' }) === null &&
        lire(['Sens']) === null &&
        lire([{ nom_espace: 'Sens', expire_le: '2026-10-01T10:00:00Z' }]) === null &&
        lire([{ nom_espace: 'Sens', expire_le: 'demain' }]) === null &&
        lireInvitationEspace({ invitation_espace: { nom: 'Sens' } }, maintenant) === null,
      'liste vide, null, objet au lieu d’une liste, texte, échéance passée ou illisible, ancienne forme : rien (mêmes règles que la page d’accès)',
    );
    verifier(lire([{ nom_espace: 'Vieux', expire_le: '2026-10-01T10:00:00Z' }, { nom_espace: 'Neuf', expire_le: '2026-11-01T10:00:00Z' }])?.nom === 'Neuf', 'la première invitation encore valable');
  }

  section('Nom de l’espace : signature de l’agent, notification d’essai');
  {
    verifier(signatureParDefaut() === SIGNATURE_LABEL_MAISON && SIGNATURE_LABEL_MAISON === 'L’équipe Label Maison', 'Label Maison : signature inchangée');
    verifier(signatureParDefaut('Sens') === 'L’équipe Sens' && signatureParDefaut('  ') === 'L’équipe', 'autre espace : « L’équipe Sens », jamais le nom de Label Maison');
    verifier(nomPourSignature(ESPACE_LABEL_MAISON) === undefined && nomPourSignature({ id: LM, nom: 'Label Maison Conciergerie' }) === undefined && nomPourSignature({ id: SENS, nom: 'Sens' }) === 'Sens', 'nom pour la signature : décidé par l’identifiant de l’espace');
    verifier(reglagesAgent({ reglages: [] }).signature === SIGNATURE_LABEL_MAISON && reglagesAgent({ reglages: [] }, 'Sens').signature === 'L’équipe Sens', 'réglages par défaut : signature de l’espace');
    const stocke = { ...REGLAGES_AGENT_DEFAUT, signature: 'Marie, de Sens' };
    verifier(reglagesAgent({ reglages: [stocke] }, 'Sens').signature === 'Marie, de Sens' && reglagesAgent({ reglages: [{ ...stocke, signature: undefined as unknown as string }] }, 'Sens').signature === 'L’équipe Sens', 'signature enregistrée gardée ; absente : celle de l’espace');
    verifier(notificationTest('t').variantes[0].titre === 'Label Maison' && notificationTest('t', 'Sens').variantes[0].titre === 'Sens', 'notification d’essai au nom de l’espace');
  }

  section('Repull : workspace de l’espace sur chaque appel');
  {
    const r = new FauxRepull();
    const avec = new ClientRepull({ cle: 'sk', workspace: '1204', fetch: r.fetch as typeof fetch, echeance: Date.now() + 10_000 });
    await avec.get('/v1/listings');
    for await (const page of avec.pages('/v1/reservations')) void page;
    await avec.post('/v1/conversations/1/messages', { message: 'Bonjour' });
    const sans = new ClientRepull({ cle: 'sk', fetch: r.fetch as typeof fetch, echeance: Date.now() + 10_000 });
    await sans.get('/v1/listings');
    verifier(r.appels.slice(0, 3).every((a) => a.workspace === '1204') && r.appels[3].workspace === null, 'X-Workspace-Id sur chaque appel de l’espace, aucun pour Label Maison', r.appels);
    const sb = new FausseSupabase();
    const base = new BaseErp({ url: 'https://base.test', cleAnon: 'anon', fetch: sb.fetch as typeof fetch, jeton: async () => 'jeton-serveur', espace: SENS });
    r.appels = [];
    await avecClient({ cle: 'sk', workspace: '1204', base, echeance: Date.now() + 10_000, fetch: r.fetch as typeof fetch }, (c) => c.get('/v1/connect'));
    verifier(r.appels.length === 1 && r.appels[0].workspace === '1204', 'connexions et envois (avecClient) : workspace transmis', r.appels);
  }

  section('BaseErp : espace, ou base d’avant');
  {
    const sb = new FausseSupabase();
    sb.poser(LM, 'crm', { id: 'c1' });
    sb.poser(SENS, 'crm', { id: 'c1' });
    const sens = new BaseErp({ url: 'https://base.test', cleAnon: 'anon', fetch: sb.fetch as typeof fetch, jeton: async () => 'jeton-serveur', espace: SENS });
    const lus = await sens.lire<{ id: string }>('crm');
    const lecture = sb.requetes[sb.requetes.length - 1];
    verifier(lus.length === 1 && lecture.espace === SENS && lecture.url.searchParams.get('espace') === `eq.${SENS}`, 'lecture : en-tête et filtre de l’espace', lecture.url.search);
    await sens.ecrire('crm', [{ id: 'c2' }], 'Test');
    const ecriture = sb.requetes[sb.requetes.length - 1];
    verifier(
      ecriture.url.searchParams.get('on_conflict') === 'espace,collection,id' && (ecriture.corps as Ligne[])[0].espace === SENS && !!sb.get(SENS, 'crm', 'c2') && !sb.get(LM, 'crm', 'c2'),
      'écriture : clé (espace, collection, id), ligne dans l’espace',
    );
    const r = await sens.rpc<{ email: string }>('qui_suis_je');
    verifier(r.email === 'serveur@labelmaisoncg.fr' && sb.requetes[sb.requetes.length - 1].espace === SENS, 'appel de fonction (rpc) avec l’en-tête');
    const avant = new BaseErp({ url: 'https://base.test', cleAnon: 'anon', fetch: sb.fetch as typeof fetch, jeton: async () => 'jeton-equipe' });
    sb.historique = true;
    const vieux = await avant.lire<{ id: string }>('crm');
    const l2 = sb.requetes[sb.requetes.length - 1];
    verifier(vieux.length === 1 && l2.espace === null && !l2.url.searchParams.has('espace'), 'sans espace : requête d’avant (ni en-tête ni filtre)');
    await avant.ecrire('crm', [{ id: 'c3' }]);
    const e2 = sb.requetes[sb.requetes.length - 1];
    verifier(e2.url.searchParams.get('on_conflict') === 'collection,id' && !('espace' in (e2.corps as Ligne[])[0]), 'sans espace : clé (collection, id), rien de plus');
    let message = '';
    await sens.lire('crm').catch((e: Error) => (message = e.message));
    verifier(message === MESSAGE_BASE_PAS_PREPAREE, 'espace demandé sur une base pas préparée : message clair', message);
    const refus = async (espace: string | null) => {
      let texte = '';
      await new BaseErp({ url: 'https://base.test', cleAnon: 'anon', fetch: sb.fetch as typeof fetch, jeton: async () => 'jeton-inconnu', espace }).lire('crm').catch((e: Error) => (texte = e.message));
      return texte;
    };
    sb.historique = false;
    const refusServeur = await refus(SENS);
    sb.historique = true;
    const refusEquipe = await refus(null);
    verifier(/compte du serveur/.test(refusServeur) && /compte d’équipe/.test(refusEquipe) && !/serveur/.test(refusEquipe), 'accès refusé : le message nomme le bon compte', { refusServeur, refusEquipe });
    let appels = 0;
    const paresseuse = new BaseErp({
      url: 'https://base.test',
      cleAnon: 'anon',
      fetch: sb.fetch as typeof fetch,
      jeton: async () => 'jeton-equipe',
      espace: async () => {
        appels++;
        if (appels === 1) throw new Error('base injoignable');
        return null;
      },
    });
    let premier = '';
    await paresseuse.lire('crm').catch((e: Error) => (premier = e.message));
    const second = await paresseuse.lire('crm');
    verifier(premier === 'base injoignable' && second.length === 2 && appels === 2, 'espace résolu au premier accès ; un échec n’est pas gardé', { premier, n: second.length, appels });
  }

  section('Identité et vérification d’un membre');
  {
    const sb = new FausseSupabase();
    const o = { url: 'https://base.test', cleAnon: 'anon', fetch: sb.fetch as typeof fetch };
    const id = await lireIdentite('jeton-sens', o);
    verifier(id?.espaces.length === 1 && id.espaces[0].id === SENS && !id.serveur, 'qui_suis_je : espaces du compte', id);
    verifier((await lireIdentite('jeton-serveur', o))?.serveur === true, 'qui_suis_je : compte serveur reconnu');
    let m = await verifierMembre('jeton-equipe', o);
    verifier(m.ok && m.espace === LM && m.role === 'gerant', 'sans en-tête : Label Maison', m);
    m = await verifierMembre('jeton-sens', o);
    verifier(m.ok && m.espace === SENS, 'sans en-tête, un seul espace : le sien', m);
    m = await verifierMembre('jeton-sens', { ...o, espace: LM });
    verifier(!m.ok && m.statut === 403 && /pas membre de cet espace/.test(m.erreur), 'espace demandé dont il n’est pas membre : refusé', m);
    m = await verifierMembre('jeton-equipe', { ...o, espace: SENS });
    verifier(!m.ok && m.statut === 403, 'Label Maison ne peut pas agir dans Sens', m);
    m = await verifierMembre('jeton-lecture', { ...o, espace: SENS });
    verifier(!m.ok && m.statut === 403 && /gérants et les opérations/.test(m.erreur), 'rôle lecture : refusé', m);
    m = await verifierMembre('jeton-serveur', o);
    verifier(!m.ok && m.statut === 403, 'le compte serveur n’est membre de rien', m);
    m = await verifierMembre('jeton-inconnu', o);
    verifier(!m.ok && m.statut === 401, 'session invalide : 401', m);
    sb.historique = true;
    m = await verifierMembre('jeton-equipe', o);
    verifier(m.ok && m.espace === LM && m.role === 'gerant', 'base d’avant : table membres, Label Maison', m);
    m = await verifierMembre('jeton-equipe', { ...o, espace: SENS });
    verifier(!m.ok && m.statut === 503 && m.erreur === MESSAGE_BASE_PAS_PREPAREE, 'base d’avant + autre espace : « Base pas encore préparée »', m);
  }

  section('Synchronisation du navigateur');
  {
    const sb = new FausseSupabase();
    sb.poser(SENS, 'logements', { id: 'l1' });
    sb.poser(LM, 'logements', { id: 'l1' });
    const client = (jeton: string) =>
      createClient('https://base.test', 'anon', {
        db: { schema: 'erp' },
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { fetch: sb.fetch as typeof fetch, headers: { Authorization: `Bearer ${jeton}` } },
      }) as ClientErp;
    const stockage = new FauxStockage();
    const distants: ChangementDistant[][] = [];
    const s = new Synchro({ client: client('jeton-sens'), stockage, ecouterNavigateur: false, delaiRegroupement: 1, espace: SENS, compte: 'gerant-b@exemple.invalid', surDistant: (c) => distants.push(c) });
    const d = await s.chargerTout();
    const lecture = sb.requetes.find((r) => r.chemin === 'enregistrements' && r.methode === 'GET')!;
    verifier(d.logements.length === 1 && lecture.url.searchParams.get('espace') === `eq.${SENS}`, 'lecture filtrée sur l’espace', lecture.url.search);
    await s.sauvegarderDifferences(d, { ...d, logements: [...d.logements, { ...d.logements[0], id: 'l2' }] }, 'Test');
    const upsert = sb.requetes.filter((r) => r.chemin === 'enregistrements' && r.methode === 'POST').pop()!;
    verifier(upsert.url.searchParams.get('on_conflict') === 'espace,collection,id' && (upsert.corps as Ligne[]).every((l) => l.espace === SENS), 'écriture : clé et colonne espace', upsert.url.search);
    await s.sauvegarderDifferences({ ...d, logements: [...d.logements, { ...d.logements[0], id: 'l2' }] }, d, 'Test');
    const suppression = sb.requetes.filter((r) => r.methode === 'DELETE').pop()!;
    verifier(suppression.url.searchParams.get('espace') === `eq.${SENS}`, 'suppression limitée à l’espace', suppression.url.search);
    await s.enregistrerEtatAuto('actives', { r1: true });
    const auto = sb.requetes.filter((r) => r.chemin === 'etat_automatisations' && r.methode === 'POST').pop()!;
    verifier(auto.url.searchParams.get('on_conflict') === 'espace,id' && (auto.corps as { espace: string; id: string }).espace === SENS, 'état des automatisations : clé (espace, id)', auto.corps);
    s.activerDistant();
    s.recevoir({ eventType: 'INSERT', table: 'enregistrements', new: { espace: LM, collection: 'logements', id: 'autre', donnees: { id: 'autre' }, maj_par: 'x#y' } });
    s.recevoir({ eventType: 'UPDATE', table: 'enregistrements', new: { espace: SENS, collection: 'logements', id: 'l1', donnees: { id: 'l1', nom: 'x' }, maj_par: 'x#y' } });
    s.recevoir({ eventType: 'UPDATE', table: 'etat_automatisations', new: { espace: LM, id: 'global', actives: { r9: true } } });
    s.recevoir({ eventType: 'DELETE', table: 'enregistrements', old: { collection: 'logements', id: 'l9' } });
    await new Promise((r) => setTimeout(r, 20));
    const recus = distants.flat();
    verifier(recus.length === 2 && recus.some((c) => c.id === 'l1') && recus.some((c) => c.id === 'l9' && c.donnees === null) && !recus.some((c) => c.id === 'autre'), 'temps réel : un autre espace est ignoré (suppression sans espace acceptée)', recus);
    s.arreter();

    // File locale laissée par un onglet fermé : reprise par le même espace et le même compte seulement.
    sb.requetes = [];
    const enPanne = (async () => {
      throw new TypeError('fetch failed');
    }) as typeof fetch;
    const clientPanne = createClient('https://base.test', 'anon', { db: { schema: 'erp' }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: enPanne } }) as ClientErp;
    const a = new Synchro({ client: clientPanne, stockage, ecouterNavigateur: false, espace: SENS, compte: 'gerant-b@exemple.invalid', enLigne: () => true });
    void a.sauvegarderDifferences(d, { ...d, logements: [...d.logements, { ...d.logements[0], id: 'hors-ligne' }] }, 'Test');
    await new Promise((r) => setTimeout(r, 10));
    a.arreter();
    const nouvelle = (espace: string | null, compte: string) => new Synchro({ client: clientPanne, stockage, ecouterNavigateur: false, espace, compte, enLigne: () => false });
    const autreEspace = nouvelle(null, 'gerant-b@exemple.invalid');
    const autreCompte = nouvelle(SENS, 'lecture-b@exemple.invalid');
    verifier(autreEspace.enAttente === 0 && autreCompte.enAttente === 0, 'file d’un espace non reprise par un autre espace ni un autre compte');
    const meme = nouvelle(SENS, 'gerant-b@exemple.invalid');
    verifier(meme.enAttente === 1, 'file reprise par le même espace et le même compte');
    for (const x of [autreEspace, autreCompte, meme]) x.arreter();
    // File écrite par l'ancien code (sans espace) : Label Maison.
    const ancien = new FauxStockage();
    ancien.setItem('lm-erp-file-attente', JSON.stringify({ vieux: { projet: 'https://ftfwnomkbjtlpijdevgx.supabase.co', vu: 0, operations: [{ op: { type: 'supprimer', collection: 'crm', id: 'z' }, auteur: '' }] } }));
    const parSens = new Synchro({ client: clientPanne, stockage: ancien, ecouterNavigateur: false, espace: SENS, enLigne: () => false });
    const parLm = new Synchro({ client: clientPanne, stockage: ancien, ecouterNavigateur: false, espace: LM, enLigne: () => false });
    verifier(parSens.enAttente === 0 && parLm.enAttente === 1, 'file d’avant les espaces : reprise par Label Maison seulement');
    parSens.arreter();
    parLm.arreter();
    const vieux = new Synchro({ client: client('jeton-equipe'), stockage: new FauxStockage(), ecouterNavigateur: false });
    sb.requetes = [];
    await vieux.chargerTout();
    verifier(!sb.requetes[0].url.searchParams.has('espace'), 'sans espace : lecture d’avant');
    vieux.arreter();
  }

  section('Agent IA d’un autre espace : plafond du mois');
  {
    const sb = new FausseSupabase();
    const horloge = new Date('2026-10-20T10:00:00.000Z');
    const iso = (min: number) => new Date(horloge.getTime() + min * 60_000).toISOString().replace('Z', '+00:00');
    sb.poser(SENS, 'reglages', { ...REGLAGES_AGENT_DEFAUT, actif: true, horaires: { mode: 'toujours', debut: '08:00', fin: '22:00' } } as ReglagesAgent);
    for (const n of [1, 2]) {
      sb.poser(SENS, 'filsMessages', {
        id: `repull-${n}`,
        logementId: 'l1',
        canal: 'booking',
        voyageur: `Voyageur ${n}`,
        statut: 'ouvert',
        messages: [{ id: `m${n}`, auteur: 'voyageur', texte: 'Bonjour, une question ?', envoyeLe: iso(-10 - n) }],
        dernierMessageLe: iso(-10 - n),
        traitePar: 'en_attente',
        repull: { id: String(n), majLe: iso(-10 - n) },
      } as FilMessages);
    }
    const appelsIA: Anthropic.MessageCreateParamsNonStreaming[] = [];
    const ia: ClientIA = {
      messages: {
        create: async (p) => {
          appelsIA.push(p);
          const texte = JSON.stringify({ action: 'transmettre', raison: 'autre', langue: 'fr', texte: '', resume: 'À vérifier.' });
          return { id: 'm', type: 'message', role: 'assistant', model: p.model, content: [{ type: 'text', text: texte, citations: null }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 10, output_tokens: 10 } } as unknown as Anthropic.Message;
        },
      },
    };
    const r = new FauxRepull();
    const base = new BaseErp({ url: 'https://base.test', cleAnon: 'anon', fetch: sb.fetch as typeof fetch, jeton: async () => 'jeton-serveur', espace: SENS });
    const options = () => ({
      cle: 'sk',
      workspace: '1204',
      base,
      echeance: Date.now() + 50_000,
      fetch: r.fetch as typeof fetch,
      attendre: async () => undefined,
      maintenant: () => horloge,
      declencheur: 'planifie' as const,
      releve: 'non' as const,
      ia,
      telegram: null,
      nomEspace: 'Sens',
      plafondIAMois: 1,
    });
    let p = await lancerAgent(options());
    verifier(appelsIA.length === 1 && p.transmis === 1 && p.statut === 'budget' && /Plafond du mois/.test(p.message) && p.reportes === 1, 'une décision, puis le plafond arrête l’agent', p);
    verifier(String(appelsIA[0].system).startsWith("Tu es l'agent de messagerie de Sens,"), 'consignes au nom de l’espace', String(appelsIA[0].system).slice(0, 60));
    const etat = sb.get<EtatAgent>(SENS, COLLECTION_AGENT, ID_ETAT_AGENT);
    verifier(etat?.iaMois?.mois === '2026-10' && etat.iaMois.appels === 1, 'décisions du mois comptées dans agent/etat', etat?.iaMois);
    p = await lancerAgent(options());
    verifier(appelsIA.length === 1 && p.statut === 'budget', 'plafond atteint : aucun appel à Claude jusqu’au mois suivant', p.statut);
    verifier(!sb.get(LM, COLLECTION_AGENT, ID_ETAT_AGENT), 'rien d’écrit dans Label Maison');
  }

  console.log(`\n${reussis} contrôles réussis, ${echecs} en échec.`);
  (globalThis as { process?: { exitCode?: number } }).process!.exitCode = echecs ? 1 : 0;
}

principal().catch((e) => {
  console.error(e);
  (globalThis as { process?: { exitCode?: number } }).process!.exitCode = 1;
});
