/**
 * Demandes du propriétaire (novembre 2026), dans son espace : « Faire une
 * demande » en assistant pas à pas (une question par écran, la progression
 * en haut, « Retour » et « Continuer » en bas avec ce qui manque en toutes
 * lettres, un récapitulatif puis « Envoyer »), et « Mes demandes » avec leur
 * état et les réponses de la conciergerie.
 *
 * Sur le modèle de modules/logements/_composants/AssistantLogement.tsx, avec
 * les seuls moyens de l'espace (pas le store de l'ERP) ; à aligner plus tard
 * sur le composant `Assistant` du kit. Règles : data/demandes-proprietaires.ts
 * (les mêmes que le serveur). Aperçu du gérant : sans `envoyer`, rien ne part.
 */
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { Check, ChevronLeft, ChevronRight, CircleHelp, ClipboardList, Layers, MessageCircle, MessageSquarePlus, X, type LucideIcon } from 'lucide-react';
import {
  LIBELLE_STATUT_PROPRIETAIRE,
  MESSAGE_MAX,
  SUJETS_DEMANDE,
  TYPES_DEMANDE,
  erreursEtapeDemande,
  etapesDemande,
  libelleDemande,
  longueur,
  ouPorteLaDemande,
  saisieInitiale,
  type ChampDemande,
  type EtapeSaisieDemande,
  type SaisieDemande,
} from '../data/demandes-proprietaires';
import { dateCourte, dateHeure } from '../data/format';
import type { StatutDemandeProprietaire, SujetDemandeProprietaire, TypeDemandeProprietaire } from '../data/types';
import type { DemandeVue, VueProprietaire } from '../data/types-proprietaire';
import { Alert, Badge, Button, Card, EmptyState, IconButton, Modal, Skeleton, Textarea, cn, useFenetre, type Ton } from '../ui';
import { PhotoLogement, TitreEspace } from './commun';

/** Espace insécable : jamais « ? », « : » ou « » » seuls en début de ligne. */
const NBSP = ' ';

export type EnvoyerDemande = (s: SaisieDemande) => Promise<{ ok: true; demande: DemandeVue } | { ok: false; erreur: string }>;

/** Les demandes de l'espace : la liste (serveur, démo ou store du gérant) et l'envoi (absent : aperçu, rien ne part). */
export interface DemandesEspace {
  liste: DemandeVue[];
  chargement?: boolean;
  erreur?: string;
  recharger?: () => void;
  envoyer?: EnvoyerDemande;
}

/** Envoyée et vue : neutres ; répondue : l'information ; réglée : le succès. */
export const TON_STATUT_DEMANDE: Record<StatutDemandeProprietaire, Ton> = { envoyee: 'neutre', vue: 'neutre', repondue: 'info', reglee: 'succes' };

/** Liens tertiaires : 32 px sur ordinateur, 44 px au doigt. */
const LIEN_RETOUR =
  'lm-sans-impression -ml-2 mb-3 inline-flex h-9 max-sm:h-11 items-center gap-1 rounded-lg px-2 text-[13.5px] font-medium text-(--lm-encre-2) hover:bg-(--lm-surface-2) hover:text-(--lm-encre)';

const derniereReponse = (d: DemandeVue) => [...d.echanges].reverse().find((e) => e.auteur === 'conciergerie');

/* ---------------------------------------------------------------- échange */

/**
 * L'échange en bulles, comme la Messagerie : la personne qui lit à droite
 * (`moi`), l'autre à gauche sur le gris des bulles ; qui et quand sous chaque
 * bulle. Le texte est affiché tel quel (jamais interprété).
 */
export function Echanges({
  echanges,
  moi,
  nom,
}: {
  echanges: readonly { id: string; auteur: 'proprietaire' | 'conciergerie'; texte: string; le: string }[];
  moi: 'proprietaire' | 'conciergerie';
  /** Nom affiché sous une bulle. */
  nom: (e: { auteur: 'proprietaire' | 'conciergerie'; le: string; id: string }) => string;
}) {
  return (
    <ol className="space-y-3">
      {echanges.map((e) => {
        const droite = e.auteur === moi;
        return (
          <li key={e.id} className={cn('flex flex-col', droite ? 'items-end' : 'items-start')}>
            <div
              className={cn(
                'max-w-[85%] rounded-[18px] px-3.5 py-2 text-[15px] leading-snug sm:max-w-[75%]',
                droite ? 'rounded-br-md bg-(--lm-brun) text-white' : 'rounded-bl-md bg-(--lm-bulle) text-(--lm-encre)',
              )}
            >
              <p className="break-words whitespace-pre-line">{e.texte}</p>
            </div>
            <p className="mt-1 px-1 text-[12px] text-(--lm-encre-2)">
              {nom(e)} · {dateHeure(e.le)}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

/* ----------------------------------------------------------- mes demandes */

export function BadgeStatutDemande({ statut }: { statut: StatutDemandeProprietaire }) {
  return <Badge tone={TON_STATUT_DEMANDE[statut]}>{LIBELLE_STATUT_PROPRIETAIRE[statut]}</Badge>;
}

/** « Envoyée le 24 sept. 2026 », « Réponse le 21 sept. 2026 ». */
function quand(d: DemandeVue): string {
  const r = derniereReponse(d);
  return r ? `Réponse le ${dateCourte(r.le.slice(0, 10))}` : `Envoyée le ${dateCourte(d.creeLe.slice(0, 10))}`;
}

/** « Mes demandes » en résumé sur l'Accueil : une ligne qui mène à la liste. */
export function ResumeDemandes({ demandes, onOuvrir }: { demandes: DemandesEspace; onOuvrir: () => void }) {
  const liste = demandes.liste;
  if (!liste.length) return null;
  const repondues = liste.filter((d) => d.statut === 'repondue').length;
  const enCours = liste.filter((d) => d.statut !== 'reglee').length;
  const resume = repondues ? `${repondues} réponse${repondues > 1 ? 's' : ''}` : enCours ? `${enCours} en cours` : `${liste.length} réglée${liste.length > 1 ? 's' : ''}`;
  return (
    <button
      type="button"
      onClick={onOuvrir}
      className="mt-3 flex min-h-12 w-full items-center gap-3 rounded-xl border border-(--lm-bord) bg-(--lm-surface) px-4 py-2.5 text-left shadow-(--lm-ombre) transition hover:shadow-(--lm-ombre-haute)"
    >
      <MessageCircle className="size-4 shrink-0 text-(--lm-encre-2)" aria-hidden />
      <span className="min-w-0 flex-1 truncate text-[14px] text-(--lm-encre)">Mes demandes · {resume}</span>
      <ChevronRight className="size-4 shrink-0 text-(--lm-encre-3)" aria-hidden />
    </button>
  );
}

function DetailDemande({ d, conciergerie, onRetour }: { d: DemandeVue; conciergerie: string; onRetour: () => void }) {
  const repondue = !!derniereReponse(d);
  return (
    <>
      <button type="button" onClick={onRetour} className={LIEN_RETOUR}>
        <ChevronLeft className="size-4" aria-hidden />
        Mes demandes
      </button>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="lm-titre text-[24px] leading-tight text-(--lm-brun) sm:text-[28px]">{libelleDemande(d)}</h1>
          <p className="mt-1 text-[14px] text-(--lm-encre-2)">
            {ouPorteLaDemande(d, 'proprietaire')} · envoyée le {dateCourte(d.creeLe.slice(0, 10))}
          </p>
        </div>
        <BadgeStatutDemande statut={d.statut} />
      </div>
      <Card>
        <Echanges echanges={d.echanges} moi="proprietaire" nom={(e) => (e.auteur === 'proprietaire' ? 'Vous' : conciergerie)} />
        {!repondue && d.statut !== 'reglee' && (
          <p className="mt-4 border-t border-(--lm-bord) pt-3 text-[13.5px] text-(--lm-encre-2)">
            {conciergerie} vous répondra ici. {d.statut === 'vue' ? 'Votre demande a été lue.' : ''}
          </p>
        )}
      </Card>
    </>
  );
}

export function MesDemandes({
  vue,
  demandes,
  choisie,
  onChoisir,
  onNouvelle,
  onRetour,
}: {
  vue: VueProprietaire;
  demandes: DemandesEspace;
  choisie?: string;
  onChoisir: (id?: string) => void;
  onNouvelle: () => void;
  onRetour: () => void;
}) {
  const nom = vue.conciergerie.nom;
  const d = choisie ? demandes.liste.find((x) => x.id === choisie) : undefined;
  if (d) return <DetailDemande d={d} conciergerie={nom} onRetour={() => onChoisir(undefined)} />;
  const bouton = (
    <Button variant="primary" size="lg" icone={<MessageSquarePlus />} onClick={onNouvelle} className="max-sm:w-full">
      Faire une demande
    </Button>
  );
  return (
    <>
      <button type="button" onClick={onRetour} className={LIEN_RETOUR}>
        <ChevronLeft className="size-4" aria-hidden />
        Accueil
      </button>
      <TitreEspace titre="Mes demandes" description={`Vos questions et demandes à ${nom}, et ses réponses.`} action={demandes.liste.length ? bouton : undefined} />
      {demandes.chargement ? (
        <div role="status" aria-label="Chargement" className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : demandes.erreur ? (
        <Alert
          tone="danger"
          actions={
            demandes.recharger && (
              <Button size="sm" onClick={demandes.recharger}>
                Réessayer
              </Button>
            )
          }
        >
          {demandes.erreur}
        </Alert>
      ) : !demandes.liste.length ? (
        <EmptyState icone={<MessageCircle />} titre="Aucune demande pour l’instant" description={`Une question, un besoin pour votre logement${NBSP}? ${nom} vous répond ici.`} action={bouton} />
      ) : (
        <Card flush>
          <ul className="divide-y divide-(--lm-bord)">
            {demandes.liste.map((x) => (
              <li key={x.id}>
                <button
                  type="button"
                  onClick={() => onChoisir(x.id)}
                  className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left hover:bg-(--lm-surface-2) focus-visible:-outline-offset-2"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium text-(--lm-encre)">{libelleDemande(x)}</span>
                    {/* Le logement seulement s'il en a plusieurs (un seul : il le sait). */}
                    <span className="block truncate text-[13px] text-(--lm-encre-2)">
                      {vue.logements.length > 1 ? `${ouPorteLaDemande(x, 'proprietaire')} · ` : ''}
                      {quand(x)}
                    </span>
                  </span>
                  <BadgeStatutDemande statut={x.statut} />
                  <ChevronRight className="size-4 shrink-0 text-(--lm-encre-3)" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

/* -------------------------------------------------------------- assistant */

const QUESTIONS: Record<EtapeSaisieDemande, string> = {
  type: `De quoi s’agit-il${NBSP}?`,
  logement: `Quel logement est concerné${NBSP}?`,
  message: 'Votre message',
  recapitulatif: `Tout est correct${NBSP}?`,
};

const ICONES_TYPE: Record<TypeDemandeProprietaire, LucideIcon> = { question: CircleHelp, demande: ClipboardList, autre: MessageCircle };

/** Choix d'Airbnb : filet gris, bord à l'encre au survol ; choisi : l'or (état choisi). */
const CHOIX = 'flex w-full rounded-xl border text-left transition-colors';
const CHOIX_REPOS = 'border-(--lm-bord-fort) bg-(--lm-surface) hover:border-(--lm-encre)';
const CHOIX_ACTIF = 'border-(--lm-or-texte) bg-(--lm-or-lavis)';

/** Erreurs sans champ de saisie (choix) : dites au-dessus de « Continuer » dès l'écran ouvert. */
const SANS_CHAMP = new Set<ChampDemande>(['type', 'sujet', 'logement']);

const idChamp = (c: ChampDemande) => `demande-${c}`;

/** Flèches : changent de réponse (focus compris) ; Entrée choisit, puis, sur la réponse déjà choisie, continue. */
function clavierChoix<T extends string>(valeurs: readonly T[], actuelle: T | undefined, choisir: (v: T) => void) {
  return (e: KeyboardEvent<HTMLElement>) => {
    const pas = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!pas || !valeurs.length) return;
    e.preventDefault();
    const boutons = [...e.currentTarget.querySelectorAll<HTMLElement>('[role=radio]')];
    const i = actuelle ? valeurs.indexOf(actuelle) : boutons.indexOf(document.activeElement as HTMLElement);
    const suivante = valeurs[i < 0 ? 0 : (i + pas + valeurs.length) % valeurs.length];
    choisir(suivante);
    boutons[valeurs.indexOf(suivante)]?.focus();
  };
}

function entreeChoix(actif: boolean, choisir: () => void, continuer: () => void) {
  return (e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (actif) continuer();
    else choisir();
  };
}

/**
 * « Faire une demande », plein écran sur téléphone, fenêtre centrée sur
 * ordinateur. Rien ne part avant « Envoyer » ; fermer après avoir saisi
 * quelque chose demande confirmation.
 */
export function AssistantDemande({
  vue,
  envoyer,
  onFermer,
  onVoir,
}: {
  vue: VueProprietaire;
  envoyer?: EnvoyerDemande;
  onFermer: () => void;
  /** Après l'envoi : « Voir mes demandes ». */
  onVoir: (d: DemandeVue) => void;
}) {
  const logements = vue.logements;
  const etapes = etapesDemande(logements.length);
  const [s, setS] = useState<SaisieDemande>(() => saisieInitiale(logements));
  const depart = useRef(s);
  const [etape, setEtape] = useState<EtapeSaisieDemande>('type');
  const [retourRecap, setRetourRecap] = useState(false);
  const [messageTouche, setMessageTouche] = useState(false);
  const [confirmer, setConfirmer] = useState(false);
  const [abandon, setAbandon] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreurEnvoi, setErreurEnvoi] = useState<string>();
  const [envoyee, setEnvoyee] = useState<DemandeVue>();
  const titreId = useId();
  const raisonId = useId();
  const titre = useRef<HTMLHeadingElement>(null);
  const corps = useRef<HTMLDivElement>(null);
  const nom = vue.conciergerie.nom;

  const saisi = !envoyee && JSON.stringify(s) !== JSON.stringify(depart.current);
  const demanderFermeture = () => {
    if (enCours) return;
    if (saisi) setConfirmer(true);
    else onFermer();
  };
  const ref = useFenetre<HTMLDivElement>(true, demanderFermeture);
  useEffect(() => {
    if (abandon && !confirmer) onFermer();
  }, [abandon, confirmer, onFermer]);

  const index = envoyee ? etapes.length - 1 : etapes.indexOf(etape);
  const total = etapes.length;
  const erreurs = erreursEtapeDemande(etape, s, logements);
  const valide = Object.keys(erreurs).length === 0;
  // Une erreur dite une fois : sous le message s'il a été quitté, sinon au-dessus de « Continuer ».
  const sousLeChamp = (c: ChampDemande) => !SANS_CHAMP.has(c) && messageTouche;
  const apercu = !envoyer;
  const raison = (Object.entries(erreurs) as [ChampDemande, string][]).find(([c]) => !sousLeChamp(c))?.[1] ?? (etape === 'recapitulatif' && apercu ? `Aperçu${NBSP}: rien n’est envoyé d’ici.` : undefined);

  useEffect(() => {
    corps.current?.scrollTo?.(0, 0);
    titre.current?.focus();
  }, [etape, envoyee]);

  const maj = (patch: Partial<SaisieDemande>) => {
    setErreurEnvoi(undefined);
    setS((x) => ({ ...x, ...patch }));
  };

  const envoyerMaintenant = async () => {
    if (!envoyer || enCours) return;
    setEnCours(true);
    setErreurEnvoi(undefined);
    const r = await envoyer(s);
    setEnCours(false);
    if (r.ok) setEnvoyee(r.demande);
    else setErreurEnvoi(r.erreur);
  };

  const continuer = (e?: FormEvent) => {
    e?.preventDefault();
    if (envoyee) return onVoir(envoyee);
    if (!valide) {
      if (erreurs.message) setMessageTouche(true);
      const premier = Object.keys(erreurs)[0] as ChampDemande;
      document.getElementById(idChamp(premier))?.focus();
      return;
    }
    if (etape === 'recapitulatif') return void envoyerMaintenant();
    if (retourRecap) {
      setRetourRecap(false);
      return setEtape('recapitulatif');
    }
    setEtape(etapes[etapes.indexOf(etape) + 1]);
  };

  const retour = () => {
    if (retourRecap) {
      setRetourRecap(false);
      return setEtape('recapitulatif');
    }
    const i = etapes.indexOf(etape);
    if (i > 0) setEtape(etapes[i - 1]);
  };

  const modifier = (cible: EtapeSaisieDemande) => {
    setRetourRecap(true);
    setEtape(cible);
  };

  const question = envoyee ? 'Demande envoyée' : QUESTIONS[etape];
  const aide = envoyee
    ? `${nom} est prévenu. Sa réponse s’affichera dans «${NBSP}Mes demandes${NBSP}».`
    : etape === 'type'
      ? `${nom} vous répondra dans votre espace.`
      : etape === 'message'
        ? 'Écrivez simplement, comme dans un e-mail.'
        : etape === 'recapitulatif'
          ? `Votre demande part à ${nom}.`
          : undefined;
  const libelleSuite = envoyee ? 'Voir mes demandes' : etape === 'recapitulatif' ? 'Envoyer' : retourRecap ? 'Revenir au récapitulatif' : 'Continuer';
  const progression = Math.round(((index + 1) / total) * 100);

  return (
    <>
      <div className="lm-sans-impression fixed inset-0 z-50 flex justify-center sm:items-center sm:p-4">
        <div aria-hidden className="lm-apparition absolute inset-0 bg-(--lm-voile)" onClick={demanderFermeture} />
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-label="Nouvelle demande"
          tabIndex={-1}
          className="lm-apparition relative flex h-full w-full flex-col bg-(--lm-surface) shadow-(--lm-ombre-haute) outline-none sm:h-[min(40rem,92vh)] sm:max-w-xl sm:rounded-2xl sm:overflow-hidden"
        >
          {/* En-tête d'Airbnb : fermer rond à gauche, titre centré ; la progression juste dessous, en haut. */}
          <header className="flex items-center gap-2 border-b border-(--lm-bord) px-3 pt-[max(0.625rem,env(safe-area-inset-top))] pb-2.5">
            <IconButton label="Fermer" onClick={demanderFermeture}>
              <X />
            </IconButton>
            <div className="min-w-0 flex-1 text-center leading-tight">
              <p className="text-[16px] font-semibold text-(--lm-encre)">Nouvelle demande</p>
              <p className="lm-chiffres text-[13px] text-(--lm-encre-2)">
                Étape {index + 1} sur {total}
              </p>
            </div>
            <span aria-hidden className="size-10 shrink-0 max-sm:size-11" />
          </header>
          <div
            role="progressbar"
            aria-label={`Nouvelle demande · Étape ${index + 1} sur ${total}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progression}
            className="h-1 w-full shrink-0 bg-(--lm-neutre-lavis)"
          >
            <div className="h-full bg-(--lm-encre) transition-[width]" style={{ width: `${progression}%` }} />
          </div>

          <form onSubmit={continuer} noValidate className="flex min-h-0 flex-1 flex-col">
            <div ref={corps} className="lm-defilement min-h-0 flex-1 overflow-y-auto px-4 pt-6 pb-8 sm:px-8 sm:pt-8">
              {envoyee && (
                <span aria-hidden className="mb-4 grid size-12 place-items-center rounded-full bg-(--lm-succes-lavis) text-(--lm-succes-texte) [&_svg]:size-6">
                  <Check />
                </span>
              )}
              <h2 id={titreId} ref={titre} tabIndex={-1} style={{ outline: 'none' }} className="lm-titre text-[24px] leading-tight text-balance text-(--lm-encre) sm:text-[28px]">
                {question}
              </h2>
              {aide && <p className="mt-1.5 text-[14px] text-(--lm-encre-2)">{aide}</p>}
              {!envoyee && (
                <div className="mt-6">
                  {etape === 'type' && <EtapeType s={s} maj={maj} continuer={continuer} titreId={titreId} />}
                  {etape === 'logement' && <EtapeLogement vue={vue} s={s} maj={maj} continuer={continuer} titreId={titreId} />}
                  {etape === 'message' && (
                    <EtapeMessage message={s.message} onChange={(message) => maj({ message })} erreur={sousLeChamp('message') ? erreurs.message : undefined} quitter={() => setMessageTouche(true)} />
                  )}
                  {etape === 'recapitulatif' && <Recapitulatif vue={vue} s={s} modifier={modifier} />}
                  {erreurEnvoi && (
                    <Alert tone="danger" className="mt-4">
                      {erreurEnvoi}
                    </Alert>
                  )}
                </div>
              )}
            </div>

            <footer className="border-t border-(--lm-bord) px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
              {raison && !envoyee && (
                <p id={raisonId} className="mb-2 text-[13px] text-(--lm-encre-2) sm:text-right">
                  {raison}
                </p>
              )}
              <div className="lm-pied-fenetre flex items-center justify-between gap-3">
                {!envoyee && (index > 0 || retourRecap) ? (
                  <Button variant="ghost" size="lg" onClick={retour} disabled={enCours}>
                    Retour
                  </Button>
                ) : (
                  <span aria-hidden />
                )}
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  chargement={enCours}
                  disabled={!envoyee && (!valide || (etape === 'recapitulatif' && apercu))}
                  aria-describedby={raison && !envoyee ? raisonId : undefined}
                >
                  {libelleSuite}
                </Button>
              </div>
            </footer>
          </form>
        </div>
      </div>

      <Modal
        ouvert={confirmer}
        onFermer={() => setConfirmer(false)}
        taille="sm"
        titre={`Abandonner cette demande${NBSP}?`}
        description="Ce que vous avez saisi sera perdu."
        pied={
          <>
            <Button onClick={() => setConfirmer(false)}>Continuer la saisie</Button>
            <Button
              variant="danger"
              onClick={() => {
                setAbandon(true);
                setConfirmer(false);
              }}
            >
              Abandonner
            </Button>
          </>
        }
      />
    </>
  );
}

/* ------------------------------------------------------------------ écrans */

interface PropsEtape {
  s: SaisieDemande;
  maj: (patch: Partial<SaisieDemande>) => void;
  continuer: () => void;
  titreId: string;
}

function EtapeType({ s, maj, continuer, titreId }: PropsEtape) {
  const sujetsId = useId();
  const valeurs = TYPES_DEMANDE.map((t) => t.valeur);
  const choisirType = (type: TypeDemandeProprietaire) => maj({ type, ...(type === 'demande' ? {} : { sujet: undefined }) });
  const sujets = SUJETS_DEMANDE.map((x) => x.valeur);
  return (
    <>
      <div role="radiogroup" aria-labelledby={titreId} onKeyDown={clavierChoix(valeurs, s.type, choisirType)} className="grid gap-3">
        {TYPES_DEMANDE.map((t, i) => {
          const actif = s.type === t.valeur;
          const Icone = ICONES_TYPE[t.valeur];
          return (
            <button
              key={t.valeur}
              id={i === 0 ? idChamp('type') : undefined}
              type="button"
              role="radio"
              aria-checked={actif}
              tabIndex={actif || (!s.type && i === 0) ? 0 : -1}
              onClick={() => choisirType(t.valeur)}
              onKeyDown={entreeChoix(actif, () => choisirType(t.valeur), continuer)}
              className={cn(CHOIX, 'min-h-16 items-center gap-4 px-4 py-3', actif ? CHOIX_ACTIF : CHOIX_REPOS)}
            >
              <Icone aria-hidden className={cn('size-6 shrink-0', actif ? 'text-(--lm-or-texte)' : 'text-(--lm-encre)')} />
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold text-(--lm-encre)">{t.libelle}</span>
                {t.detail && <span className="block text-[13px] text-(--lm-encre-2)">{t.detail}</span>}
              </span>
            </button>
          );
        })}
      </div>
      {s.type === 'demande' && (
        <div className="mt-6">
          <p id={sujetsId} className="text-[14px] font-medium text-(--lm-encre)">
            Quel est le sujet{NBSP}?
          </p>
          <div role="radiogroup" aria-labelledby={sujetsId} onKeyDown={clavierChoix(sujets, s.sujet, (sujet: SujetDemandeProprietaire) => maj({ sujet }))} className="mt-2 grid grid-cols-2 gap-2 min-[400px]:grid-cols-3">
            {SUJETS_DEMANDE.map((x, i) => {
              const actif = s.sujet === x.valeur;
              return (
                <button
                  key={x.valeur}
                  id={i === 0 ? idChamp('sujet') : undefined}
                  type="button"
                  role="radio"
                  aria-checked={actif}
                  tabIndex={actif || (!s.sujet && i === 0) ? 0 : -1}
                  onClick={() => maj({ sujet: x.valeur })}
                  onKeyDown={entreeChoix(actif, () => maj({ sujet: x.valeur }), continuer)}
                  className={cn(CHOIX, 'h-11 items-center justify-center rounded-lg text-[15px] font-medium', actif ? `${CHOIX_ACTIF} text-(--lm-brun)` : `${CHOIX_REPOS} text-(--lm-encre)`)}
                >
                  {x.libelle}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

function EtapeLogement({ vue, s, maj, continuer, titreId }: PropsEtape & { vue: VueProprietaire }) {
  const valeurs = [...vue.logements.map((l) => l.id), 'tous'];
  const choisir = (logement: string) => maj({ logement });
  const ligne = (cle: string, i: number, contenu: ReactNode) => {
    const actif = s.logement === cle;
    return (
      <button
        key={cle}
        id={i === 0 ? idChamp('logement') : undefined}
        type="button"
        role="radio"
        aria-checked={actif}
        tabIndex={actif || (!s.logement && i === 0) ? 0 : -1}
        onClick={() => choisir(cle)}
        onKeyDown={entreeChoix(actif, () => choisir(cle), continuer)}
        className={cn(CHOIX, 'min-h-16 items-center gap-3 px-3 py-2.5', actif ? CHOIX_ACTIF : CHOIX_REPOS)}
      >
        {contenu}
      </button>
    );
  };
  return (
    <div role="radiogroup" aria-labelledby={titreId} onKeyDown={clavierChoix(valeurs, s.logement, choisir)} className="grid gap-3">
      {vue.logements.map((l, i) =>
        ligne(
          l.id,
          i,
          <>
            <PhotoLogement url={l.photo} nom={l.nom} className="size-12 shrink-0 rounded-lg" />
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-semibold text-(--lm-encre)">{l.nom}</span>
              <span className="block truncate text-[13px] text-(--lm-encre-2)">{l.ville}</span>
            </span>
          </>,
        ),
      )}
      {ligne(
        'tous',
        vue.logements.length,
        <>
          <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-lg bg-(--lm-surface-2) text-(--lm-encre)">
            <Layers className="size-5" />
          </span>
          <span className="block text-[15px] font-semibold text-(--lm-encre)">Tous mes logements</span>
        </>,
      )}
    </div>
  );
}

function EtapeMessage({ message, onChange, erreur, quitter }: { message: string; onChange: (m: string) => void; erreur?: string; quitter: () => void }) {
  const compteurId = useId();
  const erreurId = useId();
  const n = longueur(message.trim());
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={idChamp('message')} className="sr-only">
        Votre message
      </label>
      <Textarea
        id={idChamp('message')}
        value={message}
        rows={8}
        onChange={(e) => onChange(e.target.value)}
        onBlur={quitter}
        aria-invalid={erreur ? true : undefined}
        aria-describedby={[compteurId, erreur ? erreurId : ''].filter(Boolean).join(' ')}
        placeholder="Bonjour, …"
        className="min-h-44 text-[16px]"
      />
      <div className="flex items-start justify-between gap-3">
        <p id={erreurId} role={erreur ? 'alert' : undefined} className="text-[13px] font-medium text-(--lm-danger)">
          {erreur}
        </p>
        <p id={compteurId} className={cn('lm-chiffres shrink-0 text-[12.5px]', n > MESSAGE_MAX ? 'font-semibold text-(--lm-danger)' : 'text-(--lm-encre-3)')}>
          {n.toLocaleString('fr-FR').replace(/ /g, NBSP)} / {MESSAGE_MAX.toLocaleString('fr-FR').replace(/ /g, NBSP)}
        </p>
      </div>
    </div>
  );
}

function Recapitulatif({ vue, s, modifier }: { vue: VueProprietaire; s: SaisieDemande; modifier: (e: EtapeSaisieDemande) => void }) {
  const type = TYPES_DEMANDE.find((t) => t.valeur === s.type);
  const sujet = SUJETS_DEMANDE.find((x) => x.valeur === s.sujet);
  const logement = vue.logements.find((l) => l.id === s.logement);
  const lignes: { cle: string; libelle: string; valeur: string; etape?: EtapeSaisieDemande; long?: boolean }[] = [
    { cle: 'type', libelle: 'De quoi il s’agit', valeur: `${type?.libelle ?? ''}${s.type === 'demande' && sujet ? ` · ${sujet.libelle}` : ''}`, etape: 'type' },
    ...(vue.logements.length
      ? [{ cle: 'logement', libelle: 'Logement', valeur: s.logement === 'tous' ? 'Tous mes logements' : (logement?.nom ?? ''), ...(vue.logements.length > 1 ? { etape: 'logement' as const } : {}) }]
      : []),
    { cle: 'message', libelle: 'Message', valeur: s.message.trim(), etape: 'message', long: true },
  ];
  return (
    <ul className="divide-y divide-(--lm-bord) rounded-xl border border-(--lm-bord)">
      {lignes.map((l) => (
        <li key={l.cle} className="flex items-start gap-3 py-3 pr-2 pl-4">
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] text-(--lm-encre-3)">{l.libelle}</p>
            <p className={cn('mt-0.5 text-[15px] break-words text-(--lm-encre)', l.long && 'whitespace-pre-line')}>{l.valeur}</p>
          </div>
          {l.etape && (
            <Button variant="ghost" size="sm" onClick={() => modifier(l.etape!)} aria-label={`Modifier${NBSP}: ${l.libelle}`} className="max-sm:min-h-11">
              Modifier
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
