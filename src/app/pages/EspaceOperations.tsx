import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Helmet } from 'react-helmet-async';
import { useSearchParams } from 'react-router-dom';
import '../../erp/erp.css';
import { espaceARetenir, lireEspaceRetenu, lireLienAcces, marqueConnexion, type EspaceRetenu } from '../../erp/data/acces-externe';
import { MODE_DEMO } from '../../erp/data/config';
import { idEspaceValide } from '../../erp/data/espaces';
import { AUJOURDHUI, horodatageMaintenant } from '../../erp/data/format';
import { appliquerAction, avecEcritures, vueOperations, type EntreesOperations } from '../../erp/data/espace-operations';
import { destinatairesUrgence, messageUrgence, notificationsApresAction } from '../../erp/data/notifications-operations';
import { court } from '../../erp/data/operations';
import type { VueOperations } from '../../erp/data/types-operations';
import { DemandeNotificationsOps, EntreeApp, ErreurOps, FeuilleApp, useAppOps, type ServeurNotificationsOps } from '../../erp/espace-operations/AppOperations';
import { demarrerAppOps, lienColle, ouverteEnApp } from '../../erp/espace-operations/app-operations';
import { EspaceOps } from '../../erp/espace-operations/EspaceOps';
import { ONGLETS_OPS, reduirePhoto, type ActionsOps, type Ecran, type OngletOps } from '../../erp/espace-operations/commun';
import { Alert, Button, Card, Field, Input, PageSkeleton } from '../../erp/ui';

/**
 * /espace-operations : l'espace des responsables de pôle et des agents de
 * terrain (logements confiés, programme du jour, incidents, contrôles
 * qualité, équipe et remplacements), hors du channel manager. Connexion par
 * lien à usage unique reçu par e-mail ; toutes les données viennent de
 * api/espace-operations.ts, déjà réduites aux logements de la personne.
 *
 * Démo (VITE_ERP_DEMO=1) : ?apercu=eq-ines (responsable de pôle) ou
 * ?apercu=eq-yanis (agent de terrain), calculé sur le jeu de démo.
 *
 * S'installe comme une app, « Opérations » (manifeste et service worker à
 * part de l'ERP, portée /espace-operations), avec ses notifications :
 * src/erp/espace-operations/AppOperations.tsx et app-operations.ts.
 */

const API = '/api/espace-operations';
const DEMOS = [
  { id: 'eq-ines', libelle: 'Responsable de pôle (Inès)' },
  { id: 'eq-yanis', libelle: 'Agent de terrain (Yanis)' },
];

type Etat =
  | { nom: 'chargement' }
  | { nom: 'connexion'; message?: string; ton?: 'danger' | 'succes' | 'neutre' }
  | { nom: 'ferme'; message: string }
  | { nom: 'erreur'; message: string }
  | { nom: 'pret'; vue: VueOperations };

async function appeler(methode: 'GET' | 'POST', corps: Record<string, unknown>): Promise<{ statut: number; json: Record<string, unknown> }> {
  try {
    const r =
      methode === 'GET'
        ? await fetch(`${API}?${new URLSearchParams(corps as Record<string, string>)}`, { credentials: 'same-origin', cache: 'no-store' })
        : await fetch(API, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) });
    return { statut: r.status, json: (await r.json().catch(() => ({}))) as Record<string, unknown> };
  } catch {
    return { statut: 0, json: { erreur: 'Pas de connexion. Vérifiez votre réseau, puis réessayez.' } };
  }
}

/** Notifications de l'app : la session de l'espace suffit (cookie). */
const SERVEUR_NOTIFICATIONS: ServeurNotificationsOps = {
  etat: async (endpoint) => {
    const r = await appeler('GET', { action: 'notifications-etat', ...(endpoint ? { endpoint } : {}) });
    if (r.statut !== 200) throw new ErreurOps(String(r.json.erreur ?? 'Une erreur est survenue. Réessayez dans un instant.'), r.json.code ? String(r.json.code) : undefined);
    return { actif: !!r.json.actif, clePublique: typeof r.json.clePublique === 'string' ? r.json.clePublique : null, abonne: !!r.json.abonne };
  },
  abonner: async (abonnement, nom) => {
    const r = await appeler('POST', { action: 'notifications-abonner', abonnement, nom });
    if (r.statut !== 200) throw new ErreurOps(String(r.json.erreur ?? 'L’activation n’a pas abouti. Réessayez dans un instant.'), r.json.code ? String(r.json.code) : undefined);
  },
  desabonner: async (endpoint) => {
    const r = await appeler('POST', { action: 'notifications-desabonner', endpoint });
    if (r.statut !== 200) throw new ErreurOps(String(r.json.erreur ?? 'L’action n’a pas abouti. Réessayez dans un instant.'));
  },
  tester: async (endpoint) => {
    const r = await appeler('POST', { action: 'notifications-tester', endpoint });
    if (r.statut !== 200) throw new ErreurOps(String(r.json.erreur ?? 'L’envoi n’a pas abouti. Réessayez dans un instant.'), r.json.code ? String(r.json.code) : undefined);
  },
};

/* --------------------------------------------------------------- adresse */

const CLES: (keyof Omit<Ecran, 'onglet'>)[] = ['incident', 'logement', 'controle', 'signaler', 'absence'];

function ecranDe(p: URLSearchParams): Ecran {
  const o = p.get('onglet') as OngletOps | null;
  const e: Ecran = { onglet: o && ONGLETS_OPS.includes(o) ? o : 'aujourdhui' };
  for (const k of CLES) {
    const v = p.get(k);
    if (v !== null) e[k] = v;
  }
  return e;
}

function avecEcran(p: URLSearchParams, e: Partial<Ecran>): URLSearchParams {
  const n = new URLSearchParams(p);
  if (e.onglet) {
    if (e.onglet === 'aujourdhui') n.delete('onglet');
    else n.set('onglet', e.onglet);
  }
  for (const k of CLES) {
    if (!(k in e)) continue;
    const v = e[k];
    if (v === undefined) n.delete(k);
    else n.set(k, v);
  }
  return n;
}

/* --------------------------------------------------------------- connexion */

/** Espace retenu sur cet appareil pour la page de connexion (id et nom, rien d'autre). */
const CLE_ESPACE = 'lm_espace_operations';

function espaceRetenu(): EspaceRetenu | undefined {
  try {
    return lireEspaceRetenu(window.localStorage.getItem(CLE_ESPACE));
  } catch {
    return undefined;
  }
}

function retenirEspace(e: EspaceRetenu) {
  try {
    window.localStorage.setItem(CLE_ESPACE, JSON.stringify(espaceARetenir(e, espaceRetenu())));
  } catch {
    // Stockage indisponible (navigation privée) : la page reste neutre.
  }
}

/**
 * Dans l'app installée : coller le lien reçu par e-mail (sur iPhone, l'app de
 * l'écran d'accueil ne partage pas la session de Safari, et le lien du mail
 * s'ouvre dans Safari).
 */
function LienDansLApp() {
  const [lien, setLien] = useState('');
  const [erreur, setErreur] = useState<string>();
  const ouvrir = (e: FormEvent) => {
    e.preventDefault();
    const cible = lienColle(lien);
    if (!cible) return setErreur('Ce n’est pas le lien reçu par e-mail.');
    // Même adresse, nouveau fragment : on recharge pour que la page l'ouvre comme un lien reçu.
    window.history.replaceState(null, '', cible);
    window.location.reload();
  };
  return (
    <form onSubmit={ouvrir} className="mt-5 space-y-3 border-t border-(--lm-bord) pt-5">
      <Field label="Lien reçu par e-mail" aide="Appui long sur « Ouvrir mon espace » dans l’e-mail, puis « Copier ».">
        <Input type="url" inputMode="url" autoComplete="off" value={lien} onChange={(e) => setLien(e.target.value)} placeholder="Collez le lien ici" className="h-11 text-[16px]" />
      </Field>
      {erreur && <Alert tone="danger">{erreur}</Alert>}
      <Button type="submit" variant="secondary" size="lg" className="w-full">
        Ouvrir avec ce lien
      </Button>
    </form>
  );
}

/** Page de connexion, au nom de l'espace du lien ou retenu sur l'appareil ; inconnu : neutre. */
function Connexion({ message, ton, marque }: { message?: string; ton?: 'danger' | 'succes' | 'neutre'; marque: { nom?: string; labelMaison: boolean } }) {
  const [email, setEmail] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [retour, setRetour] = useState<{ texte: string; ton: 'succes' | 'danger' }>();
  const dansLApp = ouverteEnApp();

  const envoyer = async (e: FormEvent) => {
    e.preventDefault();
    setRetour(undefined);
    if (MODE_DEMO) {
      setRetour({ ton: 'succes', texte: 'Démonstration : aucun e-mail n’est envoyé. Ouvrez un espace de démonstration ci-dessous.' });
      return;
    }
    setEnCours(true);
    const r = await appeler('POST', { action: 'lien', email: email.trim() });
    setEnCours(false);
    if (r.statut === 200) setRetour({ ton: 'succes', texte: String(r.json.message ?? 'Lien envoyé.') });
    else setRetour({ ton: 'danger', texte: String(r.json.erreur ?? 'Une erreur est survenue. Réessayez dans un instant.') });
  };

  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        {marque.nom && <p className="lm-serif text-center text-[22px] text-(--lm-brun)">{marque.nom}</p>}
        <Card className="mt-6 p-6">
          <h1 className="lm-serif text-[24px] leading-tight text-(--lm-encre)">Votre espace opérations</h1>
          <p className="mt-2 text-[14px] text-(--lm-encre-2)">
            Vos logements, le programme du jour, les incidents et les contrôles qualité. Recevez un lien de connexion par e-mail : aucun mot de passe à retenir.
          </p>
          {message && (
            <Alert tone={ton ?? 'neutre'} className="mt-4">
              {message}
            </Alert>
          )}
          <form onSubmit={(e) => void envoyer(e)} className="mt-5 space-y-4">
            <Field label="Adresse e-mail">
              <Input type="email" inputMode="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.fr" className="h-11 text-[16px]" />
            </Field>
            <Button type="submit" variant="primary" size="lg" chargement={enCours} className="w-full">
              Recevoir mon lien
            </Button>
          </form>
          {retour && (
            <Alert tone={retour.ton} className="mt-4">
              {retour.texte}
            </Alert>
          )}
          {dansLApp && <LienDansLApp />}
        </Card>
        {MODE_DEMO && (
          <div className="mt-4 flex flex-col items-center">
            {DEMOS.map((d) => (
              <a key={d.id} href={`?apercu=${d.id}`} className="inline-flex min-h-8 items-center text-[13px] font-medium text-(--lm-or-texte) hover:underline">
                Démonstration : {d.libelle}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- démo */

/** Démonstration : le jeu de démo en mémoire, les actions appliquées avec les mêmes règles que le serveur. */
function useDemo(membreId: string) {
  const [entrees, setEntrees] = useState<EntreesOperations | null>(null);
  const ref = useRef(entrees);
  ref.current = entrees;
  useEffect(() => {
    if (!membreId) return;
    void import('../../erp/data/seed').then(({ creerSeed }) => setEntrees(creerSeed()));
  }, [membreId]);
  const vue = useMemo(() => (entrees && membreId ? vueOperations(entrees, membreId, { aujourdhui: AUJOURDHUI }) : null), [entrees, membreId]);
  const actions = useMemo<ActionsOps>(
    () => ({
      agir: async (operation) => {
        if (!ref.current) return { ok: false, erreur: 'Démonstration pas encore chargée.' };
        const r = appliquerAction(ref.current, membreId, operation, {
          aujourdhui: AUJOURDHUI,
          maintenant: horodatageMaintenant(),
          nouvelId: (p) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
          photoAcceptee: (u) => u.startsWith(`demo://operations/${membreId}/`),
        });
        if (!r.ok) return { ok: false, erreur: r.erreur };
        const avant = ref.current;
        const suivant = avecEcritures(avant, r.ecritures);
        ref.current = suivant;
        setEntrees(suivant);
        // Urgence : comme si chacun avait activé les notifications (rien ne part en démonstration).
        const urgence = (operation.type === 'signaler' || operation.type === 'priorite') && operation.urgent && r.aNotifier.length > 0;
        const ids = urgence ? [...new Set(notificationsApresAction(avant, suivant, { aujourdhui: AUJOURDHUI, auteurId: membreId }).map((n) => n.membreId))] : [];
        const noms = ids.map((id) => court(suivant.equipe.find((m) => m.id === id)?.nom)).filter(Boolean);
        const message = urgence ? messageUrgence(operation.type === 'signaler' ? 'Urgence signalée' : 'Passé en urgent', { noms, gerant: true }) : r.message;
        return { ok: true, message, ...(r.id ? { id: r.id } : {}) };
      },
      photo: async (f) => ({ url: `demo://operations/${membreId}/${Date.now().toString(36)}-${encodeURIComponent(f.name)}` }),
      // Comme si chacun avait activé les notifications (rien ne part en démonstration).
      prevenus: async (logementId) => {
        const e = ref.current;
        return { noms: e ? destinatairesUrgence(e, membreId, logementId, AUJOURDHUI).map((id) => court(e.equipe.find((m) => m.id === id)?.nom)).filter(Boolean) : [], gerant: true };
      },
    }),
    [membreId],
  );
  return { vue, actions, charge: !!entrees };
}

/* ------------------------------------------------------------------ page */

export default function EspaceOperations() {
  const [parametres, setParametres] = useSearchParams();
  const [etat, setEtat] = useState<Etat>({ nom: 'chargement' });
  const [espaceLien, setEspaceLien] = useState<string>();
  const apercu = MODE_DEMO ? (parametres.get('apercu') ?? '') : '';
  const demo = useDemo(apercu);
  const ecran = ecranDe(parametres);
  const app = useAppOps(MODE_DEMO ? null : SERVEUR_NOTIFICATIONS, etat.nom === 'pret');
  const [feuilleApp, setFeuilleApp] = useState(false);

  // Manifeste, service worker, et l'écran d'une notification touchée pendant que l'app est ouverte.
  useEffect(() => demarrerAppOps((recherche) => setParametres(new URLSearchParams(recherche))), [setParametres]);

  // Plusieurs changements d'écran de suite (fermer puis ouvrir) : toujours à partir du dernier.
  const courant = useRef(parametres);
  courant.current = parametres;
  const naviguer = useCallback(
    (e: Partial<Ecran>) => {
      const n = avecEcran(courant.current, e);
      courant.current = n;
      setParametres(n);
    },
    [setParametres],
  );

  const actionsServeur = useMemo<ActionsOps>(
    () => ({
      agir: async (operation) => {
        const r = await appeler('POST', { action: 'agir', operation });
        if (r.statut === 200) {
          if (r.json.vue) setEtat({ nom: 'pret', vue: r.json.vue as VueOperations });
          return { ok: true, message: String(r.json.message ?? 'Enregistré.'), ...(r.json.id ? { id: String(r.json.id) } : {}) };
        }
        if (r.statut === 401 || (r.statut === 403 && r.json.code === 'retire'))
          setEtat({ nom: 'connexion', ton: 'neutre', message: r.json.code === 'retire' ? String(r.json.erreur ?? '') : 'Votre session a expiré : demandez un nouveau lien.' });
        return { ok: false, erreur: String(r.json.erreur ?? 'Une erreur est survenue. Réessayez dans un instant.') };
      },
      photo: async (f) => {
        try {
          const { donnees, type } = await reduirePhoto(f);
          const r = await appeler('POST', { action: 'photo', donnees, type });
          if (r.statut === 200 && r.json.url) return { url: String(r.json.url), ...(r.json.apercu ? { apercu: String(r.json.apercu) } : {}) };
          return { erreur: String(r.json.erreur ?? 'La photo n’a pas pu être envoyée.') };
        } catch {
          return { erreur: 'Photo illisible : choisissez une autre image.' };
        }
      },
      // Seulement les personnes dont le téléphone recevra vraiment l'urgence, et le gérant s'il la recevra.
      prevenus: async (logementId) => {
        const r = await appeler('GET', { action: 'prevenus', logement: logementId });
        if (r.statut !== 200) throw new Error('prevenus');
        return { noms: Array.isArray(r.json.noms) ? r.json.noms.map(String) : [], gerant: r.json.gerant === true };
      },
    }),
    [],
  );

  useEffect(() => {
    if (MODE_DEMO) {
      setEtat(apercu ? { nom: 'chargement' } : { nom: 'connexion' });
      return;
    }
    let actif = true;
    void (async () => {
      // Lien reçu par e-mail : « #espace=…&jeton=… », retiré de l'adresse aussitôt (historique, partage d'écran).
      const { jeton, espace } = lireLienAcces(window.location.hash);
      if (jeton) {
        setEspaceLien(espace);
        retenirEspace({ espace });
        window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
        const r = await appeler('POST', { action: 'entrer', jeton, espace });
        if (!actif) return;
        if (r.statut !== 200) {
          if (r.statut === 503) return setEtat({ nom: 'ferme', message: String(r.json.erreur ?? '') });
          return setEtat({ nom: 'connexion', ton: 'danger', message: String(r.json.erreur ?? 'Ce lien n’est pas valable.') });
        }
      }
      const r = await appeler('GET', { action: 'vue' });
      if (!actif) return;
      if (r.statut === 200 && r.json.vue) {
        const vue = r.json.vue as VueOperations;
        if (idEspaceValide(r.json.espace)) retenirEspace({ espace: String(r.json.espace).toLowerCase(), ...(vue.conciergerie?.nom ? { nom: vue.conciergerie.nom } : {}) });
        setEtat({ nom: 'pret', vue });
      }
      // Accès retiré par le gérant : le dire, plutôt que « session expirée ».
      else if (r.statut === 401 || r.statut === 403) setEtat({ nom: 'connexion', ...(r.json.code === 'retire' ? { ton: 'neutre' as const, message: String(r.json.erreur ?? '') } : {}) });
      else if (r.statut === 503) setEtat({ nom: 'ferme', message: String(r.json.erreur ?? 'L’espace opérations n’est pas encore ouvert.') });
      else setEtat({ nom: 'erreur', message: String(r.json.erreur ?? 'Une erreur est survenue. Réessayez dans un instant.') });
    })();
    return () => {
      actif = false;
    };
  }, [apercu]);

  const sortir = async () => {
    // Ce téléphone ne reçoit plus rien pour cette personne.
    await app.oublierAvantDeSortir();
    if (!MODE_DEMO) await appeler('POST', { action: 'sortir' });
    setParametres(new URLSearchParams(), { replace: true });
    setEtat({ nom: 'connexion', ton: 'succes', message: 'Vous êtes déconnecté.' });
  };

  const vue = MODE_DEMO ? demo.vue : etat.nom === 'pret' ? etat.vue : null;
  const demoIntrouvable = MODE_DEMO && apercu && demo.charge && !demo.vue;
  // Nom de la conciergerie qui a invité ; avant la vue, celui du lien ou retenu sur l'appareil, sinon rien.
  const conciergerie = vue?.conciergerie?.nom ?? (MODE_DEMO ? 'Label Maison' : (marqueConnexion(espaceLien, espaceRetenu()).nom ?? ''));

  return (
    <div className="erp-root">
      <Helmet>
        <title>{conciergerie ? `Espace opérations · ${conciergerie}` : 'Espace opérations'}</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="referrer" content="no-referrer" />
      </Helmet>
      {vue ? (
        <EspaceOps
          vue={vue}
          ecran={ecran}
          naviguer={naviguer}
          actions={MODE_DEMO ? demo.actions : actionsServeur}
          onSortir={() => void sortir()}
          entreeApp={<EntreeApp app={app} onOuvrir={() => setFeuilleApp(true)} />}
          bandeau={
            MODE_DEMO ? (
              <p className="bg-(--lm-or-lavis) px-4 py-2 text-center text-[12.5px] font-medium text-(--lm-brun)">Démonstration · espace de {vue.moi.nom}</p>
            ) : undefined
          }
        />
      ) : demoIntrouvable ? (
        <Connexion message="Personne de démonstration introuvable." ton="danger" marque={{ nom: 'Label Maison', labelMaison: true }} />
      ) : etat.nom === 'connexion' ? (
        <Connexion message={etat.message} ton={etat.ton} marque={MODE_DEMO ? { nom: 'Label Maison', labelMaison: true } : marqueConnexion(espaceLien, espaceRetenu())} />
      ) : etat.nom === 'ferme' || etat.nom === 'erreur' ? (
        <div className="grid min-h-screen place-items-center px-4">
          <Card className="w-full max-w-sm p-6 text-center">
            <p className="text-[14px] text-(--lm-encre-2)">{etat.message}</p>
            {etat.nom === 'erreur' && (
              <Button variant="secondary" className="mt-4" onClick={() => window.location.reload()}>
                Réessayer
              </Button>
            )}
          </Card>
        </div>
      ) : (
        <div className="mx-auto max-w-5xl px-4 pt-6">
          <PageSkeleton />
        </div>
      )}
      {vue && (
        <>
          <FeuilleApp ouvert={feuilleApp} onFermer={() => setFeuilleApp(false)} app={app} />
          <DemandeNotificationsOps app={app} pret />
        </>
      )}
    </div>
  );
}
