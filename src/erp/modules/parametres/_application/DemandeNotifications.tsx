/**
 * « Recevoir les notifications ? » à l'ouverture de l'ERP, sans passer par
 * Paramètres : feuille du bas sur téléphone, fenêtre sur ordinateur. Les
 * conditions sont dans `demandeNotifications` (data/notifications.ts,
 * contrôlées par verifier-notifications.ts). L'autorisation du système part
 * du toucher sur « Activer » (obligatoire sur iPhone), jamais au chargement.
 */
import { useEffect, useRef, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { appareil, estInstallee, notificationsPossibles } from '../../../data/application';
import { demandeNotifications, type ContexteDemandeNotifications } from '../../../data/notifications';
import { useErp } from '../../../data/store';
import { Alert, Button, Modal } from '../../../ui';
import { activerSurCetAppareil, serveurNotifications } from './notifications';
import { propositionInstallationVisible, signalerDemandeNotifications } from './PropositionInstallation';
import { useInstallation } from './installation';

const CLE_PLUS_TARD = 'lm-erp-notifications-plus-tard';
const CLE_REFUSEE = 'lm-erp-notifications-refusees';
/** Laisse la page s'installer (et le navigateur proposer l'installation) avant de demander. */
const DELAI_MS = 1500;
/**
 * Captures d'écran seulement (build de démo avec VITE_ERP_APERCU_NOTIFICATIONS=1) :
 * la fenêtre s'ouvre malgré la démo, sans appel au serveur. Absent des builds
 * de production (remplacé à la construction, code retiré).
 */
const APERCU = import.meta.env.VITE_ERP_APERCU_NOTIFICATIONS === '1';

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

export function DemandeNotifications() {
  const { mode } = useErp();
  const inst = useInstallation();
  const installation = useRef(inst);
  useEffect(() => {
    installation.current = inst;
  });
  const [cle, setCle] = useState<string | null>(null);
  const [phase, setPhase] = useState<'fermee' | 'question' | 'refusee'>('fermee');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [activees, setActivees] = useState(false);

  useEffect(() => {
    let annule = false;
    const contexte = (serveurActif: boolean, abonne: boolean): ContexteDemandeNotifications => {
      const plusTard = Number(lire(CLE_PLUS_TARD));
      return {
        demo: mode === 'demo' && !APERCU,
        serveurActif,
        permission: typeof Notification === 'undefined' ? 'indisponible' : Notification.permission,
        navigateurCapable: notificationsPossibles(),
        iphone: appareil() === 'iphone',
        dansLApp: estInstallee(),
        abonne,
        plusTardLe: Number.isFinite(plusTard) && plusTard > 0 ? plusTard : null,
        refusee: lire(CLE_REFUSEE) === '1',
        propositionInstallation: propositionInstallationVisible(installation.current),
        autreFenetre: !!document.querySelector('[role="dialog"][aria-modal="true"]'),
        maintenant: Date.now(),
      };
    };
    const t = window.setTimeout(async () => {
      // D'abord ce qui se sait sur l'appareil, sans réseau.
      if (demandeNotifications(contexte(true, false)) !== 'proposer') return;
      let serveur: { actif: boolean; clePublique: string | null };
      let abonne = false;
      if (APERCU) serveur = { actif: true, clePublique: 'apercu' };
      else {
        try {
          serveur = await serveurNotifications();
          const r = await navigator.serviceWorker.getRegistration('/erp');
          abonne = !!(await r?.pushManager.getSubscription());
        } catch {
          return; // serveur injoignable : on demandera une autre fois
        }
      }
      if (annule || demandeNotifications(contexte(serveur.actif, abonne)) !== 'proposer' || !serveur.clePublique) return;
      setCle(serveur.clePublique);
      setPhase('question');
    }, DELAI_MS);
    return () => {
      annule = true;
      window.clearTimeout(t);
    };
  }, [mode]);

  useEffect(() => {
    signalerDemandeNotifications(phase !== 'fermee');
    return () => signalerDemandeNotifications(false);
  }, [phase]);

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
    if (!cle || enCours) return;
    setEnCours(true);
    setErreur(null);
    try {
      const r = await activerSurCetAppareil(cle);
      if (r.etat === 'activee') {
        setPhase('fermee');
        setActivees(true);
      } else if (r.etat === 'refusee') {
        retenir(CLE_REFUSEE, '1');
        setPhase('refusee');
      } else plusTard();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Une erreur est survenue. Réessayez dans un instant.');
    } finally {
      setEnCours(false);
    }
  };

  const iphone = appareil() === 'iphone';

  return (
    <>
      <Modal
        ouvert={phase === 'question'}
        onFermer={plusTard}
        taille="sm"
        titre="Recevoir les notifications ?"
        description="Nouvelles réservations, messages des voyageurs, problèmes signalés : soyez prévenu tout de suite."
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
        {erreur && (
          <Alert tone="danger">
            {erreur} Vous pourrez aussi les activer dans Paramètres → Application.
          </Alert>
        )}
      </Modal>

      <Modal
        ouvert={phase === 'refusee'}
        onFermer={() => setPhase('fermee')}
        taille="sm"
        titre="Notifications refusées"
        description={
          iphone
            ? 'Pour les activer plus tard : Réglages de l’iPhone → Notifications → Label Maison.'
            : 'Pour les activer plus tard : réglages du navigateur (cadenas à gauche de l’adresse → Notifications), puis Paramètres → Application.'
        }
        pied={
          <Button variant="primary" onClick={() => setPhase('fermee')}>
            OK
          </Button>
        }
      />

      {activees && (
        <div className="lm-sans-impression pointer-events-none fixed inset-x-3 bottom-[calc(var(--lm-barre-onglets)+0.75rem)] z-50 flex justify-center sm:inset-x-auto sm:right-5 sm:bottom-[calc(var(--lm-barre-onglets)+1.25rem)]">
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
