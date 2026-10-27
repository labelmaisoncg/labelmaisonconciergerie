/**
 * Auto-contrôle des annonces à l'équipe (sans réseau) :
 *   - collection synchronisée, complétée à vide dans les anciennes
 *     sauvegardes, écriture réservée au gérant (navigateur et base) ;
 *   - ce qu'une personne voit sur l'Accueil : publiées, non retirées, non
 *     fermées sur l'appareil, les plus récentes d'abord ;
 *   - premier message « Bonjour » au nom de la conciergerie de l'espace ;
 *   - notification : titre et texte tronqués, ouvre l'Accueil, type
 *     « annonce » réglable et actif par défaut ;
 *   - envoi par le serveur : refus pour un non-gérant, annonce relue dans la
 *     base, retirée ou absente refusée, jamais deux fois, appareils qui
 *     l'acceptent seulement ;
 *   - rien vers les plateformes, aucune nouvelle fonction Vercel.
 *
 * Lancement (Node 18+, depuis la racine du dépôt) :
 *   node_modules/.bin/esbuild src/erp/data/verifier-annonces-equipe.ts --bundle --platform=node --format=esm \
 *     --define:import.meta.env='{"VITE_ERP_DEMO":"1"}' --log-level=error --outfile=/tmp/verifier-annonces-equipe.mjs \
 *     && node /tmp/verifier-annonces-equipe.mjs
 */
import {
  AFFICHEES_MAX,
  annoncesPubliees,
  annoncesVisibles,
  brouillonInitial,
  cleFermees,
  cleNotificationAnnonce,
  COLLECTION_ANNONCES_EQUIPE,
  deciderEnvoiAnnonce,
  FERMEES_MAX,
  fermerAnnonce,
  issueDeLaReponse,
  issueDeLErreur,
  lireAnnonce,
  lireFermees,
  messagePublication,
  notificationAnnonce,
  premiereAnnonce,
  preparerAnnonce,
  retirerAnnonce,
  TEXTE_MAX,
  TEXTE_NOTIFICATION_MAX,
  TITRE_MAX,
  TITRE_NOTIFICATION_MAX,
  type AnnonceEquipe,
  type IssueNotification,
} from './annonces-equipe';
import { COLLECTIONS, COLLECTIONS_SYNCHRONISEES, completer, donneesVides } from './collections';
import { ecritureGerantSeulement, operationReserveeAuGerant } from './ecritures-gerant';
import { ESPACE_LABEL_MAISON, ID_LABEL_MAISON } from './espaces';
import { nomConciergerie } from './marque-espace';
import { annoncerAEquipe, enregistrerAppareil, lireAppareils, type BaseNotifications } from './notifications-envoi';
import { estActive, nettoyerPreferences, TYPES_NOTIFICATION, varianteAEnvoyer } from './notifications';
import { ecritureRepullPermise } from './repull-synchro';
import { creerSeed } from './seed';
import { construireIndex } from '../layout/recherche/moteur';
import { b64url, genererClesVapid, type AbonnementPush } from './web-push';
import type { ErpDonnees } from './types';

let echecs = 0;
let reussis = 0;
function verifier(condition: unknown, message: string, detail?: unknown) {
  if (condition) reussis++;
  else {
    echecs++;
    console.error(`  ✗ ${message}${detail !== undefined ? ` (${JSON.stringify(detail)})` : ''}`);
  }
}
const section = (titre: string) => console.log(`\n${titre}`);

// Modules de Node chargés à l'exécution (l'ERP n'a pas les types de Node).
const nomFs = 'node:fs';
const nomChemins = 'node:path';
const fs = (await import(/* @vite-ignore */ nomFs)) as {
  existsSync(p: string): boolean;
  readFileSync(p: string, e: 'utf8'): string;
  readdirSync(p: string): string[];
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
const source = (chemin: string): string => (racine && fs.existsSync(chemins.join(racine, chemin)) ? fs.readFileSync(chemins.join(racine, chemin), 'utf8') : '');

/* ------------------------------------------------------------ données */

const SENS = { id: '5e5e0000-0000-4000-8000-000000000002', nom: 'Sens' };
const annonce = (id: string, x: Partial<AnnonceEquipe> = {}): AnnonceEquipe => ({
  id,
  titre: `Annonce ${id}`,
  texte: `Texte ${id}`,
  publieeLe: '2026-10-20T09:00:00+02:00',
  publieePar: 'Gérant',
  ...x,
});

/** Fausse base : lignes par collection, lectures comptées. */
class FausseBase implements BaseNotifications {
  lignes = new Map<string, { id: string }>();
  lectures: string[] = [];
  async lire<T>(collection: string, ids?: string[]): Promise<T[]> {
    this.lectures.push(collection);
    return [...this.lignes.entries()]
      .filter(([k]) => k.startsWith(`${collection}/`) && (!ids || ids.includes(k.slice(collection.length + 1))))
      .map(([, v]) => JSON.parse(JSON.stringify(v)) as T);
  }
  async ecrire(collection: string, elements: { id: string }[]): Promise<void> {
    for (const e of elements) this.lignes.set(`${collection}/${e.id}`, JSON.parse(JSON.stringify(e)));
  }
}

async function principal() {
  section('1. Collection : synchronisée, complétée à vide, réservée au gérant');
  {
    verifier(COLLECTION_ANNONCES_EQUIPE === 'annoncesEquipe', 'nom de la collection');
    verifier(COLLECTIONS.includes('annoncesEquipe') && COLLECTIONS_SYNCHRONISEES.includes('annoncesEquipe'), 'dans COLLECTIONS et synchronisée (erp.enregistrements)');
    verifier(!/version/i.test(COLLECTION_ANNONCES_EQUIPE) && (COLLECTION_ANNONCES_EQUIPE as string) !== 'versionsAnnonce' && COLLECTIONS.includes('versionsAnnonce'), 'distincte des annonces des logements (versionsAnnonce)');
    const ancienne = completer({ logements: [] } as unknown as Partial<ErpDonnees>);
    verifier(Array.isArray(ancienne.annoncesEquipe) && ancienne.annoncesEquipe.length === 0, 'ancienne sauvegarde : complétée à vide');
    verifier(Array.isArray(donneesVides().annoncesEquipe), 'jeu vide : collection présente');
    verifier(ecritureGerantSeulement('annoncesEquipe', 'aeq-1') && ecritureGerantSeulement('annoncesEquipe', 'nimporte'), 'écriture réservée au gérant (ecritures-gerant.ts)');
    const vide = donneesVides();
    verifier(
      operationReserveeAuGerant({ type: 'ecrire', collection: 'annoncesEquipe', id: 'aeq-1', donnees: { ...annonce('aeq-1') } }, vide) &&
        operationReserveeAuGerant({ type: 'supprimer', collection: 'annoncesEquipe', id: 'aeq-1' }, vide),
      'compte non gérant : écriture et suppression jamais mises en file',
    );
    for (const fichier of ['supabase/erp-espaces.sql', 'supabase/erp-acces-gerants.sql', 'supabase/erp-installation.sql']) {
      const sql = source(fichier);
      const corps = /create or replace function erp\.ecriture_gerant_seulement[\s\S]*?\$\$([\s\S]*?)\$\$/.exec(sql)?.[1] ?? '';
      const liste = /p_collection in \(([^)]*)\)/.exec(corps)?.[1] ?? '';
      verifier(liste.includes("'annoncesEquipe'"), `${fichier} : annoncesEquipe dans erp.ecriture_gerant_seulement`, liste);
    }
  }

  section('2. Ce que chacun voit sur l’Accueil');
  {
    const liste: unknown[] = [
      annonce('a-ancienne', { publieeLe: '2026-10-01T09:00:00+02:00' }),
      annonce('a-recente', { publieeLe: '2026-10-25T09:00:00+02:00' }),
      annonce('a-milieu', { publieeLe: '2026-10-10T09:00:00+02:00' }),
      annonce('a-retiree', { publieeLe: '2026-10-26T09:00:00+02:00', retireeLe: '2026-10-26T10:00:00+02:00', retireePar: 'Gérant' }),
      { id: 'a-sans-titre', titre: '  ', texte: 'x', publieeLe: '2026-10-26T09:00:00+02:00' },
      { id: 'a-sans-date', titre: 'x', texte: 'x' },
      { id: 'mauvais id !', titre: 'x', texte: 'x', publieeLe: '2026-10-26T09:00:00+02:00' },
      null,
      'texte',
    ];
    const ids = (l: AnnonceEquipe[]) => l.map((a) => a.id).join();
    verifier(ids(annoncesPubliees(liste)) === 'a-recente,a-milieu,a-ancienne', 'gérant : publiées, les plus récentes d’abord, sans les retirées ni les lignes abîmées', ids(annoncesPubliees(liste)));
    verifier(ids(annoncesVisibles(liste, [])) === 'a-recente,a-milieu,a-ancienne', 'personne qui arrive : toutes les annonces encore publiées');
    verifier(ids(annoncesVisibles(liste, ['a-recente'])) === 'a-milieu,a-ancienne', 'annonce fermée sur l’appareil : plus affichée');
    verifier(annoncesVisibles(liste, ['a-recente', 'a-milieu', 'a-ancienne']).length === 0, 'tout lu : rien');
    verifier(!annoncesVisibles(liste, []).some((a) => a.id === 'a-retiree'), 'annonce retirée : jamais affichée');
    const beaucoup = Array.from({ length: 6 }, (_, i) => annonce(`b${i}`, { publieeLe: `2026-10-2${i}T09:00:00+02:00` }));
    verifier(annoncesVisibles(beaucoup, []).length === AFFICHEES_MAX && annoncesVisibles(beaucoup, [])[0].id === 'b5', `${AFFICHEES_MAX} au plus à la fois, la plus récente en premier`);
    verifier(annoncesVisibles(beaucoup, ['b5']).map((a) => a.id).join() === 'b4,b3,b2', 'après « J’ai lu », la suivante apparaît');
    verifier(annoncesVisibles(undefined, []).length === 0 && annoncesPubliees(undefined).length === 0, 'collection absente : rien');
    const memeDate = [annonce('m-a'), annonce('m-b')];
    verifier(annoncesPubliees(memeDate).map((a) => a.id).join() === annoncesPubliees([...memeDate].reverse()).map((a) => a.id).join(), 'même heure : ordre stable');
    verifier(lireAnnonce({ ...annonce('x'), titre: '  Bonjour  ' })?.titre === 'Bonjour', 'lecture : titre nettoyé');
  }

  section('3. « J’ai lu » : sur l’appareil, par espace et par personne');
  {
    const a = cleFermees(ID_LABEL_MAISON, 'kamel@exemple.fr');
    verifier(a !== cleFermees(SENS.id, 'kamel@exemple.fr') && a !== cleFermees(ID_LABEL_MAISON, 'abdel@exemple.fr'), 'clé propre à l’espace et à la personne');
    verifier(a === cleFermees(ID_LABEL_MAISON.toUpperCase(), ' Kamel@Exemple.fr '), 'clé stable (casse, espaces)');
    verifier(
      lireFermees(null).length === 0 && lireFermees('').length === 0 && lireFermees('{pas du json').length === 0 && lireFermees('{"a":1}').length === 0,
      'rien ou illisible : aucune annonce fermée',
    );
    verifier(lireFermees(JSON.stringify(['a1', 'a1', 3, null, 'mauvais id !', 'a2'])).join() === 'a1,a2', 'lecture tolérante : identifiants valables, sans doublon');
    const f1 = fermerAnnonce([], 'a1');
    verifier(f1.join() === 'a1' && fermerAnnonce(f1, 'a1').join() === 'a1', 'fermer deux fois : une seule entrée');
    const plein = Array.from({ length: FERMEES_MAX }, (_, i) => `f${i}`);
    const apres = fermerAnnonce(plein, 'nouvelle');
    verifier(apres.length === FERMEES_MAX && apres[apres.length - 1] === 'nouvelle' && !apres.includes('f0'), `${FERMEES_MAX} au plus, les plus récentes gardées`);
    const tableau = source('src/erp/modules/tableau-de-bord/_composants/AnnoncesEquipe.tsx');
    verifier(!!tableau && !/\.(upsert|remove|mettreAJour|enregistrerMaintenant)\(/.test(tableau) && !/appelerServeur|fetch\(/.test(tableau), 'carte de l’Accueil : rien n’est écrit dans la base, aucun appel au serveur');
    const acces = [...tableau.matchAll(/localStorage\.(getItem|setItem)/g)].length;
    const proteges = [...tableau.matchAll(/try\s*\{\s*(return\s+lireFermees\(window\.localStorage\.getItem|window\.localStorage\.setItem)/g)].length;
    verifier(acces === 2 && proteges === 2, 'chaque accès au localStorage dans un try/catch', { acces, proteges });
    verifier(/cleFermees\(espaceOuvert\(\)\.id,\s*d\.utilisateur\.id \|\| d\.utilisateur\.email\)/.test(tableau), 'clé de l’espace ouvert et du membre connecté');
  }

  section('4. Premier message : « Bonjour » au nom de la conciergerie');
  {
    const lm = premiereAnnonce(nomConciergerie(ESPACE_LABEL_MAISON));
    verifier(lm.titre === 'Bonjour 👋' && lm.texte === 'Bienvenue dans l’app Label Maison. Les nouvelles de l’équipe s’afficheront ici.', 'Label Maison', lm);
    const sens = premiereAnnonce(nomConciergerie({ ...SENS }));
    verifier(sens.texte.includes('l’app Sens.') && !sens.texte.includes('Label Maison'), 'autre espace : son nom, jamais « Label Maison »', sens);
    const sansNom = premiereAnnonce(nomConciergerie({ id: SENS.id, nom: '  ' }));
    verifier(sansNom.texte.startsWith('Bienvenue dans l’app. ') && !sansNom.texte.includes('  ') && !sansNom.texte.includes('Label Maison'), 'espace sans nom : phrase propre', sansNom);
    verifier(JSON.stringify(brouillonInitial([], 'Label Maison')) === JSON.stringify(lm), 'espace sans annonce : formulaire prérempli');
    verifier(JSON.stringify(brouillonInitial(undefined, 'Sens')) === JSON.stringify(premiereAnnonce('Sens')), 'collection absente : prérempli aussi');
    const retiree = retirerAnnonce(annonce('r1'), { maintenant: '2026-10-27T09:00:00+02:00', par: 'Gérant' });
    verifier(brouillonInitial([retiree], 'Label Maison').titre === '' && brouillonInitial([annonce('p1')], 'Label Maison').texte === '', 'dès qu’une annonce existe (même retirée) : formulaire vide');
    const ecran = source('src/erp/modules/parametres/AnnoncesEquipe.tsx');
    verifier(!!ecran && !ecran.includes('Label Maison') && /brouillonInitial\(d\.annoncesEquipe,\s*nomConciergerie\(espaceOuvert\(\)\)\)/.test(ecran), 'écran du gérant : nom de l’espace ouvert, jamais « Label Maison » en dur');
    const seed = creerSeed();
    const demo = annoncesVisibles(seed.annoncesEquipe, []);
    verifier(demo.length === 1 && demo[0].titre === 'Bonjour 👋' && demo[0].texte === lm.texte, 'démonstration : le « Bonjour » publié', demo);
  }

  section('5. Saisie du gérant');
  {
    const o = { id: 'aeq-1', maintenant: '2026-10-27T09:00:00+02:00', par: 'Gérant' };
    const vide = preparerAnnonce({ titre: '  ', texte: '\n ' }, o);
    verifier(!vide.ok && !!vide.erreurs.titre && !!vide.erreurs.texte, 'titre et texte obligatoires');
    const long = preparerAnnonce({ titre: 'x'.repeat(TITRE_MAX + 1), texte: 'y'.repeat(TEXTE_MAX + 1) }, o);
    verifier(!long.ok && long.erreurs.titre?.includes(String(TITRE_MAX)) && long.erreurs.texte?.includes(String(TEXTE_MAX)), 'longueurs bornées');
    const ok = preparerAnnonce({ titre: '  Fermeture   jeudi ', texte: '  Bureau fermé jeudi.  \r\n\r\n\r\n\r\nMerci !  ' }, o);
    verifier(ok.ok && ok.annonce.titre === 'Fermeture jeudi' && ok.annonce.texte === 'Bureau fermé jeudi.\n\nMerci !' && ok.annonce.publieeLe === o.maintenant && ok.annonce.publieePar === 'Gérant' && !ok.annonce.retireeLe, 'annonce propre, datée et signée', ok);
    verifier(!preparerAnnonce({ titre: 'a', texte: 'b' }, { ...o, id: 'mauvais id !' }).ok, 'identifiant illisible : refusé');
    const r = retirerAnnonce(annonce('a1'), { maintenant: '2026-10-27T10:00:00+02:00', par: 'Gérant' });
    verifier(r.retireeLe === '2026-10-27T10:00:00+02:00' && r.retireePar === 'Gérant' && r.titre === 'Annonce a1', 'retirer : garde l’annonce, marquée retirée');
  }

  section('6. Notification : contenu et type « annonce »');
  {
    const g = notificationAnnonce(annonce('a1', { titre: 'Bonjour 👋', texte: 'Ligne 1\nLigne 2' }));
    verifier(g.cle === 'annonce-a1' && g.cle === cleNotificationAnnonce('a1'), 'clé d’idempotence annonce-<id>');
    verifier(g.variantes.length === 1 && g.variantes[0].type === 'annonce' && g.variantes[0].url === '/erp', 'type « annonce », ouvre l’Accueil');
    verifier(g.variantes[0].titre === 'Bonjour 👋' && g.variantes[0].corps === 'Ligne 1 Ligne 2', 'titre et texte sur une ligne', g.variantes[0]);
    const longue = notificationAnnonce(annonce('a2', { titre: 'T'.repeat(TITRE_MAX), texte: 'mot '.repeat(100) }));
    verifier(
      longue.variantes[0].titre.length <= TITRE_NOTIFICATION_MAX && longue.variantes[0].corps.length <= TEXTE_NOTIFICATION_MAX && longue.variantes[0].corps.endsWith('…'),
      'texte long tronqué (…)',
      longue.variantes[0],
    );
    verifier(notificationAnnonce(annonce('a3', { texte: '' })).variantes[0].corps === 'Annonce a3', 'sans texte : le titre en corps');
    const type = TYPES_NOTIFICATION.find((t) => t.type === 'annonce');
    verifier(!!type && type.defaut === true && !!type.libelle && !/annonce airbnb|logement/i.test(type.libelle), 'type « annonce » réglable dans Paramètres → Application, actif par défaut', type);
    verifier(estActive({}, 'annonce') && estActive(undefined, 'annonce') && !estActive({ annonce: false }, 'annonce'), 'appareil sans réglage : reçue ; désactivée : non');
    verifier(nettoyerPreferences({ annonce: false, inconnu: true }).annonce === false, 'réglage « annonce » gardé par le serveur');
    verifier(varianteAEnvoyer(g, { annonce: false }) === undefined && varianteAEnvoyer(g, { message: false })?.type === 'annonce', 'chaque appareil selon son réglage');
  }

  section('7. Envoi par le serveur : gérant seulement, relue dans la base, une seule fois');
  {
    const cles = { ...(await genererClesVapid()), sujet: 'https://www.labelmaisoncg.fr' };
    const p256dh = b64url(new Uint8Array(65).fill(4));
    const abonnement = (n: string): AbonnementPush => ({ endpoint: `https://fcm.googleapis.com/fcm/send/${n}`, keys: { p256dh, auth: b64url(new Uint8Array(16).fill(1)) } });
    const envois: { endpoint: string; titre: string; corps: string; url: string; type: string }[] = [];
    let panne = false;
    const envoyer = async (a: AbonnementPush, c: unknown) => {
      if (panne) return { ok: false, statut: 500, expire: false };
      envois.push({ endpoint: a.endpoint, ...(c as { titre: string; corps: string; url: string; type: string }) });
      return { ok: true, statut: 201, expire: false };
    };

    // Décision pure.
    for (const role of ['operations', 'lecture', 'prestataire', '', undefined, null]) {
      const d = deciderEnvoiAnnonce({ role, id: 'a1', enregistree: annonce('a1') });
      verifier(!d.ok && d.statut === 403, `refus pour un compte ${role || 'sans rôle'}`);
    }
    const d400 = deciderEnvoiAnnonce({ role: 'gerant', id: '../x', enregistree: undefined });
    verifier(!d400.ok && d400.statut === 400, 'identifiant illisible : 400');
    const d404 = deciderEnvoiAnnonce({ role: 'gerant', id: 'a1', enregistree: undefined });
    verifier(!d404.ok && d404.statut === 404, 'annonce pas encore enregistrée : 404');
    const dAutre = deciderEnvoiAnnonce({ role: 'gerant', id: 'a1', enregistree: annonce('a2') });
    verifier(!dAutre.ok && dAutre.statut === 404, 'ligne d’une autre annonce : 404');
    const d409 = deciderEnvoiAnnonce({ role: 'gerant', id: 'a1', enregistree: { ...annonce('a1'), retireeLe: '2026-10-27T10:00:00+02:00' } });
    verifier(!d409.ok && d409.statut === 409 && d409.code === 'retiree', 'annonce retirée : ne part pas');
    const dOk = deciderEnvoiAnnonce({ role: 'gerant', id: 'a1', enregistree: annonce('a1') });
    verifier(dOk.ok && dOk.groupe.cle === 'annonce-a1', 'gérant, annonce publiée : envoyée');

    // Serveur, avec une fausse base.
    const base = new FausseBase();
    await enregistrerAppareil(base, { abonnement: abonnement('telephone') });
    await enregistrerAppareil(base, { abonnement: abonnement('ordinateur'), preferences: { message: false } });
    await enregistrerAppareil(base, { abonnement: abonnement('sans-annonces'), preferences: { annonce: false } });
    await base.ecrire(COLLECTION_ANNONCES_EQUIPE, [annonce('aeq-1', { titre: 'Bonjour 👋', texte: 'Texte enregistré dans la base.' })]);
    await base.ecrire(COLLECTION_ANNONCES_EQUIPE, [annonce('aeq-retiree', { retireeLe: '2026-10-27T10:00:00+02:00' })]);
    verifier((await lireAppareils(base)).length === 3, '3 appareils dans l’espace');

    base.lectures = [];
    const refus = await annoncerAEquipe(base, { role: 'operations', id: 'aeq-1', cles, envoyer });
    verifier(refus.statut === 403 && !refus.corps.ok && base.lectures.length === 0 && envois.length === 0, 'compte « opérations » : 403, rien lu, rien envoyé', refus);
    const sansCles = await annoncerAEquipe(base, { role: 'gerant', id: 'aeq-1', cles: null, envoyer });
    verifier(sansCles.statut === 503 && sansCles.corps.code === 'inactif' && envois.length === 0, 'sans clés serveur : 503, rien envoyé');
    const absente = await annoncerAEquipe(base, { role: 'gerant', id: 'aeq-absente', cles, envoyer });
    verifier(absente.statut === 404 && envois.length === 0, 'annonce absente de la base : 404, rien envoyé');
    const retiree = await annoncerAEquipe(base, { role: 'gerant', id: 'aeq-retiree', cles, envoyer });
    verifier(retiree.statut === 409 && envois.length === 0, 'annonce retirée : 409, rien envoyé');

    const r1 = await annoncerAEquipe(base, { role: 'gerant', id: 'aeq-1', cles, envoyer });
    verifier(r1.statut === 200 && r1.corps.ok && r1.corps.envoyees === 1 && r1.corps.appareils === 2, 'gérant : envoyée', r1);
    verifier(envois.length === 2 && !envois.some((e) => e.endpoint.endsWith('sans-annonces')), 'aux appareils qui acceptent les annonces seulement', envois.map((e) => e.endpoint));
    verifier(envois.every((e) => e.titre === 'Bonjour 👋' && e.corps === 'Texte enregistré dans la base.' && e.url === '/erp' && e.type === 'annonce'), 'texte relu dans la base, ouvre l’Accueil', envois);
    const journal = (await base.lire<{ envoyees: { cle: string }[] }>('connecteurs', ['notifications-journal']))[0];
    verifier(journal?.envoyees.some((e) => e.cle === 'annonce-aeq-1'), 'clé annonce-aeq-1 au journal des envois');
    const r2 = await annoncerAEquipe(base, { role: 'gerant', id: 'aeq-1', cles, envoyer });
    verifier(r2.statut === 200 && r2.corps.dejaPartie === true && envois.length === 2, 'second appel : jamais deux fois', r2);

    const seule = new FausseBase();
    await seule.ecrire(COLLECTION_ANNONCES_EQUIPE, [annonce('aeq-2')]);
    const personne = await annoncerAEquipe(seule, { role: 'gerant', id: 'aeq-2', cles, envoyer });
    verifier(personne.statut === 200 && personne.corps.ok && personne.corps.envoyees === 0 && personne.corps.appareils === 0, 'aucun appareil : publiée, rien à envoyer', personne);
    verifier(issueDeLaReponse(personne.corps).genre === 'aucun-appareil' && issueDeLaReponse(r1.corps).genre === 'envoyee' && issueDeLaReponse(r2.corps).genre === 'deja-partie', 'réponse traduite pour l’écran');

    const enPanne = new FausseBase();
    await enregistrerAppareil(enPanne, { abonnement: abonnement('telephone') });
    await enPanne.ecrire(COLLECTION_ANNONCES_EQUIPE, [annonce('aeq-3')]);
    panne = true;
    const echec = await annoncerAEquipe(enPanne, { role: 'gerant', id: 'aeq-3', cles, envoyer });
    panne = false;
    verifier(echec.statut === 502 && !echec.corps.ok && !!echec.corps.erreur, 'service de notifications en panne : 502 et un message', echec);
  }

  section('8. Après « Publier » : l’annonce reste publiée, le message le dit');
  {
    const issues: IssueNotification[] = [
      { genre: 'sans' },
      { genre: 'demo' },
      { genre: 'non-enregistree' },
      { genre: 'envoyee' },
      { genre: 'deja-partie' },
      { genre: 'aucun-appareil' },
      { genre: 'echec', raison: 'Notifications pas encore activées sur le serveur.' },
      { genre: 'echec' },
    ];
    const messages = issues.map(messagePublication);
    verifier(messages.every((m) => m.texte.startsWith('Annonce publiée')), 'toujours « Annonce publiée »', messages);
    verifier(messages[1].texte.includes('Démonstration') && messages[1].texte.includes('partirait'), 'démonstration : la notification partirait');
    verifier(messages[6].ton === 'alerte' && messages[6].texte.includes('n’est pas partie') && messages[6].texte.endsWith('serveur.'), 'échec : clair, avec la raison');
    verifier(messages[7].texte.endsWith('n’est pas partie.') && messages[2].ton === 'alerte', 'échec sans raison, ou pas encore enregistrée : alerte');
    verifier(messages[0].texte === 'Annonce publiée.', 'sans notification : « Annonce publiée. »', messages[0]);
    const connue = issueDeLErreur('inactif', 'Notifications pas encore activées sur le serveur.');
    verifier(connue.genre === 'echec' && !connue.reessayable && messagePublication(connue).texte.endsWith('activées sur le serveur.'), 'refus connu : message du serveur relayé');
    for (const code of ['gerant', 'introuvable', 'retiree', 'envoi']) {
      const r = issueDeLErreur(code, `Message ${code}.`);
      verifier(r.genre === 'echec' && messagePublication(r).texte.endsWith(`Message ${code}.`), `code ${code} : message relayé`);
    }
    const inconnue = issueDeLErreur(undefined, 'Base de l’ERP : erreur 500 {"code":"XX"}');
    const autre = issueDeLErreur('autre', 'TypeError: Failed to fetch');
    verifier(
      inconnue.genre === 'echec' &&
        inconnue.reessayable === true &&
        !messagePublication(inconnue).texte.includes('500') &&
        messagePublication(inconnue).texte.endsWith('Réessayez dans un instant.') &&
        !messagePublication(autre).texte.includes('TypeError'),
      'erreur inattendue : jamais le message technique, « Réessayez dans un instant. »',
      messagePublication(inconnue),
    );
    const vide = issueDeLErreur('inactif', '  ');
    verifier(vide.genre === 'echec' && vide.reessayable === true, 'refus connu sans message : phrase simple');

    const ecran = source('src/erp/modules/parametres/AnnoncesEquipe.tsx');
    const corpsAnnoncer = /const annoncer = async[\s\S]*?\n {2}\};/.exec(ecran)?.[0] ?? '';
    const iDemo = corpsAnnoncer.indexOf("if (d.demo) return { genre: 'demo' }");
    const iEnregistrer = corpsAnnoncer.indexOf('await d.enregistrerMaintenant()');
    const iAppel = corpsAnnoncer.indexOf("{ action: 'annoncer', id }");
    verifier(iDemo > 0 && iEnregistrer > iDemo && iAppel > iEnregistrer, 'démonstration : aucun appel ; sinon enregistrée d’abord, puis l’action « annoncer »', { iDemo, iEnregistrer, iAppel });
    const corpsPublier = /const publier = async[\s\S]*?\n {2}\};/.exec(ecran)?.[0] ?? '';
    const iPose = corpsPublier.indexOf("d.upsert('annoncesEquipe', r.annonce)");
    verifier(iPose > 0 && corpsPublier.indexOf('await annoncer(r.annonce.id)') > iPose, '« Publier » : l’annonce est posée avant la notification');
    verifier(!/action: 'annoncer'[^}]*(titre|texte)/.test(ecran), 'le navigateur n’envoie que l’identifiant');
    verifier(/issueDeLErreur\(err\.code, err\.message\)/.test(ecran), 'erreurs du serveur filtrées (codes connus seulement)');
    verifier(
      /const notificationsPossibles = d\.demo \|\| n\.serveurActif/.test(ecran) && /\{notificationsPossibles && \(/.test(ecran) && /notifier && notificationsPossibles \?/.test(ecran),
      'case « Prévenir aussi par notification » seulement si les notifications marchent sur le serveur',
    );
  }

  section('8 bis. Mots des écrans : jamais confondus avec l’annonce d’un logement');
  {
    const ecran = source('src/erp/modules/parametres/AnnoncesEquipe.tsx');
    for (const attendu of ['titre="Nouvelle annonce à l’équipe"', 'titre="Sur l’Accueil de l’équipe"', 'titre="Retirer de l’Accueil ?"', 'Retirer de l’Accueil\n']) {
      verifier(ecran.includes(attendu), `écran du gérant : ${attendu.trim()}`);
    }
    verifier(!/titre="(Publiées|Nouvelle annonce|Retirer cette annonce \?)"/.test(ecran), 'ni « Publiées », ni « Nouvelle annonce » seul, ni « Retirer cette annonce ? »');
    const accueil = source('src/erp/modules/tableau-de-bord/_composants/AnnoncesEquipe.tsx');
    verifier(/<Card role="region" aria-labelledby=\{titreId\}/.test(accueil) && /line-clamp-4/.test(accueil) && /Lire la suite/.test(accueil), 'Accueil : une seule carte (région), texte sur 4 lignes, « Lire la suite »');
    verifier(accueil.includes('aria-label={`J’ai lu : ${a.titre}`}'), '« J’ai lu » nommé pour chaque annonce');
    const ordre = "publieePar ? `${a.publieePar} · ` : ''";
    verifier(accueil.includes(ordre) && ecran.includes(ordre), 'même ordre partout : auteur · date');
    const parametres = source('src/erp/modules/parametres/index.tsx');
    const iApplication = parametres.indexOf("cle: 'application'");
    verifier(iApplication > 0 && parametres.indexOf("cle: 'annonces-equipe'") > iApplication, 'onglet après « Application »');
    const type = TYPES_NOTIFICATION.find((t) => t.type === 'annonce');
    verifier(type?.detail === 'Les messages du gérant à toute l’équipe.', 'réglage : « Les messages du gérant à toute l’équipe. »', type);
  }

  section('8 ter. Recherche : l’historique d’une annonce à l’équipe');
  {
    const d = creerSeed();
    d.journal = [
      { id: 'jrn-a', horodatage: '2026-09-24T09:00:00+02:00', auteur: 'Abdel', action: 'Création', entite: 'annoncesEquipe', entiteId: 'aeq-bonjour', details: '' },
      { id: 'jrn-l', horodatage: '2026-09-24T09:00:00+02:00', auteur: 'Abdel', action: 'Création', entite: 'logements', entiteId: 'log-1', details: '' },
      ...d.journal,
    ];
    const idx = construireIndex(d);
    const a = idx.find((e) => e.type === 'journal' && e.id === 'jrn-a');
    const l = idx.find((e) => e.type === 'journal' && e.id === 'jrn-l');
    verifier(a?.titre === 'Annonce à l’équipe : création' && a.to === '/erp/parametres/annonces-equipe', 'ligne d’historique : nommée, mène à l’écran des annonces à l’équipe', a);
    verifier(l?.titre === 'Création' && l.to === '/erp/logements/log-1', 'les autres lignes ne changent pas', l);
  }

  section('9. Route du serveur, plateformes, fonctions Vercel');
  {
    const route = source('api/erp-notifications.ts');
    const iRefus = route.indexOf("action === 'annoncer' && !peutAnnoncer(membre.role)");
    const iCles = route.indexOf("if (!cles) return repondre(res, 503");
    verifier(iRefus > 0 && iCles > iRefus, 'non-gérant refusé avant toute lecture', { iRefus, iCles });
    verifier(/annoncerAEquipe\(base, \{ role: membre\.role, id: corps\.id, cles \}\)/.test(route), 'seul l’identifiant vient du navigateur ; base de l’espace de l’en-tête');
    verifier(/const base = baseErp\(c, membre\.espace\)/.test(route), 'base de l’espace vérifié pour ce membre');
    const fonctions = racine ? fs.readdirSync(chemins.join(racine, 'api')).filter((f) => /\.ts$/.test(f) && !f.startsWith('_')) : [];
    verifier(fonctions.length > 0 && !fonctions.some((f) => /annonce/i.test(f)), 'aucune nouvelle fonction Vercel', fonctions);
    for (const f of ['src/erp/data/annonces-equipe.ts', 'src/erp/data/notifications-envoi.ts']) {
      const s = source(f);
      const relatifs = [...s.matchAll(/^import (?!type )[^;]*?from '(\.[^']+)'/gm)].map((m) => m[1]);
      verifier(relatifs.length > 0 && relatifs.every((i) => i.endsWith('.js')), `${f} : imports relatifs en .js (serveur)`, relatifs);
    }
    const module = source('src/erp/data/annonces-equipe.ts');
    verifier(!/repull|agent-ia|fetch\(/i.test(module.replace(/^\s*\*.*$/gm, '')), 'module des annonces : ni plateformes ni réseau');
    verifier(
      !ecritureRepullPermise('PUT', '/v1/availability/123', { price: 90 }) && !ecritureRepullPermise('PATCH', '/v1/listings/123', { title: 'Bonjour' }) && !ecritureRepullPermise('POST', '/v1/listings/123', {}),
      'le verrou des écritures refuse toujours prix, calendrier et annonce des plateformes',
    );
    const parametres = source('src/erp/modules/parametres/index.tsx');
    verifier(/gerant \? \[\{ cle: 'annonces-equipe', libelle: 'Annonces à l’équipe'/.test(parametres) && /path="annonces-equipe" element=\{gerant \?/.test(parametres), 'écran dans Paramètres, réservé au gérant, nommé « Annonces à l’équipe »');
  }

  console.log(`\n${reussis} contrôles réussis, ${echecs} en échec.`);
  (globalThis as { process?: { exitCode?: number } }).process!.exitCode = echecs ? 1 : 0;
}

void principal();
