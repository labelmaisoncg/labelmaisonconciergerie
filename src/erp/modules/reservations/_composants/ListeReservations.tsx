/**
 * Vue liste : filtres (canal, statut, logement, période), recherche voyageur
 * et totaux de la sélection.
 */
import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Field, FilterChips, Input, SearchInput, Select, StatusBadge, Table, type Colonne } from '../../../ui';
import { LIBELLES } from '../../../data/libelles';
import { dateCourte, euros, nombre } from '../../../data/format';
import type { Logement, Reservation, StatutReservation } from '../../../data/types';
import { PastilleCanal } from './FicheReservation';
import { CANAUX } from './outils';
import { useRechercheUrl } from '../../../ui/useRechercheUrl';

const STATUTS: StatutReservation[] = ['confirmee', 'en_cours', 'terminee', 'annulee'];

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

export function ListeReservations({ reservations, logements, onOuvrir, logementInitial = '' }: Props) {
  const [recherche, setRecherche] = useRechercheUrl();
  const [canaux, setCanaux] = useState<string[]>([]);
  const [statuts, setStatuts] = useState<string[]>([]);
  const [logementId, setLogementId] = useState(logementInitial);
  const [du, setDu] = useState('');
  const [au, setAu] = useState('');
  const nomLogement = useMemo(() => new Map(logements.map((l) => [l.id, l.nom])), [logements]);

  const lignes = useMemo(() => {
    const q = normaliser(recherche.trim());
    return reservations.filter(
      (r) =>
        (!q || normaliser(r.voyageur.nom).includes(q)) &&
        (!canaux.length || canaux.includes(r.canal)) &&
        (!statuts.length || statuts.includes(r.statut)) &&
        (!logementId || r.logementId === logementId) &&
        (!du || r.depart > du) &&
        (!au || r.arrivee <= au),
    );
  }, [reservations, recherche, canaux, statuts, logementId, du, au]);

  const totaux = useMemo(() => {
    const actives = lignes.filter((r) => r.statut !== 'annulee');
    return {
      n: actives.length,
      nuits: actives.reduce((s, r) => s + r.nuits, 0),
      brut: actives.reduce((s, r) => s + r.montantBrutCentimes, 0),
      plateforme: actives.reduce((s, r) => s + r.commissionPlateformeCentimes, 0),
      menage: actives.reduce((s, r) => s + r.fraisMenageCentimes, 0),
    };
  }, [lignes]);

  const colonnes: Colonne<Reservation>[] = [
    {
      cle: 'voyageur',
      titre: 'Voyageur',
      tri: (a, b) => a.voyageur.nom.localeCompare(b.voyageur.nom),
      rendu: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{r.voyageur.nom}</p>
          <p className="truncate text-[12px] text-(--lm-encre-3) sm:hidden">{nomLogement.get(r.logementId)}</p>
        </div>
      ),
    },
    { cle: 'logement', titre: 'Logement', masquerMobile: true, rendu: (r) => nomLogement.get(r.logementId) ?? '-' },
    { cle: 'arrivee', titre: 'Arrivée', tri: (a, b) => a.arrivee.localeCompare(b.arrivee), rendu: (r) => <span className="whitespace-nowrap">{dateCourte(r.arrivee)}</span> },
    { cle: 'depart', titre: 'Départ', masquerMobile: true, tri: (a, b) => a.depart.localeCompare(b.depart), rendu: (r) => <span className="whitespace-nowrap">{dateCourte(r.depart)}</span> },
    { cle: 'nuits', titre: 'Nuits', align: 'droite', tri: (a, b) => a.nuits - b.nuits, rendu: (r) => r.nuits },
    { cle: 'canal', titre: 'Canal', masquerMobile: true, rendu: (r) => <PastilleCanal canal={r.canal} /> },
    { cle: 'statut', titre: 'Statut', rendu: (r) => <StatusBadge type="statutReservation" valeur={r.statut} /> },
    { cle: 'brut', titre: 'Brut', align: 'droite', tri: (a, b) => a.montantBrutCentimes - b.montantBrutCentimes, rendu: (r) => euros(r.montantBrutCentimes) },
  ];

  return (
    <div>
      <div className="mb-4 grid gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <SearchInput valeur={recherche} onChange={setRecherche} placeholder="Rechercher un voyageur" label="Rechercher un voyageur" />
          <FilterChips
            label="Statut"
            filtres={STATUTS.map((s) => ({ cle: s, libelle: LIBELLES.statutReservation[s], compteur: reservations.filter((r) => r.statut === s).length }))}
            actifs={statuts}
            onChange={setStatuts}
          />
        </div>
        {/* Filtres moins fréquents : repliés, ouverts d'office s'ils sont utilisés. */}
        <details open={!!(logementId || du || au || canaux.length) || undefined} className="group">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-[13px] font-medium text-(--lm-or-texte) hover:underline [&::-webkit-details-marker]:hidden">
            Plus de filtres
            <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Logement">
              <Select value={logementId} onChange={(e) => setLogementId(e.target.value)} placeholder="Tous les logements" options={logements.map((l) => ({ valeur: l.id, libelle: l.nom }))} />
            </Field>
            <Field label="Séjours après le">
              <Input type="date" value={du} onChange={(e) => setDu(e.target.value)} />
            </Field>
            <Field label="Séjours avant le">
              <Input type="date" value={au} onChange={(e) => setAu(e.target.value)} />
            </Field>
          </div>
          <FilterChips className="mt-3" label="Canal" filtres={CANAUX.filter((c) => c !== 'autre').map((c) => ({ cle: c, libelle: LIBELLES.canal[c] }))} actifs={canaux} onChange={setCanaux} />
        </details>
      </div>

      {/* Totaux de la sélection en une ligne ; commissions et ménage à un clic. */}
      <details className="mb-3 text-[13px] text-(--lm-encre-2)" aria-label="Totaux de la sélection">
        <summary className="lm-chiffres cursor-pointer list-none [&::-webkit-details-marker]:hidden">
          <span className="font-semibold text-(--lm-encre)">{nombre(totaux.n)}</span> séjours hors annulés ·{' '}
          <span className="font-semibold text-(--lm-encre)">{nombre(totaux.nuits)}</span> nuits ·{' '}
          <span className="font-semibold text-(--lm-encre)">{euros(totaux.brut, true)}</span> brut{' '}
          <span className="text-(--lm-or-texte) hover:underline">Détail</span>
        </summary>
        <p className="lm-chiffres mt-1">
          Commissions plateforme {euros(totaux.plateforme, true)} · Frais de ménage {euros(totaux.menage, true)}
        </p>
      </details>

      <Table
        legende="Réservations"
        colonnes={colonnes}
        lignes={lignes}
        cleLigne={(r) => r.id}
        onLigneClick={onOuvrir}
        triInitial={{ cle: 'arrivee', sens: 'desc' }}
        dense
        vide="Aucune réservation ne correspond."
      />
    </div>
  );
}
