/**
 * Module Réservations (/erp/reservations) : planning multi-logements à la
 * manière d'Airbnb, liste des séjours, détail d'un séjour
 * (/erp/reservations/:id), réservation directe. Les chiffres de la période
 * sont sur l'Accueil : ici, on regarde les séjours.
 */
import { useState } from 'react';
import { Route, Routes, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, CalendarDays, CalendarPlus, List, RefreshCw } from 'lucide-react';
import { Button, Callout, Drawer, MenuActions, PageHeader, Tabs, useCreationParUrl } from '../../ui';
import { useErp } from '../../data/store';
import { dateCourte, dateHeure } from '../../data/format';
import { LIBELLES } from '../../data/libelles';
import type { Reservation } from '../../data/types';
import { Calendrier } from './_composants/Calendrier';
import { FicheReservation } from './_composants/FicheReservation';
import { etatSejour, plageDates } from './_composants/outils';
import { ListeReservations } from './_composants/ListeReservations';
import { ModalNouvelleReservation } from './_composants/ModalNouvelleReservation';
import { DetailReservation } from './_composants/DetailReservation';
import { useSynchroRepull } from '../parametres/SynchroRepull';

export default function ModuleReservations() {
  return (
    <Routes>
      <Route index element={<PageReservations />} />
      <Route path=":id" element={<DetailReservation />} />
    </Routes>
  );
}

function PageReservations() {
  const d = useErp();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const logementFiltre = params.get('logement') ?? '';
  // Venir d'une fiche logement ouvre directement la liste filtrée.
  const vueDemandee = params.get('vue') ?? (logementFiltre || params.get('q') ? 'liste' : 'calendrier');
  const vue = vueDemandee === 'liste' ? 'liste' : 'calendrier';
  const [ouverte, setOuverte] = useState<Reservation | null>(null);
  const [creation, setCreation] = useCreationParUrl();
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const logementsPlanning = d.logements.filter((l) => l.statut === 'actif' || l.statut === 'lancement');
  const courante = ouverte ? (d.reservations.find((r) => r.id === ouverte.id) ?? ouverte) : null;
  // Synchronisation Airbnb / Booking.com : la date tient dans le sous-titre, le bouton passe dans « Plus ».
  const synchro = useSynchroRepull();

  return (
    <>
      <PageHeader
        fil={[{ libelle: 'ERP', to: '/erp' }, { libelle: 'Réservations' }]}
        titre="Réservations"
        sousTitre={
          synchro.demo
            ? undefined
            : synchro.derniere
              ? `Airbnb et Booking.com à jour le ${dateHeure(synchro.derniere.horodatage)}.`
              : 'Airbnb et Booking.com : pas encore de mise à jour.'
        }
        actions={
          <>
            <Button variant="primary" icone={<CalendarPlus />} onClick={() => setCreation(true)}>
              Nouvelle réservation
            </Button>
            {!synchro.demo && (
              <MenuActions
                actions={[
                  {
                    libelle: synchro.enCours ? 'Synchronisation…' : 'Synchroniser Airbnb et Booking.com',
                    icone: <RefreshCw />,
                    disabled: !synchro.disponible || synchro.enCours,
                    onClick: () => void synchro.synchroniser(),
                  },
                ]}
              />
            )}
          </>
        }
      />
      {synchro.retour && (
        <Callout tone={synchro.retour.ton} className="mb-5">
          {synchro.retour.texte}
        </Callout>
      )}
      {confirmation && (
        <Callout tone="succes" className="mb-5" actions={<Button size="sm" variant="ghost" onClick={() => setConfirmation(null)}>Masquer</Button>}>
          {confirmation}
        </Callout>
      )}

      <Tabs
        label="Affichage des réservations"
        actif={vue}
        onChange={(v) => setParams(v === 'liste' ? { vue: 'liste' } : {}, { replace: true })}
        onglets={[
          { cle: 'calendrier', libelle: <><CalendarDays className="size-4" aria-hidden /> Planning</> },
          { cle: 'liste', libelle: <><List className="size-4" aria-hidden /> Séjours</> },
        ]}
      />

      {vue === 'calendrier' ? (
        <Calendrier logements={logementsPlanning} reservations={d.reservations} onOuvrir={setOuverte} />
      ) : (
        <ListeReservations reservations={d.reservations} logements={d.logements} onOuvrir={setOuverte} logementInitial={logementFiltre} />
      )}

      <Drawer
        ouvert={!!courante}
        onFermer={() => setOuverte(null)}
        titre={courante?.voyageur.nom ?? ''}
        sousTitre={courante && `${etatSejour(courante)} · ${plageDates(courante.arrivee, courante.depart)} · ${LIBELLES.canal[courante.canal]}`}
        pied={
          courante && (
            <Button variant="primary" iconeFin={<ArrowRight />} onClick={() => navigate(courante.id)}>
              Ouvrir la fiche complète
            </Button>
          )
        }
      >
        {courante && <FicheReservation r={courante} />}
      </Drawer>

      <ModalNouvelleReservation
        ouvert={creation}
        onFermer={() => setCreation(false)}
        onCree={(r) =>
          setConfirmation(
            `C’est noté : ${r.voyageur.nom} du ${dateCourte(r.arrivee)} au ${dateCourte(r.depart)}.`,
          )
        }
      />
    </>
  );
}
