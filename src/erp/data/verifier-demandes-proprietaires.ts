/**
 * Vérification des demandes des propriétaires (novembre 2026), sans réseau :
 *   - règles pures : nettoyage du texte, limites (10 à 2 000 caractères,
 *     5 par heure et 20 par 24 heures et par propriétaire), saisie pas à pas,
 *     corps vérifié champ par champ (rien d'autre n'est lu), états (envoyée,
 *     vue, répondue, réglée) et réponses ;
 *   - cloisonnement : un propriétaire ne voit jamais la demande d'un autre,
 *     ni celle d'un autre espace (chaque espace a sa base), ne choisit que ses
 *     logements, et sa vue ne porte jamais qui a répondu ;
 *   - notification « Demande d’un propriétaire » : réservée au gérant,
 *     active par défaut, sans nom ni message, plafonnée (une synthèse par
 *     heure au-delà de 5) ; un échec d'envoi n'enlève jamais la demande ;
 *     sans clés ni e-mail configurés, rien ne casse ;
 *   - aucune fuite : ni l'agent IA ni le connecteur Claude ne lisent la
 *     collection, rien ne part vers une plateforme ;
 *   - gérant : « À faire » de l'Accueil, suppression d'une fiche, typographie.
 *
 * Lancement (depuis la racine du dépôt) :
 *   node_modules/.bin/esbuild src/erp/data/verifier-demandes-proprietaires.ts --bundle --platform=node --format=esm \
 *     --define:import.meta.env='{"VITE_ERP_DEMO":"1"}' --log-level=error --outfile=/tmp/verifier-demandes-proprietaires.mjs \
 *     && node /tmp/verifier-demandes-proprietaires.mjs
 */
import { construireATraiter } from '../modules/tableau-de-bord/_composants/aTraiter.js';
import { COLLECTIONS, COLLECTIONS_SYNCHRONISEES, completer, donneesVides } from './collections';
import {
  COLLECTION_DEMANDES,
  ECHANGES_MAX,
  MESSAGE_MAX,
  MESSAGE_MIN,
  PLAFOND_DEMANDES_HEURE,
  PLAFOND_DEMANDES_JOUR,
  changerStatutDemande,
  demandeATraiter,
  demandesATraiter,
  demandesVues,
  enregistrerDemande,
  erreursEtapeDemande,
  etapesDemande,
  idDemande,
  idDemandeValide,
  libelleDemande,
  limiteDemandes,
  logementsDeLaDemande,
  longueur,
  marquerVue,
  nettoyerTexteDemande,
  nouvelleDemande,
  peutTraiterDemandes,
  peutVoirDemandes,
  repondreDemande,
  saisieInitiale,
  validerDemande,
  type BaseDemandes,
} from './demandes-proprietaires';
import { ID_LABEL_MAISON } from './espaces';
import { envoyeesDepuis, envoyerNotifications, type Appareil, type BaseNotifications, type Envoyeur } from './notifications-envoi';
import {
  PLAFOND_DEMANDES_PROPRIETAIRES_HEURE,
  TYPES_NOTIFICATION,
  TYPES_RESERVES_GERANT,
  notificationDemandePlafonnee,
  notificationDemandeProprietaire,
  preferencesPourRole,
  typePourRole,
  varianteAEnvoyer,
} from './notifications';
import { ID_PROPRIETAIRE_A_RENSEIGNER } from './repull';
import { creerSeed } from './seed';
import { verdictSuppressionProprietaire, supprimerProprietaireDe } from './suppression-personnes';
import { textesAvecEspaceSimple, textesDuSource } from './textes-source';
import type { DemandeProprietaire, ErpDonnees, Logement } from './types';
import { genererClesVapid, type ClesVapid } from './web-push';

let reussis = 0;
let echecs = 0;
function verifier(condition: unknown, message: string, detail?: unknown) {
  if (condition) reussis++;
  else {
    echecs++;
    console.error(`  ✗ ${message}${detail === undefined ? '' : ` → ${JSON.stringify(detail)?.slice(0, 300)}`}`);
  }
}
function section(titre: string) {
  console.log(`\n${titre}`);
}

const NBSP = ' ';
const A = 'pro-a';
const B = 'pro-b';
const SENS = '5e5e0000-0000-4000-8000-000000000002';
const maintenant = Date.parse('2026-11-05T10:00:00+01:00');
const le = (minutes: number) => new Date(maintenant - minutes * 60_000).toISOString();
const logement = (id: string, proprietaireId: string, x: Partial<Logement> = {}) => ({ id, nom: `Logement ${id}`, proprietaireId, statut: 'actif', ...x }) as Logement;
const LOGEMENTS = [logement('la1', A), logement('la2', A), logement('la3', A, { statut: 'sorti' }), logement('lb1', B)];
const MESSAGE = 'Bonjour, pouvez-vous vérifier le chauffe-eau avant samedi ?';

/** Base en mémoire d'UN espace : ce qu'on lit, ce qu'on écrit, dans quelles collections. */
function baseMemoire(initial: Partial<Record<string, { id: string }[]>> = {}) {
  const donnees: Record<string, { id: string }[]> = Object.fromEntries(Object.entries(initial).map(([c, l]) => [c, [...(l ?? [])]]));
  const ecrites: string[] = [];
  let lectures = 0;
  const base: BaseDemandes & BaseNotifications = {
    lire: async <T,>(c: string, ids?: string[]) => {
      lectures++;
      const l = donnees[c] ?? [];
      return (ids ? l.filter((x) => ids.includes(x.id)) : l) as T[];
    },
    ajouterSiAbsent: async (c, elements) => {
      ecrites.push(c);
      const l = (donnees[c] ??= []);
      let n = 0;
      for (const e of elements) if (!l.some((x) => x.id === e.id)) (l.push(e), n++);
      return n;
    },
    ecrire: async (c, elements) => {
      ecrites.push(c);
      const l = (donnees[c] ??= []);
      for (const e of elements) {
        const i = l.findIndex((x) => x.id === e.id);
        if (i >= 0) l[i] = e;
        else l.push(e);
      }
    },
  };
  return { base, donnees, ecrites, lectures: () => lectures };
}

const demande = (x: Partial<DemandeProprietaire> & { id: string }): DemandeProprietaire => ({
  proprietaireId: A,
  type: 'question',
  statut: 'envoyee',
  creeLe: le(10),
  majLe: le(10),
  echanges: [{ id: `${x.id}-1`, auteur: 'proprietaire', texte: MESSAGE, le: le(10) }],
  historique: [{ statut: 'envoyee', le: le(10) }],
  ...x,
});

async function principal() {
  const fs = (await import('node:fs' as string)) as {
    readFileSync: (chemin: string, encodage: string) => string;
    existsSync: (chemin: string) => boolean;
    readdirSync: (chemin: string, o: { withFileTypes: true }) => { name: string; isDirectory: () => boolean }[];
  };
  const racine = `${(globalThis as { process?: { cwd: () => string } }).process?.cwd() ?? '.'}/`;
  const lire = (f: string) => (fs.existsSync(racine + f) ? fs.readFileSync(racine + f, 'utf8') : '');
  const fichiers = (dossier: string, garder: (nom: string) => boolean): string[] => {
    if (!fs.existsSync(racine + dossier)) return [];
    return fs.readdirSync(racine + dossier, { withFileTypes: true }).flatMap((e) => {
      const chemin = `${dossier}/${e.name}`;
      if (e.isDirectory()) return e.name === 'node_modules' ? [] : fichiers(chemin, garder);
      return /\.(ts|tsx|js|mjs)$/.test(e.name) && garder(chemin) ? [chemin] : [];
    });
  };

  /* ====================================================== règles pures */
  section('Texte : nettoyé avant tout calcul');
  {
    const brut = '  Bonjour\r\n\r\n\r\n\r\nLigne‮ inversée​\u0007 café   \t\nfin  ';
    const t = nettoyerTexteDemande(brut);
    verifier(t === 'Bonjour\n\nLigne inversée café\nfin', 'contrôles, sens d’écriture et invisibles retirés ; fins de ligne unifiées ; NFC ; espaces de fin ôtés', t);
    verifier(nettoyerTexteDemande(42) === '' && nettoyerTexteDemande(null) === '' && nettoyerTexteDemande({ toString: () => 'x' }) === '', 'pas un texte : vide');
    verifier(longueur('👍🏽é') === 3 && longueur('abc') === 3, 'longueur en caractères (un emoji compte pour un)');
    verifier(nettoyerTexteDemande('x'.repeat(50_000)).length === MESSAGE_MAX * 4, 'texte énorme : borné avant tout calcul');
  }

  section('Saisie pas à pas : écrans et ce qui manque');
  {
    verifier(etapesDemande(0).join() === 'type,message,recapitulatif' && etapesDemande(1).join() === 'type,message,recapitulatif', 'un logement ou aucun : pas d’écran « logement »');
    verifier(etapesDemande(2).join() === 'type,logement,message,recapitulatif', 'plusieurs logements : l’écran « logement »');
    const un = [{ id: 'la1' }];
    const deux = [{ id: 'la1' }, { id: 'la2' }];
    verifier(saisieInitiale(un).logement === 'la1' && saisieInitiale(deux).logement === undefined && saisieInitiale([]).logement === undefined, 'un seul logement : déjà choisi');
    verifier(erreursEtapeDemande('type', { message: '' }, deux).type === 'Choisissez de quoi il s’agit.', 'type : « Choisissez de quoi il s’agit. »');
    verifier(erreursEtapeDemande('type', { type: 'demande', message: '' }, deux).sujet === 'Choisissez le sujet de votre demande.', 'demande particulière : le sujet est demandé');
    verifier(Object.keys(erreursEtapeDemande('type', { type: 'demande', sujet: 'cles', message: '' }, deux)).length === 0, 'type et sujet : on continue');
    verifier(/Tous mes logements/.test(erreursEtapeDemande('logement', { type: 'question', message: '' }, deux).logement ?? ''), 'logement : « …, ou « Tous mes logements » »');
    verifier(Object.keys(erreursEtapeDemande('logement', { type: 'question', logement: 'tous', message: '' }, deux)).length === 0, '« Tous mes logements » : on continue');
    verifier(erreursEtapeDemande('logement', { type: 'question', logement: 'lb1', message: '' }, deux).logement !== undefined, 'le logement d’un autre : refusé');
    verifier(erreursEtapeDemande('message', { message: ' ' }, deux).message === 'Écrivez votre message.', 'message vide : « Écrivez votre message. »');
    verifier(erreursEtapeDemande('message', { message: 'Trop court' }, deux).message === undefined && erreursEtapeDemande('message', { message: 'Court' }, deux).message === `Écrivez au moins ${MESSAGE_MIN} caractères.`, `message : ${MESSAGE_MIN} caractères au moins`);
    verifier(erreursEtapeDemande('message', { message: 'x'.repeat(MESSAGE_MAX + 1) }, deux).message === `2${NBSP}000 caractères au plus${NBSP}: raccourcissez votre message.`, 'message : 2 000 caractères au plus (espaces insécables)');
    verifier(erreursEtapeDemande('message', { message: 'x'.repeat(MESSAGE_MAX) }, deux).message === undefined, 'message de 2 000 caractères : accepté');
    const recap = erreursEtapeDemande('recapitulatif', { message: '' }, deux);
    verifier(!!recap.type && !!recap.logement && !!recap.message, 'récapitulatif : tout ce qui manque');
  }

  section('Serveur : corps vérifié champ par champ, rien d’autre n’est lu');
  {
    const siens = logementsDeLaDemande(LOGEMENTS, A);
    verifier(siens.map((l) => l.id).join() === 'la1,la2', 'ses logements actuels en gestion seulement (ni sorti, ni d’un autre)');
    verifier(logementsDeLaDemande(LOGEMENTS, ID_PROPRIETAIRE_A_RENSEIGNER).length === 0 && logementsDeLaDemande(LOGEMENTS, '').length === 0, 'fiche d’attente ou propriétaire vide : aucun logement');
    const ok = (c: unknown, l = siens) => validerDemande(c, l);
    verifier(!ok({ message: MESSAGE }).ok && !ok({ type: 'urgent', message: MESSAGE }).ok, 'type absent ou inconnu : refusé');
    verifier(!ok({ type: 'demande', message: MESSAGE, logement: 'la1' }).ok && !ok({ type: 'demande', sujet: 'piscine', message: MESSAGE, logement: 'la1' }).ok, 'demande particulière sans sujet connu : refusée');
    const q = ok({ type: 'question', sujet: 'cles', logement: 'la1', message: MESSAGE });
    verifier(q.ok && q.saisie.sujet === undefined, 'sujet ignoré pour une question');
    const r = ok({ type: 'demande', sujet: 'cles', logement: 'la2', message: `  ${MESSAGE}‮ `, id: 'dem-choisi', statut: 'reglee', proprietaireId: B, echanges: [{ auteur: 'conciergerie', texte: 'Fausse réponse' }], creeLe: '2020-01-01' });
    verifier(r.ok && JSON.stringify(Object.keys(r.saisie).sort()) === JSON.stringify(['logementId', 'message', 'sujet', 'type']) && r.saisie.message === MESSAGE, 'identifiant, état, propriétaire, réponse, date glissés : ignorés ; message nettoyé', r);
    const tous = ok({ type: 'autre', logement: 'tous', message: MESSAGE });
    verifier(tous.ok && tous.saisie.tousLogements === true && !tous.saisie.logementId, '« tous » : tous ses logements');
    verifier(!ok({ type: 'autre', logement: 'lb1', message: MESSAGE }).ok && !ok({ type: 'autre', logement: 'la3', message: MESSAGE }).ok && !ok({ type: 'autre', message: MESSAGE }).ok, 'plusieurs logements : le logement d’un autre, un logement sorti ou aucun choix : refusé');
    const seul = ok({ type: 'autre', logement: 'lb1', message: MESSAGE }, [siens[0]]);
    verifier(seul.ok && seul.saisie.logementId === 'la1', 'un seul logement : toujours le sien (même si le corps en nomme un autre)');
    const sans = ok({ type: 'autre', logement: 'la1', message: MESSAGE }, []);
    verifier(sans.ok && !sans.saisie.logementId && !sans.saisie.tousLogements, 'aucun logement en gestion : la demande part sans logement');
    verifier(!ok({ type: 'question', logement: 'la1', message: '​​​​​​​​​​​' }).ok, 'message fait d’invisibles : vide, refusé');
    verifier(!ok({ type: 'question', logement: 'la1', message: 'x'.repeat(MESSAGE_MAX + 1) }).ok && !ok(null).ok && !ok('texte').ok, 'trop long, corps absent ou illisible : refusé');
  }

  section('Limites : 5 par heure, 20 par 24 heures, par propriétaire');
  {
    const de = (p: string, minutes: number[]) => minutes.map((m, i) => demande({ id: `dem-${p}-${i}`, proprietaireId: p, creeLe: le(m) }));
    verifier(limiteDemandes(de(A, [1, 10, 20, 30]), A, maintenant).ok, `${PLAFOND_DEMANDES_HEURE - 1} dans l’heure : encore une`);
    const cinq = limiteDemandes(de(A, [1, 10, 20, 30, 59]), A, maintenant);
    verifier(!cinq.ok && /5 demandes dans l’heure/.test(cinq.erreur), `${PLAFOND_DEMANDES_HEURE} dans l’heure : refusé, dit clairement`, cinq);
    verifier(limiteDemandes(de(A, [61, 70, 80, 90, 100]), A, maintenant).ok, '5 il y a plus d’une heure : de nouveau possible');
    const vingt = limiteDemandes(de(A, Array.from({ length: PLAFOND_DEMANDES_JOUR }, (_, i) => 70 + i * 60)), A, maintenant);
    verifier(!vingt.ok && /20 demandes en 24/.test(vingt.erreur), `${PLAFOND_DEMANDES_JOUR} en 24 heures : refusé`, vingt);
    verifier(limiteDemandes(de(A, Array.from({ length: PLAFOND_DEMANDES_JOUR }, (_, i) => 24 * 60 + 1 + i)), A, maintenant).ok, 'plus de 24 heures : ne comptent plus');
    verifier(limiteDemandes(de(B, [1, 2, 3, 4, 5, 6]), A, maintenant).ok, 'les demandes d’un autre propriétaire ne comptent pas pour lui');
    verifier(!limiteDemandes(de(A, [-30, -60, -90, -120, -150]), A, maintenant).ok, 'dates dans le futur : comptées (jamais une porte ouverte)');
    verifier(!limiteDemandes([1, 2, 3, 4, 5].map((i) => ({ ...demande({ id: `dem-x${i}` }), creeLe: 'illisible' })), A, maintenant).ok, 'date illisible : comptée comme maintenant');
  }

  section('Création : par le serveur, dans la base de SON espace');
  {
    const id = idDemande();
    verifier(idDemandeValide(id) && id !== idDemande() && !idDemandeValide('dem-<script>') && !idDemandeValide('autre'), 'identifiant tiré au hasard, forme fixe');
    const n = nouvelleDemande({ type: 'demande', sujet: 'linge', logementId: 'la1', message: MESSAGE }, { id, proprietaireId: A, le: le(0) });
    verifier(n.statut === 'envoyee' && n.echanges.length === 1 && n.echanges[0].auteur === 'proprietaire' && !n.echanges[0].par && n.historique.length === 1 && n.historique[0].statut === 'envoyee' && !n.historique[0].par, 'nouvelle : envoyée, son message seul, historique « envoyée »');

    const lm = baseMemoire({ logements: LOGEMENTS });
    const r = await enregistrerDemande(lm.base, { proprietaireId: A, corps: { type: 'question', logement: 'la1', message: MESSAGE, proprietaireId: B }, logements: LOGEMENTS, maintenantMs: maintenant, le: le(0) });
    verifier(r.ok && r.demande.proprietaireId === A && lm.donnees[COLLECTION_DEMANDES]?.length === 1, 'enregistrée pour le propriétaire de la session (jamais celui du corps)', r);
    verifier(lm.ecrites.length === 1 && lm.ecrites[0] === COLLECTION_DEMANDES, 'une seule écriture, dans la collection des demandes : rien d’autre');
    const avant = lm.lectures();
    const refus = await enregistrerDemande(lm.base, { proprietaireId: A, corps: { type: 'question', logement: 'lb1', message: MESSAGE }, logements: LOGEMENTS, maintenantMs: maintenant, le: le(0) });
    verifier(!refus.ok && refus.statut === 400 && refus.code === 'logement' && lm.lectures() === avant, 'logement d’un autre : 400, sans même lire la base');
    const attente = await enregistrerDemande(lm.base, { proprietaireId: ID_PROPRIETAIRE_A_RENSEIGNER, corps: { type: 'question', message: MESSAGE }, logements: LOGEMENTS, maintenantMs: maintenant, le: le(0) });
    verifier(!attente.ok && attente.statut === 400, 'fiche d’attente des logements importés : refusée');
    for (let i = 0; i < 4; i++) await enregistrerDemande(lm.base, { proprietaireId: A, corps: { type: 'question', logement: 'la1', message: MESSAGE }, logements: LOGEMENTS, maintenantMs: maintenant + i, le: le(0) });
    const sixieme = await enregistrerDemande(lm.base, { proprietaireId: A, corps: { type: 'question', logement: 'la1', message: MESSAGE }, logements: LOGEMENTS, maintenantMs: maintenant + 10, le: le(0) });
    verifier(!sixieme.ok && sixieme.statut === 429 && lm.donnees[COLLECTION_DEMANDES]?.length === 5, '6e demande dans l’heure : 429, rien d’écrit', sixieme);
    const deB = await enregistrerDemande(lm.base, { proprietaireId: B, corps: { type: 'question', logement: 'lb1', message: MESSAGE }, logements: LOGEMENTS, maintenantMs: maintenant, le: le(0) });
    verifier(deB.ok, 'les demandes de A ne bloquent pas B');
    const collision = baseMemoire({ [COLLECTION_DEMANDES]: [demande({ id: 'dem-000000000000000000000000' })] });
    const c = await enregistrerDemande(collision.base, { proprietaireId: A, corps: { type: 'question', logement: 'la1', message: MESSAGE }, logements: LOGEMENTS, maintenantMs: maintenant + 24 * 3_600_000, le: le(0), id: 'dem-000000000000000000000000' });
    verifier(!c.ok && c.statut === 409 && collision.donnees[COLLECTION_DEMANDES]?.[0].id === 'dem-000000000000000000000000' && (collision.donnees[COLLECTION_DEMANDES]?.[0] as DemandeProprietaire).echanges[0].texte === MESSAGE, 'identifiant déjà pris : rien n’est remplacé (409)');
  }

  section('Envois simultanés : le plafond tient (relecture après l’ajout)');
  {
    // Base lente : chaque lecture rend l'état du moment où elle est partie, après un délai ;
    // chaque ligne porte l'instant de son écriture (maj_le), comme erp.enregistrements.
    const lente = baseMemoire({ logements: LOGEMENTS });
    const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const ecriteLe = new Map<string, string>();
    let horloge = 0;
    const base: BaseDemandes = {
      lire: async <T,>(c: string, ids?: string[]) => {
        const instantane = (await lente.base.lire<T>(c, ids)).slice();
        await attendre(20);
        return instantane;
      },
      lireVersions: async <T,>(c: string) => {
        const instantane = (await lente.base.lire<T & { id: string }>(c)).map((element) => ({ element, version: ecriteLe.get(element.id) ?? '' }));
        await attendre(20);
        return instantane;
      },
      ajouterSiAbsent: async (c, elements, auteur) => {
        await attendre(5);
        const n = await lente.base.ajouterSiAbsent(c, elements, auteur);
        for (const e of elements) if (!ecriteLe.has(e.id)) ecriteLe.set(e.id, new Date(Date.UTC(2026, 10, 5, 12, 0, 0) + ++horloge).toISOString());
        return n;
      },
      supprimer: async (c, ids) => {
        const l = lente.donnees[c] ?? [];
        const avant = l.length;
        lente.donnees[c] = l.filter((x) => !ids.includes(x.id));
        return avant - (lente.donnees[c]?.length ?? 0);
      },
    };
    const rs = await Promise.all(
      Array.from({ length: 12 }, (_, i) => enregistrerDemande(base, { proprietaireId: A, corps: { type: 'question', logement: 'la1', message: MESSAGE }, logements: LOGEMENTS, maintenantMs: maintenant, le: le(0), id: `dem-course${String(i).padStart(12, '0')}` })),
    );
    const gardees = lente.donnees[COLLECTION_DEMANDES]?.length ?? 0;
    verifier(rs.filter((r) => r.ok).length === PLAFOND_DEMANDES_HEURE && gardees === PLAFOND_DEMANDES_HEURE, `12 envois simultanés : ${PLAFOND_DEMANDES_HEURE} gardés, les autres retirés`, [rs.filter((r) => r.ok).length, gardees]);
    verifier(rs.filter((r) => !r.ok).every((r) => !r.ok && r.statut === 429 && r.code === 'limite'), 'les autres : 429 « limite »');
    const seul = await enregistrerDemande(base, { proprietaireId: B, corps: { type: 'question', logement: 'lb1', message: MESSAGE }, logements: LOGEMENTS, maintenantMs: maintenant, le: le(0) });
    verifier(seul.ok, 'un envoi seul, sous le plafond : gardé (la relecture ne refuse rien de plus)');
  }

  section('Base : demandes réservées aux gérants, témoin lu par le serveur');
  {
    for (const f of ['supabase/erp-espaces.sql', 'supabase/erp-installation.sql', 'supabase/erp-acces-gerants.sql']) {
      const sql = lire(f);
      const regle = sql.slice(sql.indexOf('create policy "acces exterieurs reserves aux gerants"'), sql.indexOf(';', sql.indexOf('create policy "acces exterieurs reserves aux gerants"')));
      const versions = sql.slice(sql.indexOf('create policy "versions reservees aux gerants"'), sql.indexOf(';', sql.indexOf('create policy "versions reservees aux gerants"')));
      verifier(
        (regle.match(/'demandesProprietaires'/g) ?? []).length === 2 && /'demandesProprietaires'/.test(versions) && /create or replace function erp\.demandes_proprietaires_protegees\(\)/.test(sql),
        `${f} : gérants seulement (enregistrements et anciennes versions), témoin erp.demandes_proprietaires_protegees`,
      );
    }
    verifier(/un compte « opérations » lit les demandes des propriétaires/.test(lire('supabase/erp-espaces.sql')) && /un compte « opérations » glisse une demande ou une réponse/.test(lire('supabase/erp-acces-gerants.sql')), 'recettes SQL : lecture, réponse glissée et effacement refusés à l’équipe');
    const route = lire('api/espace-proprietaire.ts');
    const bloc = (action: string) => route.slice(route.indexOf(`if (action === '${action}'`), route.indexOf('\n    }\n', route.indexOf(`if (action === '${action}'`)));
    const lecture = bloc('demandes');
    const envoi = bloc('demande');
    verifier(
      /demandesProtegees\(s\.base, s\.espace\)/.test(lecture) && lecture.indexOf('demandesProtegees(') < lecture.indexOf('COLLECTION_DEMANDES') &&
        /demandesProtegees\(s\.base, s\.espace\)/.test(envoi) && envoi.indexOf('demandesProtegees(') < envoi.indexOf('enregistrerDemande('),
      'route : sans le témoin de la base, rien n’est lu ni enregistré (503)',
    );
    const page = lire('src/app/pages/EspaceProprietaire.tsx');
    verifier(/r\.statut === 503 && r\.json\.code === 'fermees'/.test(page) && /demandes=\{demandes\.fermees \? undefined :/.test(page), 'page du propriétaire : demandes fermées (503) → ni « Faire une demande » ni « Mes demandes »');
  }

  section('États et réponses : côté gérant');
  {
    const g = { par: 'gerant@exemple.fr', le: le(0) };
    const d0 = demande({ id: 'dem-etat' });
    const vue = marquerVue(d0, g);
    verifier(vue.statut === 'vue' && vue.historique.at(-1)?.statut === 'vue' && vue.historique.at(-1)?.par === g.par, 'ouverte : « Vue », avec qui et quand');
    verifier(marquerVue(vue, g) === vue && marquerVue({ ...d0, statut: 'reglee' }, g).statut === 'reglee', '« Vue » seulement depuis « Envoyée »');
    verifier(!changerStatutDemande(vue, 'envoyee', g).ok && !changerStatutDemande(vue, 'ouverte', g).ok, 'jamais « Envoyée » (c’est le propriétaire), jamais un état inconnu');
    const meme = changerStatutDemande(vue, 'vue', g);
    verifier(meme.ok && meme.demande === vue, 'même état : rien ne change');
    const reglee = changerStatutDemande(vue, 'reglee', g);
    verifier(reglee.ok && reglee.demande.statut === 'reglee' && reglee.demande.historique.length === 3, 'Réglée : gardé dans l’historique');
    verifier(!repondreDemande(vue, '  ', { ...g, id: 'r1' }).ok && !repondreDemande(vue, 'x'.repeat(MESSAGE_MAX + 1), { ...g, id: 'r1' }).ok, 'réponse vide ou trop longue : refusée');
    const rep = repondreDemande(vue, ' C’est noté​. ', { ...g, id: 'r1' });
    verifier(rep.ok && rep.demande.statut === 'repondue' && rep.demande.echanges.at(-1)?.auteur === 'conciergerie' && rep.demande.echanges.at(-1)?.texte === 'C’est noté.' && rep.demande.echanges.at(-1)?.par === g.par, 'répondre : la réponse s’ajoute (nettoyée), « Répondue »');
    const encore = rep.ok ? repondreDemande(rep.demande, 'Et aussi…', { ...g, id: 'r2' }) : rep;
    verifier(encore.ok && encore.demande.echanges.length === 3 && encore.demande.historique.filter((h) => h.statut === 'repondue').length === 1, 'deuxième réponse : l’échange grandit, pas de doublon d’état');
    const surReglee = repondreDemande({ ...vue, statut: 'reglee' }, 'Précision', { ...g, id: 'r3' });
    verifier(surReglee.ok && surReglee.demande.statut === 'reglee', 'répondre à une demande réglée : elle le reste');
    const pleine = { ...vue, echanges: Array.from({ length: ECHANGES_MAX }, (_, i) => ({ id: `e${i}`, auteur: 'conciergerie' as const, texte: 'x', le: le(0) })) };
    verifier(!repondreDemande(pleine, 'Encore', { ...g, id: 'r4' }).ok, `${ECHANGES_MAX} messages au plus par échange`);
    const liste = [
      demande({ id: 'dem-v-ancienne', statut: 'vue', creeLe: le(300) }),
      demande({ id: 'dem-e-recente', creeLe: le(5) }),
      demande({ id: 'dem-r', statut: 'repondue' }),
      demande({ id: 'dem-e-ancienne', creeLe: le(200) }),
      demande({ id: 'dem-g', statut: 'reglee' }),
    ];
    verifier(demandesATraiter(liste).map((x) => x.id).join() === 'dem-e-ancienne,dem-e-recente,dem-v-ancienne', 'à traiter : les nouvelles d’abord (les plus anciennes en tête), puis les vues ; ni répondues ni réglées');
    verifier(demandeATraiter({ statut: 'vue' }) && !demandeATraiter({ statut: 'repondue' }) && !demandeATraiter(undefined), 'à traiter : envoyée ou vue');
    verifier(peutVoirDemandes('gerant') && !peutVoirDemandes('operations') && !peutVoirDemandes('lecture') && !peutVoirDemandes('prestataire') && !peutVoirDemandes(undefined), 'lire les demandes : le gérant seul');
    verifier(peutTraiterDemandes('gerant') && !peutTraiterDemandes('gerant', true) && !peutTraiterDemandes('operations'), 'répondre et changer l’état : le gérant, hors lecture seule');
  }

  /* ===================================================== cloisonnement */
  section('Cloisonnement : un propriétaire ne voit que les siennes, de son espace');
  {
    const autreLogement = logement('lb1', B, { nom: 'Chez B' });
    const ancien = logement('lc1', 'pro-c', { nom: 'Cédé par A', proprietairesPrecedents: [{ proprietaireId: A, jusquAu: '2026-10-01' }] });
    const toutes = [
      demande({ id: 'dem-a1', logementId: 'la1', creeLe: le(30), echanges: [{ id: 'e1', auteur: 'proprietaire', texte: 'Message de A', le: le(30) }, { id: 'e2', auteur: 'conciergerie', texte: 'Réponse', le: le(20), par: 'gerant@exemple.fr' }], statut: 'repondue' }),
      demande({ id: 'dem-a2', logementId: 'lb1', creeLe: le(10) }),
      demande({ id: 'dem-a3', logementId: 'lc1', creeLe: le(5) }),
      demande({ id: 'dem-b1', proprietaireId: B, logementId: 'lb1', echanges: [{ id: 'e', auteur: 'proprietaire', texte: 'Secret de B', le: le(1) }] }),
      { id: 'abime', proprietaireId: A },
      null,
    ] as unknown[];
    const vues = demandesVues(toutes, A, [...LOGEMENTS.filter((l) => l.id !== 'lb1'), autreLogement, ancien]);
    const texte = JSON.stringify(vues);
    verifier(vues.every((v) => ['dem-a1', 'dem-a2', 'dem-a3', 'abime'].includes(v.id)) && !texte.includes('Secret de B') && !texte.includes('dem-b1'), 'jamais la demande d’un autre propriétaire');
    verifier(!/"par"|gerant@exemple|"historique"/.test(texte), 'jamais qui a répondu dans l’équipe, jamais l’historique des états');
    verifier(vues.find((v) => v.id === 'dem-a2')?.logement === undefined && !texte.includes('Chez B'), 'le nom du logement d’un autre n’est jamais montré');
    verifier(vues.find((v) => v.id === 'dem-a3')?.logement?.nom === 'Cédé par A', 'un logement qui a été à lui : son nom reste');
    verifier(vues[0].id === 'abime' || vues.map((v) => v.id).slice(0, 3).join() === 'dem-a3,dem-a2,dem-a1', 'des plus récentes aux plus anciennes');
    verifier(demandesVues(toutes, ID_PROPRIETAIRE_A_RENSEIGNER, LOGEMENTS).length === 0 && demandesVues(toutes, '', LOGEMENTS).length === 0, 'fiche d’attente ou propriétaire vide : rien');

    // Deux espaces, deux bases : le même identifiant de propriétaire dans chacun ne voit que la sienne.
    const bases: Record<string, ReturnType<typeof baseMemoire>> = {
      [ID_LABEL_MAISON]: baseMemoire({ [COLLECTION_DEMANDES]: [demande({ id: 'dem-lm', echanges: [{ id: 'x', auteur: 'proprietaire', texte: 'Chez Label Maison', le: le(1) }] })] }),
      [SENS]: baseMemoire({ [COLLECTION_DEMANDES]: [demande({ id: 'dem-sens', echanges: [{ id: 'y', auteur: 'proprietaire', texte: 'Chez Sens', le: le(1) }] })] }),
    };
    // Comme l'action « demandes » : la base de l'espace de la session, puis demandesVues.
    const lues = async (espace: string) => demandesVues(await bases[espace].base.lire<unknown>(COLLECTION_DEMANDES), A, LOGEMENTS);
    const deLm = JSON.stringify(await lues(ID_LABEL_MAISON));
    const deSens = JSON.stringify(await lues(SENS));
    verifier(deLm.includes('Chez Label Maison') && !deLm.includes('Chez Sens') && deSens.includes('Chez Sens') && !deSens.includes('Chez Label Maison'), 'un autre espace : jamais lu (chaque espace a sa base)');
    await enregistrerDemande(bases[SENS].base, { proprietaireId: A, corps: { type: 'question', logement: 'la1', message: MESSAGE }, logements: LOGEMENTS, maintenantMs: maintenant, le: le(0) });
    verifier(bases[ID_LABEL_MAISON].donnees[COLLECTION_DEMANDES]?.length === 1 && bases[SENS].donnees[COLLECTION_DEMANDES]?.length === 2, 'une demande s’écrit dans la base de l’espace de la session, et elle seule');

    // La route : session, base de la session, propriétaire de la session (lecture du code).
    const route = lire('api/espace-proprietaire.ts');
    const bloc = (action: string) => route.slice(route.indexOf(`if (action === '${action}'`), route.indexOf('\n    }\n', route.indexOf(`if (action === '${action}'`)));
    const lecture = bloc('demandes');
    const envoi = bloc('demande');
    verifier(!!route && /sessionProprietaire\(req, res\)/.test(lecture) && /s\.base\.lire<unknown>\(COLLECTION_DEMANDES\)/.test(lecture) && /demandesVues\(demandes, s\.acces\.proprietaireId/.test(lecture), 'route « demandes » : session revérifiée, base de SA session, réduite à lui');
    verifier(/provenanceSite\(req\)/.test(envoi) && /sessionProprietaire\(req, res\)/.test(envoi) && /const proprietaireId = s\.acces\.proprietaireId;/.test(envoi) && /enregistrerDemande\(s\.base,/.test(envoi) && !/corps\.proprietaireId|corps\.espace|x-erp-espace/.test(envoi), 'route « demande » : provenance du site, session, propriétaire et base de la session (jamais du corps)');
    verifier(envoi.indexOf('enregistrerDemande(') >= 0 && envoi.indexOf('enregistrerDemande(') < envoi.indexOf('prevenirGerants('), 'enregistrée d’abord, prévenue ensuite');
  }

  /* ====================================================== notification */
  section('Notification « Demande d’un propriétaire » : gérant seulement, sans données sensibles');
  {
    const t = TYPES_NOTIFICATION.find((x) => x.type === 'demande_proprietaire');
    verifier(t?.libelle === 'Demande d’un propriétaire' && t.defaut === true, 'réglage « Demande d’un propriétaire », activé par défaut');
    verifier(TYPES_RESERVES_GERANT.includes('demande_proprietaire') && typePourRole('demande_proprietaire', 'gerant') && !typePourRole('demande_proprietaire', 'operations') && !typePourRole('demande_proprietaire', 'lecture') && !typePourRole('demande_proprietaire', undefined), 'réservé au gérant (proposé à lui seul dans les réglages)');
    verifier(preferencesPourRole({ demande_proprietaire: true }, 'operations').demande_proprietaire === false, 'un autre rôle qui l’aurait activé : coupé à l’envoi');
    const sensible = demande({ id: 'dem-sensible', type: 'demande', sujet: 'cles', echanges: [{ id: 'e', auteur: 'proprietaire', texte: 'Le code du boîtier est 4512, appelez-moi au 06 12 34 56 78', le: le(0) }] });
    const g = notificationDemandeProprietaire(sensible, { logement: 'Corbeil Centre Familial' });
    const v = g.variantes[0];
    verifier(v.type === 'demande_proprietaire' && v.titre === 'Demande d’un propriétaire' && v.corps === 'Corbeil Centre Familial · Demande · Clés' && v.gerant === true, `contenu : « ${v.titre} », « ${v.corps} »`);
    verifier(!/4512|06 12|appelez|SCI|Propriétaire A/.test(JSON.stringify(g)), 'ni le message, ni un code, ni un numéro, ni le nom du propriétaire');
    verifier(v.url === '/erp/logements/demandes?demande=dem-sensible' && g.cle === 'demande-proprio-dem-sensible', 'ouvre la demande dans l’ERP ; une clé par demande (une seule fois)');
    const long = notificationDemandeProprietaire(sensible, { logement: 'L'.repeat(80) }).variantes[0].corps;
    verifier(long.length <= 40 + ' · Demande · Clés'.length && long.includes('…'), 'nom de logement tronqué (40 caractères)', long);
    verifier(notificationDemandeProprietaire({ ...sensible, tousLogements: true }, {}).variantes[0].corps === 'Tous ses logements · Demande · Clés', '« Tous ses logements »');
    verifier(varianteAEnvoyer(g, {}, 'gerant')?.type === 'demande_proprietaire' && varianteAEnvoyer(g, preferencesPourRole({ demande_proprietaire: true }, 'operations'), 'operations') === undefined && varianteAEnvoyer(g, {}, undefined) === undefined, 'variante : le gérant oui, un autre rôle ou un rôle inconnu non');
    verifier(libelleDemande({ type: 'question' }) === 'Question' && libelleDemande({ type: 'demande', sujet: 'autre' }) === 'Demande particulière' && libelleDemande({ type: 'autre' }) === 'Autre demande', 'libellés courts');

    // Envoi : trois appareils de l'espace, seul celui du gérant reçoit.
    const appareil = (id: string, role?: string): Appareil => ({
      id: `notifications-appareil-${id}`,
      type: 'notifications-appareil',
      endpoint: `https://fcm.googleapis.com/fcm/send/${id}`,
      keys: { p256dh: 'p', auth: 'a' },
      preferences: { demande_proprietaire: true },
      ...(role ? { role } : {}),
      creeLe: le(100),
      majLe: le(100),
    });
    const espace = baseMemoire({ connecteurs: [appareil('gerant', 'gerant'), appareil('ops', 'operations'), appareil('lecture', 'lecture'), appareil('ancien')] });
    const recus: string[] = [];
    const envoyer: Envoyeur = async (a) => {
      recus.push(a.endpoint);
      return { ok: true, statut: 201 } as Awaited<ReturnType<Envoyeur>>;
    };
    const cles: ClesVapid = { publique: 'x', privee: 'y', sujet: 'mailto:essai@exemple.fr' };
    const bilan = await envoyerNotifications(espace.base, [g], { cles, envoyer, maintenant: new Date(maintenant) });
    verifier(bilan.envoyees === 1 && recus.length === 1 && recus[0].endsWith('/gerant'), 'envoi : l’appareil du gérant seul (ni opérations, ni lecture, ni rôle inconnu)', recus);
    const encore = await envoyerNotifications(espace.base, [g], { cles, envoyer, maintenant: new Date(maintenant) });
    verifier(encore.dejaParties === 1 && recus.length === 1, 'la même demande ne notifie qu’une fois (journal)');
    verifier((await envoyeesDepuis(espace.base, 'demande-proprio-', new Date(maintenant - 3_600_000))) === 1, 'le journal compte les notifications de demandes de l’heure');
  }

  section('Notification plafonnée : au-delà de 5 dans l’heure, une synthèse par heure');
  {
    const d = demande({ id: 'dem-p', type: 'demande', sujet: 'prix' });
    const m = new Date(maintenant);
    verifier(notificationDemandePlafonnee(d, { logement: 'Massy', recentes: PLAFOND_DEMANDES_PROPRIETAIRES_HEURE - 1, maintenant: m }).cle === 'demande-proprio-dem-p', `${PLAFOND_DEMANDES_PROPRIETAIRES_HEURE - 1} dans l’heure : la notification de la demande`);
    const s1 = notificationDemandePlafonnee(d, { logement: 'Massy', recentes: PLAFOND_DEMANDES_PROPRIETAIRES_HEURE, maintenant: m });
    const s2 = notificationDemandePlafonnee(demande({ id: 'dem-q' }), { recentes: 9, maintenant: new Date(maintenant + 10 * 60_000) });
    verifier(s1.cle === s2.cle && s1.cle.startsWith('demande-proprio-plusieurs-') && s1.variantes[0].titre === 'Plusieurs demandes de propriétaires' && s1.variantes[0].gerant === true, 'au plafond : « Plusieurs demandes de propriétaires », même clé dans l’heure (une seule part)');
    verifier(!/Massy|prix/i.test(JSON.stringify(s1)), 'la synthèse ne dit ni logement ni sujet');
    // Le serveur compte dans le journal de l'espace (envoyeesDepuis) : 5 parties dans l'heure, la suivante est la synthèse.
    const journal = {
      id: 'notifications-journal',
      envoyees: [
        ...Array.from({ length: 5 }, (_, i) => ({ cle: `demande-proprio-dem-${i}`, le: new Date(maintenant - i * 60_000).toISOString() })),
        { cle: 'demande-proprio-dem-vieille', le: new Date(maintenant - 2 * 3_600_000).toISOString() },
        { cle: 'lead-x', le: new Date(maintenant).toISOString() },
      ],
    };
    const plein = baseMemoire({ connecteurs: [journal] });
    const recentes = await envoyeesDepuis(plein.base, 'demande-proprio-', new Date(maintenant - 3_600_000));
    verifier(recentes === 5 && notificationDemandePlafonnee(d, { recentes, maintenant: m }).cle.startsWith('demande-proprio-plusieurs-'), '5 parties dans l’heure (journal ; ni les plus anciennes, ni les autres types) : la suivante devient la synthèse', recentes);
    // Deux synthèses dans la même heure : une seule part.
    const app: Appareil = { id: 'notifications-appareil-g', type: 'notifications-appareil', endpoint: 'https://fcm.googleapis.com/fcm/send/g', keys: { p256dh: 'p', auth: 'a' }, preferences: {}, role: 'gerant', creeLe: le(9), majLe: le(9) };
    const base = baseMemoire({ connecteurs: [app] });
    let parties = 0;
    const envoyer: Envoyeur = async () => (parties++, { ok: true, statut: 201 } as Awaited<ReturnType<Envoyeur>>);
    const cles: ClesVapid = { publique: 'x', privee: 'y', sujet: 'mailto:essai@exemple.fr' };
    await envoyerNotifications(base.base, [s1], { cles, envoyer, maintenant: m });
    await envoyerNotifications(base.base, [s2], { cles, envoyer, maintenant: new Date(maintenant + 10 * 60_000) });
    verifier(parties === 1, 'au plafond : une seule synthèse par heure', parties);
  }

  section('Un échec de notification n’enlève jamais la demande ; sans configuration, rien ne casse');
  {
    const lm = baseMemoire({ logements: LOGEMENTS });
    const r = await enregistrerDemande(lm.base, { proprietaireId: A, corps: { type: 'question', logement: 'la1', message: MESSAGE }, logements: LOGEMENTS, maintenantMs: maintenant, le: le(0) });
    verifier(r.ok, 'demande enregistrée');
    // Appareils illisibles (panne de la base) : l'envoi ne lève pas.
    const panne: BaseNotifications = { lire: async () => Promise.reject(new Error('base injoignable')), ecrire: async () => Promise.reject(new Error('base injoignable')) };
    let leve = false;
    try {
      const b = await envoyerNotifications(panne, [notificationDemandeProprietaire(r.ok ? r.demande : demande({ id: 'x' }), {})], { cles: { publique: 'x', privee: 'y', sujet: 'mailto:essai@exemple.fr' } });
      verifier(b.envoyees === 0, 'base en panne : aucune notification, sans erreur');
    } catch {
      leve = true;
    }
    verifier(!leve, 'envoyerNotifications ne lève jamais');
    // Le module du serveur (import dynamique : il reste hors du programme TypeScript de l'ERP).
    const serveur = (await import('../../../api/_demandes-proprietaires' as string)) as {
      prevenirGerants: (base: unknown, espace: string, d: DemandeProprietaire, o: { logement?: string; proprietaire: string }) => Promise<void>;
      emailDemande: (o: { conciergerie: string; proprietaire: string; logement?: string; demande: DemandeProprietaire; lien: string }) => { sujet: string; html: string; text: string };
    };
    const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process!.env;
    const casse = new Proxy({}, { get: () => async () => Promise.reject(new Error('panne')) });
    const essai = async () => {
      try {
        await serveur.prevenirGerants(casse, SENS, r.ok ? r.demande : demande({ id: 'x' }), { logement: 'Logement la1', proprietaire: 'Propriétaire A' });
        return undefined;
      } catch (e) {
        return e instanceof Error ? e.message : String(e);
      }
    };
    // Sans clés VAPID ni clé d'envoi d'e-mails : rien ne part, rien ne casse.
    delete env.VAPID_PUBLIC_KEY;
    delete env.VAPID_PRIVATE_KEY;
    delete env.RESEND_API_KEY;
    const sansConfig = await essai();
    verifier(sansConfig === undefined, 'sans clés ni e-mail configurés : prévenir ne lève jamais', sansConfig);
    // Avec des clés valables, mais la base en panne (appareils et journal illisibles) : ne lève jamais non plus.
    const k = await genererClesVapid();
    env.VAPID_PUBLIC_KEY = k.publique;
    env.VAPID_PRIVATE_KEY = k.privee;
    const enPanne = await essai();
    delete env.VAPID_PUBLIC_KEY;
    delete env.VAPID_PRIVATE_KEY;
    verifier(enPanne === undefined, 'notifications activées, base en panne : prévenir ne lève jamais', enPanne);
    const { emailDemande } = serveur;
    verifier(lm.donnees[COLLECTION_DEMANDES]?.length === 1, 'la demande reste enregistrée');
    const mail = emailDemande({
      conciergerie: 'Sens',
      proprietaire: 'Propriétaire A',
      logement: 'Logement la1',
      demande: demande({ id: 'dem-mail', echanges: [{ id: 'e', auteur: 'proprietaire', texte: `<script>alert(1)</script>\n${'a'.repeat(800)}`, le: le(0) }] }),
      lien: 'https://www.labelmaisoncg.fr/erp/logements/demandes?demande=dem-mail',
    });
    verifier(!mail.html.includes('<script>') && mail.html.includes('&lt;script&gt;') && !mail.sujet.includes('script'), 'e-mail : message échappé, jamais dans le sujet');
    verifier(mail.text.includes('…') && !mail.text.includes('a'.repeat(700)) && mail.html.includes('Ouvrir la demande'), 'e-mail : message tronqué (600 caractères), lien vers la demande');
    const code = lire('api/_demandes-proprietaires.ts');
    verifier(/estCompteTechnique\(e, equipe\)/.test(code) && /GERANTS_MAX/.test(code) && /if \(!expediteurEspace\(fiche\)\) return 0;/.test(code) && /RESEND_API_KEY/.test(code), 'e-mail : gérants de l’espace seulement, jamais un compte technique, 5 au plus ; sans clé ou sans expéditeur : rien');
    verifier(/emailsDesGerants\(\)/.test(code) && /role=eq\.gerant/.test(lire('src/erp/data/repull-synchro.ts')), 'destinataires : les gérants de l’espace de la base (erp.membres, rôle gérant)');
  }

  /* =========================================================== fuites */
  section('Aucune fuite : ni l’agent IA, ni le connecteur Claude, ni une plateforme');
  {
    const nomme = /demandesProprietaires|demandes-proprietaires|DemandeProprietaire|COLLECTION_DEMANDES/;
    const agent = [
      ...fichiers('agent-ia', () => true),
      ...fichiers('api', (f) => /mcp|agent|copilote|crm-assistant|oauth|connecteur|briefing|repull|erp-agenda|_crm/.test(f)),
      ...fichiers('src/erp/data', (f) => /mcp|agent|copilote|messagerie-ia|crm-assistant|briefing|fiche-agent|controle-reponse|messagerie-envoi|repull\.ts|avis-serveur|redaction-avis/.test(f) && !/verifier-/.test(f)),
    ];
    verifier(agent.length > 20, `fichiers de l’agent IA, du connecteur et de la synchronisation lus (${agent.length})`);
    // Deux exceptions, vérifiées à part : briefing.ts (calcul SANS IA de « Votre journée », à l'écran du gérant)
    // et repull-synchro.ts (BaseErp : la lecture des adresses des gérants, rien d'autre).
    const fautifs = agent.filter((f) => nomme.test(lire(f)) && !/(^|\/)briefing\.ts$|repull-synchro\.ts$/.test(f));
    verifier(fautifs.length === 0, 'aucun ne lit les demandes des propriétaires', fautifs);
    verifier(!nomme.test(lire('src/erp/data/briefing-passage.ts')), 'le passage du matin (planifié avec l’agent) ne lit pas les demandes');
    const briefing = lire('src/erp/data/briefing.ts');
    verifier(/if \(e\.gerant\) \{[\s\S]*demandesATraiter\(e\.demandesProprietaires\)/.test(briefing) && !/import[^;]*(agent|mcp|copilote|messagerie-ia)/.test(briefing.replace(/fiche-agent\.js|controle-reponse\.js/g, '')), 'briefing : les demandes pour le gérant seulement, sans IA');
    const synchroCode = lire('src/erp/data/repull-synchro.ts');
    verifier((synchroCode.match(nomme) ?? []).length <= 1 && /async emailsDesGerants\(\): Promise<string\[\]>/.test(synchroCode), 'BaseErp : seulement la lecture des gérants (pas les demandes)');
    // BaseErp : seule une lecture des gérants est ajoutée ; ecritureRepullPermise n'en sait rien.
    const synchro = lire('src/erp/data/repull-synchro.ts');
    const permise = synchro.slice(synchro.indexOf('export function ecritureRepullPermise'), synchro.indexOf('\n}\n', synchro.indexOf('export function ecritureRepullPermise')));
    verifier(!!permise && !/demande|review|guest/i.test(permise.replace(/CHEMIN_AVIS|corpsAvisPermis\(avis\[2\], corps\)|const avis = /g, '')), 'ecritureRepullPermise : inchangée (aucune écriture de plus vers les plateformes)');
    verifier(!nomme.test(lire('agent-ia/src/repull.ts')), 'le verrou d’agent-ia/src/repull.ts ne connaît pas les demandes');
    const module = lire('src/erp/data/demandes-proprietaires.ts');
    const imports = [...module.matchAll(/^import[^;]*from '([^']+)'/gm)].map((m) => m[1]).sort();
    verifier(JSON.stringify(imports) === JSON.stringify(['./repull.js', './types', './types-proprietaire']), 'règles des demandes : aucune dépendance vers l’IA, le connecteur ou une plateforme', imports);
    const serveur = lire('api/_demandes-proprietaires.ts');
    // Les imports de code (pas « import type ») : rien qui écrive vers une plateforme ou parle à l'IA.
    const importsServeur = [...serveur.matchAll(/^import (?!type )[^;]*from '([^']+)'/gm)].map((m) => m[1]);
    verifier(!importsServeur.some((i) => /agent|mcp|copilote|repull-synchro\.js$|messagerie|_erp-repull-|annonces/.test(i)) && !/fetch\(/.test(serveur), 'serveur des demandes : rien vers l’agent IA, le connecteur ou une plateforme (aucun appel réseau à part)', importsServeur);
    verifier(COLLECTIONS.includes('demandesProprietaires') && COLLECTIONS_SYNCHRONISEES.includes('demandesProprietaires') && donneesVides().demandesProprietaires.length === 0, 'collection de l’ERP (erp.enregistrements), vide par défaut');
    verifier(Array.isArray(completer({ logements: [] } as Partial<ErpDonnees>).demandesProprietaires), 'ancienne sauvegarde : complétée à vide');
  }

  /* ============================================================= gérant */
  section('ERP : « À faire » de l’Accueil, suppression d’une fiche');
  {
    const seed = creerSeed();
    const aFaire = (gerant: boolean) => construireATraiter(seed, '2026-09-24', { gerant }).find((x) => x.type === 'demandeProprietaire');
    const ligne = aFaire(true);
    const attendues = demandesATraiter(seed.demandesProprietaires).length;
    verifier(!!ligne && ligne.titre === `${attendues} demandes de propriétaires` && ligne.priorite === 1 && ligne.liens?.length === attendues, 'gérant : « N demandes de propriétaires », aujourd’hui, un lien par demande', ligne);
    verifier(aFaire(false) === undefined, 'un autre rôle : pas de ligne');
    verifier(!JSON.stringify(ligne).includes('bilan d’août') && ligne?.to.startsWith('/erp/logements/demandes?demande='), 'la ligne ne reprend pas les messages ; elle ouvre la demande');
    verifier(construireATraiter({ ...seed, demandesProprietaires: undefined } as unknown as ErpDonnees, '2026-09-24').every((x) => x.type !== 'demandeProprietaire'), 'données d’avant (sans la collection) : rien, sans erreur');
    const prop = { id: 'pro-essai', nom: 'Essai', type: 'particulier', contact: {} } as ErpDonnees['proprietaires'][number];
    const d = { ...donneesVides(), proprietaires: [prop], demandesProprietaires: [demande({ id: 'dem-e1', proprietaireId: 'pro-essai' }), demande({ id: 'dem-e2', proprietaireId: 'pro-essai' }), demande({ id: 'dem-autre', proprietaireId: B })] };
    const v = verdictSuppressionProprietaire({ role: 'gerant', proprietaireId: 'pro-essai', donnees: d });
    verifier(v.ok && v.avecLui.includes('les demandes envoyées depuis son espace'), 'supprimer une fiche sans historique : ses demandes partent avec elle (dit dans la confirmation)', v);
    const apres = supprimerProprietaireDe(d, 'pro-essai');
    verifier(apres.demandesProprietaires.map((x) => x.id).join() === 'dem-autre', 'seules ses demandes partent, jamais celles d’un autre');
  }

  section('Typographie française des écrans et des messages');
  {
    const ecrans = [
      'src/erp/espace-proprietaire/Demandes.tsx',
      'src/erp/modules/logements/_composants/DemandesProprietaires.tsx',
      'src/erp/modules/logements/DemandesParc.tsx',
      'src/erp/data/demandes-proprietaires.ts',
      'src/erp/data/seed-demandes.ts',
      'api/_demandes-proprietaires.ts',
    ];
    for (const f of ecrans) {
      const source = lire(f);
      verifier(!!source, `${f} : lu (lancer depuis la racine du dépôt)`);
      const fautes = textesAvecEspaceSimple(source);
      verifier(fautes.length === 0, `${f} : espace insécable avant « ? » et « : »`, fautes.map((t) => t.trim().slice(0, 60)));
      // « » dans le code (commentaires retirés) : une espace insécable à l'intérieur, écrite telle quelle, ${NBSP}, {NBSP} (JSX) ou &nbsp;.
      const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
      const mal = [...code.matchAll(/«(?! |\$?\{NBSP\}|&nbsp;)|(?<! |\$?\{NBSP\}|&nbsp;)»/g)].map((m) => code.slice(Math.max(0, (m.index ?? 0) - 30), (m.index ?? 0) + 10));
      verifier(mal.length === 0, `${f} : « » avec espaces insécables (dans le code)`, mal);
    }
    const textes = ecrans.flatMap((f) => textesDuSource(lire(f)));
    const droites = textes.filter((t) => /\p{L}'\p{L}/u.test(t) && !/^[a-z0-9_./-]+$/i.test(t) && /\s/.test(t));
    verifier(droites.length === 0, 'apostrophes typographiques (’) dans les textes', droites.slice(0, 5));
  }

  console.log(`\n${reussis} contrôles réussis, ${echecs} en échec.`);
  (globalThis as { process?: { exitCode?: number } }).process!.exitCode = echecs ? 1 : 0;
}

void principal();
