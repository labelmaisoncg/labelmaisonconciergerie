import { forwardRef, useEffect, useId, useRef, useState, type FormEvent, type InputHTMLAttributes, type KeyboardEvent, type ReactNode } from 'react';
import { Minus, Plus, X, type LucideIcon } from 'lucide-react';
import {
  NBSP as ESPACE_INSECABLE,
  blocage,
  ecranPrecedent,
  ecranSuivant,
  libelleSuite,
  progression,
  insecables,
  retourPossible,
  type Blocage,
  type PositionParcours,
} from '../data/parcours-assistant';
import { Button, IconButton } from './Button';
import { cn } from './cn';
import { Input } from './Field';
import { Modal } from './Modal';
import { useFenetre } from './useFenetre';

/**
 * Assistant pas à pas de l'ERP, comme l'accueil d'un nouvel hôte sur
 * Airbnb : une question par écran, la progression en haut et en lisière du
 * pied, « Retour » souligné à gauche et l'action à droite. « Continuer » est
 * grisé tant que l'écran n'est pas complet, avec ce qui manque écrit au-dessus
 * en toutes lettres. Plein écran sur téléphone, fenêtre centrée sur
 * ordinateur ; le corps défile en hauteur seulement, sans rebond.
 *
 * Toute création de l'ERP passe par lui (logement, réservation directe,
 * propriétaire, contact…) ; les modifications gardent leur formulaire. Rien
 * n'est enregistré avant le bouton du récapitulatif : l'assistant ne fait
 * que montrer les écrans, chaque création garde ses règles (data/creation-*.ts)
 * et son enregistrement. Fermer (croix, Échap, voile) demande confirmation
 * dès que quelque chose a été saisi.
 *
 * À monter à chaque ouverture (`{ouvert && <…/>}`) : un brouillon neuf, sans
 * reste de la fois précédente.
 */
export interface AssistantProps {
  /** Nom de la fenêtre (« Nouveau logement ») : en-tête, lecteurs d'écran, barre de progression. */
  titre: string;
  /** Écrans du parcours, dans l'ordre (le dernier est le récapitulatif), et l'écran ouvert. */
  ecrans: readonly string[];
  ecran: string;
  /** Question de l'écran : elle reçoit le focus à chaque nouvel écran (lue par les lecteurs d'écran). */
  question: ReactNode;
  aide?: ReactNode;
  /** id de la question, pour nommer un groupe de choix (aria-labelledby). */
  idQuestion?: string;
  children: ReactNode;
  /** L'écran est complet, et ce qui manque sinon (useParcours().etat). */
  blocage: Pick<Blocage, 'valide' | 'raison'>;
  /** Libellé du bouton d'action (useParcours().libelleSuite). */
  libelleSuite: string;
  onContinuer: () => void;
  /** Absent : pas de « Retour » (premier écran). */
  onRetour?: () => void;
  /** Écran qui ne peut pas aboutir ici (il manque une donnée de base, Prerequis) : pas de « Continuer ». */
  sansSuite?: boolean;
  /** Quelque chose a été saisi : fermer demande d'abord confirmation. */
  saisi: boolean;
  /** Question de la confirmation (« Abandonner ce logement ? »). */
  abandon: string;
  /** Enregistrement en cours : rien ne se ferme, le bouton tourne. */
  envoi?: boolean;
  onFermer: () => void;
}

/** Espace insécable avant « ? », « : », « ! » : la ponctuation ne part jamais seule à la ligne. */
export const NBSP = ESPACE_INSECABLE;
export { TIRET_INSECABLE, insecables } from '../data/parcours-assistant';

/** Champs de l'assistant : 44 px de haut, 16 px de texte (pas de zoom à la saisie sur iPhone). */
export const CHAMP_ASSISTANT = 'h-11 text-[16px]';

export function Assistant({
  titre,
  ecrans,
  ecran,
  question,
  aide,
  idQuestion,
  children,
  blocage: { valide, raison },
  libelleSuite: suite,
  onContinuer,
  onRetour,
  sansSuite,
  saisi,
  abandon: questionAbandon,
  envoi,
  onFermer,
}: AssistantProps) {
  const [confirmer, setConfirmer] = useState(false);
  const [abandon, setAbandon] = useState(false);
  const idAuto = useId();
  const titreId = idQuestion ?? idAuto;
  const raisonId = useId();
  const titreRef = useRef<HTMLHeadingElement>(null);
  const corps = useRef<HTMLDivElement>(null);
  const { rang, total, pourcent } = progression(ecrans, ecran);

  // Fermer (croix, Échap, fond) : on demande avant de perdre ce qui a été saisi.
  const demanderFermeture = () => {
    if (envoi) return;
    if (saisi) setConfirmer(true);
    else onFermer();
  };
  const ref = useFenetre<HTMLDivElement>(true, demanderFermeture);
  // « Abandonner » : la fenêtre de confirmation se ferme d'abord (elle rend le focus et le défilement), puis l'assistant.
  useEffect(() => {
    if (abandon && !confirmer) onFermer();
  }, [abandon, confirmer, onFermer]);

  // Nouvel écran : sa question reçoit le focus (lue par les lecteurs d'écran), en haut de l'écran.
  useEffect(() => {
    corps.current?.scrollTo?.(0, 0);
    titreRef.current?.focus();
  }, [ecran]);

  const continuer = (e?: FormEvent) => {
    e?.preventDefault();
    if (sansSuite) return;
    onContinuer();
  };

  // Entrée dans un champ : « Continuer » (même grisé, pour montrer ce qui manque).
  const entree = (e: KeyboardEvent<HTMLFormElement>) => {
    if (e.key !== 'Enter' || e.defaultPrevented || e.nativeEvent.isComposing) return;
    if ((e.target as HTMLElement).tagName !== 'INPUT') return;
    e.preventDefault();
    continuer();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex justify-center sm:items-center sm:p-4">
        <div aria-hidden className="lm-apparition absolute inset-0 bg-(--lm-voile)" onClick={demanderFermeture} />
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-label={titre}
          tabIndex={-1}
          className="lm-apparition relative flex h-full w-full flex-col bg-(--lm-surface) shadow-(--lm-ombre-haute) outline-none sm:h-[min(42rem,92vh)] sm:max-w-xl sm:rounded-2xl"
        >
          {/* En-tête d'Airbnb : fermer rond à gauche, titre centré, un filet dessous. */}
          <header className="flex items-center gap-2 border-b border-(--lm-bord) px-3 pt-[max(0.625rem,env(safe-area-inset-top))] pb-2.5">
            {/* 44 px au toucher (téléphone), 32 px à la souris ; l'espace de droite suit pour garder le titre au centre. */}
            <IconButton label="Fermer" size="sm" onClick={demanderFermeture} className="max-sm:size-11">
              <X />
            </IconButton>
            <div className="min-w-0 flex-1 text-center leading-tight">
              <p className="truncate text-[16px] font-semibold text-(--lm-encre)">{titre}</p>
              {/* Écran qui ne peut pas aboutir (Prerequis) : ni étape ni progression, rien n'avance. */}
              {!sansSuite && (
                <p className="lm-chiffres text-[13px] text-(--lm-encre-2)">
                  Étape {rang} sur {total}
                </p>
              )}
            </div>
            <span aria-hidden className="size-8 shrink-0 max-sm:size-11" />
          </header>

          <form onSubmit={continuer} onKeyDown={entree} noValidate className="flex min-h-0 flex-1 flex-col">
            <div ref={corps} className="lm-defilement min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-none px-4 pt-6 pb-8 sm:px-8 sm:pt-8">
              <h2 id={titreId} ref={titreRef} tabIndex={-1} style={{ outline: 'none' }} className="lm-titre text-[24px] leading-tight text-balance text-(--lm-encre) sm:text-[28px]">
                {insecables(question)}
              </h2>
              {aide && <p className="mt-1.5 text-[14px] text-(--lm-encre-2)">{insecables(aide)}</p>}
              <div className="mt-6">{children}</div>
            </div>

            {/*
              Pied d'Airbnb : la barre de progression en lisière, « Retour » souligné à gauche, l'action à droite.
              La barre d'accueil de l'iPhone est déjà réservée par la fenêtre (erp.css) : 12 px de marge ici, sans plus.
            */}
            {(onRetour || !sansSuite) && (
              <footer className="pb-3">
                {!sansSuite ? (
                  <div
                    role="progressbar"
                    aria-label={`${titre} · Étape ${rang} sur ${total}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={pourcent}
                    className="h-1 w-full bg-(--lm-neutre-lavis)"
                  >
                    <div className="h-full bg-(--lm-encre) transition-[width]" style={{ width: `${(rang / total) * 100}%` }} />
                  </div>
                ) : (
                  <div aria-hidden className="h-px w-full bg-(--lm-bord)" />
                )}
                <div className="px-4 pt-3 sm:px-6">
                  {raison && !sansSuite && (
                    <p id={raisonId} className="mb-2 text-[13px] text-(--lm-encre-2) sm:text-right">
                      {insecables(raison)}
                    </p>
                  )}
                  <div className="lm-pied-fenetre flex min-h-12 items-center justify-between gap-3">
                    {onRetour ? (
                      <Button variant="ghost" size="lg" onClick={onRetour} disabled={envoi}>
                        Retour
                      </Button>
                    ) : (
                      <span aria-hidden />
                    )}
                    {!sansSuite && (
                      <Button type="submit" variant="primary" size="lg" disabled={!valide || envoi} chargement={envoi} aria-describedby={raison ? raisonId : undefined}>
                        {suite}
                      </Button>
                    )}
                  </div>
                </div>
              </footer>
            )}
          </form>
        </div>
      </div>

      <Modal
        ouvert={confirmer}
        onFermer={() => setConfirmer(false)}
        taille="sm"
        titre={questionAbandon}
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

/* ----------------------------------------------------------------- parcours */

export interface OptionsParcours<E extends string> {
  /** Écrans dans l'ordre (le dernier est le récapitulatif) ; la liste peut suivre les réponses. */
  ecrans: readonly E[];
  /** id du champ d'une erreur : il reçoit le focus quand on tente de continuer. */
  idChamp: (cle: string) => string;
  /** Erreurs sans champ à elles (choix, compteurs) : toujours dites au-dessus de « Continuer ». */
  sansChamp?: ReadonlySet<string>;
  /** Appelé avant chaque changement d'écran (ex. : proposer un nom d'après les réponses). */
  avantAller?: (cible: E) => void;
}

/**
 * État du parcours (écran ouvert, retour au récapitulatif, champs quittés)
 * et ses gestes, avec les règles de data/parcours-assistant.ts. Les erreurs
 * de l'écran viennent des règles de la création, passées à chaque geste.
 */
export function useParcours<E extends string>({ ecrans, idChamp, sansChamp, avantAller }: OptionsParcours<E>) {
  const [position, setPosition] = useState<PositionParcours<E>>({ ecran: ecrans[0], retourRecap: false });
  /** Champs quittés au moins une fois : leur erreur s'affiche sous eux. */
  const [touches, setTouches] = useState<ReadonlySet<string>>(() => new Set());
  const recap = ecrans[ecrans.length - 1];
  const aller = (p: PositionParcours<E>) => {
    avantAller?.(p.ecran);
    setPosition(p);
  };
  const precedent = ecranPrecedent(ecrans, position);
  return {
    ecran: position.ecran,
    retourRecap: position.retourRecap,
    touches,
    /** Le champ a été quitté : son erreur se dit désormais sous lui. */
    quitter: (cle: string) => setTouches((t) => (t.has(cle) ? t : new Set(t).add(cle))),
    /**
     * Ce que l'écran permet, d'après ses erreurs. `aussiSousLeChamp` : une
     * erreur dite sous son champ avant même qu'il soit quitté (nom déjà pris).
     */
    etat: (erreurs: Readonly<Record<string, string>>, aussiSousLeChamp?: (cle: string) => boolean): Blocage =>
      blocage(erreurs, (k) => !sansChamp?.has(k) && (touches.has(k) || !!aussiSousLeChamp?.(k))),
    /** « Continuer » : écran incomplet, tout ce qui manque s'affiche et le premier champ reçoit le focus ; au récapitulatif, `finir`. */
    continuer: (erreurs: Readonly<Record<string, string>>, finir: () => void) => {
      const cles = Object.keys(erreurs);
      if (cles.length) {
        setTouches((t) => new Set([...t, ...cles]));
        document.getElementById(idChamp(cles[0]))?.focus();
        return;
      }
      if (position.ecran === recap) return finir();
      aller(ecranSuivant(ecrans, position));
    },
    /** « Retour » (absent au premier écran). */
    retour: retourPossible(ecrans, position) && precedent ? () => aller(precedent) : undefined,
    /** « Modifier » d'une ligne du récapitulatif. */
    modifier: (cible: E) => aller({ ecran: cible, retourRecap: true }),
    /** L'action finale a échoué (une donnée a changé entre-temps) : retour à l'écran à corriger, ses erreurs affichées. */
    corriger: (cible: E, cles: readonly string[]) => {
      setTouches(new Set(cles));
      aller({ ecran: cible, retourRecap: true });
    },
    libelleSuite: (final: string) => libelleSuite(ecrans, position, final),
  };
}

/* ------------------------------------------------------------ récapitulatif */

export interface LigneRecapAssistant {
  cle: string;
  libelle: string;
  /** Vide : « À compléter ». */
  valeur: string;
  /** Écran où la réponse se change ; sans : pas de « Modifier ». */
  onModifier?: () => void;
}

/** Récapitulatif avant l'action finale : une ligne par réponse, avec « Modifier » qui ramène à son écran. */
export function RecapAssistant({ lignes, children }: { lignes: LigneRecapAssistant[]; children?: ReactNode }) {
  return (
    <>
      <ul className="divide-y divide-(--lm-bord) rounded-xl border border-(--lm-bord)">
        {lignes.map((l) => (
          <li key={l.cle} className="flex items-start gap-3 py-3 pr-2 pl-4">
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] text-(--lm-encre-3)">{insecables(l.libelle)}</p>
              <p className={cn('mt-0.5 text-[15px] break-words whitespace-pre-line', l.valeur ? 'text-(--lm-encre)' : 'text-(--lm-encre-3)')}>{insecables(l.valeur) || 'À compléter'}</p>
            </div>
            {/* Lien d'action d'Airbnb : souligné, 44 px de haut au toucher. */}
            {l.onModifier && (
              <Button variant="ghost" size="sm" onClick={l.onModifier} aria-label={`Modifier${NBSP}: ${l.libelle}`} className="underline max-sm:min-h-11">
                Modifier
              </Button>
            )}
          </li>
        ))}
      </ul>
      {children}
    </>
  );
}

/* -------------------------------------------------------------------- choix */

/** Choix d'Airbnb : filet gris, bord à l'encre au survol ; choisi : l'or (état choisi). */
export const CLASSES_CHOIX = {
  base: 'flex w-full rounded-xl border text-left transition-colors',
  repos: 'border-(--lm-bord-fort) bg-(--lm-surface) hover:border-(--lm-encre)',
  actif: 'border-(--lm-or-texte) bg-(--lm-or-lavis)',
};

/**
 * Choix exclusifs (cartes, lignes) : les flèches changent de réponse, focus
 * compris ; Entrée choisit, puis, sur la réponse déjà choisie, continue.
 */
export function clavierChoix<T extends string>(valeurs: readonly T[], actuelle: T | undefined, choisir: (v: T) => void) {
  return (e: KeyboardEvent<HTMLElement>) => {
    const pas = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!pas || !valeurs.length) return;
    e.preventDefault();
    const boutons = [...e.currentTarget.querySelectorAll<HTMLElement>('[role=radio]')];
    // Rien de choisi encore : on part de la réponse qui a le focus.
    const i = actuelle ? valeurs.indexOf(actuelle) : boutons.indexOf(document.activeElement as HTMLElement);
    const suivante = valeurs[i < 0 ? 0 : (i + pas + valeurs.length) % valeurs.length];
    choisir(suivante);
    boutons[valeurs.indexOf(suivante)]?.focus();
  };
}

export function entreeChoix(actif: boolean, choisir: () => void, continuer: () => void) {
  return (e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (actif) continuer();
    else choisir();
  };
}

export interface OptionChoix<T extends string> {
  valeur: T;
  libelle: ReactNode;
  /** Ligne secondaire (ligne de liste) ou icône (carte). */
  detail?: ReactNode;
  icone?: LucideIcon;
}

interface PropsChoix<T extends string> {
  options: readonly OptionChoix<T>[];
  /** Réponse choisie ; absente tant que rien n'est touché. */
  valeur: T | undefined;
  /** Flèches du clavier. */
  onChange: (v: T) => void;
  /** Toucher ou Entrée (par défaut, onChange). */
  onChoisir?: (v: T) => void;
  /** Entrée sur la réponse déjà choisie. */
  onContinuer: () => void;
  /** id de ce qui nomme le groupe (la question de l'écran). */
  labelledBy: string;
  describedBy?: string;
  /** id du premier bouton (focus quand on tente de continuer sans réponse). */
  idPremier?: string;
  className?: string;
}

/** Choix en lignes (liste de personnes, de logements) : pastille ronde, nom, ligne secondaire. */
export function ChoixListe<T extends string>({ options, valeur, onChange, onChoisir = onChange, onContinuer, labelledBy, describedBy, idPremier, className }: PropsChoix<T>) {
  const choisi = options.some((o) => o.valeur === valeur) ? valeur : undefined;
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      onKeyDown={clavierChoix(options.map((o) => o.valeur), choisi, onChange)}
      className={cn('divide-y divide-(--lm-bord) overflow-hidden rounded-xl border border-(--lm-bord-fort)', className)}
    >
      {options.map((o, i) => {
        const actif = o.valeur === choisi;
        return (
          <button
            key={o.valeur}
            id={i === 0 ? idPremier : undefined}
            type="button"
            role="radio"
            aria-checked={actif}
            tabIndex={actif || (!choisi && i === 0) ? 0 : -1}
            onClick={() => onChoisir(o.valeur)}
            onKeyDown={entreeChoix(actif, () => onChoisir(o.valeur), onContinuer)}
            className={cn(
              'flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left focus-visible:-outline-offset-2',
              actif ? 'bg-(--lm-or-lavis)' : 'hover:bg-(--lm-surface-2)',
            )}
          >
            <span
              aria-hidden
              className={cn('grid size-5 shrink-0 place-items-center rounded-full border-2', actif ? 'border-(--lm-or-texte) bg-(--lm-or-texte)' : 'border-(--lm-encre-3)')}
            >
              {actif && <span className="size-2 rounded-full bg-(--lm-surface)" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] text-(--lm-encre)">{insecables(o.libelle)}</span>
              {o.detail && <span className="block text-[12.5px] text-(--lm-encre-3)">{insecables(o.detail)}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Choix en cartes à icône, deux par ligne (type de logement, métier…). */
export function ChoixCartes<T extends string>({ options, valeur, onChange, onChoisir = onChange, onContinuer, labelledBy, describedBy, idPremier, className }: PropsChoix<T>) {
  const choisi = options.some((o) => o.valeur === valeur) ? valeur : undefined;
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      onKeyDown={clavierChoix(options.map((o) => o.valeur), choisi, onChange)}
      className={cn('grid grid-cols-2 gap-3', className)}
    >
      {options.map((o, i) => {
        const actif = choisi === o.valeur;
        const Icone = o.icone;
        return (
          <button
            key={o.valeur}
            id={i === 0 ? idPremier : undefined}
            type="button"
            role="radio"
            aria-checked={actif}
            tabIndex={actif || (!choisi && i === 0) ? 0 : -1}
            onClick={() => onChoisir(o.valeur)}
            onKeyDown={entreeChoix(actif, () => onChoisir(o.valeur), onContinuer)}
            className={cn(CLASSES_CHOIX.base, 'min-h-28 min-w-0 flex-col items-start justify-between gap-4 p-4', actif ? CLASSES_CHOIX.actif : CLASSES_CHOIX.repos)}
          >
            {Icone && <Icone aria-hidden className={cn('size-7', actif ? 'text-(--lm-or-texte)' : 'text-(--lm-encre)')} />}
            <span className="max-w-full text-[15px] font-semibold break-words text-(--lm-encre)">{insecables(o.libelle)}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Choix courts côte à côte (« Oui » / « Non », T1 à T4) : la grille vient de `className` (grid-cols-2, grid-cols-4…). */
export function ChoixCourts<T extends string>({ options, valeur, onChange, onChoisir = onChange, onContinuer, labelledBy, describedBy, idPremier, className }: PropsChoix<T>) {
  const choisi = options.some((o) => o.valeur === valeur) ? valeur : undefined;
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      onKeyDown={clavierChoix(options.map((o) => o.valeur), choisi, onChange)}
      className={cn('grid gap-2', className)}
    >
      {options.map((o, i) => {
        const actif = choisi === o.valeur;
        return (
          <button
            key={o.valeur}
            id={i === 0 ? idPremier : undefined}
            type="button"
            role="radio"
            aria-checked={actif}
            tabIndex={actif || (!choisi && i === 0) ? 0 : -1}
            onClick={() => onChoisir(o.valeur)}
            onKeyDown={entreeChoix(actif, () => onChoisir(o.valeur), onContinuer)}
            className={cn(
              CLASSES_CHOIX.base,
              'h-11 min-w-0 items-center justify-center rounded-lg px-2 text-[15px] font-medium',
              actif ? `${CLASSES_CHOIX.actif} text-(--lm-brun)` : `${CLASSES_CHOIX.repos} text-(--lm-encre)`,
            )}
          >
            <span className="truncate">{insecables(o.libelle)}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ----------------------------------------------------------------- compteur */

/** Compteur « − / + » : pas de saisie libre, des bornes raisonnables. */
export function Compteur({
  libelle,
  valeur,
  bornes: [min, max],
  retirer,
  ajouter,
  onChange,
  as: Element = 'li',
}: {
  libelle: ReactNode;
  valeur: number;
  bornes: readonly [number, number];
  retirer: string;
  ajouter: string;
  onChange: (n: number) => void;
  /** Ligne d'une liste (par défaut) ou bloc seul. */
  as?: 'li' | 'div';
}) {
  const id = useId();
  // aria-disabled plutôt que disabled : le focus reste sur le bouton arrivé à sa borne.
  const borne = 'aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:hover:bg-(--lm-surface)';
  return (
    <Element className="flex min-h-16 items-center justify-between gap-4 py-2.5">
      <span id={id} className="min-w-0 text-[15px] text-(--lm-encre)">
        {libelle}
      </span>
      <div role="group" aria-labelledby={id} className="flex shrink-0 items-center gap-1">
        <IconButton label={retirer} variant="secondary" size="lg" aria-disabled={valeur <= min} onClick={() => valeur > min && onChange(valeur - 1)} className={borne}>
          <Minus />
        </IconButton>
        <span aria-live="polite" className="lm-chiffres w-[3.75rem] text-center text-[17px] font-medium text-(--lm-encre)">
          {valeur}
        </span>
        <IconButton label={ajouter} variant="secondary" size="lg" aria-disabled={valeur >= max} onClick={() => valeur < max && onChange(valeur + 1)} className={borne}>
          <Plus />
        </IconButton>
      </div>
    </Element>
  );
}

/* ------------------------------------------------------------------ montant */

/**
 * Montant en euros, « € » dans le champ, clavier décimal : 44 px, 16 px de
 * texte. Dans un Field, il reçoit l'id et les descriptions comme un Input.
 */
export const InputEuros = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function InputEuros({ className, ...rest }, ref) {
  return (
    <div className="relative min-w-0">
      <Input ref={ref} inputMode="decimal" autoComplete="off" className={cn(CHAMP_ASSISTANT, 'pr-9', className)} {...rest} />
      <span aria-hidden className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-[15px] text-(--lm-encre-3)">
        €
      </span>
    </div>
  );
});
