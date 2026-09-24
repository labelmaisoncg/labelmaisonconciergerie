import { useMemo, useState } from 'react';
import { Button, Card, FilterChips, Timeline, type EvenementFrise, type Ton } from '../../../ui';
import { useErp } from '../../../data/store';
import { LIBELLES } from '../../../data/libelles';
import { dateCourte, dateHeure, euros, pluriel } from '../../../data/format';
import { prestataireById } from '../../../data/selectors';
import type { Logement } from '../../../data/types';

type Genre = 'reservation' | 'mission' | 'incident' | 'journal';
type Evenement = EvenementFrise & { genre: Genre; tri: string };

const GENRES: { cle: Genre; libelle: string }[] = [
  { cle: 'reservation', libelle: 'Réservations' },
  { cle: 'mission', libelle: 'Missions' },
  { cle: 'incident', libelle: 'Incidents' },
  { cle: 'journal', libelle: 'Journal' },
];

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
          description: `${pluriel(r.nuits, 'nuit')}, ${euros(r.montantBrutCentimes)}${r.noteVoyageur !== undefined ? `, note ${r.noteVoyageur}` : ''}`,
        })),
      ...d.missions
        .filter((m) => m.logementId === l.id)
        .map((m): Evenement => ({
          id: m.id,
          genre: 'mission',
          tri: m.date,
          tone: m.statut === 'validee' ? 'succes' : m.statut === 'refusee' ? 'danger' : 'or',
          titre: `${LIBELLES.typeMission[m.type]} · ${LIBELLES.statutMission[m.statut]}`,
          meta: dateCourte(m.date),
          description: prestataireById(d, m.prestataireId)?.nom ?? 'Non attribuée',
        })),
      ...d.incidents
        .filter((i) => i.logementId === l.id)
        .map((i): Evenement => ({
          id: i.id,
          genre: 'incident',
          tri: i.date,
          tone: (i.statut === 'resolu' ? 'succes' : i.gravite === 'haute' ? 'danger' : 'alerte') as Ton,
          titre: `Incident ${LIBELLES.categorieIncident[i.categorie].toLowerCase()} · ${LIBELLES.statutIncident[i.statut]}`,
          meta: dateCourte(i.date),
          description: i.description,
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
      <FilterChips
        label="Type d’événement"
        className="mb-5"
        filtres={GENRES.map((g) => ({ ...g, compteur: evenements.filter((e) => e.genre === g.cle).length }))}
        actifs={actifs}
        onChange={setActifs}
      />
      <Timeline elements={filtres.slice(0, limite)} vide="Aucun événement pour ce logement." />
      {filtres.length > limite && (
        <Button className="mt-5" onClick={() => setLimite((n) => n + 30)}>
          Afficher plus ({filtres.length - limite} restants)
        </Button>
      )}
    </Card>
  );
}
