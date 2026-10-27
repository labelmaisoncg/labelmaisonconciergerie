/**
 * Notifications de cet appareil, côté écran : état du serveur, autorisation
 * du navigateur, abonnement et réglages par type. Le serveur
 * (api/erp-notifications.ts) garde les appareils abonnés et envoie.
 */
import { useCallback, useEffect, useState } from 'react';
import { NOM_APPAREIL, abonnementActuel, appareil, autorisation, iphoneHorsApp, notificationsPossibles, sAbonner, seDesabonner, versAbonnement } from '../../../data/application';
import { TYPES_NOTIFICATION, estActive, type PreferencesNotifications, type TypeNotification } from '../../../data/notifications';
import { useErp } from '../../../data/store';
import { appelerServeur, ErreurServeur } from '../../messagerie/_composants/serveur';
import type { Ton } from '../../../ui';

const API = '/api/erp-notifications';

interface ReponseEtat {
  actif: boolean;
  clePublique: string | null;
  appareil: { preferences: PreferencesNotifications; nom?: string } | null;
}

/** Ce que la carte montre, dans l'ordre où on le vérifie. */
export type EtapeNotifications =
  | 'chargement'
  | 'demo'
  | 'serveur-inactif'
  | 'iphone-hors-app'
  | 'navigateur'
  | 'refusee'
  | 'a-activer'
  | 'actives'
  | 'erreur';

export interface Retour {
  ton: Ton;
  texte: string;
}

// Les messages du serveur sont en français ; ceux du navigateur (anglais, techniques) sont remplacés.
const message = (e: unknown) => (e instanceof ErreurServeur ? e.message : 'L’action n’a pas abouti sur cet appareil. Réessayez dans un instant.');

/** Activation ratée : message du serveur, sinon une phrase claire (jamais l'erreur brute du navigateur). */
export const messageActivation = (e: unknown) =>
  e instanceof ErreurServeur ? e.message : 'L’activation n’a pas abouti sur cet appareil. Réessayez dans un instant.';

/** Valeurs par défaut, pour montrer les réglages avant l'abonnement. */
export const PREFERENCES_DEFAUT: Record<TypeNotification, boolean> = Object.fromEntries(
  TYPES_NOTIFICATION.map((t) => [t.type, t.defaut]),
) as Record<TypeNotification, boolean>;

export function useNotifications() {
  const { mode } = useErp();
  const [etape, setEtape] = useState<EtapeNotifications>(mode === 'reel' ? 'chargement' : 'demo');
  const [serveur, setServeur] = useState<ReponseEtat | null>(null);
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<PreferencesNotifications>({});
  const [occupe, setOccupe] = useState<'activer' | 'tester' | 'desactiver' | null>(null);
  const [retour, setRetour] = useState<Retour | null>(null);

  const situer = useCallback((r: ReponseEtat | null, ep: string | null): EtapeNotifications => {
    if (!r) return 'erreur';
    if (!r.actif || !r.clePublique) return 'serveur-inactif';
    if (iphoneHorsApp()) return 'iphone-hors-app';
    if (!notificationsPossibles()) return 'navigateur';
    if (autorisation() === 'refusee') return 'refusee';
    return ep && r.appareil ? 'actives' : 'a-activer';
  }, []);

  const relire = useCallback(async () => {
    if (mode !== 'reel') {
      setEtape('demo');
      return;
    }
    try {
      const s = notificationsPossibles() && !iphoneHorsApp() ? await abonnementActuel() : null;
      const ep = s?.endpoint ?? null;
      const r = await appelerServeur<ReponseEtat>(`${API}?action=etat${ep ? `&endpoint=${encodeURIComponent(ep)}` : ''}`, 'GET');
      setServeur(r);
      setEndpoint(ep);
      setPreferences(r.appareil?.preferences ?? {});
      setEtape(situer(r, ep));
    } catch (e) {
      setRetour({ ton: 'danger', texte: message(e) });
      setEtape('erreur');
    }
  }, [mode, situer]);

  useEffect(() => {
    void relire();
  }, [relire]);

  /** Dans le geste de l'utilisateur : autorisation du navigateur, puis abonnement. */
  const activer = useCallback(async () => {
    if (!serveur?.clePublique || occupe) return;
    setOccupe('activer');
    setRetour(null);
    try {
      const r = await activerSurCetAppareil(serveur.clePublique, preferences);
      if (r.etat !== 'activee') {
        setEtape(r.etat === 'refusee' ? 'refusee' : 'a-activer');
        if (r.etat === 'ignoree') setRetour({ ton: 'alerte', texte: 'Notifications non autorisées. Touchez de nouveau « Activer » et choisissez « Autoriser ».' });
        return;
      }
      setEndpoint(r.endpoint);
      setPreferences(r.preferences);
      setServeur((x) => (x ? { ...x, appareil: { preferences: r.preferences } } : x));
      setEtape('actives');
      setRetour({ ton: 'succes', texte: 'Notifications activées sur cet appareil.' });
    } catch (e) {
      setRetour({ ton: 'danger', texte: message(e) });
    } finally {
      setOccupe(null);
    }
  }, [serveur, occupe, preferences]);

  const regler = useCallback(
    async (type: TypeNotification, actif: boolean) => {
      if (!endpoint) return;
      const avant = preferences;
      const apres = { ...preferences, [type]: actif };
      setPreferences(apres);
      setRetour(null);
      try {
        const r = await appelerServeur<{ preferences: PreferencesNotifications }>(API, 'POST', { action: 'regler', endpoint, preferences: apres });
        setPreferences(r.preferences ?? apres);
      } catch (e) {
        setPreferences(avant);
        setRetour({ ton: 'danger', texte: message(e) });
        if (e instanceof ErreurServeur && e.code === 'inconnu') setEtape('a-activer');
      }
    },
    [endpoint, preferences],
  );

  const tester = useCallback(async () => {
    if (!endpoint || occupe) return;
    setOccupe('tester');
    setRetour(null);
    try {
      await appelerServeur(API, 'POST', { action: 'tester', endpoint });
      setRetour({ ton: 'succes', texte: 'Notification envoyée : elle arrive dans quelques secondes.' });
    } catch (e) {
      setRetour({ ton: 'danger', texte: message(e) });
      if (e instanceof ErreurServeur && e.code === 'inconnu') setEtape('a-activer');
    } finally {
      setOccupe(null);
    }
  }, [endpoint, occupe]);

  const desactiver = useCallback(async () => {
    if (occupe) return;
    setOccupe('desactiver');
    setRetour(null);
    try {
      const ep = (await seDesabonner()) ?? endpoint;
      if (ep) await appelerServeur(API, 'POST', { action: 'desabonner', endpoint: ep });
      setEndpoint(null);
      setEtape('a-activer');
      setRetour({ ton: 'neutre', texte: 'Notifications coupées sur cet appareil.' });
    } catch (e) {
      setRetour({ ton: 'danger', texte: message(e) });
    } finally {
      setOccupe(null);
    }
  }, [endpoint, occupe]);

  return {
    etape,
    serveurActif: !!serveur?.actif,
    preferences,
    estActive: (t: TypeNotification) => estActive(preferences, t),
    occupe,
    retour,
    activer,
    regler,
    tester,
    desactiver,
    relire,
  };
}

/* ------------------------------------------------ activer sur cet appareil */

export type ResultatActivation =
  | { etat: 'activee'; endpoint: string; preferences: PreferencesNotifications }
  /** Refusées dans la fenêtre du système (permission « denied »). */
  | { etat: 'refusee' }
  /** Fenêtre du système fermée sans choix : rien n'a changé. */
  | { etat: 'ignoree' };

/**
 * Dans le geste de l'utilisateur (iPhone : obligatoire) : autorisation du
 * système, abonnement du navigateur, puis enregistrement de l'appareil sur le
 * serveur. Lève une erreur lisible si le serveur refuse.
 */
export async function activerSurCetAppareil(clePublique: string, preferences: PreferencesNotifications = {}): Promise<ResultatActivation> {
  const s = await sAbonner(clePublique);
  if (!s) {
    const a = autorisation();
    if (a === 'refusee') return { etat: 'refusee' };
    if (a === 'accordee') throw new Error('Cet appareil n’a pas pu s’abonner. Réessayez dans un instant.');
    return { etat: 'ignoree' };
  }
  const r = await appelerServeur<{ preferences: PreferencesNotifications }>(API, 'POST', {
    action: 'abonner',
    abonnement: versAbonnement(s),
    preferences,
    nom: NOM_APPAREIL[appareil()],
  });
  return { etat: 'activee', endpoint: s.endpoint, preferences: r.preferences ?? {} };
}

/** État du serveur seul (clés présentes), pour la demande à l'ouverture. */
export async function serveurNotifications(): Promise<{ actif: boolean; clePublique: string | null }> {
  const r = await appelerServeur<ReponseEtat>(`${API}?action=etat`, 'GET');
  return { actif: !!r.actif && !!r.clePublique, clePublique: r.clePublique };
}

/**
 * À l'ouverture de l'ERP, une fois par session : le serveur revoit le rôle
 * du compte sur cet appareil déjà abonné (« Prix à revoir » : gérant
 * seulement), sans passer par Paramètres. Silencieux.
 */
export async function revoirAppareil(): Promise<void> {
  const r = await navigator.serviceWorker.getRegistration('/erp');
  const s = await r?.pushManager.getSubscription();
  if (!s) return;
  await appelerServeur<ReponseEtat>(`${API}?action=etat&endpoint=${encodeURIComponent(s.endpoint)}`, 'GET');
}

/* ------------------------------------------------- clés du serveur (gérant) */

export interface ClesGenerees {
  publique: string;
  privee: string;
  dejaActives: boolean;
}

/** Nouvelle paire de clés, montrée une fois au gérant ; jamais enregistrée par l'ERP. */
export async function genererCles(): Promise<ClesGenerees> {
  return appelerServeur<ClesGenerees>(API, 'POST', { action: 'cles' });
}
