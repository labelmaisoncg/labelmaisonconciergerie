/**
 * Module Réservations (/erp/reservations) : planning multi-logements, liste
 * filtrable, détail d'un séjour (/erp/reservations/:id), réservation directe.
 */
import { useMemo, useState } from 'react';
import { Route, Routes, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, CalendarDays, CalendarPlus, List, LogIn, LogOut, Percent, TrendingUp, Wallet } from 'lucide-react';
import { Button, Callout, Drawer, PageHeader, Stat, StatusBadge, Tabs } from '../../ui';
import { useErp } from '../../data/store';
import { AUJOURDHUI, ajouterJours, dateCourte, euros, pluriel, pourcentage } from '../../data/format';
import { adr, fenetreJours, logementById, logementsActifs, revpar, tauxOccupation } from '../../data/selectors';
import type { Reservation } from '../../data/types';
import { Calendrier } from './_composants/Calendrier';
import { FicheReservation, PastilleCanal } from './_composants/FicheReservation';
import { ListeReservations } from './_composants/ListeReservations';
import { ModalNouvelleReservation } from './_composants/ModalNouvelleReservation';
import { DetailReservation } from './_composants/DetailReservation';

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
      revpar: revpar(d.reservations, actifs, f),
      arrivees: vivantes.filter((r) => r.arrivee >= AUJOURDHUI && r.arrivee < dans7).length,
      departs: vivantes.filter((r) => r.depart >= AUJOURDHUI && r.depart < dans7).length,
    };
  }, [d.reservations, d.logements]);
  return (
    <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
      <Stat label="Occupation 30 j" valeur={pourcentage(Math.round(k.occupation * 100) / 100)} icone={<Percent />} aide="Logements actifs" />
      <Stat label="ADR 30 j" valeur={euros(k.adr, true)} icone={<TrendingUp />} aide="Prix moyen par nuit" />
      <Stat label="RevPAR 30 j" valeur={euros(k.revpar, true)} icone={<Wallet />} aide="Par nuit disponible" />
      <Stat label="Arrivées 7 j" valeur={k.arrivees} icone={<LogIn />} aide="Aujourd’hui inclus" />
      <Stat label="Départs 7 j" valeur={k.departs} icone={<LogOut />} aide="Ménages à prévoir" className="col-span-2 lg:col-span-1" />
    </div>
  );
}

function PageReservations() {
  const d = useErp();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const logementFiltre = params.get('logement') ?? '';
  // Venir d'une fiche logement ouvre directement la liste filtrée.
  const vueDemandee = params.get('vue') ?? (logementFiltre ? 'liste' : 'calendrier');
  const vue = vueDemandee === 'liste' ? 'liste' : 'calendrier';
  const [ouverte, setOuverte] = useState<Reservation | null>(null);
  const [creation, setCreation] = useState(false);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const logementsPlanning = d.logements.filter((l) => l.statut === 'actif' || l.statut === 'lancement');
  const courante = ouverte ? (d.reservations.find((r) => r.id === ouverte.id) ?? ouverte) : null;

  return (
    <>
      <PageHeader
        fil={[{ libelle: 'ERP', to: '/erp' }, { libelle: 'Réservations' }]}
        titre="Réservations"
        sousTitre="Qui dort où, quand, à quel prix. Une ligne par logement, une barre par séjour."
        actions={
          <Button variant="primary" icone={<CalendarPlus />} onClick={() => setCreation(true)}>
            Nouvelle réservation directe
          </Button>
        }
      />
      <Callout tone="info" titre="Source : Channex (démo)" className="mb-5">
        En production, les réservations arrivent en temps réel d’Airbnb et Booking ; les modifications de calendrier passent par confirmation.
      </Callout>
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
            `Réservation de ${r.voyageur.nom} créée (${dateCourte(r.arrivee)} au ${dateCourte(r.depart)}). Ménage de départ du ${dateCourte(r.depart)} créé, à attribuer.`,
          )
        }
      />
    </>
  );
}
