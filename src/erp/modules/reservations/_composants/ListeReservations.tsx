/**
 * Vue « Séjours » : à venir, en cours, passés ou annulés, comme la page
 * Réservations d'Airbnb. Une ligne par séjour : logement, voyageur, dates,
 * état en mots et ce que vous recevez. Liste épurée sur ordinateur, cartes
 * sur mobile. Filtres moins fréquents repliés.
 */
import { Fragment, useMemo, useState } from 'react';
import { CalendarSearch, ChevronDown } from 'lucide-react';
import { Button, Card, EmptyState, Field, Input, SearchInput, Segmente, Select, cn } from '../../../ui';
import { LIBELLES } from '../../../data/libelles';
import { euros, moisAnnee, nombre, pluriel } from '../../../data/format';
import type { Logement, Reservation } from '../../../data/types';
import { VisuelLogement } from '../../logements/_composants/Visuel';
import { useRechercheUrl } from '../../../ui/useRechercheUrl';
import { CANAUX, etatSejour, momentSejour, plageDates, recu, type MomentSejour } from './outils';

const MOMENTS: { valeur: MomentSejour; libelle: string; vide: string }[] = [
  { valeur: 'a_venir', libelle: 'À venir', vide: 'Aucun séjour à venir.' },
  { valeur: 'en_cours', libelle: 'En cours', vide: 'Personne sur place en ce moment.' },
  { valeur: 'passe', libelle: 'Passés', vide: 'Aucun séjour passé.' },
  { valeur: 'annule', libelle: 'Annulés', vide: 'Aucune annulation.' },
];
const PAR_PAGE = 40;

interface Props {
  reservations: Reservation[];
  logements: Logement[];
  /** Filtre logement préréglé (lien « ?logement=… » depuis la fiche logement). */
  logementInitial?: string;
  onOuvrir: (r: Reservation) => void;
}

function normaliser(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Ordre de lecture : les prochains d'abord pour ce qui vient, les plus récents d'abord pour ce qui est passé. */
function trier(moment: MomentSejour, lignes: Reservation[]): Reservation[] {
  const copie = [...lignes];
  if (moment === 'a_venir') return copie.sort((a, b) => a.arrivee.localeCompare(b.arrivee));
  if (moment === 'en_cours') return copie.sort((a, b) => a.depart.localeCompare(b.depart));
  return copie.sort((a, b) => b.arrivee.localeCompare(a.arrivee));
}

export function ListeReservations({ reservations, logements, onOuvrir, logementInitial = '' }: Props) {
  const [recherche, setRecherche] = useRechercheUrl();
  const [logementId, setLogementId] = useState(logementInitial);
  const [canal, setCanal] = useState('');
  const [du, setDu] = useState('');
  const [au, setAu] = useState('');
  const [limite, setLimite] = useState(PAR_PAGE);
  const parId = useMemo(() => new Map(logements.map((l) => [l.id, l])), [logements]);

  const filtrees = useMemo(() => {
    const q = normaliser(recherche.trim());
    return reservations.filter(
      (r) =>
        (!q || normaliser(`${r.voyageur.nom} ${parId.get(r.logementId)?.nom ?? ''}`).includes(q)) &&
        (!logementId || r.logementId === logementId) &&
        (!canal || r.canal === canal) &&
        (!du || r.depart > du) &&
        (!au || r.arrivee <= au),
    );
  }, [reservations, recherche, logementId, canal, du, au, parId]);

  const parMoment = useMemo(() => {
    const m: Record<MomentSejour, Reservation[]> = { a_venir: [], en_cours: [], passe: [], annule: [] };
    for (const r of filtrees) m[momentSejour(r)].push(r);
    return m;
  }, [filtrees]);

  // Premier affichage : l'onglet qui a quelque chose à montrer (à venir, sinon en cours, sinon passés).
  const [moment, setMoment] = useState<MomentSejour>(
    () => (['a_venir', 'en_cours', 'passe'] as MomentSejour[]).find((m) => parMoment[m].length) ?? 'a_venir',
  );
  const lignes = useMemo(() => trier(moment, parMoment[moment]), [moment, parMoment]);
  const visibles = lignes.slice(0, limite);
  const filtreActif = !!(recherche.trim() || logementId || canal || du || au);

  const totaux = useMemo(
    () => ({ nuits: lignes.reduce((s, r) => s + r.nuits, 0), recu: lignes.reduce((s, r) => s + recu(r), 0) }),
    [lignes],
  );

  const choisir = (m: MomentSejour) => {
    setMoment(m);
    setLimite(PAR_PAGE);
  };

  return (
    <div>
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmente
          label="Séjours à afficher"
          className="self-start"
          options={MOMENTS.map((m) => ({
            valeur: m.valeur,
            // Pendant une recherche, le nombre de résultats de chaque onglet évite de chercher au mauvais endroit.
            libelle: filtreActif ? `${m.libelle} (${parMoment[m.valeur].length})` : m.libelle,
          }))}
          valeur={moment}
          onChange={choisir}
        />
        <SearchInput valeur={recherche} onChange={setRecherche} placeholder="Voyageur ou logement" label="Rechercher un voyageur ou un logement" />
      </div>

      {/* Filtres moins fréquents : repliés, ouverts d'office s'ils sont utilisés. */}
      <details open={!!(logementId || canal || du || au) || undefined} className="group mb-4">
        <summary className="inline-flex h-8 cursor-pointer list-none items-center gap-1 text-[13px] font-medium text-(--lm-or-texte) hover:underline [&::-webkit-details-marker]:hidden">
          Plus de filtres
          <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Logement">
            <Select value={logementId} onChange={(e) => setLogementId(e.target.value)} placeholder="Tous les logements" options={logements.map((l) => ({ valeur: l.id, libelle: l.nom }))} />
          </Field>
          <Field label="Plateforme">
            <Select
              value={canal}
              onChange={(e) => setCanal(e.target.value)}
              placeholder="Toutes les plateformes"
              options={CANAUX.filter((c) => c !== 'autre').map((c) => ({ valeur: c, libelle: LIBELLES.canal[c] }))}
            />
          </Field>
          <Field label="Séjours après le">
            <Input type="date" value={du} onChange={(e) => setDu(e.target.value)} />
          </Field>
          <Field label="Séjours avant le">
            <Input type="date" value={au} onChange={(e) => setAu(e.target.value)} />
          </Field>
        </div>
      </details>

      {lignes.length === 0 ? (
        <Card>
          <EmptyState icone={<CalendarSearch />} titre={filtreActif ? 'Aucun séjour ne correspond.' : MOMENTS.find((m) => m.valeur === moment)?.vide} />
        </Card>
      ) : (
        <>
          <p className="lm-chiffres mb-2 text-[13px] text-(--lm-encre-2)">
            {pluriel(lignes.length, 'séjour')} · {nombre(totaux.nuits)} nuits
            {moment !== 'annule' && <> · {euros(totaux.recu, true)} {moment === 'passe' ? 'reçus' : 'à recevoir'}</>}
          </p>
          <Card flush className="overflow-hidden">
            {/* En-têtes de colonnes, sur grand écran seulement : sur mobile chaque séjour est une carte. */}
            <div
              aria-hidden
              className="hidden border-b border-(--lm-bord) bg-(--lm-surface-2) px-4 py-2 text-[12px] font-medium text-(--lm-encre-3) lg:grid lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,0.9fr)_7rem] lg:gap-4"
            >
              <span>Voyageur</span>
              <span>Logement</span>
              <span>Dates</span>
              <span>État</span>
              <span className="text-right">Vous recevez</span>
            </div>
            <ul className="divide-y divide-(--lm-bord)">
              {visibles.map((r, i) => {
                const mois = r.arrivee.slice(0, 7);
                const nouveauMois = moment !== 'en_cours' && (i === 0 || visibles[i - 1].arrivee.slice(0, 7) !== mois);
                return (
                  <Fragment key={r.id}>
                    {nouveauMois && (
                      <li className="bg-(--lm-surface-2) px-4 py-1.5 text-[12px] font-semibold text-(--lm-encre-2) first-letter:uppercase">{moisAnnee(mois)}</li>
                    )}
                    <li>
                      <LigneSejour r={r} logement={parId.get(r.logementId)} onOuvrir={onOuvrir} />
                    </li>
                  </Fragment>
                );
              })}
            </ul>
          </Card>
          {lignes.length > limite && (
            <div className="mt-3 flex justify-center">
              <Button variant="ghost" onClick={() => setLimite((x) => x + PAR_PAGE)}>
                Afficher {Math.min(PAR_PAGE, lignes.length - limite)} de plus
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function LigneSejour({ r, logement, onOuvrir }: { r: Reservation; logement: Logement | undefined; onOuvrir: (r: Reservation) => void }) {
  const annule = r.statut === 'annulee';
  const etat = etatSejour(r);
  const present = momentSejour(r) === 'en_cours';
  const montant = annule ? '–' : euros(recu(r));
  return (
    <button
      type="button"
      onClick={() => onOuvrir(r)}
      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-(--lm-surface-2) focus-visible:bg-(--lm-surface-2) focus:outline-none lg:grid lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,0.9fr)_7rem] lg:gap-4"
    >
      {/* Voyageur (et, sur mobile, logement et dates dessous) */}
      <span className="flex min-w-0 flex-1 items-center gap-3">
        {logement ? (
          <VisuelLogement logement={logement} taille="sm" className="size-11 shrink-0 rounded-lg lg:size-10" />
        ) : (
          <span aria-hidden className="size-11 shrink-0 rounded-lg bg-(--lm-surface-2) lg:size-10" />
        )}
        <span className="min-w-0">
          <span className={cn('block truncate text-[14px] font-medium', annule ? 'text-(--lm-encre-2) line-through' : 'text-(--lm-encre)')}>{r.voyageur.nom}</span>
          <span className="block truncate text-[12.5px] text-(--lm-encre-3) lg:hidden">
            {plageDates(r.arrivee, r.depart)} · {logement?.nom ?? 'Logement inconnu'}
          </span>
          <span className="hidden truncate text-[12.5px] text-(--lm-encre-3) lg:block">
            {LIBELLES.canal[r.canal]} · {pluriel(r.voyageur.nbPersonnes, 'voyageur')}
          </span>
        </span>
      </span>

      {/* Colonnes de grand écran */}
      <span className="hidden min-w-0 lg:block">
        <span className="block truncate text-[13.5px] text-(--lm-encre)">{logement?.nom ?? 'Logement inconnu'}</span>
        {logement?.ville && <span className="block truncate text-[12.5px] text-(--lm-encre-3)">{logement.ville}</span>}
      </span>
      <span className="lm-chiffres hidden min-w-0 lg:block">
        <span className="block truncate text-[13.5px] text-(--lm-encre)">{plageDates(r.arrivee, r.depart)}</span>
        <span className="block text-[12.5px] text-(--lm-encre-3)">{pluriel(r.nuits, 'nuit')}</span>
      </span>
      <span className={cn('hidden truncate text-[13.5px] lg:block', present ? 'font-medium text-(--lm-encre)' : 'text-(--lm-encre-2)')}>{etat}</span>

      {/* Montant (et, sur mobile, état dessous) */}
      <span className="shrink-0 text-right">
        <span className={cn('lm-chiffres block text-[14px] font-semibold', annule ? 'text-(--lm-encre-3)' : 'text-(--lm-encre)')}>{montant}</span>
        <span className={cn('block text-[12.5px] lg:hidden', present ? 'font-medium text-(--lm-encre)' : 'text-(--lm-encre-3)')}>{etat}</span>
      </span>
    </button>
  );
}
