import { useMemo, useState } from 'react';
import { Button, Card, FilterChips, Timeline, type EvenementFrise } from '../../../ui';
import { useErp } from '../../../data/store';
import { LIBELLES } from '../../../data/libelles';
import { dateCourte, dateHeure, euros, note, pluriel } from '../../../data/format';
import type { Logement } from '../../../data/types';

type Genre = 'reservation' | 'journal';
type Evenement = EvenementFrise & { genre: Genre; tri: string };

const GENRES: { cle: Genre; libelle: string }[] = [
  { cle: 'reservation', libelle: 'Séjours' },
  { cle: 'journal', libelle: 'Journal' },
];

/** Séjours et journal du logement (ménages et incidents sont sortis de l'ERP). */
export function OngletHistorique({ logement: l }: { logement: Logement }) {
  const d = useErp();
  const [actifs, setActifs] = useState<string[]>([]);
  const [limite, setLimite] = useState(30);

  const evenements = useMemo<Evenement[]>(() => {
    const mandats = new Set(d.mandats.filter((m) => m.logementId === l.id).map((m) => m.id));
    const tous: Evenement[] = [
      ...d.reservations
        .filter((r) => r.logementId === l.id)
        .map((r): Evenement => ({
          id: r.id,
          genre: 'reservation',
          tri: r.arrivee,
          tone: r.statut === 'annulee' ? 'danger' : 'info',
          titre: `Séjour ${r.voyageur.nom} (${LIBELLES.canal[r.canal]})`,
          meta: `${dateCourte(r.arrivee)} · ${LIBELLES.statutReservation[r.statut]}`,
          description: `${pluriel(r.nuits, 'nuit')}, ${euros(r.montantBrutCentimes)}${r.noteVoyageur !== undefined ? `, note ${note(r.noteVoyageur)}` : ''}`,
        })),
      ...d.journal
        .filter((j) => j.entiteId === l.id || mandats.has(j.entiteId))
        .map((j): Evenement => ({
          id: j.id,
          genre: 'journal',
          tri: j.horodatage,
          tone: 'neutre',
          titre: j.action,
          meta: `${dateHeure(j.horodatage)} · ${j.auteur}`,
          description: j.details || undefined,
        })),
    ];
    return tous.sort((a, b) => b.tri.localeCompare(a.tri));
  }, [d, l.id]);

  const filtres = actifs.length ? evenements.filter((e) => actifs.includes(e.genre)) : evenements;

  return (
    <Card>
      {/* Un seul type d'événement : rien à filtrer. */}
      {GENRES.filter((g) => evenements.some((e) => e.genre === g.cle)).length > 1 && (
        <FilterChips
          label="Type d’événement"
          className="mb-5"
          filtres={GENRES.map((g) => ({ ...g, compteur: evenements.filter((e) => e.genre === g.cle).length })).filter((g) => g.compteur > 0)}
          actifs={actifs}
          onChange={setActifs}
        />
      )}
      <Timeline elements={filtres.slice(0, limite)} vide="Aucun événement pour ce logement." />
      {filtres.length > limite && (
        <Button className="mt-5" onClick={() => setLimite((n) => n + 30)}>
          Afficher plus ({filtres.length - limite} restants)
        </Button>
      )}
    </Card>
  );
}
