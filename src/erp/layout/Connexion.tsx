/**
 * Porte d'entrée de l'ERP (production) : chargement, connexion par le seul
 * mot de passe du compte d'équipe, nouveau mot de passe (lien de récupération),
 * compte non autorisé, base pas encore installée, base injoignable.
 *
 * Aucun accès au store ici : ces écrans s'affichent avant que les données
 * existent.
 */
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Database, KeyRound, Loader2, LogIn, LogOut, RefreshCw, ShieldAlert, WifiOff } from 'lucide-react';
import { EMAIL_EQUIPE } from '../data/config';
import { changerMotDePasse, seConnecter, type GenreErreur } from '../data/supabase';
import { Alert, Button, Field, Input } from '../ui';

export type PhasePorte =
  | { nom: 'demarrage' }
  | { nom: 'chargement' }
  | { nom: 'pret' }
  | { nom: 'connexion'; message?: string }
  | { nom: 'nouveau_mot_de_passe' }
  | { nom: 'non_autorise'; email: string }
  | { nom: 'base_absente' }
  | { nom: 'erreur'; genre: GenreErreur; message: string };

interface Props {
  phase: PhasePorte;
  onReessayer: () => void;
  onMotDePasseChange: () => void;
  onDeconnecter: () => void;
}

export function EcranPorte({ phase, onReessayer, onMotDePasseChange, onDeconnecter }: Props) {
  switch (phase.nom) {
    case 'connexion':
      return <FormulaireConnexion message={phase.message} />;
    case 'nouveau_mot_de_passe':
      return <NouveauMotDePasse onFini={onMotDePasseChange} />;
    case 'non_autorise':
      return (
        <Cadre titre="Accès non autorisé" icone={<ShieldAlert />}>
          <Alert tone="alerte" titre="Votre compte n’est pas autorisé. Demandez l’accès à un gérant.">
            Vous êtes connecté avec <strong className="break-all">{phase.email}</strong>, mais cette adresse ne figure pas dans la liste des membres
            de l’ERP.
          </Alert>
          <p className="mt-4 text-[13px] text-(--lm-encre-2)">
            Un gérant ajoute votre adresse depuis Paramètres, Utilisateurs & rôles, ou directement dans la table <code>erp.membres</code> de Supabase.
          </p>
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
      <span aria-hidden className="grid size-11 place-items-center rounded-xl bg-(--lm-brun) text-[15px] font-semibold text-[#F7F2E6]">
        LM
      </span>
      <p className="mt-3 text-[11.5px] font-semibold tracking-[0.2em] text-(--lm-or) uppercase">Label Maison · ERP</p>
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
              <span aria-hidden className="mt-1 grid size-9 shrink-0 place-items-center rounded-lg bg-(--lm-or-lavis) text-(--lm-or) [&_svg]:size-[18px]">
                {icone}
              </span>
            )}
            <div className="min-w-0">
              <h1 className="lm-serif text-[24px] leading-tight text-(--lm-encre)" style={{ fontFamily: 'var(--lm-serif)' }}>
                {titre}
              </h1>
              {sousTitre && <p className="mt-1 text-[13.5px] text-(--lm-encre-2)">{sousTitre}</p>}
            </div>
          </div>
          {children}
        </div>
        <p className="mt-6 text-center text-[12px] text-(--lm-encre-3)">Accès réservé à l’équipe Label Maison.</p>
      </div>
    </main>
  );
}

function Chargement({ texte }: { texte: string }) {
  return (
    <main translate="no" className="flex min-h-screen items-center justify-center bg-(--lm-fond) px-4" aria-busy="true">
      <div className="flex flex-col items-center text-center">
        <Marque />
        <Loader2 className="size-6 animate-spin text-(--lm-or)" aria-hidden />
        <p role="status" className="mt-3 text-[14px] text-(--lm-encre-2)">
          {texte}
        </p>
      </div>
    </main>
  );
}

/* -------------------------------------------------------------- connexion */

function FormulaireConnexion({ message }: { message?: string }) {
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState<string>();
  const [enCours, setEnCours] = useState(false);
  const [aide, setAide] = useState(false);

  const connecter = async (e: FormEvent) => {
    e.preventDefault();
    if (!motDePasse) return setErreur('Saisissez le mot de passe.');
    setEnCours(true);
    setErreur(undefined);
    const r = await seConnecter(EMAIL_EQUIPE, motDePasse);
    setEnCours(false);
    if (!r.ok) setErreur(r.erreur);
    // Succès : la session ouverte déclenche le chargement (ErpProvider).
  };

  return (
    <Cadre titre="Connexion" sousTitre="Saisissez le mot de passe de l’équipe Label Maison." icone={<LogIn />}>
      {message && (
        <Alert tone="info" className="mb-4 py-2">
          {message}
        </Alert>
      )}
      <form onSubmit={connecter} noValidate className="grid gap-4">
        {/* Identifiant caché : les gestionnaires de mots de passe l'associent au mot de passe. */}
        <input type="hidden" name="username" autoComplete="username" value={EMAIL_EQUIPE} readOnly />
        <Field label="Mot de passe">
          <Input
            type="password"
            name="password"
            autoComplete="current-password"
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
            autoFocus
          />
        </Field>
        {erreur && (
          <Alert tone="danger" className="py-2">
            {erreur}
          </Alert>
        )}
        <Button type="submit" variant="primary" size="lg" chargement={enCours} icone={<LogIn />}>
          Se connecter
        </Button>
      </form>
      {aide ? (
        <p className="mt-5 text-[13px] text-(--lm-encre-2)">
          Un gérant le réinitialise dans Supabase : Authentication, Users, compte <code>{EMAIL_EQUIPE}</code>, puis envoi d’un lien de récupération
          (ou nouveau mot de passe).
        </p>
      ) : (
        <button type="button" onClick={() => setAide(true)} className="mt-5 text-[13px] font-medium text-(--lm-or) hover:underline">
          Mot de passe oublié ?
        </button>
      )}
    </Cadre>
  );
}

/* ---------------------------------------------------- nouveau mot de passe */

function NouveauMotDePasse({ onFini }: { onFini: () => void }) {
  const [motDePasse, setMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [erreur, setErreur] = useState<string>();
  const [enCours, setEnCours] = useState(false);
  const [fait, setFait] = useState(false);

  const valider = async (e: FormEvent) => {
    e.preventDefault();
    if (motDePasse.length < 8) return setErreur('8 caractères au minimum.');
    if (motDePasse !== confirmation) return setErreur('Les deux saisies sont différentes.');
    setEnCours(true);
    setErreur(undefined);
    const r = await changerMotDePasse(motDePasse);
    setEnCours(false);
    if (!r.ok) return setErreur(r.erreur);
    setFait(true);
  };

  if (fait) {
    return (
      <Cadre titre="Mot de passe modifié" icone={<KeyRound />}>
        <Alert tone="succes">Votre nouveau mot de passe est enregistré.</Alert>
        <Button variant="primary" size="lg" className="mt-5 w-full" onClick={onFini}>
          Ouvrir l’ERP
        </Button>
      </Cadre>
    );
  }

  return (
    <Cadre titre="Nouveau mot de passe" sousTitre="Choisissez le mot de passe de votre compte." icone={<KeyRound />}>
      <form onSubmit={valider} noValidate className="grid gap-4">
        <Field label="Nouveau mot de passe" aide="8 caractères au minimum.">
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
          Enregistrer
        </Button>
      </form>
    </Cadre>
  );
}

/* ------------------------------------------------------ base non installée */

function BaseAbsente({ onReessayer, onDeconnecter }: { onReessayer: () => void; onDeconnecter: () => void }) {
  return (
    <Cadre titre="La base de données n’est pas encore installée" icone={<Database />}>
      <p className="text-[13.5px] text-(--lm-encre-2)">
        La connexion fonctionne, mais les tables de l’ERP n’existent pas encore (ou ne sont pas visibles par l’application). À faire une seule fois
        dans Supabase :
      </p>
      <ol className="mt-4 list-decimal space-y-2 pl-5 text-[13.5px] text-(--lm-encre)">
        <li>
          Ouvrir <strong>SQL Editor</strong>, coller tout le fichier <code>supabase/erp-installation.sql</code>, cliquer sur <strong>Run</strong>.
        </li>
        <li>
          Ajouter l’e-mail de chaque membre dans <code>erp.membres</code> (bloc prévu en fin de fichier).
        </li>
        <li>
          Si ce message reste affiché : <strong>Project Settings</strong>, <strong>Data API</strong>, <strong>Exposed schemas</strong>, ajouter{' '}
          <code>erp</code>, enregistrer.
        </li>
      </ol>
      <p className="mt-3 text-[12.5px] text-(--lm-encre-3)">Le détail pas à pas est dans docs/erp/README.md, partie « Mise en production réelle ».</p>
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
