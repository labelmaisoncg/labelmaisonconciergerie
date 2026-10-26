import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Helmet } from 'react-helmet-async';
import { useSearchParams } from 'react-router-dom';
import '../../erp/erp.css';
import { lireLienAcces } from '../../erp/data/acces-externe';
import { MODE_DEMO } from '../../erp/data/config';
import { estLabelMaison } from '../../erp/data/espaces';
import { AUJOURDHUI, horodatageMaintenant } from '../../erp/data/format';
import { appliquerAction, avecEcritures, vueOperations, type EntreesOperations } from '../../erp/data/espace-operations';
import type { VueOperations } from '../../erp/data/types-operations';
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

function Connexion({ message, ton, labelMaison }: { message?: string; ton?: 'danger' | 'succes' | 'neutre'; labelMaison: boolean }) {
  const [email, setEmail] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [retour, setRetour] = useState<{ texte: string; ton: 'succes' | 'danger' }>();

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
        {labelMaison && <p className="lm-serif text-center text-[22px] text-(--lm-brun)">Label Maison</p>}
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
        const suivant = avecEcritures(ref.current, r.ecritures);
        ref.current = suivant;
        setEntrees(suivant);
        return { ok: true, message: r.message, ...(r.id ? { id: r.id } : {}) };
      },
      photo: async (f) => ({ url: `demo://operations/${membreId}/${Date.now().toString(36)}-${encodeURIComponent(f.name)}` }),
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
        if (r.statut === 401) setEtat({ nom: 'connexion', ton: 'neutre', message: 'Votre session a expiré : demandez un nouveau lien.' });
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
      if (r.statut === 200 && r.json.vue) setEtat({ nom: 'pret', vue: r.json.vue as VueOperations });
      else if (r.statut === 401 || r.statut === 403) setEtat({ nom: 'connexion', ...(r.statut === 403 ? { ton: 'danger' as const, message: String(r.json.erreur ?? '') } : {}) });
      else if (r.statut === 503) setEtat({ nom: 'ferme', message: String(r.json.erreur ?? 'L’espace opérations n’est pas encore ouvert.') });
      else setEtat({ nom: 'erreur', message: String(r.json.erreur ?? 'Une erreur est survenue. Réessayez dans un instant.') });
    })();
    return () => {
      actif = false;
    };
  }, [apercu]);

  const sortir = async () => {
    if (!MODE_DEMO) await appeler('POST', { action: 'sortir' });
    setParametres(new URLSearchParams(), { replace: true });
    setEtat({ nom: 'connexion', ton: 'succes', message: 'Vous êtes déconnecté.' });
  };

  const vue = MODE_DEMO ? demo.vue : etat.nom === 'pret' ? etat.vue : null;
  const demoIntrouvable = MODE_DEMO && apercu && demo.charge && !demo.vue;
  // Nom de la conciergerie qui a invité ; avant la vue, Label Maison seulement si le lien est le sien.
  const conciergerie = vue?.conciergerie?.nom ?? (!espaceLien || estLabelMaison(espaceLien) ? 'Label Maison' : '');

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
          bandeau={
            MODE_DEMO ? (
              <p className="bg-(--lm-or-lavis) px-4 py-2 text-center text-[12.5px] font-medium text-(--lm-brun)">Démonstration · espace de {vue.moi.nom}</p>
            ) : undefined
          }
        />
      ) : demoIntrouvable ? (
        <Connexion message="Personne de démonstration introuvable." ton="danger" labelMaison />
      ) : etat.nom === 'connexion' ? (
        <Connexion message={etat.message} ton={etat.ton} labelMaison={!espaceLien || estLabelMaison(espaceLien)} />
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
    </div>
  );
}
