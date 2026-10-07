/**
 * Module Réservations (/erp/reservations) : planning multi-logements, liste
 * filtrable, détail d'un séjour (/erp/reservations/:id), réservation directe.
 */
import { useMemo, useState } from 'react';
import { Route, Routes, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, CalendarDays, CalendarPlus, List, LogIn, LogOut, Percent, RefreshCw } from 'lucide-react';
import { Button, Callout, Drawer, MenuActions, PageHeader, StatusBadge, Tabs, useCreationParUrl } from '../../ui';
import { useErp } from '../../data/store';
import { AUJOURDHUI, ajouterJours, dateCourte, dateHeure, euros, pluriel, pourcentage } from '../../data/format';
import { adr, fenetreJours, logementById, logementsActifs, tauxOccupation } from '../../data/selectors';
import type { Reservation } from '../../data/types';
import { Calendrier } from './_composants/Calendrier';
import { FicheReservation, PastilleCanal } from './_composants/FicheReservation';
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

/** Les repères de la semaine, sur une ligne : le planning juste dessous montre le détail. */
function Indicateurs() {
  const d = useErp();
  const k = useMemo(() => {
    const f = fenetreJours(30);
    const actifs = logementsActifs(d.logements);
    const dans7 = ajouterJours(AUJOURDHUI, 7);
    const vivantes = d.reservations.filter((r) => r.statut !== 'annulee');
    return {
      occupation: tauxOccupation(d.reservations, actifs, f),
      adr: adr(d.reservations.filter((r) => actifs.some((l) => l.id === r.logementId)), f),
      arrivees: vivantes.filter((r) => r.arrivee >= AUJOURDHUI && r.arrivee < dans7).length,
      departs: vivantes.filter((r) => r.depart >= AUJOURDHUI && r.depart < dans7).length,
    };
  }, [d.reservations, d.logements]);
  return (
    <p className="lm-chiffres mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-(--lm-encre-2) [&_svg]:size-4 [&_svg]:text-(--lm-encre-3)">
      <span className="inline-flex items-center gap-1.5" title="Sur 7 jours, aujourd’hui compris">
        <LogIn aria-hidden />
        <span className="font-semibold text-(--lm-encre)">{k.arrivees}</span> arrivée{k.arrivees > 1 ? 's' : ''} cette semaine
      </span>
      <span className="inline-flex items-center gap-1.5">
        <LogOut aria-hidden />
        <span className="font-semibold text-(--lm-encre)">{k.departs}</span> départ{k.departs > 1 ? 's' : ''}
      </span>
      <span className="inline-flex items-center gap-1.5" title={`Prix moyen : ${euros(k.adr, true)} la nuit`}>
        <Percent aria-hidden />
        <span className="font-semibold text-(--lm-encre)">{pourcentage(Math.round(k.occupation * 100) / 100)}</span> d’occupation sur 30 jours
      </span>
    </p>
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

      <Indicateurs />

      <Tabs
        label="Affichage des réservations"
        actif={vue}
        onChange={(v) => setParams(v === 'liste' ? { vue: 'liste' } : {}, { replace: true })}
        onglets={[
          { cle: 'calendrier', libelle: <><CalendarDays className="size-4" aria-hidden /> Planning</> },
          { cle: 'liste', libelle: <><List className="size-4" aria-hidden /> Liste</>, compteur: d.reservations.length },
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
        sousTitre={
          courante && (
            <span className="flex flex-wrap items-center gap-2">
              {logementById(d, courante.logementId)?.nom} · {dateCourte(courante.arrivee)} au {dateCourte(courante.depart)} · {pluriel(courante.nuits, 'nuit')}
              <StatusBadge type="statutReservation" valeur={courante.statut} />
              <PastilleCanal canal={courante.canal} />
            </span>
          )
        }
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
            `C’est noté : ${r.voyageur.nom} du ${dateCourte(r.arrivee)} au ${dateCourte(r.depart)}. Ménage de départ créé, à attribuer.`,
          )
        }
      />
    </>
  );
}
