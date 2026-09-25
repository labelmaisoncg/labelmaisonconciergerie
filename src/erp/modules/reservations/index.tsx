/**
 * Module Réservations (/erp/reservations) : planning multi-logements, liste
 * filtrable, détail d'un séjour (/erp/reservations/:id), réservation directe.
 */
import { useMemo, useState } from 'react';
import { Route, Routes, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, CalendarDays, CalendarPlus, List, LogIn, LogOut, Percent } from 'lucide-react';
import { Button, Callout, Drawer, PageHeader, Stat, StatusBadge, Tabs, useCreationParUrl } from '../../ui';
import { useErp } from '../../data/store';
import { AUJOURDHUI, ajouterJours, dateCourte, euros, pluriel, pourcentage } from '../../data/format';
import { adr, fenetreJours, logementById, logementsActifs, tauxOccupation } from '../../data/selectors';
import type { Reservation } from '../../data/types';
import { Calendrier } from './_composants/Calendrier';
import { FicheReservation, PastilleCanal } from './_composants/FicheReservation';
import { ListeReservations } from './_composants/ListeReservations';
import { ModalNouvelleReservation } from './_composants/ModalNouvelleReservation';
import { DetailReservation } from './_composants/DetailReservation';
import { LigneSynchroRepull } from '../parametres/SynchroRepull';

export default function ModuleReservations() {
  return (
    <Routes>
      <Route index element={<PageReservations />} />
      <Route path=":id" element={<DetailReservation />} />
    </Routes>
  );
}

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
    <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Stat label="Logements occupés (30 jours)" valeur={pourcentage(Math.round(k.occupation * 100) / 100)} icone={<Percent />} aide={`Prix moyen : ${euros(k.adr, true)} la nuit`} />
      <Stat label="Arrivées cette semaine" valeur={k.arrivees} icone={<LogIn />} aide="Aujourd’hui compris" />
      <Stat label="Départs cette semaine" valeur={k.departs} icone={<LogOut />} aide="Autant de ménages à prévoir" />
    </div>
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

  return (
    <>
      <PageHeader
        fil={[{ libelle: 'ERP', to: '/erp' }, { libelle: 'Réservations' }]}
        titre="Réservations"
        sousTitre="Qui dort où, et quand. Une ligne par logement, une barre par séjour."
        actions={
          <Button variant="primary" icone={<CalendarPlus />} onClick={() => setCreation(true)}>
            Nouvelle réservation
          </Button>
        }
      />
      <LigneSynchroRepull className="mb-5" />
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
            `C’est noté : ${r.voyageur.nom} du ${dateCourte(r.arrivee)} au ${dateCourte(r.depart)}. Le ménage du départ est prévu, il reste à choisir qui le fera.`,
          )
        }
      />
    </>
  );
}
