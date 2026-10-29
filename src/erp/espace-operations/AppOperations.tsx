/**
 * L'app « Opérations » dans l'espace : l'entrée de l'en-tête (« Installer
 * l'app », puis « Notifications » une fois installée), sa feuille
 * (installation et notifications de ce téléphone) et la demande à la
 * première ouverture, avec les mêmes règles que l'ERP (`demandeNotifications`,
 * data/notifications.ts) : jamais en démonstration, jamais après un refus,
 * « Plus tard » retenu, sur iPhone seulement dans l'app installée, et
 * l'autorisation du système demandée dans le toucher sur « Activer ».
 */
import { useCallback, useEffect, useReducer, useRef, useState, type ReactNode } from 'react';
import { Bell, Check, CheckCircle2, Download, EllipsisVertical, Share, SquarePlus } from 'lucide-react';
import { demandeNotifications, type ContexteDemandeNotifications } from '../data/notifications';
import { phraseNotificationsOps } from '../data/notifications-operations';
import { b64url, deB64url } from '../data/web-push';
import { Alert, Button, Modal } from '../ui';
import {
  NOM_APPAREIL_OPS,
  NOM_APP_OPS,
  abonnementOps,
  appareilOps,
  autorisationOps,
  dejaInstallee,
  installationDirecte,
  installerApp,
  notificationsPossiblesOps,
  ouverteEnApp,
  sAbonnerOps,
  seDesabonnerOps,
  surChangementInstallation,
  versAbonnementOps,
  type AppareilOps,
} from './app-operations';

/**
 * Captures d'écran seulement (build de démo avec VITE_ERP_APERCU_NOTIFICATIONS=1,
 * comme l'ERP) : la demande et la feuille se montrent malgré la démo, sans
 * serveur. Absent des builds de production.
 */
const APERCU = import.meta.env.VITE_ERP_APERCU_NOTIFICATIONS === '1';
const CLE_PLUS_TARD = 'lm-ops-notifications-plus-tard';
const CLE_REFUSEE = 'lm-ops-notifications-refusees';
/** Laisse l'espace s'afficher avant de demander. */
const DELAI_MS = 1500;

/** Ce que la page sait demander au serveur (session de l'espace) ; absent en démonstration. */
export interface ServeurNotificationsOps {
  etat: (endpoint: string | null) => Promise<{ actif: boolean; clePublique: string | null; abonne: boolean }>;
  abonner: (abonnement: { endpoint: string; keys: { p256dh: string; auth: string } }, nom: string) => Promise<void>;
  desabonner: (endpoint: string) => Promise<void>;
  tester: (endpoint: string) => Promise<void>;
}

export type EtapeNotificationsOps = 'chargement' | 'demo' | 'serveur-inactif' | 'iphone-hors-app' | 'navigateur' | 'refusee' | 'a-activer' | 'actives' | 'erreur';

export type ResultatActivationOps = 'activee' | 'refusee' | 'ignoree';

interface Retour {
  ton: 'succes' | 'danger' | 'neutre';
  texte: string;
}

function lire(cle: string): string | null {
  try {
    return window.localStorage.getItem(cle);
  } catch {
    return null;
  }
}

function retenir(cle: string, valeur: string): void {
  try {
    window.localStorage.setItem(cle, valeur);
  } catch {
    /* préférence non retenue : la question pourra revenir */
  }
}

/** Les messages du serveur sont en français ; ceux du navigateur (anglais, techniques) sont remplacés. */
const message = (e: unknown, defaut: string) => (e instanceof ErreurOps ? e.message : defaut);

/** Erreur lisible du serveur de l'espace. */
export class ErreurOps extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

/**
 * L'app sur ce téléphone : installation et notifications. `serveur` : absent
 * en démonstration ; `connecte` : la session est ouverte (le serveur n'est
 * interrogé qu'à partir de là).
 */
export function useAppOps(serveur: ServeurNotificationsOps | null, connecte: boolean) {
  const [, actualiser] = useReducer((n: number) => n + 1, 0);
  const appareil = appareilOps();
  const dansLApp = ouverteEnApp();
  const [etape, setEtape] = useState<EtapeNotificationsOps>(serveur || APERCU ? 'chargement' : 'demo');
  const [serveurActif, setServeurActif] = useState(false);
  const [cle, setCle] = useState<string | null>(null);
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [occupe, setOccupe] = useState<'activer' | 'tester' | 'couper' | null>(null);
  const [retour, setRetour] = useState<Retour | null>(null);

  useEffect(() => {
    const arreter = surChangementInstallation(actualiser);
    const mq = typeof window.matchMedia === 'function' ? window.matchMedia('(display-mode: standalone)') : null;
    mq?.addEventListener?.('change', actualiser);
    return () => {
      arreter();
      mq?.removeEventListener?.('change', actualiser);
    };
  }, []);

  const relire = useCallback(async () => {
    if (!serveur) {
      if (APERCU) {
        setServeurActif(true);
        setCle('apercu');
        setEtape('a-activer');
      } else setEtape('demo');
      return;
    }
    try {
      const horsApp = appareilOps() === 'iphone' && !ouverteEnApp();
      const s = notificationsPossiblesOps() && !horsApp ? await abonnementOps() : null;
      const r = await serveur.etat(s?.endpoint ?? null);
      let abonne = r.abonne;
      // Autorisation déjà donnée et abonnement présent, mais inconnu du serveur (accès renouvelé,
      // nouvelle connexion) : relié à la personne connectée sans rien redemander.
      const memeCle = (() => {
        const k = s?.options?.applicationServerKey;
        return !!k && !!r.clePublique && b64url(new Uint8Array(k)) === b64url(deB64url(r.clePublique));
      })();
      if (s && !abonne && r.actif && autorisationOps() === 'accordee' && memeCle) {
        abonne = await serveur.abonner(versAbonnementOps(s), NOM_APPAREIL_OPS[appareilOps()]).then(
          () => true,
          () => false,
        );
      }
      setServeurActif(!!r.actif && !!r.clePublique);
      setCle(r.clePublique);
      setEndpoint(abonne ? (s?.endpoint ?? null) : null);
      if (!r.actif || !r.clePublique) setEtape('serveur-inactif');
      else if (horsApp) setEtape('iphone-hors-app');
      else if (!notificationsPossiblesOps()) setEtape('navigateur');
      else if (autorisationOps() === 'refusee') setEtape('refusee');
      else setEtape(abonne ? 'actives' : 'a-activer');
    } catch {
      setEtape('erreur');
    }
  }, [serveur]);

  useEffect(() => {
    if (serveur && !connecte) return;
    void relire();
  }, [relire, serveur, connecte]);

  /** Dans le geste de l'utilisateur : autorisation du système, abonnement, puis enregistrement sur le serveur. */
  const activer = useCallback(async (): Promise<ResultatActivationOps> => {
    if (!cle || occupe) return 'ignoree';
    setOccupe('activer');
    setRetour(null);
    try {
      if (!serveur) {
        // Aperçu des captures : rien ne part.
        setEtape('actives');
        return 'activee';
      }
      const s = await sAbonnerOps(cle);
      if (!s) {
        const a = autorisationOps();
        if (a === 'refusee') {
          setEtape('refusee');
          return 'refusee';
        }
        if (a === 'accordee') throw new Error('abonnement impossible');
        return 'ignoree';
      }
      await serveur.abonner(versAbonnementOps(s), NOM_APPAREIL_OPS[appareilOps()]);
      setEndpoint(s.endpoint);
      setEtape('actives');
      return 'activee';
    } catch (e) {
      setRetour({ ton: 'danger', texte: message(e, 'L’activation n’a pas abouti sur cet appareil. Réessayez dans un instant.') });
      throw e;
    } finally {
      setOccupe(null);
    }
  }, [cle, occupe, serveur]);

  const tester = useCallback(async () => {
    if (!serveur || !endpoint || occupe) return;
    setOccupe('tester');
    setRetour(null);
    try {
      await serveur.tester(endpoint);
      setRetour({ ton: 'succes', texte: 'Notification envoyée : elle arrive dans quelques secondes.' });
    } catch (e) {
      setRetour({ ton: 'danger', texte: message(e, 'L’envoi n’a pas abouti. Réessayez dans un instant.') });
      if (e instanceof ErreurOps && e.code === 'inconnu') setEtape('a-activer');
    } finally {
      setOccupe(null);
    }
  }, [serveur, endpoint, occupe]);

  /** « Couper » : plus rien sur ce téléphone, même après une nouvelle connexion. */
  const couper = useCallback(async () => {
    if (occupe) return;
    setOccupe('couper');
    setRetour(null);
    try {
      const ep = (await seDesabonnerOps()) ?? endpoint;
      if (serveur && ep) await serveur.desabonner(ep);
      setEndpoint(null);
      setEtape('a-activer');
      setRetour({ ton: 'neutre', texte: 'Notifications désactivées sur cet appareil.' });
    } catch (e) {
      setRetour({ ton: 'danger', texte: message(e, 'L’action n’a pas abouti. Réessayez dans un instant.') });
    } finally {
      setOccupe(null);
    }
  }, [serveur, endpoint, occupe]);

  /** Déconnexion : le serveur oublie ce téléphone (rien n'arrive plus pour cette personne). */
  const oublierAvantDeSortir = useCallback(async () => {
    if (serveur && endpoint) await serveur.desabonner(endpoint).catch(() => undefined);
  }, [serveur, endpoint]);

  const installer = useCallback(async () => {
    const ok = await installerApp();
    actualiser();
    return ok;
  }, []);

  return {
    appareil,
    dansLApp,
    installee: dejaInstallee(),
    directe: installationDirecte(),
    installer,
    etape,
    serveurActif,
    occupe,
    retour,
    effacerRetour: () => setRetour(null),
    activer,
    tester,
    couper,
    relire,
    oublierAvantDeSortir,
  };
}

export type AppOps = ReturnType<typeof useAppOps>;

/* --------------------------------------------------- entrée de l'en-tête */

/** « Installer l'app » tant qu'elle ne l'est pas, puis « Notifications ». */
export function EntreeApp({ app, onOuvrir }: { app: AppOps; onOuvrir: () => void }) {
  const installee = app.installee || app.dansLApp;
  const libelle = installee ? 'Notifications' : 'Installer l’app';
  return (
    <button
      type="button"
      onClick={onOuvrir}
      aria-label={libelle}
      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-(--lm-encre-2) hover:bg-(--lm-surface-2) hover:text-(--lm-encre) focus-visible:ring-2 focus-visible:ring-(--lm-encre) focus:outline-none"
    >
      {installee ? <Bell className="size-4" aria-hidden /> : <Download className="size-4" aria-hidden />}
      <span className="max-lg:sr-only">{libelle}</span>
    </button>
  );
}

/* ------------------------------------------------ étapes d'installation */

const Icone = ({ children }: { children: ReactNode }) => (
  <span aria-hidden className="mx-0.5 inline-grid size-6 place-items-center rounded-md bg-(--lm-surface-2) align-[-6px] text-(--lm-encre) [&_svg]:size-4">
    {children}
  </span>
);

/** Le navigateur conseillé pour installer est-il déjà celui-ci (Safari sur iPhone, Chrome sur Android) ? */
function bonNavigateur(a: AppareilOps): boolean {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent || '';
  if (a === 'iphone') return /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA|FBAN|FBAV|Instagram/.test(ua);
  if (a === 'android') return /Chrome/.test(ua) && !/EdgA|SamsungBrowser|Firefox|OPR|FBAN|FBAV|Instagram/.test(ua);
  return true;
}

const fort = (t: string) => <strong className="font-semibold">{t}</strong>;

/** Les étapes, avec les mots de l'appareil. */
export function etapesInstallationOps(a: AppareilOps): ReactNode[] {
  const ouvrir = !bonNavigateur(a);
  if (a === 'iphone') {
    return [
      ...(ouvrir ? [<>Ouvrez cette page dans {fort('Safari')}.</>] : []),
      <>
        Touchez{' '}
        <Icone>
          <Share />
        </Icone>{' '}
        {fort('Partager')}, en bas de l’écran (en haut sur iPad).
      </>,
      <>
        Choisissez{' '}
        <Icone>
          <SquarePlus />
        </Icone>{' '}
        {fort('Sur l’écran d’accueil')}, puis {fort('Ajouter')}.
      </>,
      <>Ouvrez l’app {fort(NOM_APP_OPS)} et connectez-vous une fois : demandez votre lien, puis collez-le dans l’app.</>,
    ];
  }
  if (a === 'android') {
    return [
      ...(ouvrir ? [<>Ouvrez cette page dans {fort('Chrome')}.</>] : []),
      <>
        Touchez{' '}
        <Icone>
          <EllipsisVertical />
        </Icone>{' '}
        en haut à droite, puis {fort('Installer l’application')} (ou « Ajouter à l’écran d’accueil »).
      </>,
      <>Ouvrez l’app {fort(NOM_APP_OPS)} depuis l’écran d’accueil.</>,
    ];
  }
  return [
    <>
      Dans {fort('Chrome')} ou {fort('Edge')} : cliquez sur l’icône d’installation, à droite de la barre d’adresse.
    </>,
    <>
      Sur Mac avec {fort('Safari')} : menu Fichier, puis {fort('Ajouter au Dock')}.
    </>,
  ];
}

function EtapesInstallationOps({ appareil }: { appareil: AppareilOps }) {
  return (
    <ol className="flex flex-col gap-3">
      {etapesInstallationOps(appareil).map((e, i) => (
        <li key={i} className="flex items-start gap-3 text-[14px] leading-relaxed text-(--lm-encre)">
          <span aria-hidden className="mt-px grid size-6 shrink-0 place-items-center rounded-full bg-(--lm-surface-2) text-[12.5px] font-semibold text-(--lm-encre)">
            {i + 1}
          </span>
          <span className="min-w-0">{e}</span>
        </li>
      ))}
    </ol>
  );
}

/* ---------------------------------------------------------- la feuille */

const Fait = ({ children }: { children: ReactNode }) => (
  <p className="flex items-start gap-2 text-[14px] text-(--lm-encre)">
    <Check className="mt-0.5 size-4 shrink-0 text-(--lm-succes)" aria-hidden />
    <span>{children}</span>
  </p>
);

const TITRE_ETAPES: Record<AppareilOps, string> = { iphone: 'Sur votre iPhone', android: 'Sur votre téléphone Android', ordinateur: 'Sur votre ordinateur' };

/** Ce que reçoit la personne (une phrase, partout la même), tirée de NOTIFICATIONS_OPS : les cinq notifications. */
export const CE_QUE_VOUS_RECEVEZ = phraseNotificationsOps();

/**
 * L'app sur ce téléphone : l'installer (un toucher quand le navigateur le
 * permet, sinon les étapes), puis les notifications. Un seul bouton
 * principal : installer tant que c'est possible d'un toucher, sinon activer.
 */
export function FeuilleApp({ ouvert, onFermer, app }: { ouvert: boolean; onFermer: () => void; app: AppOps }) {
  const installee = app.installee || app.dansLApp;
  const installerEnPremier = !installee && app.directe;
  const fermer = () => {
    app.effacerRetour();
    onFermer();
  };

  let notifications: ReactNode;
  switch (app.etape) {
    case 'chargement':
      notifications = <p className="text-[14px] text-(--lm-encre-2)">Vérification…</p>;
      break;
    case 'demo':
      notifications = <p className="text-[14px] text-(--lm-encre-2)">Démonstration : aucune notification n’est envoyée.</p>;
      break;
    case 'serveur-inactif':
      notifications = <p className="text-[14px] text-(--lm-encre-2)">Pas encore ouvertes par votre conciergerie.</p>;
      break;
    case 'iphone-hors-app':
      notifications = <p className="text-[14px] text-(--lm-encre-2)">Sur iPhone, elles arrivent dans l’app : installez-la, puis activez-les depuis l’app.</p>;
      break;
    case 'navigateur':
      notifications = <p className="text-[14px] text-(--lm-encre-2)">Ce navigateur ne les reçoit pas. Sur iPhone : iOS 16.4 ou plus récent, dans l’app installée.</p>;
      break;
    case 'refusee':
      notifications = (
        <p className="text-[14px] text-(--lm-encre-2)">
          Refusées sur cet appareil. Pour les activer :{' '}
          {app.appareil === 'iphone' ? `Réglages de l’iPhone → Notifications → ${NOM_APP_OPS}.` : 'réglages du navigateur (cadenas à gauche de l’adresse → Notifications).'}
        </p>
      );
      break;
    case 'erreur':
      notifications = (
        <div className="flex flex-wrap items-center gap-2">
          <p className="min-w-0 flex-1 text-[14px] text-(--lm-encre-2)">Impossible de vérifier pour l’instant.</p>
          <Button size="sm" onClick={() => void app.relire()}>
            Réessayer
          </Button>
        </div>
      );
      break;
    case 'actives':
      notifications = (
        <div className="flex flex-col gap-3">
          <Fait>Activées sur cet appareil.</Fait>
          <div className="flex flex-wrap gap-2">
            <Button chargement={app.occupe === 'tester'} disabled={!!app.occupe && app.occupe !== 'tester'} onClick={() => void app.tester()}>
              Envoyer une notification de test
            </Button>
            <Button variant="ghost" chargement={app.occupe === 'couper'} disabled={!!app.occupe && app.occupe !== 'couper'} onClick={() => void app.couper()}>
              Désactiver
            </Button>
          </div>
        </div>
      );
      break;
    default:
      notifications = (
        <Button
          variant={installerEnPremier ? 'secondary' : 'primary'}
          size="lg"
          icone={<Bell />}
          className="w-full"
          chargement={app.occupe === 'activer'}
          onClick={() => void app.activer().catch(() => undefined)}
        >
          Activer les notifications
        </Button>
      );
  }

  return (
    <Modal ouvert={ouvert} onFermer={fermer} taille="sm" titre={`L’app ${NOM_APP_OPS}`} description="Votre espace sur l’écran d’accueil, comme une vraie app.">
      <div className="flex flex-col gap-5">
        <section aria-labelledby="app-ops-installation">
          <h3 id="app-ops-installation" className="mb-2 text-[15px] font-semibold text-(--lm-encre)">
            {installee ? 'Installation' : TITRE_ETAPES[app.appareil]}
          </h3>
          {app.dansLApp ? (
            <Fait>L’app est installée sur cet appareil.</Fait>
          ) : app.installee ? (
            <Fait>Déjà installée : ouvrez l’app {NOM_APP_OPS} depuis l’écran d’accueil.</Fait>
          ) : app.directe ? (
            <Button variant="primary" size="lg" icone={<Download />} className="w-full" onClick={() => void app.installer()}>
              Installer l’app
            </Button>
          ) : (
            <EtapesInstallationOps appareil={app.appareil} />
          )}
        </section>
        <section aria-labelledby="app-ops-notifications" className="border-t border-(--lm-bord) pt-4">
          <h3 id="app-ops-notifications" className="text-[15px] font-semibold text-(--lm-encre)">
            Notifications
          </h3>
          <p className="mt-0.5 mb-3 text-[13px] text-(--lm-encre-2)">{CE_QUE_VOUS_RECEVEZ}</p>
          {notifications}
          {app.retour && (
            <Alert tone={app.retour.ton} className="mt-3">
              {app.retour.texte}
            </Alert>
          )}
        </section>
      </div>
    </Modal>
  );
}

/* ------------------------------------- demande à la première ouverture */

/**
 * « Recevoir les notifications ? » à l'ouverture de l'espace : feuille du
 * bas sur téléphone, fenêtre sur ordinateur. `pret` : l'espace est affiché.
 */
export function DemandeNotificationsOps({ app, pret }: { app: AppOps; pret: boolean }) {
  const [phase, setPhase] = useState<'fermee' | 'question' | 'refusee'>('fermee');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [activees, setActivees] = useState(false);
  const etat = useRef(app);
  useEffect(() => {
    etat.current = app;
  });
  const decidable = pret && app.etape !== 'chargement';

  useEffect(() => {
    if (!decidable) return;
    const t = window.setTimeout(() => {
      const a = etat.current;
      const plusTard = Number(lire(CLE_PLUS_TARD));
      const contexte: ContexteDemandeNotifications = {
        demo: a.etape === 'demo',
        serveurActif: a.serveurActif,
        permission: APERCU ? 'default' : typeof Notification === 'undefined' ? 'indisponible' : Notification.permission,
        navigateurCapable: APERCU || notificationsPossiblesOps(),
        iphone: a.appareil === 'iphone',
        dansLApp: APERCU || a.dansLApp,
        abonne: a.etape === 'actives',
        plusTardLe: Number.isFinite(plusTard) && plusTard > 0 ? plusTard : null,
        refusee: lire(CLE_REFUSEE) === '1',
        propositionInstallation: false,
        autreFenetre: !!document.querySelector('[role="dialog"][aria-modal="true"]'),
        maintenant: Date.now(),
      };
      if (demandeNotifications(contexte) === 'proposer' && a.etape === 'a-activer') setPhase('question');
    }, DELAI_MS);
    return () => window.clearTimeout(t);
  }, [decidable]);

  useEffect(() => {
    if (!activees) return;
    const t = window.setTimeout(() => setActivees(false), 3500);
    return () => window.clearTimeout(t);
  }, [activees]);

  const plusTard = () => {
    retenir(CLE_PLUS_TARD, String(Date.now()));
    setPhase('fermee');
  };

  // Appelé directement par le toucher : l'autorisation du système part dans ce geste.
  const activer = async () => {
    if (enCours) return;
    setEnCours(true);
    setErreur(null);
    try {
      const r = await app.activer();
      if (r === 'activee') {
        setPhase('fermee');
        setActivees(true);
      } else if (r === 'refusee') {
        retenir(CLE_REFUSEE, '1');
        setPhase('refusee');
      } else plusTard();
    } catch (e) {
      setErreur(message(e, 'L’activation n’a pas abouti sur cet appareil. Réessayez dans un instant.'));
    } finally {
      setEnCours(false);
      app.effacerRetour();
    }
  };

  return (
    <>
      <Modal
        ouvert={phase === 'question'}
        onFermer={plusTard}
        taille="sm"
        titre="Recevoir les notifications ?"
        description={CE_QUE_VOUS_RECEVEZ}
        pied={
          <>
            <Button variant="ghost" onClick={plusTard} disabled={enCours}>
              Plus tard
            </Button>
            <Button variant="primary" chargement={enCours} onClick={() => void activer()}>
              Activer
            </Button>
          </>
        }
      >
        {erreur && <Alert tone="danger">{erreur} Vous pourrez aussi les activer avec « Notifications », en haut de l’écran.</Alert>}
      </Modal>

      <Modal
        ouvert={phase === 'refusee'}
        onFermer={() => setPhase('fermee')}
        taille="sm"
        titre="Notifications refusées"
        description={
          app.appareil === 'iphone'
            ? `Pour les activer plus tard : Réglages de l’iPhone → Notifications → ${NOM_APP_OPS}.`
            : 'Pour les activer plus tard : réglages du navigateur (cadenas à gauche de l’adresse → Notifications).'
        }
        pied={
          <Button variant="primary" onClick={() => setPhase('fermee')}>
            OK
          </Button>
        }
      />

      {activees && (
        <div className="pointer-events-none fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 flex justify-center sm:inset-x-auto sm:right-5 sm:bottom-5">
          <p
            role="status"
            className="lm-apparition flex items-center gap-2 rounded-xl border border-(--lm-succes)/30 bg-(--lm-surface) px-3.5 py-2.5 text-[13.5px] font-medium text-(--lm-encre) shadow-(--lm-ombre-haute)"
          >
            <CheckCircle2 className="size-[18px] shrink-0 text-(--lm-succes)" aria-hidden />
            Notifications activées
          </p>
        </div>
      )}
    </>
  );
}
