/**
 * Page détail d'une réservation (/erp/reservations/:id), adressable.
 * Seules les réservations directes s'annulent ici : celles des plateformes
 * s'annulent sur Airbnb ou Booking et redescendent par Channex.
 */
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { CalendarX2, SearchX } from 'lucide-react';
import { Alert, Button, EmptyState, Modal, PageHeader, StatusBadge } from '../../../ui';
import { useErp } from '../../../data/store';
import { dateCourte, pluriel } from '../../../data/format';
import { logementById } from '../../../data/selectors';
import { FicheReservation, PastilleCanal } from './FicheReservation';

export function DetailReservation() {
  const { id } = useParams();
  const d = useErp();
  const r = d.reservations.find((x) => x.id === id);
  const [confirmer, setConfirmer] = useState(false);

  if (!r) {
    return (
      <>
        <PageHeader fil={[{ libelle: 'ERP', to: '/erp' }, { libelle: 'Réservations', to: '/erp/reservations' }, { libelle: 'Introuvable' }]} titre="Réservation introuvable" />
        <EmptyState icone={<SearchX />} titre="Cette réservation n’existe pas ou plus." description="Elle a peut-être été supprimée de la démo." />
      </>
    );
  }

  const logement = logementById(d, r.logementId);
  const annulable = r.canal === 'direct' && (r.statut === 'confirmee');
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
        sousTitre={
          <span className="flex flex-wrap items-center gap-2">
            {logement?.nom} · {dateCourte(r.arrivee)} au {dateCourte(r.depart)} · {pluriel(r.nuits, 'nuit')}
            <StatusBadge type="statutReservation" valeur={r.statut} />
            <PastilleCanal canal={r.canal} />
          </span>
        }
        actions={
          annulable && (
            <Button variant="secondary" icone={<CalendarX2 />} onClick={() => setConfirmer(true)}>
              Annuler la réservation
            </Button>
          )
        }
      />
      {r.canal !== 'direct' && r.statut === 'confirmee' && (
        <Alert tone="neutre" className="mb-4">
          Réservation {r.canal === 'airbnb' ? 'Airbnb' : 'Booking.com'} : toute modification ou annulation se fait sur la plateforme, puis redescend par Channex.
        </Alert>
      )}
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
