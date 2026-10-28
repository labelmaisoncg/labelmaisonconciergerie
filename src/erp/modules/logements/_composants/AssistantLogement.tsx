import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { BedDouble, Building2, House, Link2, Minus, Plus, Shapes, X, type LucideIcon } from 'lucide-react';
import { Button, Field, IconButton, Input, Modal, ProgressBar, Repli, SearchInput, Segmente, cn, useFenetre } from '../../../ui';
import { nouvelId, useErp } from '../../../data/store';
import { AUJOURDHUI, pluriel } from '../../../data/format';
import { LIBELLES } from '../../../data/libelles';
import { PLAFOND_NUITS_RESIDENCE_PRINCIPALE } from '../../../data/constantes';
import { peutRelier } from '../../../data/liaison-annonce';
import {
  BORNES,
  ETAPES_ASSISTANT,
  PIECES,
  TYPES_LIT,
  brouillonInitial,
  capaciteSuggeree,
  changerTotalLits,
  creationDepuisAssistant,
  erreursEtape,
  familleDuType,
  lignesRecap,
  nomSuggere,
  texteLits,
  totalLits,
  typeDeLaFamille,
  type BrouillonLogement,
  type EtapeAssistant,
  type FamilleLogement,
  type SaisieProprietaire,
} from '../../../data/creation-logement';
import type { Id, Proprietaire, TypeLit, TypeLogement, TypeProprietaire } from '../../../data/types';
import { enregistrerLogement } from './enregistrerLogement';

/**
 * Assistant de création d'un logement, comme l'accueil d'un nouvel hôte :
 * une question par écran, la progression en haut, « Retour » et
 * « Continuer » en bas (grisé tant que l'écran n'est pas complet, avec ce
 * qui manque en toutes lettres). Plein écran sur téléphone, fenêtre centrée
 * sur ordinateur.
 *
 * Rien n'est enregistré avant « Créer le logement » : le nouveau
 * propriétaire éventuel, puis le logement, construit par les mêmes règles que
 * le formulaire (data/creation-logement.ts), et placé sur la carte comme
 * avant (gérant seulement). La modification d'un logement garde le
 * formulaire (EditionLogement). Lecture seule : l'assistant ne s'ouvre pas.
 */
export interface AssistantLogementProps {
  ouvert: boolean;
  onFermer: () => void;
  /** Logement créé : sa page s'ouvre (« Relier à une annonce » y est proposé). */
  onCree: (id: Id) => void;
}

export function AssistantLogement({ ouvert, onFermer, onCree }: AssistantLogementProps) {
  const { lectureSeule } = useErp();
  if (!ouvert || lectureSeule) return null;
  // Monté à chaque ouverture : un brouillon neuf, sans reste de la fois précédente.
  return <Assistant onFermer={onFermer} onCree={onCree} />;
}

/** Espace insécable avant « ? » : le point d'interrogation ne part jamais seul à la ligne. */
const NBSP = '\u00a0';

/** Question et phrase d'aide de chaque écran. */
const QUESTIONS: Record<EtapeAssistant, { question: string; aide?: string }> = {
  type: { question: `Quel type de logement${NBSP}?`, aide: 'Vous compléterez le reste ensuite, dans sa fiche.' },
  adresse: { question: `Où se trouve-t-il${NBSP}?` },
  capacite: { question: 'Sa capacité' },
  nom: { question: `Quel nom lui donner${NBSP}?`, aide: 'Le nom que l’équipe verra partout.' },
  proprietaire: { question: `À qui appartient-il${NBSP}?` },
  recapitulatif: { question: `Tout est correct${NBSP}?`, aide: `Il démarre «${NBSP}En préparation${NBSP}» ; rien n’est publié sur les plateformes.` },
};

const FAMILLES: { valeur: FamilleLogement; libelle: string; icone: LucideIcon }[] = [
  { valeur: 'appartement', libelle: 'Appartement', icone: Building2 },
  { valeur: 'maison', libelle: 'Maison', icone: House },
  { valeur: 'studio', libelle: 'Studio', icone: BedDouble },
  { valeur: 'autre', libelle: 'Autre', icone: Shapes },
];

const LITS: Record<TypeLit, { libelle: string; retirer: string; ajouter: string }> = {
  double: { libelle: 'Lits doubles', retirer: 'Retirer un lit double', ajouter: 'Ajouter un lit double' },
  simple: { libelle: 'Lits simples', retirer: 'Retirer un lit simple', ajouter: 'Ajouter un lit simple' },
  canape: { libelle: 'Canapés-lits', retirer: 'Retirer un canapé-lit', ajouter: 'Ajouter un canapé-lit' },
};

const TYPES_PROPRIETAIRE = (Object.entries(LIBELLES.typeProprietaire) as [TypeProprietaire, string][]).map(([valeur, libelle]) => ({ valeur, libelle }));

/** Au-delà, la liste des propriétaires se filtre. */
const SEUIL_RECHERCHE = 6;

/** Erreurs sans champ à elles (choix, compteurs) : toujours dites au-dessus de « Continuer ». */
const SANS_CHAMP = new Set(['type', 'proprietaireId', 'residencePrincipale', 'capacite', 'chambres', 'lits']);

/** Champs en 16 px : pas de zoom à la saisie sur iPhone. */
const GRAND = 'h-11 text-[16px]';

const CHOIX =
  'flex w-full rounded-xl border text-left transition-colors focus-visible:ring-2 focus-visible:ring-(--lm-or-anneau) focus:outline-none';
const CHOIX_REPOS = 'border-(--lm-bord-fort) bg-(--lm-surface) hover:border-(--lm-encre-3) hover:bg-(--lm-surface-2)';
const CHOIX_ACTIF = 'border-(--lm-or-texte) bg-(--lm-or-lavis) ring-1 ring-(--lm-or-texte)';

const idChamp = (cle: string) => `assistant-logement-${cle.replace('.', '-')}`;
const ID_QUESTION_RESIDENCE = 'assistant-logement-question-residence';

/**
 * Choix exclusifs (cartes, lignes) : les flèches changent de réponse, focus
 * compris ; Entrée choisit, puis, sur la réponse déjà choisie, continue.
 */
function clavierChoix<T extends string>(valeurs: readonly T[], actuelle: T | undefined, choisir: (v: T) => void) {
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

function entreeChoix(actif: boolean, choisir: () => void, continuer: () => void) {
  return (e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (actif) continuer();
    else choisir();
  };
}

function Assistant({ onFermer, onCree }: Omit<AssistantLogementProps, 'ouvert'>) {
  const d = useErp();
  const proprietaires = useMemo(() => [...d.proprietaires].sort((a, b) => a.nom.localeCompare(b.nom, 'fr')), [d.proprietaires]);
  const [b, setB] = useState<BrouillonLogement>(() => brouillonInitial(d.proprietaires.length > 0));
  const depart = useRef(b);
  const [etape, setEtape] = useState<EtapeAssistant>('type');
  /** Arrivé par « Modifier » du récapitulatif : « Continuer » y ramène. */
  const [retourRecap, setRetourRecap] = useState(false);
  /** Champs quittés au moins une fois : leur erreur s'affiche sous eux. */
  const [touches, setTouches] = useState<ReadonlySet<string>>(() => new Set());
  const [capaciteTouchee, setCapaciteTouchee] = useState(false);
  const [nomTouche, setNomTouche] = useState(false);
  const [confirmer, setConfirmer] = useState(false);
  const [abandon, setAbandon] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const titreId = useId();
  const raisonId = useId();
  const titre = useRef<HTMLHeadingElement>(null);
  const corps = useRef<HTMLDivElement>(null);

  // Fermer (croix, Échap, fond) : on demande avant de perdre ce qui a été saisi.
  const saisi = JSON.stringify(b) !== JSON.stringify(depart.current);
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

  const nomsPris = useMemo(() => d.logements.map((l) => l.nom), [d.logements]);
  const index = ETAPES_ASSISTANT.indexOf(etape);
  const total = ETAPES_ASSISTANT.length;
  const ctx = { proprietaires, nomsPris };
  const erreurs = erreursEtape(etape, b, ctx);
  const valide = Object.keys(erreurs).length === 0;
  // Chaque erreur est dite une fois : sous son champ s'il a été quitté, sinon au-dessus de « Continuer ».
  // Un nom déjà pris se dit sous le champ dès qu'il est écrit (proposé ou tapé).
  const sousLeChamp = (k: string) => !SANS_CHAMP.has(k) && (touches.has(k) || (k === 'nom' && !!b.nom.trim()));
  const raison = Object.entries(erreurs).find(([k]) => !sousLeChamp(k))?.[1];
  const erreurChamp = (k: string) => (sousLeChamp(k) ? erreurs[k] : undefined);
  const quitter = (k: string) => setTouches((t) => (t.has(k) ? t : new Set(t).add(k)));

  // Nouvel écran : sa question reçoit le focus (lue par les lecteurs d'écran), en haut de l'écran.
  useEffect(() => {
    corps.current?.scrollTo?.(0, 0);
    titre.current?.focus();
  }, [etape]);

  const nbLogements = useMemo(() => {
    const n = new Map<Id, number>();
    for (const l of d.logements) n.set(l.proprietaireId, (n.get(l.proprietaireId) ?? 0) + 1);
    return n;
  }, [d.logements]);

  const maj = (patch: Partial<BrouillonLogement>) => setB((x) => ({ ...x, ...patch }));

  const aller = (cible: EtapeAssistant) => {
    // Le nom proposé suit le type et la ville tant que personne ne l'a changé.
    if ((cible === 'nom' || cible === 'recapitulatif') && !nomTouche) setB((x) => ({ ...x, nom: nomSuggere(x.type, x.ville, nomsPris) }));
    setEtape(cible);
  };

  const creer = () => {
    if (envoi) return;
    const r = creationDepuisAssistant(b, { ...ctx, idLogement: nouvelId('log'), idProprietaire: nouvelId('pro'), aujourdhui: AUJOURDHUI });
    if (!r.ok) {
      // Un propriétaire retiré entre-temps… : retour à l'écran à corriger.
      setTouches(new Set(Object.keys(erreursEtape('recapitulatif', b, ctx))));
      setRetourRecap(true);
      aller(r.etape);
      return;
    }
    setEnvoi(true);
    // Le nouveau propriétaire d'abord : le logement le désigne.
    if (r.proprietaire) d.upsert('proprietaires', r.proprietaire);
    enregistrerLogement(d, r.logement);
    onFermer();
    onCree(r.logement.id);
  };

  const continuer = (e?: FormEvent) => {
    e?.preventDefault();
    if (!valide) {
      // Tout ce qui manque s'affiche ; le premier champ concerné reçoit le focus.
      setTouches((t) => new Set([...t, ...Object.keys(erreurs)]));
      document.getElementById(idChamp(Object.keys(erreurs)[0]))?.focus();
      return;
    }
    if (etape === 'recapitulatif') return creer();
    if (retourRecap) {
      setRetourRecap(false);
      return aller('recapitulatif');
    }
    aller(ETAPES_ASSISTANT[index + 1]);
  };

  const retour = () => {
    if (retourRecap) {
      setRetourRecap(false);
      return aller('recapitulatif');
    }
    if (index > 0) aller(ETAPES_ASSISTANT[index - 1]);
  };

  const modifier = (cible: EtapeAssistant) => {
    setRetourRecap(true);
    aller(cible);
  };

  // Entrée dans un champ : « Continuer » (même grisé, pour montrer ce qui manque).
  const entree = (e: KeyboardEvent<HTMLFormElement>) => {
    if (e.key !== 'Enter' || e.defaultPrevented || e.nativeEvent.isComposing) return;
    if ((e.target as HTMLElement).tagName !== 'INPUT') return;
    e.preventDefault();
    continuer();
  };

  const choisirType = (t: TypeLogement) =>
    setB((x) => ({ ...x, type: t, ...(capaciteTouchee ? {} : capaciteSuggeree(t)) }));

  const q = QUESTIONS[etape];
  const aide = etape === 'adresse' && d.utilisateur.role === 'gerant' ? 'Il sera placé sur la carte d’après cette adresse.' : q.aide;
  // Plateformes connectées dans l'espace : la suite est de relier le logement à son annonce.
  const relier = peutRelier(d.utilisateur.role, d.lectureSeule) && d.logements.some((l) => !!l.repull?.id);
  const libelleSuite = etape === 'recapitulatif' ? 'Créer le logement' : retourRecap ? 'Revenir au récapitulatif' : 'Continuer';

  return (
    <>
      <div className="fixed inset-0 z-50 flex justify-center sm:items-center sm:p-4">
        <div aria-hidden className="lm-apparition absolute inset-0 bg-[rgba(20,17,14,0.4)]" onClick={demanderFermeture} />
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-label="Nouveau logement"
          tabIndex={-1}
          className="lm-apparition relative flex h-full w-full flex-col bg-(--lm-surface) shadow-(--lm-ombre-haute) outline-none sm:h-[min(42rem,92vh)] sm:max-w-xl sm:rounded-2xl"
        >
          <header className="flex items-center gap-3 border-b border-(--lm-bord) pt-[max(0.625rem,env(safe-area-inset-top))] pr-2 pb-2.5 pl-4 sm:pr-3 sm:pl-6">
            <ProgressBar valeur={(index + 1) / total} label={`Nouveau logement · Étape ${index + 1} sur ${total}`} className="min-w-0 flex-1" />
            <IconButton label="Fermer" onClick={demanderFermeture}>
              <X />
            </IconButton>
          </header>

          <form onSubmit={continuer} onKeyDown={entree} noValidate className="flex min-h-0 flex-1 flex-col">
            <div ref={corps} className="lm-defilement min-h-0 flex-1 overflow-y-auto px-4 pt-6 pb-8 sm:px-8 sm:pt-8">
              <h2 id={titreId} ref={titre} tabIndex={-1} style={{ outline: 'none' }} className="lm-serif text-[26px] leading-tight text-balance text-(--lm-encre) sm:text-[28px]">
                {q.question}
              </h2>
              {aide && <p className="mt-1.5 text-[14px] text-(--lm-encre-2)">{aide}</p>}
              <div className="mt-6">
                {etape === 'type' && <EtapeType type={b.type} choisir={choisirType} continuer={continuer} titreId={titreId} />}
                {etape === 'adresse' && <EtapeAdresse b={b} maj={maj} erreur={erreurChamp} quitter={quitter} />}
                {etape === 'capacite' && (
                  <EtapeCapacite
                    b={b}
                    maj={(patch) => {
                      if (!('surfaceM2' in patch)) setCapaciteTouchee(true);
                      maj(patch);
                    }}
                    erreur={erreurChamp('surfaceM2')}
                    quitter={quitter}
                  />
                )}
                {etape === 'nom' && (
                  <EtapeNom
                    nom={b.nom}
                    onChange={(nom) => {
                      setNomTouche(true);
                      maj({ nom });
                    }}
                    erreur={erreurChamp('nom')}
                    quitter={quitter}
                    titreId={titreId}
                  />
                )}
                {etape === 'proprietaire' && (
                  <EtapeProprietaire b={b} maj={maj} proprietaires={proprietaires} nbLogements={nbLogements} erreur={erreurChamp} quitter={quitter} continuer={continuer} titreId={titreId} />
                )}
                {etape === 'recapitulatif' && <Recapitulatif b={b} proprietaires={proprietaires} modifier={modifier} relier={relier} />}
              </div>
            </div>

            <footer className="border-t border-(--lm-bord) px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
              {raison && (
                <p id={raisonId} className="mb-2 text-[13px] text-(--lm-encre-2) sm:text-right">
                  {raison}
                </p>
              )}
              <div className="flex items-center justify-between gap-3">
                {index > 0 || retourRecap ? (
                  <Button variant="ghost" size="lg" onClick={retour} className="-ml-2 px-3">
                    Retour
                  </Button>
                ) : (
                  <span aria-hidden />
                )}
                <Button type="submit" variant="primary" size="lg" disabled={!valide || envoi} aria-describedby={raison ? raisonId : undefined}>
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
        titre={`Abandonner ce logement${NBSP}?`}
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

/* ------------------------------------------------------------------- écrans */

function EtapeType({ type, choisir, continuer, titreId }: { type?: TypeLogement; choisir: (t: TypeLogement) => void; continuer: () => void; titreId: string }) {
  const famille = type ? familleDuType(type) : undefined;
  const piecesId = useId();
  const choisirFamille = (f: FamilleLogement) => choisir(typeDeLaFamille(f, type));
  return (
    <>
      <div role="radiogroup" aria-labelledby={titreId} onKeyDown={clavierChoix(FAMILLES.map((f) => f.valeur), famille, choisirFamille)} className="grid grid-cols-2 gap-3">
        {FAMILLES.map((f, i) => {
          const actif = famille === f.valeur;
          const Icone = f.icone;
          return (
            <button
              key={f.valeur}
              type="button"
              role="radio"
              aria-checked={actif}
              tabIndex={actif || (!famille && i === 0) ? 0 : -1}
              onClick={() => choisirFamille(f.valeur)}
              onKeyDown={entreeChoix(actif, () => choisirFamille(f.valeur), continuer)}
              className={cn(CHOIX, 'min-h-28 flex-col items-start justify-between gap-4 p-4', actif ? CHOIX_ACTIF : CHOIX_REPOS)}
            >
              <Icone aria-hidden strokeWidth={1.6} className={cn('size-7', actif ? 'text-(--lm-or-texte)' : 'text-(--lm-encre-2)')} />
              <span className="text-[15px] font-semibold text-(--lm-encre)">{f.libelle}</span>
            </button>
          );
        })}
      </div>
      {famille === 'appartement' && (
        <div className="mt-6">
          <p id={piecesId} className="text-[14px] font-medium text-(--lm-encre)">
            Combien de pièces{NBSP}?
          </p>
          <div role="radiogroup" aria-labelledby={piecesId} onKeyDown={clavierChoix(PIECES, type as (typeof PIECES)[number], choisir)} className="mt-2 grid grid-cols-4 gap-2">
            {PIECES.map((t) => {
              const actif = type === t;
              return (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={actif}
                  tabIndex={actif ? 0 : -1}
                  onClick={() => choisir(t)}
                  onKeyDown={entreeChoix(actif, () => choisir(t), continuer)}
                  className={cn(CHOIX, 'h-11 items-center justify-center rounded-lg text-[15px] font-medium', actif ? `${CHOIX_ACTIF} text-(--lm-brun)` : `${CHOIX_REPOS} text-(--lm-encre)`)}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

interface PropsChamps {
  b: BrouillonLogement;
  maj: (patch: Partial<BrouillonLogement>) => void;
  erreur: (cle: string) => string | undefined;
  quitter: (cle: string) => void;
}

function EtapeAdresse({ b, maj, erreur, quitter }: PropsChamps) {
  return (
    <div className="space-y-4">
      <Field label="Adresse" erreur={erreur('adresse')}>
        <Input
          id={idChamp('adresse')}
          value={b.adresse}
          onChange={(e) => maj({ adresse: e.target.value })}
          onBlur={() => quitter('adresse')}
          autoComplete="address-line1"
          className={GRAND}
        />
      </Field>
      <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3">
        <Field label="Code postal" erreur={erreur('codePostal')}>
          <Input
            id={idChamp('codePostal')}
            value={b.codePostal}
            onChange={(e) => maj({ codePostal: e.target.value.replace(/\D/g, '').slice(0, 5) })}
            onBlur={() => quitter('codePostal')}
            inputMode="numeric"
            autoComplete="postal-code"
            className={GRAND}
          />
        </Field>
        <Field label="Ville" erreur={erreur('ville')}>
          <Input
            id={idChamp('ville')}
            value={b.ville}
            onChange={(e) => maj({ ville: e.target.value })}
            onBlur={() => quitter('ville')}
            autoComplete="address-level2"
            className={GRAND}
          />
        </Field>
      </div>
    </div>
  );
}

function EtapeCapacite({ b, maj, erreur, quitter }: Omit<PropsChamps, 'erreur'> & { erreur?: string }) {
  const erreurId = useId();
  const detail = texteLits(b.lits);
  return (
    <ul className="divide-y divide-(--lm-bord) border-b border-(--lm-bord)">
      <Compteur libelle="Voyageurs" valeur={b.capacite} bornes={BORNES.capacite} retirer="Retirer un voyageur" ajouter="Ajouter un voyageur" onChange={(capacite) => maj({ capacite })} />
      <Compteur libelle="Chambres" valeur={b.chambres} bornes={BORNES.chambres} retirer="Retirer une chambre" ajouter="Ajouter une chambre" onChange={(chambres) => maj({ chambres })} />
      <Compteur libelle="Lits" valeur={totalLits(b.lits)} bornes={BORNES.lits} retirer="Retirer un lit" ajouter="Ajouter un lit" onChange={(n) => maj({ lits: changerTotalLits(b.lits, n) })} />
      {/* Le détail par type est replié : déplié d'office s'il y a déjà autre chose que des lits doubles. */}
      <li className="pb-3">
        <Repli titre="Préciser les lits" description={detail || 'Aucun lit'} ouvert={b.lits.simple + b.lits.canape > 0} className="shadow-none">
          <ul className="-my-2.5 divide-y divide-(--lm-bord)">
            {TYPES_LIT.map((t) => (
              <Compteur key={t} {...LITS[t]} valeur={b.lits[t]} bornes={BORNES.lits} onChange={(n) => maj({ lits: { ...b.lits, [t]: n } })} />
            ))}
          </ul>
        </Repli>
      </li>
      <li className="py-2.5">
        <div className="flex min-h-11 items-center justify-between gap-4">
          <label htmlFor={idChamp('surfaceM2')} className="text-[15px] text-(--lm-encre)">
            Surface<span className="sr-only"> en m²</span>
            <span className="block text-[12.5px] text-(--lm-encre-3)">Facultatif</span>
          </label>
          <div className="relative w-[9.5rem] shrink-0">
            <Input
              id={idChamp('surfaceM2')}
              value={b.surfaceM2}
              onChange={(e) => maj({ surfaceM2: e.target.value.replace(/\D/g, '').slice(0, 5) })}
              onBlur={() => quitter('surfaceM2')}
              inputMode="numeric"
              aria-invalid={erreur ? true : undefined}
              aria-describedby={erreur ? erreurId : undefined}
              className={cn(GRAND, 'pr-11 text-right')}
            />
            <span aria-hidden className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[14px] text-(--lm-encre-3)">
              m²
            </span>
          </div>
        </div>
        {erreur && (
          <p id={erreurId} role="alert" className="mt-1.5 text-right text-[12px] font-medium text-(--lm-danger)">
            {erreur}
          </p>
        )}
      </li>
    </ul>
  );
}

/** Compteur « − / + » : pas de saisie libre, des bornes raisonnables. */
function Compteur({
  libelle,
  valeur,
  bornes: [min, max],
  retirer,
  ajouter,
  onChange,
}: {
  libelle: string;
  valeur: number;
  bornes: readonly [number, number];
  retirer: string;
  ajouter: string;
  onChange: (n: number) => void;
}) {
  const id = useId();
  // aria-disabled plutôt que disabled : le focus reste sur le bouton arrivé à sa borne.
  const borne = 'aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:hover:bg-(--lm-surface)';
  return (
    <li className="flex min-h-16 items-center justify-between gap-4 py-2.5">
      <span id={id} className="text-[15px] text-(--lm-encre)">
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
    </li>
  );
}

function EtapeNom({ nom, onChange, erreur, quitter, titreId }: { nom: string; onChange: (v: string) => void; erreur?: string; quitter: (k: string) => void; titreId: string }) {
  const erreurId = useId();
  return (
    <div>
      <Input
        id={idChamp('nom')}
        aria-labelledby={titreId}
        value={nom}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => quitter('nom')}
        maxLength={120}
        autoComplete="off"
        aria-invalid={erreur ? true : undefined}
        aria-describedby={erreur ? erreurId : undefined}
        className="h-12 text-[17px]"
      />
      {erreur && (
        <p id={erreurId} role="alert" className="mt-1.5 text-[12px] font-medium text-(--lm-danger)">
          {erreur}
        </p>
      )}
    </div>
  );
}

function EtapeProprietaire({
  b,
  maj,
  proprietaires,
  nbLogements,
  erreur,
  quitter,
  continuer,
  titreId,
}: PropsChamps & { proprietaires: Proprietaire[]; nbLogements: Map<Id, number>; continuer: () => void; titreId: string }) {
  const [recherche, setRecherche] = useState('');
  const q = recherche.trim().toLocaleLowerCase('fr');
  const visibles = q ? proprietaires.filter((p) => p.nom.toLocaleLowerCase('fr').includes(q)) : proprietaires;
  const s = b.nouveauProprietaire;
  const majNouveau = <K extends keyof SaisieProprietaire>(k: K, v: SaisieProprietaire[K]) => maj({ nouveauProprietaire: { ...s, [k]: v } });
  const choisi = visibles.some((p) => p.id === b.proprietaireId) ? b.proprietaireId : undefined;
  // Propriétaire touché dans une longue liste : la question suivante, plus bas, vient à l'écran.
  const choisirProprietaire = (proprietaireId: Id) => {
    maj({ proprietaireId });
    if (b.residencePrincipale !== undefined) return;
    const fluide = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    requestAnimationFrame(() => document.getElementById(ID_QUESTION_RESIDENCE)?.scrollIntoView({ block: 'nearest', behavior: fluide ? 'smooth' : 'auto' }));
  };

  return (
    <>
      {proprietaires.length > 0 && (
        <Segmente
          label="Propriétaire déjà enregistré ou nouveau"
          options={[
            { valeur: 'liste', libelle: 'Déjà enregistré' },
            { valeur: 'nouveau', libelle: 'Nouveau propriétaire' },
          ]}
          valeur={b.modeProprietaire}
          onChange={(modeProprietaire) => maj({ modeProprietaire })}
          className="mb-5 flex w-full [&>button]:flex-1"
        />
      )}

      {b.modeProprietaire === 'liste' ? (
        <>
          {proprietaires.length > SEUIL_RECHERCHE && (
            <SearchInput valeur={recherche} onChange={setRecherche} placeholder="Nom du propriétaire" label="Rechercher un propriétaire" className="mb-3 sm:w-full" />
          )}
          {visibles.length ? (
            <div
              role="radiogroup"
              aria-labelledby={titreId}
              onKeyDown={clavierChoix(visibles.map((p) => p.id), choisi, (proprietaireId) => maj({ proprietaireId }))}
              className="divide-y divide-(--lm-bord) overflow-hidden rounded-xl border border-(--lm-bord-fort)"
            >
              {visibles.map((p, i) => {
                const actif = p.id === b.proprietaireId;
                const n = nbLogements.get(p.id) ?? 0;
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="radio"
                    aria-checked={actif}
                    tabIndex={actif || (!choisi && i === 0) ? 0 : -1}
                    onClick={() => choisirProprietaire(p.id)}
                    onKeyDown={entreeChoix(actif, () => choisirProprietaire(p.id), continuer)}
                    className={cn(
                      'flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left focus-visible:ring-2 focus-visible:ring-(--lm-or-anneau) focus-visible:ring-inset focus:outline-none',
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
                      <span className="block truncate text-[15px] text-(--lm-encre)">{p.nom}</span>
                      <span className="block text-[12.5px] text-(--lm-encre-3)">{n ? pluriel(n, 'logement') : 'Aucun logement'}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-[14px] text-(--lm-encre-2)">Aucun propriétaire ne correspond.</p>
          )}
        </>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-[13px] font-medium text-(--lm-encre)">Type</p>
            <Segmente label="Type de propriétaire" options={TYPES_PROPRIETAIRE} valeur={s.type} onChange={(type) => majNouveau('type', type)} />
          </div>
          <Field label={s.type === 'particulier' ? 'Nom complet' : 'Raison sociale'} erreur={erreur('proprietaire.nom')}>
            <Input id={idChamp('proprietaire.nom')} value={s.nom} onChange={(e) => majNouveau('nom', e.target.value)} onBlur={() => quitter('proprietaire.nom')} autoComplete="off" className={GRAND} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="E-mail" erreur={erreur('proprietaire.email')}>
              <Input
                id={idChamp('proprietaire.email')}
                type="email"
                inputMode="email"
                value={s.email}
                onChange={(e) => majNouveau('email', e.target.value)}
                onBlur={() => quitter('proprietaire.email')}
                autoComplete="off"
                className={GRAND}
              />
            </Field>
            <Field label="Téléphone" erreur={erreur('proprietaire.telephone')}>
              <Input
                id={idChamp('proprietaire.telephone')}
                type="tel"
                value={s.telephone}
                onChange={(e) => majNouveau('telephone', e.target.value)}
                onBlur={() => quitter('proprietaire.telephone')}
                autoComplete="off"
                className={GRAND}
              />
            </Field>
          </div>
          <Field label="Adresse postale" erreur={erreur('proprietaire.adresse')}>
            <Input
              id={idChamp('proprietaire.adresse')}
              value={s.adresse}
              onChange={(e) => majNouveau('adresse', e.target.value)}
              onBlur={() => quitter('proprietaire.adresse')}
              autoComplete="off"
              className={GRAND}
            />
          </Field>
        </div>
      )}

      <ResidencePrincipale valeur={b.residencePrincipale} choisir={(residencePrincipale) => maj({ residencePrincipale })} continuer={continuer} />
    </>
  );
}

/**
 * Résidence principale du propriétaire : le plafond légal de nuits en
 * dépend, la réponse est donc demandée (ni « Oui » ni « Non » d'avance).
 */
function ResidencePrincipale({ valeur, choisir, continuer }: { valeur?: boolean; choisir: (v: boolean) => void; continuer: () => void }) {
  const questionId = useId();
  const aideId = useId();
  const actuelle = valeur === undefined ? undefined : valeur ? 'oui' : 'non';
  const options = [
    { v: 'oui', libelle: 'Oui' },
    { v: 'non', libelle: 'Non' },
  ] as const;
  return (
    <div id={ID_QUESTION_RESIDENCE} className="mt-6 border-t border-(--lm-bord) pt-5">
      <p id={questionId} className="text-[15px] font-medium text-(--lm-encre)">
        C’est la résidence principale du propriétaire{NBSP}?
      </p>
      <div
        role="radiogroup"
        aria-labelledby={questionId}
        aria-describedby={aideId}
        onKeyDown={clavierChoix(['oui', 'non'], actuelle, (v) => choisir(v === 'oui'))}
        className="mt-2 grid grid-cols-2 gap-2"
      >
        {options.map((o, i) => {
          const actif = actuelle === o.v;
          return (
            <button
              key={o.v}
              id={i === 0 ? idChamp('residencePrincipale') : undefined}
              type="button"
              role="radio"
              aria-checked={actif}
              tabIndex={actif || (!actuelle && i === 0) ? 0 : -1}
              onClick={() => choisir(o.v === 'oui')}
              onKeyDown={entreeChoix(actif, () => choisir(o.v === 'oui'), continuer)}
              className={cn(CHOIX, 'h-11 items-center justify-center rounded-lg text-[15px] font-medium', actif ? `${CHOIX_ACTIF} text-(--lm-brun)` : `${CHOIX_REPOS} text-(--lm-encre)`)}
            >
              {o.libelle}
            </button>
          );
        })}
      </div>
      <p id={aideId} className="mt-1.5 text-[12.5px] text-(--lm-encre-3)">
        Si oui, location limitée à {PLAFOND_NUITS_RESIDENCE_PRINCIPALE} nuits par année civile.
      </p>
    </div>
  );
}

function Recapitulatif({
  b,
  proprietaires,
  modifier,
  relier,
}: {
  b: BrouillonLogement;
  proprietaires: Proprietaire[];
  modifier: (etape: EtapeAssistant) => void;
  relier: boolean;
}) {
  return (
    <>
      <ul className="divide-y divide-(--lm-bord) rounded-xl border border-(--lm-bord)">
        {lignesRecap(b, proprietaires).map((l) => (
          <li key={l.cle} className="flex items-start gap-3 py-3 pr-2 pl-4">
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] text-(--lm-encre-3)">{l.libelle}</p>
              <p className={cn('mt-0.5 text-[15px] break-words', l.valeur ? 'text-(--lm-encre)' : 'text-(--lm-encre-3)')}>{l.valeur || 'À compléter'}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => modifier(l.etape)} aria-label={`Modifier : ${l.libelle}`} className="text-(--lm-or-texte)">
              Modifier
            </Button>
          </li>
        ))}
      </ul>
      {relier && (
        <p className="mt-4 flex items-start gap-2 text-[13.5px] text-(--lm-encre-2)">
          <Link2 aria-hidden className="mt-0.5 size-4 shrink-0 text-(--lm-encre-3)" />
          Ensuite, reliez-le à son annonce depuis sa fiche.
        </p>
      )}
    </>
  );
}
