/**
 * Page détail d'une réservation (/erp/reservations/:id), adressable.
 * Seules les réservations directes s'annulent ici : celles des plateformes
 * s'annulent sur Airbnb ou Booking et redescendent par Repull.
 */
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { CalendarX2, SearchX } from 'lucide-react';
import { Button, ButtonLink, EmptyState, Modal, PageHeader } from '../../../ui';
import { useErp } from '../../../data/store';
import { pluriel } from '../../../data/format';
import { LIBELLES } from '../../../data/libelles';
import { FicheReservation } from './FicheReservation';
import { etatSejour, plageDates } from './outils';

export function DetailReservation() {
  const { id } = useParams();
  const d = useErp();
  const r = d.reservations.find((x) => x.id === id);
  const [confirmer, setConfirmer] = useState(false);

  if (!r) {
    return (
      <>
        <PageHeader fil={[{ libelle: 'ERP', to: '/erp' }, { libelle: 'Réservations', to: '/erp/reservations' }, { libelle: 'Introuvable' }]} titre="Réservation introuvable" />
        <EmptyState icone={<SearchX />} titre="Cette réservation n’existe plus." action={<ButtonLink to="/erp/reservations">Voir les réservations</ButtonLink>} />
      </>
    );
  }

  // Une réservation importée de Repull s'annule sur sa plateforme (sinon la synchronisation la rétablirait).
  const annulable = r.canal === 'direct' && r.statut === 'confirmee' && !r.repull;
  const missionsOuvertes = d.missions.filter((m) => m.reservationId === r.id && m.statut !== 'validee' && m.statut !== 'annulee');

  const annuler = () => {
    d.upsert('reservations', { ...r, statut: 'annulee' });
    for (const m of missionsOuvertes) d.upsert('missions', { ...m, statut: 'annulee' });
    setConfirmer(false);
  };

  return (
    <>
      <PageHeader
        fil={[{ libelle: 'ERP', to: '/erp' }, { libelle: 'Réservations', to: '/erp/reservations' }, { libelle: r.voyageur.nom }]}
        titre={r.voyageur.nom}
        sousTitre={`${etatSejour(r)} · ${plageDates(r.arrivee, r.depart)} · ${LIBELLES.canal[r.canal]}`}
        actions={
          annulable && (
            <Button variant="secondary" icone={<CalendarX2 />} onClick={() => setConfirmer(true)}>
              Annuler la réservation
            </Button>
          )
        }
      />
      <div className="max-w-3xl">
        <FicheReservation r={r} />
      </div>

      <Modal
        ouvert={confirmer}
        onFermer={() => setConfirmer(false)}
        taille="sm"
        titre="Annuler cette réservation ?"
        description={`Le séjour de ${r.voyageur.nom} sera marqué annulé et ${pluriel(missionsOuvertes.length, 'mission de ménage')} annulée${missionsOuvertes.length > 1 ? 's' : ''}. Aucun remboursement n’est déclenché : il se traite à part, par un humain.`}
        pied={
          <>
            <Button variant="ghost" onClick={() => setConfirmer(false)}>
              Garder
            </Button>
            <Button variant="danger" onClick={annuler}>
              Annuler la réservation
            </Button>
          </>
        }
      />
    </>
  );
}
