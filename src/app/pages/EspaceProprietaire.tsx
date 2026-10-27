import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Helmet } from 'react-helmet-async';
import { useSearchParams } from 'react-router-dom';
import '../../erp/erp.css';
import { espaceARetenir, lireEspaceRetenu, lireLienAcces, marqueConnexion, type EspaceRetenu } from '../../erp/data/acces-externe';
import { MODE_DEMO } from '../../erp/data/config';
import { idEspaceValide } from '../../erp/data/espaces';
import { AUJOURDHUI } from '../../erp/data/format';
import { CONTACTS_LABEL_MAISON, CONTENU_ESPACE, moisValide, vueProprietaire } from '../../erp/data/proprietaire';
import type { VueProprietaire } from '../../erp/data/types-proprietaire';
import { EspaceVue } from '../../erp/espace-proprietaire/EspaceVue';
import { ONGLETS_ESPACE, type LienDocumentProps, type OngletEspace } from '../../erp/espace-proprietaire/commun';
import { Alert, Button, Card, Field, Input, PageSkeleton } from '../../erp/ui';

/**
 * /espace-proprietaire : l'espace en ligne des propriétaires (logements,
 * calendrier, bilans publiés, factures partagées, documents). Connexion par
 * lien à usage unique reçu par e-mail ; toutes les données viennent de
 * api/espace-proprietaire.ts, déjà filtrées pour ce propriétaire.
 *
 * Page de connexion : au nom de l'espace du dernier lien ou de la dernière
 * session sur cet appareil (gardé dans le navigateur : id et nom de l'espace,
 * rien d'autre) ; espace inconnu : « votre conciergerie », sans le numéro de
 * Label Maison.
 *
 * Démo (VITE_ERP_DEMO=1) : ?apercu=pro-sci-tilleuls, calculé sur le jeu de démo.
 */

const API = '/api/espace-proprietaire';
const PROPRIETAIRE_DEMO = 'pro-sci-tilleuls';

/** Espace retenu sur cet appareil pour la page de connexion (id et nom, rien d'autre). */
const CLE_ESPACE = 'lm_espace_proprietaire';

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

type MarqueConnexion = ReturnType<typeof marqueConnexion>;

type Etat =
  | { nom: 'chargement' }
  | { nom: 'connexion'; message?: string; ton?: 'danger' | 'succes' | 'neutre' }
  | { nom: 'ferme'; message: string }
  | { nom: 'erreur'; message: string }
  | { nom: 'pret'; vue: VueProprietaire; demo?: boolean };

async function appeler(methode: 'GET' | 'POST', parametres: Record<string, string>): Promise<{ statut: number; json: Record<string, unknown> }> {
  try {
    const r =
      methode === 'GET'
        ? await fetch(`${API}?${new URLSearchParams(parametres)}`, { credentials: 'same-origin', cache: 'no-store' })
        : await fetch(API, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parametres) });
    return { statut: r.status, json: (await r.json().catch(() => ({}))) as Record<string, unknown> };
  } catch {
    return { statut: 0, json: { erreur: 'Pas de connexion. Vérifiez votre réseau, puis réessayez.' } };
  }
}

/** Vue de démonstration, calculée dans le navigateur sur le jeu de démo. */
async function vueDemo(proprietaireId: string, mois?: string): Promise<VueProprietaire | null> {
  const { creerSeed } = await import('../../erp/data/seed');
  return vueProprietaire(creerSeed(), proprietaireId, { aujourdhui: AUJOURDHUI, mois });
}

function LienDocumentServeur({ id, className, children }: LienDocumentProps) {
  return (
    <a href={`${API}?action=document&id=${encodeURIComponent(id)}`} target="_blank" rel="noreferrer" className={className}>
      {children}
    </a>
  );
}

function LienDocumentDemo({ className, children }: LienDocumentProps) {
  return (
    <div className={className} title="Démonstration : le fichier n’est pas joint">
      {children}
    </div>
  );
}

/**
 * Connexion, au nom de l'espace connu sur cet appareil : Label Maison (sa
 * marque et son numéro), un autre espace (son nom), ou personne (« votre
 * conciergerie », rien de Label Maison).
 */
function Connexion({ message, ton, marque }: { message?: string; ton?: 'danger' | 'succes' | 'neutre'; marque: MarqueConnexion }) {
  const [email, setEmail] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [retour, setRetour] = useState<{ texte: string; ton: 'succes' | 'danger' }>();
  const c = CONTACTS_LABEL_MAISON;

  const envoyer = async (e: FormEvent) => {
    e.preventDefault();
    setRetour(undefined);
    if (MODE_DEMO) {
      setRetour({ ton: 'succes', texte: 'Démonstration : aucun e-mail n’est envoyé. Ouvrez l’espace de démonstration ci-dessous.' });
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
          <h1 className="lm-serif text-[24px] leading-tight text-(--lm-encre)">Votre espace propriétaire</h1>
          <p className="mt-2 text-[14px] text-(--lm-encre-2)">
            {CONTENU_ESPACE.vous.charAt(0).toUpperCase()}
            {CONTENU_ESPACE.vous.slice(1)}. Recevez un lien de connexion par e-mail : aucun mot de passe à retenir.
          </p>
          {message && (
            <Alert tone={ton ?? 'neutre'} className="mt-4">
              {message}
            </Alert>
          )}
          <form onSubmit={(e) => void envoyer(e)} className="mt-5 space-y-4">
            <Field label="Adresse e-mail">
              <Input
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@exemple.fr"
                className="h-11 text-[16px]"
              />
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
        <p className="mt-5 text-center text-[13px] text-(--lm-encre-2)">
          {marque.labelMaison ? (
            <>
              Besoin d’aide ?{' '}
              <a href={c.lienTelephone} className="inline-flex min-h-8 items-center font-medium text-(--lm-or-texte) hover:underline">
                {c.telephone}
              </a>
            </>
          ) : (
            `Besoin d’aide ? Contactez ${marque.nom ?? 'votre conciergerie'}.`
          )}
        </p>
        {MODE_DEMO && (
          <p className="mt-2 text-center text-[13px]">
            <a href={`?apercu=${PROPRIETAIRE_DEMO}`} className="inline-flex min-h-8 items-center font-medium text-(--lm-or-texte) hover:underline">
              Voir l’espace de démonstration
            </a>
          </p>
        )}
      </div>
    </div>
  );
}

export default function EspaceProprietaire() {
  const [parametres, setParametres] = useSearchParams();
  const [etat, setEtat] = useState<Etat>({ nom: 'chargement' });
  // Espace du lien reçu (un ancien lien sans espace : Label Maison).
  const [espaceLien, setEspaceLien] = useState<string>();
  const [calendrierEnCours, setCalendrierEnCours] = useState(false);
  const apercu = MODE_DEMO ? (parametres.get('apercu') ?? '') : '';
  const ongletUrl = parametres.get('onglet') as OngletEspace | null;
  const onglet: OngletEspace = ongletUrl && ONGLETS_ESPACE.includes(ongletUrl) ? ongletUrl : 'accueil';
  const bilanUrl = parametres.get('bilan') ?? undefined;
  const bilan = moisValide(bilanUrl) ? bilanUrl : undefined;
  const logement = parametres.get('logement') ?? undefined;
  const facture = parametres.get('facture') ?? undefined;

  const regler = (o: OngletEspace, suite: { bilan?: string; logement?: string; facture?: string } = {}) =>
    setParametres(
      (p) => {
        const n = new URLSearchParams(p);
        if (o === 'accueil') n.delete('onglet');
        else n.set('onglet', o);
        for (const cle of ['bilan', 'logement', 'facture'] as const) {
          const v = suite[cle];
          if (v) n.set(cle, v);
          else n.delete(cle);
        }
        return n;
      },
      { replace: false },
    );

  const charger = useCallback(async (mois?: string): Promise<Etat> => {
    if (MODE_DEMO) {
      if (!apercu) return { nom: 'connexion' };
      const vue = await vueDemo(apercu, mois);
      return vue ? { nom: 'pret', vue, demo: true } : { nom: 'erreur', message: 'Propriétaire de démonstration introuvable.' };
    }
    const r = await appeler('GET', mois ? { action: 'vue', mois } : { action: 'vue' });
    if (r.statut === 200 && r.json.vue) {
      const vue = r.json.vue as VueProprietaire;
      if (idEspaceValide(r.json.espace)) retenirEspace({ espace: r.json.espace.toLowerCase(), nom: vue.conciergerie.nom });
      return { nom: 'pret', vue };
    }
    // Accès retiré par le gérant : le dire, plutôt que « session expirée ».
    if (r.statut === 401) return r.json.code === 'retire' ? { nom: 'connexion', ton: 'neutre', message: String(r.json.erreur ?? '') } : { nom: 'connexion' };
    if (r.statut === 503) return { nom: 'ferme', message: String(r.json.erreur ?? 'L’espace propriétaire n’est pas encore ouvert.') };
    return { nom: 'erreur', message: String(r.json.erreur ?? 'Une erreur est survenue. Réessayez dans un instant.') };
  }, [apercu]);

  useEffect(() => {
    let actif = true;
    void (async () => {
      // Lien reçu par e-mail : « #espace=…&jeton=… », retiré de l'adresse aussitôt (historique, partage d'écran).
      const { jeton, espace } = lireLienAcces(window.location.hash);
      if (jeton) {
        setEspaceLien(espace);
        if (!MODE_DEMO) retenirEspace({ espace });
      }
      if (jeton && !MODE_DEMO) {
        window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
        const r = await appeler('POST', { action: 'entrer', jeton, espace });
        if (!actif) return;
        if (r.statut !== 200) {
          if (r.statut === 503) return setEtat({ nom: 'ferme', message: String(r.json.erreur ?? '') });
          return setEtat({ nom: 'connexion', ton: 'danger', message: String(r.json.erreur ?? 'Ce lien n’est pas valable.') });
        }
      }
      const e = await charger();
      if (actif) setEtat(e);
    })();
    return () => {
      actif = false;
    };
  }, [charger]);

  const changerMois = async (mois: string) => {
    setCalendrierEnCours(true);
    const e = await charger(mois);
    setCalendrierEnCours(false);
    if (e.nom === 'pret') setEtat(e);
    else if (e.nom === 'connexion') setEtat({ nom: 'connexion', ton: 'neutre', message: e.message || 'Votre session a expiré : demandez un nouveau lien.' });
  };

  const sortir = async () => {
    if (!MODE_DEMO) await appeler('POST', { action: 'sortir' });
    setParametres(new URLSearchParams(), { replace: true });
    setEtat({ nom: 'connexion', ton: 'succes', message: 'Vous êtes déconnecté.' });
  };

  return (
    <div className="erp-root">
      <Helmet>
        <title>{etat.nom === 'pret' ? `Espace propriétaire · ${etat.vue.conciergerie.nom}` : 'Espace propriétaire'}</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="referrer" content="no-referrer" />
      </Helmet>
      {etat.nom === 'chargement' && (
        <div className="mx-auto max-w-5xl px-4 pt-6">
          <PageSkeleton />
        </div>
      )}
      {etat.nom === 'connexion' && <Connexion message={etat.message} ton={etat.ton} marque={MODE_DEMO ? { nom: 'Label Maison', labelMaison: true } : marqueConnexion(espaceLien, espaceRetenu())} />}
      {(etat.nom === 'ferme' || etat.nom === 'erreur') && (
        <div className="grid min-h-screen place-items-center px-4">
          <Card className="w-full max-w-sm p-6 text-center">
            <p className="lm-serif text-[22px] text-(--lm-brun)">Espace propriétaire</p>
            <p className="mt-3 text-[14px] text-(--lm-encre-2)">{etat.message}</p>
            {etat.nom === 'erreur' && (
              <Button variant="secondary" className="mt-4" onClick={() => window.location.reload()}>
                Réessayer
              </Button>
            )}
          </Card>
        </div>
      )}
      {etat.nom === 'pret' && (
        <EspaceVue
          vue={etat.vue}
          onglet={onglet}
          onOnglet={(o) => regler(o)}
          bilan={bilan}
          onBilan={(m) => regler('bilans', { bilan: m })}
          logement={logement}
          onLogement={(id) => regler('logements', { logement: id })}
          facture={facture}
          onFacture={(id) => regler('factures', { facture: id })}
          onMoisCalendrier={(m) => void changerMois(m)}
          calendrierEnCours={calendrierEnCours}
          LienDocument={etat.demo ? LienDocumentDemo : LienDocumentServeur}
          onSortir={() => void sortir()}
          bandeau={
            etat.demo ? (
              <p className="lm-sans-impression bg-(--lm-or-lavis) px-4 py-2 text-center text-[12.5px] font-medium text-(--lm-brun)">
                Démonstration · espace de {etat.vue.proprietaire.nom}
              </p>
            ) : undefined
          }
        />
      )}
    </div>
  );
}
