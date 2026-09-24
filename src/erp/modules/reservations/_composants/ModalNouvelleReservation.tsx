/**
 * Nouvelle réservation directe : contrôle de chevauchement sur le logement,
 * puis création du séjour et de sa mission de ménage de départ.
 */
import { useMemo, useState, type FormEvent } from 'react';
import { Alert, Button, Field, Input, Modal, Select } from '../../../ui';
import { nouvelId, useErp } from '../../../data/store';
import { checklistMenageVierge } from '../../../data/constantes';
import { AUJOURDHUI, ajouterJours, dateCourte, dateJour, ecartJours, euros, jourMois, pluriel, versCentimes } from '../../../data/format';
import { mandatDuLogement } from '../../../data/selectors';
import type { Id, Mission, Reservation } from '../../../data/types';
import { conflits, statutSelonDates } from './outils';

interface Props {
  ouvert: boolean;
  onFermer: () => void;
  onCree: (r: Reservation) => void;
}

interface Formulaire {
  logementId: Id;
  arrivee: string;
  depart: string;
  nom: string;
  pays: string;
  nbPersonnes: string;
  hebergement: string;
  menage: string;
}

const VIDE: Formulaire = {
  logementId: '',
  arrivee: ajouterJours(AUJOURDHUI, 7),
  depart: ajouterJours(AUJOURDHUI, 10),
  nom: '',
  pays: 'France',
  nbPersonnes: '2',
  hebergement: '',
  menage: '',
};

export function ModalNouvelleReservation({ ouvert, onFermer, onCree }: Props) {
  const d = useErp();
  const [f, setF] = useState<Formulaire>(VIDE);
  const [erreurs, setErreurs] = useState<Partial<Record<keyof Formulaire, string>>>({});
  const maj = <K extends keyof Formulaire>(k: K, v: Formulaire[K]) => setF((x) => ({ ...x, [k]: v }));

  const reservables = d.logements.filter((l) => l.statut === 'actif');
  const logement = d.logements.find((l) => l.id === f.logementId);
  const mandat = logement ? mandatDuLogement(d.mandats, logement.id) : undefined;
  const menageDefaut = mandat?.fraisMenageCentimes;

  const datesValides = f.arrivee && f.depart && f.depart > f.arrivee;
  const chevauchements = useMemo(
    () => (logement && datesValides ? conflits(d.reservations, logement.id, f.arrivee, f.depart) : []),
    [d.reservations, logement, datesValides, f.arrivee, f.depart],
  );
  const nuits = datesValides ? ecartJours(f.arrivee, f.depart) : 0;

  const fermer = () => {
    setF(VIDE);
    setErreurs({});
    onFermer();
  };

  const soumettre = (e: FormEvent) => {
    e.preventDefault();
    const err: typeof erreurs = {};
    if (!logement) err.logementId = 'Choisissez un logement actif.';
    if (!f.arrivee) err.arrivee = 'Date d’arrivée requise.';
    else if (f.arrivee < AUJOURDHUI) err.arrivee = 'L’arrivée ne peut pas être dans le passé.';
    if (!datesValides) err.depart = 'Le départ doit être après l’arrivée.';
    if (f.nom.trim().length < 2) err.nom = 'Nom du voyageur requis.';
    const nb = Number(f.nbPersonnes);
    if (!Number.isInteger(nb) || nb < 1) err.nbPersonnes = 'Au moins 1 personne.';
    else if (logement && nb > logement.capacite) err.nbPersonnes = `Capacité maximale : ${logement.capacite} personnes.`;
    const heb = versCentimes(f.hebergement);
    if (!Number.isFinite(heb) || heb <= 0) err.hebergement = 'Montant d’hébergement requis.';
    const men = f.menage.trim() === '' ? (menageDefaut ?? 0) : versCentimes(f.menage);
    if (!Number.isFinite(men) || men < 0) err.menage = 'Montant invalide.';
    if (chevauchements.length) err.depart = 'Ces dates chevauchent une réservation existante.';
    setErreurs(err);
    if (Object.keys(err).length || !logement) return;

    const reservation: Reservation = {
      id: nouvelId('res'),
      logementId: logement.id,
      canal: 'direct',
      voyageur: { nom: f.nom.trim(), pays: f.pays.trim() || undefined, nbPersonnes: nb },
      arrivee: f.arrivee,
      depart: f.depart,
      nuits,
      statut: statutSelonDates(f.arrivee, f.depart),
      montantBrutCentimes: heb + men,
      commissionPlateformeCentimes: 0,
      fraisMenageCentimes: men,
    };
    const dernierTarif = d.missions
      .filter((m) => m.logementId === logement.id && m.type === 'menage')
      .sort((a, b) => b.date.localeCompare(a.date))[0]?.tarifCentimes;
    const mission: Mission = {
      id: nouvelId('mis'),
      type: 'menage',
      logementId: logement.id,
      reservationId: reservation.id,
      date: reservation.depart,
      heureDebut: logement.fiche.heureDepart,
      heureFinMax: logement.fiche.heureArrivee,
      statut: 'a_attribuer',
      checklist: checklistMenageVierge(),
      photos: [],
      tarifCentimes: dernierTarif ?? 3500,
      controleQualite: false,
    };
    d.upsert('reservations', reservation);
    d.upsert('missions', mission);
    onCree(reservation);
    fermer();
  };

  return (
    <Modal
      ouvert={ouvert}
      onFermer={fermer}
      taille="lg"
      titre="Nouvelle réservation directe"
      description="Séjour réservé hors plateformes. Le ménage de départ est créé automatiquement, à attribuer."
      pied={
        <>
          <Button variant="ghost" onClick={fermer}>
            Annuler
          </Button>
          <Button variant="primary" type="submit" form="form-resa-directe" disabled={chevauchements.length > 0}>
            Créer la réservation
          </Button>
        </>
      }
    >
      <form id="form-resa-directe" onSubmit={soumettre} noValidate className="grid gap-4 sm:grid-cols-2">
        <Field label="Logement" requis erreur={erreurs.logementId} className="sm:col-span-2" aide="Seuls les logements actifs (mandat signé, checklist complète) sont réservables.">
          <Select
            value={f.logementId}
            onChange={(e) => maj('logementId', e.target.value)}
            placeholder="Choisir un logement"
            options={reservables.map((l) => ({ valeur: l.id, libelle: `${l.nom} (${l.ville}, ${l.capacite} pers.)` }))}
          />
        </Field>
        <Field label="Arrivée" requis erreur={erreurs.arrivee}>
          <Input type="date" min={AUJOURDHUI} value={f.arrivee} onChange={(e) => maj('arrivee', e.target.value)} />
        </Field>
        <Field label="Départ" requis erreur={erreurs.depart} aide={nuits > 0 ? pluriel(nuits, 'nuit') : undefined}>
          <Input type="date" min={f.arrivee || AUJOURDHUI} value={f.depart} onChange={(e) => maj('depart', e.target.value)} />
        </Field>

        {chevauchements.length > 0 && (
          <Alert tone="danger" titre="Dates indisponibles : surbooking refusé" className="sm:col-span-2">
            <ul className="mt-1 space-y-1">
              {chevauchements.map((c) => (
                <li key={c.reservation.id}>
                  {c.reservation.voyageur.nom} ({dateCourte(c.reservation.arrivee)} au {dateCourte(c.reservation.depart)}) :{' '}
                  {c.nuits.length > 4
                    ? `${pluriel(c.nuits.length, 'nuit')} en conflit, du ${dateJour(c.nuits[0])} au ${dateJour(c.nuits[c.nuits.length - 1])}`
                    : `nuit${c.nuits.length > 1 ? 's' : ''} du ${c.nuits.map(jourMois).join(', ')}`}
                </li>
              ))}
            </ul>
          </Alert>
        )}

        <Field label="Nom du voyageur" requis erreur={erreurs.nom}>
          <Input value={f.nom} onChange={(e) => maj('nom', e.target.value)} autoComplete="off" placeholder="Prénom Nom" />
        </Field>
        <Field label="Pays">
          <Input value={f.pays} onChange={(e) => maj('pays', e.target.value)} />
        </Field>
        <Field label="Nombre de personnes" requis erreur={erreurs.nbPersonnes}>
          <Input type="number" min={1} max={logement?.capacite} value={f.nbPersonnes} onChange={(e) => maj('nbPersonnes', e.target.value)} />
        </Field>
        <Field label="Hébergement total (€)" requis erreur={erreurs.hebergement} aide="Prix des nuits, hors frais de ménage.">
          <Input inputMode="decimal" value={f.hebergement} onChange={(e) => maj('hebergement', e.target.value)} placeholder="ex. 360" />
        </Field>
        <Field
          label="Frais de ménage (€)"
          erreur={erreurs.menage}
          aide={menageDefaut !== undefined ? `Par défaut, ceux du mandat : ${euros(menageDefaut)}.` : 'Selon le mandat du logement.'}
        >
          <Input inputMode="decimal" value={f.menage} onChange={(e) => maj('menage', e.target.value)} placeholder={menageDefaut !== undefined ? String(menageDefaut / 100) : ''} />
        </Field>
        <p className="self-end text-[12.5px] text-(--lm-encre-2) sm:col-span-2">
          Canal direct : aucune commission plateforme. Pensez à bloquer les dates sur Airbnb et Booking via Channex.
        </p>
      </form>
    </Modal>
  );
}
