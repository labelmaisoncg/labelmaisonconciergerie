import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Helmet } from 'react-helmet-async';
import { useSearchParams } from 'react-router-dom';
import '../../erp/erp.css';
import {
  MESSAGE_INVITATION_PERIMEE,
  MOT_DE_PASSE_MIN,
  adresseBienFormee,
  espaceARetenir,
  forceMotDePasse,
  lireEspaceRetenu,
  marqueConnexion,
  motDePasseRefuse,
  type EspaceRetenu,
} from '../../erp/data/acces-externe';
import { completer } from '../../erp/data/collections';
import {
  RETOUR_LIEN_EXTERNE,
  changerMotDePasseExterne,
  codeInvitationAccesDe,
  creerCompteExterne,
  envoyerLienMotDePasseExterne,
  fermerSessionExterne,
  garderInvitationAcces,
  invitationAccesGardee,
  nettoyerAdresse,
  oublierInvitationAcces,
  seConnecterExterne,
  sessionExterne,
} from '../../erp/data/compte-externe';
import { CLE_DEMO, MODE_DEMO } from '../../erp/data/config';
import { idEspaceValide } from '../../erp/data/espaces';
import { AUJOURDHUI } from '../../erp/data/format';
import { CONTACTS_LABEL_MAISON, CONTENU_ESPACE, calendrierPlage, moisDePlage, moisEntre, moisValide, vueProprietaire } from '../../erp/data/proprietaire';
import type { ErpDonnees } from '../../erp/data/types';
import type { CalendrierLogement, MoisCalendrierVue, VueProprietaire } from '../../erp/data/types-proprietaire';
import type { ChargeurMois } from '../../erp/calendrier';
import { EspaceVue } from '../../erp/espace-proprietaire/EspaceVue';
import { ONGLETS_ESPACE, type LienDocumentProps, type OngletEspace } from '../../erp/espace-proprietaire/commun';
import { Alert, Button, Card, Field, Input, PageSkeleton } from '../../erp/ui';

/**
 * /espace-proprietaire : l'espace en ligne des propriétaires (logements,
 * calendrier, bilans publiés, factures partagées, documents). Chaque
 * propriétaire a son compte (adresse e-mail et mot de passe) :
 *
 * 1. le lien de l'invitation (« #creer=<adresse>&code=…&espace=… ») ouvre
 *    « Créez votre mot de passe » ; le code reste sur l'appareil ;
 * 2. Supabase envoie l'e-mail de confirmation ; son lien ramène ici, le compte
 *    confirmé active l'accès avec le code (POST activer) : la session s'ouvre ;
 * 3. ensuite, adresse et mot de passe (POST entrer) ; « Mot de passe oublié ? »
 *    envoie un lien qui ramène ici pour en choisir un nouveau.
 *
 * Le compte Supabase ne sert qu'à prouver l'identité auprès du serveur : la
 * session de l'espace, c'est le cookie ; la session Supabase locale est fermée
 * aussitôt après. Toutes les données viennent de api/espace-proprietaire.ts,
 * déjà filtrées pour ce propriétaire.
 *
 * Page de connexion : au nom de l'espace du dernier lien ou de la dernière
 * session sur cet appareil (gardé dans le navigateur : id et nom de l'espace,
 * rien d'autre) ; espace inconnu : « votre conciergerie », sans le numéro de
 * Label Maison.
 *
 * Démo (VITE_ERP_DEMO=1) : ?apercu=pro-sci-tilleuls, calculé sur le jeu de
 * démo ; les écrans de compte se montrent, sans Supabase ni e-mail.
 */

const API = '/api/espace-proprietaire';
const GENRE = 'proprietaire';
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
type Ton = 'danger' | 'succes' | 'neutre' | 'info';

type Etat =
  | { nom: 'chargement' }
  | { nom: 'connexion'; message?: string; ton?: Ton; email?: string }
  /** Lien d'invitation ouvert ici : il reste à choisir son mot de passe. */
  | { nom: 'creer'; email: string }
  /** Compte créé : la confirmation de l'adresse est partie. */
  | { nom: 'confirmer'; email: string }
  /** Lien « mot de passe oublié » ouvert : le compte est connecté, il choisit son nouveau mot de passe. */
  | { nom: 'nouveau_mot_de_passe'; email: string }
  | { nom: 'ferme'; message: string }
  | { nom: 'erreur'; message: string }
  | { nom: 'pret'; vue: VueProprietaire; demo?: boolean };

const MESSAGE_SANS_INVITATION = 'Pour créer votre compte, ouvrez le lien de l’invitation reçue par e-mail, sur cet appareil.';
const MESSAGE_CONFIRMEE_SANS_CODE = 'Votre adresse est confirmée. Ouvrez maintenant le lien de votre invitation sur cet appareil, puis connectez-vous.';
const MESSAGE_OUBLIE = 'Si cette adresse a un compte, un lien pour choisir un mot de passe vient de lui être envoyé. Pensez à regarder dans les indésirables.';
const MESSAGE_DEMO = 'Démonstration : aucun compte n’est créé et aucun e-mail n’est envoyé. Ouvrez l’espace de démonstration ci-dessous.';

async function appeler(methode: 'GET' | 'POST', parametres: Record<string, string>, jeton?: string): Promise<{ statut: number; json: Record<string, unknown> }> {
  try {
    const entetes: Record<string, string> = jeton ? { Authorization: `Bearer ${jeton}` } : {};
    const r =
      methode === 'GET'
        ? await fetch(`${API}?${new URLSearchParams(parametres)}`, { credentials: 'same-origin', cache: 'no-store', headers: entetes })
        : await fetch(API, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...entetes }, body: JSON.stringify(parametres) });
    return { statut: r.status, json: (await r.json().catch(() => ({}))) as Record<string, unknown> };
  } catch {
    return { statut: 0, json: { erreur: 'Pas de connexion. Vérifiez votre réseau, puis réessayez.' } };
  }
}

/**
 * Ouvre la session de l'espace avec le jeton Supabase du compte connecté : avec
 * le code d'invitation gardé ici pour cette adresse, c'est l'activation
 * (première entrée) ; sinon, ou si ce code a déjà servi, l'entrée par le
 * compte. La session Supabase locale est fermée dans tous les cas.
 */
async function ouvrirAvecCompte(jeton: string, email: string): Promise<{ ok: true } | { ok: false; message: string; code: string }> {
  try {
    const retenu = espaceRetenu()?.espace;
    const inv = codeInvitationAccesDe(GENRE, email);
    if (inv) {
      const a = await appeler('POST', { action: 'activer', code: inv.code, espace: inv.espace }, jeton);
      if (a.statut === 200) {
        oublierInvitationAcces(GENRE);
        if (idEspaceValide(a.json.espace)) retenirEspace({ espace: a.json.espace.toLowerCase() });
        return { ok: true };
      }
      // Code refusé (déjà servi, remplacé, expiré) : il ne servira plus ; le compte a peut-être déjà son accès.
      if (a.statut === 401 && a.json.code === 'invitation') {
        oublierInvitationAcces(GENRE);
        const e = await appeler('POST', { action: 'entrer', ...(retenu ? { espace: retenu } : { espace: inv.espace }) }, jeton);
        if (e.statut === 200) {
          if (idEspaceValide(e.json.espace)) retenirEspace({ espace: e.json.espace.toLowerCase() });
          return { ok: true };
        }
        return { ok: false, message: String(a.json.erreur ?? MESSAGE_INVITATION_PERIMEE), code: 'invitation' };
      }
      return { ok: false, message: String(a.json.erreur ?? 'Une erreur est survenue. Réessayez dans un instant.'), code: String(a.json.code ?? '') };
    }
    const e = await appeler('POST', { action: 'entrer', ...(retenu ? { espace: retenu } : {}) }, jeton);
    if (e.statut === 200) {
      if (idEspaceValide(e.json.espace)) retenirEspace({ espace: e.json.espace.toLowerCase() });
      return { ok: true };
    }
    return { ok: false, message: String(e.json.erreur ?? 'Une erreur est survenue. Réessayez dans un instant.'), code: String(e.json.code ?? '') };
  } finally {
    await fermerSessionExterne(GENRE);
  }
}

/**
 * Jeu de l'ERP de démonstration tel que modifié sur cet appareil (factures
 * validées et partagées, bilans publiés…) ; null : pas encore ouvert ici.
 */
function donneesDemoLocales(): ErpDonnees | null {
  try {
    const brut = window.localStorage.getItem(CLE_DEMO);
    const d = brut ? (JSON.parse(brut) as Partial<ErpDonnees>) : null;
    return d && typeof d === 'object' && Array.isArray(d.logements) ? completer(d) : null;
  } catch {
    return null;
  }
}

async function donneesDemo(): Promise<ErpDonnees> {
  return donneesDemoLocales() ?? (await import('../../erp/data/seed')).creerSeed();
}

/** Vue de démonstration, calculée dans le navigateur sur le même jeu que l'ERP de démonstration. */
async function vueDemo(proprietaireId: string): Promise<VueProprietaire | null> {
  return vueProprietaire(await donneesDemo(), proprietaireId, { aujourdhui: AUJOURDHUI });
}

/** Mois du calendrier en démonstration : la même fonction pure que le serveur, mêmes bornes. */
async function calendrierDemo(proprietaireId: string, de: string, a: string): Promise<{ ok: true; mois: MoisCalendrierVue[] } | { ok: false; erreur: string }> {
  const plage = moisDePlage(de, a, AUJOURDHUI);
  if (!plage.ok) return plage;
  const mois = calendrierPlage(await donneesDemo(), proprietaireId, plage.mois);
  return mois ? { ok: true, mois } : { ok: false, erreur: 'Propriétaire de démonstration introuvable.' };
}

type RetourChargeur = Awaited<ReturnType<ChargeurMois>>;
const ERREUR_CALENDRIER = 'Le calendrier n’a pas pu être chargé. Réessayez dans un instant.';

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

/* ------------------------------------------------------------------ cadre */

const LIEN_TEXTE = 'inline-flex min-h-8 items-center text-[13px] font-medium lm-lien';

/**
 * Cadre des écrans de compte, au nom de l'espace connu sur cet appareil :
 * Label Maison (sa marque et son numéro), un autre espace (son nom), ou
 * personne (« votre conciergerie », rien de Label Maison).
 */
function Cadre({ marque, titre, phrase, children }: { marque: MarqueConnexion; titre: string; phrase?: string; children: ReactNode }) {
  const c = CONTACTS_LABEL_MAISON;
  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        {marque.nom && <p className="lm-titre text-center text-[22px] text-(--lm-brun)">{marque.nom}</p>}
        <Card className="mt-6 p-6">
          <h1 className="lm-titre text-[24px] leading-tight text-(--lm-encre)">{titre}</h1>
          {phrase && <p className="mt-2 text-[14px] text-(--lm-encre-2)">{phrase}</p>}
          {children}
        </Card>
        <p className="mt-5 text-center text-[13px] text-(--lm-encre-2)">
          {marque.labelMaison ? (
            <>
              Besoin d’aide ?{' '}
              <a href={c.lienTelephone} className="inline-flex min-h-8 items-center font-medium lm-lien">
                {c.telephone}
              </a>
            </>
          ) : (
            `Besoin d’aide ? Contactez ${marque.nom ?? 'votre conciergerie'}.`
          )}
        </p>
        {MODE_DEMO && (
          <p className="mt-2 text-center text-[13px]">
            <a href={`?apercu=${PROPRIETAIRE_DEMO}`} className="inline-flex min-h-8 items-center font-medium lm-lien">
              Voir l’espace de démonstration
            </a>
          </p>
        )}
      </div>
    </div>
  );
}

/** Indicateur simple de la force du mot de passe : trois traits et un mot. */
function ForceMotDePasse({ motDePasse }: { motDePasse: string }) {
  const f = forceMotDePasse(motDePasse);
  if (!motDePasse) return null;
  const couleur = f.niveau <= 1 ? 'bg-(--lm-danger)' : f.niveau === 2 ? 'bg-(--lm-or)' : 'bg-(--lm-succes)';
  return (
    <div className="mt-1.5 flex items-center gap-2" aria-live="polite">
      <div className="flex flex-1 gap-1" aria-hidden>
        {[1, 2, 3].map((n) => (
          <span key={n} className={`h-1 flex-1 rounded-sm ${n <= Math.max(f.niveau, 1) && f.niveau > 0 ? couleur : 'bg-(--lm-bord-fort)'}`} />
        ))}
      </div>
      <span className="text-[12px] text-(--lm-encre-2)">{f.libelle}</span>
    </div>
  );
}

/* -------------------------------------------------------------- connexion */

function Connexion({
  marque,
  message,
  ton,
  emailInitial,
  onEntre,
  onCreer,
}: {
  marque: MarqueConnexion;
  message?: string;
  ton?: Ton;
  emailInitial?: string;
  onEntre: () => void;
  onCreer: () => void;
}) {
  const [email, setEmail] = useState(emailInitial ?? '');
  const [motDePasse, setMotDePasse] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [retour, setRetour] = useState<{ texte: string; ton: Ton } | undefined>(message ? { texte: message, ton: ton ?? 'neutre' } : undefined);
  const invitation = invitationAccesGardee(GENRE);

  const connecter = async (e: FormEvent) => {
    e.preventDefault();
    setRetour(undefined);
    const adresse = email.trim().toLowerCase();
    if (!adresseBienFormee(adresse) || !motDePasse) return setRetour({ ton: 'danger', texte: 'Saisissez votre adresse e-mail et votre mot de passe.' });
    if (MODE_DEMO) return setRetour({ ton: 'succes', texte: MESSAGE_DEMO });
    setEnCours(true);
    const c = await seConnecterExterne(GENRE, adresse, motDePasse);
    if (!c.ok) {
      setEnCours(false);
      return setRetour({ ton: 'danger', texte: c.erreur });
    }
    const r = await ouvrirAvecCompte(c.jeton, adresse);
    setEnCours(false);
    setMotDePasse('');
    if (r.ok) return onEntre();
    setRetour({ ton: r.code === 'retire' || r.code === 'invite' ? 'neutre' : 'danger', texte: r.message });
  };

  const oublie = async () => {
    const adresse = email.trim().toLowerCase();
    if (!adresseBienFormee(adresse)) return setRetour({ ton: 'danger', texte: 'Saisissez d’abord votre adresse e-mail, puis touchez « Mot de passe oublié ? ».' });
    if (MODE_DEMO) return setRetour({ ton: 'succes', texte: 'Démonstration : aucun e-mail n’est envoyé.' });
    setRetour(undefined);
    const r = await envoyerLienMotDePasseExterne(GENRE, adresse);
    // Même réponse que l'adresse ait un compte ou non.
    setRetour(r.ok ? { ton: 'info', texte: MESSAGE_OUBLIE } : { ton: 'danger', texte: r.erreur });
  };

  return (
    <Cadre marque={marque} titre="Votre espace propriétaire" phrase="Connectez-vous avec votre adresse e-mail et votre mot de passe.">
      <form onSubmit={(e) => void connecter(e)} noValidate className="mt-5 space-y-4">
        <Field label="Adresse e-mail">
          <Input
            type="email"
            name="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="off"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vous@exemple.fr"
            className="h-11 text-[16px]"
          />
        </Field>
        <Field label="Mot de passe">
          <Input type="password" name="password" autoComplete="current-password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} className="h-11 text-[16px]" />
        </Field>
        {retour && (
          <Alert tone={retour.ton} className="py-2">
            {retour.texte}
          </Alert>
        )}
        <Button type="submit" variant="primary" size="lg" chargement={enCours} className="w-full">
          Se connecter
        </Button>
      </form>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4">
        <button type="button" onClick={() => void oublie()} className={LIEN_TEXTE}>
          Mot de passe oublié&nbsp;?
        </button>
        {invitation && (
          <button type="button" onClick={onCreer} className={LIEN_TEXTE}>
            Créer mon compte
          </button>
        )}
      </div>
    </Cadre>
  );
}

/* --------------------------------------------------------- créer un compte */

/**
 * « Créez votre mot de passe » : l'adresse de l'invitation (fixe), le mot de
 * passe deux fois (12 caractères au moins, indicateur simple). Le compte est
 * créé auprès de Supabase ; l'adresse reste à confirmer par son lien.
 */
function CreerCompte({ marque, email, onCree, onDejaUnCompte }: { marque: MarqueConnexion; email: string; onCree: (jeton?: string) => void; onDejaUnCompte: () => void }) {
  const [motDePasse, setMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [erreur, setErreur] = useState<string>();
  const [enCours, setEnCours] = useState(false);

  const creer = async (e: FormEvent) => {
    e.preventDefault();
    const refus = motDePasseRefuse(motDePasse, confirmation);
    if (refus) return setErreur(refus);
    setErreur(undefined);
    if (MODE_DEMO) return setErreur(MESSAGE_DEMO);
    setEnCours(true);
    const r = await creerCompteExterne(GENRE, email, motDePasse);
    setEnCours(false);
    setMotDePasse('');
    setConfirmation('');
    if (!r.ok) return setErreur(r.erreur);
    onCree(r.jeton);
  };

  return (
    <Cadre marque={marque} titre="Créez votre mot de passe" phrase={`${CONTENU_ESPACE.vous.charAt(0).toUpperCase()}${CONTENU_ESPACE.vous.slice(1)} : votre espace s’ouvre avec votre adresse et ce mot de passe.`}>
      <form onSubmit={(e) => void creer(e)} noValidate className="mt-5 space-y-4">
        <div>
          <p className="text-[13px] font-semibold text-(--lm-encre)">Adresse e-mail</p>
          <p className="mt-1 text-[15px] font-medium text-(--lm-encre) [overflow-wrap:anywhere]">{email}</p>
          {/* Le champ caché donne l'adresse aux gestionnaires de mots de passe. */}
          <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
        </div>
        <Field label="Mot de passe" aide={`${MOT_DE_PASSE_MIN} caractères au moins.`}>
          <div>
            <Input type="password" autoComplete="new-password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} autoFocus className="h-11 text-[16px]" />
            <ForceMotDePasse motDePasse={motDePasse} />
          </div>
        </Field>
        <Field label="Confirmer le mot de passe">
          <Input type="password" autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} className="h-11 text-[16px]" />
        </Field>
        {erreur && (
          <Alert tone={MODE_DEMO && erreur === MESSAGE_DEMO ? 'succes' : 'danger'} className="py-2">
            {erreur}
          </Alert>
        )}
        <Button type="submit" variant="primary" size="lg" chargement={enCours} className="w-full">
          Créer mon compte
        </Button>
      </form>
      <button type="button" onClick={onDejaUnCompte} className={`mt-4 ${LIEN_TEXTE}`}>
        J’ai déjà un compte
      </button>
    </Cadre>
  );
}

function ConfirmerAdresse({ marque, email, onConnexion }: { marque: MarqueConnexion; email: string; onConnexion: () => void }) {
  return (
    <Cadre marque={marque} titre="Confirmez votre adresse">
      <p className="mt-3 text-[14px] text-(--lm-encre)">
        Un e-mail vient de partir à <strong className="[overflow-wrap:anywhere]">{email}</strong>. Ouvrez son lien sur cet appareil : votre espace s’ouvrira.
      </p>
      <p className="mt-2 text-[13px] text-(--lm-encre-2)">Rien reçu d’ici quelques minutes ? Regardez dans les indésirables.</p>
      <Button variant="secondary" className="mt-5 w-full" onClick={onConnexion}>
        J’ai déjà un compte : me connecter
      </Button>
    </Cadre>
  );
}

/* ---------------------------------------------------- nouveau mot de passe */

function NouveauMotDePasse({ marque, email, onFini }: { marque: MarqueConnexion; email: string; onFini: (r: { ok: true } | { ok: false; message: string; code: string }) => void }) {
  const [motDePasse, setMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [erreur, setErreur] = useState<string>();
  const [enCours, setEnCours] = useState(false);

  const valider = async (e: FormEvent) => {
    e.preventDefault();
    const refus = motDePasseRefuse(motDePasse, confirmation);
    if (refus) return setErreur(refus);
    setErreur(undefined);
    if (MODE_DEMO) return setErreur(MESSAGE_DEMO);
    setEnCours(true);
    const r = await changerMotDePasseExterne(GENRE, motDePasse);
    if (!r.ok) {
      setEnCours(false);
      return setErreur(r.erreur);
    }
    const ouverture = await ouvrirAvecCompte(r.jeton, email);
    setEnCours(false);
    onFini(ouverture);
  };

  return (
    <Cadre marque={marque} titre="Nouveau mot de passe" phrase={`Choisissez votre mot de passe : ${MOT_DE_PASSE_MIN} caractères au moins.`}>
      <form onSubmit={(e) => void valider(e)} noValidate className="mt-5 space-y-4">
        {email && <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />}
        <Field label="Nouveau mot de passe">
          <div>
            <Input type="password" autoComplete="new-password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} autoFocus className="h-11 text-[16px]" />
            <ForceMotDePasse motDePasse={motDePasse} />
          </div>
        </Field>
        <Field label="Confirmer le mot de passe">
          <Input type="password" autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} className="h-11 text-[16px]" />
        </Field>
        {erreur && (
          <Alert tone={MODE_DEMO && erreur === MESSAGE_DEMO ? 'succes' : 'danger'} className="py-2">
            {erreur}
          </Alert>
        )}
        <Button type="submit" variant="primary" size="lg" chargement={enCours} className="w-full">
          Enregistrer et ouvrir mon espace
        </Button>
      </form>
    </Cadre>
  );
}

/* ------------------------------------------------------------------- page */

export default function EspaceProprietaire() {
  const [parametres, setParametres] = useSearchParams();
  const [etat, setEtat] = useState<Etat>({ nom: 'chargement' });
  // Espace du lien reçu (invitation).
  const [espaceLien, setEspaceLien] = useState<string>();
  // Calendrier : un cache par mois (tous ses logements), rempli par plages de mois en défilant.
  const [moisConnus, setMoisConnus] = useState<Record<string, CalendrierLogement[]>>({});
  // Plages en cours de chargement : une même plage n'est jamais demandée deux fois à la fois.
  const plagesEnCours = useRef(new Map<string, Promise<RetourChargeur>>());
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

  const charger = useCallback(async (): Promise<Etat> => {
    if (MODE_DEMO) {
      if (!apercu) return { nom: 'connexion' };
      const vue = await vueDemo(apercu);
      return vue ? { nom: 'pret', vue, demo: true } : { nom: 'erreur', message: 'Propriétaire de démonstration introuvable.' };
    }
    const r = await appeler('GET', { action: 'vue' });
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

  /** Pose l'état ; une vue prête amorce le cache du calendrier avec son premier mois, les autres viendront par plages. */
  const montrer = useCallback((e: Etat) => {
    setEtat(e);
    if (e.nom === 'pret') setMoisConnus({ [e.vue.calendrier.mois]: e.vue.calendrier.logements });
  }, []);

  useEffect(() => {
    let actif = true;
    const poser = (e: Etat) => {
      if (actif) montrer(e);
    };
    void (async () => {
      const retour = RETOUR_LIEN_EXTERNE;
      // Lien d'invitation : le code reste sur l'appareil, on choisit son mot de passe.
      if (retour.nature === 'creer') {
        setEspaceLien(retour.espace);
        if (!MODE_DEMO) retenirEspace({ espace: retour.espace });
        if (retour.email && retour.code) {
          garderInvitationAcces(GENRE, { email: retour.email, code: retour.code, espace: retour.espace });
          return poser({ nom: 'creer', email: retour.email });
        }
        return poser({ nom: 'connexion', ton: 'info', message: MESSAGE_SANS_INVITATION, email: retour.email || undefined });
      }
      if (retour.nature === 'erreur') return poser({ nom: 'connexion', ton: 'danger', message: retour.message });
      if (MODE_DEMO) {
        // Démonstration : les écrans de compte se montrent sans Supabase.
        if (retour.nature === 'recuperation') {
          nettoyerAdresse();
          return poser({ nom: 'nouveau_mot_de_passe', email: 'vous@exemple.fr' });
        }
        if (retour.nature === 'confirmation') nettoyerAdresse();
        return poser(await charger());
      }
      if (retour.nature === 'recuperation' || retour.nature === 'confirmation') {
        // Le client Supabase a lu les jetons du lien : la session est en mémoire, et nulle part ailleurs.
        const s = await sessionExterne(GENRE);
        nettoyerAdresse();
        if (!s) return poser({ nom: 'connexion', ton: 'danger', message: 'Ce lien a expiré ou a déjà servi. Demandez un nouveau lien avec « Mot de passe oublié ? ».' });
        if (retour.nature === 'recuperation') return poser({ nom: 'nouveau_mot_de_passe', email: s.email });
        // Adresse confirmée : activation avec le code gardé ici, ou entrée si le compte a déjà son accès.
        const r = await ouvrirAvecCompte(s.jeton, s.email);
        if (r.ok) return poser(await charger());
        if (r.code === 'inconnu' || r.code === 'invite') return poser({ nom: 'connexion', ton: 'info', message: MESSAGE_CONFIRMEE_SANS_CODE, email: s.email });
        return poser({ nom: 'connexion', ton: r.code === 'retire' ? 'neutre' : 'danger', message: r.message, email: s.email });
      }
      poser(await charger());
    })();
    return () => {
      actif = false;
    };
  }, [charger, montrer]);

  /** Les mois de `de` à `a` dans le cache : `GET ?action=calendrier` (ou le calcul de démonstration). */
  const chargerCalendrier = useCallback<ChargeurMois>(
    (de, a) => {
      const cle = `${de}..${a}`;
      const deja = plagesEnCours.current.get(cle);
      if (deja) return deja;
      const retenir = (mois: MoisCalendrierVue[]) => setMoisConnus((c) => ({ ...c, ...Object.fromEntries(mois.map((m) => [m.mois, m.logements])) }));
      const p = (async (): Promise<RetourChargeur> => {
        if (MODE_DEMO) {
          const r = await calendrierDemo(apercu, de, a);
          if (r.ok) retenir(r.mois);
          return r.ok ? { ok: true } : r;
        }
        const r = await appeler('GET', { action: 'calendrier', de, a });
        if (r.statut === 200 && Array.isArray(r.json.mois)) {
          const mois = (r.json.mois as MoisCalendrierVue[]).filter((m) => moisValide(m?.mois) && Array.isArray(m.logements));
          // Un mois demandé absent de la réponse : un échec (« Réessayer »), jamais une plage redemandée sans fin.
          const recus = new Set(mois.map((m) => m.mois));
          if (moisEntre(de, a).some((m) => !recus.has(m))) return { ok: false, erreur: ERREUR_CALENDRIER };
          retenir(mois);
          return { ok: true };
        }
        if (r.statut === 401) {
          const message = r.json.code === 'retire' ? String(r.json.erreur ?? '') : 'Votre session a expiré : reconnectez-vous.';
          setEtat({ nom: 'connexion', ton: 'neutre', message });
          return { ok: false, erreur: message };
        }
        return { ok: false, erreur: String(r.json.erreur ?? ERREUR_CALENDRIER) };
      })().finally(() => plagesEnCours.current.delete(cle));
      plagesEnCours.current.set(cle, p);
      return p;
    },
    [apercu],
  );

  const sortir = async () => {
    if (!MODE_DEMO) await appeler('POST', { action: 'sortir' });
    setParametres(new URLSearchParams(), { replace: true });
    setEtat({ nom: 'connexion', ton: 'succes', message: 'Vous êtes déconnecté.' });
  };

  const marque: MarqueConnexion = MODE_DEMO ? { nom: 'Label Maison', labelMaison: true } : marqueConnexion(espaceLien, espaceRetenu());
  const ouvrir = () => {
    setEtat({ nom: 'chargement' });
    void charger().then(montrer);
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
      {etat.nom === 'connexion' && (
        <Connexion
          key={`${etat.message ?? ''}|${etat.email ?? ''}`}
          marque={marque}
          message={etat.message}
          ton={etat.ton}
          emailInitial={etat.email}
          onEntre={ouvrir}
          onCreer={() => {
            const inv = invitationAccesGardee(GENRE);
            setEtat(inv ? { nom: 'creer', email: inv.email } : { nom: 'connexion', ton: 'info', message: MESSAGE_SANS_INVITATION });
          }}
        />
      )}
      {etat.nom === 'creer' && (
        <CreerCompte
          marque={marque}
          email={etat.email}
          onDejaUnCompte={() => setEtat({ nom: 'connexion', email: etat.email })}
          onCree={(jeton) => {
            if (!jeton) return setEtat({ nom: 'confirmer', email: etat.email });
            // Confirmation d'adresse coupée côté Supabase : le compte est déjà confirmé, on active tout de suite.
            setEtat({ nom: 'chargement' });
            void ouvrirAvecCompte(jeton, etat.email).then((r) => (r.ok ? ouvrir() : setEtat({ nom: 'connexion', ton: 'danger', message: r.message, email: etat.email })));
          }}
        />
      )}
      {etat.nom === 'confirmer' && <ConfirmerAdresse marque={marque} email={etat.email} onConnexion={() => setEtat({ nom: 'connexion', email: etat.email })} />}
      {etat.nom === 'nouveau_mot_de_passe' && (
        <NouveauMotDePasse
          marque={marque}
          email={etat.email}
          onFini={(r) => (r.ok ? ouvrir() : setEtat({ nom: 'connexion', ton: r.code === 'retire' ? 'neutre' : 'danger', message: r.message, email: etat.email }))}
        />
      )}
      {(etat.nom === 'ferme' || etat.nom === 'erreur') && (
        <div className="grid min-h-screen place-items-center px-4">
          <Card className="w-full max-w-sm p-6 text-center">
            <p className="lm-titre text-[22px] text-(--lm-brun)">Espace propriétaire</p>
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
          calendrier={{ connus: moisConnus, charger: chargerCalendrier }}
          LienDocument={etat.demo ? LienDocumentDemo : LienDocumentServeur}
          onSortir={() => void sortir()}
          bandeau={
            etat.demo ? (
              <p className="lm-sans-impression border-b border-(--lm-bord) bg-(--lm-surface-2) px-4 py-2 text-center text-[12.5px] font-medium text-(--lm-encre)">
                Démonstration · espace de {etat.vue.proprietaire.nom}
              </p>
            ) : undefined
          }
        />
      )}
    </div>
  );
}
