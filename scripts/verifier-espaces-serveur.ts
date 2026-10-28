/**
 * Auto-contrôle des espaces côté serveur (api/_erp-repull.ts, api/_erp-espaces.ts
 * et les routes qui s'en servent) sans réseau : faux Supabase (comptes, mots de
 * passe, PostgREST avec la colonne espace et ses règles, fonctions erp.*,
 * coffre) et faux Repull, branchés sur le fetch global ; variables de Vercel
 * simulées.
 *
 * Vérifie : base pas encore préparée (tout comme avant, Label Maison seul),
 * compte serveur absent ou sans son rôle (compte d'équipe, Label Maison
 * seulement), compte serveur prêt (espace nommé par l'en-tête), réglages d'un
 * espace (workspace, clé propre, rien de Label Maison), passage quotidien sur
 * chaque espace, bouton d'un membre de Sens, webhooks (événements tagués de
 * Label Maison traités comme avant tant qu'aucun autre espace n'a de
 * workspace, workspace de Sens, workspace inconnu ignoré ensuite, adresse
 * propre à un espace avec son secret, espace inconnu = signature fausse),
 * base qui recule (retour en arrière du SQL) relue aussitôt, espace
 * propriétaire (accès créé, lu et revérifié dans l'espace qui invite, lien
 * sans espace = Label Maison, cookie dont on change l'espace refusé,
 * « Recevoir mon lien » cherché dans chaque espace), relances de paiement
 * (passage quotidien de chaque espace, « proposer » n'envoie jamais seul,
 * pas d'expéditeur = pas d'envoi, expéditeur de l'espace, jamais deux fois,
 * arrêt au paiement).
 * Espace opérations (mêmes règles que l’espace propriétaire, logements de
 * la personne seulement, un cookie propriétaire ne vaut pas pour les
 * opérations).
 * Audit des accès extérieurs (octobre 2026) : liens toujours sur le site
 * fixe (Origin forgée sans effet), origines acceptées, adresse de la fiche
 * qui fait foi, usage unique et relance unique sous accès simultanés
 * (écriture conditionnelle sur maj_le), un lien toutes les 2 minutes,
 * jamais l'expéditeur de Label Maison faute de fiche, ids encodés.
 * Fichiers par espace : chaque espace signe et dépose dans son dossier (compte
 * d'équipe pour Label Maison, compte serveur et en-tête sinon), jamais un
 * chemin d'un autre espace (documents, photos du logement et des opérations).
 * REPULL_WORKSPACE_LM (appels et webhook de Label Maison, workspace inconnu
 * ignoré). Espaces ouverts par invitation (api/erp-espaces.ts) : plateforme
 * réservée aux gérants de Label Maison avec leur session, invitation (e-mail
 * de Label Maison, lien « Créer mon compte » du site fixe avec un code à
 * usage unique dont seule l'empreinte va dans la base), suspension, clé
 * Repull propre essayée chez Repull (lecture seule) avant d'être rangée par
 * le gérant de l'espace, jamais relue ; messages d'une clé refusée ou d'une
 * part épuisée : jamais Vercel pour un autre espace que Label Maison.
 * Connecteur Claude (OAuth + MCP) et agenda du CRM par espace : base d'avant
 * les espaces exactement comme avant (Label Maison, compte d'équipe, jetons
 * sans préfixe, anciens jetons acceptés, un jeton d'un autre espace refusé) ;
 * ensuite, code et jetons rangés dans l'espace du gérant qui autorise, un
 * jeton de Sens ne lit jamais Label Maison et inversement, jetons modifiés
 * refusés sans rien lire, rotation et révocation par espace, non-membre et
 * non-gérant refusés, espace fermé refusé. Invitation « Créer mon compte » :
 * gérant de l'espace seulement, adresse membre de l'espace pas encore
 * activée, code à usage unique (empreinte seule dans la base), lien sur le
 * site fixe, e-mail au nom de l'espace ou lien à copier ; base d'avant les
 * espaces : pas d'invitation, message prévu.
 * App « Opérations » (notifications Web Push, faux téléphones qui
 * déchiffrent) : abonnement par la session et rangé dans l'espace de la
 * personne, urgence à la seule personne concernée (ni l'auteur ni Sens),
 * accès retiré ou adresse changée = plus rien, contrôle du jour une fois par
 * jour au passage quotidien (rien avant 7 h à Paris, même le réveil de
 * minuit l'été), réponse du gérant au « pas à moi », sans clés rien
 * d'envoyé ; « le gérant est prévenu » seulement avec un appareil de l'ERP
 * qui reçoit l'urgence (avant et après l'envoi).
 * Agenda du CRM : un autre espace ne choisit jamais Abdel ni Kamel.
 *
 * Fichier hors de l'ERP (api/ demande les types de Node) : pas dans tsc.
 * Lancement (Node 18+) :
 *   node_modules/.bin/esbuild scripts/verifier-espaces-serveur.ts --bundle --platform=node --format=esm \
 *     --define:import.meta.env='{}' --log-level=error --outfile=/tmp/verifier-espaces-serveur.mjs \
 *     && node /tmp/verifier-espaces-serveur.mjs
 */
import crypto from 'node:crypto';
import { ID_LABEL_MAISON, MESSAGE_BASE_PAS_PREPAREE } from '../src/erp/data/espaces';
import { BudgetEpuise, ClientRepull, ID_SELECTION, messageCleRefusee } from '../src/erp/data/repull-synchro';
import { messageErreur as messageConnexion } from '../src/erp/data/repull-connexion';
import { MESSAGE_INVITATION_HISTORIQUE } from '../api/erp-invitation';
import { MESSAGE_COMPTE_SERVEUR, baseErp, configuration, deposeurFichiersErp, etatBase, oublierEtatBase, signeurFichiersErp, stockageFerme, variableManquante } from '../api/_erp-repull';
import { BUDGET_ESPACE_DEFAUT, PLAFOND_IA_DEFAUT, codeEspaceDuWebhook, configurationEspace, espaceDemande, espaceDuWorkspace, espacesActifs, workspaceDeLEvenement } from '../api/_erp-espaces';
import routeSynchro from '../api/erp-repull-sync';
import routeAgent from '../api/erp-agent';
import routeWebhook from '../api/erp-repull-webhook';
import routeAgenda from '../api/erp-agenda';
import routeAgendaIcs from '../api/crm-agenda/[cle]';
import routeConnecteur from '../api/erp-connecteur-claude';
import routeInvitation from '../api/erp-invitation';
import routeMcp from '../api/crm-mcp/index';
import routeMcpCle from '../api/crm-mcp/[cle]';
import routeToken from '../api/oauth-token';
import routeProprietaire from '../api/espace-proprietaire';
import routeOperations from '../api/espace-operations';
import routeEspaces from '../api/erp-espaces';
import { relancesDuJour } from '../api/_relances';
import { oublierJetonsGardes } from '../api/_oauth';
import { notificationsOpsDuJour } from '../api/_operations-notifications';
import { idAppareil } from '../src/erp/data/notifications-envoi';
import { heureParis } from '../src/erp/data/notifications-operations';
import { SITE_PAR_DEFAUT, adresseSite, baseAcces, contactsEspace, expediteurEspace } from '../api/_acces-externe';
import { origineAutorisee } from '../api/_garde-formulaire';
import { accesToujoursDeLaFiche, type AccesExterne } from '../src/erp/data/acces-externe';
import { ajouterJours } from '../src/erp/data/operations';
import { dateParisISO } from '../src/erp/data/proprietaire';
import { genererClesVapid } from '../src/erp/data/web-push';

/* ------------------------------------------------------------ assertions */

let echecs = 0;
let reussis = 0;
function verifier(condition: unknown, message: string, detail?: unknown) {
  if (condition) reussis++;
  else {
    echecs++;
    console.error(`  ✗ ${message}`, detail === undefined ? '' : JSON.stringify(detail).slice(0, 600));
  }
}
function section(titre: string) {
  console.log(`\n${titre}`);
}
const json = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status, headers: { 'Content-Type': 'application/json' } });

const LM = ID_LABEL_MAISON;
const SENS = '5e5e0000-0000-4000-8000-000000000002';
const VIDE = '7a7a0000-0000-4000-8000-000000000003';

/* ------------------------------------------------- faux Supabase + Repull */

interface Ligne {
  espace: string;
  collection: string;
  id: string;
  donnees: unknown;
  /** Version (colonne maj_le, changée à chaque écriture ; avec « + » comme un timestamptz). */
  maj_le: string;
}

class Monde {
  historique = true;
  serveurPret = false;
  comptes: Record<string, { mdp: string; jeton: string }> = {
    'equipe@labelmaisoncg.fr': { mdp: 'mdp-equipe', jeton: 'jeton-equipe' },
    'serveur@labelmaisoncg.fr': { mdp: 'mdp-serveur', jeton: 'jeton-serveur' },
    'gerant-b@exemple.invalid': { mdp: 'x', jeton: 'jeton-sens' },
    'ops-sens@exemple.invalid': { mdp: 'x', jeton: 'jeton-ops-sens' },
  };
  membres = [
    { espace: LM, email: 'equipe@labelmaisoncg.fr', role: 'gerant' },
    { espace: SENS, email: 'gerant-b@exemple.invalid', role: 'gerant' },
    { espace: SENS, email: 'ops-sens@exemple.invalid', role: 'operations' },
    // Ajoutés par un gérant, sans compte encore (« Créer mon compte »).
    { espace: LM, email: 'Nouvelle_Recrue@exemple.invalid', role: 'operations' },
    { espace: SENS, email: 'recrue-sens@exemple.invalid', role: 'lecture' },
  ];
  espaces = [
    { id: LM, code: 'label-maison', nom: 'Label Maison', actif: true, repull_workspace: null as string | null, config: {} as Record<string, any> },
    { id: SENS, code: 'sens', nom: 'Sens', actif: true, repull_workspace: '1204' as string | null, config: {} as Record<string, any> },
    { id: VIDE, code: 'vide', nom: 'Vide', actif: true, repull_workspace: null as string | null, config: {} as Record<string, any> },
  ];
  /** Invitations à ouvrir un espace (erp.invitations_espace, imitées, avec l'empreinte du code). */
  invitations: { id: string; email: string; nom: string; expire_le: string; expiree: boolean; empreinte?: string }[] = [];
  /** Invitations des membres (erp.invitations : empreinte du code, espace, adresse). */
  invitationsMembres: { espace: string; email: string; empreinte: string }[] = [];
  /** Lignes de membres liées à leur compte (« espace:adresse »), comme après la passe 1. */
  lies = new Set<string>([`${LM}:equipe@labelmaisoncg.fr`, `${SENS}:gerant-b@exemple.invalid`, `${SENS}:ops-sens@exemple.invalid`]);
  /** Clés Repull refusées (401) ; Repull en panne (503). */
  clesRefusees = new Set<string>();
  repullEnPanne = false;
  /** Appels au stockage des fichiers (signature, dépôt) : compte, espace de l'en-tête, chemin. */
  stockage: { action: 'signer' | 'deposer'; bucket: string; nom: string; jeton: string; espace: string | null }[] = [];
  coffre = new Map<string, string>();
  lignes = new Map<string, Ligne>();
  base: { methode: string; chemin: string; url: URL; jeton: string; espace: string | null; corps: unknown }[] = [];
  repull: { methode: string; chemin: string; workspace: string | null; cle: string }[] = [];
  /** E-mails envoyés par Resend (relances, liens). */
  emails: { from: string; to: string[]; subject: string; text: string; replyTo?: unknown }[] = [];
  /** Notifications Web Push reçues par le service (contenu chiffré, en-têtes Urgency et VAPID). */
  pushs: { endpoint: string; corps: Uint8Array; urgence: string | null; vapid: string }[] = [];
  /** Panne passagère de erp.espaces_actifs (fiche d'espace illisible). */
  panneEspacesActifs = false;
  horloge = 0;

  emailDe = (jeton: string) => Object.entries(this.comptes).find(([, c]) => c.jeton === jeton)?.[0];
  poser(espace: string, collection: string, e: { id: string }) {
    this.horloge += 1;
    const maj_le = `2026-10-26T10:00:00.${String(this.horloge).padStart(6, '0')}+00:00`;
    this.lignes.set(`${espace}\u0000${collection}\u0000${e.id}`, { espace, collection, id: e.id, donnees: e, maj_le });
  }
  /** Lignes écrites (POST) dans un espace, toutes collections. */
  ecritures(espace: string) {
    return this.base.filter((r) => r.methode === 'POST' && r.chemin === 'enregistrements' && (r.corps as Ligne[]).every((l) => (l.espace ?? LM) === espace));
  }
  oublier() {
    this.base = [];
    this.repull = [];
    this.stockage = [];
  }
  actif = (espace: string) => !!this.espaces.find((e) => e.id === espace)?.actif;
  permis(jeton: string, entete: string | null): string[] {
    const email = this.emailDe(jeton);
    if (!email) return [];
    if (this.historique) return email === 'equipe@labelmaisoncg.fr' ? [LM] : [];
    if (email === 'serveur@labelmaisoncg.fr') return this.serveurPret && entete && this.actif(entete) ? [entete] : [];
    return this.membres.filter((m) => m.email === email && (!entete || m.espace === entete) && this.actif(m.espace)).map((m) => m.espace);
  }
  /** Gérant de cet espace (erp.acces_gerant) : membre gérant, ou compte serveur avec l'en-tête de l'espace. */
  gerant(jeton: string, entete: string | null, espace: string): boolean {
    const email = this.emailDe(jeton);
    if (!email || this.historique || !this.actif(espace)) return false;
    if (email === 'serveur@labelmaisoncg.fr') return this.serveurPret && entete === espace;
    return this.membres.some((m) => m.email === email && m.espace === espace && m.role === 'gerant' && (!entete || entete === espace));
  }

  fetch = async (entree: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(typeof entree === 'string' ? entree : entree instanceof URL ? entree.href : entree.url);
    const h = new Headers(init?.headers);
    const methode = (init?.method ?? 'GET').toUpperCase();
    const jeton = (h.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (url.hostname === 'api.resend.com') {
      const e = JSON.parse(String(init?.body)) as { from: string; to: string[]; subject: string; text: string; reply_to?: unknown };
      this.emails.push({ from: e.from, to: e.to, subject: e.subject, text: e.text, replyTo: e.reply_to });
      return json({ id: `email-${this.emails.length}` });
    }
    if (url.hostname === 'fcm.googleapis.com') {
      const corps = new Uint8Array(await new Response(init?.body as BodyInit).arrayBuffer());
      this.pushs.push({ endpoint: url.href, corps, urgence: h.get('urgency'), vapid: /k=([^,\s]+)/.exec(h.get('authorization') ?? '')?.[1] ?? '' });
      return new Response(null, { status: 201 });
    }
    if (url.hostname === 'api.repull.dev') {
      this.repull.push({ methode, chemin: url.pathname, workspace: h.get('x-workspace-id'), cle: jeton });
      if (this.repullEnPanne) return json({ error: { code: 'unavailable', message: 'Service unavailable' } }, 503);
      if (this.clesRefusees.has(jeton)) return json({ error: { code: 'unauthorized', message: 'Invalid API key' } }, 401);
      if (url.pathname === '/v1/health/auth') return json({ ok: true });
      return json({ data: [], pagination: { hasMore: false, nextCursor: null } });
    }
    if (url.pathname === '/auth/v1/token') {
      const { email, password } = JSON.parse(String(init?.body)) as { email: string; password: string };
      const c = this.comptes[email];
      return c && c.mdp === password ? json({ access_token: c.jeton, expires_in: 3600 }) : json({ error: 'invalid_grant' }, 400);
    }
    if (url.pathname === '/auth/v1/user') {
      const email = this.emailDe(jeton);
      return email ? json({ email }) : json({}, 401);
    }
    if (url.pathname.startsWith('/storage/v1/object/')) {
      // Règles du stockage (supabase/erp-espaces.sql) : l'espace d'un fichier est son premier dossier s'il nomme un espace, Label Maison sinon.
      const entete = h.get('x-erp-espace');
      const signer = url.pathname.startsWith('/storage/v1/object/sign/');
      const [bucket, ...dossiers] = decodeURIComponent(url.pathname.slice(signer ? '/storage/v1/object/sign/'.length : '/storage/v1/object/'.length)).split('/');
      const nom = dossiers.join('/');
      const espace = this.espaces.some((e) => e.id === (dossiers[0] ?? '').toLowerCase()) ? dossiers[0].toLowerCase() : LM;
      this.stockage.push({ action: signer ? 'signer' : 'deposer', bucket, nom, jeton, espace: entete });
      if (bucket !== 'erp-fichiers' || !this.permis(jeton, entete).includes(espace)) return json({ statusCode: '403', error: 'Unauthorized', message: 'new row violates row-level security policy' }, 400);
      return signer ? json({ signedURL: `/object/sign/${bucket}/${nom}?token=jeton-signe` }) : json({ Key: `${bucket}/${nom}` });
    }
    const chemin = url.pathname.replace(/^\/rest\/v1\//, '');
    const corps = init?.body ? JSON.parse(String(init.body)) : undefined;
    const entete = h.get('x-erp-espace');
    this.base.push({ methode, chemin, url, jeton, espace: entete, corps });
    const email = this.emailDe(jeton);
    if (!email) return json({ code: 'PGRST301' }, 401);
    if (chemin.startsWith('rpc/')) {
      if (this.historique) return json({ code: 'PGRST202', message: `Could not find the function erp.${chemin.slice(4)}` }, 404);
      const serveur = email === 'serveur@labelmaisoncg.fr' && this.serveurPret;
      // Règle SQL des actions de l'IA en place (une base d'avant les espaces n'a pas la fonction : 404 ci-dessus).
      if (chemin === 'rpc/actions_ia_protegees') return json(true);
      if (chemin === 'rpc/qui_suis_je') {
        const espaces = serveur ? [] : this.membres.filter((m) => m.email === email && this.actif(m.espace)).map((m) => ({ ...this.espaces.find((e) => e.id === m.espace)!, role: m.role }));
        return json({ email, serveur, espaces, invitations_espace: [] });
      }
      if (chemin === 'rpc/espaces_actifs' && this.panneEspacesActifs) return json({ message: 'panne passagère' }, 503);
      if (chemin === 'rpc/espaces_actifs') return json(serveur ? this.espaces.filter((e) => e.actif) : this.espaces.filter((e) => this.permis(jeton, null).includes(e.id)));
      // Espaces ouverts par invitation : mêmes refus que la base (42501), avec ses messages.
      const refus = (message: string) => json({ code: '42501', message }, 403);
      const a = (corps ?? {}) as Record<string, any>;
      const plateforme = !serveur && this.gerant(jeton, entete, LM);
      if (chemin === 'rpc/inviter_espace' || chemin === 'rpc/espaces_plateforme' || chemin === 'rpc/annuler_invitation_espace' || chemin === 'rpc/suspendre_espace') {
        if (!plateforme) return refus('Réservé aux gérants de Label Maison.');
        if (chemin === 'rpc/inviter_espace') {
          if (this.membres.some((x) => x.email.toLowerCase() === String(a.p_email).trim().toLowerCase())) {
            return json({ code: '22023', message: 'Cette adresse a déjà accès à un espace de l’ERP : invitez une adresse propre à cette conciergerie.' }, 400);
          }
          if (!/^[0-9a-f]{64}$/.test(String(a.p_empreinte ?? ''))) return json({ code: '22023', message: 'Code d’invitation illisible.' }, 400);
          const i = { id: crypto.randomUUID(), email: String(a.p_email).trim().toLowerCase(), nom: String(a.p_nom).trim(), expire_le: '2026-11-10T10:00:00+00:00', expiree: false, empreinte: String(a.p_empreinte) };
          this.invitations = [...this.invitations.filter((x) => x.email !== i.email), i];
          return json({ id: i.id, email: i.email, nom: i.nom, expire_le: i.expire_le });
        }
        if (chemin === 'rpc/espaces_plateforme') {
          return json({
            espaces: this.espaces.map((e) => ({ id: e.id, code: e.code, nom: e.nom, actif: e.actif, cree_le: '2026-10-01T10:00:00+00:00', contact: null, membres: this.membres.filter((m) => m.espace === e.id).length })),
            invitations: this.invitations,
          });
        }
        if (chemin === 'rpc/annuler_invitation_espace') {
          const avant = this.invitations.length;
          this.invitations = this.invitations.filter((x) => x.id !== a.p_id);
          return json(avant !== this.invitations.length);
        }
        if (a.p_espace === LM) return refus('L’espace de Label Maison ne se suspend pas.');
        const e = this.espaces.find((x) => x.id === a.p_espace);
        if (e) e.actif = a.p_actif === true;
        return json(!!e);
      }
      if (chemin === 'rpc/enregistrer_secret_espace' || chemin === 'rpc/regler_repull_espace' || chemin === 'rpc/reglages_repull_espace') {
        if (a.p_espace === LM) return refus('Label Maison garde ses clés dans Vercel.');
        if (!this.gerant(jeton, entete, a.p_espace)) return refus('Réservé aux gérants de cet espace.');
        const e = this.espaces.find((x) => x.id === a.p_espace)!;
        if (chemin === 'rpc/enregistrer_secret_espace') {
          this.coffre.set(`${a.p_espace}:${a.p_nom}`, a.p_valeur);
          return json(true);
        }
        if (chemin === 'rpc/regler_repull_espace') {
          const repull = { ...(e.config.repull ?? {}) };
          if (a.p_workspace) repull.workspace = a.p_workspace;
          else delete repull.workspace;
          e.config = { ...e.config, repull };
          return json(true);
        }
        return json({ code: e.code, workspace: e.config.repull?.workspace ?? null, cle: this.coffre.has(`${e.id}:repull_cle`), webhook: this.coffre.has(`${e.id}:repull_webhook`) });
      }
      if (chemin === 'rpc/inviter_membre') {
        // erp.inviter_membre : gérant de l'espace (pas le serveur), ligne de l'équipe, pas encore liée.
        if (serveur || !this.gerant(jeton, entete, a.p_espace)) return refus('Réservé aux gérants de cet espace.');
        if (!/^[0-9a-f]{64}$/.test(String(a.p_empreinte ?? ''))) return json({ code: '22023', message: 'Code d’invitation illisible.' }, 400);
        const e = String(a.p_email ?? '').trim().toLowerCase();
        const ligne = this.membres.find((m) => m.espace === a.p_espace && m.email.toLowerCase() === e);
        if (!ligne) return json({ code: '22023', message: 'Ajoutez d’abord cette adresse à l’équipe, puis envoyez l’invitation.' }, 400);
        if (this.lies.has(`${a.p_espace}:${e}`)) return json({ deja: true });
        this.invitationsMembres = [...this.invitationsMembres.filter((x) => !(x.espace === a.p_espace && x.email === e)), { espace: a.p_espace, email: e, empreinte: a.p_empreinte }];
        return json({ deja: false, expire_le: '2026-11-10T10:00:00+00:00' });
      }
      if (chemin === 'rpc/secret_espace') {
        const { p_espace, p_nom } = corps as { p_espace: string; p_nom: string };
        return json(serveur && p_espace !== LM && entete === p_espace ? (this.coffre.get(`${p_espace}:${p_nom}`) ?? null) : null);
      }
      return json({ code: 'PGRST202' }, 404);
    }
    if (chemin === 'membres') {
      // erp.membres : base d'avant les espaces, ceux de Label Maison (sans colonne espace) ;
      // ensuite, ceux des espaces du compte (en-tête compris). Filtres email (eq / ilike) et espace.
      const p = url.searchParams;
      if (this.historique && p.has('espace')) return json({ code: '42703', message: 'column membres.espace does not exist' }, 400);
      const filtreEspace = p.get('espace')?.replace(/^eq\./, '');
      const filtreEmail = p.get('email') ?? '';
      const motif = filtreEmail.startsWith('ilike.') ? filtreEmail.slice(6).replace(/\\([\\%_])/g, '$1') : null;
      const garde = (e: string) => (!filtreEmail ? true : filtreEmail.startsWith('eq.') ? e === filtreEmail.slice(3) : motif !== null && e.toLowerCase() === motif.toLowerCase());
      const visibles = this.membres.filter((m) => (this.historique ? m.espace === LM && this.permis(jeton, null).includes(LM) : this.permis(jeton, entete).includes(m.espace)));
      return json(visibles.filter((m) => (!filtreEspace || m.espace === filtreEspace) && garde(m.email)).map(({ email: e, role }) => ({ email: e, role })));
    }
    const avecEspace = url.searchParams.has('espace') || (Array.isArray(corps) && corps.some((l) => 'espace' in l));
    if (this.historique && avecEspace) return json({ code: '42703', message: 'column enregistrements.espace does not exist' }, 400);
    const permis = this.permis(jeton, entete);
    if (methode === 'GET') {
      const p = url.searchParams;
      const egal = (k: string) => p.get(k)?.replace(/^eq\./, '');
      const ids = p.get('id')?.startsWith('in.') ? new Set(p.get('id')!.replace(/^in\.\(|\)$/g, '').split(',').map((x) => x.replace(/^"|"$/g, ''))) : null;
      return json(
        [...this.lignes.values()]
          .filter((l) => permis.includes(l.espace) && (!egal('espace') || l.espace === egal('espace')) && l.collection === egal('collection') && (!ids || ids.has(l.id)))
          .map((l) => ({ id: l.id, donnees: l.donnees, maj_le: l.maj_le })),
      );
    }
    if (methode === 'PATCH') {
      // Écriture conditionnelle (BaseErp.remplacerSi) : la ligne, si elle a encore la version lue.
      const p = url.searchParams;
      const egal = (k: string) => p.get(k)?.replace(/^eq\./, '');
      const espace = egal('espace') ?? LM;
      if (!permis.includes(espace) || !p.get('maj_le')) return json([]);
      const cle = `${espace}\u0000${egal('collection')}\u0000${egal('id')}`;
      const l = this.lignes.get(cle);
      if (!l || l.maj_le !== egal('maj_le')) return json([]);
      this.poser(espace, l.collection, (corps as { donnees: { id: string } }).donnees);
      const n = this.lignes.get(cle)!;
      return json([{ id: n.id, donnees: n.donnees, maj_le: n.maj_le }]);
    }
    for (const l of corps as Partial<Ligne>[]) {
      const espace = l.espace ?? LM;
      if (!permis.includes(espace)) return json({ code: '42501', message: 'new row violates row-level security policy' }, 403);
      this.poser(espace, l.collection!, l.donnees as { id: string });
    }
    return new Response(null, { status: 201 });
  };
}

/* ------------------------------------------------- requêtes et réponses */

function reponse() {
  const r = {
    statut: 0,
    corps: undefined as unknown as Record<string, any>,
    entetes: {} as Record<string, string>,
    /** Réponse en texte (res.end), pour les documents. */
    texte: '',
    setHeader(k: string, v: string) {
      r.entetes[k] = v;
    },
    status(s: number) {
      r.statut = s;
      return r;
    },
    json(c: Record<string, any>) {
      r.corps = c;
      return r;
    },
    end(t?: unknown) {
      if (typeof t === 'string') r.texte = t;
      return r;
    },
    send(t?: unknown) {
      if (typeof t === 'string') r.texte = t;
      return r;
    },
  };
  return r;
}

function requete(o: { methode?: string; entetes?: Record<string, string>; corps?: unknown; query?: Record<string, string> }) {
  return { method: o.methode ?? 'POST', headers: o.entetes ?? {}, body: o.corps ?? {}, query: o.query ?? {} };
}

function webhook(ev: Record<string, unknown>, secret: string, query: Record<string, string> = {}) {
  const corps = JSON.stringify({ eventId: crypto.randomUUID(), ...ev });
  const t = Math.floor(Date.now() / 1000);
  const v1 = crypto.createHmac('sha256', secret).update(`${t}.${corps}`).digest('hex');
  return {
    method: 'POST',
    query,
    headers: { 'x-repull-signature': `t=${t},v1=${v1}` },
    async *[Symbol.asyncIterator]() {
      yield Buffer.from(corps);
    },
  };
}

/* --------------------------------------------------------------- scénarios */

async function principal() {
  console.warn = () => undefined;
  console.log = ((l: unknown, ...reste: unknown[]) => {
    if (typeof l === 'string' && l.startsWith('[')) return;
    process.stdout.write(`${[l, ...reste].join(' ')}\n`);
  }) as typeof console.log;
  const monde = new Monde();
  (globalThis as { fetch: typeof fetch }).fetch = monde.fetch as typeof fetch;
  const env = process.env;
  for (const k of ['ERP_SERVEUR_MOT_DE_PASSE', 'ANTHROPIC_API_KEY', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VITE_ERP_EMAIL_EQUIPE']) delete env[k];
  Object.assign(env, { REPULL_API_KEY: 'sk_test_lm', ERP_PASSWORD: 'mdp-equipe', CRON_SECRET: 'secret-cron', REPULL_WEBHOOK_SECRET_ERP: 'whsec_lm' });
  const selection = (espace: string) => monde.poser(espace, 'repull', { id: ID_SELECTION, annonces: ['1'], limite: null, majLe: '2026-10-01T10:00:00+02:00', majPar: 'test' } as { id: string });
  selection(LM);
  selection(SENS);

  // Connecteur Claude (OAuth + MCP), agenda du CRM, invitation « Créer mon compte ».
  const appelRoute = async (route: (req: any, res: any) => unknown, o: Parameters<typeof requete>[0]) => {
    const res = reponse();
    await route(requete(o), res);
    return res;
  };
  const PKCE = crypto.randomBytes(40).toString('base64url');
  const DEFI = crypto.createHash('sha256').update(PKCE).digest('base64url');
  const RETOUR_CLAUDE = 'https://claude.ai/api/mcp/auth_callback';
  const DEMANDE = { response_type: 'code', client_id: 'claude-test', redirect_uri: RETOUR_CLAUDE, code_challenge: DEFI, code_challenge_method: 'S256', state: 'etat-1' };
  const autoriserClaude = (entetes: Record<string, string>) => appelRoute(routeConnecteur, { entetes, corps: { action: 'autoriser', ...DEMANDE } });
  const codeDe = (res: { corps?: Record<string, any> }) => new URL(String(res.corps?.redirection || 'https://x.invalid/')).searchParams.get('code') ?? '';
  const jetonsDe = (code: string) => appelRoute(routeToken, { corps: { grant_type: 'authorization_code', code, code_verifier: PKCE, redirect_uri: RETOUR_CLAUDE, client_id: 'claude-test' } });
  const rafraichirJeton = (refresh_token: string) => appelRoute(routeToken, { corps: { grant_type: 'refresh_token', refresh_token, client_id: 'claude-test' } });
  const mcp = (jeton: string, method: string, params?: Record<string, unknown>) =>
    appelRoute(routeMcp, { entetes: { authorization: `Bearer ${jeton}` }, corps: { jsonrpc: '2.0', id: 1, method, ...(params ? { params } : {}) } });
  /** Noms des contacts du CRM que Claude voit avec ce jeton (ou « refus <statut> »). */
  const nomsCrm = async (jeton: string) => {
    const r = await mcp(jeton, 'tools/call', { name: 'crm_chercher', arguments: {} });
    const contacts = r.corps?.result?.structuredContent?.contacts as { nom: string }[] | undefined;
    return r.statut === 200 && contacts ? contacts.map((c) => c.nom).sort().join() : `refus ${r.statut}`;
  };
  const lectureCrm = (espace?: string) => monde.base.some((r) => r.methode === 'GET' && r.url.searchParams.get('collection') === 'eq.crm' && (!espace || r.espace === espace));
  const creerAgenda = (entetes: Record<string, string>) => appelRoute(routeAgenda, { entetes, corps: { action: 'creer', filtre: 'tous' } });
  const cleAgenda = (res: { corps?: Record<string, any> }) => String(res.corps?.https ?? '').split('/api/crm-agenda/')[1] ?? '';
  const lireAgenda = (cle: string) => appelRoute(routeAgendaIcs, { methode: 'GET', query: { cle } });
  const inviter = (entetes: Record<string, string>, email: string) => appelRoute(routeInvitation, { entetes, corps: { email } });
  const contactCrm = (id: string, nom: string) =>
    ({ id, nom, source: 'contact', statut: 'a_appeler', notes: '', tentatives: 0, historique: [], creeLe: '2026-10-01T10:00:00+02:00' }) as { id: string };
  monde.poser(LM, 'crm', contactCrm('crm-lm-1', 'Lucie Label'));
  monde.poser(LM, 'crm', contactCrm('crm-lm-2', 'Louis Label'));
  monde.poser(SENS, 'crm', contactCrm('crm-s-1', 'Simone Sens'));
  const FORME_LM = /^[A-Za-z0-9_-]{43}$/;

  section('Outils');
  verifier(espaceDemande({ headers: { 'x-erp-espace': SENS.toUpperCase() } }) === SENS && espaceDemande({ headers: { 'x-erp-espace': 'sens' } }) === undefined && espaceDemande({ headers: {} }) === undefined, 'espace de l’appel : uuid de l’en-tête seulement');
  verifier(workspaceDeLEvenement({ workspaceId: 1204 }) === '1204' && workspaceDeLEvenement({ data: { workspaceId: '77' } }) === '77' && workspaceDeLEvenement({}) === undefined, 'workspace d’un événement');
  verifier(codeEspaceDuWebhook({ query: { espace: 'Sens' } }) === 'sens' && codeEspaceDuWebhook({ query: { espace: 'label-maison' } }) === undefined && codeEspaceDuWebhook({ query: {} }) === undefined, 'espace de l’adresse du webhook');
  {
    const lm = { id: LM, code: 'label-maison', nom: 'Label Maison', repull_workspace: null, config: {} };
    const sens = { id: SENS, code: 'sens', nom: 'Sens', repull_workspace: '1204', config: {} };
    verifier(espaceDuWorkspace([lm], '555')?.id === LM, 'workspace d’un événement, Label Maison seul : Label Maison (comme avant)');
    verifier(espaceDuWorkspace([lm, { ...sens, repull_workspace: null }], '555')?.id === LM, 'aucun autre espace avec un workspace : Label Maison');
    verifier(espaceDuWorkspace([lm, sens], '1204')?.id === SENS && espaceDuWorkspace([lm, sens], '555') === null, 'Sens déclaré : son workspace chez lui, un inconnu ignoré');
    verifier(espaceDuWorkspace([{ ...lm, repull_workspace: '42' }, sens], '42')?.id === LM, 'Label Maison peut déclarer le sien');
  }

  section('Base pas encore préparée : comme avant');
  {
    const c = configuration();
    verifier((await etatBase(c)).mode === 'historique', 'état : historique');
    monde.oublier();
    await baseErp(c).lire('crm');
    const r = monde.base[monde.base.length - 1];
    verifier(r.jeton === 'jeton-equipe' && r.espace === null && !r.url.searchParams.has('espace'), 'compte d’équipe, sans en-tête ni filtre', { jeton: r.jeton, espace: r.espace });
    let m = '';
    await baseErp(c, SENS).lire('crm').catch((e: Error) => (m = e.message));
    verifier(m === MESSAGE_BASE_PAS_PREPAREE, 'autre espace : « Base pas encore préparée »', m);
    verifier((await espacesActifs(c)).map((e) => e.id).join() === LM, 'espaces actifs : Label Maison seul');
    m = '';
    await configurationEspace(SENS).catch((e: Error) => (m = e.message));
    verifier(m === MESSAGE_BASE_PAS_PREPAREE, 'réglages d’un autre espace : refusés', m);
    monde.oublier();
    const res = reponse();
    await routeSynchro(requete({ entetes: { authorization: 'Bearer secret-cron' } }), res);
    verifier(res.statut === 200 && typeof res.corps?.statut === 'string', 'passage quotidien : même réponse qu’avant (Label Maison seul)', res.corps);
    verifier(monde.repull.length > 0 && monde.repull.every((a) => a.workspace === null && a.cle === 'sk_test_lm'), 'Repull : clé de Label Maison, sans workspace');
    verifier(monde.base.every((r) => r.espace === null), 'base : aucune requête avec espace');
    monde.oublier();
    const w = reponse();
    await routeWebhook(webhook({ event: 'reservation.message.received', data: { object: {} }, workspaceId: 555 }, 'whsec_lm'), w);
    verifier(w.statut === 200 && !w.corps?.ignore && monde.repull.length > 0 && monde.ecritures(LM).length > 0, 'webhook tagué d’un workspace, base d’avant : traité pour Label Maison', w.corps);
    // Fichiers : Label Maison comme avant (compte d'équipe, sans en-tête) ; un autre espace ne signe rien.
    monde.oublier();
    const lienLM = await signeurFichiersErp(c)!('stockage://erp-fichiers/proprietaires/pro-a/x.pdf', 60);
    verifier(
      /token=jeton-signe/.test(lienLM ?? '') && monde.stockage.length === 1 && monde.stockage[0].jeton === 'jeton-equipe' && monde.stockage[0].espace === null,
      'fichier de Label Maison, base d’avant : signé avec le compte d’équipe, sans en-tête (comme avant)',
      monde.stockage,
    );
    verifier(signeurFichiersErp({ ...c, espace: SENS }) === undefined && deposeurFichiersErp({ ...c, espace: SENS }) === undefined, 'autre espace sans compte serveur : ni signature ni dépôt');
    // Espaces ouverts par invitation : rien avant le SQL des espaces (message clair).
    const plateforme = reponse();
    await routeEspaces(requete({ methode: 'GET', query: { action: 'plateforme' }, entetes: { authorization: 'Bearer jeton-equipe' } }), plateforme);
    verifier(plateforme.statut === 503 && plateforme.corps?.erreur === MESSAGE_BASE_PAS_PREPAREE, 'espaces par invitation, base d’avant : « Base pas encore préparée »', plateforme.corps);
    verifier((await stockageFerme(c, SENS)) === MESSAGE_COMPTE_SERVEUR && (await stockageFerme(c, LM)) === null, 'fichiers fermés pour un autre espace, ouverts pour Label Maison (message clair)');
  }

  section('Espace propriétaire, base pas encore préparée : Label Maison comme avant');
  const ORIGINE = { origin: 'https://labelmaisoncg.fr' };
  const EMAIL_PROPRIO = 'proprio@exemple.invalid';
  const jetonDuLien = (lien: string) => new URLSearchParams(String(lien).split('#')[1] ?? '').get('jeton') ?? '';
  const appelProprio = async (o: { methode?: string; entetes?: Record<string, string>; corps?: unknown; query?: Record<string, string> }) => {
    const res = reponse();
    await routeProprietaire(requete({ ...o, entetes: { ...ORIGINE, ...(o.entetes ?? {}) } }), res);
    return res;
  };
  const cookieDe = (res: { entetes: Record<string, string> }) => String(res.entetes['Set-Cookie'] ?? '').split(';')[0];
  // Factures partagées, échéance il y a `jours` jours.
  const ilYa = (jours: number) => new Date(Date.now() - jours * 86_400_000).toISOString().slice(0, 10);
  const facture = (id: string, proprietaireId: string, joursDeRetard: number, o: Record<string, unknown> = {}) =>
    ({ id, numero: `N-${id}`, type: 'commission', destinataire: 'proprietaire', proprietaireId, dateEmission: ilYa(joursDeRetard + 15), echeance: ilYa(joursDeRetard), montantHtCentimes: 10000, tvaPct: 20, statut: 'emise', lignes: [], partageeLe: '2026-01-01T00:00:00.000Z', ...o }) as { id: string };
  const relance = (espace: string, id: string) => monde.lignes.get(`${espace}\u0000relancesPaiement\u0000${id}`)?.donnees as { statut?: string; motif?: string; envoyeePar?: string } | undefined;
  let cookieAlice = '';
  {
    env.PROPRIETAIRE_SECRET = 'secret-de-test-espace-proprietaire-0123456789';
    monde.poser(LM, 'proprietaires', { id: 'pro-a', nom: 'Alice Label', contact: { email: EMAIL_PROPRIO, telephone: '' } } as { id: string });
    monde.poser(LM, 'logements', { id: 'log-a', nom: 'Chez Alice', ville: 'Évry', statut: 'actif', proprietaireId: 'pro-a', capacite: 4, chambres: 1 } as { id: string });
    monde.poser(LM, 'reservations', { id: 'res-a', logementId: 'log-a', canal: 'airbnb', voyageur: { nom: 'Bob Martin', nbPersonnes: 2 }, arrivee: '2099-01-10', depart: '2099-01-12', nuits: 2, statut: 'confirmee', montantBrutCentimes: 20000, commissionPlateformeCentimes: 3000, fraisMenageCentimes: 4000 } as { id: string });
    let res = await appelProprio({ entetes: { authorization: 'Bearer jeton-equipe' }, corps: { action: 'inviter', proprietaireId: 'pro-a', email: EMAIL_PROPRIO } });
    verifier(res.statut === 200 && String(res.corps?.lien).includes(`/espace-proprietaire#espace=${LM}&jeton=`), 'invitation du gérant : lien de Label Maison', res.corps);
    const acces = monde.lignes.get(`${LM}\u0000accesProprietaires\u0000pro-a`)?.donnees as { espace?: string } | undefined;
    verifier(acces?.espace === LM && monde.base.filter((r) => r.chemin === 'enregistrements').every((r) => r.espace === null), 'accès rangé dans Label Maison, sans en-tête (base d’avant les espaces)', acces);
    // Ancien lien, sans espace : Label Maison.
    res = await appelProprio({ corps: { action: 'entrer', jeton: jetonDuLien(res.corps?.lien) } });
    cookieAlice = cookieDe(res);
    verifier(res.statut === 200 && cookieAlice.startsWith('lm_proprio='), 'lien sans espace : ouvert dans Label Maison', res.corps);
    res = await appelProprio({ methode: 'GET', query: { action: 'vue' }, entetes: { cookie: cookieAlice } });
    verifier(res.statut === 200 && res.corps?.vue?.conciergerie?.nom === 'Label Maison' && !!res.corps?.vue?.contacts && res.corps?.vue?.logements?.[0]?.id === 'log-a', 'vue de Label Maison, avec ses contacts', res.corps);
    // Relances, base d'avant les espaces : Label Maison seul, mode « proposer » par défaut.
    monde.poser(LM, 'factures', facture('fac-lm', 'pro-a', 6));
    monde.oublier();
    const bilan = await relancesDuJour();
    verifier((bilan['label-maison'] as { creees?: number })?.creees === 1 && monde.emails.length === 0, 'relances (base d’avant les espaces) : proposée, rien d’envoyé', bilan);
    verifier(relance(LM, 'fac-lm-r1')?.statut === 'proposee' && monde.base.every((r) => r.espace === null), 'relance rangée dans Label Maison, sans en-tête');
  }

  section('Espace opérations, base pas encore préparée : Label Maison comme avant');
  const EMAIL_OPS = 'terrain@exemple.invalid';
  const appelOps = async (o: { methode?: string; entetes?: Record<string, string>; corps?: unknown; query?: Record<string, string> }) => {
    const res = reponse();
    await routeOperations(requete({ ...o, entetes: { ...ORIGINE, ...(o.entetes ?? {}) } }), res);
    return res;
  };
  let cookieAgathe = '';
  {
    // Un seul secret pour les deux espaces : le genre est signé dans la session.
    env.ACCES_SECRET = 'secret-commun-des-espaces-exterieurs-0123456789';
    monde.poser(LM, 'logements', { id: 'log-b', nom: 'Pas pour Agathe', ville: 'Massy', statut: 'actif', proprietaireId: 'pro-b', capacite: 2, chambres: 1 } as { id: string });
    monde.poser(LM, 'equipe', { id: 'eq-a', nom: 'Agathe Terrain', role: 'pole', email: EMAIL_OPS, logementIds: ['log-a'], actif: true } as { id: string });
    let res = await appelOps({ entetes: { authorization: 'Bearer jeton-equipe' }, corps: { action: 'inviter', membreId: 'eq-a', email: EMAIL_OPS } });
    verifier(res.statut === 200 && String(res.corps?.lien).includes(`/espace-operations#espace=${LM}&jeton=`), 'opérations : invitation du gérant, lien de Label Maison', res.corps);
    verifier((monde.lignes.get(`${LM}\u0000accesOperations\u0000eq-a`)?.donnees as { espace?: string } | undefined)?.espace === LM, 'opérations : accès rangé dans Label Maison');
    res = await appelOps({ corps: { action: 'entrer', jeton: jetonDuLien(res.corps?.lien) } });
    cookieAgathe = cookieDe(res);
    verifier(res.statut === 200 && cookieAgathe.startsWith('lm_operations='), 'opérations : lien sans espace ouvert dans Label Maison', res.corps);
    res = await appelOps({ methode: 'GET', query: { action: 'vue' }, entetes: { cookie: cookieAgathe } });
    verifier(res.statut === 200 && res.corps?.vue?.logements?.map((l: { id: string }) => l.id).join() === 'log-a' && res.corps?.vue?.conciergerie?.nom === 'Label Maison', 'opérations : seulement ses logements, au nom de Label Maison', res.corps?.vue?.logements);
    res = await appelOps({ entetes: { cookie: cookieAgathe }, corps: { action: 'agir', operation: { type: 'signaler', logementId: 'log-b', urgent: true, description: 'Fuite sous l’évier de la cuisine.' } } });
    verifier(res.statut === 403, 'opérations : incident sur un logement qui n’est pas le sien refusé', res.corps);
    monde.oublier();
    res = await appelOps({ entetes: { cookie: cookieAgathe }, corps: { action: 'agir', operation: { type: 'signaler', logementId: 'log-a', urgent: true, description: 'Fuite sous l’évier de la cuisine.' } } });
    const ecrits = monde.base.filter((r) => r.methode === 'POST' && r.chemin === 'enregistrements');
    verifier(res.statut === 200 && res.corps?.vue?.incidents?.some((i: { urgent: boolean }) => i.urgent), 'opérations : urgence signalée, vue à jour', res.corps?.message);
    verifier(res.corps?.message === 'Urgence signalée. Le gérant le verra dans l’ERP.', 'opérations : sans notifications, jamais « l’équipe est prévenue »', res.corps?.message);
    verifier(ecrits.length > 0 && ecrits.every((r) => (r.corps as { collection: string }[]).every((l) => l.collection === 'incidents')), 'opérations : seule la collection des incidents est écrite', ecrits.map((r) => r.corps));
    // Un cookie propriétaire ne vaut pas pour les opérations (genre signé dans la session).
    res = await appelOps({ methode: 'GET', query: { action: 'vue' }, entetes: { cookie: cookieAlice.replace(/^lm_proprio=/, 'lm_operations=') } });
    verifier(res.statut === 401, 'opérations : cookie propriétaire refusé', res.statut);
  }

  section('Connecteur Claude, agenda et invitation, base pas encore préparée : Label Maison comme avant');
  {
    const gerantLM = { authorization: 'Bearer jeton-equipe' };
    monde.oublier();
    let res = await autoriserClaude(gerantLM);
    const code = codeDe(res);
    verifier(res.statut === 200 && FORME_LM.test(code) && res.corps?.espace === 'Label Maison', 'gérant de Label Maison : code sans espace (forme d’avant)', res.corps);
    verifier(monde.base.every((r) => r.espace === null) && monde.ecritures(LM).length === 1, 'code rangé dans Label Maison, sans en-tête');
    res = await jetonsDe(code);
    const acces = String(res.corps?.access_token ?? '');
    verifier(res.statut === 200 && FORME_LM.test(acces) && FORME_LM.test(String(res.corps?.refresh_token)), 'jetons sans espace (forme d’avant)', res.corps);
    monde.oublier();
    verifier((await nomsCrm(acces)) === 'Louis Label,Lucie Label', 'Claude lit le CRM de Label Maison', await nomsCrm(acces));
    verifier(monde.base.length > 0 && monde.base.every((r) => r.espace === null && r.jeton === 'jeton-equipe' && !r.url.searchParams.has('espace')), 'compte d’équipe, sans en-tête ni filtre (comme avant)');
    const init = await mcp(acces, 'initialize', { protocolVersion: '2025-06-18' });
    verifier(init.corps?.result?.serverInfo?.title === 'Label Maison' && /en Essonne/.test(init.corps?.result?.instructions ?? ''), 'instructions de Label Maison inchangées', init.corps?.result?.serverInfo);
    monde.oublier();
    res = await mcp(`${SENS}.${acces}`, 'tools/list');
    verifier(res.statut === 401 && /invalid_token/.test(res.entetes['WWW-Authenticate'] ?? '') && !lectureCrm(), 'jeton préfixé par un autre espace, base d’avant : refusé, rien de lu', res.statut);
    res = await autoriserClaude({ authorization: 'Bearer jeton-sens', 'x-erp-espace': SENS });
    verifier(res.statut === 403, 'gérant d’un autre espace, base d’avant : ne peut rien autoriser', res.corps);
    res = await autoriserClaude({});
    verifier(res.statut === 401, 'sans session : rien n’est autorisé', res.statut);
    // Jeton émis avant cette version (rangé sans espace) : Label Maison.
    const ancien = crypto.randomBytes(32).toString('base64url');
    monde.poser(LM, 'connecteurs', {
      id: `oauth-jeton-${crypto.createHash('sha256').update(ancien).digest('hex')}`,
      type: 'acces',
      famille: 'f-ancienne',
      client: 'claude-test',
      par: 'equipe@labelmaisoncg.fr',
      creeLe: new Date().toISOString(),
      expire: new Date(Date.now() + 3600_000).toISOString(),
    } as { id: string });
    verifier((await nomsCrm(ancien)) === 'Louis Label,Lucie Label', 'ancien jeton (sans espace) : Label Maison', await nomsCrm(ancien));

    // Agenda du CRM.
    res = await creerAgenda(gerantLM);
    const cle = cleAgenda(res);
    verifier(res.statut === 200 && FORME_LM.test(cle) && String(res.corps?.webcal).startsWith('webcal://www.labelmaisoncg.fr/api/crm-agenda/'), 'agenda : lien de Label Maison sans espace', res.corps);
    res = await lireAgenda(cle);
    verifier(res.statut === 200 && res.texte.includes('Lucie Label') && res.texte.includes('X-WR-CALNAME:Relances CRM · Label Maison') && res.texte.includes('UID:crm-crm-lm-1@') && !res.texte.includes('Simone'), 'agenda de Label Maison : son CRM, comme avant', res.texte.slice(0, 300));
    res = await lireAgenda(`${SENS}.${cle}`);
    verifier(res.statut === 404, 'agenda : clé préfixée par un autre espace, base d’avant : 404', res.statut);

    // Clé fixée par l'administrateur (MCP_CRM_TOKEN) : Label Maison.
    env.MCP_CRM_TOKEN = `cle-fixee-de-test-${'x'.repeat(24)}`;
    res = await appelRoute(routeMcpCle, { query: { cle: env.MCP_CRM_TOKEN }, corps: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'crm_chercher', arguments: {} } } });
    verifier(res.statut === 200 && (res.corps?.result?.structuredContent?.total ?? 0) === 2, 'clé fixée (MCP_CRM_TOKEN) : Label Maison', res.corps?.result?.structuredContent?.total);
    delete env.MCP_CRM_TOKEN;

    // Invitation « Créer mon compte » : pas sur la base d'avant les espaces (rien ne relierait le compte à son invité).
    env.RESEND_API_KEY = 're_test';
    env.CONTACT_FROM_EMAIL = 'Label Maison <bonjour@exemple.invalid>';
    monde.emails = [];
    monde.oublier();
    res = await inviter({ ...gerantLM, origin: 'https://pirate.example', host: 'pirate.example' }, ' Nouvelle_Recrue@Exemple.invalid ');
    verifier(
      res.statut === 409 && res.corps?.code === 'historique' && res.corps?.erreur === MESSAGE_INVITATION_HISTORIQUE && !res.corps?.lien && monde.emails.length === 0,
      'base d’avant les espaces : pas d’invitation, « pas encore ouverte(s) », aucun e-mail',
      res.corps,
    );
    verifier(MESSAGE_INVITATION_HISTORIQUE === 'Les invitations ne sont pas encore ouvertes : la mise à jour de l’ERP doit d’abord être terminée.', 'message de la base d’avant : le texte prévu');
    verifier(!monde.base.some((r) => r.chemin === 'rpc/inviter_membre'), 'base d’avant : aucun code gardé');
    res = await inviter(gerantLM, 'pas une adresse');
    verifier(res.statut === 400, 'adresse invalide : refusée', res.statut);
    res = await inviter({ authorization: 'Bearer jeton-sens', 'x-erp-espace': SENS }, 'recrue-sens@exemple.invalid');
    verifier(res.statut === 403 && monde.emails.length === 0, 'autre espace, base d’avant : refusé', res.statut);
    res = await appelRoute(routeInvitation, { methode: 'GET', entetes: gerantLM });
    verifier(res.statut === 405, 'invitation : POST seulement', res.statut);
    delete env.RESEND_API_KEY;
    delete env.CONTACT_FROM_EMAIL;
  }

  section('Base préparée, compte serveur pas prêt');
  monde.historique = false;
  env.ERP_SERVEUR_MOT_DE_PASSE = 'mdp-serveur';
  oublierEtatBase();
  {
    const c = configuration();
    const e = await etatBase(c);
    verifier(e.mode === 'espaces' && !e.serveur, 'état : espaces, sans compte serveur (rôle absent)', e);
    monde.oublier();
    await baseErp(c).lire('crm');
    const r = monde.base[monde.base.length - 1];
    verifier(r.jeton === 'jeton-equipe' && r.espace === LM && r.url.searchParams.get('espace') === `eq.${LM}`, 'Label Maison : compte d’équipe, en-tête et filtre de Label Maison', { jeton: r.jeton, espace: r.espace });
    let m = '';
    await baseErp(c, SENS).lire('crm').catch((x: Error) => (m = x.message));
    verifier(m === MESSAGE_COMPTE_SERVEUR, 'autre espace : jamais avec le compte d’équipe', m);
    m = '';
    await configurationEspace(SENS).catch((x: Error) => (m = x.message));
    verifier(m === MESSAGE_COMPTE_SERVEUR, 'réglages de Sens : compte serveur exigé', m);
    // Fichiers : Label Maison avec le compte d'équipe (et l'en-tête de Label Maison) ; Sens jamais avec le compte d'équipe.
    monde.oublier();
    const lienLM = await signeurFichiersErp(c)!('stockage://erp-fichiers/logements/log-a/photos/a.jpg', 60);
    verifier(!!lienLM && monde.stockage[0]?.jeton === 'jeton-equipe' && monde.stockage[0]?.espace === LM, 'fichier de Label Maison : compte d’équipe, en-tête de Label Maison', monde.stockage);
    monde.oublier();
    m = '';
    await signeurFichiersErp({ ...c, espace: SENS })!(`stockage://erp-fichiers/${SENS}/proprietaires/pro-s/m.pdf`, 60).catch((x: Error) => (m = x.message));
    verifier(m === MESSAGE_COMPTE_SERVEUR && monde.stockage.length === 0, 'fichier de Sens : jamais avec le compte d’équipe (compte serveur exigé)', { m, stockage: monde.stockage });
    verifier((await deposeurFichiersErp({ ...c, espace: SENS })!(`${SENS}/operations/eq-s/a.jpg`, new Uint8Array([1]), 'image/jpeg')) === null && monde.stockage.length === 0, 'dépôt dans Sens : refusé sans compte serveur');
    verifier((await stockageFerme(c, SENS)) === MESSAGE_COMPTE_SERVEUR, 'fichiers de Sens fermés tant que le compte serveur n’est pas prêt');
    monde.oublier();
    const res = await autoriserClaude({ authorization: 'Bearer jeton-sens', 'x-erp-espace': SENS });
    verifier(res.statut === 503 && !monde.base.some((r) => r.methode === 'POST' && r.chemin === 'enregistrements'), 'connecteur de Sens sans compte serveur : indisponible, rien rangé nulle part', res.statut);
    const forge = await mcp(`${SENS}.${crypto.randomBytes(32).toString('base64url')}`, 'tools/list');
    verifier(forge.statut === 401 && !lectureCrm(), 'jeton de Sens sans compte serveur : refusé, rien de lu', forge.statut);
  }
  env.ERP_SERVEUR_MOT_DE_PASSE = 'mauvais';
  oublierEtatBase();
  verifier((await etatBase(configuration())).serveur === false, 'mot de passe serveur refusé : compte d’équipe (Label Maison)');

  section('Compte serveur prêt');
  monde.serveurPret = true;
  env.ERP_SERVEUR_MOT_DE_PASSE = 'mdp-serveur';
  oublierEtatBase();
  {
    const c = configuration();
    verifier((await etatBase(c)).serveur, 'état : compte serveur prêt');
    monde.oublier();
    await baseErp(c).lire('crm');
    await baseErp(c, SENS).lire('crm');
    const [a, b] = monde.base.filter((r) => r.chemin === 'enregistrements');
    verifier(a.jeton === 'jeton-serveur' && a.espace === LM && b.jeton === 'jeton-serveur' && b.espace === SENS && b.url.searchParams.get('espace') === `eq.${SENS}`, 'compte serveur : l’espace nommé par l’en-tête', [a.espace, b.espace]);
    verifier((await espacesActifs(c)).map((e) => e.code).join() === 'label-maison,sens,vide', 'espaces actifs : tous, Label Maison d’abord');
    let lm = await configurationEspace(LM);
    verifier(lm.cle === 'sk_test_lm' && !lm.workspace && lm.secretWebhook === 'whsec_lm' && lm.plafondIAMois === undefined, 'Label Maison : variables de Vercel, sans plafond ni workspace (comme avant)', lm);
    // Un workspace sur le compte de Label Maison n'est permis qu'une fois celui de Label Maison posé (sinon sa clé lirait aussi celui-là).
    let m = '';
    await configurationEspace(SENS).catch((x: Error) => (m = x.message));
    verifier(/REPULL_WORKSPACE_LM/.test(m), 'workspace de Sens sur le compte de Label Maison : refusé tant que REPULL_WORKSPACE_LM manque', m);
    env.REPULL_WORKSPACE_LM = ' lm-ws\n';
    lm = await configurationEspace(LM);
    verifier(lm.workspace === 'lm-ws' && lm.cle === 'sk_test_lm' && !variableManquante(lm), 'REPULL_WORKSPACE_LM : le workspace de Label Maison sur ses appels', lm.workspace);
    verifier(/REPULL_WORKSPACE_LM illisible/.test(variableManquante({ ...lm, workspace: 'lm ws' }) ?? ''), 'REPULL_WORKSPACE_LM illisible : message clair');
    monde.espaces[1].repull_workspace = 'lm-ws';
    m = '';
    await configurationEspace(SENS).catch((x: Error) => (m = x.message));
    verifier(/même workspace/.test(m), 'le workspace de Label Maison déclaré pour un autre espace : refusé', m);
    monde.espaces[1].repull_workspace = '1204';
    const sens = await configurationEspace(SENS);
    verifier(sens.espace === SENS && sens.cle === 'sk_test_lm' && sens.workspace === '1204' && sens.secretWebhook === '' && sens.plafondIAMois === PLAFOND_IA_DEFAUT && sens.nomEspace === 'Sens', 'Sens : clé du compte dans SON workspace, aucun secret de Label Maison', sens);
    verifier(sens.budgetMois === BUDGET_ESPACE_DEFAUT && BUDGET_ESPACE_DEFAUT < lm.budgetMois, 'Sens : sa propre part d’appels, plus petite que celle de Label Maison', sens.budgetMois);
    monde.espaces[1].config = { repull: { budgetMois: 0 } };
    verifier((await configurationEspace(SENS)).budgetMois === 0, 'part d’appels à 0 permise');
    monde.espaces[1].config = {};
    monde.oublier();
    await configurationEspace(SENS);
    verifier(monde.base.filter((r) => r.chemin === 'rpc/secret_espace').every((r) => r.espace === SENS), 'secrets du coffre demandés avec l’en-tête de l’espace');
    monde.coffre.set(`${SENS}:repull_cle`, 'sk_test_sens');
    monde.espaces[1].config = { agent: { plafondMois: 50 } };
    const propre = await configurationEspace(SENS);
    verifier(propre.cle === 'sk_test_sens' && propre.workspace === undefined && propre.plafondIAMois === 50, 'Sens : sa propre clé (coffre), sans le workspace du compte de Label Maison, et son plafond', propre);
    monde.espaces[1].config = { repull: { workspace: 'ws-sens' } };
    verifier((await configurationEspace(SENS)).workspace === 'ws-sens', 'Sens : le workspace de SA clé (réglé par son gérant)');
    monde.espaces[1].config = {};
    monde.coffre.delete(`${SENS}:repull_cle`);
    const vide = await configurationEspace(VIDE);
    verifier(vide.cle === '' && /pas encore relié/.test(variableManquante(vide) ?? ''), 'espace sans workspace ni clé : Repull coupé, jamais la clé de Label Maison', vide);
    monde.espaces[2].config = { repull: { workspace: 'ws-vide' } };
    verifier((await configurationEspace(VIDE)).cle === '', 'workspace sans clé propre : jamais la clé de Label Maison');
    monde.espaces[2].config = {};
    m = '';
    await configurationEspace('9a9a0000-0000-4000-8000-000000000009').catch((x: Error) => (m = x.message));
    verifier(/inconnu/.test(m), 'espace inconnu : refusé', m);

    // Fichiers : chaque espace signe et dépose chez lui, jamais un chemin d'un autre espace.
    const signerLM = signeurFichiersErp(c)!;
    const signerSens = signeurFichiersErp({ ...c, espace: SENS })!;
    monde.oublier();
    const lienSens = await signerSens(`stockage://erp-fichiers/${SENS}/proprietaires/pro-s/m.pdf`, 120);
    verifier(
      /token=jeton-signe/.test(lienSens ?? '') && monde.stockage.length === 1 && monde.stockage[0].jeton === 'jeton-serveur' && monde.stockage[0].espace === SENS,
      'fichier de Sens : signé avec le compte serveur et l’en-tête de Sens',
      monde.stockage,
    );
    monde.oublier();
    const lienLM = await signerLM('stockage://erp-fichiers/proprietaires/pro-a/x.pdf', 120);
    verifier(!!lienLM && monde.stockage[0]?.jeton === 'jeton-equipe' && monde.stockage[0]?.espace === LM, 'fichier de Label Maison : compte d’équipe, comme avant (en-tête de Label Maison)', monde.stockage);
    monde.oublier();
    const croises = await Promise.all([
      signerSens('stockage://erp-fichiers/proprietaires/pro-a/x.pdf', 120),
      signerSens(`stockage://erp-fichiers/${VIDE}/proprietaires/x.pdf`, 120),
      signerSens(`stockage://erp-fichiers/${SENS}/../proprietaires/pro-a/x.pdf`, 120),
      signerSens(`stockage://autre-bucket/${SENS}/x.pdf`, 120),
      signerLM(`stockage://erp-fichiers/${SENS}/proprietaires/pro-s/m.pdf`, 120),
      signerLM(`stockage://erp-fichiers/${SENS.toUpperCase()}/proprietaires/pro-s/m.pdf`, 120),
    ]);
    verifier(croises.every((x) => x === null) && monde.stockage.length === 0, 'chemin d’un autre espace (ou hors du dossier, ou autre bucket) : jamais signé, rien demandé au stockage', { croises, stockage: monde.stockage });
    const deposerSens = deposeurFichiersErp({ ...c, espace: SENS })!;
    monde.oublier();
    const depot = await deposerSens(`${SENS}/operations/eq-s/a.jpg`, new Uint8Array([0xff, 0xd8]), 'image/jpeg');
    verifier(
      depot === `stockage://erp-fichiers/${SENS}/operations/eq-s/a.jpg` && monde.stockage[0]?.jeton === 'jeton-serveur' && monde.stockage[0]?.espace === SENS,
      'dépôt dans Sens : compte serveur, en-tête et dossier de Sens',
      monde.stockage,
    );
    monde.oublier();
    const depotsCroises = await Promise.all([
      deposerSens('operations/eq-s/a.jpg', new Uint8Array([1]), 'image/jpeg'),
      deposeurFichiersErp(c)!(`${SENS}/operations/eq-a/a.jpg`, new Uint8Array([1]), 'image/jpeg'),
    ]);
    verifier(depotsCroises.every((x) => x === null) && monde.stockage.length === 0, 'dépôt hors du dossier de son espace : refusé avant le stockage', monde.stockage);
    verifier((await stockageFerme(c, SENS)) === null, 'fichiers de Sens ouverts une fois le compte serveur prêt');
  }

  section('Webhook tagué, seul Label Maison configuré');
  {
    // Sans REPULL_WORKSPACE_LM ni workspace d'un autre espace : comme avant.
    delete env.REPULL_WORKSPACE_LM;
    monde.espaces[1].repull_workspace = null;
    monde.oublier();
    const w = reponse();
    await routeWebhook(webhook({ event: 'reservation.message.received', data: { object: {} }, workspaceId: 555 }, 'whsec_lm'), w);
    verifier(w.statut === 200 && !w.corps?.ignore && monde.ecritures(LM).length > 0 && monde.repull.every((a) => a.workspace === null), 'aucun autre espace avec un workspace : traité pour Label Maison', w.corps);
    monde.espaces[1].repull_workspace = '1204';
    env.REPULL_WORKSPACE_LM = 'lm-ws';
  }

  section('Workspace Repull de Label Maison (REPULL_WORKSPACE_LM)');
  {
    verifier(espaceDuWorkspace([{ id: LM, code: 'label-maison', nom: 'Label Maison', repull_workspace: 'lm-ws', config: {} }], '555') === null, 'Label Maison a déclaré son workspace : un workspace inconnu est ignoré');
    monde.oublier();
    let w = reponse();
    await routeWebhook(webhook({ event: 'reservation.message.received', data: { object: {} }, workspaceId: 'lm-ws' }, 'whsec_lm'), w);
    verifier(
      w.statut === 200 && !w.corps?.ignore && monde.ecritures(LM).length > 0 && monde.repull.length > 0 && monde.repull.every((a) => a.workspace === 'lm-ws'),
      'événement du workspace de Label Maison : traité chez lui, relu dans son workspace',
      w.corps,
    );
    monde.oublier();
    w = reponse();
    await routeWebhook(webhook({ event: 'reservation.message.received', data: { object: {} }, workspaceId: 777 }, 'whsec_lm'), w);
    verifier(w.statut === 200 && w.corps?.ignore === 'workspace' && monde.repull.length === 0 && monde.ecritures(LM).length === 0, 'workspace pas encore déclaré (un nouvel espace) : ignoré, jamais versé dans Label Maison', w.corps);
  }

  section('Passage quotidien sur chaque espace');
  {
    monde.oublier();
    const res = reponse();
    await routeSynchro(requete({ entetes: { authorization: 'Bearer secret-cron' } }), res);
    verifier(res.statut === 200 && res.corps?.espaces?.['label-maison'] && res.corps?.espaces?.sens && !('vide' in res.corps.espaces), 'Label Maison puis Sens ; l’espace sans Repull est sauté', res.corps);
    const premierSens = monde.repull.findIndex((a) => a.workspace === '1204');
    verifier(premierSens > 0 && monde.repull.slice(0, premierSens).every((a) => a.workspace === 'lm-ws') && monde.repull.slice(premierSens).every((a) => a.workspace === '1204'), 'Repull : Label Maison dans le sien, puis Sens toujours dans le sien');
    verifier(monde.ecritures(SENS).length > 0 && monde.ecritures(SENS).every((r) => r.espace === SENS) && monde.ecritures(LM).every((r) => r.espace === LM), 'chaque espace écrit chez lui');
  }

  section('Bouton d’un membre');
  {
    // Le passage quotidien vient d'avoir lieu : sans cet oubli, le bouton attendrait 10 minutes.
    monde.lignes.delete(`${SENS}\u0000repull\u0000etat`);
    monde.oublier();
    let res = reponse();
    await routeSynchro(requete({ entetes: { authorization: 'Bearer jeton-sens', 'x-erp-espace': SENS } }), res);
    verifier(res.statut === 200, 'gérant de Sens : synchronisation de Sens', res.corps);
    verifier(monde.repull.length > 0 && monde.repull.every((a) => a.workspace === '1204'), 'Repull : workspace de Sens sur chaque appel');
    verifier(monde.ecritures(LM).length === 0, 'rien écrit dans Label Maison');
    res = reponse();
    await routeSynchro(requete({ entetes: { authorization: 'Bearer jeton-equipe', 'x-erp-espace': SENS } }), res);
    verifier(res.statut === 403, 'compte de Label Maison avec l’en-tête de Sens : refusé', res.corps);
    res = reponse();
    await routeAgenda(requete({ methode: 'GET', entetes: { authorization: 'Bearer jeton-sens', 'x-erp-espace': SENS } }), res);
    verifier(res.statut === 200 && res.corps?.liens === 0, 'agenda du CRM : le gérant de Sens voit les liens de Sens (aucun encore)', res.corps);
  }

  section('Connecteur Claude : chaque espace sa clé');
  {
    const gerantSens = { authorization: 'Bearer jeton-sens', 'x-erp-espace': SENS };
    const gerantLM = { authorization: 'Bearer jeton-equipe', 'x-erp-espace': LM };
    monde.oublier();
    let res = await autoriserClaude(gerantSens);
    const codeSens = codeDe(res);
    verifier(res.statut === 200 && codeSens.startsWith(`${SENS}.`) && res.corps?.espace === 'Sens', 'gérant de Sens : code de Sens', { statut: res.statut, espace: res.corps?.espace });
    const ecritsCode = monde.base.filter((r) => r.methode === 'POST' && r.chemin === 'enregistrements');
    verifier(monde.ecritures(SENS).length === 1 && ecritsCode.length === 1 && ecritsCode[0].espace === SENS, 'code rangé dans Sens seulement', ecritsCode.map((r) => r.espace));
    res = await jetonsDe(codeSens.slice(37));
    verifier(res.statut === 400 && res.corps?.error === 'invalid_grant', 'code de Sens sans son préfixe : inconnu de Label Maison', res.corps);
    res = await jetonsDe(`${VIDE}.${codeSens.slice(37)}`);
    verifier(res.statut === 400 && res.corps?.error === 'invalid_grant', 'code de Sens présenté pour un autre espace : refusé', res.corps);
    res = await jetonsDe(codeSens);
    const accesSens = String(res.corps?.access_token ?? '');
    const rafraichSens = String(res.corps?.refresh_token ?? '');
    verifier(res.statut === 200 && accesSens.startsWith(`${SENS}.`) && rafraichSens.startsWith(`${SENS}.`), 'jetons de Sens (préfixés par l’espace)', res.corps);
    res = await jetonsDe(codeSens);
    verifier(res.statut === 400, 'code de Sens : usage unique', res.corps);

    monde.oublier();
    verifier((await nomsCrm(accesSens)) === 'Simone Sens', 'jeton de Sens : Claude ne lit que le CRM de Sens', await nomsCrm(accesSens));
    const lectures = monde.base.filter((r) => r.chemin === 'enregistrements');
    verifier(lectures.length > 0 && lectures.every((r) => r.espace === SENS && r.jeton === 'jeton-serveur' && r.url.searchParams.get('espace') === `eq.${SENS}`), 'compte serveur, en-tête et filtre de Sens à chaque lecture', lectures.map((r) => r.espace));
    const ecrit = await mcp(accesSens, 'tools/call', { name: 'crm_ajouter', arguments: { nom: 'Sacha Nouveau', telephone: '0600000000' } });
    verifier(ecrit.statut === 200 && !ecrit.corps?.result?.isError && monde.ecritures(SENS).some((r) => (r.corps as { collection: string }[]).some((l) => l.collection === 'crm')) && monde.ecritures(LM).length === 0, 'écriture de Claude (CRM) : dans Sens seulement', ecrit.corps?.result);
    const initS = await mcp(accesSens, 'initialize', { protocolVersion: '2025-06-18' });
    const consignes = String(initS.corps?.result?.instructions ?? '');
    verifier(initS.corps?.result?.serverInfo?.title === 'Sens' && consignes.startsWith('Sens ') && !/Essonne|Label Maison Conciergerie|formulaires/.test(consignes), 'instructions au nom de Sens, rien de Label Maison', consignes.slice(0, 120));

    // Label Maison, sur la base des espaces : sa propre autorisation.
    res = await autoriserClaude(gerantLM);
    const codeLM = codeDe(res);
    verifier(res.statut === 200 && FORME_LM.test(codeLM), 'gérant de Label Maison : code sans préfixe, comme avant', codeLM.slice(0, 40));
    res = await jetonsDe(codeLM);
    const accesLM = String(res.corps?.access_token ?? '');
    monde.oublier();
    verifier(FORME_LM.test(accesLM) && (await nomsCrm(accesLM)) === 'Louis Label,Lucie Label', 'jeton de Label Maison : le CRM de Label Maison', await nomsCrm(accesLM));
    verifier(monde.base.filter((r) => r.chemin === 'enregistrements').every((r) => r.espace === LM), 'jeton de Label Maison : jamais la base de Sens');

    // Jetons modifiés : jamais les données d'un autre espace.
    for (const [quoi, jeton] of [
      ['préfixe de Sens ajouté à un jeton de Label Maison', `${SENS}.${accesLM}`],
      ['préfixe retiré d’un jeton de Sens', accesSens.slice(37)],
      ['jeton de Sens passé à un autre espace', `${VIDE}.${accesSens.slice(37)}`],
      ['préfixe Label Maison explicite', `${LM}.${accesLM}`],
      ['préfixe en majuscules', `${SENS.toUpperCase()}.${accesSens.slice(37)}`],
      ['espace inconnu', `9a9a0000-0000-4000-8000-000000000009.${accesSens.slice(37)}`],
      ['valeur tronquée', accesSens.slice(0, -1)],
    ] as [string, string][]) {
      monde.oublier();
      const r = await mcp(jeton, 'tools/call', { name: 'crm_chercher', arguments: {} });
      verifier(r.statut === 401 && !lectureCrm(), `${quoi} : refusé, aucun CRM lu`, r.statut);
    }

    // Rotation du jeton de rafraîchissement, dans Sens.
    res = await rafraichirJeton(`${VIDE}.${rafraichSens.slice(37)}`);
    verifier(res.statut === 400 && res.corps?.error === 'invalid_grant', 'jeton de rafraîchissement passé à un autre espace : refusé', res.corps);
    res = await rafraichirJeton(rafraichSens);
    const accesSens2 = String(res.corps?.access_token ?? '');
    verifier(res.statut === 200 && accesSens2.startsWith(`${SENS}.`) && String(res.corps?.refresh_token).startsWith(`${SENS}.`), 'rafraîchissement : nouveaux jetons de Sens', res.corps);
    verifier((await nomsCrm(accesSens2)).startsWith('Sacha Nouveau,Simone Sens'), 'nouveau jeton : toujours Sens', await nomsCrm(accesSens2));

    // Le membre qui a autorisé Claude n'est plus gérant : ses jetons ne valent plus rien (au plus 1 min après).
    {
      const gerantB = monde.membres.find((m) => m.espace === SENS && m.email === 'gerant-b@exemple.invalid')!;
      const j = await jetonsDe(codeDe(await autoriserClaude(gerantSens)));
      const acces = String(j.corps?.access_token ?? '');
      const rafraich = String(j.corps?.refresh_token ?? '');
      verifier((await nomsCrm(acces)).includes('Simone Sens'), 'second jeton de Sens : valable tant que son gérant l’est', await nomsCrm(acces));
      gerantB.role = 'operations';
      verifier((await nomsCrm(acces)).includes('Simone Sens'), 'gérant passé « opérations » : jeton gardé 1 min au plus (cache)');
      oublierJetonsGardes();
      verifier((await nomsCrm(acces)) === 'refus 401', 'gérant passé « opérations » : jeton d’accès refusé', await nomsCrm(acces));
      const r = await rafraichirJeton(rafraich);
      verifier(r.statut === 400 && r.corps?.error === 'invalid_grant', 'gérant passé « opérations » : rafraîchissement refusé', r.corps);
      gerantB.role = 'gerant';
      oublierJetonsGardes();
      verifier((await nomsCrm(acces)) === 'refus 401' && (await rafraichirJeton(rafraich)).statut === 400, 'redevenu gérant : l’autorisation tombée le reste (à reconnecter)');
      // Code donné, puis gérant retiré de l'équipe avant l'échange : refusé.
      const code = codeDe(await autoriserClaude(gerantSens));
      monde.membres = monde.membres.filter((m) => m !== gerantB);
      const echange = await jetonsDe(code);
      verifier(echange.statut === 400 && echange.corps?.error === 'invalid_grant', 'gérant retiré avant l’échange du code : aucun jeton', echange.corps);
      monde.membres.push(gerantB);
      oublierJetonsGardes();
      verifier((await nomsCrm(accesSens2)).startsWith('Sacha Nouveau,Simone Sens'), 'la première autorisation de Sens, toujours valable, n’est pas touchée');
    }

    // État et révocation : chaque espace les siens.
    res = await appelRoute(routeConnecteur, { methode: 'GET', entetes: gerantSens });
    verifier(res.statut === 200 && res.corps?.connexions === 1 && res.corps?.espace === 'Sens', 'état de Sens : une connexion (celle de Sens)', res.corps);
    res = await appelRoute(routeConnecteur, { entetes: gerantSens, corps: { action: 'deconnecter' } });
    verifier(res.statut === 200, 'Sens : « Déconnecter Claude »', res.corps);
    verifier((await nomsCrm(accesSens2)) === 'refus 401', 'jeton de Sens refusé après la déconnexion de Sens');
    verifier((await nomsCrm(accesLM)) === 'Louis Label,Lucie Label', 'le jeton de Label Maison, lui, marche toujours');
    res = await appelRoute(routeConnecteur, { methode: 'GET', entetes: gerantLM });
    verifier(res.statut === 200 && res.corps?.connexions >= 1 && res.corps?.espace === 'Label Maison', 'état de Label Maison : ses connexions, pas celles de Sens', res.corps);

    // Qui peut autoriser.
    res = await autoriserClaude({ authorization: 'Bearer jeton-equipe', 'x-erp-espace': SENS });
    verifier(res.statut === 403, 'compte de Label Maison avec l’en-tête de Sens : refusé', res.corps);
    res = await autoriserClaude({ authorization: 'Bearer jeton-ops-sens', 'x-erp-espace': SENS });
    verifier(res.statut === 403, 'membre de Sens sans le rôle gérant : refusé', res.corps);
    res = await autoriserClaude({ authorization: 'Bearer jeton-inconnu', 'x-erp-espace': SENS });
    verifier(res.statut === 403, 'compte inconnu : refusé', res.corps);

    // Espace fermé : ses jetons ne valent plus.
    res = await jetonsDe(codeDe(await autoriserClaude(gerantSens)));
    const accesSens3 = String(res.corps?.access_token ?? '');
    verifier((await nomsCrm(accesSens3)).includes('Simone Sens'), 'nouvelle autorisation de Sens : marche');
    const [ficheSens] = monde.espaces.splice(1, 1);
    monde.oublier();
    verifier((await nomsCrm(accesSens3)) === 'refus 401' && !lectureCrm(), 'Sens fermé (plus dans les espaces actifs) : jeton refusé, rien de lu');
    monde.espaces.splice(1, 0, ficheSens);
    verifier((await nomsCrm(accesSens3)).includes('Simone Sens'), 'Sens rouvert : le jeton remarche');
  }

  section('Agenda du CRM : chaque espace son lien');
  {
    const gerantSens = { authorization: 'Bearer jeton-sens', 'x-erp-espace': SENS };
    const gerantLM = { authorization: 'Bearer jeton-equipe', 'x-erp-espace': LM };
    let res = await creerAgenda(gerantSens);
    const cleSens = cleAgenda(res);
    verifier(res.statut === 200 && cleSens.startsWith(`${SENS}.`), 'lien de Sens (préfixé par l’espace)', cleSens.slice(0, 40));
    monde.oublier();
    res = await lireAgenda(cleSens);
    verifier(
      res.statut === 200 && res.texte.includes('Simone Sens') && !res.texte.includes('Lucie Label') && res.texte.includes('X-WR-CALNAME:Relances CRM · Sens') && res.texte.includes(`UID:crm-${SENS}-crm-s-1@`),
      'agenda de Sens : son CRM, son nom, ses UID',
      res.texte.slice(0, 400),
    );
    verifier(lectureCrm(SENS) && !lectureCrm(LM), 'agenda de Sens : jamais le CRM de Label Maison');
    res = await lireAgenda(`${cleSens}.ics`);
    verifier(res.statut === 200, 'lien de Sens avec « .ics » : servi', res.statut);
    for (const [quoi, cle] of [
      ['préfixe retiré', cleSens.slice(37)],
      ['autre espace', `${VIDE}.${cleSens.slice(37)}`],
      ['préfixe Label Maison', `${LM}.${cleSens.slice(37)}`],
    ] as [string, string][]) {
      monde.oublier();
      res = await lireAgenda(cle);
      verifier(res.statut === 404 && !lectureCrm(), `agenda, ${quoi} : 404, rien de lu`, res.statut);
    }
    res = await creerAgenda(gerantLM);
    const cleLM = cleAgenda(res);
    res = await lireAgenda(cleLM);
    verifier(FORME_LM.test(cleLM) && res.statut === 200 && res.texte.includes('Lucie Label') && !res.texte.includes('Simone'), 'lien de Label Maison : son CRM seulement', res.statut);
    res = await appelRoute(routeAgenda, { entetes: gerantSens, corps: { action: 'couper' } });
    verifier(res.statut === 200 && (await lireAgenda(cleSens)).statut === 404 && (await lireAgenda(cleLM)).statut === 200, '« Couper » dans Sens : les liens de Sens seulement');
    res = await creerAgenda({ authorization: 'Bearer jeton-ops-sens', 'x-erp-espace': SENS });
    verifier(res.statut === 403, 'agenda : réservé aux gérants de l’espace', res.statut);
    for (const filtre of ['abdel', 'kamel']) {
      res = await appelRoute(routeAgenda, { entetes: gerantSens, corps: { action: 'creer', filtre } });
      verifier(res.statut === 400, `agenda de Sens : « ${filtre} » refusé (associé de Label Maison)`, res.statut);
    }
    res = await appelRoute(routeAgenda, { entetes: gerantLM, corps: { action: 'creer', filtre: 'kamel' } });
    verifier(res.statut === 200 && FORME_LM.test(cleAgenda(res)), 'agenda de Label Maison : « kamel » comme avant', res.statut);
  }

  section('Invitation « Créer mon compte » : chaque espace');
  {
    const gerantSens = { authorization: 'Bearer jeton-sens', 'x-erp-espace': SENS };
    const gerantLM = { authorization: 'Bearer jeton-equipe', 'x-erp-espace': LM };
    env.RESEND_API_KEY = 're_test';
    env.CONTACT_FROM_EMAIL = 'Label Maison <bonjour@exemple.invalid>';
    monde.emails = [];
    monde.oublier();
    const LIEN_SENS = /^https:\/\/www\.labelmaisoncg\.fr\/erp#creer=recrue-sens%40exemple\.invalid&code=([A-Za-z0-9_-]{43})$/;
    const empreinte = (code: string) => crypto.createHash('sha256').update(code, 'utf8').digest('hex');
    let res = await inviter({ ...gerantSens, origin: 'https://pirate.example', host: 'pirate.example' }, ' Recrue-Sens@Exemple.invalid ');
    const code1 = LIEN_SENS.exec(String(res.corps?.lien ?? ''))?.[1] ?? '';
    verifier(res.statut === 200 && res.corps?.envoye === false && !!code1 && monde.emails.length === 0, 'Sens sans expéditeur : lien du site fixe avec un code de 32 octets, à copier ; jamais l’expéditeur de Label Maison', res.corps);
    const garde = monde.base.filter((r) => r.chemin === 'rpc/inviter_membre').at(-1);
    verifier(
      garde?.jeton === 'jeton-sens' && garde.espace === SENS && (garde.corps as Record<string, string>).p_espace === SENS && (garde.corps as Record<string, string>).p_empreinte === empreinte(code1),
      'code gardé par erp.inviter_membre dans Sens, avec la session du gérant : son empreinte SHA-256 seulement',
      garde?.corps,
    );
    verifier(!monde.base.some((r) => JSON.stringify(r.corps ?? '').includes(code1) || r.url.href.includes(code1)), 'le code lui-même ne va jamais dans la base');
    monde.espaces[1].config = { email: { expediteur: 'Sens <bonjour@sens.exemple.invalid>', repondreA: 'contact@sens.exemple.invalid' } };
    res = await inviter(gerantSens, 'recrue-sens@exemple.invalid');
    const code2 = LIEN_SENS.exec(String(res.corps?.lien ?? ''))?.[1] ?? '';
    verifier(res.statut === 200 && res.corps?.envoye === true && monde.emails.length === 1 && monde.emails[0].from === 'Sens <bonjour@sens.exemple.invalid>' && monde.emails[0].subject === 'Votre accès à l’ERP Sens', 'Sens avec son expéditeur : e-mail au nom de Sens', monde.emails.map((m) => ({ from: m.from, subject: m.subject })));
    verifier(monde.emails[0]?.text.includes(String(res.corps?.lien)) && /une seule fois/.test(monde.emails[0]?.text ?? ''), 'e-mail : le lien avec son code, « il sert une seule fois »', monde.emails[0]?.text);
    verifier(
      !!code2 && code2 !== code1 && monde.invitationsMembres.filter((x) => x.email === 'recrue-sens@exemple.invalid').map((x) => x.empreinte).join() === empreinte(code2),
      'nouvelle invitation : un nouveau code, qui remplace le précédent',
      monde.invitationsMembres,
    );
    monde.espaces[1].config = {};
    monde.emails = [];
    res = await inviter(gerantSens, 'ops-sens@exemple.invalid');
    verifier(res.statut === 409 && res.corps?.code === 'deja' && monde.emails.length === 0, 'membre déjà activé : pas de code, il se connecte', res.corps);
    res = await inviter(gerantSens, 'nouvelle_recrue@exemple.invalid');
    verifier(res.statut === 409 && res.corps?.code === 'membre' && monde.emails.length === 0, 'Sens : un membre de Label Maison n’est pas invité', res.corps);
    res = await inviter(gerantLM, 'recrue-sens@exemple.invalid');
    verifier(res.statut === 409 && monde.emails.length === 0, 'Label Maison : un membre de Sens n’est pas invité', res.corps);
    res = await inviter(gerantLM, 'inconnu@exemple.invalid');
    verifier(res.statut === 409 && res.corps?.code === 'membre' && /Ajoutez d’abord/.test(res.corps?.erreur ?? ''), 'adresse absente de l’équipe : refusée, aucun e-mail', res.corps);
    res = await inviter({ authorization: 'Bearer jeton-equipe', 'x-erp-espace': SENS }, 'recrue-sens@exemple.invalid');
    verifier(res.statut === 403, 'compte de Label Maison avec l’en-tête de Sens : refusé', res.statut);
    res = await inviter({ authorization: 'Bearer jeton-ops-sens', 'x-erp-espace': SENS }, 'recrue-sens@exemple.invalid');
    verifier(res.statut === 403, 'membre de Sens sans le rôle gérant : refusé', res.statut);
    res = await inviter(gerantLM, 'NOUVELLE_RECRUE@exemple.invalid');
    verifier(res.statut === 200 && res.corps?.envoye === true && monde.emails[0]?.from === env.CONTACT_FROM_EMAIL, 'Label Maison : son membre invité, e-mail de Label Maison', res.corps);
    monde.panneEspacesActifs = true;
    monde.emails = [];
    res = await inviter(gerantSens, 'recrue-sens@exemple.invalid');
    monde.panneEspacesActifs = false;
    verifier(res.statut === 200 && res.corps?.envoye === false && monde.emails.length === 0, 'fiche de Sens illisible : lien à copier, aucun e-mail', res.corps);
    delete env.RESEND_API_KEY;
    delete env.CONTACT_FROM_EMAIL;
  }

  section('Espace propriétaire : chaque accès dans l’espace qui invite');
  {
    monde.poser(SENS, 'proprietaires', { id: 'pro-s', nom: 'Sophie Sens', contact: { email: EMAIL_PROPRIO, telephone: '' } } as { id: string });
    monde.poser(SENS, 'logements', { id: 'log-s', nom: 'Chez Sophie', ville: 'Sens', statut: 'actif', proprietaireId: 'pro-s', capacite: 2, chambres: 1 } as { id: string });
    monde.poser(SENS, 'reservations', { id: 'res-s', logementId: 'log-s', canal: 'booking', voyageur: { nom: 'Zoé Sensible', nbPersonnes: 1 }, arrivee: '2099-02-10', depart: '2099-02-12', nuits: 2, statut: 'confirmee', montantBrutCentimes: 20000, commissionPlateformeCentimes: 3000, fraisMenageCentimes: 4000 } as { id: string });
    monde.oublier();
    let res = await appelProprio({ entetes: { authorization: 'Bearer jeton-equipe', 'x-erp-espace': SENS }, corps: { action: 'inviter', proprietaireId: 'pro-s', email: EMAIL_PROPRIO } });
    verifier(res.statut === 403, 'compte de Label Maison avec l’en-tête de Sens : invitation refusée', res.corps);
    res = await appelProprio({ entetes: { authorization: 'Bearer jeton-sens', 'x-erp-espace': SENS }, corps: { action: 'inviter', proprietaireId: 'pro-s', email: EMAIL_PROPRIO } });
    verifier(res.statut === 200 && String(res.corps?.lien).includes(`#espace=${SENS}&jeton=`) && res.corps?.envoye === false, 'gérant de Sens : lien de Sens (pas d’expéditeur pour Sens : lien à copier)', res.corps);
    const lienSens = String(res.corps?.lien);
    verifier(
      (monde.lignes.get(`${SENS}\u0000accesProprietaires\u0000pro-s`)?.donnees as { espace?: string } | undefined)?.espace === SENS && !monde.lignes.has(`${LM}\u0000accesProprietaires\u0000pro-s`) && monde.ecritures(LM).length === 0,
      'accès écrit dans Sens seulement',
    );
    res = await appelProprio({ corps: { action: 'entrer', jeton: jetonDuLien(lienSens), espace: LM } });
    verifier(res.statut === 401, 'lien de Sens présenté à Label Maison : refusé', res.corps);
    res = await appelProprio({ corps: { action: 'entrer', jeton: jetonDuLien(lienSens), espace: SENS } });
    const cookieSophie = cookieDe(res);
    verifier(res.statut === 200 && !!cookieSophie, 'lien de Sens : session ouverte', res.corps);
    res = await appelProprio({ methode: 'GET', query: { action: 'vue' }, entetes: { cookie: cookieSophie } });
    const texte = JSON.stringify(res.corps?.vue ?? {});
    verifier(res.statut === 200 && res.corps?.vue?.conciergerie?.nom === 'Sens' && res.corps?.vue?.logements?.map((l: { id: string }) => l.id).join() === 'log-s', 'propriétaire de Sens : son logement, au nom de Sens', res.corps);
    verifier(!/Alice|log-a|Bob|Label Maison|74954|labelmaisoncg/i.test(texte) && !res.corps?.vue?.contacts && /Zoé S\./.test(texte) && !/Sensible/.test(texte), 'rien de Label Maison (ni données, ni contacts), voyageur en « Prénom N. »', texte.slice(0, 300));
    // Document déposé dans Sens (dossier de Sens) : ouvert par un lien signé dans Sens, avec le compte serveur.
    const doc = (id: string, proprietaireId: string, fichier: string) =>
      ({ id, proprietaireId, categorie: 'contrat', titre: 'Mandat', fichier, nomFichier: 'm.pdf', ajouteLe: '2026-09-01T10:00:00.000Z', ajoutePar: 'g' }) as { id: string };
    monde.poser(SENS, 'documentsProprietaire', doc('doc-s', 'pro-s', `stockage://erp-fichiers/${SENS}/proprietaires/pro-s/m.pdf`));
    monde.oublier();
    res = await appelProprio({ methode: 'GET', query: { action: 'document', id: 'doc-s' }, entetes: { cookie: cookieSophie } });
    verifier(
      res.statut === 302 && /token=jeton-signe/.test(res.entetes.Location ?? '') && monde.stockage.length === 1 && monde.stockage[0].jeton === 'jeton-serveur' && monde.stockage[0].espace === SENS,
      'document de Sens : lien signé dans Sens (compte serveur, en-tête de Sens)',
      { statut: res.statut, texte: res.texte, stockage: monde.stockage },
    );
    // Un enregistrement de Sens qui pointe vers un fichier de Label Maison (et l'inverse) : jamais signé.
    monde.poser(SENS, 'documentsProprietaire', doc('doc-s-lm', 'pro-s', 'stockage://erp-fichiers/proprietaires/pro-a/x.pdf'));
    monde.poser(LM, 'documentsProprietaire', doc('doc-a-sens', 'pro-a', `stockage://erp-fichiers/${SENS}/proprietaires/pro-s/m.pdf`));
    monde.poser(LM, 'documentsProprietaire', doc('doc-a', 'pro-a', 'stockage://erp-fichiers/proprietaires/pro-a/x.pdf'));
    monde.oublier();
    res = await appelProprio({ methode: 'GET', query: { action: 'document', id: 'doc-s-lm' }, entetes: { cookie: cookieSophie } });
    const croiseSens = res.statut;
    res = await appelProprio({ methode: 'GET', query: { action: 'document', id: 'doc-a-sens' }, entetes: { cookie: cookieAlice } });
    verifier(croiseSens === 404 && res.statut === 404 && monde.stockage.length === 0, 'fichier d’un autre espace dans un document : « introuvable », jamais signé', { croiseSens, statut: res.statut, stockage: monde.stockage });
    res = await appelProprio({ methode: 'GET', query: { action: 'document', id: 'doc-a' }, entetes: { cookie: cookieAlice } });
    verifier(res.statut === 302 && monde.stockage.length === 1 && monde.stockage[0].jeton === 'jeton-equipe' && monde.stockage[0].espace === LM, 'document de Label Maison : compte d’équipe, comme avant', monde.stockage);
    // Logement de Sens avec sa photo déposée : signée dans Sens dans la vue du propriétaire.
    monde.poser(SENS, 'logements', { id: 'log-s', nom: 'Chez Sophie', ville: 'Sens', statut: 'actif', proprietaireId: 'pro-s', capacite: 2, chambres: 1, photoUrl: `stockage://erp-fichiers/${SENS}/logements/log-s/photos/a.jpg` } as { id: string });
    monde.oublier();
    res = await appelProprio({ methode: 'GET', query: { action: 'vue' }, entetes: { cookie: cookieSophie } });
    verifier(
      /token=jeton-signe/.test(res.corps?.vue?.logements?.[0]?.photo ?? '') && monde.stockage.every((x) => x.espace === SENS && x.jeton === 'jeton-serveur'),
      'photo du logement de Sens : signée dans Sens',
      { photo: res.corps?.vue?.logements?.[0]?.photo, stockage: monde.stockage },
    );
    verifier(res.corps?.vue?.conciergerie?.espace === SENS, 'vue : l’identifiant de l’espace (en-tête imprimé décidé par lui, pas par le nom)', res.corps?.vue?.conciergerie);
    res = await appelProprio({ methode: 'GET', query: { action: 'document', id: 'doc-inconnu' }, entetes: { cookie: cookieSophie } });
    verifier(res.statut === 404 && res.texte === 'Document introuvable.', 'document inconnu : « introuvable »', res.texte);
    res = await appelProprio({ methode: 'GET', query: { action: 'vue' }, entetes: { cookie: cookieAlice } });
    verifier(res.statut === 200 && res.corps?.vue?.logements?.map((l: { id: string }) => l.id).join() === 'log-a' && !/Sophie|log-s|Zoé/.test(JSON.stringify(res.corps?.vue)), 'propriétaire de Label Maison : rien de Sens', res.corps?.vue?.logements);
    // Cookie dont on change l'espace : la signature ne correspond plus.
    const [nom, valeur] = cookieSophie.split('=');
    const [corps, signature] = valeur.split('.');
    const charge = JSON.parse(Buffer.from(corps, 'base64url').toString()) as Record<string, unknown>;
    const falsifie = `${nom}=${Buffer.from(JSON.stringify({ ...charge, e: LM })).toString('base64url')}.${signature}`;
    res = await appelProprio({ methode: 'GET', query: { action: 'vue' }, entetes: { cookie: falsifie } });
    verifier(res.statut === 401, 'cookie dont l’espace est changé : refusé', res.statut);
    // « Recevoir mon lien » : la même adresse a un accès dans Label Maison et dans Sens.
    monde.oublier();
    res = await appelProprio({ corps: { action: 'lien', email: EMAIL_PROPRIO } });
    const liens = (e: string, id: string) => ((monde.lignes.get(`${e}\u0000accesProprietaires\u0000${id}`)?.donnees as { liens?: { motif: string }[] } | undefined)?.liens ?? []).filter((l) => l.motif === 'connexion').length;
    verifier(res.statut === 200 && liens(LM, 'pro-a') === 1 && liens(SENS, 'pro-s') === 1, 'demande de lien : un lien dans chaque espace où l’adresse a un accès', res.corps);
    const message = res.corps?.message;
    monde.oublier();
    res = await appelProprio({ corps: { action: 'lien', email: 'inconnu@exemple.invalid' } });
    verifier(res.statut === 200 && res.corps?.message === message && monde.base.every((r) => r.methode !== 'POST' || r.chemin !== 'enregistrements'), 'adresse inconnue : même réponse, rien d’écrit', res.corps);
  }

  section('Espace opérations : chaque accès dans l’espace qui invite');
  {
    monde.poser(SENS, 'equipe', { id: 'eq-s', nom: 'Samir Sens', role: 'agent', email: EMAIL_OPS, logementIds: ['log-s'], actif: true } as { id: string });
    let res = await appelOps({ entetes: { authorization: 'Bearer jeton-equipe', 'x-erp-espace': SENS }, corps: { action: 'inviter', membreId: 'eq-s', email: EMAIL_OPS } });
    verifier(res.statut === 403, 'opérations : compte de Label Maison avec l’en-tête de Sens, invitation refusée', res.corps);
    res = await appelOps({ entetes: { authorization: 'Bearer jeton-sens', 'x-erp-espace': SENS }, corps: { action: 'inviter', membreId: 'eq-s', email: EMAIL_OPS } });
    verifier(res.statut === 200 && String(res.corps?.lien).includes(`/espace-operations#espace=${SENS}&jeton=`) && res.corps?.envoye === false, 'opérations : gérant de Sens, lien de Sens à copier', res.corps);
    const lienSens = String(res.corps?.lien);
    verifier(!monde.lignes.has(`${LM}\u0000accesOperations\u0000eq-s`) && (monde.lignes.get(`${SENS}\u0000accesOperations\u0000eq-s`)?.donnees as { espace?: string } | undefined)?.espace === SENS, 'opérations : accès écrit dans Sens seulement');
    res = await appelOps({ corps: { action: 'entrer', jeton: jetonDuLien(lienSens), espace: LM } });
    verifier(res.statut === 401, 'opérations : lien de Sens présenté à Label Maison, refusé', res.corps);
    res = await appelOps({ corps: { action: 'entrer', jeton: jetonDuLien(lienSens), espace: SENS } });
    const cookieSamir = cookieDe(res);
    verifier(res.statut === 200 && !!cookieSamir, 'opérations : lien de Sens, session ouverte', res.corps);
    res = await appelOps({ methode: 'GET', query: { action: 'vue' }, entetes: { cookie: cookieSamir } });
    const texte = JSON.stringify(res.corps?.vue ?? {});
    verifier(res.statut === 200 && res.corps?.vue?.logements?.map((l: { id: string }) => l.id).join() === 'log-s' && res.corps?.vue?.conciergerie?.nom === 'Sens', 'opérations : son logement de Sens, au nom de Sens', res.corps?.vue?.logements);
    verifier(!/Alice|log-a|Agathe|Label Maison/.test(texte), 'opérations : rien de Label Maison', texte.slice(0, 200));
    res = await appelOps({ methode: 'GET', query: { action: 'vue' }, entetes: { cookie: cookieAgathe } });
    verifier(res.statut === 200 && !/log-s|Samir|Sophie/.test(JSON.stringify(res.corps?.vue ?? {})), 'opérations : la personne de Label Maison ne voit rien de Sens');
    const [nom, valeur] = cookieSamir.split('=');
    const [corps, signature] = valeur.split('.');
    const charge = JSON.parse(Buffer.from(corps, 'base64url').toString()) as Record<string, unknown>;
    res = await appelOps({ methode: 'GET', query: { action: 'vue' }, entetes: { cookie: `${nom}=${Buffer.from(JSON.stringify({ ...charge, e: LM })).toString('base64url')}.${signature}` } });
    verifier(res.statut === 401, 'opérations : cookie dont l’espace est changé, refusé', res.statut);
    monde.oublier();
    res = await appelOps({ corps: { action: 'lien', email: EMAIL_OPS } });
    const liens = (e: string, id: string) => ((monde.lignes.get(`${e}\u0000accesOperations\u0000${id}`)?.donnees as { liens?: { motif: string }[] } | undefined)?.liens ?? []).filter((l) => l.motif === 'connexion').length;
    verifier(res.statut === 200 && liens(LM, 'eq-a') === 1 && liens(SENS, 'eq-s') === 1, 'opérations : demande de lien, un lien dans chaque espace où l’adresse a un accès', res.corps);

    // Agir : la photo d'un autre dossier refusée, l'incident écrit dans Sens seulement, relu avant d'écrire.
    const signaler = (photos: string[]) =>
      appelOps({ entetes: { cookie: cookieSamir }, corps: { action: 'agir', operation: { type: 'signaler', logementId: 'log-s', urgent: false, description: 'Volet cassé dans la chambre.', photos } } });
    res = await signaler(['stockage://erp-fichiers/operations/eq-s/lqx1-abc123.jpg']);
    verifier(res.statut === 400, 'opérations : photo hors du dossier de Sens, refusée', res.corps);
    monde.oublier();
    res = await signaler([]);
    const idIncident = String(res.corps?.id ?? '');
    verifier(
      res.statut === 200 && !!idIncident && monde.lignes.has(`${SENS}\u0000incidents\u0000${idIncident}`) && !monde.lignes.has(`${LM}\u0000incidents\u0000${idIncident}`),
      'opérations : incident signalé, écrit dans Sens seulement',
      [...monde.lignes.keys()].filter((k) => k.includes('incidents')),
    );
    verifier(monde.base.some((r) => r.methode === 'GET' && r.chemin === 'enregistrements' && r.url.searchParams.get('collection') === 'eq.incidents' && !!r.url.searchParams.get('id')?.startsWith('in.')), 'opérations : l’incident est relu juste avant d’être écrit');

    // Photo prise dans Sens : déposée dans le dossier de Sens (compte serveur), puis acceptée avec l'incident.
    monde.oublier();
    res = await appelOps({ entetes: { cookie: cookieSamir }, corps: { action: 'photo', donnees: '/9j/4AAQSkZJRgABAQ==', type: 'image/jpeg' } });
    const photo = String(res.corps?.url ?? '');
    verifier(
      res.statut === 200 && photo.startsWith(`stockage://erp-fichiers/${SENS}/operations/eq-s/`) && /token=jeton-signe/.test(res.corps?.apercu ?? ''),
      'opérations : photo de Sens déposée dans le dossier de Sens, aperçu signé',
      res.corps,
    );
    verifier(monde.stockage.length === 2 && monde.stockage.every((x) => x.jeton === 'jeton-serveur' && x.espace === SENS), 'opérations : dépôt et aperçu avec le compte serveur et l’en-tête de Sens', monde.stockage);
    res = await signaler([photo]);
    verifier(res.statut === 200, 'opérations : la photo de Sens accompagne l’incident', res.corps?.erreur);
    res = await appelOps({ entetes: { cookie: cookieAgathe }, corps: { action: 'agir', operation: { type: 'signaler', logementId: 'log-a', urgent: false, description: 'Volet cassé dans la chambre.', photos: [photo] } } });
    verifier(res.statut === 400, 'opérations : la photo de Sens refusée dans Label Maison', res.corps);
  }

  section('Relances de paiement : chaque espace, son calendrier, son expéditeur');
  {
    env.RESEND_API_KEY = 're_test';
    env.CONTACT_FROM_EMAIL = 'Label Maison <bonjour@exemple.invalid>';
    monde.poser(SENS, 'factures', facture('fac-s', 'pro-s', 6));
    monde.poser(SENS, 'reglagesRelances', { id: 'relances', actif: true, mode: 'automatique', jours: [5, 15, 30] } as { id: string });
    monde.oublier();
    monde.emails = [];
    let res = reponse();
    await routeSynchro(requete({ entetes: { authorization: 'Bearer secret-cron' } }), res);
    verifier(relance(SENS, 'fac-s-r1')?.statut === 'proposee' && relance(SENS, 'fac-s-r1')?.motif === 'sans_expediteur', 'Sens, automatique sans expéditeur : la relance attend une validation', relance(SENS, 'fac-s-r1'));
    verifier(monde.emails.length === 0, 'passage quotidien : aucun e-mail (Label Maison « proposer », Sens sans expéditeur)', monde.emails);
    verifier(!monde.lignes.has(`${LM}\u0000relancesPaiement\u0000fac-s-r1`) && !monde.lignes.has(`${SENS}\u0000relancesPaiement\u0000fac-lm-r1`), 'relances rangées chacune dans son espace');
    const avant = [...monde.lignes.keys()].filter((k) => k.includes('relancesPaiement')).length;
    await routeSynchro(requete({ entetes: { authorization: 'Bearer secret-cron' } }), reponse());
    verifier([...monde.lignes.keys()].filter((k) => k.includes('relancesPaiement')).length === avant && monde.emails.length === 0, 'nouveau passage le même jour : rien de plus, rien d’envoyé');

    // Validation par un gérant : expéditeur de l'espace, une seule fois.
    const gerantLM = { authorization: 'Bearer jeton-equipe', 'x-erp-espace': LM };
    const gerantSens = { authorization: 'Bearer jeton-sens', 'x-erp-espace': SENS };
    res = await appelProprio({ entetes: gerantLM, corps: { action: 'relance-envoyer', id: 'fac-lm-r1' } });
    verifier(res.statut === 200 && monde.emails.length === 1 && monde.emails[0].from === env.CONTACT_FROM_EMAIL && monde.emails[0].to[0] === EMAIL_PROPRIO && /N-fac-lm/.test(monde.emails[0].subject), 'gérant de Label Maison : relance envoyée avec l’expéditeur de Label Maison', monde.emails);
    verifier(relance(LM, 'fac-lm-r1')?.statut === 'envoyee', 'relance notée envoyée');
    res = await appelProprio({ entetes: gerantLM, corps: { action: 'relance-envoyer', id: 'fac-lm-r1' } });
    verifier(res.statut === 409 && monde.emails.length === 1, 'deuxième envoi : refusé, jamais deux fois', res.corps);
    res = await appelProprio({ entetes: { ...gerantLM, 'x-erp-espace': SENS }, corps: { action: 'relance-envoyer', id: 'fac-s-r1' } });
    verifier(res.statut === 403, 'compte de Label Maison sur une relance de Sens : refusé', res.corps);
    res = await appelProprio({ entetes: gerantLM, corps: { action: 'relance-envoyer', id: 'fac-s-r1' } });
    verifier(res.statut === 409 && monde.emails.length === 1, 'relance de Sens demandée dans Label Maison : introuvable', res.corps);
    res = await appelProprio({ entetes: gerantSens, corps: { action: 'relance-envoyer', id: 'fac-s-r1' } });
    verifier(res.statut === 409 && monde.emails.length === 1 && relance(SENS, 'fac-s-r1')?.statut === 'proposee', 'Sens sans expéditeur : rien ne part (jamais celui de Label Maison)', res.corps);
    monde.espaces[1].config = { ...monde.espaces[1].config, email: { expediteur: 'Sens <bonjour@sens.invalid>' } };
    res = await appelProprio({ entetes: gerantSens, corps: { action: 'relance-envoyer', id: 'fac-s-r1' } });
    const mailSens = monde.emails[1];
    verifier(res.statut === 200 && mailSens?.from === 'Sens <bonjour@sens.invalid>' && /Sens/.test(mailSens.text) && !/Label Maison/.test(mailSens.text), 'Sens avec son expéditeur : envoyée en son nom', mailSens);
    res = await appelProprio({ methode: 'GET', query: { action: 'relances' }, entetes: gerantSens });
    verifier(res.statut === 200 && res.corps?.relances?.every((r: { factureId: string }) => r.factureId === 'fac-s') && res.corps?.reglages?.mode === 'automatique', 'liste des relances : celles de l’espace seulement', res.corps);

    // Automatique avec expéditeur : envoyée au passage, une seule fois.
    monde.poser(LM, 'reglagesRelances', { id: 'relances', actif: true, mode: 'automatique', jours: [5, 15, 30] } as { id: string });
    monde.poser(LM, 'factures', facture('fac-lm3', 'pro-a', 7));
    await routeSynchro(requete({ entetes: { authorization: 'Bearer secret-cron' } }), reponse());
    verifier(relance(LM, 'fac-lm3-r1')?.statut === 'envoyee' && relance(LM, 'fac-lm3-r1')?.envoyeePar === 'automatique' && monde.emails.length === 3, 'Label Maison automatique : envoyée au passage', monde.emails.length);
    await routeSynchro(requete({ entetes: { authorization: 'Bearer secret-cron' } }), reponse());
    verifier(monde.emails.length === 3, 'passage suivant : jamais renvoyée');

    // Arrêt au paiement.
    monde.poser(LM, 'reglagesRelances', { id: 'relances', actif: true, mode: 'proposer', jours: [5, 15, 30] } as { id: string });
    monde.poser(LM, 'factures', facture('fac-lm2', 'pro-a', 20));
    await routeSynchro(requete({ entetes: { authorization: 'Bearer secret-cron' } }), reponse());
    verifier(relance(LM, 'fac-lm2-r2')?.statut === 'proposee' && !relance(LM, 'fac-lm2-r1'), '20 jours de retard : seule l’étape J+15 est proposée');
    monde.poser(LM, 'factures', facture('fac-lm2', 'pro-a', 20, { statut: 'payee', payeeLe: ilYa(1) }));
    await routeSynchro(requete({ entetes: { authorization: 'Bearer secret-cron' } }), reponse());
    res = await appelProprio({ entetes: gerantLM, corps: { action: 'relance-envoyer', id: 'fac-lm2-r2' } });
    verifier(relance(LM, 'fac-lm2-r2')?.statut === 'sans_objet' && res.statut === 409 && monde.emails.length === 3, 'facture payée : relance sans objet, rien ne part', relance(LM, 'fac-lm2-r2'));

    // Ce que voit le propriétaire : ses factures partagées, le dernier rappel.
    res = await appelProprio({ methode: 'GET', query: { action: 'vue' }, entetes: { cookie: cookieAlice } });
    const factures = (res.corps?.vue?.factures ?? []) as { id: string; dernierRappel?: string }[];
    verifier(factures.some((f) => f.id === 'fac-lm' && !!f.dernierRappel) && !factures.some((f) => f.id === 'fac-s'), 'propriétaire de Label Maison : ses factures et leurs rappels, rien de Sens', factures);
    delete env.RESEND_API_KEY;
    delete env.CONTACT_FROM_EMAIL;
  }

  section('Audit des accès extérieurs (octobre 2026)');
  {
    env.RESEND_API_KEY = 're_test';
    env.CONTACT_FROM_EMAIL = 'Label Maison <bonjour@exemple.invalid>';
    const PIRATE = 'https://labelmaisonconciergerie-pirate.vercel.app';
    const APERCU = 'https://labelmaisonconciergerie-apercu-1.vercel.app';
    const gerantLM = { authorization: 'Bearer jeton-equipe', 'x-erp-espace': LM };
    const lienDuMail = (m?: { text: string }) => /Ouvrir mon espace : (\S+)/.exec(m?.text ?? '')?.[1] ?? '';
    const depuis = (origin: string, ip: string) => ({ origin, 'x-forwarded-for': ip });

    // B1 : origines acceptées, site des liens.
    verifier(SITE_PAR_DEFAUT === 'https://www.labelmaisoncg.fr' && adresseSite() === SITE_PAR_DEFAUT, 'site des liens : https://www.labelmaisoncg.fr par défaut', adresseSite());
    env.SITE_URL = 'https://site.exemple.invalid/chemin';
    const avecVariable = adresseSite();
    env.SITE_URL = 'http://site.exemple.invalid';
    const enHttp = adresseSite();
    delete env.SITE_URL;
    verifier(avecVariable === 'https://site.exemple.invalid' && enHttp === SITE_PAR_DEFAUT, 'SITE_URL : origine https seulement', [avecVariable, enHttp]);
    verifier(
      !origineAutorisee(PIRATE) && !origineAutorisee('https://labelmaisoncg.fr.pirate.example') && !origineAutorisee('http://labelmaisoncg.fr') && !origineAutorisee('null') && !origineAutorisee(''),
      'origines : plus de *.vercel.app, ni sous-domaine piégé, ni http, ni « null »',
    );
    verifier(['https://labelmaisoncg.fr', 'https://www.labelmaisoncg.fr', 'https://www.labelmaisoncgexperience.fr', 'https://www.labelmaisoncg.fr/espace-proprietaire?x=1'].every(origineAutorisee), 'origines : le site (avec ou sans www, ou une page)');
    verifier(!origineAutorisee(APERCU), 'aperçu Vercel : refusé sans ORIGINES_APERCU');
    env.ORIGINES_APERCU = `${APERCU}, https://autre-apercu.vercel.app`;
    verifier(origineAutorisee(APERCU) && !origineAutorisee(`${APERCU}.pirate.example`) && !origineAutorisee(PIRATE), 'ORIGINES_APERCU : origines exactes seulement');
    env.VERCEL_ENV = 'production';
    const localEnLigne = origineAutorisee('http://localhost:5173');
    delete env.VERCEL_ENV;
    verifier(!localEnLigne && origineAutorisee('http://localhost:5173'), 'localhost : jamais sur Vercel en ligne, permis en local');

    // B1 : l'invitation demandée depuis une page tierce garde le site fixe.
    monde.poser(LM, 'proprietaires', { id: 'pro-c', nom: 'Carla Audit', contact: { email: 'carla@exemple.invalid', telephone: '' } } as { id: string });
    monde.poser(LM, 'logements', { id: 'log-c', nom: 'Chez Carla', ville: 'Évry', statut: 'actif', proprietaireId: 'pro-c', capacite: 2, chambres: 1 } as { id: string });
    monde.emails = [];
    let res = await appelProprio({ entetes: { ...gerantLM, origin: PIRATE }, corps: { action: 'inviter', proprietaireId: 'pro-c', email: 'carla@exemple.invalid' } });
    verifier(res.statut === 200 && String(res.corps?.lien).startsWith(`${SITE_PAR_DEFAUT}/espace-proprietaire#espace=${LM}&jeton=`) && lienDuMail(monde.emails[0]).startsWith(`${SITE_PAR_DEFAUT}/`), 'invitation appelée avec une Origin tierce : lien et e-mail sur le site fixe', { lien: String(res.corps?.lien).replace(/jeton=.*/, 'jeton=…'), mail: lienDuMail(monde.emails[0]).replace(/jeton=.*/, 'jeton=…') });
    verifier((monde.lignes.get(`${LM}\u0000accesProprietaires\u0000pro-c`)?.donnees as { emailFiche?: string } | undefined)?.emailFiche === 'carla@exemple.invalid', 'invitation : adresse de la fiche relevée dans l’accès');
    verifier(/vos factures partagées/.test(monde.emails[0]?.text ?? ''), 'e-mail d’invitation : il parle aussi des factures', monde.emails[0]?.text);
    const lienInvitation = String(res.corps?.lien);
    res = await appelProprio({ entetes: depuis(PIRATE, '198.51.100.1'), corps: { action: 'entrer', jeton: jetonDuLien(lienInvitation), espace: LM } });
    verifier(res.statut === 403 && !res.entetes['Set-Cookie'], 'entrer depuis une Origin tierce : refusé, pas de session', res.corps);
    res = await appelProprio({ entetes: depuis(PIRATE, '198.51.100.2'), corps: { action: 'lien', email: 'carla@exemple.invalid' } });
    verifier(res.statut === 403, '« Recevoir mon lien » depuis une Origin tierce : refusé', res.corps);
    monde.emails = [];
    res = await appelProprio({ entetes: depuis(APERCU, '198.51.100.3'), corps: { action: 'lien', email: 'carla@exemple.invalid' } });
    verifier(res.statut === 200 && monde.emails.length === 1 && lienDuMail(monde.emails[0]).startsWith(`${SITE_PAR_DEFAUT}/espace-proprietaire#`), 'demande depuis un aperçu autorisé : le lien reste sur le site fixe', lienDuMail(monde.emails[0]).replace(/jeton=.*/, 'jeton=…'));
    const lienCarla = lienDuMail(monde.emails[0]);

    // Minor 4 : un lien de connexion toutes les 2 minutes au plus, gardé dans l'accès.
    const nbConnexion = (e: string, c: string, id: string) => ((monde.lignes.get(`${e}\u0000${c}\u0000${id}`)?.donnees as { liens?: { motif: string }[] } | undefined)?.liens ?? []).filter((l) => l.motif === 'connexion').length;
    monde.emails = [];
    res = await appelProprio({ entetes: depuis('https://www.labelmaisoncg.fr', '198.51.100.4'), corps: { action: 'lien', email: 'carla@exemple.invalid' } });
    verifier(res.statut === 200 && monde.emails.length === 0 && nbConnexion(LM, 'accesProprietaires', 'pro-c') === 1, 'deuxième demande dans les 2 minutes (autre adresse IP) : même réponse, aucun lien de plus', { emails: monde.emails.length, liens: nbConnexion(LM, 'accesProprietaires', 'pro-c') });

    // A5 : le même lien présenté deux fois en même temps.
    const [e1, e2] = await Promise.all([
      appelProprio({ entetes: depuis('https://www.labelmaisoncg.fr', '198.51.100.5'), corps: { action: 'entrer', jeton: jetonDuLien(lienCarla), espace: LM } }),
      appelProprio({ entetes: depuis('https://www.labelmaisoncg.fr', '198.51.100.6'), corps: { action: 'entrer', jeton: jetonDuLien(lienCarla), espace: LM } }),
    ]);
    verifier([e1.statut, e2.statut].sort().join() === '200,401' && [e1, e2].filter((r) => !!r.entetes['Set-Cookie']).length === 1, 'lien à usage unique présenté deux fois en même temps : une seule session', [e1.statut, e2.statut]);
    const cookieCarla = cookieDe(e1.statut === 200 ? e1 : e2);
    res = await appelProprio({ corps: { action: 'entrer', jeton: jetonDuLien(lienCarla), espace: LM } });
    verifier(res.statut === 401 && res.corps?.code === 'utilise', 'troisième usage : refusé (déjà servi)', res.corps);
    res = await appelProprio({ corps: { action: 'entrer', jeton: jetonDuLien(lienInvitation), espace: LM } });
    verifier(res.statut === 200, 'l’invitation, autre lien, sert encore une fois (rien écrasé par la demande de lien)', res.corps);

    // I3 : l'adresse de la fiche fait foi (propriétaire).
    res = await appelProprio({ methode: 'GET', query: { action: 'vue' }, entetes: { cookie: cookieCarla } });
    verifier(res.statut === 200, 'session de Carla ouverte', res.statut);
    monde.poser(LM, 'proprietaires', { id: 'pro-c', nom: 'Carla Audit', contact: { email: 'nouvelle-gerance@exemple.invalid', telephone: '' } } as { id: string });
    res = await appelProprio({ methode: 'GET', query: { action: 'vue' }, entetes: { cookie: cookieCarla } });
    verifier(res.statut === 401, 'adresse changée dans la fiche du propriétaire sans « Retirer » : session refusée', res.statut);
    monde.emails = [];
    monde.poser(LM, 'accesProprietaires', { ...(monde.lignes.get(`${LM}\u0000accesProprietaires\u0000pro-c`)!.donnees as object), liens: [] } as { id: string });
    res = await appelProprio({ entetes: depuis('https://www.labelmaisoncg.fr', '198.51.100.7'), corps: { action: 'lien', email: 'carla@exemple.invalid' } });
    verifier(res.statut === 200 && monde.emails.length === 0 && nbConnexion(LM, 'accesProprietaires', 'pro-c') === 0, 'l’ancienne adresse ne reçoit plus de lien de connexion', monde.emails.map((m) => m.to));
    monde.poser(LM, 'proprietaires', { id: 'pro-c', nom: 'Carla Audit', contact: { email: 'Carla@Exemple.invalid ', telephone: '' } } as { id: string });
    res = await appelProprio({ methode: 'GET', query: { action: 'vue' }, entetes: { cookie: cookieCarla } });
    verifier(res.statut === 200, 'adresse remise dans la fiche (casse et espaces mis à part) : session valable', res.statut);
    verifier(res.corps?.espace === LM, 'vue : l’espace est donné (la page de connexion le garde sur l’appareil)', res.corps?.espace);
    // « Retirer » : la page le dit, au lieu de « session expirée ».
    await appelProprio({ entetes: gerantLM, corps: { action: 'retirer', proprietaireId: 'pro-c' } });
    res = await appelProprio({ methode: 'GET', query: { action: 'vue' }, entetes: { cookie: cookieCarla } });
    verifier(res.statut === 401 && res.corps?.code === 'retire' && res.corps?.erreur === 'Votre accès a été retiré. Contactez votre conciergerie.' && /Max-Age=0/.test(res.entetes['Set-Cookie'] ?? ''), 'accès retiré : « Votre accès a été retiré », cookie effacé', res.corps);
    res = await appelProprio({ methode: 'GET', query: { action: 'vue' }, entetes: { cookie: cookieCarla } });
    verifier(res.statut === 401 && res.corps?.code === 'retire', 'accès retiré : toujours dit tant que le cookie revient', res.corps);
    res = await appelProprio({ methode: 'GET', query: { action: 'vue' } });
    verifier(res.statut === 401 && res.corps?.code === 'session', 'sans cookie : « Connectez-vous »', res.corps);

    // I3 : règle pure, accès d'avant le relevé compris.
    const a = (o: Partial<AccesExterne>): AccesExterne => ({ id: 'x', email: 'a@x.invalid', statut: 'actif', version: 1, liens: [], ...o });
    verifier(
      accesToujoursDeLaFiche(a({}), { email: 'a@x.invalid' }) &&
        accesToujoursDeLaFiche(a({}), { email: '' }) &&
        !accesToujoursDeLaFiche(a({}), { email: 'b@x.invalid' }) &&
        !accesToujoursDeLaFiche(a({}), undefined) &&
        accesToujoursDeLaFiche(a({ emailFiche: 'f@x.invalid' }), { email: 'f@x.invalid' }) &&
        !accesToujoursDeLaFiche(a({ emailFiche: 'f@x.invalid' }), { email: '' }) &&
        !accesToujoursDeLaFiche(a({ emailFiche: '' }), { email: 'b@x.invalid' }) &&
        accesToujoursDeLaFiche(a({ emailFiche: '' }), { email: 'A@X.invalid' }),
      'règle de la fiche : même adresse, adresse relevée, accès ancien sans adresse de fiche ; fiche absente = non',
    );

    // I3 : même chose pour l'espace opérations (A2 de l'audit).
    monde.poser(LM, 'equipe', { id: 'eq-c', nom: 'Chloé Course', role: 'agent', email: 'chloe@exemple.invalid', logementIds: ['log-a'], actif: true } as { id: string });
    res = await appelOps({ entetes: gerantLM, corps: { action: 'inviter', membreId: 'eq-c', email: 'chloe@exemple.invalid' } });
    verifier(res.statut === 200 && String(res.corps?.lien).startsWith(`${SITE_PAR_DEFAUT}/espace-operations#`), 'opérations : lien d’invitation sur le site fixe', String(res.corps?.lien).replace(/jeton=.*/, 'jeton=…'));
    const lienChloe = String(res.corps?.lien);
    const [o1, o2] = await Promise.all([appelOps({ corps: { action: 'entrer', jeton: jetonDuLien(lienChloe), espace: LM } }), appelOps({ corps: { action: 'entrer', jeton: jetonDuLien(lienChloe), espace: LM } })]);
    verifier([o1.statut, o2.statut].sort().join() === '200,401', 'opérations : lien présenté deux fois en même temps, une seule session', [o1.statut, o2.statut]);
    const cookieChloe = cookieDe(o1.statut === 200 ? o1 : o2);
    monde.poser(LM, 'equipe', { id: 'eq-c', nom: 'Chloé Course', role: 'agent', email: 'remplacante@exemple.invalid', logementIds: ['log-a'], actif: true } as { id: string });
    res = await appelOps({ methode: 'GET', query: { action: 'vue' }, entetes: { cookie: cookieChloe } });
    verifier(res.statut === 401, 'opérations : adresse changée dans la fiche équipe, session refusée', res.statut);
    monde.emails = [];
    res = await appelOps({ entetes: depuis('https://www.labelmaisoncg.fr', '198.51.100.8'), corps: { action: 'lien', email: 'chloe@exemple.invalid' } });
    verifier(res.statut === 200 && monde.emails.length === 0, 'opérations : l’ancienne adresse ne reçoit plus de lien', monde.emails.map((m) => m.to));
    res = await appelOps({ entetes: depuis(PIRATE, '198.51.100.9'), corps: { action: 'lien', email: EMAIL_OPS } });
    verifier(res.statut === 403, 'opérations : « Recevoir mon lien » depuis une Origin tierce, refusé', res.corps);

    // A3 : fiche d'espace introuvable, jamais l'expéditeur ni les contacts de Label Maison.
    verifier(expediteurEspace(undefined) === undefined && contactsEspace(undefined) === undefined, 'fiche d’espace absente : ni expéditeur ni contacts de Label Maison', expediteurEspace(undefined));
    verifier(expediteurEspace(undefined, LM)?.from === env.CONTACT_FROM_EMAIL && !!contactsEspace(undefined, LM) && expediteurEspace(undefined, SENS) === undefined, 'fiche illisible mais espace explicitement Label Maison : Label Maison ; Sens : rien');
    monde.poser(SENS, 'equipe', { id: 'eq-s2', nom: 'Sacha Sens', role: 'agent', email: 'sacha@exemple.invalid', logementIds: ['log-s'], actif: true } as { id: string });
    monde.emails = [];
    monde.panneEspacesActifs = true;
    res = await appelOps({ entetes: { authorization: 'Bearer jeton-sens', 'x-erp-espace': SENS }, corps: { action: 'inviter', membreId: 'eq-s2', email: 'sacha@exemple.invalid' } });
    monde.panneEspacesActifs = false;
    verifier(res.statut === 200 && res.corps?.envoye === false && monde.emails.length === 0, 'panne de la fiche de Sens pendant une invitation : aucun e-mail au nom de Label Maison (lien à copier)', { envoye: res.corps?.envoye, mails: monde.emails.map((m) => m.from) });

    // A4 : deux validations simultanées d'une même relance.
    monde.poser(LM, 'factures', facture('fac-x', 'pro-a', 6));
    monde.poser(LM, 'relancesPaiement', { id: 'fac-x-r1', factureId: 'fac-x', proprietaireId: 'pro-a', numero: 'N-fac-x', niveau: 1, joursApresEcheance: 5, dueLe: ilYa(1), statut: 'proposee', creeLe: new Date().toISOString() } as { id: string });
    monde.emails = [];
    const [r1, r2] = await Promise.all([appelProprio({ entetes: gerantLM, corps: { action: 'relance-envoyer', id: 'fac-x-r1' } }), appelProprio({ entetes: gerantLM, corps: { action: 'relance-envoyer', id: 'fac-x-r1' } })]);
    verifier(monde.emails.length === 1 && [r1.statut, r2.statut].sort().join() === '200,409' && relance(LM, 'fac-x-r1')?.statut === 'envoyee', 'relance validée deux fois en même temps : un seul e-mail', { statuts: [r1.statut, r2.statut], emails: monde.emails.length });
    verifier(/https:\/\/www\.labelmaisoncg\.fr\/espace-proprietaire/.test(monde.emails[0]?.text ?? ''), 'lien des relances : site fixe', monde.emails[0]?.text);
    monde.poser(LM, 'relancesPaiement', { id: 'fac-x-r2', factureId: 'fac-x', proprietaireId: 'pro-a', numero: 'N-fac-x', niveau: 2, joursApresEcheance: 15, dueLe: ilYa(1), statut: 'proposee', creeLe: new Date().toISOString() } as { id: string });
    monde.emails = [];
    const [r3, r4] = await Promise.all([appelProprio({ entetes: gerantLM, corps: { action: 'relance-annuler', id: 'fac-x-r2' } }), appelProprio({ entetes: gerantLM, corps: { action: 'relance-envoyer', id: 'fac-x-r2' } })]);
    const fin = relance(LM, 'fac-x-r2')?.statut;
    verifier([r3.statut, r4.statut].sort().join() === '200,409' && ((fin === 'annulee' && monde.emails.length === 0) || (fin === 'envoyee' && monde.emails.length === 1)), 'annuler et envoyer en même temps : l’un ou l’autre, jamais « annulée » avec un e-mail parti', { statuts: [r3.statut, r4.statut], fin, emails: monde.emails.length });

    // Minor 6 : facture voyageur rattachée au propriétaire, jamais partagée ni relancée.
    monde.poser(LM, 'factures', facture('fac-v', 'pro-a', 6, { destinataire: 'voyageur' }));
    await relancesDuJour();
    res = await appelProprio({ methode: 'GET', query: { action: 'vue' }, entetes: { cookie: cookieAlice } });
    verifier(!relance(LM, 'fac-v-r1') && !((res.corps?.vue?.factures ?? []) as { id: string }[]).some((f) => f.id === 'fac-v'), 'facture voyageur : ni montrée au propriétaire ni relancée', res.corps?.vue?.factures);

    // Minor 5 : ids encodés dans l'adresse de lecture.
    monde.oublier();
    await baseAcces(LM).lire('recette', ['a&b=c', 'd#e', 'f+g']);
    const lecture = monde.base.find((r) => r.methode === 'GET' && r.url.searchParams.get('collection') === 'eq.recette');
    verifier(lecture?.url.searchParams.get('id') === 'in.("a&b=c","d#e","f+g")' && !lecture?.url.searchParams.has('b'), 'lecture par ids : « & », « # », « + » encodés', lecture?.url.search);
    delete env.ORIGINES_APERCU;
    delete env.RESEND_API_KEY;
    delete env.CONTACT_FROM_EMAIL;
  }

  section('Adresse changée dans la fiche : seule la nouvelle est invitée (B2)');
  {
    env.RESEND_API_KEY = 're_test';
    env.CONTACT_FROM_EMAIL = 'Label Maison <bonjour@exemple.invalid>';
    const gerant = { authorization: 'Bearer jeton-equipe', 'x-erp-espace': LM };
    const site = (ip: string) => ({ origin: 'https://www.labelmaisoncg.fr', 'x-forwarded-for': ip });
    const ANCIENNE = 'ancienne@exemple.invalid';
    const NOUVELLE = 'nouvelle@exemple.invalid';
    for (const genre of ['proprietaire', 'operations'] as const) {
      const appel = genre === 'proprietaire' ? appelProprio : appelOps;
      const collection = genre === 'proprietaire' ? 'accesProprietaires' : 'accesOperations';
      const id = genre === 'proprietaire' ? 'pro-z' : 'eq-z';
      const fiche = (email: string) =>
        genre === 'proprietaire'
          ? monde.poser(LM, 'proprietaires', { id, nom: 'Zoé Partie', contact: { email, telephone: '' } } as { id: string })
          : monde.poser(LM, 'equipe', { id, nom: 'Zoé Partie', role: 'agent', email, logementIds: ['log-z'], actif: true } as { id: string });
      const inviter = (email: string) => appel({ entetes: gerant, corps: { action: 'inviter', ...(genre === 'proprietaire' ? { proprietaireId: id } : { membreId: id }), email } });
      const acces = () => monde.lignes.get(`${LM}\u0000${collection}\u0000${id}`)?.donnees as { email?: string; version?: number } | undefined;
      monde.poser(LM, 'logements', { id: 'log-z', nom: 'Chez Zoé', ville: 'Évry', statut: 'actif', proprietaireId: 'pro-z', capacite: 2, chambres: 1 } as { id: string });
      fiche(ANCIENNE);
      let res = await inviter(ANCIENNE);
      res = await appel({ entetes: site(genre === 'proprietaire' ? '198.51.100.61' : '198.51.100.62'), corps: { action: 'entrer', jeton: jetonDuLien(res.corps?.lien), espace: LM } });
      const cookieAncien = cookieDe(res);
      res = await appel({ methode: 'GET', query: { action: 'vue' }, entetes: { cookie: cookieAncien } });
      verifier(res.statut === 200, `${genre} : session ouverte avec l’ancienne adresse`, res.corps);
      const versionAvant = acces()?.version ?? 0;

      fiche(NOUVELLE);
      res = await appel({ methode: 'GET', query: { action: 'vue' }, entetes: { cookie: cookieAncien } });
      verifier(res.statut === 401, `${genre} : adresse changée dans la fiche, l’ancienne session tombe`, res.statut);
      monde.emails = [];
      res = await inviter(ANCIENNE);
      verifier(res.statut === 409 && res.corps?.code === 'fiche' && monde.emails.length === 0 && acces()?.email === ANCIENNE && acces()?.version === versionAvant, `${genre} : réinviter l’ancienne adresse est refusé, rien n’est envoyé`, res.corps);
      res = await appel({ methode: 'GET', query: { action: 'vue' }, entetes: { cookie: cookieAncien } });
      verifier(res.statut === 401, `${genre} : l’ancienne session reste fermée`, res.statut);
      res = await inviter(NOUVELLE);
      verifier(
        res.statut === 200 && acces()?.email === NOUVELLE && (acces()?.version ?? 0) > versionAvant && monde.emails.length === 1 && monde.emails[0].to[0] === NOUVELLE,
        `${genre} : la nouvelle adresse est invitée, version changée, lien envoyé à elle seule`,
        { statut: res.statut, acces: acces(), to: monde.emails.map((m) => m.to) },
      );
      res = await appel({ methode: 'GET', query: { action: 'vue' }, entetes: { cookie: cookieAncien } });
      verifier(res.statut === 401, `${genre} : l’ancienne session ne revient pas après la nouvelle invitation`, res.statut);

      // Accès retiré par le gérant : la personne le lit tel quel (pas « session expirée »).
      const lienNouveau = /Ouvrir mon espace : (\S+)/.exec(monde.emails[0]?.text ?? '')?.[1] ?? '';
      res = await appel({ entetes: site(genre === 'proprietaire' ? '198.51.100.63' : '198.51.100.64'), corps: { action: 'entrer', jeton: jetonDuLien(lienNouveau), espace: LM } });
      const cookieNouveau = cookieDe(res);
      res = await appel({ methode: 'GET', query: { action: 'vue' }, entetes: { cookie: cookieNouveau } });
      verifier(res.statut === 200 && (genre === 'proprietaire' || res.corps?.espace === LM), `${genre} : la nouvelle adresse ouvre son espace (espace rendu pour la page de connexion)`, res.statut);
      await appel({ entetes: gerant, corps: { action: 'retirer', ...(genre === 'proprietaire' ? { proprietaireId: id } : { membreId: id }) } });
      res = await appel({ methode: 'GET', query: { action: 'vue' }, entetes: { cookie: cookieNouveau } });
      verifier(res.statut === 401 && res.corps?.code === 'retire' && res.corps?.erreur === 'Votre accès a été retiré. Contactez votre conciergerie.', `${genre} : accès retiré, dit tel quel`, res.corps);
    }
    delete env.RESEND_API_KEY;
    delete env.CONTACT_FROM_EMAIL;
  }

  section('App « Opérations » : notifications de l’équipe (Web Push)');
  {
    const vapid = await genererClesVapid();
    env.VAPID_PUBLIC_KEY = vapid.publique;
    env.VAPID_PRIVATE_KEY = vapid.privee;
    const gerantLM = { authorization: 'Bearer jeton-equipe', 'x-erp-espace': LM };
    const gerantSens = { authorization: 'Bearer jeton-sens', 'x-erp-espace': SENS };
    const aujourdhui = dateParisISO();
    monde.poser(LM, 'logements', { id: 'log-n', nom: 'Le Nid', ville: 'Évry', statut: 'actif', proprietaireId: 'pro-a', capacite: 2, chambres: 1 } as { id: string });
    monde.poser(LM, 'equipe', { id: 'eq-p', nom: 'Paula Pôle', role: 'pole', email: 'paula@exemple.invalid', logementIds: ['log-n'], actif: true } as { id: string });
    monde.poser(LM, 'equipe', { id: 'eq-g', nom: 'Gaspard Agent', role: 'agent', email: 'gaspard@exemple.invalid', logementIds: ['log-n'], actif: true } as { id: string });
    monde.poser(LM, 'affectations', { id: 'log-n', responsableId: 'eq-g' } as { id: string });
    monde.poser(SENS, 'logements', { id: 'log-n2', nom: 'Chez Sens', ville: 'Sens', statut: 'actif', proprietaireId: 'pro-s', capacite: 2, chambres: 1 } as { id: string });
    monde.poser(SENS, 'equipe', { id: 'eq-t', nom: 'Théo Sens', role: 'pole', email: 'theo@exemple.invalid', logementIds: ['log-n2'], actif: true } as { id: string });
    const connecter = async (gerant: Record<string, string>, membreId: string, email: string, ip: string) => {
      const inv = await appelOps({ entetes: gerant, corps: { action: 'inviter', membreId, email } });
      return cookieDe(await appelOps({ entetes: { 'x-forwarded-for': ip }, corps: { action: 'entrer', jeton: jetonDuLien(inv.corps?.lien), espace: gerant['x-erp-espace'] } }));
    };
    const cPaula = await connecter(gerantLM, 'eq-p', 'paula@exemple.invalid', '198.51.100.81');
    const cGaspard = await connecter(gerantLM, 'eq-g', 'gaspard@exemple.invalid', '198.51.100.82');
    const cTheo = await connecter(gerantSens, 'eq-t', 'theo@exemple.invalid', '198.51.100.83');
    verifier([cPaula, cGaspard, cTheo].every((c) => c.startsWith('lm_operations=')), 'trois personnes connectées (deux à Label Maison, une à Sens)');

    // Faux téléphones : une paire ECDH chacun, pour relire ce qui arrive (RFC 8291).
    const subtle = globalThis.crypto.subtle;
    const T = (o: Uint8Array) => o as unknown as BufferSource;
    const enc = (t: string) => new TextEncoder().encode(t);
    const ECDH = { name: 'ECDH', namedCurve: 'P-256' } as const;
    const telephones = new Map<string, (c: Uint8Array) => Promise<{ titre: string; corps: string; url: string; tag: string }>>();
    const telephone = async (nom: string) => {
      const paire = (await subtle.generateKey(ECDH, true, ['deriveBits'])) as CryptoKeyPair;
      const pub = new Uint8Array(await subtle.exportKey('raw', paire.publicKey));
      const auth = globalThis.crypto.getRandomValues(new Uint8Array(16));
      const endpoint = `https://fcm.googleapis.com/fcm/send/${nom}`;
      const h = async (ikm: Uint8Array, salt: Uint8Array, info: Uint8Array, n: number) =>
        new Uint8Array(await subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: T(salt), info: T(info) }, await subtle.importKey('raw', T(ikm), 'HKDF', false, ['deriveBits']), n * 8));
      telephones.set(endpoint, async (c) => {
        const sel = c.slice(0, 16);
        const as = c.slice(21, 86);
        const secret = new Uint8Array(await subtle.deriveBits({ name: 'ECDH', public: await subtle.importKey('raw', T(as), ECDH, false, []) }, paire.privateKey, 256));
        const ikm = await h(secret, auth, new Uint8Array([...enc('WebPush: info\0'), ...pub, ...as]), 32);
        const cek = await subtle.importKey('raw', T(await h(ikm, sel, enc('Content-Encoding: aes128gcm\0'), 16)), 'AES-GCM', false, ['decrypt']);
        const clair = new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: T(await h(ikm, sel, enc('Content-Encoding: nonce\0'), 12)) }, cek, T(c.slice(86))));
        return JSON.parse(new TextDecoder().decode(clair.slice(0, -1)));
      });
      return { endpoint, keys: { p256dh: Buffer.from(pub).toString('base64url'), auth: Buffer.from(auth).toString('base64url') } };
    };
    const recus = () =>
      Promise.all(monde.pushs.map(async (p) => ({ qui: p.endpoint.split('/').pop() ?? '', urgence: p.urgence, vapid: p.vapid, ...(await telephones.get(p.endpoint)!(p.corps)) })));
    const telPaula = await telephone('paula');
    const telGaspard = await telephone('gaspard');
    const telTheo = await telephone('theo');

    // Abonnement : session de l'espace, même site seulement, rangé dans l'espace de la personne.
    let res = reponse();
    await routeOperations(requete({ entetes: { cookie: cPaula }, corps: { action: 'notifications-abonner', abonnement: telPaula } }), res);
    verifier(res.statut === 403, 'abonner sans venir du site : refusé', res.corps);
    res = await appelOps({ corps: { action: 'notifications-abonner', abonnement: telPaula } });
    verifier(res.statut === 401, 'abonner sans session : refusé', res.statut);
    res = await appelOps({ entetes: { cookie: cPaula }, corps: { action: 'notifications-abonner', abonnement: { endpoint: 'https://evil.example.com/x', keys: telPaula.keys } } });
    verifier(res.statut === 400, 'service de notifications inconnu : refusé', res.corps);
    for (const [cookie, abonnement] of [
      [cPaula, telPaula],
      [cGaspard, telGaspard],
      [cTheo, telTheo],
    ] as const) {
      res = await appelOps({ entetes: { cookie }, corps: { action: 'notifications-abonner', abonnement, nom: 'iPhone' } });
      verifier(res.statut === 200, `abonnement de ${abonnement.endpoint.split('/').pop()} enregistré`, res.corps);
    }
    const appareils = (espace: string, membre: string) =>
      ((monde.lignes.get(`${espace}\u0000connecteurs\u0000operations-appareils-${membre}`)?.donnees as { appareils?: { endpoint: string; email: string; version: number }[] } | undefined)?.appareils ?? []).map((a) => a.endpoint.split('/').pop());
    verifier(
      appareils(LM, 'eq-p').join() === 'paula' && appareils(SENS, 'eq-t').join() === 'theo' && !monde.lignes.has(`${LM}\u0000connecteurs\u0000operations-appareils-eq-t`) && !monde.lignes.has(`${SENS}\u0000connecteurs\u0000operations-appareils-eq-p`),
      'téléphones rangés dans l’espace de la personne (collection réservée aux gérants)',
    );
    res = await appelOps({ methode: 'GET', query: { action: 'notifications-etat', endpoint: telPaula.endpoint }, entetes: { cookie: cPaula } });
    verifier(res.statut === 200 && res.corps?.actif === true && res.corps?.clePublique === vapid.publique && res.corps?.abonne === true, 'état : serveur prêt, clé publique, ce téléphone abonné', res.corps);
    res = await appelOps({ methode: 'GET', query: { action: 'notifications-etat', endpoint: telPaula.endpoint }, entetes: { cookie: cGaspard } });
    verifier(res.statut === 200 && res.corps?.abonne === false, 'le téléphone de Paula n’est pas celui de Gaspard', res.corps);
    res = await appelOps({ methode: 'GET', query: { action: 'prevenus', logement: 'log-n' }, entetes: { cookie: cGaspard } });
    verifier(res.statut === 200 && JSON.stringify(res.corps?.noms) === '["Paula P."]', '« Signaler » : Paula, abonnée, sera prévenue d’une urgence de Gaspard', res.corps);
    verifier(res.corps?.gerant === false, '« Signaler » : aucun appareil de l’ERP, le gérant n’est pas dit prévenu', res.corps);

    // Gaspard signale une urgence sur son logement : Paula (pôle) seule ; ni l'auteur, ni Sens.
    monde.pushs = [];
    res = await appelOps({ entetes: { cookie: cGaspard }, corps: { action: 'agir', operation: { type: 'signaler', logementId: 'log-n', urgent: true, description: 'Fuite sous l’évier de la cuisine.' } } });
    let r = await recus();
    verifier(res.statut === 200 && r.length === 1 && r[0].qui === 'paula', 'urgence de Gaspard : seulement Paula', r.map((x) => x.qui));
    verifier(res.corps?.message === 'Urgence signalée. Paula P. reçoit l’alerte tout de suite. Le gérant le verra dans l’ERP.', 'après l’envoi : qui est vraiment prévenu (Paula, pas le gérant)', res.corps?.message);
    verifier(
      r[0]?.titre === 'Urgence · Le Nid' && r[0].corps === 'Fuite sous l’évier de la cuisine. · Gaspard A. s’en occupe' && r[0].url === `/espace-operations?onglet=incidents&incident=${res.corps?.id}`,
      'contenu chiffré relu par le téléphone : titre, qui s’en occupe, écran de l’incident',
      r[0],
    );
    verifier(r[0]?.urgence === 'high' && r[0].vapid === vapid.publique, 'urgence livrée tout de suite, signée avec la clé du serveur', r[0]);

    // Essai : ce téléphone seulement.
    monde.pushs = [];
    res = await appelOps({ entetes: { cookie: cTheo }, corps: { action: 'notifications-tester', endpoint: telTheo.endpoint } });
    r = await recus();
    verifier(res.statut === 200 && r.length === 1 && r[0].qui === 'theo' && r[0].titre === 'Opérations', 'notification de test : sur ce téléphone seulement', r);
    res = await appelOps({ entetes: { cookie: cTheo }, corps: { action: 'notifications-tester', endpoint: telPaula.endpoint } });
    verifier(res.statut === 404 && res.corps?.code === 'inconnu', 'essai vers le téléphone d’un autre : refusé', res.corps);

    // Accès retiré : téléphones oubliés, plus rien.
    await appelOps({ entetes: gerantLM, corps: { action: 'retirer', membreId: 'eq-p' } });
    verifier(appareils(LM, 'eq-p').length === 0, 'accès retiré : ses téléphones sont oubliés');
    monde.pushs = [];
    res = await appelOps({ entetes: { cookie: cGaspard }, corps: { action: 'agir', operation: { type: 'signaler', logementId: 'log-n', urgent: true, description: 'Plus d’eau chaude dans la salle de bain.' } } });
    verifier(res.statut === 200 && monde.pushs.length === 0, 'urgence suivante : Paula (retirée) ne reçoit plus rien', monde.pushs.length);
    res = await appelOps({ methode: 'GET', query: { action: 'prevenus', logement: 'log-n' }, entetes: { cookie: cGaspard } });
    verifier(res.statut === 200 && JSON.stringify(res.corps?.noms) === '[]', '« Signaler » le dit : seul le gérant est prévenu', res.corps);

    // Le gérant : « prévenu » seulement si un appareil de l'app de l'ERP recevra l'urgence.
    const telErp = await telephone('erp-gerant');
    const idErp = await idAppareil(telErp.endpoint);
    const appareilErp = (preferences: Record<string, boolean>) =>
      monde.poser(LM, 'connecteurs', { id: idErp, type: 'notifications-appareil', endpoint: telErp.endpoint, keys: telErp.keys, preferences, creeLe: new Date().toISOString(), majLe: new Date().toISOString() } as { id: string });
    appareilErp({});
    res = await appelOps({ methode: 'GET', query: { action: 'prevenus', logement: 'log-n' }, entetes: { cookie: cGaspard } });
    verifier(res.statut === 200 && res.corps?.gerant === true && JSON.stringify(res.corps?.noms) === '[]', '« Signaler » : un appareil de l’ERP reçoit les urgences, le gérant est prévenu', res.corps);
    monde.pushs = [];
    res = await appelOps({ entetes: { cookie: cGaspard }, corps: { action: 'agir', operation: { type: 'signaler', logementId: 'log-n', urgent: true, description: 'Volet de la chambre bloqué en bas.' } } });
    r = await recus();
    verifier(
      res.statut === 200 && res.corps?.message === 'Urgence signalée. Le gérant est prévenu tout de suite.' && r.length === 1 && r[0].qui === 'erp-gerant' && r[0].titre === 'Urgence · Le Nid',
      'après l’envoi : « Le gérant est prévenu » et l’appareil de l’ERP la reçoit',
      { message: res.corps?.message, recus: r.map((x) => x.qui) },
    );
    appareilErp({ urgence: false });
    res = await appelOps({ methode: 'GET', query: { action: 'prevenus', logement: 'log-n' }, entetes: { cookie: cGaspard } });
    verifier(res.statut === 200 && res.corps?.gerant === false, '« Signaler » : urgences coupées sur l’appareil de l’ERP, le gérant le verra dans l’ERP', res.corps);
    monde.lignes.delete(`${LM}\u0000connecteurs\u0000${idErp}`);

    // Passage du matin : le contrôle du jour à Gaspard, une seule fois.
    monde.poser(LM, 'reservations', { id: 'res-n', logementId: 'log-n', canal: 'airbnb', voyageur: { nom: 'Zoé Martin', nbPersonnes: 2 }, arrivee: ajouterJours(aujourdhui, -3), depart: ajouterJours(aujourdhui, -1), nuits: 2, statut: 'terminee', montantBrutCentimes: 20000, commissionPlateformeCentimes: 3000, fraisMenageCentimes: 4000 } as { id: string });
    monde.pushs = [];
    // Les notifications du matin partent avec le passage planifié de l'agent (pas avec la synchro de 4 h), à partir de 7 h à Paris.
    const avantSept = heureParis(new Date()) < 7;
    await routeAgent(requete({ entetes: { authorization: 'Bearer secret-cron' } }), reponse()).catch(() => undefined);
    r = await recus();
    if (avantSept) verifier(r.length === 0, 'passage planifié de l’agent avant 7 h à Paris : rien', r);
    else verifier(r.length === 1 && r[0].qui === 'gaspard' && r[0].titre === 'Aujourd’hui : 1 contrôle qualité', 'passage planifié de l’agent après 7 h : le contrôle du jour part', r);
    // Heure fixée (même jour à Paris), journal remis à zéro : rien avant 7 h, puis une seule fois.
    const aParis = (h: number, m = 0) => {
      const [a, mo, j] = aujourdhui.split('-').map(Number);
      return [1, 2].map((d) => new Date(Date.UTC(a, mo - 1, j, h - d, m))).find((x) => dateParisISO(x) === aujourdhui && heureParis(x) === h)!;
    };
    monde.lignes.delete(`${LM}\u0000connecteurs\u0000operations-notifications-journal`);
    monde.pushs = [];
    await notificationsOpsDuJour({ maintenant: aParis(0, 0) });
    await notificationsOpsDuJour({ maintenant: aParis(6, 59) });
    verifier(monde.pushs.length === 0, 'passage du matin : rien à minuit ni à 6 h 59 à Paris (réveil de 22 h UTC l’été)', monde.pushs.length);
    await notificationsOpsDuJour({ maintenant: aParis(7, 0) });
    r = await recus();
    verifier(r.length === 1 && r[0].qui === 'gaspard' && r[0].titre === 'Aujourd’hui : 1 contrôle qualité' && r[0].corps === 'Le Nid.' && r[0].url === '/espace-operations?onglet=controles', 'passage du matin à 7 h : « Aujourd’hui : 1 contrôle qualité » à qui a la charge du logement', r);
    verifier(!JSON.stringify(r).includes('Zoé'), 'aucun nom de voyageur dans la notification');
    monde.pushs = [];
    await notificationsOpsDuJour({ maintenant: aParis(9, 30) });
    await routeAgent(requete({ entetes: { authorization: 'Bearer secret-cron' } }), reponse()).catch(() => undefined);
    verifier(monde.pushs.length === 0, 'deuxième passage le même jour : rien ne repart', monde.pushs.length);

    // « Ce logement n'est pas à moi » : la réponse du gérant.
    monde.poser(LM, 'signalementsLogement', { id: 'sig-n', logementId: 'log-n', membreId: 'eq-g', le: `${aujourdhui}T08:00:00.000Z`, statut: 'ouvert' } as { id: string });
    res = await appelOps({ entetes: gerantLM, corps: { action: 'signalement-traite', id: 'sig-n' } });
    verifier(res.statut === 409 && res.corps?.code === 'pas_encore', 'réponse pas encore dans la base : « pas_encore », l’ERP réessaie', res.corps);
    monde.poser(LM, 'signalementsLogement', { id: 'sig-n', logementId: 'log-n', membreId: 'eq-g', le: `${aujourdhui}T08:00:00.000Z`, statut: 'traite', decision: 'confirme', traiteLe: new Date().toISOString(), traitePar: 'Gérant' } as { id: string });
    res = await appelOps({ entetes: { ...gerantLM, 'x-erp-espace': SENS }, corps: { action: 'signalement-traite', id: 'sig-n' } });
    verifier(res.statut === 403, 'compte de Label Maison avec l’en-tête de Sens : refusé', res.corps);
    res = await appelOps({ entetes: gerantSens, corps: { action: 'signalement-traite', id: 'sig-n' } });
    verifier(res.statut === 409, 'gérant de Sens : le signalement de Label Maison n’existe pas chez lui', res.corps);
    res = await appelOps({ entetes: { cookie: cGaspard }, corps: { action: 'signalement-traite', id: 'sig-n' } });
    verifier(res.statut === 401, 'une personne de terrain ne peut pas l’envoyer', res.statut);
    monde.pushs = [];
    res = await appelOps({ entetes: gerantLM, corps: { action: 'signalement-traite', id: 'sig-n' } });
    r = await recus();
    verifier(res.statut === 200 && res.corps?.envoye === true && r.length === 1 && r[0].qui === 'gaspard' && r[0].titre === 'Logement confirmé · Le Nid', 'gardé : Gaspard reçoit « Logement confirmé »', r);
    res = await appelOps({ entetes: gerantLM, corps: { action: 'signalement-traite', id: 'sig-n' } });
    verifier(res.statut === 200 && res.corps?.envoye === false && monde.pushs.length === 1, 'deuxième appel : jamais deux fois', res.corps);

    // Adresse changée dans la fiche : la session tombe et le téléphone ne reçoit plus rien.
    monde.poser(LM, 'equipe', { id: 'eq-g', nom: 'Gaspard Agent', role: 'agent', email: 'successeur@exemple.invalid', logementIds: ['log-n'], actif: true } as { id: string });
    monde.poser(LM, 'signalementsLogement', { id: 'sig-n2', logementId: 'log-n', membreId: 'eq-g', le: `${aujourdhui}T08:00:00.000Z`, statut: 'traite', decision: 'confirme', traiteLe: new Date().toISOString(), traitePar: 'Gérant' } as { id: string });
    monde.pushs = [];
    res = await appelOps({ entetes: gerantLM, corps: { action: 'signalement-traite', id: 'sig-n2' } });
    verifier(res.statut === 200 && res.corps?.envoye === false && monde.pushs.length === 0, 'adresse changée dans la fiche : rien ne part', res.corps);
    monde.poser(LM, 'equipe', { id: 'eq-g', nom: 'Gaspard Agent', role: 'agent', email: 'gaspard@exemple.invalid', logementIds: ['log-n'], actif: true } as { id: string });

    // Déconnexion : le serveur oublie ce téléphone.
    res = await appelOps({ entetes: { cookie: cGaspard }, corps: { action: 'notifications-desabonner', endpoint: telGaspard.endpoint } });
    verifier(res.statut === 200 && appareils(LM, 'eq-g').length === 0, 'désabonner : téléphone oublié', appareils(LM, 'eq-g'));

    // Sans clés : rien n'est proposé ni envoyé.
    delete env.VAPID_PUBLIC_KEY;
    delete env.VAPID_PRIVATE_KEY;
    res = await appelOps({ methode: 'GET', query: { action: 'notifications-etat' }, entetes: { cookie: cTheo } });
    verifier(res.statut === 200 && res.corps?.actif === false && res.corps?.clePublique === null, 'sans clés : notifications pas encore ouvertes', res.corps);
    res = await appelOps({ entetes: { cookie: cTheo }, corps: { action: 'notifications-abonner', abonnement: telTheo } });
    verifier(res.statut === 503 && res.corps?.code === 'inactif', 'sans clés : abonnement refusé', res.corps);
    monde.pushs = [];
    res = await appelOps({ entetes: { cookie: cTheo }, corps: { action: 'agir', operation: { type: 'signaler', logementId: 'log-n2', urgent: true, description: 'Volet roulant bloqué en bas.' } } });
    verifier(res.statut === 200 && monde.pushs.length === 0, 'sans clés : l’action passe, rien n’est envoyé', monde.pushs.length);
  }

  section('Webhooks');
  {
    const message = { event: 'reservation.message.received', data: { object: { conversationId: 1 } } };
    monde.oublier();
    let res = reponse();
    await routeWebhook(webhook({ ...message, workspaceId: 9999 }, 'whsec_lm'), res);
    verifier(res.statut === 200 && res.corps?.ignore === 'workspace' && monde.repull.length === 0 && monde.ecritures(LM).length === 0, 'workspace inconnu : ignoré, jamais versé dans Label Maison', res.corps);
    monde.oublier();
    res = reponse();
    await routeWebhook(webhook({ ...message, workspaceId: 1204 }, 'whsec_lm'), res);
    verifier(res.statut === 200 && monde.repull.length > 0 && monde.repull.every((a) => a.workspace === '1204'), 'workspace de Sens : relu dans le workspace de Sens', monde.repull);
    verifier(monde.ecritures(SENS).length > 0 && monde.ecritures(LM).length === 0, 'écrit dans Sens seulement');
    monde.oublier();
    res = reponse();
    await routeWebhook(webhook(message, 'whsec_lm'), res);
    verifier(res.statut === 200 && monde.repull.every((a) => a.workspace === 'lm-ws') && monde.ecritures(LM).length > 0 && monde.ecritures(SENS).length === 0, 'sans workspace : Label Maison, relu dans son workspace');
    res = reponse();
    await routeWebhook(webhook(message, 'whsec_lm', { espace: 'sens' }), res);
    verifier(res.statut === 401 && JSON.stringify(res.corps) === '{"ok":false}', 'adresse de Sens sans secret rangé : refusée comme une signature fausse', res.corps);
    monde.coffre.set(`${SENS}:repull_webhook`, 'whsec_sens');
    res = reponse();
    await routeWebhook(webhook(message, 'whsec_lm', { espace: 'sens' }), res);
    verifier(res.statut === 401, 'adresse de Sens signée avec le secret de Label Maison : refusée', res.statut);
    monde.oublier();
    res = reponse();
    await routeWebhook(webhook(message, 'whsec_sens', { espace: 'sens' }), res);
    verifier(res.statut === 200 && monde.ecritures(SENS).length > 0 && monde.ecritures(LM).length === 0, 'adresse de Sens, son secret : traité dans Sens', res.corps);
    res = reponse();
    await routeWebhook(webhook(message, 'whsec_sens', { espace: 'inconnu' }), res);
    verifier(res.statut === 401 && JSON.stringify(res.corps) === '{"ok":false}', 'espace inconnu : même réponse qu’une signature fausse', res);
    res = reponse();
    await routeWebhook(webhook(message, 'whsec_faux', { espace: 'sens' }), res);
    verifier(res.statut === 401 && JSON.stringify(res.corps) === '{"ok":false}', 'signature fausse : la même réponse', res.statut);
  }

  section('Espaces ouverts par invitation (api/erp-espaces)');
  {
    const appelEspaces = async (jeton: string, espace: string | undefined, o: { methode?: string; corps?: unknown; query?: Record<string, string>; entetes?: Record<string, string> }) => {
      const res = reponse();
      await routeEspaces(requete({ methode: o.methode, corps: o.corps, query: o.query, entetes: { authorization: `Bearer ${jeton}`, ...(espace ? { 'x-erp-espace': espace } : {}), ...(o.entetes ?? {}) } }), res);
      return res;
    };
    const c = configuration();
    // La plateforme : gérants de Label Maison seulement, avec leur propre session (la base revérifie).
    let res = await appelEspaces('jeton-sens', SENS, { methode: 'GET', query: { action: 'plateforme' } });
    verifier(res.statut === 403, 'gérant de Sens : ni liste des espaces ni invitation', res.corps);
    res = await appelEspaces('jeton-ops-sens', SENS, { corps: { action: 'repull', cle: 'sk_live_intrus_0000' } });
    verifier(res.statut === 403 && !monde.coffre.has(`${SENS}:repull_cle`), 'compte « opérations » : refusé', res.corps);
    res = await appelEspaces('jeton-equipe', SENS, { methode: 'GET', query: { action: 'plateforme' } });
    verifier(res.statut === 403, 'compte de Label Maison avec l’en-tête de Sens : refusé', res.corps);
    monde.oublier();
    res = await appelEspaces('jeton-equipe', LM, { methode: 'GET', query: { action: 'plateforme' } });
    const lu = monde.base.filter((r) => r.chemin === 'rpc/espaces_plateforme');
    verifier(
      res.statut === 200 && res.corps?.espaces?.length === 3 && lu.length === 1 && lu[0].jeton === 'jeton-equipe' && lu[0].espace === LM,
      'gérant de Label Maison : espaces lus avec SA session (jamais le compte serveur)',
      { corps: res.corps, lu: lu.map((r) => [r.jeton, r.espace]) },
    );

    // Inviter : adresse vérifiée ; sans e-mail, le lien à copier, toujours sur le site fixe.
    res = await appelEspaces('jeton-equipe', LM, { corps: { action: 'inviter', nom: 'Côte & Mer', email: 'pas-une-adresse' } });
    verifier(res.statut === 400 && monde.invitations.length === 0, 'invitation : adresse invalide refusée', res.corps);
    res = await appelEspaces('jeton-equipe', LM, { corps: { action: 'inviter', nom: 'Déjà membre', email: 'gerant-b@exemple.invalid' } });
    verifier(res.statut === 400 && /déjà accès/.test(res.corps?.erreur ?? '') && monde.invitations.length === 0, 'invitation d’une adresse déjà membre : refusée avec le message de la base', res.corps);
    res = await appelEspaces('jeton-equipe', LM, { corps: { action: 'inviter', nom: 'Côte & Mer', email: ' Gerant@Cote-Mer.example ' }, entetes: { origin: 'https://piege.vercel.app', host: 'piege.vercel.app' } });
    const codeEspace = /^https:\/\/www\.labelmaisoncg\.fr\/erp#creer=gerant%40cote-mer\.example&code=([A-Za-z0-9_-]{43})$/.exec(String(res.corps?.lien ?? ''))?.[1] ?? '';
    verifier(
      res.statut === 200 && res.corps?.envoye === false && !!codeEspace && monde.invitations.length === 1 && monde.invitations[0].email === 'gerant@cote-mer.example',
      'invitation sans e-mail : enregistrée, lien « Créer mon compte » du site fixe avec son code, à copier (Origin forgée sans effet)',
      res.corps,
    );
    verifier(
      monde.invitations[0]?.empreinte === crypto.createHash('sha256').update(codeEspace, 'utf8').digest('hex') && !monde.base.some((r) => JSON.stringify(r.corps ?? '').includes(codeEspace)),
      'invitation d’une conciergerie : seule l’empreinte du code va dans la base',
      monde.invitations[0],
    );
    env.RESEND_API_KEY = 're_test';
    monde.emails = [];
    res = await appelEspaces('jeton-equipe', LM, { corps: { action: 'inviter', nom: 'Côte & Mer', email: 'gerant@cote-mer.example' } });
    const mail = monde.emails[0];
    verifier(
      res.statut === 200 && res.corps?.envoye === true && monde.emails.length === 1 && /Label Maison/.test(mail?.from ?? '') && mail?.to?.[0] === 'gerant@cote-mer.example',
      'invitation par e-mail : expéditeur de Label Maison, à l’adresse invitée',
      mail,
    );
    verifier(
      /Côte & Mer/.test(mail?.subject ?? '') &&
        /https:\/\/www\.labelmaisoncg\.fr\/erp#creer=gerant%40cote-mer\.example&code=[A-Za-z0-9_-]{43}/.test(mail?.text ?? '') &&
        /gerant@cote-mer\.example/.test(mail?.text ?? '') &&
        /une seule fois/.test(mail?.text ?? ''),
      'e-mail : nom de la conciergerie, lien « Créer mon compte » avec son code, adresse à utiliser, usage unique',
      mail?.text,
    );
    verifier(monde.invitations.length === 1, 'réinviter la même adresse : une seule invitation en attente');
    delete env.RESEND_API_KEY;
    res = await appelEspaces('jeton-equipe', LM, { corps: { action: 'annuler', id: 'pas-un-id' } });
    verifier(res.statut === 400, 'annuler : invitation inconnue refusée', res.corps);
    res = await appelEspaces('jeton-equipe', LM, { corps: { action: 'annuler', id: monde.invitations[0].id } });
    verifier(res.statut === 200 && res.corps?.annulee === true && monde.invitations.length === 0, 'annuler : invitation retirée', res.corps);

    // Suspendre : jamais Label Maison ; un espace suspendu n'ouvre plus rien et sort des passages planifiés.
    res = await appelEspaces('jeton-equipe', LM, { corps: { action: 'suspendre', espace: LM, actif: false } });
    verifier(res.statut === 400 && monde.espaces[0].actif, 'Label Maison ne se suspend pas', res.corps);
    res = await appelEspaces('jeton-equipe', LM, { corps: { action: 'suspendre', espace: SENS, actif: false } });
    verifier(res.statut === 200 && !monde.espaces[1].actif, 'Sens suspendu', res.corps);
    verifier(!(await espacesActifs(c)).some((e) => e.id === SENS), 'espace suspendu : hors des passages planifiés');
    res = await appelEspaces('jeton-sens', SENS, { methode: 'GET', query: { action: 'repull' } });
    verifier(res.statut === 403, 'espace suspendu : son gérant n’y entre plus', res.corps);
    res = await appelEspaces('jeton-equipe', LM, { corps: { action: 'suspendre', espace: SENS, actif: true } });
    verifier(res.statut === 200 && monde.espaces[1].actif, 'Sens rouvert', res.corps);

    // Repull d'un espace : sa propre clé, rangée par SON gérant, jamais relue par le navigateur.
    monde.coffre.clear();
    monde.espaces[1].repull_workspace = null;
    res = await appelEspaces('jeton-sens', SENS, { methode: 'GET', query: { action: 'repull' } });
    verifier(
      res.statut === 200 && res.corps?.cle === false && res.corps?.webhook === false && res.corps?.adresseWebhook === 'https://www.labelmaisoncg.fr/api/erp-repull-webhook?espace=sens',
      'Repull de Sens : pas encore de clé, adresse de son webhook',
      res.corps,
    );
    res = await appelEspaces('jeton-sens', SENS, { corps: { action: 'repull', cle: 'sk live avec espaces' } });
    verifier(res.statut === 400 && !monde.coffre.size, 'clé illisible : refusée, rien de rangé', res.corps);
    // Clé essayée chez Repull avant d'être rangée : une lecture (GET /v1/health/auth), rien d'écrit.
    monde.oublier();
    monde.clesRefusees.add('sk_live_mauvaise_1234');
    res = await appelEspaces('jeton-sens', SENS, { corps: { action: 'repull', cle: 'sk_live_mauvaise_1234' } });
    verifier(res.statut === 400 && res.corps?.code === 'cle_refusee' && /Repull refuse cette clé/.test(res.corps?.erreur ?? '') && !monde.coffre.size, 'clé refusée par Repull : message clair, rien de rangé', res.corps);
    verifier(!/Vercel|REPULL_API_KEY/.test(res.corps?.erreur ?? ''), 'clé refusée : jamais renvoyé vers Vercel', res.corps?.erreur);
    verifier(
      monde.repull.length >= 1 && monde.repull.every((a) => a.methode === 'GET' && a.chemin === '/v1/health/auth' && a.cle === 'sk_live_mauvaise_1234'),
      'essai de la clé : lecture seule (GET /v1/health/auth)',
      monde.repull,
    );
    verifier(!monde.base.some((r) => r.chemin === 'rpc/enregistrer_secret_espace'), 'clé refusée : le coffre n’est pas appelé');
    monde.repullEnPanne = true;
    res = await appelEspaces('jeton-sens', SENS, { corps: { action: 'repull', cle: 'sk_live_sens_propre_1234' } });
    monde.repullEnPanne = false;
    verifier(res.statut === 503 && !monde.coffre.size && /réessayez/.test(res.corps?.erreur ?? ''), 'Repull ne répond pas : rien de rangé, réessayer', res.corps);
    monde.oublier();
    res = await appelEspaces('jeton-sens', SENS, { corps: { action: 'repull', cle: 'sk_live_sens_propre_1234', workspace: ' ws-sens ' } });
    const ecrits = monde.base.filter((r) => r.chemin === 'rpc/enregistrer_secret_espace' || r.chemin === 'rpc/regler_repull_espace');
    verifier(
      res.statut === 200 && res.corps?.cle === true && res.corps?.workspace === 'ws-sens' && monde.coffre.get(`${SENS}:repull_cle`) === 'sk_live_sens_propre_1234',
      'clé de Sens rangée dans le coffre de Sens, workspace de sa clé réglé',
      res.corps,
    );
    verifier(!JSON.stringify(res.corps).includes('sk_live_sens_propre_1234'), 'la clé ne revient jamais dans la réponse');
    verifier(ecrits.length === 2 && ecrits.every((r) => r.jeton === 'jeton-sens' && r.espace === SENS), 'clé rangée avec la session du gérant de Sens et l’en-tête de Sens', ecrits.map((r) => [r.jeton, r.espace]));
    const ce = await configurationEspace(SENS);
    verifier(ce.cle === 'sk_live_sens_propre_1234' && ce.workspace === 'ws-sens', 'Sens : synchronisé avec SA clé et son workspace', { cle: ce.cle, workspace: ce.workspace });
    monde.lignes.delete(`${SENS}\u0000repull\u0000etat`);
    monde.oublier();
    const sync = reponse();
    await routeSynchro(requete({ entetes: { authorization: 'Bearer jeton-sens', 'x-erp-espace': SENS } }), sync);
    verifier(sync.statut === 200 && monde.repull.length > 0 && monde.repull.every((a) => a.cle === 'sk_live_sens_propre_1234' && a.workspace === 'ws-sens'), 'bouton de Sens : chaque appel Repull avec sa clé, jamais celle de Label Maison', monde.repull.slice(0, 2));
    verifier(monde.ecritures(LM).length === 0, 'rien écrit dans Label Maison');
    res = await appelEspaces('jeton-sens', SENS, { corps: { action: 'repull', secretWebhook: 'whsec_sens_propre_1234' } });
    verifier(res.statut === 200 && res.corps?.webhook === true && res.corps?.cle === true, 'secret du webhook de Sens rangé (la clé reste)', res.corps);
    const message = { event: 'reservation.message.received', data: { object: { conversationId: 2 } } };
    let w = reponse();
    await routeWebhook(webhook(message, 'whsec_sens_propre_1234', { espace: 'sens' }), w);
    verifier(w.statut === 200 && monde.ecritures(SENS).length > 0, 'adresse du webhook de Sens, son secret : traité dans Sens', w.corps);
    w = reponse();
    await routeWebhook(webhook(message, 'whsec_lm', { espace: 'sens' }), w);
    verifier(w.statut === 401, 'adresse de Sens signée avec le secret de Label Maison : refusée', w.statut);
    res = await appelEspaces('jeton-equipe', LM, { methode: 'GET', query: { action: 'repull' } });
    verifier(res.statut === 200 && res.corps?.labelMaison === true && res.corps?.cle === undefined, 'Label Maison : ses clés restent dans Vercel (rien à régler ici)', res.corps);
    res = await appelEspaces('jeton-equipe', LM, { corps: { action: 'repull', cle: 'sk_live_intrus_0000' } });
    verifier(res.statut === 400 && !monde.coffre.has(`${LM}:repull_cle`), 'Label Maison : aucune clé rangée dans le coffre', res.corps);
    res = await appelEspaces('jeton-equipe', SENS, { corps: { action: 'repull', cle: 'sk_live_intrus_0000' } });
    verifier(res.statut === 403 && monde.coffre.get(`${SENS}:repull_cle`) === 'sk_live_sens_propre_1234', 'compte de Label Maison : ne range rien dans Sens', res.corps);
    // Clé de Sens refusée plus tard par Repull : on dit où la remplacer, jamais Vercel.
    verifier(ce.origineCle === 'espace' && configuration().origineCle === 'vercel', 'origine de la clé : Sens = la sienne, Label Maison = Vercel', [ce.origineCle, configuration().origineCle]);
    monde.clesRefusees.add('sk_live_sens_propre_1234');
    monde.lignes.delete(`${SENS}\u0000repull\u0000etat`);
    const refusee = reponse();
    await routeSynchro(requete({ entetes: { authorization: 'Bearer jeton-sens', 'x-erp-espace': SENS } }), refusee);
    const texteRefus = JSON.stringify(refusee.corps ?? {});
    verifier(/Remplacer la clé/.test(texteRefus) && !/Vercel|REPULL_API_KEY/.test(texteRefus), 'bouton de Sens, clé refusée : « Paramètres → Plateformes → Remplacer la clé », jamais Vercel', texteRefus.slice(0, 400));
    monde.clesRefusees.clear();
    const client = new ClientRepull({ cle: 'k', echeance: Date.now() + 5000, origineCle: 'partagee', fetch: async () => json({ error: { code: 'unauthorized' } }, 401) });
    const refusPartage = await client.get('/v1/listings').then(() => '', (e: Error) => e.message);
    verifier(refusPartage === 'Clé Repull refusée : contactez Label Maison.', 'compte Repull de Label Maison prêté à un espace : « contactez Label Maison »', refusPartage);
    verifier(/Vercel/.test(messageCleRefusee('vercel')) && !/Vercel/.test(messageCleRefusee('espace')), 'Label Maison garde le message Vercel');
    const budget = messageConnexion(new BudgetEpuise(), { budgetMois: 400, appelsMois: 400, origineCle: 'espace' });
    verifier(/contactez Label Maison/.test(budget) && !/Vercel|REPULL_BUDGET_ERP/.test(budget), 'part du mois épuisée dans un espace : « contactez Label Maison »', budget);
    verifier(/REPULL_BUDGET_ERP/.test(messageConnexion(new BudgetEpuise(), { budgetMois: 400 })), 'part du mois épuisée chez Label Maison : comme avant');
    monde.coffre.clear();
    monde.espaces[1].config = {};
    monde.espaces[1].repull_workspace = '1204';
  }

  section('Retour en arrière du SQL');
  {
    const c = configuration();
    verifier((await etatBase(c)).serveur, 'état gardé : base préparée, compte serveur prêt');
    monde.historique = true;
    let m = '';
    await baseErp(c).lire('crm').catch((x: Error) => (m = x.message));
    verifier(m === MESSAGE_BASE_PAS_PREPAREE, 'colonne espace refusée : « Base pas encore préparée »', m);
    verifier((await etatBase(c)).mode === 'historique', 'état oublié aussitôt : la base est relue (historique)');
    monde.oublier();
    await baseErp(c).lire('crm');
    const r = monde.base[monde.base.length - 1];
    verifier(r.espace === null && r.jeton === 'jeton-equipe', 'Label Maison repart comme avant (compte d’équipe, sans espace)', r.espace);
  }

  process.stdout.write(`\n${reussis} contrôles réussis, ${echecs} en échec.\n`);
  process.exitCode = echecs ? 1 : 0;
}

principal().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
