import { useId, useMemo, useRef, useState } from 'react';
import { BedDouble, Building2, House, Link2, Shapes } from 'lucide-react';
import {
  Assistant,
  CHAMP_ASSISTANT,
  ChoixCartes,
  ChoixCourts,
  ChoixListe,
  Compteur,
  Field,
  Input,
  NBSP,
  RecapAssistant,
  Repli,
  SearchInput,
  Segmente,
  cn,
  useParcours,
  type OptionChoix,
} from '../../../ui';
import { nouvelId, useErp } from '../../../data/store';
import { AUJOURDHUI, pluriel } from '../../../data/format';
import { LIBELLES } from '../../../data/libelles';
import { PLAFOND_NUITS_RESIDENCE_PRINCIPALE } from '../../../data/constantes';
import { peutRelier } from '../../../data/liaison-annonce';
import { brouillonModifie } from '../../../data/parcours-assistant';
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
 * sur ordinateur : le cadre est celui du kit (ui/Assistant.tsx), commun à
 * toutes les créations de l'ERP.
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
  return <ParcoursLogement onFermer={onFermer} onCree={onCree} />;
}

/** Question et phrase d'aide de chaque écran. */
const QUESTIONS: Record<EtapeAssistant, { question: string; aide?: string }> = {
  type: { question: `Quel type de logement${NBSP}?`, aide: 'Vous compléterez le reste ensuite, dans sa fiche.' },
  adresse: { question: `Où se trouve-t-il${NBSP}?` },
  capacite: { question: 'Sa capacité' },
  nom: { question: `Quel nom lui donner${NBSP}?`, aide: 'Le nom que l’équipe verra partout.' },
  proprietaire: { question: `À qui appartient-il${NBSP}?` },
  recapitulatif: { question: `Tout est correct${NBSP}?`, aide: `Il démarre «${NBSP}En préparation${NBSP}» ; rien n’est publié sur les plateformes.` },
};

const FAMILLES: OptionChoix<FamilleLogement>[] = [
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

const idChamp = (cle: string) => `assistant-logement-${cle.replace('.', '-')}`;
const ID_QUESTION_RESIDENCE = 'assistant-logement-question-residence';

function ParcoursLogement({ onFermer, onCree }: Omit<AssistantLogementProps, 'ouvert'>) {
  const d = useErp();
  const proprietaires = useMemo(() => [...d.proprietaires].sort((a, b) => a.nom.localeCompare(b.nom, 'fr')), [d.proprietaires]);
  const [b, setB] = useState<BrouillonLogement>(() => brouillonInitial(d.proprietaires.length > 0));
  const depart = useRef(b);
  const [capaciteTouchee, setCapaciteTouchee] = useState(false);
  const [nomTouche, setNomTouche] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const titreId = useId();

  const nomsPris = useMemo(() => d.logements.map((l) => l.nom), [d.logements]);
  const p = useParcours<EtapeAssistant>({
    ecrans: ETAPES_ASSISTANT,
    idChamp,
    sansChamp: SANS_CHAMP,
    // Le nom proposé suit le type et la ville tant que personne ne l'a changé.
    avantAller: (cible) => {
      if ((cible === 'nom' || cible === 'recapitulatif') && !nomTouche) setB((x) => ({ ...x, nom: nomSuggere(x.type, x.ville, nomsPris) }));
    },
  });
  const etape = p.ecran;
  const ctx = { proprietaires, nomsPris };
  const erreurs = erreursEtape(etape, b, ctx);
  // Un nom déjà pris se dit sous le champ dès qu'il est écrit (proposé ou tapé).
  const etat = p.etat(erreurs, (k) => k === 'nom' && !!b.nom.trim());

  const nbLogements = useMemo(() => {
    const n = new Map<Id, number>();
    for (const l of d.logements) n.set(l.proprietaireId, (n.get(l.proprietaireId) ?? 0) + 1);
    return n;
  }, [d.logements]);

  const maj = (patch: Partial<BrouillonLogement>) => setB((x) => ({ ...x, ...patch }));

  const creer = () => {
    if (envoi) return;
    const r = creationDepuisAssistant(b, { ...ctx, idLogement: nouvelId('log'), idProprietaire: nouvelId('pro'), aujourdhui: AUJOURDHUI });
    if (!r.ok) {
      // Un propriétaire retiré entre-temps… : retour à l'écran à corriger.
      return p.corriger(r.etape, Object.keys(erreursEtape('recapitulatif', b, ctx)));
    }
    setEnvoi(true);
    // Le nouveau propriétaire d'abord : le logement le désigne.
    if (r.proprietaire) d.upsert('proprietaires', r.proprietaire);
    enregistrerLogement(d, r.logement);
    onFermer();
    onCree(r.logement.id);
  };
  const continuer = () => p.continuer(erreurs, creer);

  const choisirType = (t: TypeLogement) => setB((x) => ({ ...x, type: t, ...(capaciteTouchee ? {} : capaciteSuggeree(t)) }));

  const q = QUESTIONS[etape];
  const aide = etape === 'adresse' && d.utilisateur.role === 'gerant' ? 'Il sera placé sur la carte d’après cette adresse.' : q.aide;
  // Plateformes connectées dans l'espace : la suite est de relier le logement à son annonce.
  const relier = peutRelier(d.utilisateur.role, d.lectureSeule) && d.logements.some((l) => !!l.repull?.id);

  return (
    <Assistant
      titre="Nouveau logement"
      ecrans={ETAPES_ASSISTANT}
      ecran={etape}
      question={q.question}
      aide={aide}
      idQuestion={titreId}
      blocage={etat}
      libelleSuite={p.libelleSuite('Créer le logement')}
      onContinuer={continuer}
      onRetour={p.retour}
      saisi={brouillonModifie(depart.current, b)}
      abandon={`Abandonner ce logement${NBSP}?`}
      envoi={envoi}
      onFermer={onFermer}
    >
      {etape === 'type' && <EtapeType type={b.type} choisir={choisirType} continuer={continuer} titreId={titreId} />}
      {etape === 'adresse' && <EtapeAdresse b={b} maj={maj} erreur={etat.erreurChamp} quitter={p.quitter} />}
      {etape === 'capacite' && (
        <EtapeCapacite
          b={b}
          maj={(patch) => {
            if (!('surfaceM2' in patch)) setCapaciteTouchee(true);
            maj(patch);
          }}
          erreur={etat.erreurChamp('surfaceM2')}
          quitter={p.quitter}
        />
      )}
      {etape === 'nom' && (
        <EtapeNom
          nom={b.nom}
          onChange={(nom) => {
            setNomTouche(true);
            maj({ nom });
          }}
          erreur={etat.erreurChamp('nom')}
          quitter={p.quitter}
          titreId={titreId}
        />
      )}
      {etape === 'proprietaire' && (
        <EtapeProprietaire b={b} maj={maj} proprietaires={proprietaires} nbLogements={nbLogements} erreur={etat.erreurChamp} quitter={p.quitter} continuer={continuer} titreId={titreId} />
      )}
      {etape === 'recapitulatif' && (
        <RecapAssistant lignes={lignesRecap(b, proprietaires).map((l) => ({ ...l, onModifier: () => p.modifier(l.etape) }))}>
          {relier && (
            <p className="mt-4 flex items-start gap-2 text-[13.5px] text-(--lm-encre-2)">
              <Link2 aria-hidden className="mt-0.5 size-4 shrink-0 text-(--lm-encre-3)" />
              Ensuite, reliez-le à son annonce depuis sa fiche.
            </p>
          )}
        </RecapAssistant>
      )}
    </Assistant>
  );
}

/* ------------------------------------------------------------------- écrans */

function EtapeType({ type, choisir, continuer, titreId }: { type?: TypeLogement; choisir: (t: TypeLogement) => void; continuer: () => void; titreId: string }) {
  const famille = type ? familleDuType(type) : undefined;
  const piecesId = useId();
  const choisirFamille = (f: FamilleLogement) => choisir(typeDeLaFamille(f, type));
  return (
    <>
      <ChoixCartes options={FAMILLES} valeur={famille} onChange={choisirFamille} onContinuer={continuer} labelledBy={titreId} />
      {famille === 'appartement' && (
        <div className="mt-6">
          <p id={piecesId} className="text-[14px] font-medium text-(--lm-encre)">
            Combien de pièces{NBSP}?
          </p>
          <ChoixCourts
            options={PIECES.map((t) => ({ valeur: t, libelle: t }))}
            valeur={type as (typeof PIECES)[number]}
            onChange={choisir}
            onContinuer={continuer}
            labelledBy={piecesId}
            className="mt-2 grid-cols-4"
          />
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
          className={CHAMP_ASSISTANT}
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
            className={CHAMP_ASSISTANT}
          />
        </Field>
        <Field label="Ville" erreur={erreur('ville')}>
          <Input
            id={idChamp('ville')}
            value={b.ville}
            onChange={(e) => maj({ ville: e.target.value })}
            onBlur={() => quitter('ville')}
            autoComplete="address-level2"
            className={CHAMP_ASSISTANT}
          />
        </Field>
      </div>
    </div>
  );
}

function EtapeCapacite({ b, maj, erreur, quitter }: Omit<PropsChamps, 'erreur'> & { erreur?: string }) {
  const erreurId = useId();
  const detail = texteLits(b.lits);
  // Lu au premier affichage seulement : le repli ne se referme pas sous la main quand un compteur revient à 0.
  const [detailOuvert] = useState(() => b.lits.simple + b.lits.canape > 0);
  return (
    <ul className="divide-y divide-(--lm-bord) border-b border-(--lm-bord)">
      <Compteur libelle="Voyageurs" valeur={b.capacite} bornes={BORNES.capacite} retirer="Retirer un voyageur" ajouter="Ajouter un voyageur" onChange={(capacite) => maj({ capacite })} />
      <Compteur libelle="Chambres" valeur={b.chambres} bornes={BORNES.chambres} retirer="Retirer une chambre" ajouter="Ajouter une chambre" onChange={(chambres) => maj({ chambres })} />
      <Compteur libelle="Lits" valeur={totalLits(b.lits)} bornes={BORNES.lits} retirer="Retirer un lit" ajouter="Ajouter un lit" onChange={(n) => maj({ lits: changerTotalLits(b.lits, n) })} />
      {/* Le détail par type est replié : déplié d'office s'il y a déjà autre chose que des lits doubles. */}
      <li className="pb-3">
        <Repli titre="Préciser les lits" description={detail || 'Aucun lit'} ouvert={detailOuvert} className="shadow-none">
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
              className={cn(CHAMP_ASSISTANT, 'pr-11 text-right')}
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
            <ChoixListe
              options={visibles.map((p) => {
                const n = nbLogements.get(p.id) ?? 0;
                return { valeur: p.id, libelle: p.nom, detail: n ? pluriel(n, 'logement') : 'Aucun logement' };
              })}
              valeur={b.proprietaireId || undefined}
              onChange={(proprietaireId) => maj({ proprietaireId })}
              onChoisir={choisirProprietaire}
              onContinuer={continuer}
              labelledBy={titreId}
            />
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
            <Input id={idChamp('proprietaire.nom')} value={s.nom} onChange={(e) => majNouveau('nom', e.target.value)} onBlur={() => quitter('proprietaire.nom')} autoComplete="off" className={CHAMP_ASSISTANT} />
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
                className={CHAMP_ASSISTANT}
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
                className={CHAMP_ASSISTANT}
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
              className={CHAMP_ASSISTANT}
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
  return (
    <div id={ID_QUESTION_RESIDENCE} className="mt-6 border-t border-(--lm-bord) pt-5">
      <p id={questionId} className="text-[15px] font-medium text-(--lm-encre)">
        Est-ce la résidence principale du propriétaire{NBSP}?
      </p>
      <ChoixCourts
        options={[
          { valeur: 'oui', libelle: 'Oui' },
          { valeur: 'non', libelle: 'Non' },
        ]}
        valeur={actuelle}
        onChange={(v) => choisir(v === 'oui')}
        onContinuer={continuer}
        labelledBy={questionId}
        describedBy={aideId}
        idPremier={idChamp('residencePrincipale')}
        className="mt-2 grid-cols-2"
      />
      <p id={aideId} className="mt-1.5 text-[12.5px] text-(--lm-encre-3)">
        Si oui, location limitée à {PLAFOND_NUITS_RESIDENCE_PRINCIPALE} nuits par année civile.
      </p>
    </div>
  );
}
