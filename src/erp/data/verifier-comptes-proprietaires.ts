/**
 * Vérification des comptes des propriétaires (pur, sans réseau) : lien
 * « Créer mon compte », code gardé sur l'appareil, mot de passe, activation
 * (bon e-mail, mauvais e-mail, compte non confirmé, code expiré, code
 * réutilisé, accès retiré), entrée par uid (un autre compte à la même adresse
 * n'obtient rien, accès retiré ou réinvité), sessions liées à l'uid et à la
 * version, retrait et réinvitation, état montré au gérant, et la vue du
 * propriétaire qui ne change pas.
 *
 * Lancement :
 *   node_modules/.bin/esbuild src/erp/data/verifier-comptes-proprietaires.ts --bundle --platform=node --format=esm \
 *     --define:import.meta.env='{"VITE_ERP_DEMO":"1"}' --log-level=error --outfile=/tmp/verifier-comptes-proprietaires.mjs \
 *     && node /tmp/verifier-comptes-proprietaires.mjs
 */
import {
  CLES_INVITATION_ACCES,
  DUREE_INVITATION_ACCES_MS,
  MESSAGES_ENTREE,
  MESSAGE_INVITATION_PERIMEE,
  MOT_DE_PASSE_MIN,
  accesDuCompte,
  activerAccesAvecCompte,
  codeAccesPour,
  forceMotDePasse,
  invitationAccesAGarder,
  lienCreationAcces,
  lireInvitationAccesGardee,
  lireLienCreation,
  lireRetourLienExterne,
  lireSessionExterne,
  motDePasseRefuse,
  sessionExterneValide,
  signerSessionExterne,
  urlRetourAcces,
} from './acces-externe';
import { statutCompteProprietaire } from './acces-gerant';
import { ID_LABEL_MAISON } from './espaces';
import { vueProprietaire } from './proprietaire';
import { avecNouveauLien, empreinteJeton, inviter, lireSession, nouveauJeton, retirer, sessionEncoreValide, signerSession } from './proprietaire-acces';
import { creerSeed } from './seed';
import type { AccesProprietaire } from './types-proprietaire';
import { b64url, deB64url } from './web-push';

let ok = 0;
let ko = 0;

/**
 * Chaînes (', ", `) et textes JSX d'un fichier source, sans le code des ${…}
 * ni les commentaires : ce qui peut s'afficher ou s'envoyer.
 */
export function textesDuSource(source: string): string[] {
  const textes: string[] = [];
  const ajouter = (t: string) => {
    if (/[A-Za-zÀ-ÿ]/.test(t)) textes.push(t);
  };
  type Mode = 'code' | 'str1' | 'str2' | 'tpl' | 'ligne' | 'bloc';
  let mode: Mode = 'code';
  // Profondeur d'accolades de chaque ${…} ouvert (gabarits imbriqués).
  const expressions: number[] = [];
  let tampon = '';
  let jsx: string | null = null;
  let i = 0;
  while (i < source.length) {
    const c = source[i];
    const d = source[i + 1];
    if (mode === 'ligne') {
      if (c === '\n') mode = 'code';
      i++;
      continue;
    }
    if (mode === 'bloc') {
      if (c === '*' && d === '/') {
        mode = 'code';
        i += 2;
      } else i++;
      continue;
    }
    if (mode === 'str1' || mode === 'str2') {
      const fin = mode === 'str1' ? "'" : '"';
      if (c === '\\') {
        tampon += d ?? '';
        i += 2;
        continue;
      }
      if (c === fin || c === '\n') {
        ajouter(tampon);
        tampon = '';
        mode = 'code';
        i++;
        continue;
      }
      tampon += c;
      i++;
      continue;
    }
    if (mode === 'tpl') {
      if (c === '\\') {
        tampon += d ?? '';
        i += 2;
        continue;
      }
      if (c === '`') {
        ajouter(tampon);
        tampon = '';
        mode = 'code';
        i++;
        continue;
      }
      if (c === '$' && d === '{') {
        ajouter(tampon);
        tampon = '';
        expressions.push(0);
        mode = 'code';
        i += 2;
        continue;
      }
      tampon += c;
      i++;
      continue;
    }
    // Code.
    if (c === '/' && d === '/') {
      mode = 'ligne';
      i += 2;
      continue;
    }
    if (c === '/' && d === '*') {
      mode = 'bloc';
      i += 2;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      mode = c === "'" ? 'str1' : c === '"' ? 'str2' : 'tpl';
      jsx = null;
      i++;
      continue;
    }
    if (expressions.length) {
      if (c === '{') expressions[expressions.length - 1]++;
      else if (c === '}') {
        if (expressions[expressions.length - 1] === 0) {
          expressions.pop();
          mode = 'tpl';
          i++;
          continue;
        }
        expressions[expressions.length - 1]--;
      }
    }
    // Texte JSX : entre « > » et « < », sans expression ni code.
    if (jsx !== null) {
      if (c === '<') {
        if (!/[;()=]/.test(jsx)) ajouter(jsx);
        jsx = null;
      } else if (c === '{') jsx = null;
      else jsx += c;
    }
    if (c === '>') jsx = '';
    i++;
  }
  return textes;
}

/** Textes où « ? » ou « : » suit un espace simple au lieu d'un espace insécable (typographie française) ; un morceau de gabarit qui commence par « : » compte aussi. */
export const textesAvecEspaceSimple = (source: string): string[] => textesDuSource(source).filter((t) => /(^|\S) [?:]/.test(t));

function verifier(condition: boolean, libelle: string) {
  if (condition) ok++;
  else {
    ko++;
    console.log(`  ✗ ${libelle}`);
  }
}

const LM = ID_LABEL_MAISON;
const SENS = '5e5e0000-0000-4000-8000-000000000002';
const U_ALICE = 'a11ce000-0000-4000-8000-000000000001';
const U_AUTRE = 'a11ce000-0000-4000-8000-000000000002';
const A = 'pro-a';
const t0 = Date.parse('2026-11-02T10:00:00Z');
const s0 = Math.floor(t0 / 1000);
const alice = { uid: U_ALICE, email: 'alice@exemple.fr', confirme: true };

async function main() {
  /* lien « Créer mon compte » */
  const code = await nouveauJeton();
  const lien = lienCreationAcces('https://www.labelmaisoncg.fr/', '/espace-proprietaire', ' Alice@Exemple.FR ', code, SENS);
  verifier(lien === `https://www.labelmaisoncg.fr/espace-proprietaire#creer=alice%40exemple.fr&code=${code}&espace=${SENS}`, 'lien : adresse normalisée, code et espace après #');
  const lu = lireLienCreation(lien.split('#')[1]);
  verifier(lu?.email === 'alice@exemple.fr' && lu.code === code && lu.espace === SENS, 'lien lu : adresse, code, espace');
  verifier(lireLienCreation(`#creer=alice%40exemple.fr&code=${code}`)?.espace === LM && lireLienCreation('#creer=alice%40exemple.fr&code=trop-court')?.code === undefined, 'lien sans espace : Label Maison ; code mal formé : ignoré');
  verifier(lireLienCreation('#creer=pas-une-adresse&code=' + code)?.email === '' && lireLienCreation('#espace=x&jeton=y') === undefined, 'adresse illisible : vide ; un lien d’un autre genre : pas une création');
  verifier(lireRetourLienExterne(lien.split('#')[1]).nature === 'creer' && lireRetourLienExterne('').nature === 'rien' && lireRetourLienExterne('#onglet=bilans').nature === 'rien', 'retour de lien : création, rien');
  verifier(lireRetourLienExterne('#access_token=x&refresh_token=y&type=recovery').nature === 'recuperation' && lireRetourLienExterne('#access_token=x&refresh_token=y&type=signup').nature === 'confirmation', 'retour de lien : mot de passe oublié, confirmation');
  const expire = lireRetourLienExterne('#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired');
  verifier(expire.nature === 'erreur' && /expiré/.test(expire.message), 'retour de lien : lien de Supabase expiré');
  verifier(urlRetourAcces('proprietaire') === 'https://www.labelmaisoncg.fr/espace-proprietaire', 'retour des e-mails de Supabase : la page de l’espace, site fixe');

  /* code gardé sur l'appareil */
  const gardee = invitationAccesAGarder({ email: 'Alice@Exemple.fr', code, espace: SENS }, t0);
  verifier(gardee.expire === t0 + DUREE_INVITATION_ACCES_MS && gardee.email === 'alice@exemple.fr', 'code gardé 7 jours, adresse normalisée');
  const relue = lireInvitationAccesGardee(JSON.stringify(gardee), t0 + 1000);
  verifier(relue?.code === code && relue.espace === SENS, 'code relu sur l’appareil');
  verifier(lireInvitationAccesGardee(JSON.stringify(gardee), t0 + DUREE_INVITATION_ACCES_MS + 1) === null && lireInvitationAccesGardee('{pas du json', t0) === null && lireInvitationAccesGardee(null, t0) === null, 'code échu ou illisible : rien');
  verifier(codeAccesPour(relue, 'ALICE@exemple.fr')?.code === code && codeAccesPour(relue, 'autre@exemple.fr') === undefined && codeAccesPour(null, 'alice@exemple.fr') === undefined, 'code présenté pour la même adresse seulement');
  verifier(CLES_INVITATION_ACCES.proprietaire !== CLES_INVITATION_ACCES.operations && !CLES_INVITATION_ACCES.proprietaire.includes('erp'), 'rangement propre à chaque genre, distinct de celui de l’équipe');

  /* mot de passe */
  verifier(MOT_DE_PASSE_MIN === 12 && forceMotDePasse('court').niveau === 0 && forceMotDePasse('a'.repeat(12)).niveau === 1 && forceMotDePasse('abcabcabcabc').niveau === 1, 'mot de passe : trop court, répété : faible');
  verifier(forceMotDePasse('motdepasse12').niveau === 2 && forceMotDePasse('Un mot de passe long 2026!').niveau === 3, 'mot de passe : correct, solide');
  verifier(!!motDePasseRefuse('court', 'court') && !!motDePasseRefuse('a'.repeat(12), 'a'.repeat(12)) && !!motDePasseRefuse('motdepasse12', 'motdepasse13') && motDePasseRefuse('motdepasse12', 'motdepasse12') === undefined, 'mot de passe refusé : court, trop simple, confirmation différente ; accepté sinon');

  /* activation avec le compte */
  const invite = avecNouveauLien(inviter(undefined, { proprietaireId: A, email: 'alice@exemple.fr', par: 'g', maintenantMs: t0, espace: LM }), await empreinteJeton(code), 'invitation', t0);
  verifier(invite.statut === 'invite' && !invite.compteActif && !invite.uid, 'invitation : accès en attente du compte');
  const r = await activerAccesAvecCompte([invite], code, alice, t0 + 60_000);
  verifier(r.ok && r.acces.statut === 'actif' && r.acces.uid === U_ALICE && r.acces.compteActif === true && !!r.acces.activeLe && r.acces.liens.length === 0, 'bon compte confirmé : accès actif, relié à l’uid, code effacé');
  const actif = r.ok ? r.acces : invite;
  const autreAdresse = await activerAccesAvecCompte([invite], code, { ...alice, email: 'bob@exemple.fr' }, t0 + 60_000);
  verifier(!autreAdresse.ok && autreAdresse.raison === 'autre_adresse', 'compte d’une autre adresse : refusé');
  const nonConfirme = await activerAccesAvecCompte([invite], code, { ...alice, confirme: false }, t0 + 60_000);
  verifier(!nonConfirme.ok && nonConfirme.raison === 'non_confirme', 'adresse pas confirmée : refusé');
  const perime = await activerAccesAvecCompte([invite], code, alice, t0 + DUREE_INVITATION_ACCES_MS + 1);
  verifier(!perime.ok && perime.raison === 'expire', 'code de plus de 7 jours : refusé');
  const reutilise = await activerAccesAvecCompte([actif], code, { ...alice, uid: U_AUTRE }, t0 + 120_000);
  verifier(!reutilise.ok && reutilise.raison === 'inconnu', 'code déjà servi (effacé) : refusé, même pour un autre compte');
  const marque = { ...invite, liens: invite.liens.map((l) => ({ ...l, utiliseLe: '2026-11-02T10:00:30Z' })) };
  verifier(!(await activerAccesAvecCompte([marque], code, alice, t0 + 60_000)).ok, 'code marqué utilisé : refusé');
  const retire = retirer(invite, t0 + 1000);
  const surRetire = await activerAccesAvecCompte([{ ...retire, liens: invite.liens }], code, alice, t0 + 60_000);
  verifier(!surRetire.ok && surRetire.raison === 'retire', 'accès retiré : code refusé');
  verifier(!(await activerAccesAvecCompte([invite], 'x'.repeat(43), alice, t0)).ok && !(await activerAccesAvecCompte([invite], code, { ...alice, uid: 'pas-un-uuid' }, t0)).ok, 'code inconnu ou uid illisible : refusé');
  const j2 = await nouveauJeton();
  const connexion = avecNouveauLien(invite, await empreinteJeton(j2), 'connexion', t0);
  verifier(!(await activerAccesAvecCompte([connexion], j2, alice, t0 + 1000)).ok, 'un lien de connexion (ancienne mécanique) n’active jamais un compte');

  /* entrée par uid */
  verifier(accesDuCompte([actif], U_ALICE).ok && accesDuCompte([actif], U_ALICE).ok && (accesDuCompte([actif], U_ALICE) as { acces: AccesProprietaire }).acces.id === A, 'entrée : l’accès relié à l’uid');
  const autreCompte = accesDuCompte([actif], U_AUTRE);
  verifier(!autreCompte.ok && autreCompte.raison === 'inconnu', 'autre compte, même adresse : rien');
  verifier(!accesDuCompte([actif], 'pas-un-uuid').ok && !accesDuCompte([], U_ALICE).ok, 'uid illisible ou aucun accès : rien');
  const retireRelie = retirer(actif, t0 + 2000);
  const apresRetrait = accesDuCompte([retireRelie], U_ALICE);
  verifier(!apresRetrait.ok && apresRetrait.raison === 'retire' && retireRelie.uid === U_ALICE && retireRelie.compteActif === false, 'accès retiré : l’uid reste pour mémoire, mais n’ouvre plus rien');
  const reinvite = inviter(retireRelie, { proprietaireId: A, email: 'alice@exemple.fr', par: 'g', maintenantMs: t0 + 3000 });
  const enAttente = accesDuCompte([reinvite], U_ALICE);
  verifier(!enAttente.ok && enAttente.raison === 'invite' && reinvite.uid === U_ALICE && !reinvite.compteActif && reinvite.statut === 'invite', 'réinvité à la même adresse : l’ancien compte attend le nouveau code');
  const actifSens = { ...actif, espace: SENS };
  const prefere = accesDuCompte([actif, actifSens], U_ALICE, SENS);
  const sansPreference = accesDuCompte([actif, actifSens], U_ALICE);
  verifier(prefere.ok && prefere.acces.espace === SENS && sansPreference.ok && sansPreference.acces.espace === LM, 'plusieurs espaces : l’espace retenu sur l’appareil, sinon le premier');
  verifier(MESSAGES_ENTREE.inconnu !== MESSAGES_ENTREE.invite && MESSAGES_ENTREE.retire === 'Votre accès a été retiré. Contactez votre conciergerie.' && /plus valable/.test(MESSAGE_INVITATION_PERIMEE), 'phrases : refus distincts pour la personne, une seule pour un code refusé');

  /* sessions liées à l'uid et à la version */
  const secret = 'secret-de-test-'.padEnd(40, 'x');
  const cookie = await signerSession(secret, { p: A, v: actif.version, exp: s0 + 3600, e: LM, u: U_ALICE });
  const session = await lireSession(secret, cookie, s0);
  verifier(session?.u === U_ALICE && sessionEncoreValide(session, actif), 'session par compte : lue avec l’uid, valable pour l’accès relié');
  verifier(!!session && !sessionEncoreValide(session, { ...actif, uid: U_AUTRE }), 'accès relié à un autre compte depuis : session fermée');
  verifier(!!session && !sessionEncoreValide(session, retireRelie) && !sessionEncoreValide(session, reinvite), 'accès retiré ou réinvité : session fermée');
  const nouvelleAdresse = inviter(actif, { proprietaireId: A, email: 'nouvelle@exemple.fr', par: 'g', maintenantMs: t0 });
  verifier(nouvelleAdresse.version === actif.version + 1 && !nouvelleAdresse.uid && !!session && !sessionEncoreValide(session, nouvelleAdresse), 'autre adresse : compte oublié, version augmentée, session fermée');
  const sansUid = await signerSession(secret, { p: A, v: actif.version, exp: s0 + 3600, e: LM });
  const ancienne = await lireSession(secret, sansUid, s0);
  verifier(!!ancienne && !ancienne.u && !sessionEncoreValide(ancienne, actif), 'ancienne session par lien : fermée dès que le compte est relié');
  verifier(!!ancienne && sessionEncoreValide(ancienne, { ...invite, statut: 'actif' }), 'ancienne session par lien : encore valable pour un accès pas encore relié');
  const [corps, sig] = cookie.split('.');
  const charge = JSON.parse(new TextDecoder().decode(deB64url(corps))) as Record<string, unknown>;
  const falsifie = `${b64url(new TextEncoder().encode(JSON.stringify({ ...charge, u: U_AUTRE })))}.${sig}`;
  verifier((await lireSession(secret, falsifie, s0)) === null, 'cookie dont on change l’uid : refusé');
  const uidIllisible = await signerSessionExterne(secret, { k: 'proprietaire', p: A, e: LM, v: 1, exp: s0 + 3600, u: 'pas-un-uuid' });
  verifier((await lireSessionExterne(secret, uidIllisible, 'proprietaire', s0))?.u === undefined, 'uid illisible : jamais signé');
  const ops = { id: 'eq-1', email: 'ops@exemple.fr', statut: 'actif' as const, version: 1, liens: [], espace: LM };
  verifier(sessionExterneValide({ k: 'operations', p: 'eq-1', e: LM, v: 1, exp: s0 + 3600 }, ops), 'opérations (par lien) : rien ne change');

  /* état montré au gérant */
  verifier(statutCompteProprietaire(undefined, 'a@x.fr').texte === 'Pas encore invité', 'gérant : pas encore invité');
  const sInvite = statutCompteProprietaire(invite, 'alice@exemple.fr');
  verifier(/^Invitation envoyée le .+, pas encore de compte$/.test(sInvite.texte) && sInvite.ton === 'alerte', 'gérant : « Invitation envoyée le …, pas encore de compte »');
  const sActif = statutCompteProprietaire(actif, 'alice@exemple.fr');
  verifier(/^Compte créé le /.test(sActif.texte) && sActif.ton === 'succes', 'gérant : « Compte créé le … »');
  verifier(statutCompteProprietaire({ ...invite, statut: 'actif' }, 'alice@exemple.fr').texte === 'Pas encore de compte : renvoyez l’invitation', 'gérant : accès d’avant les comptes, « renvoyez l’invitation »');
  verifier(/^Accès retiré le /.test(statutCompteProprietaire(retireRelie, 'alice@exemple.fr').texte), 'gérant : « Accès retiré le … »');
  verifier(statutCompteProprietaire(actif, 'autre@exemple.fr').texte === 'Adresse changée : réinvitez', 'gérant : adresse changée dans la fiche');

  /* la vue du propriétaire ne change pas */
  const seed = creerSeed();
  const acces = seed.accesProprietaires.find((a) => a.id === 'pro-sci-tilleuls');
  verifier(!!acces?.uid && acces.compteActif === true && !!acces.activeLe, 'démo : la SCI Les Tilleuls a son compte');
  const vue = vueProprietaire(seed, 'pro-sci-tilleuls', { aujourdhui: '2026-09-24' })!;
  const cles = Object.keys(vue).sort().join();
  const attendues = ['aujourdhui', 'bilans', 'calendrier', 'conciergerie', 'contacts', 'documents', 'factures', 'fiches', 'logements', 'logementsCedes', 'moisCourant', 'moisPrecedent', 'prochainesArrivees', 'proprietaire'];
  verifier(Object.keys(vue).every((k) => attendues.includes(k)), `vue : aucune clé nouvelle (${cles})`);
  const texte = JSON.stringify(vue);
  verifier(!/uid|compteActif|activeLe|empreinte|"liens"|d3a0c0de/.test(texte), 'vue : rien du compte ni de l’accès (uid, code, liens)');

  /* typographie : espace insécable avant « ? » et « : » dans les textes des fichiers des comptes */
  verifier(textesAvecEspaceSimple("const a = 'Bonjour : oui'; const b = x ? y : z; <p>Rien reçu ? Non</p>").length === 2, 'typographie : les chaînes et les textes JSX sont lus, pas le code');
  verifier(textesAvecEspaceSimple("const a = 'Bonjour\u00a0: oui'; // pas : ici\n/* ni : là */ const b = `x ${c ? 'd' : `e ${f}`} : y`").length === 1, 'typographie : commentaires ignorés, gabarits imbriqués lus');
  {
    const fs = (await import('node:fs' as string)) as { readFileSync: (chemin: string, encodage: string) => string; existsSync: (chemin: string) => boolean };
    const racine = `${(globalThis as { process?: { cwd: () => string } }).process?.cwd() ?? '.'}/`;
    const fichiers = ['src/app/pages/EspaceProprietaire.tsx', 'src/erp/data/acces-externe.ts', 'src/erp/modules/logements/_composants/EspaceProprietaireGerant.tsx', 'api/_proprietaire.ts'];
    for (const f of fichiers) {
      if (!fs.existsSync(racine + f)) {
        verifier(false, `typographie : ${f} introuvable (lancer depuis la racine du dépôt)`);
        continue;
      }
      const fautes = textesAvecEspaceSimple(fs.readFileSync(racine + f, 'utf8'));
      verifier(fautes.length === 0, `typographie (${f}) : espace insécable avant « ? » et « : » ; à corriger : ${fautes.map((t) => JSON.stringify(t.trim().slice(0, 70))).join(' ; ')}`);
    }
  }

  console.log(`${ok} contrôles réussis, ${ko} en échec.`);
  (globalThis as { process?: { exitCode?: number } }).process!.exitCode = ko ? 1 : 0;
}

void main();
