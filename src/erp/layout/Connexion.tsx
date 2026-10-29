/**
 * Porte d'entrée de l'ERP (production) : chargement, connexion par compte
 * personnel (e-mail et mot de passe, en secours de la page d'accès du
 * middleware), nouveau mot de passe (lien de récupération), dernière étape
 * d'une invitation (mot de passe, puis activation avec le code gardé sur
 * l'appareil), lien d'un autre compte sur un appareil déjà connecté, compte
 * non autorisé (avec la raison quand la base la donne : espace suspendu,
 * invitation expirée), base pas encore installée, base injoignable.
 *
 * Aucun accès au store ici : ces écrans s'affichent avant que les données
 * existent.
 */
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { ChevronRight, Database, KeyRound, Loader2, LogIn, LogOut, RefreshCw, ShieldAlert, UserPlus, Users, WifiOff } from 'lucide-react';
import { EMAIL_VALIDE } from '../data/invitation';
import {
  RETOUR_LIEN,
  activerAvecCode,
  baseInvitations,
  changerMotDePasse,
  codeInvitationDe,
  creerCompte,
  envoyerLienMotDePasse,
  invitationGardee,
  seConnecter,
  type GenreErreur,
} from '../data/supabase';
import { Alert, Button, Field, Input, Repli } from '../ui';

export type PhasePorte =
  | { nom: 'demarrage' }
  | { nom: 'chargement' }
  | { nom: 'pret' }
  | { nom: 'connexion'; message?: string }
  | { nom: 'nouveau_mot_de_passe' }
  | { nom: 'non_autorise'; email: string; motif?: string }
  /** Code d'invitation gardé pour ce compte : il reste à saisir le mot de passe. */
  | { nom: 'activer'; email: string }
  /** Lien reçu par e-mail pour un autre compte que celui de la session. */
  | { nom: 'autre_compte'; actuel: string; autre: string }
  | { nom: 'base_absente' }
  | { nom: 'erreur'; genre: GenreErreur; message: string };

interface Props {
  phase: PhasePorte;
  onReessayer: () => void;
  onMotDePasseChange: () => void;
  onDeconnecter: () => void;
  /** Lien d'un autre compte : se déconnecter et le suivre. */
  onSuivreLien?: () => void;
  /** Lien d'un autre compte : rester sur la session ouverte. */
  onRester?: () => void;
}

/** Refus neutre : le même, qu'il manque l'invitation, son code ou la ligne de membre. */
export const MESSAGE_SANS_ACCES = 'Ce compte n’a pas accès à l’ERP.';

export function EcranPorte({ phase, onReessayer, onMotDePasseChange, onDeconnecter, onSuivreLien, onRester }: Props) {
  switch (phase.nom) {
    case 'connexion':
      return <FormulaireConnexion message={phase.message} />;
    case 'nouveau_mot_de_passe':
      return <NouveauMotDePasse onFini={onMotDePasseChange} />;
    case 'activer':
      return <ActiverCompte email={phase.email} onFini={onReessayer} onDeconnecter={onDeconnecter} />;
    case 'autre_compte':
      return (
        <Cadre titre="Se déconnecter pour continuer ?" icone={<Users />}>
          <p className="text-[14px] text-(--lm-encre)">
            Compte ouvert&nbsp;: <strong className="[overflow-wrap:anywhere]">{phase.actuel}</strong>. Ce lien est pour{' '}
            {phase.autre ? <strong className="[overflow-wrap:anywhere]">{phase.autre}</strong> : 'un autre compte'}.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="primary" icone={<LogOut />} onClick={onSuivreLien}>
              Se déconnecter et continuer
            </Button>
            <Button onClick={onRester}>Rester connecté</Button>
          </div>
        </Cadre>
      );
    case 'non_autorise':
      return (
        <Cadre titre="Accès non autorisé" icone={<ShieldAlert />}>
          <Alert tone="alerte" titre={phase.motif ?? MESSAGE_SANS_ACCES}>
            Compte ouvert&nbsp;: <strong className="[overflow-wrap:anywhere]">{phase.email}</strong>.
          </Alert>
          {!phase.motif && (
            <p className="mt-4 text-[13px] text-(--lm-encre-2)">
              Vous avez reçu une invitation&nbsp;? Ouvrez son lien sur cet appareil (il sert une fois, pendant 14 jours). Sinon, demandez à un gérant de
              vous ajouter.
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="primary" icone={<RefreshCw />} onClick={onReessayer}>
              Réessayer
            </Button>
            <Button icone={<LogOut />} onClick={onDeconnecter}>
              Changer de compte
            </Button>
          </div>
        </Cadre>
      );
    case 'base_absente':
      return <BaseAbsente onReessayer={onReessayer} onDeconnecter={onDeconnecter} />;
    case 'erreur':
      return <ErreurBase genre={phase.genre} message={phase.message} onReessayer={onReessayer} onDeconnecter={onDeconnecter} />;
    case 'chargement':
      return <Chargement texte="Chargement des données…" />;
    default:
      return <Chargement texte="Ouverture de l’ERP…" />;
  }
}

/* ------------------------------------------------------------------ cadre */

function Marque() {
  return (
    <div className="mb-6 flex flex-col items-center text-center">
      <span aria-hidden className="grid size-11 place-items-center rounded-xl bg-(--lm-brun) text-[15px] font-semibold text-(--lm-sur-brun)">
        LM
      </span>
      <p className="mt-3 text-[11.5px] font-semibold tracking-[0.2em] text-(--lm-or-texte) uppercase">Label Maison · ERP</p>
    </div>
  );
}

function Cadre({ titre, sousTitre, icone, children }: { titre: string; sousTitre?: ReactNode; icone?: ReactNode; children: ReactNode }) {
  return (
    <main translate="no" className="flex min-h-screen items-center justify-center bg-(--lm-fond) px-4 py-10">
      <div className="w-full max-w-[440px]">
        <Marque />
        <div className="rounded-2xl border border-(--lm-bord) bg-(--lm-surface) p-6 shadow-(--lm-ombre) sm:p-8">
          <div className="mb-5 flex items-start gap-3">
            {icone && (
              <span aria-hidden className="mt-1 grid size-9 shrink-0 place-items-center rounded-lg bg-(--lm-surface-2) text-(--lm-encre) [&_svg]:size-[18px]">
                {icone}
              </span>
            )}
            <div className="min-w-0">
              <h1 className="lm-titre text-[24px] leading-tight text-(--lm-encre)" style={{ fontFamily: 'var(--lm-titre)' }}>
                {titre}
              </h1>
              {sousTitre && <p className="mt-1 text-[13.5px] text-(--lm-encre-2)">{sousTitre}</p>}
            </div>
          </div>
          {children}
        </div>
        <p className="mt-6 text-center text-[12px] text-(--lm-encre-3)">Accès réservé aux équipes invitées.</p>
      </div>
    </main>
  );
}

function Chargement({ texte }: { texte: string }) {
  return (
    <main translate="no" className="flex min-h-screen items-center justify-center bg-(--lm-fond) px-4" aria-busy="true">
      <div className="flex flex-col items-center text-center">
        <Marque />
        <Loader2 className="size-6 animate-spin text-(--lm-encre)" aria-hidden />
        <p role="status" className="mt-3 text-[14px] text-(--lm-encre-2)">
          {texte}
        </p>
      </div>
    </main>
  );
}

/* -------------------------------------------------------------- connexion */

const LIEN_TEXTE = 'inline-flex min-h-8 items-center text-[13px] font-medium lm-lien';

/** Sans code d'invitation sur l'appareil, « Créer mon compte » ne mène à rien : on le dit. */
const MESSAGE_SANS_INVITATION = 'Pour créer votre compte, ouvrez le lien de l’invitation reçue par e-mail, sur cet appareil.';
/** Base d'avant les espaces : pas de création de compte par l'ERP. */
const MESSAGE_CREATION_FERMEE = 'La création de compte n’est pas encore ouverte : demandez à un gérant de vous ajouter.';

/**
 * « Créer mon compte » : d'abord qui l'on est (comme la page d'accès). Le
 * choix n'ouvre rien : propriétaires et équipes de terrain reçoivent un lien
 * de connexion par e-mail dans leur espace ; l'équipe d'une conciergerie crée
 * son compte avec le lien de son invitation.
 */
const ROLES_COMPTE = [
  { titre: 'Propriétaire', detail: 'Suivez vos logements. Connexion par un lien reçu par e‑mail.', href: '/espace-proprietaire' },
  { titre: 'Agent ou responsable de pôle', detail: 'Vos missions sur le terrain. Connexion par un lien reçu par e‑mail.', href: '/espace-operations' },
  { titre: 'Équipe d’une conciergerie', detail: 'Gérants et équipes, comme Label Maison, avec votre invitation.' },
] as const;
const CLASSE_CHOIX =
  'flex min-h-14 w-full items-center gap-3 rounded-lg border border-(--lm-bord-fort) px-4 py-3 text-left hover:border-(--lm-encre) hover:bg-(--lm-surface-2) focus-visible:ring-2 focus-visible:ring-(--lm-encre) focus:outline-none';

function ChoixRole({ onEquipe, onRetour }: { onEquipe: () => void; onRetour: () => void }) {
  const contenu = (r: (typeof ROLES_COMPTE)[number]) => (
    <>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-(--lm-encre)">{r.titre}</span>
        <span className="mt-0.5 block text-[13px] text-(--lm-encre-2)">{r.detail}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-(--lm-encre-3)" aria-hidden />
    </>
  );
  return (
    <Cadre titre="Créer mon compte" sousTitre="Vous êtes :" icone={<UserPlus />}>
      <div className="grid gap-2.5">
        {/* Focus sur la première ligne, comme la page d'accès. */}
        {ROLES_COMPTE.map((r, i) =>
          'href' in r ? (
            <a key={r.titre} href={r.href} className={CLASSE_CHOIX} autoFocus={i === 0}>
              {contenu(r)}
            </a>
          ) : (
            <button key={r.titre} type="button" onClick={onEquipe} className={CLASSE_CHOIX}>
              {contenu(r)}
            </button>
          ),
        )}
      </div>
      <button type="button" onClick={onRetour} className={`mt-4 ${LIEN_TEXTE}`}>
        J’ai déjà un compte
      </button>
    </Cadre>
  );
}

function FormulaireConnexion({ message }: { message?: string }) {
  // Lien d'invitation (#creer=<adresse>&code=…) : on commence par « Créer mon compte ».
  const gardee = invitationGardee();
  const [creation, setCreation] = useState(RETOUR_LIEN.creer !== undefined && !!gardee);
  const [email, setEmail] = useState(RETOUR_LIEN.creer || gardee?.email || '');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState<string>();
  const [info, setInfo] = useState<string | undefined>(() => (RETOUR_LIEN.creer !== undefined && !gardee ? MESSAGE_SANS_INVITATION : undefined));
  const [enCours, setEnCours] = useState(false);
  const [choix, setChoix] = useState(false);

  if (choix) {
    return (
      <ChoixRole
        onRetour={() => setChoix(false)}
        onEquipe={() => {
          setChoix(false);
          // Le lien de l'invitation garde son code sur l'appareil ; sans lui, rien à créer ici
          // (base d'avant les espaces : un gérant crée le compte dans Supabase).
          void baseInvitations().then((prete) => setInfo(prete === false ? MESSAGE_CREATION_FERMEE : MESSAGE_SANS_INVITATION));
        }}
      />
    );
  }

  if (creation && gardee) {
    return (
      <CreerCompte
        email={gardee.email}
        onRetour={(adresse, envoye) => {
          setEmail(adresse);
          setErreur(undefined);
          setInfo(envoye ? MESSAGE_COMPTE_CREE : undefined);
          setCreation(false);
        }}
      />
    );
  }

  const connecter = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !motDePasse) return setErreur('Saisissez votre adresse e-mail et votre mot de passe.');
    setEnCours(true);
    setErreur(undefined);
    setInfo(undefined);
    const r = await seConnecter(email, motDePasse);
    setEnCours(false);
    if (!r.ok) setErreur(r.erreur);
    // Succès : la session ouverte déclenche le chargement (ErpProvider).
  };

  const oublie = async () => {
    if (!email.trim()) return setErreur('Saisissez d’abord votre adresse e-mail, puis touchez « Mot de passe oublié ? ».');
    setErreur(undefined);
    const r = await envoyerLienMotDePasse(email);
    if (!r.ok && /trop de tentatives/i.test(r.erreur)) return setErreur(r.erreur);
    // Même réponse que l'adresse ait un compte ou non.
    setInfo('Si cette adresse a un compte, un lien pour choisir un mot de passe vient de lui être envoyé. Pensez à regarder dans les indésirables.');
  };

  return (
    <Cadre titre="ERP Label Maison" sousTitre="Outil interne de gestion" icone={<LogIn />}>
      {message && (
        <Alert tone="info" className="mb-4 py-2">
          {message}
        </Alert>
      )}
      <form onSubmit={connecter} noValidate className="grid gap-4">
        <Field label="Adresse e-mail">
          <Input
            type="email"
            name="email"
            autoComplete="username"
            inputMode="email"
            autoCapitalize="off"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
          />
        </Field>
        <Field label="Mot de passe">
          <Input type="password" name="password" autoComplete="current-password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} />
        </Field>
        {erreur && (
          <Alert tone="danger" className="py-2">
            {erreur}
          </Alert>
        )}
        {info && (
          <Alert tone="info" className="py-2">
            {info}
          </Alert>
        )}
        <Button type="submit" variant="primary" size="lg" chargement={enCours} icone={<LogIn />}>
          Accéder à l’ERP
        </Button>
      </form>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4">
        <button type="button" onClick={() => void oublie()} className={LIEN_TEXTE}>
          Mot de passe oublié&nbsp;?
        </button>
        <button
          type="button"
          onClick={() => {
            setErreur(undefined);
            setInfo(undefined);
            // Invitation déjà gardée sur l'appareil : droit à la création ; sinon, qui êtes-vous ?
            if (invitationGardee()) return setCreation(true);
            setChoix(true);
          }}
          className={LIEN_TEXTE}
        >
          Créer mon compte
        </button>
      </div>
    </Cadre>
  );
}

/* ---------------------------------------------------------- créer un compte */

const MESSAGE_COMPTE_CREE =
  'Ouvrez sur cet appareil le lien reçu par e-mail pour confirmer votre adresse. Rien reçu d’ici quelques minutes ? Regardez dans les indésirables ; si vous aviez déjà un compte, connectez-vous ci-dessous.';

/**
 * « Créer mon compte » (secours de la page d'accès, mêmes règles), avec le
 * code d'invitation gardé sur l'appareil : l'adresse invitée (fixe), le mot
 * de passe deux fois. Personne n'est connecté ici ; le lien de confirmation
 * reçu par e-mail ramène à la page d'accès, qui active l'accès avec le code.
 * Base d'avant les espaces : fermé, on dit pourquoi.
 */
function CreerCompte({ email, onRetour }: { email: string; onRetour: (email: string, envoye: boolean) => void }) {
  const [motDePasse, setMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [erreur, setErreur] = useState<string>();
  const [enCours, setEnCours] = useState(false);
  const [fermee, setFermee] = useState(false);

  useEffect(() => {
    let actif = true;
    void baseInvitations().then((prete) => {
      if (actif && prete === false) setFermee(true);
    });
    return () => {
      actif = false;
    };
  }, []);

  const creer = async (e: FormEvent) => {
    e.preventDefault();
    const adresse = email.trim();
    if (!adresse) return setErreur('Saisissez votre adresse e-mail.');
    if (!EMAIL_VALIDE.test(adresse)) return setErreur('Adresse e-mail invalide.');
    if (motDePasse.length < 8) return setErreur('Mot de passe trop court : 8 caractères au moins.');
    if (motDePasse !== confirmation) return setErreur('Les deux mots de passe sont différents.');
    setEnCours(true);
    setErreur(undefined);
    const r = await creerCompte(adresse, motDePasse);
    setEnCours(false);
    setMotDePasse('');
    setConfirmation('');
    if (!r.ok) return setErreur(r.erreur);
    onRetour(adresse, true);
  };

  if (fermee) {
    return (
      <Cadre titre="Créer mon compte" icone={<UserPlus />}>
        <Alert tone="info">{MESSAGE_CREATION_FERMEE}</Alert>
        <button type="button" onClick={() => onRetour(email, false)} className={`mt-4 ${LIEN_TEXTE}`}>
          J’ai déjà un compte
        </button>
      </Cadre>
    );
  }

  return (
    <Cadre titre="Créer mon compte" sousTitre="Utilisez l’adresse qui a reçu l’invitation." icone={<UserPlus />}>
      <form onSubmit={creer} noValidate className="grid gap-4">
        {/* Adresse de l'invitation, affichée telle quelle (le champ caché la donne aux gestionnaires de mots de passe). */}
        <div>
          <p className="text-[13px] font-medium text-(--lm-encre-2)">Adresse e-mail</p>
          <p className="mt-1 text-[15px] font-medium text-(--lm-encre) [overflow-wrap:anywhere]">{email}</p>
          <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
        </div>
        <Field label="Mot de passe" aide="8 caractères au moins.">
          <Input type="password" autoComplete="new-password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} autoFocus />
        </Field>
        <Field label="Confirmer le mot de passe">
          <Input type="password" autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
        </Field>
        {erreur && (
          <Alert tone="danger" className="py-2">
            {erreur}
          </Alert>
        )}
        <Button type="submit" variant="primary" size="lg" chargement={enCours} icone={<UserPlus />}>
          Créer mon compte
        </Button>
      </form>
      <button type="button" onClick={() => onRetour(email, false)} className={`mt-4 ${LIEN_TEXTE}`}>
        J’ai déjà un compte
      </button>
    </Cadre>
  );
}

/* ------------------------------------------- dernière étape d'une invitation */

/**
 * Compte connecté, code d'invitation gardé sur l'appareil pour son adresse :
 * le mot de passe saisi ici devient celui du compte, puis l'accès est activé
 * (activerAvecCode). Un compte créé avant, par quelqu'un d'autre, à cette
 * adresse, perd ainsi son mot de passe et ses sessions.
 */
function ActiverCompte({ email, onFini, onDeconnecter }: { email: string; onFini: () => void; onDeconnecter: () => void }) {
  const [motDePasse, setMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [erreur, setErreur] = useState<string>();
  const [enCours, setEnCours] = useState(false);

  const valider = async (e: FormEvent) => {
    e.preventDefault();
    if (motDePasse.length < 8) return setErreur('Mot de passe trop court : 8 caractères au moins.');
    // Il devient le mot de passe du compte : saisi deux fois, comme à la création.
    if (motDePasse !== confirmation) return setErreur('Les deux mots de passe sont différents.');
    const code = codeInvitationDe(email);
    if (!code) return onFini();
    setEnCours(true);
    setErreur(undefined);
    const r = await activerAvecCode(code, motDePasse);
    setEnCours(false);
    setMotDePasse('');
    setConfirmation('');
    if (!r.ok) return setErreur(r.erreur);
    onFini();
  };

  return (
    <Cadre titre="Dernière étape" sousTitre="Saisissez le mot de passe de votre compte." icone={<KeyRound />}>
      <form onSubmit={valider} noValidate className="grid gap-4">
        <Field label="Mot de passe" aide="Celui choisi à la création du compte, ou un nouveau : 8 caractères au moins.">
          <Input type="password" autoComplete="new-password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} autoFocus />
        </Field>
        <Field label="Confirmer le mot de passe">
          <Input type="password" autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
        </Field>
        {erreur && (
          <Alert tone="danger" className="py-2">
            {erreur}
          </Alert>
        )}
        <Button type="submit" variant="primary" size="lg" chargement={enCours} icone={<LogIn />}>
          Ouvrir l’ERP
        </Button>
      </form>
      <p className="mt-4 text-[12.5px] text-(--lm-encre-2)">
        Compte <strong className="[overflow-wrap:anywhere] text-(--lm-encre)">{email}</strong>
      </p>
      <button type="button" onClick={onDeconnecter} className={`mt-1 ${LIEN_TEXTE}`}>
        Ce n’est pas moi&nbsp;: se déconnecter
      </button>
    </Cadre>
  );
}

/* ---------------------------------------------------- nouveau mot de passe */

function NouveauMotDePasse({ onFini }: { onFini: () => void }) {
  const [motDePasse, setMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [erreur, setErreur] = useState<string>();
  const [enCours, setEnCours] = useState(false);

  const valider = async (e: FormEvent) => {
    e.preventDefault();
    if (motDePasse.length < 8) return setErreur('Mot de passe trop court : 8 caractères au moins.');
    if (motDePasse !== confirmation) return setErreur('Les deux saisies sont différentes.');
    setEnCours(true);
    setErreur(undefined);
    const r = await changerMotDePasse(motDePasse);
    setEnCours(false);
    if (!r.ok) return setErreur(r.erreur);
    // « Enregistrer et ouvrir l’ERP » : on ouvre directement, comme la page d'accès.
    onFini();
  };


  return (
    <Cadre titre="Nouveau mot de passe" sousTitre="Choisissez votre mot de passe : 8 caractères au moins." icone={<KeyRound />}>
      <form onSubmit={valider} noValidate className="grid gap-4">
        <Field label="Nouveau mot de passe">
          <Input type="password" autoComplete="new-password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} autoFocus />
        </Field>
        <Field label="Confirmer le mot de passe">
          <Input type="password" autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
        </Field>
        {erreur && (
          <Alert tone="danger" className="py-2">
            {erreur}
          </Alert>
        )}
        <Button type="submit" variant="primary" size="lg" chargement={enCours} icone={<KeyRound />}>
          Enregistrer et ouvrir l’ERP
        </Button>
      </form>
    </Cadre>
  );
}

/* ------------------------------------------------------ base non installée */

function BaseAbsente({ onReessayer, onDeconnecter }: { onReessayer: () => void; onDeconnecter: () => void }) {
  return (
    <Cadre titre="Installation en cours" icone={<Database />}>
      <p className="text-[14px] text-(--lm-encre)">L’ERP n’est pas encore prêt&nbsp;: prévenez la personne qui l’installe.</p>
      {/* Pour la personne qui installe : replié, rien de technique à l'écran par défaut. */}
      <Repli className="mt-4 shadow-none" titre="Détails techniques">
        <p className="text-[13px] text-(--lm-encre-2)">
          La connexion fonctionne, mais les tables de l’ERP n’existent pas encore (ou ne sont pas visibles par l’application). À faire une seule fois
          dans Supabase&nbsp;:
        </p>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-[13px] text-(--lm-encre)">
          <li>
            Ouvrir <strong>SQL Editor</strong>, coller tout le fichier <code>supabase/erp-installation.sql</code>, cliquer sur <strong>Run</strong>.
          </li>
          <li>
            Ajouter l’e-mail de chaque membre dans <code>erp.membres</code> (bloc prévu en fin de fichier).
          </li>
          <li>
            Si ce message reste affiché&nbsp;: <strong>Project Settings</strong>, <strong>Data API</strong>, <strong>Exposed schemas</strong>, ajouter{' '}
            <code>erp</code>, enregistrer.
          </li>
        </ol>
        <p className="mt-3 text-[12.5px] text-(--lm-encre-2)">Le détail pas à pas est dans docs/erp/README.md, partie «&nbsp;Mise en production réelle&nbsp;».</p>
      </Repli>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button variant="primary" icone={<RefreshCw />} onClick={onReessayer}>
          Réessayer
        </Button>
        <Button icone={<LogOut />} onClick={onDeconnecter}>
          Se déconnecter
        </Button>
      </div>
    </Cadre>
  );
}

/* --------------------------------------------------------- base injoignable */

function ErreurBase({
  genre,
  message,
  onReessayer,
  onDeconnecter,
}: {
  genre: GenreErreur;
  message: string;
  onReessayer: () => void;
  onDeconnecter: () => void;
}) {
  const reseau = genre === 'reseau';
  // Réseau coupé : nouvel essai automatique toutes les 15 secondes.
  useEffect(() => {
    if (!reseau) return;
    const t = setInterval(onReessayer, 15_000);
    return () => clearInterval(t);
  }, [reseau, onReessayer]);

  return (
    <Cadre titre={reseau ? 'Base de données injoignable' : 'Chargement impossible'} icone={reseau ? <WifiOff /> : <ShieldAlert />}>
      <Alert tone={reseau ? 'alerte' : 'danger'}>{message}</Alert>
      {reseau && (
        <p className="mt-3 text-[13px] text-(--lm-encre-2)" aria-live="polite">
          Vérifiez la connexion internet. Nouvel essai automatique toutes les 15 secondes.
        </p>
      )}
      <div className="mt-5 flex flex-wrap gap-2">
        <Button variant="primary" icone={<RefreshCw />} onClick={onReessayer}>
          Réessayer
        </Button>
        <Button icone={<LogOut />} onClick={onDeconnecter}>
          Se déconnecter
        </Button>
      </div>
    </Cadre>
  );
}
