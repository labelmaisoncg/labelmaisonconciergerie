/**
 * Auto-contrôle des notifications de l'app (sans réseau) :
 *   - chiffrement Web Push comparé à l'exemple officiel de la RFC 8291,
 *     signature VAPID (RFC 8292) vérifiée ;
 *   - choix des notifications entre deux photographies de la base, pour
 *     chaque type, avec une seule notification par message (la plus
 *     importante) et les préférences de chaque appareil ;
 *   - envoi : idempotence, abonnements expirés oubliés, envoi raté sans
 *     conséquence, rien sans clés serveur ;
 *   - demande « Recevoir les notifications ? » à l'ouverture : chaque
 *     condition qui l'empêche.
 *
 * Lancement (Node 18+) :
 *   node_modules/.bin/esbuild src/erp/data/verifier-notifications.ts --bundle --platform=node \
 *     --format=esm --log-level=error --outfile=/tmp/verifier-notifications.mjs \
 *     && node /tmp/verifier-notifications.mjs
 */
import { envoyerNotifications, enregistrerAppareil, lireAppareils, majRoleAppareil, reglerAppareil, surveiller, type BaseNotifications } from './notifications-envoi';
import { b64url, chiffrer, deB64url, endpointAccepte, enteteVapid, genererClesVapid, type AbonnementPush } from './web-push';
import {
  demandeNotifications,
  estProbleme,
  JOURS_PLUS_TARD_NOTIFICATIONS,
  nettoyerPreferences,
  notificationNouveauLead,
  notificationLeadPlafonnee,
  PLAFOND_LEADS_HEURE,
  notificationsEntre,
  preferencesPourRole,
  prenomInitiale,
  synchroEnEchec,
  TYPES_NOTIFICATION,
  typePourRole,
  varianteAEnvoyer,
  type ContexteDemandeNotifications,
  type GroupeNotification,
  type Instantane,
} from './notifications';
import type { FilMessages, Logement, Reservation } from './types';

let echecs = 0;
let reussis = 0;
function verifier(condition: unknown, message: string) {
  if (condition) reussis++;
  else {
    echecs++;
    console.error(`  ✗ ${message}`);
  }
}
function section(titre: string) {
  console.log(`\n${titre}`);
}

/* ------------------------------------------------------------ données */

const MAINTENANT = new Date('2026-10-26T09:00:00.000Z');
const logement = (id: string, nom: string) => ({ id, nom }) as unknown as Logement;
const LOGEMENTS = [logement('l1', 'Corbeil Centre Familial'), logement('l2', 'Le Nid sous les Toits')];

function resa(id: string, x: Partial<Reservation> = {}): Reservation {
  return {
    id,
    logementId: 'l1',
    canal: 'airbnb',
    voyageur: { nom: 'Daniel Aubert', nbPersonnes: 2 },
    arrivee: '2026-11-12',
    depart: '2026-11-15',
    nuits: 3,
    statut: 'confirmee',
    montantBrutCentimes: 45000,
    commissionPlateformeCentimes: 0,
    fraisMenageCentimes: 0,
    ...x,
  } as Reservation;
}

function fil(id: string, x: Partial<FilMessages> = {}): FilMessages {
  return {
    id,
    logementId: 'l2',
    canal: 'airbnb',
    voyageur: 'Clara Martin',
    statut: 'ouvert',
    messages: [{ id: `${id}-m1`, auteur: 'voyageur', texte: 'Bonjour !', envoyeLe: '2026-10-20T08:00:00.000Z' }],
    dernierMessageLe: '2026-10-20T08:00:00.000Z',
    traitePar: 'humain',
    ...x,
  } as FilMessages;
}

const msg = (id: string, auteur: 'voyageur' | 'agent' | 'hote', texte: string, envoyeLe = '2026-10-26T08:30:00.000Z') => ({ id, auteur, texte, envoyeLe });
const instantane = (x: Partial<Instantane>): Instantane => ({ reservations: [], fils: [], logements: LOGEMENTS, ...x });

/* --------------------------------------------------------- fausse base */

class FausseBase implements BaseNotifications {
  lignes = new Map<string, { id: string }>();
  ecritures = 0;
  async lire<T>(collection: string, ids?: string[]): Promise<T[]> {
    return [...this.lignes.entries()]
      .filter(([k]) => k.startsWith(`${collection}/`) && (!ids || ids.includes(k.slice(collection.length + 1))))
      .map(([, v]) => JSON.parse(JSON.stringify(v)) as T);
  }
  async ecrire(collection: string, elements: { id: string }[]): Promise<void> {
    this.ecritures++;
    for (const e of elements) this.lignes.set(`${collection}/${e.id}`, JSON.parse(JSON.stringify(e)));
  }
}

/** Clé publique d'un « navigateur » de test (base64url, 65 octets). */
async function clePubliqueNavigateur(): Promise<string> {
  const paire = (await globalThis.crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair;
  return b64url(new Uint8Array(await globalThis.crypto.subtle.exportKey('raw', paire.publicKey)));
}

async function principal() {
  section('Chiffrement et signature');
  {
    const subtle = globalThis.crypto.subtle;
    const T = (o: Uint8Array) => o as unknown as BufferSource;
    const enc = (t: string) => new TextEncoder().encode(t);
    // RFC 8291, section 5 et annexe A.
    const asPublic = deB64url('BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8');
    const corps = await chiffrer(
      enc('When I grow up, I want to be a watermelon'),
      { endpoint: 'https://push.example.net/push/JzLQ3raZJfFBR0aqvOMsLrt54w4rJUsV', keys: { p256dh: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4', auth: 'BTBZMqHH6r4Tts7J_aSIgg' } },
      { publique: asPublic, privee: deB64url('yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw') },
      deB64url('DGv6ra1nlYgDCS1FRnbzlw'),
    );
    const attendu =
      'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN';
    verifier(b64url(corps) === attendu, `contenu chiffré identique à l’exemple de la RFC 8291 (${b64url(corps).slice(0, 40)}…)`);

    const cles = { ...(await genererClesVapid()), sujet: 'mailto:test@example.com' };
    verifier(deB64url(cles.publique).length === 65 && deB64url(cles.privee).length === 32, 'paire VAPID au format web-push (65 et 32 octets)');
    const entete = await enteteVapid('https://web.push.apple.com/QGuQyavXutnMdPhgKm1xWkqxFl', cles, 1_800_000_000);
    const jwt = /t=([^,]+), k=(.+)$/.exec(entete);
    verifier(jwt && jwt[2] === cles.publique, 'en-tête « vapid t=…, k=… »');
    const [a, b, s] = (jwt?.[1] ?? '..').split('.');
    const pub = deB64url(cles.publique);
    const clePub = await subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: b64url(pub.slice(1, 33)), y: b64url(pub.slice(33)) }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    verifier(await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, clePub, T(deB64url(s)), T(enc(`${a}.${b}`))), 'signature ES256 du jeton vérifiée');
    const charge = JSON.parse(new TextDecoder().decode(deB64url(b)));
    verifier(charge.aud === 'https://web.push.apple.com' && charge.sub === 'mailto:test@example.com' && charge.exp === 1_800_000_000 + 12 * 3600, `jeton : aud = origine du service, sub, exp 12 h (${JSON.stringify(charge)})`);

    // Déchiffrement côté navigateur (rôle inverse) d'un contenu aléatoire.
    const ECDH = { name: 'ECDH', namedCurve: 'P-256' } as const;
    const ua = (await subtle.generateKey(ECDH, true, ['deriveBits'])) as CryptoKeyPair;
    const uaPublic = new Uint8Array(await subtle.exportKey('raw', ua.publicKey));
    const auth = globalThis.crypto.getRandomValues(new Uint8Array(16));
    const abonnement: AbonnementPush = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: b64url(uaPublic), auth: b64url(auth) } };
    const message = enc(JSON.stringify({ titre: 'Nouvelle réservation · Corbeil', corps: 'Daniel A.' }));
    const c = await chiffrer(message, abonnement);
    const sel = c.slice(0, 16);
    const as = c.slice(21, 86);
    const secret = new Uint8Array(await subtle.deriveBits({ name: 'ECDH', public: await subtle.importKey('raw', T(as), ECDH, false, []) }, ua.privateKey, 256));
    const h = async (ikm: Uint8Array, salt: Uint8Array, info: Uint8Array, n: number) =>
      new Uint8Array(await subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: T(salt), info: T(info) }, await subtle.importKey('raw', T(ikm), 'HKDF', false, ['deriveBits']), n * 8));
    const ikm = await h(secret, auth, new Uint8Array([...enc('WebPush: info\0'), ...uaPublic, ...as]), 32);
    const cek = await subtle.importKey('raw', T(await h(ikm, sel, enc('Content-Encoding: aes128gcm\0'), 16)), 'AES-GCM', false, ['decrypt']);
    const clair = new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: T(await h(ikm, sel, enc('Content-Encoding: nonce\0'), 12)) }, cek, T(c.slice(86))));
    verifier(b64url(clair.slice(0, -1)) === b64url(message) && clair[clair.length - 1] === 2, 'contenu aléatoire déchiffré par le destinataire, délimiteur de fin 0x02');

    verifier(
      endpointAccepte('https://fcm.googleapis.com/fcm/send/x') &&
        endpointAccepte('https://web.push.apple.com/abc') &&
        endpointAccepte('https://wns2-par02p.notify.windows.com/w/?token=x') &&
        !endpointAccepte('http://fcm.googleapis.com/x') &&
        !endpointAccepte('https://169.254.169.254/latest') &&
        !endpointAccepte('https://evil.example.com/fcm.googleapis.com'),
      'seuls les services de notifications connus sont acceptés (https)',
    );
  }

  section('Problème signalé : formulations');
  {
    const oui = [
      'Bonjour, il n’y a plus d’eau chaude dans la douche',
      'Le chauffage ne fonctionne pas, il fait très froid',
      'Il y a une fuite sous l’évier !',
      'La boîte à clés est vide, impossible d’entrer',
      'On n’arrive pas à ouvrir la porte',
      'Le wifi ne marche pas depuis ce matin',
      'Les voisins font beaucoup de bruit',
      'La chambre est sale, les draps ne sont pas propres',
      'Il y a des cafards dans la cuisine',
      'The heating is not working',
      'We are locked out, the key is missing',
      'There is no hot water',
      'The TV is broken',
    ];
    const non = [
      'Bonjour, où récupère-t-on la clé ?',
      'Quel est le code wifi ?',
      'À quelle heure peut-on arriver ?',
      'Merci beaucoup, tout était parfait !',
      'Is there parking nearby?',
      'Can we check in early?',
    ];
    const fauxNegatifs = oui.filter((t) => !estProbleme(t));
    const fauxPositifs = non.filter((t) => estProbleme(t));
    verifier(!fauxNegatifs.length, `problèmes reconnus (manqués : ${JSON.stringify(fauxNegatifs)})`);
    verifier(!fauxPositifs.length, `simples questions non signalées (à tort : ${JSON.stringify(fauxPositifs)})`);
  }

  section('Choix des notifications');
  {
    verifier(prenomInitiale('Daniel Aubert') === 'Daniel A.' && prenomInitiale('Clara') === 'Clara' && prenomInitiale('') === 'Un voyageur', 'nom court sur l’écran verrouillé');

    // Nouvelle réservation, passée ignorée, annulée, modifiée, avis.
    const avant = instantane({
      reservations: [resa('r-annulee'), resa('r-modif'), resa('r-avis', { statut: 'terminee', arrivee: '2026-10-01', depart: '2026-10-04' }), resa('r-stable')],
    });
    const apres = instantane({
      reservations: [
        resa('r-annulee', { statut: 'annulee' }),
        resa('r-modif', { arrivee: '2026-11-13', depart: '2026-11-16' }),
        resa('r-avis', { statut: 'terminee', arrivee: '2026-10-01', depart: '2026-10-04', noteVoyageur: 3.5, commentaireVoyageur: 'Logement correct mais bruyant.' }),
        resa('r-stable'),
        resa('r-nouvelle', { logementId: 'l2', voyageur: { nom: 'Inès Vidal', nbPersonnes: 3 } }),
        resa('r-passee', { arrivee: '2026-09-01', depart: '2026-09-04' }),
        resa('r-en-attente', { statut: 'annulee' }),
      ],
    });
    const g = notificationsEntre(avant, apres, MAINTENANT);
    const parCle = new Map(g.map((x) => [x.cle, x]));
    const n = parCle.get('resa-r-nouvelle-creee')?.variantes[0];
    verifier(
      n?.type === 'reservation' && n.titre === 'Nouvelle réservation · Le Nid sous les Toits' && n.corps === 'Inès V., 12–15 nov., 3 nuits · 450 €' && n.url === '/erp/reservations/r-nouvelle',
      `nouvelle réservation : logement, voyageur, dates, nuits, montant (${JSON.stringify(n)})`,
    );
    verifier(!parCle.has('resa-r-passee-creee') && !parCle.has('resa-r-en-attente-creee'), 'réservation passée ou annulée à l’import : pas de notification');
    verifier(parCle.get('resa-r-annulee-annulee')?.variantes[0].titre === 'Réservation annulée · Corbeil Centre Familial', 'réservation annulée');
    const m = parCle.get('resa-r-modif-modif-2026-11-13-2026-11-16-2')?.variantes[0];
    verifier(m?.type === 'reservation_modifiee' && /13–16 nov\., 2 voyageurs \(avant : 12–15 nov\.\)/.test(m.corps), `réservation modifiée, avec les anciennes dates (${m?.corps})`);
    const a = parCle.get('avis-r-avis');
    verifier(a?.urgente === true && a.variantes[0].titre === 'Avis à lire · 3,5 sur 5' && /bruyant/.test(a.variantes[0].corps), `avis sous 4,5 mis en avant (${JSON.stringify(a?.variantes[0])})`);
    verifier(g.length === 4, `rien pour ce qui n’a pas changé (${g.map((x) => x.cle).join(', ')})`);

    // Import en nombre (première connexion) : un résumé.
    const lot = notificationsEntre(instantane({}), instantane({ reservations: Array.from({ length: 9 }, (_, i) => resa(`imp-${i}`)) }), MAINTENANT);
    verifier(lot.length === 1 && lot[0].variantes[0].titre === '9 nouvelles réservations', 'import de 9 réservations d’un coup : une seule notification de résumé');
  }

  section('Messages : une seule notification, la plus importante');
  {
    const base = fil('f1');
    // Nouveau message simple.
    const g1 = notificationsEntre(instantane({ fils: [base] }), instantane({ fils: [{ ...base, messages: [...base.messages, msg('f1-m2', 'voyageur', 'Pouvez-vous me dire où se garer ?')] }] }), MAINTENANT);
    verifier(g1.length === 1 && g1[0].variantes.map((v) => v.type).join() === 'message' && g1[0].variantes[0].titre === 'Clara M. · Le Nid sous les Toits', `nouveau message (${JSON.stringify(g1[0]?.variantes)})`);
    verifier(g1[0].cle === 'fil-f1-f1-m2' && g1[0].variantes[0].url === '/erp/messagerie/f1', 'clé par message, toucher → la conversation');

    // Problème + réponse de l'agent dans le même passage.
    const g2 = notificationsEntre(
      instantane({ fils: [base] }),
      instantane({ fils: [{ ...base, messages: [...base.messages, msg('f1-m3', 'voyageur', 'Il y a une fuite dans la salle de bain'), msg('f1-m4', 'agent', 'Je préviens l’équipe tout de suite.')] }] }),
      MAINTENANT,
    );
    verifier(g2.length === 1 && g2[0].variantes.map((v) => v.type).join() === 'probleme,agent_repondu,message' && g2[0].urgente === true, `problème, puis réponse de l’agent, puis message (${g2[0]?.variantes.map((v) => v.type)})`);
    verifier(g2[0].variantes[0].titre === 'Problème signalé · Le Nid sous les Toits' && /fuite/.test(g2[0].variantes[0].corps), 'titre « Problème signalé · logement »');
    verifier(varianteAEnvoyer(g2[0], {})?.type === 'probleme', 'appareil par défaut : la plus importante');
    verifier(varianteAEnvoyer(g2[0], { probleme: false })?.type === 'agent_repondu', 'problème désactivé : la réponse de l’agent');
    verifier(varianteAEnvoyer(g2[0], { probleme: false, agent_repondu: false, message: false }) === undefined, 'tout désactivé : rien');

    // L'agent passe la main (litige).
    const g3 = notificationsEntre(
      instantane({ fils: [base] }),
      instantane({
        fils: [
          {
            ...base,
            statut: 'escalade',
            traitePar: 'en_attente',
            raisonEscalade: 'argent',
            agent: { decision: 'transmettre', resume: 'Demande un remboursement partiel.', le: '2026-10-26T08:31:00.000Z' },
            messages: [...base.messages, msg('f1-m5', 'voyageur', 'Je voudrais être remboursé d’une nuit')],
          },
        ],
      }),
      MAINTENANT,
    );
    const main = g3[0]?.variantes[0];
    verifier(
      main?.type === 'agent_main' && main.titre === 'Clara M. attend votre réponse' && /question d’argent/.test(main.corps) && /remboursement partiel/.test(main.corps) && g3[0].urgente,
      `l’agent passe la main, raison en clair (${JSON.stringify(main)})`,
    );

    // Historique importé : pas de notification.
    const vieux = fil('f2', { messages: [msg('f2-m1', 'voyageur', 'Merci pour le séjour', '2026-09-01T10:00:00.000Z')] });
    verifier(notificationsEntre(instantane({}), instantane({ fils: [vieux] }), MAINTENANT).length === 0, 'conversation ancienne importée : rien');
    // Réponse de l'équipe : rien.
    verifier(
      notificationsEntre(instantane({ fils: [base] }), instantane({ fils: [{ ...base, messages: [...base.messages, msg('f1-m6', 'hote', 'Bonjour Clara')] }] }), MAINTENANT).length === 0,
      'message de l’équipe : pas de notification',
    );
  }

  section('Notifications planifiées et préférences');
  {
    // Briefing du matin (type « rappel », détaillé dans verifier-briefing.ts) : une version gérant, une version équipe.
    const r: GroupeNotification = {
      cle: 'briefing-2026-10-26',
      variantes: [
        { type: 'rappel', titre: 'Briefing du matin', corps: 'Avec les prix.', url: '/erp', gerant: true },
        { type: 'rappel', titre: 'Briefing du matin', corps: 'Sans les prix.', url: '/erp' },
      ],
    };
    verifier(varianteAEnvoyer(r, {}) === undefined && varianteAEnvoyer(r, { rappel: true })?.corps === 'Sans les prix.', 'briefing du matin désactivé par défaut ; activé : la version de l’équipe');
    verifier(varianteAEnvoyer(r, { rappel: true }, 'gerant')?.corps === 'Avec les prix.' && varianteAEnvoyer(r, { rappel: true }, 'operations')?.corps === 'Sans les prix.', 'variante « gérant » : seulement l’appareil d’un gérant');
    verifier(TYPES_NOTIFICATION.find((t) => t.type === 'rappel')?.libelle === 'Briefing du matin', 'réglage : « Briefing du matin » (même clé « rappel », préférences gardées)');
    const s = synchroEnEchec('2026-10-26', 'Repull ne répond pas');
    verifier(s.cle === 'synchro-2026-10-26' && s.variantes[0].url === '/erp/parametres/plateformes', 'synchronisation en échec : une par jour, vers Plateformes');
    verifier(JSON.stringify(nettoyerPreferences({ message: false, inconnu: true, avis: 'oui' })) === '{"message":false}', 'préférences nettoyées (types connus, booléens)');
  }

  section('Demande à l’ouverture : « Recevoir les notifications ? »');
  {
    const JOUR = 86_400_000;
    const maintenant = Date.parse('2026-10-26T09:00:00Z');
    // iPhone, app de l'écran d'accueil, rien de décidé : on propose.
    const base: ContexteDemandeNotifications = {
      demo: false,
      serveurActif: true,
      permission: 'default',
      navigateurCapable: true,
      iphone: true,
      dansLApp: true,
      abonne: false,
      plusTardLe: null,
      refusee: false,
      propositionInstallation: false,
      autreFenetre: false,
      maintenant,
    };
    const d = (x: Partial<ContexteDemandeNotifications>) => demandeNotifications({ ...base, ...x });
    verifier(d({}) === 'proposer', 'iPhone dans l’app, serveur prêt, rien de décidé : proposer');
    verifier(d({ iphone: false, dansLApp: false }) === 'proposer', 'Android ou ordinateur dans le navigateur : proposer');
    verifier(d({ demo: true }) === 'demo', 'jamais en démonstration');
    verifier(d({ serveurActif: false }) === 'serveur-inactif', 'serveur sans clés : rien');
    verifier(d({ dansLApp: false }) === 'iphone-hors-app', 'Safari sur iPhone, app non installée : rien (proposition d’installation)');
    verifier(d({ dansLApp: false, navigateurCapable: false, permission: 'indisponible' }) === 'iphone-hors-app', 'iPhone sans API de notifications hors de l’app : rien');
    verifier(d({ iphone: false, navigateurCapable: false }) === 'navigateur', 'navigateur sans PushManager : rien');
    verifier(d({ iphone: false, permission: 'indisponible' }) === 'navigateur', 'navigateur sans API Notification : rien');
    verifier(d({ permission: 'granted' }) === 'deja-decide', 'déjà autorisées : rien');
    verifier(d({ permission: 'denied' }) === 'deja-decide', 'déjà refusées dans le navigateur : rien');
    verifier(d({ refusee: true }) === 'refusee', 'refusées depuis la fenêtre : plus jamais reproposées');
    verifier(d({ abonne: true }) === 'abonne', 'appareil déjà abonné : rien');
    verifier(d({ plusTardLe: maintenant - 2 * JOUR }) === 'plus-tard', '« Plus tard » il y a 2 jours : rien');
    verifier(d({ plusTardLe: maintenant - (JOURS_PLUS_TARD_NOTIFICATIONS * JOUR - 60_000) }) === 'plus-tard', '« Plus tard » il y a presque 7 jours : rien');
    verifier(d({ plusTardLe: maintenant - JOURS_PLUS_TARD_NOTIFICATIONS * JOUR }) === 'proposer', '« Plus tard » il y a 7 jours : on repropose');
    verifier(d({ propositionInstallation: true }) === 'installation', 'pas en même temps que la proposition d’installation');
    verifier(d({ autreFenetre: true }) === 'autre-fenetre', 'jamais par-dessus une autre fenêtre');
  }

  section('Envoi : appareils, idempotence, abonnements expirés');
  {
    const cles = { ...(await genererClesVapid()), sujet: 'https://www.labelmaisoncg.fr' };
    const base = new FausseBase();
    const p256dh = await clePubliqueNavigateur();
    const abonnement = (n: string): AbonnementPush => ({ endpoint: `https://fcm.googleapis.com/fcm/send/${n}`, keys: { p256dh, auth: b64url(globalThis.crypto.getRandomValues(new Uint8Array(16))) } });
    await enregistrerAppareil(base, { abonnement: abonnement('telephone'), nom: 'iPhone', par: 'equipe@exemple.fr' });
    await enregistrerAppareil(base, { abonnement: abonnement('ordinateur'), preferences: { message: false }, nom: 'Ordinateur' });
    await enregistrerAppareil(base, { abonnement: abonnement('ancien') });
    verifier((await lireAppareils(base)).length === 3, '3 appareils abonnés');
    const avantMaj = await lireAppareils(base);
    await enregistrerAppareil(base, { abonnement: abonnement('telephone') });
    const tel = (await lireAppareils(base)).find((x) => x.endpoint.endsWith('telephone'));
    verifier(tel?.nom === 'iPhone' && tel.creeLe === avantMaj.find((x) => x.endpoint.endsWith('telephone'))?.creeLe, 'réabonnement : nom et date de création gardés');

    const envois: { endpoint: string; titre: string }[] = [];
    const envoyer = async (a: AbonnementPush, c: unknown) => {
      envois.push({ endpoint: a.endpoint, titre: (c as { titre: string }).titre });
      return a.endpoint.endsWith('ancien') ? { ok: false, statut: 410, expire: true } : { ok: true, statut: 201, expire: false };
    };
    const groupes: GroupeNotification[] = [
      { cle: 'g-message', variantes: [{ type: 'message', titre: 'Message', corps: 'x', url: '/erp/messagerie/f1' }] },
      { cle: 'g-resa', variantes: [{ type: 'reservation', titre: 'Résa', corps: 'y', url: '/erp/reservations/r1' }] },
    ];
    const b1 = await envoyerNotifications(base, groupes, { cles, envoyer, maintenant: MAINTENANT });
    verifier(envois.filter((e) => e.titre === 'Message').length === 2 && !envois.some((e) => e.titre === 'Message' && e.endpoint.endsWith('ordinateur')), 'message désactivé sur l’ordinateur : envoyé aux autres seulement');
    verifier(b1.envoyees === 2 && b1.expires === 1, `bilan : 2 notifications parties, 1 abonnement expiré (${JSON.stringify(b1)})`);
    verifier((await lireAppareils(base)).length === 2, 'abonnement expiré (410) oublié');
    const avant2 = envois.length;
    const b2 = await envoyerNotifications(base, groupes, { cles, envoyer, maintenant: MAINTENANT });
    verifier(envois.length === avant2 && b2.dejaParties === 2, 'second passage : rien ne repart (idempotence)');
    const b3 = await envoyerNotifications(base, [{ cle: 'g-autre', variantes: groupes[0].variantes }], { cles: null, envoyer });
    verifier(b3.envoyees === 0 && envois.length === avant2, 'sans clés serveur : rien n’est envoyé');
    const casse = new FausseBase();
    casse.lire = async () => {
      throw new Error('base indisponible');
    };
    const b4 = await envoyerNotifications(casse, groupes, { cles, envoyer });
    verifier(b4.envoyees === 0, 'base indisponible : aucune erreur levée');
  }

  section('Prix à revoir : appareils du gérant seulement');
  {
    const cles = { ...(await genererClesVapid()), sujet: 'https://www.labelmaisoncg.fr' };
    const base = new FausseBase();
    const p256dh = await clePubliqueNavigateur();
    const abonnement = (n: string): AbonnementPush => ({ endpoint: `https://fcm.googleapis.com/fcm/send/${n}`, keys: { p256dh, auth: b64url(globalThis.crypto.getRandomValues(new Uint8Array(16))) } });
    await enregistrerAppareil(base, { abonnement: abonnement('gerant'), par: 'gerant@exemple.fr', role: 'gerant' });
    await enregistrerAppareil(base, { abonnement: abonnement('ops'), preferences: { prix: true }, par: 'ops@exemple.fr', role: 'operations' });
    await enregistrerAppareil(base, { abonnement: abonnement('ancien'), preferences: { prix: true } });
    const recus: string[] = [];
    const envoyer = async (a: AbonnementPush, c: unknown) => {
      recus.push(`${a.endpoint.split('/').pop()}:${(c as { type: string }).type}`);
      return { ok: true, statut: 201, expire: false };
    };
    const prix: GroupeNotification = { cle: 'prix-2026-10-27', variantes: [{ type: 'prix', titre: 'Prix à revoir · Massy', corps: 'Baissez à 79 €', url: '/erp/logements' }] };
    const message: GroupeNotification = { cle: 'g-message-2', variantes: [{ type: 'message', titre: 'Message', corps: 'x', url: '/erp/messagerie/f1' }] };
    await envoyerNotifications(base, [prix, message], { cles, envoyer, maintenant: MAINTENANT });
    verifier(recus.includes('gerant:prix'), 'prix : envoyé à l’appareil du gérant');
    verifier(!recus.includes('ops:prix'), 'prix : jamais à l’appareil d’un membre « opérations », même activé sur l’appareil');
    verifier(!recus.includes('ancien:prix'), 'prix : jamais à un appareil dont le rôle est inconnu (abonné avant)');
    verifier(recus.includes('ops:message') && recus.includes('ancien:message'), 'les autres types partent à tous les appareils');
    verifier(preferencesPourRole({ prix: true, message: true }, 'operations').prix === false && preferencesPourRole({ prix: true }, 'gerant').prix === true, 'préférences appliquées selon le rôle');
    verifier(!typePourRole('prix', 'operations') && !typePourRole('prix', undefined) && typePourRole('prix', 'gerant') && typePourRole('message', 'lecture'), 'réglage « Prix à revoir » proposé au gérant seul');

    const ancien = (await lireAppareils(base)).find((x) => x.endpoint.endsWith('ancien'))!;
    await majRoleAppareil(base, ancien, 'gerant');
    const ops = (await lireAppareils(base)).find((x) => x.endpoint.endsWith('ops'))!;
    await reglerAppareil(base, ops.endpoint, { prix: true }, 'operations');
    recus.length = 0;
    await envoyerNotifications(base, [{ ...prix, cle: 'prix-2026-10-28' }], { cles, envoyer, maintenant: MAINTENANT });
    verifier(recus.includes('ancien:prix') && !recus.includes('ops:prix'), 'rôle mis à jour à l’ouverture des réglages : l’ancien appareil du gérant reçoit de nouveau les prix');
    const parOps = await enregistrerAppareil(base, { abonnement: abonnement('gerant'), par: 'ops@exemple.fr', role: 'operations' });
    verifier(parOps.role === 'operations', 'réabonnement par un autre compte : le rôle de ce compte remplace l’ancien');
  }

  section('Nouvelle demande à appeler (CRM)');
  {
    const contact = {
      id: 'crm-abc',
      nom: 'Marie Dupont',
      telephone: '06 12 34 56 78',
      email: 'marie@exemple.fr',
      ville: 'Évry-Courcouronnes',
      source: 'audit' as const,
      creeLe: '2026-10-29T10:12:00+01:00',
      majLe: '2026-10-29T10:12:00+01:00',
      historique: [{ le: '2026-10-29T10:12:00+01:00', par: 'Site web', resultat: 'formulaire' as const }],
    };
    const g = notificationNouveauLead(contact, { nouveau: true });
    const v = g.variantes[0];
    verifier(v.type === 'lead' && v.titre === 'Nouvelle demande à appeler' && v.corps === 'Marie D. · Évry-Courcouronnes · Demande d’audit', `contenu : « ${v.titre} », « ${v.corps} »`);
    verifier(v.url === '/erp/crm?contact=crm-abc' && g.urgente === true && v.gerant === true, 'ouvre la fiche du contact dans le CRM ; livrée tout de suite ; gérant seulement');
    verifier(!JSON.stringify(g).includes('06 12') && !JSON.stringify(g).includes('marie@') && !JSON.stringify(g).includes('Dupont'), 'écran verrouillé : ni téléphone, ni e-mail, ni nom de famille');
    const parEmail = notificationNouveauLead({ ...contact, nom: 'marie@exemple.fr', ville: undefined }, { nouveau: true });
    verifier(parEmail.variantes[0].corps === 'Un nouveau contact · Demande d’audit', 'nom qui est l’adresse e-mail : « Un nouveau contact »');
    const redemande = notificationNouveauLead({ ...contact, source: 'dossier', historique: [{ le: '2026-11-02T09:00:00+01:00', par: 'Site web', resultat: 'formulaire' as const }, ...contact.historique] }, { nouveau: false });
    verifier(redemande.cle !== g.cle && redemande.variantes[0].titre === 'Nouvelle demande d’un contact connu' && redemande.variantes[0].corps.endsWith('Dossier propriétaire rempli'), 'la même personne redemande : une nouvelle notification');
    verifier(TYPES_NOTIFICATION.some((t) => t.type === 'lead' && t.defaut) && typePourRole('lead', 'gerant') && !typePourRole('lead', 'operations') && !typePourRole('lead', undefined), 'réglage « Nouvelle demande à appeler » : activé par défaut, proposé au gérant seul');

    const cles = { ...(await genererClesVapid()), sujet: 'https://www.labelmaisoncg.fr' };
    const base = new FausseBase();
    const p256dh = await clePubliqueNavigateur();
    const abonnement = (n: string): AbonnementPush => ({ endpoint: `https://web.push.apple.com/${n}`, keys: { p256dh, auth: b64url(globalThis.crypto.getRandomValues(new Uint8Array(16))) } });
    await enregistrerAppareil(base, { abonnement: abonnement('abdel'), par: 'gerant@exemple.fr', role: 'gerant' });
    await enregistrerAppareil(base, { abonnement: abonnement('ops'), preferences: { lead: true }, par: 'ops@exemple.fr', role: 'operations' });
    await enregistrerAppareil(base, { abonnement: abonnement('ancien'), preferences: { lead: true } });
    await enregistrerAppareil(base, { abonnement: abonnement('coupe'), par: 'gerant2@exemple.fr', role: 'gerant', preferences: { lead: false } });
    const recus: string[] = [];
    const envoyer = async (a: AbonnementPush, c: unknown) => {
      recus.push(`${a.endpoint.split('/').pop()}:${(c as { type: string }).type}`);
      return { ok: true, statut: 201, expire: false };
    };
    const b1 = await envoyerNotifications(base, [g], { cles, envoyer, maintenant: MAINTENANT });
    verifier(recus.join(',') === 'abdel:lead', `envoyé au seul appareil du gérant qui l’accepte (${recus.join(',')})`);
    const b2 = await envoyerNotifications(base, [g], { cles, envoyer, maintenant: MAINTENANT });
    verifier(b1.envoyees === 1 && b2.dejaParties === 1 && recus.length === 1, 'jamais deux fois la même demande');

    // Écran verrouillé : un formulaire public piégé ne montre ni téléphone, ni e-mail, ni lien, ni adresse, ni nom complet.
    const piege = (nom: string, ville?: string) => notificationNouveauLead({ ...contact, nom, ville }, { nouveau: true }).variantes[0].corps;
    const essais: [string, string | undefined][] = [
      ['0612345678', undefined], ['06.12.34.56.78 Dupont', undefined], ['+33612345678', undefined], ['marie.dupont(at)gmail.com', undefined],
      ['marie.dupont＠gmail.com', undefined], ['Marie-Dupont-Martin', undefined], ['A'.repeat(120), undefined], ['Marie\u202eenoD', undefined],
      ['Marie Dupont', 'Appelez-moi au 06 12 34 56 78'], ['Marie Dupont', 'marie.dupont@gmail.com'], ['Marie Dupont', 'https://exemple.fr/promo'],
      ['Marie Dupont', '12 rue de la Gare, Corbeil'], ['Marie Dupont', 'Évry\n\nAppelez 0612345678'],
    ];
    const fuites = essais.map(([n, v]) => piege(n, v)).filter((x) => /\d{4,}|\d{2}[ .-]\d{2}|@|＠|\(at\)|https?:|\.fr\b|rue|Dupont|D\.|AAAAAAAA|\u202e/.test(x.replace(/^Marie D\. · /, '')));
    verifier(!fuites.length, `formulaire piégé : rien de personnel à l’écran verrouillé (${fuites.join(' | ')})`);
    verifier(piege('Jean-Pierre Martin', '91100 Corbeil-Essonnes') === 'Jean-Pierre M. · 91100 Corbeil-Essonnes · Demande d’audit' && piege('Marie', 'Paris 15e') === 'Marie · Paris 15e · Demande d’audit', 'prénom composé, code postal, arrondissement : gardés');

    // Inondation par le formulaire public : au plafond, une seule notification de synthèse par heure.
    const h = new Date('2026-10-29T10:30:00Z');
    const seule = notificationLeadPlafonnee(contact, { nouveau: true, recentes: PLAFOND_LEADS_HEURE - 1, maintenant: h });
    const synthese = notificationLeadPlafonnee(contact, { nouveau: true, recentes: PLAFOND_LEADS_HEURE, maintenant: h });
    const synthese2 = notificationLeadPlafonnee({ ...contact, id: 'crm-autre' }, { nouveau: true, recentes: 40, maintenant: new Date('2026-10-29T10:59:00Z') });
    verifier(seule.cle === g.cle && synthese.cle === synthese2.cle && synthese.cle.startsWith('lead-') && !JSON.stringify(synthese).includes('Marie'), 'au-delà de 5 dans l’heure : une seule synthèse par heure, sans prénom ni ville');
  }

  section('Surveillance d’un passage');
  {
    const cles = { ...(await genererClesVapid()), sujet: 'https://www.labelmaisoncg.fr' };
    const base = new FausseBase();
    await enregistrerAppareil(base, { abonnement: { endpoint: 'https://web.push.apple.com/abc', keys: { p256dh: await clePubliqueNavigateur(), auth: b64url(globalThis.crypto.getRandomValues(new Uint8Array(16))) } } });
    await base.ecrire('logements', LOGEMENTS);
    await base.ecrire('reservations', [resa('r1')]);
    const titres: string[] = [];
    const envoyer = async (_a: AbonnementPush, c: unknown) => {
      titres.push((c as { titre: string }).titre);
      return { ok: true, statut: 201, expire: false };
    };
    const r = await surveiller(
      base,
      async () => {
        await base.ecrire('reservations', [resa('r1'), resa('r2', { logementId: 'l2' })]);
        return 'fait';
      },
      { cles, envoyer, maintenant: () => MAINTENANT },
    );
    verifier(r === 'fait' && titres.join() === 'Nouvelle réservation · Le Nid sous les Toits', `nouveauté repérée et envoyée après le passage (${titres.join(' | ')})`);
    let relancee = false;
    try {
      await surveiller(
        base,
        async () => {
          throw new Error('Repull indisponible');
        },
        { cles, envoyer, maintenant: () => MAINTENANT, enEchec: (e) => [synchroEnEchec('2026-10-26', String((e as Error).message))] },
      );
    } catch {
      relancee = true;
    }
    verifier(relancee && titres.includes('Airbnb et Booking : mise à jour en échec'), 'passage en échec : notification envoyée, erreur relancée telle quelle');
    let lectures = 0;
    const comptee = new FausseBase();
    const lire = comptee.lire.bind(comptee);
    comptee.lire = async <T,>(c: string, ids?: string[]) => {
      lectures++;
      return lire<T>(c, ids);
    };
    await surveiller(comptee, async () => 'ok', { cles: null });
    verifier(lectures === 0, 'sans clés serveur : aucune lecture de plus');
  }

  console.log(`\n${reussis} contrôles réussis, ${echecs} en échec.`);
  if (echecs) throw new Error(`${echecs} contrôle(s) en échec`);
}

void principal();
